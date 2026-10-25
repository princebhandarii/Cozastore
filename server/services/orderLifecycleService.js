import mongoose from "mongoose";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import { ApiError, notFound } from "../utils/ApiError.js";
import { assertTransition } from "../utils/orderStatus.js";
import { HOLDS_RESERVATIONS } from "../utils/cancellation.js";
import { reverseOrderReservations } from "./reversalService.js";
import { issueRefund } from "./refundService.js";
import User from "../models/User.js";
import { sendShippedEmail, sendOutForDeliveryEmail, sendDeliveredEmail, sendCancelledEmail } from "./email/emailService.js";

const concurrentChange = () =>
  new ApiError(409, "This order was just updated by someone else. Refresh and try again.", "CONCURRENT_UPDATE");

// Moves an order forward through fulfilment (admin only). Validates the
// transition, sets shipment details, and writes the timeline entry in one
// atomic compare-and-set on the status we read.
export const adminUpdateStatus = async ({ orderId, to, note = "", shipping = {} }) => {
  const order = await Order.findById(orderId);
  if (!order) throw notFound("Order not found");
  if (order.status === "PENDING_COD_CONFIRMATION") {
    throw new ApiError(409, "Use Confirm / Reject for COD orders that are awaiting confirmation", "USE_COD_ACTIONS");
  }
  assertTransition(order.status, to);

  const now = new Date();
  const set = { status: to };
  let timelineNote = note;

  if (to === "SHIPPED") {
    set["shipping.provider"] = shipping.shipmentId ? "shiprocket" : "manual";
    set["shipping.shipmentId"] = shipping.shipmentId || null;
    set["shipping.courier"] = shipping.courier;
    set["shipping.trackingNumber"] = shipping.trackingNumber;
    set["shipping.trackingUrl"] = shipping.trackingUrl || null;
    set["shipping.estimatedDelivery"] = shipping.estimatedDelivery || null;
    set["shipping.shippedAt"] = now;
  } else if (shipping.estimatedDelivery) {
    set["shipping.estimatedDelivery"] = shipping.estimatedDelivery;
  }

  if (to === "DELIVERED") {
    set["shipping.deliveredAt"] = now;
    if (order.paymentMethod === "COD") {
      // The courier collected the balance in cash at the door.
      set["cod.remainingPaid"] = true;
      set.paymentStatus = "PAID";
      timelineNote = `${note ? `${note}. ` : ""}COD balance of ₹${order.cod.remainingAmount} collected on delivery`;
    }
  }

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    { $set: set, $push: { timeline: { status: to, note: timelineNote, actor: "admin", at: now } } },
    { returnDocument: "after" }
  );
  if (!updated) throw concurrentChange();

  const buyer = await User.findById(updated.user).select("email");
  if (to === "SHIPPED") sendShippedEmail(updated, buyer.email);
  else if (to === "OUT_FOR_DELIVERY") sendOutForDeliveryEmail(updated, buyer.email);
  else if (to === "DELIVERED") sendDeliveredEmail(updated, buyer.email);

  return updated;
};

// Cancels an order and undoes its side effects.
//   refund: "none" | "full" | "token" | "review"  (see utils/cancellation.js)
// Status change + stock/coupon reversal happen in one transaction; the
// Razorpay refund (an external call) follows it.
export const cancelOrder = async ({ order, actor, reason, refund }) => {
  assertTransition(order.status, "CANCELLED");
  const holds = HOLDS_RESERVATIONS.includes(order.status);
  const fromStatus = order.status;

  const session = await mongoose.startSession();
  let cancelled;
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const note = `${actor === "admin" ? "Cancelled by store" : "Cancelled by customer"}${reason ? `: ${reason}` : ""}`;
      cancelled = await Order.findOneAndUpdate(
        { _id: order._id, status: fromStatus },
        {
          $set: { status: "CANCELLED", ...(refund === "review" && { needsRefundDecision: true }) },
          $push: { timeline: { status: "CANCELLED", note, actor, at: now } },
        },
        { returnDocument: "after", session }
      );
      if (!cancelled) throw concurrentChange();
      if (holds) {
        await reverseOrderReservations({ order: cancelled, reason: "ORDER_CANCELLED", performedBy: null, session });
      }
    });
  } finally {
    await session.endSession();
  }

  let refundResult = { attempted: false, mode: refund };
  if (refund === "full" || refund === "token") {
    const paymentId = order.paymentMethod === "COD" ? order.cod?.tokenPaymentId : null;
    const payment = paymentId
      ? await Payment.findById(paymentId)
      : await Payment.findOne({ order: order._id, purpose: "ORDER", status: "PAID" });
    if (payment && payment.status === "PAID") {
      const doc = await Order.findById(order._id);
      const result = await issueRefund({ payment, order: doc, amountRupees: payment.amount, reason: `Order cancelled: ${reason || "no reason given"}` });
      await payment.save();
      await doc.save();
      refundResult = { attempted: true, ok: result.ok, mode: refund, error: result.error };
    }
  }

  const finalOrder = await Order.findById(order._id);
  const buyer = await User.findById(finalOrder.user).select("email");
  const refundNote =
    refundResult.attempted && refundResult.ok ? "Your refund has been initiated and should reflect in 5-7 working days."
    : refundResult.attempted && !refundResult.ok ? "We attempted to refund you automatically but it needs a manual follow-up - our team will be in touch."
    : refund === "none" ? null : null;
  sendCancelledEmail(finalOrder, buyer.email, refundNote);

  return { order: finalOrder, refund: refundResult };
};

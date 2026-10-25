import mongoose from "mongoose";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Product from "../models/Product.js";
import InventoryLog from "../models/InventoryLog.js";
import ReturnRequest from "../models/ReturnRequest.js";
import { ApiError, badRequest, notFound } from "../utils/ApiError.js";
import { assertTransition } from "../utils/orderStatus.js";
import { splitRefund } from "../utils/returnRefund.js";
import { issueRefund } from "./refundService.js";
import User from "../models/User.js";
import { sendReturnDecisionEmail, sendRefundInitiatedEmail, sendRefundCompletedEmail } from "./email/emailService.js";

const concurrent = () => new ApiError(409, "This return was just updated by someone else. Refresh and try again.", "CONCURRENT_UPDATE");
const refundedSoFar = (payment) => payment.refunds.filter((r) => r.status !== "FAILED").reduce((n, r) => n + r.amount, 0);

// Admin moves a return forward. Return + order statuses change together in one
// transaction, each as a compare-and-set on the status we read.
export const adminUpdateReturn = async ({ returnId, to, note, restock }) => {
  const ret = await ReturnRequest.findById(returnId);
  if (!ret) throw notFound("Return not found");
  assertTransition(ret.status, to);
  if (to === "RETURN_REJECTED" && !note) throw badRequest("Please give a reason for rejecting the return", "REASON_REQUIRED");
  if (to === "REFUNDED") throw badRequest("Refunds complete automatically once the money has been sent", "INVALID_STATUS");

  const from = ret.status;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const entry = { status: to, note: note || "", actor: "admin", at: new Date() };
      const updated = await ReturnRequest.findOneAndUpdate(
        { _id: ret._id, status: from },
        { $set: { status: to, ...(note && { adminNote: note }), ...(to === "RETURNED" && { restocked: Boolean(restock) }) }, $push: { timeline: entry } },
        { returnDocument: "after", session }
      );
      if (!updated) throw concurrent();
      const order = await Order.findOneAndUpdate(
        { _id: ret.order, status: from },
        { $set: { status: to }, $push: { timeline: entry } },
        { returnDocument: "after", session }
      );
      if (!order) throw new ApiError(409, "Order and return are out of sync", "OUT_OF_SYNC");

      // Goods are back: optionally put them on the shelf again.
      if (to === "RETURNED" && restock) {
        const logs = [];
        for (const it of ret.items) {
          const filter = it.variantId ? { _id: it.product, "variants._id": it.variantId } : { _id: it.product };
          const update = it.variantId ? { $inc: { "variants.$.stock": it.quantity } } : { $inc: { stock: it.quantity } };
          const before = await Product.findOneAndUpdate(filter, update, { returnDocument: "before", session });
          if (!before) continue;
          const previousStock = it.variantId ? before.variants.id(it.variantId).stock : before.stock;
          logs.push({ product: it.product, variantId: it.variantId, sku: it.sku, previousStock, quantityChanged: it.quantity, newStock: previousStock + it.quantity, reason: "RETURN_RESTOCKED", order: ret.order, performedBy: null });
        }
        if (logs.length) await InventoryLog.insertMany(logs, { session });
      }
    });
  } finally {
    await session.endSession();
  }

  const updatedReturn = await ReturnRequest.findById(ret._id);
  const order = await Order.findById(ret.order);
  const buyer = await User.findById(order.user).select("email");
  if (to === "RETURN_APPROVED" || to === "RETURN_REJECTED") sendReturnDecisionEmail(updatedReturn, order, buyer.email);

  if (to === "REFUND_INITIATED") {
    sendRefundInitiatedEmail(updatedReturn, order, buyer.email);
    await initiateReturnRefund(ret._id);
  }
  return ReturnRequest.findById(ret._id);
};

// Starts (or retries) the money going back. Safe to call repeatedly:
//  - the Razorpay/manual split is decided once,
//  - an atomic claim stops two clicks from refunding twice.
export const initiateReturnRefund = async (returnId) => {
  let ret = await ReturnRequest.findById(returnId);
  if (!ret) throw notFound("Return not found");
  if (ret.status !== "REFUND_INITIATED") throw new ApiError(409, "This return is not in the refund stage", "NOT_REFUND_STAGE");
  const order = await Order.findById(ret.order);

  if (!ret.refund.planned) {
    const payment = order.paymentMethod === "COD"
      ? order.cod?.tokenPaymentId && (await Payment.findById(order.cod.tokenPaymentId))
      : await Payment.findOne({ order: order._id, purpose: "ORDER", status: { $in: ["PAID", "REFUND_INITIATED"] } });
    const refundable = payment ? payment.amount - refundedSoFar(payment) : 0;
    // COD: the online token is refunded first; anything beyond it was paid in
    // cash to the courier and has to be paid back by the store.
    const split = splitRefund(ret.refundAmount, refundable);
    ret = await ReturnRequest.findOneAndUpdate(
      { _id: ret._id, "refund.planned": false },
      { $set: { "refund.planned": true, "refund.razorpayAmount": split.razorpayAmount, "refund.manualAmount": split.manualAmount, "refund.payment": payment?._id || null } },
      { returnDocument: "after" }
    ) || (await ReturnRequest.findById(returnId));
  }

  if (ret.refund.razorpayAmount > 0 && !ret.refund.razorpayInitiated) {
    const claimed = await ReturnRequest.findOneAndUpdate(
      { _id: ret._id, "refund.razorpayInitiated": false, "refund.razorpayClaimed": { $ne: true } },
      { $set: { "refund.razorpayClaimed": true } },
      { returnDocument: "after" }
    );
    if (claimed) {
      const payment = await Payment.findById(ret.refund.payment);
      const orderDoc = await Order.findById(ret.order);
      const result = await issueRefund({ payment, order: orderDoc, amountRupees: ret.refund.razorpayAmount, reason: `Return for ${order.orderNumber}` });
      await payment.save();
      await orderDoc.save();
      await ReturnRequest.updateOne(
        { _id: ret._id },
        result.ok
          ? { $set: { "refund.razorpayInitiated": true, "refund.razorpayRefundId": result.refundId, "refund.error": null } }
          : { $set: { "refund.razorpayClaimed": false, "refund.error": result.error || "Razorpay refund failed" } }
      );
    }
  }
  return finalizeReturnIfDone(ret._id);
};

// REFUND_INITIATED -> REFUNDED once every part of the refund has actually completed.
export const finalizeReturnIfDone = async (returnId) => {
  const ret = await ReturnRequest.findById(returnId);
  if (!ret || ret.status !== "REFUND_INITIATED" || !ret.refund.planned) return ret;
  const razorDone = ret.refund.razorpayAmount === 0 || ret.refund.razorpayProcessed;
  const manualDone = ret.refund.manualAmount === 0 || ret.refund.manualPaid;
  if (!razorDone || !manualDone) return ret;

  const session = await mongoose.startSession();
  let finalizedHere = false;
  try {
    await session.withTransaction(async () => {
      finalizedHere = false;
      const entry = { status: "REFUNDED", note: "Refund completed", actor: "system", at: new Date() };
      const updated = await ReturnRequest.findOneAndUpdate({ _id: ret._id, status: "REFUND_INITIATED" }, { $set: { status: "REFUNDED" }, $push: { timeline: entry } }, { session });
      if (!updated) return; // someone else finalized it first
      finalizedHere = true;
      const order = await Order.findById(ret.order).session(session);
      await Order.updateOne(
        { _id: ret.order, status: "REFUND_INITIATED" },
        { $set: { status: "REFUNDED", ...(ret.refundAmount >= order.totalAmount && { paymentStatus: "REFUNDED" }) }, $push: { timeline: entry } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
  const finalReturn = await ReturnRequest.findById(returnId);
  if (finalizedHere && finalReturn?.status === "REFUNDED") {
    const order = await Order.findById(finalReturn.order);
    const buyer = await User.findById(order.user).select("email");
    sendRefundCompletedEmail(finalReturn, order, buyer.email);
  }
  return finalReturn;
};

// The store paid the non-Razorpay part (e.g. COD cash) by UPI / bank transfer.
export const markManualRefundPaid = async ({ returnId, reference }) => {
  const updated = await ReturnRequest.findOneAndUpdate(
    { _id: returnId, status: "REFUND_INITIATED", "refund.manualAmount": { $gt: 0 }, "refund.manualPaid": { $ne: true } },
    { $set: { "refund.manualPaid": true, "refund.manualReference": reference, "refund.manualPaidAt": new Date() } },
    { returnDocument: "after" }
  );
  if (!updated) throw new ApiError(409, "There is no manual refund waiting on this return", "NO_MANUAL_REFUND");
  return finalizeReturnIfDone(returnId);
};

// Called by the Razorpay webhook for refund.processed / refund.failed.
export const onRazorpayRefundEvent = async ({ refundId, status }) => {
  const ret = await ReturnRequest.findOne({ "refund.razorpayRefundId": refundId });
  if (!ret) return null; // not a return refund (e.g. a cancellation refund)
  if (status === "PROCESSED") {
    await ReturnRequest.updateOne({ _id: ret._id }, { $set: { "refund.razorpayProcessed": true } });
    return finalizeReturnIfDone(ret._id);
  }
  // Failed at Razorpay: reopen it so an admin can retry.
  await ReturnRequest.updateOne(
    { _id: ret._id },
    { $set: { "refund.razorpayInitiated": false, "refund.razorpayClaimed": false, "refund.razorpayRefundId": null, "refund.error": "Razorpay could not complete the refund" } }
  );
  return null;
};

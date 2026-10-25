import mongoose from "mongoose";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Product from "../models/Product.js";
import Coupon from "../models/Coupon.js";
import Cart from "../models/Cart.js";
import InventoryLog from "../models/InventoryLog.js";
import { issueRefund } from "./refundService.js";
import User from "../models/User.js";
import { sendPaymentSuccessEmail, sendCodPendingEmail } from "./email/emailService.js";

// Thrown inside the transaction when money was captured but the order cannot
// be fulfilled (stock sold out meanwhile, or order cancelled while paying).
class RefundRequiredError extends Error {}

const PAYABLE = ["PENDING_PAYMENT", "PAYMENT_FAILED"];

const runConfirmation = async ({ paymentId, razorpayPaymentId, signature, method, session }) => {
  // Atomic gate: only ONE caller (verify endpoint or webhook) can flip the
  // payment to PAID. Everyone else falls into the "already processed" branch.
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: "CREATED" },
    {
      $set: {
        status: "PAID",
        razorpayPaymentId,
        ...(signature && { razorpaySignature: signature }),
        method: method || null,
        paidAt: new Date(),
      },
    },
    { returnDocument: "after", session }
  );

  if (!payment) {
    const existing = await Payment.findById(paymentId).session(session);
    const order = await Order.findById(existing.order).session(session);
    return { order, payment: existing, alreadyProcessed: true };
  }

  const order = await Order.findById(payment.order).session(session);
  if (!PAYABLE.includes(order.status)) {
    throw new RefundRequiredError(`Order is ${order.status} and can no longer accept payment`);
  }
  const isCodToken = payment.purpose === "COD_TOKEN";

  // Re-check and decrement stock atomically. The filter includes the stock
  // condition, so two concurrent buyers can never both take the last unit.
  const logs = [];
  for (const item of order.items) {
    const filter = item.variantId
      ? { _id: item.product, variants: { $elemMatch: { _id: item.variantId, stock: { $gte: item.quantity } } } }
      : { _id: item.product, stock: { $gte: item.quantity } };
    const update = item.variantId
      ? { $inc: { "variants.$.stock": -item.quantity } }
      : { $inc: { stock: -item.quantity } };

    const before = await Product.findOneAndUpdate(filter, update, { returnDocument: "before", session });
    if (!before) throw new RefundRequiredError(`"${item.name}" sold out before payment completed`);

    const previousStock = item.variantId ? before.variants.id(item.variantId).stock : before.stock;
    logs.push({
      product: item.product,
      variantId: item.variantId,
      sku: item.sku,
      previousStock,
      quantityChanged: -item.quantity,
      newStock: previousStock - item.quantity,
      reason: "ORDER_CONFIRMED",
      order: order._id,
      performedBy: null,
    });
  }
  await InventoryLog.insertMany(logs, { session });

  if (order.couponCode) {
    await Coupon.updateOne({ code: order.couponCode }, { $inc: { usedCount: 1 } }, { session });
    const bumped = await Coupon.updateOne(
      { code: order.couponCode, "usedBy.user": order.user },
      { $inc: { "usedBy.$.count": 1 } },
      { session }
    );
    if (bumped.matchedCount === 0) {
      await Coupon.updateOne({ code: order.couponCode }, { $push: { usedBy: { user: order.user, count: 1 } } }, { session });
    }
  }

  if (isCodToken) {
    // COD: the token is paid, stock is held, and the order now waits for the
    // store to confirm it. The balance is collected by the courier.
    order.cod.tokenPaid = true;
    order.cod.tokenPaymentId = payment._id;
    order.cod.confirmationStatus = "PENDING";
    order.paymentStatus = "PARTIALLY_PAID";
    order.pushStatus("PENDING_COD_CONFIRMATION", "COD token received, awaiting store confirmation", "system");
  } else {
    order.paymentStatus = "PAID";
    order.pushStatus("CONFIRMED", "Payment received", "system");
  }
  await order.save({ session });

  await Cart.updateOne({ user: order.user }, { $set: { items: [] } }, { session });

  return { order, payment, alreadyProcessed: false };
};

// Money was captured but the order can't be honoured: record the payment as
// received, refund it in full, and cancel the order. Runs OUTSIDE the
// (aborted) transaction so the payment record is never lost.
const handleRefundRequired = async ({ paymentId, razorpayPaymentId, signature, method, reason }) => {
  await Payment.updateOne(
    { _id: paymentId, status: "CREATED" },
    {
      $set: {
        status: "PAID",
        razorpayPaymentId,
        ...(signature && { razorpaySignature: signature }),
        method: method || null,
        paidAt: new Date(),
      },
    }
  );

  const payment = await Payment.findById(paymentId);
  const order = await Order.findById(payment.order);

  await issueRefund({ payment, order, amountRupees: payment.amount, reason });
  await payment.save();

  if (PAYABLE.includes(order.status)) order.pushStatus("CANCELLED", reason, "system");
  await order.save();

  return { order, payment, refunded: true, reason };
};

export const confirmOnlinePayment = async ({ paymentId, razorpayPaymentId, signature, method }) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await runConfirmation({ paymentId, razorpayPaymentId, signature, method, session });
    });
    // Email only after the transaction has committed (the callback can be retried
    // on transient errors, and a rolled-back payment must never send a "paid" email).
    if (!result.alreadyProcessed) {
      const buyer = await User.findById(result.order.user).select("email");
      if (buyer) {
        if (result.payment.purpose === "COD_TOKEN") sendCodPendingEmail(result.order, buyer.email);
        else sendPaymentSuccessEmail(result.order, buyer.email);
      }
    }
    return result;
  } catch (err) {
    if (err instanceof RefundRequiredError) {
      return handleRefundRequired({ paymentId, razorpayPaymentId, signature, method, reason: err.message });
    }
    throw err;
  } finally {
    await session.endSession();
  }
};

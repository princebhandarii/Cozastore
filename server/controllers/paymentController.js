import { z } from "zod";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendSuccess } from "../utils/ApiResponse.js";
import { ApiError, badRequest, notFound } from "../utils/ApiError.js";
import {
  createRazorpayOrder,
  getPublicKeyId,
  verifyPaymentSignature,
  verifyWebhook,
} from "../services/payment/razorpayService.js";
import { confirmOnlinePayment } from "../services/orderConfirmationService.js";
import { onRazorpayRefundEvent } from "../services/returnService.js";

const isId = (v) => /^[0-9a-fA-F]{24}$/.test(v);
const PAYABLE = ["PENDING_PAYMENT", "PAYMENT_FAILED"];

const orderIdSchema = z.object({ orderId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid order id") });
const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

const parse = (schema, body) => {
  const r = schema.safeParse(body);
  if (!r.success) throw badRequest(r.error.issues[0].message, "VALIDATION_ERROR");
  return r.data;
};

const refundedResponse = (res, result) =>
  res.status(409).json({
    success: false,
    message:
      "An item sold out while you were paying, so this order was cancelled and your payment is being refunded.",
    code: "OUT_OF_STOCK_REFUNDED",
    data: { orderId: result.order._id, reason: result.reason },
  });

// POST /api/payments/create-order  { orderId }
// The amount comes from the stored Order (server-computed), never the client.
export const createPaymentOrder = asyncHandler(async (req, res) => {
  const { orderId } = parse(orderIdSchema, req.body);
  const order = await Order.findOne({ _id: orderId, user: req.user._id });
  if (!order) throw notFound("Order not found");
  if (!PAYABLE.includes(order.status)) {
    throw new ApiError(409, `This order can't be paid (status: ${order.status})`, "ORDER_NOT_PAYABLE");
  }

  // COD orders pay only the token online; everything else pays the full total.
  const isCod = order.paymentMethod === "COD";
  if (isCod && order.cod.otpRequired && !order.cod.otpVerified) {
    throw new ApiError(403, "Please verify your phone number first", "PHONE_NOT_VERIFIED");
  }
  const purpose = isCod ? "COD_TOKEN" : "ORDER";
  const chargeAmount = isCod ? order.cod.tokenAmount : order.totalAmount;

  const keyId = getPublicKeyId(); // throws a clear error if Razorpay isn't configured

  // Reuse the open Razorpay order so retries never create duplicate payments.
  let payment = await Payment.findOne({ order: order._id, purpose, status: "CREATED" });
  if (!payment) {
    const rzp = await createRazorpayOrder({
      amountRupees: chargeAmount,
      receipt: order.orderNumber,
      notes: { orderId: String(order._id), orderNumber: order.orderNumber, purpose },
    });
    payment = await Payment.create({
      order: order._id,
      user: req.user._id,
      purpose,
      razorpayOrderId: rzp.id,
      amount: chargeAmount,
    });
  }

  if (order.status === "PAYMENT_FAILED") {
    order.pushStatus("PENDING_PAYMENT", "Payment retry started", "customer");
    await order.save();
  }

  sendSuccess(res, {
    data: {
      keyId,
      razorpayOrderId: payment.razorpayOrderId,
      amount: Math.round(payment.amount * 100), // paise
      currency: payment.currency,
      orderId: order._id,
      orderNumber: order.orderNumber,
    },
  });
});

// POST /api/payments/verify
// The browser says "paid" - we only believe it after checking the HMAC
// signature with our secret. Idempotent: duplicate callbacks are harmless.
export const verifyPayment = asyncHandler(async (req, res) => {
  const body = parse(verifySchema, req.body);

  const payment = await Payment.findOne({ razorpayOrderId: body.razorpay_order_id, user: req.user._id });
  if (!payment) throw notFound("Payment not found");

  const valid = verifyPaymentSignature({
    orderId: body.razorpay_order_id,
    paymentId: body.razorpay_payment_id,
    signature: body.razorpay_signature,
  });
  if (!valid) throw badRequest("Payment verification failed", "INVALID_SIGNATURE");

  const result = await confirmOnlinePayment({
    paymentId: payment._id,
    razorpayPaymentId: body.razorpay_payment_id,
    signature: body.razorpay_signature,
  });

  if (result.refunded) return refundedResponse(res, result);
  sendSuccess(res, {
    message: result.alreadyProcessed ? "Payment already confirmed" : "Payment confirmed",
    data: result.order,
  });
});

// POST /api/payments/failed  { orderId, reason? }
// Called when Razorpay Checkout reports a failed attempt. The Razorpay order
// stays open, so the customer can retry.
export const reportPaymentFailed = asyncHandler(async (req, res) => {
  const { orderId } = parse(orderIdSchema, req.body);
  const order = await Order.findOne({ _id: orderId, user: req.user._id });
  if (!order) throw notFound("Order not found");

  if (order.status === "PENDING_PAYMENT") {
    order.paymentStatus = "FAILED";
    order.pushStatus("PAYMENT_FAILED", String(req.body.reason || "Payment failed").slice(0, 200), "system");
    await order.save();
    await Payment.updateOne(
      { order: order._id, status: "CREATED" },
      { $set: { failureReason: String(req.body.reason || "Payment failed").slice(0, 200) } }
    );
  }
  sendSuccess(res, { message: "Recorded", data: { status: order.status } });
});

// POST /api/payments/webhook  (public, raw body, signature-verified)
// Reliable server-to-server sync: confirms payments even if the customer
// closed the tab before the browser callback fired.
export const razorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const raw = req.body;
    if (!Buffer.isBuffer(raw) || !verifyWebhook({ rawBody: raw, signature })) {
      return res.status(400).json({ success: false, message: "Invalid signature", code: "INVALID_SIGNATURE" });
    }

    const event = JSON.parse(raw.toString("utf8"));
    const eventId = req.headers["x-razorpay-event-id"];

    // Refund events carry payload.refund.entity
    if (event.event === "refund.processed" || event.event === "refund.failed") {
      const refund = event.payload?.refund?.entity;
      if (refund) {
        const status = event.event === "refund.processed" ? "PROCESSED" : "FAILED";
        const payment = await Payment.findOneAndUpdate(
          { razorpayPaymentId: refund.payment_id, "refunds.refundId": refund.id },
          { $set: { "refunds.$.status": status, "refunds.$.completedAt": status === "PROCESSED" ? new Date() : null } },
          { returnDocument: "after" }
        );
        if (payment && status === "PROCESSED") {
          const refunded = payment.refunds.filter((r) => r.status === "PROCESSED").reduce((n, r) => n + r.amount, 0);
          if (refunded >= payment.amount) {
            payment.status = "REFUNDED";
            await payment.save();
            await Order.updateOne({ _id: payment.order }, { $set: { paymentStatus: "REFUNDED" } });
          }
        }
        // If this refund belongs to a return, advance that return too.
        await onRazorpayRefundEvent({ refundId: refund.id, status });
      }
      return res.json({ success: true });
    }

    const entity = event.payload?.payment?.entity;
    if (!entity?.order_id) return res.json({ success: true });

    const payment = await Payment.findOne({ razorpayOrderId: entity.order_id });
    if (!payment) return res.json({ success: true }); // not ours / already gone

    if (eventId) {
      if (payment.webhookEventIds.includes(eventId)) return res.json({ success: true, duplicate: true });
      await Payment.updateOne({ _id: payment._id }, { $addToSet: { webhookEventIds: eventId } });
    }

    if (event.event === "payment.captured" || event.event === "order.paid") {
      if (entity.amount !== Math.round(payment.amount * 100)) {
        // eslint-disable-next-line no-console
        console.error(`Webhook amount mismatch for ${entity.order_id}: got ${entity.amount}, expected ${payment.amount * 100}`);
        return res.json({ success: true });
      }
      await confirmOnlinePayment({ paymentId: payment._id, razorpayPaymentId: entity.id, method: entity.method });
    } else if (event.event === "payment.failed") {
      await Payment.updateOne({ _id: payment._id, status: "CREATED" }, { $set: { failureReason: entity.error_description || "Payment failed" } });
      const order = await Order.findById(payment.order);
      if (order && order.status === "PENDING_PAYMENT") {
        order.paymentStatus = "FAILED";
        order.pushStatus("PAYMENT_FAILED", entity.error_description || "Payment failed", "system");
        await order.save();
      }
    }

    return res.json({ success: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Razorpay webhook error:", err);
    return res.status(500).json({ success: false, message: "Webhook processing failed", code: "WEBHOOK_ERROR" }); // Razorpay retries on 5xx
  }
};

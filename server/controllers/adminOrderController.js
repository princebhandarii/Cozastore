import mongoose from "mongoose";
import { z } from "zod";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendSuccess } from "../utils/ApiResponse.js";
import { ApiError, badRequest, notFound } from "../utils/ApiError.js";
import { ORDER_STATUSES, assertTransition } from "../utils/orderStatus.js";
import { reverseOrderReservations } from "../services/reversalService.js";
import { issueRefund } from "../services/refundService.js";
import { logAdminAction } from "../utils/adminLog.js";
import User from "../models/User.js";
import { sendCodConfirmedEmail, sendCodRejectedEmail } from "../services/email/emailService.js";

const isId = (v) => /^[0-9a-fA-F]{24}$/.test(v);

// GET /api/admin/orders?status=&paymentMethod=&page=&limit=
// (Phase 8 extends this into the full order management table.)
export const adminListOrders = asyncHandler(async (req, res) => {
  const { status, paymentMethod } = req.query;
  const filter = {};
  if (status) {
    if (!ORDER_STATUSES.includes(status)) throw badRequest("Unknown status filter", "VALIDATION_ERROR");
    filter.status = status;
  }
  if (paymentMethod) {
    if (!["ONLINE", "COD"].includes(paymentMethod)) throw badRequest("Unknown payment method filter", "VALIDATION_ERROR");
    filter.paymentMethod = paymentMethod;
  }
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const [items, total] = await Promise.all([
    Order.find(filter).populate("user", "name email phone").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  sendSuccess(res, { data: items, meta: { page, pages: Math.ceil(total / limit), total } });
});

// GET /api/admin/orders/:id
export const adminGetOrder = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw notFound("Order not found");
  const order = await Order.findById(req.params.id).populate("user", "name email phone");
  if (!order) throw notFound("Order not found");
  const payments = await Payment.find({ order: order._id }).sort({ createdAt: 1 });
  sendSuccess(res, { data: { ...order.toObject(), payments } });
});

// PATCH /api/admin/cod/:id/confirm
export const confirmCodOrder = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw notFound("Order not found");
  assertTransition("PENDING_COD_CONFIRMATION", "CONFIRMED");
  const now = new Date();

  // Conditional update = atomic "compare and set": two admins clicking at once
  // (or a double click) can only succeed once.
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, paymentMethod: "COD", status: "PENDING_COD_CONFIRMATION", "cod.confirmationStatus": "PENDING", "cod.tokenPaid": true },
    {
      $set: { status: "CONFIRMED", confirmedAt: now, "cod.confirmationStatus": "CONFIRMED", "cod.confirmedBy": req.user._id, "cod.confirmedAt": now },
      $push: { timeline: { status: "CONFIRMED", note: "COD order confirmed by store", actor: "admin", at: now } },
    },
    { returnDocument: "after" }
  );
  if (!order) throw new ApiError(409, "This order is not waiting for COD confirmation", "NOT_PENDING_COD");

  await logAdminAction({ admin: req.user, action: "COD_CONFIRMED", targetType: "Order", targetId: order._id, details: { orderNumber: order.orderNumber } });
  const buyer = await User.findById(order.user).select("email");
  sendCodConfirmedEmail(order, buyer.email);
  sendSuccess(res, { message: "COD order confirmed", data: order });
});

const rejectSchema = z.object({
  reason: z.string().trim().min(3, "Please give a reason").max(300),
  refundToken: z.boolean().optional(), // default: refund
});

// PATCH /api/admin/cod/:id/reject  { reason, refundToken? }
export const rejectCodOrder = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw notFound("Order not found");
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0].message, "VALIDATION_ERROR");
  const { reason, refundToken = true } = parsed.data;
  assertTransition("PENDING_COD_CONFIRMATION", "CANCELLED");

  const session = await mongoose.startSession();
  let order;
  try {
    // Cancel + put stock back + release coupon succeed or fail together.
    await session.withTransaction(async () => {
      const now = new Date();
      order = await Order.findOneAndUpdate(
        { _id: req.params.id, paymentMethod: "COD", status: "PENDING_COD_CONFIRMATION", "cod.confirmationStatus": "PENDING" },
        {
          $set: { status: "CANCELLED", "cod.confirmationStatus": "REJECTED", "cod.rejectionReason": reason },
          $push: { timeline: { status: "CANCELLED", note: `COD rejected: ${reason}`, actor: "admin", at: now } },
        },
        { returnDocument: "after", session }
      );
      if (!order) throw new ApiError(409, "This order is not waiting for COD confirmation", "NOT_PENDING_COD");
      await reverseOrderReservations({ order, reason: "COD_REJECTED", performedBy: req.user._id, session });
    });
  } finally {
    await session.endSession();
  }

  // Refund the token (external call, so outside the DB transaction).
  let refund = { attempted: false };
  if (refundToken && order.cod.tokenPaymentId) {
    const payment = await Payment.findById(order.cod.tokenPaymentId);
    if (payment && payment.status === "PAID") {
      const orderDoc = await Order.findById(order._id);
      const result = await issueRefund({ payment, order: orderDoc, amountRupees: payment.amount, reason: `COD rejected: ${reason}` });
      await payment.save();
      await orderDoc.save();
      refund = { attempted: true, ok: result.ok, error: result.error };
    }
  }

  await logAdminAction({
    admin: req.user, action: "COD_REJECTED", targetType: "Order", targetId: order._id,
    details: { orderNumber: order.orderNumber, reason, refundToken, refund },
  });
  const rejectedOrder = await Order.findById(order._id);
  const buyer = await User.findById(order.user).select("email");
  sendCodRejectedEmail(rejectedOrder, buyer.email);
  sendSuccess(res, {
    message: refund.attempted && !refund.ok
      ? "Order rejected, but the token refund failed and needs a manual refund"
      : "COD order rejected",
    data: { order: rejectedOrder, refund },
  });
});

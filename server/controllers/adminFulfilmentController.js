import mongoose from "mongoose";
import { z } from "zod";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Product from "../models/Product.js";
import InventoryLog from "../models/InventoryLog.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendSuccess } from "../utils/ApiResponse.js";
import { ApiError, badRequest, notFound } from "../utils/ApiError.js";
import { adminUpdateStatus, cancelOrder } from "../services/orderLifecycleService.js";
import { issueRefund } from "../services/refundService.js";
import { getSettings } from "../services/settingsService.js";
import { supportsCourierIntegration, createShipment } from "../services/shipping/index.js";
import { getLowStockRows } from "../services/inventoryQueryService.js";
import { logAdminAction } from "../utils/adminLog.js";

const isId = (v) => /^[0-9a-fA-F]{24}$/.test(v);
const parse = (schema, body) => {
  const r = schema.safeParse(body);
  if (!r.success) throw badRequest(r.error.issues[0].message, "VALIDATION_ERROR");
  return r.data;
};
const orderId = (req) => {
  if (!isId(req.params.id)) throw notFound("Order not found");
  return req.params.id;
};

const statusSchema = z
  .object({
    status: z.enum(["PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"]),
    note: z.string().trim().max(200).optional(),
    // For SHIPPED: leave courier/trackingNumber blank to auto-create a real
    // shipment via the configured courier provider; fill them in to enter
    // tracking manually (the always-available development-only fallback).
    courier: z.string().trim().min(2).max(60).optional(),
    trackingNumber: z.string().trim().min(3).max(60).optional(),
    trackingUrl: z.string().url().optional().or(z.literal("")),
    estimatedDelivery: z.coerce.date().optional(),
    useCourierApi: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.status === "SHIPPED" && !v.useCourierApi) {
      if (!v.courier) ctx.addIssue({ code: "custom", path: ["courier"], message: "Courier name is required when shipping manually" });
      if (!v.trackingNumber) ctx.addIssue({ code: "custom", path: ["trackingNumber"], message: "Tracking number is required when shipping manually" });
    }
  });

// PATCH /api/admin/orders/:id/status
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const body = parse(statusSchema, req.body);
  let shipping = {
    courier: body.courier,
    trackingNumber: body.trackingNumber,
    trackingUrl: body.trackingUrl || null,
    estimatedDelivery: body.estimatedDelivery,
  };

  // Real courier path: create an actual Shiprocket shipment + AWB instead of
  // trusting admin-typed tracking info. Only runs when explicitly requested
  // and a courier provider is configured; otherwise falls through to manual.
  if (body.status === "SHIPPED" && body.useCourierApi) {
    if (!supportsCourierIntegration()) {
      throw badRequest("No courier integration is configured. Enter tracking details manually instead.", "COURIER_NOT_CONFIGURED");
    }
    const order = await Order.findById(orderId(req));
    if (!order) throw notFound("Order not found");
    const created = await createShipment(order);
    shipping = { ...shipping, ...created };
  }

  const order = await adminUpdateStatus({ orderId: orderId(req), to: body.status, note: body.note, shipping });
  await logAdminAction({ admin: req.user, action: "ORDER_STATUS_CHANGED", targetType: "Order", targetId: order._id, details: { to: body.status, orderNumber: order.orderNumber, courierApi: Boolean(body.useCourierApi) } });
  sendSuccess(res, { message: `Order marked ${body.status.toLowerCase().replaceAll("_", " ")}`, data: order });
});

// POST /api/admin/orders/:id/cancel  { reason, refund? }
export const adminCancelOrder = asyncHandler(async (req, res) => {
  const body = parse(z.object({ reason: z.string().trim().min(3).max(200), refund: z.boolean().optional() }), req.body);
  const order = await Order.findById(orderId(req));
  if (!order) throw notFound("Order not found");
  if (order.status === "PENDING_COD_CONFIRMATION") {
    throw new ApiError(409, "Use Reject for COD orders that are awaiting confirmation", "USE_COD_ACTIONS");
  }
  if (!["PENDING_PAYMENT", "PAYMENT_FAILED", "CONFIRMED", "PROCESSING"].includes(order.status)) {
    throw new ApiError(409, `A ${order.status.toLowerCase().replaceAll("_", " ")} order can't be cancelled here`, "ORDER_NOT_CANCELLABLE");
  }

  // Store-initiated cancellation refunds by default (the customer isn't at fault).
  const wantsRefund = body.refund !== false;
  const refund = !wantsRefund ? "none" : order.paymentMethod === "COD" ? "token" : "full";
  const result = await cancelOrder({ order, actor: "admin", reason: body.reason, refund: ["PENDING_PAYMENT", "PAYMENT_FAILED"].includes(order.status) ? "none" : refund });

  await logAdminAction({ admin: req.user, action: "ORDER_CANCELLED", targetType: "Order", targetId: order._id, details: { reason: body.reason, refund: result.refund } });
  sendSuccess(res, { message: "Order cancelled", data: result });
});

// POST /api/admin/orders/:id/refund  { paymentId, amount, reason }
// Manual refund: resolves `needsManualRefund` flags and COD "review" decisions.
export const adminRefund = asyncHandler(async (req, res) => {
  const body = parse(z.object({
    paymentId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    amount: z.coerce.number().positive(),
    reason: z.string().trim().min(3).max(200),
  }), req.body);

  const order = await Order.findById(orderId(req));
  if (!order) throw notFound("Order not found");
  const payment = await Payment.findOne({ _id: body.paymentId, order: order._id });
  if (!payment || !["PAID", "REFUND_INITIATED"].includes(payment.status)) {
    throw new ApiError(409, "That payment has nothing to refund", "NOT_REFUNDABLE");
  }
  const alreadyRefunded = payment.refunds.filter((r) => r.status !== "FAILED").reduce((n, r) => n + r.amount, 0);
  if (body.amount > payment.amount - alreadyRefunded) {
    throw badRequest(`Only ₹${payment.amount - alreadyRefunded} is left to refund on this payment`, "REFUND_EXCEEDS_PAYMENT");
  }

  const result = await issueRefund({ payment, order, amountRupees: body.amount, reason: body.reason });
  if (result.ok) order.needsRefundDecision = false;
  await payment.save();
  await order.save();

  await logAdminAction({ admin: req.user, action: "REFUND_ISSUED", targetType: "Order", targetId: order._id, details: { ...body, ok: result.ok, error: result.error } });
  if (!result.ok) throw new ApiError(502, `Razorpay refused the refund: ${result.error}`, "REFUND_FAILED");
  sendSuccess(res, { message: "Refund initiated", data: { refundId: result.refundId } });
});

// POST /api/admin/orders/:id/keep-token  - close a COD "refund decision" without refunding.
export const keepCodToken = asyncHandler(async (req, res) => {
  const order = await Order.findOneAndUpdate(
    { _id: orderId(req), needsRefundDecision: true },
    { $set: { needsRefundDecision: false }, $push: { timeline: { status: "CANCELLED", note: "Store kept the COD token", actor: "admin", at: new Date() } } },
    { returnDocument: "after" }
  );
  if (!order) throw new ApiError(409, "No pending refund decision on this order", "NO_PENDING_DECISION");
  await logAdminAction({ admin: req.user, action: "COD_TOKEN_KEPT", targetType: "Order", targetId: order._id });
  sendSuccess(res, { message: "Token kept", data: order });
});

// PATCH /api/admin/settings/orders  { cancelWhenConfirmed?, cancelWhenProcessing? }
export const updateOrderRules = asyncHandler(async (req, res) => {
  const body = parse(z.object({ cancelWhenConfirmed: z.boolean().optional(), cancelWhenProcessing: z.boolean().optional() }), req.body);
  const settings = await getSettings();
  for (const [k, v] of Object.entries(body)) settings.set(`orders.${k}`, v);
  await settings.save();
  await logAdminAction({ admin: req.user, action: "ORDER_RULES_UPDATED", targetType: "SiteSettings", targetId: settings._id, details: body });
  sendSuccess(res, { message: "Order rules saved", data: settings });
});

// ---------- Inventory ----------

// GET /api/admin/inventory?threshold=5  - low-stock products/variants
export const lowStock = asyncHandler(async (req, res) => {
  const threshold = Math.max(0, Number(req.query.threshold ?? 5));
  const rows = await getLowStockRows(threshold);
  sendSuccess(res, { data: rows, meta: { threshold, total: rows.length } });
});

// GET /api/admin/inventory/logs?product=&order=&page=
export const inventoryLogs = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.product) { if (!isId(req.query.product)) throw badRequest("Invalid product id"); filter.product = req.query.product; }
  if (req.query.order) { if (!isId(req.query.order)) throw badRequest("Invalid order id"); filter.order = req.query.order; }
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const [items, total] = await Promise.all([
    InventoryLog.find(filter).populate("product", "name slug").populate("performedBy", "name email").sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit),
    InventoryLog.countDocuments(filter),
  ]);
  sendSuccess(res, { data: items, meta: { page, pages: Math.ceil(total / limit), total } });
});

// POST /api/admin/inventory/adjust  { productId, variantId?, delta, reason }
// Atomic and never lets stock go negative; always leaves a log row.
export const adjustInventory = asyncHandler(async (req, res) => {
  const body = parse(z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    variantId: z.string().regex(/^[0-9a-fA-F]{24}$/).nullish(),
    delta: z.coerce.number().int().refine((n) => n !== 0, "Change must not be zero").refine((n) => Math.abs(n) <= 100000, "Change is too large"),
    reason: z.string().trim().min(3).max(200),
  }), req.body);

  const session = await mongoose.startSession();
  let log;
  try {
    await session.withTransaction(async () => {
      const minStock = body.delta < 0 ? -body.delta : 0;
      const filter = body.variantId
        ? { _id: body.productId, variants: { $elemMatch: { _id: body.variantId, stock: { $gte: minStock } } } }
        : { _id: body.productId, stock: { $gte: minStock } };
      const update = body.variantId ? { $inc: { "variants.$.stock": body.delta } } : { $inc: { stock: body.delta } };
      const before = await Product.findOneAndUpdate(filter, update, { returnDocument: "before", session });
      if (!before) {
        const exists = await Product.exists({ _id: body.productId });
        throw exists ? new ApiError(409, "Stock can't go below zero", "INSUFFICIENT_STOCK") : notFound("Product or variant not found");
      }
      const variant = body.variantId ? before.variants.id(body.variantId) : null;
      const previousStock = variant ? variant.stock : before.stock;
      [log] = await InventoryLog.create([{
        product: before._id, variantId: body.variantId || null, sku: variant ? variant.sku : before.sku,
        previousStock, quantityChanged: body.delta, newStock: previousStock + body.delta,
        reason: `ADMIN_ADJUSTMENT: ${body.reason}`, performedBy: req.user._id,
      }], { session });
    });
  } finally {
    await session.endSession();
  }
  sendSuccess(res, { message: "Stock updated", data: log });
});

// PATCH /api/admin/settings/shipping  { freeThreshold?, flatCharge? }  (null = use the .env default)
export const updateShippingSettings = asyncHandler(async (req, res) => {
  const body = parse(z.object({
    freeThreshold: z.coerce.number().min(0).max(1000000).nullable().optional(),
    flatCharge: z.coerce.number().min(0).max(100000).nullable().optional(),
  }), req.body);
  const settings = await getSettings();
  for (const [k, v] of Object.entries(body)) settings.set(`shipping.${k}`, v);
  await settings.save();
  await logAdminAction({ admin: req.user, action: "SHIPPING_SETTINGS_UPDATED", targetType: "SiteSettings", targetId: settings._id, details: body });
  sendSuccess(res, { message: "Shipping settings saved", data: settings });
});

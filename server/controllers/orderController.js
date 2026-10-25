import crypto from "crypto";
import { z } from "zod";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendSuccess } from "../utils/ApiResponse.js";
import { ApiError, badRequest, notFound } from "../utils/ApiError.js";
import { prepareCheckout } from "../services/checkoutService.js";
import { getSettings } from "../services/settingsService.js";
import { evaluateCodEligibility } from "../utils/codToken.js";
import { sendCodOtp, verifyCodOtp } from "../services/otp/index.js";
import { getCancellationRule, DEFAULT_ORDER_RULES } from "../utils/cancellation.js";
import { cancelOrder } from "../services/orderLifecycleService.js";
import ReturnRequest from "../models/ReturnRequest.js";
import { getReturnEligibility } from "../utils/returnRefund.js";
import { isInvoiceAvailable } from "../utils/invoice.js";
import { ensureInvoice, buildInvoiceModel } from "../services/invoice/invoiceService.js";
import { renderInvoicePdf } from "../services/invoice/invoicePdf.js";

const createSchema = z.object({
  addressId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Select a delivery address"),
  couponCode: z.string().max(30).optional().nullable(),
  paymentMethod: z.enum(["ONLINE", "COD"]),
});

const makeOrderNumber = () => {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `CZ-${ymd}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
};

// POST /api/orders
// Creates the order in PENDING_PAYMENT. Nothing is trusted from the client
// except the address id, coupon code and payment method.
export const createOrder = asyncHandler(async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0].message, "VALIDATION_ERROR");
  const { addressId, couponCode, paymentMethod } = parsed.data;

  const c = await prepareCheckout({ user: req.user, addressId, couponCode });

  // COD rules are re-evaluated here from the stored settings; the client's
  // idea of whether COD is allowed (or what the token is) is irrelevant.
  let cod;
  if (paymentMethod === "COD") {
    const settings = await getSettings();
    const eligibility = evaluateCodEligibility(settings.cod, c.totalAmount);
    if (!eligibility.available) throw badRequest(eligibility.reason, "COD_NOT_AVAILABLE");
    cod = {
      tokenAmount: eligibility.tokenAmount,
      remainingAmount: eligibility.remainingAmount,
      otpRequired: settings.cod.otpRequired,
      cancellationPolicy: settings.cod.cancellationPolicy,
    };
  }
  const a = c.address;

  const order = await Order.create({
    orderNumber: makeOrderNumber(),
    user: req.user._id,
    items: c.lines.map((l) => ({
      product: l.productId,
      variantId: l.variantId || null,
      name: l.name,
      slug: l.slug,
      sku: l.sku,
      image: l.image,
      size: l.size,
      color: l.color,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    })),
    shippingAddress: {
      fullName: a.fullName,
      phone: a.phone,
      addressLine1: a.addressLine1,
      addressLine2: a.addressLine2,
      landmark: a.landmark,
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      addressType: a.addressType,
    },
    subtotal: c.subtotal,
    discount: c.discount,
    couponCode: c.couponCode,
    shippingCharge: c.shippingCharge,
    totalAmount: c.totalAmount,
    paymentMethod,
    cod,
    timeline: [
      {
        status: "PENDING_PAYMENT",
        note: cod ? "COD order placed, awaiting token payment" : "Order placed, awaiting payment",
        actor: "customer",
      },
    ],
  });

  sendSuccess(res, { statusCode: 201, message: "Order created", data: order });
});

// GET /api/orders
export const listMyOrders = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const filter = { user: req.user._id };
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  sendSuccess(res, { data: items, meta: { page, pages: Math.ceil(total / limit), total } });
});

// GET /api/orders/:id
export const getMyOrder = asyncHandler(async (req, res) => {
  if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) throw notFound("Order not found");
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) throw notFound("Order not found");

  const payment = await Payment.findOne({ order: order._id }).sort({ createdAt: -1 });
  const settings = await getSettings();
  const rule = getCancellationRule(order, { ...DEFAULT_ORDER_RULES, ...settings.toObject().orders });
  const existingReturn = await ReturnRequest.findOne({ order: order._id }).select("_id status");
  const returnRule = getReturnEligibility(order, settings.toObject().returns, Boolean(existingReturn));
  sendSuccess(res, {
    data: {
      ...order.toObject(),
      // The UI only renders a button when the server says the action is allowed.
      actions: {
        canPay: ["PENDING_PAYMENT", "PAYMENT_FAILED"].includes(order.status),
        canCancel: rule.allowed,
        cancelRefund: rule.allowed ? rule.refund : null,
        cancelBlockedReason: rule.allowed ? null : rule.reason,
        canTrack: ["CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status),
        canReturn: returnRule.allowed,
        returnDeadline: returnRule.allowed ? returnRule.deadline : null,
        returnBlockedReason: returnRule.allowed || existingReturn ? null : returnRule.reason,
        canDownloadInvoice: isInvoiceAvailable(order),
        canReview: Boolean(order.shipping?.deliveredAt),
      },
      returnRequest: existingReturn ? { _id: existingReturn._id, status: existingReturn.status } : null,
      payment: payment && {
        status: payment.status,
        method: payment.method,
        paidAt: payment.paidAt,
        refunds: payment.refunds,
      },
    },
  });
});

const loadOwnOrder = async (req) => {
  if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) throw notFound("Order not found");
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) throw notFound("Order not found");
  return order;
};

// POST /api/orders/:id/cod/otp/send
export const sendOtp = asyncHandler(async (req, res) => {
  const order = await loadOwnOrder(req);
  const result = await sendCodOtp(order);
  sendSuccess(res, { message: "Verification code sent", data: result });
});

// POST /api/orders/:id/cod/otp/verify  { code }
export const verifyOtp = asyncHandler(async (req, res) => {
  const parsed = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") }).safeParse(req.body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0].message, "VALIDATION_ERROR");
  const order = await loadOwnOrder(req);
  const updated = await verifyCodOtp(order, parsed.data.code);
  sendSuccess(res, { message: "Phone verified", data: { otpVerified: updated.cod.otpVerified } });
});

// POST /api/orders/:id/cancel  { reason? }
export const cancelMyOrder = asyncHandler(async (req, res) => {
  const parsed = z.object({ reason: z.string().trim().max(200).optional() }).safeParse(req.body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0].message, "VALIDATION_ERROR");
  const order = await loadOwnOrder(req);

  const settings = await getSettings();
  const rule = getCancellationRule(order, { ...DEFAULT_ORDER_RULES, ...settings.toObject().orders });
  if (!rule.allowed) throw new ApiError(409, rule.reason, "ORDER_NOT_CANCELLABLE");

  const result = await cancelOrder({ order, actor: "customer", reason: parsed.data.reason, refund: rule.refund });
  const failed = result.refund.attempted && !result.refund.ok;
  sendSuccess(res, {
    message: failed
      ? "Order cancelled. Your refund could not be started automatically - the store has been flagged to process it."
      : "Order cancelled",
    data: result,
  });
});

// GET /api/orders/:id/invoice  -> PDF
export const downloadInvoice = asyncHandler(async (req, res) => {
  const order = await loadOwnOrder(req);
  if (!isInvoiceAvailable(order)) throw new ApiError(409, "An invoice is available once your order is confirmed", "INVOICE_NOT_AVAILABLE");
  const invoice = await ensureInvoice(order);
  const fresh = await Order.findById(order._id);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="invoice-${invoice.number.replaceAll("/", "-")}.pdf"`);
  renderInvoicePdf(buildInvoiceModel(fresh, invoice), res);
});

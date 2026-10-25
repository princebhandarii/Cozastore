import { z } from "zod";
import ReturnRequest, { RETURN_STATUSES } from "../models/ReturnRequest.js";
import Order from "../models/Order.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendSuccess } from "../utils/ApiResponse.js";
import { badRequest, notFound } from "../utils/ApiError.js";
import { adminUpdateReturn, initiateReturnRefund, markManualRefundPaid } from "../services/returnService.js";
import { getSettings } from "../services/settingsService.js";
import { logAdminAction } from "../utils/adminLog.js";
import { isInvoiceAvailable } from "../utils/invoice.js";
import { ensureInvoice, buildInvoiceModel } from "../services/invoice/invoiceService.js";
import { renderInvoicePdf } from "../services/invoice/invoicePdf.js";

const isId = (v) => /^[0-9a-fA-F]{24}$/.test(v);
const parse = (schema, body) => {
  const r = schema.safeParse(body);
  if (!r.success) throw badRequest(r.error.issues[0].message, "VALIDATION_ERROR");
  return r.data;
};
const rid = (req) => { if (!isId(req.params.id)) throw notFound("Return not found"); return req.params.id; };

// GET /api/admin/returns?status=&page=
export const adminListReturns = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) {
    if (!RETURN_STATUSES.includes(req.query.status)) throw badRequest("Unknown status filter");
    filter.status = req.query.status;
  }
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const [items, total] = await Promise.all([
    ReturnRequest.find(filter).populate("user", "name email phone").populate("order", "orderNumber paymentMethod totalAmount").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    ReturnRequest.countDocuments(filter),
  ]);
  sendSuccess(res, { data: items, meta: { page, pages: Math.ceil(total / limit), total } });
});

// GET /api/admin/returns/:id
export const adminGetReturn = asyncHandler(async (req, res) => {
  const ret = await ReturnRequest.findById(rid(req)).populate("user", "name email phone").populate("order", "orderNumber paymentMethod paymentStatus totalAmount shippingAddress");
  if (!ret) throw notFound("Return not found");
  sendSuccess(res, { data: ret });
});

// PATCH /api/admin/returns/:id  { status, note?, restock? }
// approve / reject / picked up / received back / start refund.
export const adminUpdateReturnStatus = asyncHandler(async (req, res) => {
  const body = parse(z.object({
    status: z.enum(["RETURN_APPROVED", "RETURN_REJECTED", "RETURN_PICKED_UP", "RETURNED", "REFUND_INITIATED"]),
    note: z.string().trim().max(300).optional(),
    restock: z.boolean().optional(),
  }), req.body);
  const ret = await adminUpdateReturn({ returnId: rid(req), to: body.status, note: body.note, restock: body.restock });
  await logAdminAction({ admin: req.user, action: "RETURN_STATUS_CHANGED", targetType: "ReturnRequest", targetId: ret._id, details: { to: body.status, note: body.note, restock: body.restock } });
  sendSuccess(res, { message: "Return updated", data: ret });
});

// POST /api/admin/returns/:id/retry-refund
export const retryReturnRefund = asyncHandler(async (req, res) => {
  const ret = await initiateReturnRefund(rid(req));
  await logAdminAction({ admin: req.user, action: "RETURN_REFUND_RETRIED", targetType: "ReturnRequest", targetId: ret._id });
  sendSuccess(res, { message: ret.refund.error ? `Refund still failing: ${ret.refund.error}` : "Refund processing", data: ret });
});

// POST /api/admin/returns/:id/manual-refund  { reference }
export const manualReturnRefund = asyncHandler(async (req, res) => {
  const { reference } = parse(z.object({ reference: z.string().trim().min(3, "Enter the UPI / bank transfer reference").max(100) }), req.body);
  const ret = await markManualRefundPaid({ returnId: rid(req), reference });
  await logAdminAction({ admin: req.user, action: "RETURN_MANUAL_REFUND_PAID", targetType: "ReturnRequest", targetId: ret._id, details: { reference, amount: ret.refund.manualAmount } });
  sendSuccess(res, { message: "Manual refund recorded", data: ret });
});

// PATCH /api/admin/settings/returns  { enabled?, windowDays? }
export const updateReturnRules = asyncHandler(async (req, res) => {
  const body = parse(z.object({ enabled: z.boolean().optional(), windowDays: z.coerce.number().int().min(1).max(60).optional() }), req.body);
  const settings = await getSettings();
  for (const [k, v] of Object.entries(body)) settings.set(`returns.${k}`, v);
  await settings.save();
  await logAdminAction({ admin: req.user, action: "RETURN_RULES_UPDATED", targetType: "SiteSettings", targetId: settings._id, details: body });
  sendSuccess(res, { message: "Return rules saved", data: settings });
});

// GET /api/admin/orders/:id/invoice
export const adminDownloadInvoice = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw notFound("Order not found");
  const order = await Order.findById(req.params.id);
  if (!order) throw notFound("Order not found");
  if (!isInvoiceAvailable(order)) throw badRequest("No invoice for this order yet", "INVOICE_NOT_AVAILABLE");
  const invoice = await ensureInvoice(order);
  const fresh = await Order.findById(order._id);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="invoice-${invoice.number.replaceAll("/", "-")}.pdf"`);
  renderInvoicePdf(buildInvoiceModel(fresh, invoice), res);
});

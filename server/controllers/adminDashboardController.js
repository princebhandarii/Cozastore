import { z } from "zod";
import User from "../models/User.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendSuccess } from "../utils/ApiResponse.js";
import { ApiError, badRequest, notFound } from "../utils/ApiError.js";
import { getDashboardStats, getAnalytics } from "../services/analyticsService.js";
import { escapeRegex } from "../utils/dates.js";
import { logAdminAction } from "../utils/adminLog.js";

const isId = (v) => /^[0-9a-fA-F]{24}$/.test(v);
const paging = (req, max = 100, def = 20) => ({
  page: Math.max(1, Number(req.query.page) || 1),
  limit: Math.min(max, Math.max(1, Number(req.query.limit) || def)),
});

// GET /api/admin/dashboard
export const dashboard = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await getDashboardStats() });
});

// GET /api/admin/analytics?days=7|30|90
export const analytics = asyncHandler(async (req, res) => {
  const days = Number(req.query.days ?? 30);
  if (![7, 30, 90].includes(days)) throw badRequest("days must be 7, 30 or 90", "VALIDATION_ERROR");
  sendSuccess(res, { data: await getAnalytics(days) });
});

// GET /api/admin/users?q=&role=&page=
export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit } = paging(req);
  const filter = {};
  if (req.query.role) {
    if (!["customer", "admin"].includes(req.query.role)) throw badRequest("Unknown role filter");
    filter.role = req.query.role;
  }
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 60)), "i");
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).select("name email phone role isActive createdAt profileImage").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);

  const stats = await Order.aggregate([
    { $match: { user: { $in: users.map((u) => u._id) }, confirmedAt: { $ne: null }, status: { $ne: "CANCELLED" } } },
    { $group: { _id: "$user", orders: { $sum: 1 }, spent: { $sum: "$totalAmount" } } },
  ]);
  const byUser = new Map(stats.map((s) => [String(s._id), s]));
  sendSuccess(res, {
    data: users.map((u) => ({ ...u.toObject(), orderCount: byUser.get(String(u._id))?.orders || 0, totalSpent: byUser.get(String(u._id))?.spent || 0 })),
    meta: { page, pages: Math.ceil(total / limit), total },
  });
});

// PATCH /api/admin/users/:id/status  { isActive }
// Deactivated users are refused by requireAuth. Admin accounts can't be
// deactivated here (and roles can't be changed through the API at all).
export const setUserStatus = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw notFound("User not found");
  const parsed = z.object({ isActive: z.boolean() }).safeParse(req.body);
  if (!parsed.success) throw badRequest("isActive must be true or false", "VALIDATION_ERROR");
  const user = await User.findById(req.params.id);
  if (!user) throw notFound("User not found");
  if (user.role === "admin") throw new ApiError(403, "Admin accounts can't be deactivated from the dashboard", "FORBIDDEN");
  user.isActive = parsed.data.isActive;
  await user.save();
  await logAdminAction({ admin: req.user, action: user.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED", targetType: "User", targetId: user._id, details: { email: user.email } });
  sendSuccess(res, { message: user.isActive ? "User activated" : "User deactivated", data: { _id: user._id, isActive: user.isActive } });
});

// GET /api/admin/payments?status=&purpose=&needsManualRefund=true&page=
export const listPayments = asyncHandler(async (req, res) => {
  const { page, limit } = paging(req);
  const filter = {};
  if (req.query.status) {
    if (!["CREATED", "PAID", "FAILED", "REFUND_INITIATED", "REFUNDED"].includes(req.query.status)) throw badRequest("Unknown status filter");
    filter.status = req.query.status;
  }
  if (req.query.purpose) {
    if (!["ORDER", "COD_TOKEN"].includes(req.query.purpose)) throw badRequest("Unknown purpose filter");
    filter.purpose = req.query.purpose;
  }
  if (req.query.needsManualRefund === "true") filter.needsManualRefund = true;

  const [items, total] = await Promise.all([
    Payment.find(filter).select("-webhookEventIds -razorpaySignature").populate("order", "orderNumber paymentMethod status").populate("user", "name email").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Payment.countDocuments(filter),
  ]);
  sendSuccess(res, { data: items, meta: { page, pages: Math.ceil(total / limit), total } });
});

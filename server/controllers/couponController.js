import { z } from "zod";
import Coupon from "../models/Coupon.js";
import Cart from "../models/Cart.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendSuccess } from "../utils/ApiResponse.js";
import { badRequest, notFound } from "../utils/ApiError.js";
import { validateCoupon } from "../services/couponService.js";
import { buildCartView } from "./cartController.js";

// POST /api/coupons/validate  { code }
// The subtotal is computed here from the user's server-side cart.
export const validateCouponForCart = asyncHandler(async (req, res) => {
  const cart = (await Cart.findOne({ user: req.user._id })) || new Cart({ user: req.user._id, items: [] });
  const { subtotal } = await buildCartView(cart);
  const { coupon, discount } = await validateCoupon({ code: req.body.code, subtotal, userId: req.user._id });

  sendSuccess(res, {
    message: "Coupon applied",
    data: { code: coupon.code, description: coupon.description, discount, subtotal, total: subtotal - discount },
  });
});

const couponSchema = z.object({
  code: z.string().min(3).max(30),
  description: z.string().max(200).optional(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.coerce.number().positive(),
  minimumOrderValue: z.coerce.number().min(0).optional(),
  maximumDiscount: z.coerce.number().min(0).nullish(),
  startDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date(),
  usageLimit: z.coerce.number().int().min(0).nullish(),
  perUserLimit: z.coerce.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

const parse = (schema, body) => {
  const r = schema.safeParse(body);
  if (!r.success) throw badRequest(r.error.issues[0].message, "VALIDATION_ERROR");
  const data = r.data;
  if (data.discountType === "percentage" && data.discountValue > 100) {
    throw badRequest("Percentage discount cannot exceed 100", "VALIDATION_ERROR");
  }
  return data;
};

// Admin CRUD
export const listCoupons = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await Coupon.find({}).sort({ createdAt: -1 }) });
});

export const createCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.create(parse(couponSchema, req.body));
  sendSuccess(res, { statusCode: 201, message: "Coupon created", data: coupon });
});

export const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw notFound("Coupon not found");
  coupon.set(parse(couponSchema.partial().extend({ discountType: z.enum(["percentage", "fixed"]).default(coupon.discountType) }), req.body));
  await coupon.save();
  sendSuccess(res, { message: "Coupon updated", data: coupon });
});

export const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw notFound("Coupon not found");
  await coupon.deleteOne();
  sendSuccess(res, { message: "Coupon deleted" });
});

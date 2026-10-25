import Coupon from "../models/Coupon.js";
import { ApiError } from "../utils/ApiError.js";

const fail = (message, code) => new ApiError(400, message, code);

// Validates a coupon against a SERVER-computed subtotal and returns the
// discount. The frontend never sends an amount - only the code.
export const validateCoupon = async ({ code, subtotal, userId }) => {
  if (!code) throw fail("Coupon code is required", "COUPON_REQUIRED");

  const coupon = await Coupon.findOne({ code: String(code).trim().toUpperCase() });
  if (!coupon || !coupon.isActive) throw fail("Invalid coupon code", "COUPON_INVALID");

  const now = new Date();
  if (coupon.startDate && now < coupon.startDate) throw fail("This coupon is not active yet", "COUPON_NOT_STARTED");
  if (now > coupon.expiryDate) throw fail("This coupon has expired", "COUPON_EXPIRED");

  if (subtotal < coupon.minimumOrderValue) {
    throw fail(`Minimum order of ₹${coupon.minimumOrderValue} required for this coupon`, "COUPON_MIN_ORDER");
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw fail("This coupon has reached its usage limit", "COUPON_LIMIT_REACHED");
  }
  const used = coupon.usedBy.find((u) => String(u.user) === String(userId))?.count || 0;
  if (used >= coupon.perUserLimit) {
    throw fail("You have already used this coupon", "COUPON_USER_LIMIT");
  }

  let discount =
    coupon.discountType === "percentage"
      ? Math.round((subtotal * coupon.discountValue) / 100)
      : coupon.discountValue;
  if (coupon.maximumDiscount !== null) discount = Math.min(discount, coupon.maximumDiscount);
  discount = Math.min(discount, subtotal);

  return { coupon, discount };
};

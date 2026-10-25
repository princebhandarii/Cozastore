import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { validateCouponForCart, listCoupons, createCoupon, updateCoupon, deleteCoupon } from "../controllers/couponController.js";

const router = Router();

// Stricter limiter to slow down coupon-code guessing.
const validateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many coupon attempts, try again later.", code: "RATE_LIMITED" },
});

router.post("/validate", requireAuth, validateLimiter, validateCouponForCart);

router.get("/", requireAuth, requireAdmin, listCoupons);
router.post("/", requireAuth, requireAdmin, createCoupon);
router.patch("/:id", requireAuth, requireAdmin, updateCoupon);
router.delete("/:id", requireAuth, requireAdmin, deleteCoupon);
export default router;

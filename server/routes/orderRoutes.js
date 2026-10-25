import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.js";
import { createOrder, listMyOrders, getMyOrder, cancelMyOrder, downloadInvoice, sendOtp, verifyOtp } from "../controllers/orderController.js";

const router = Router();
router.use(requireAuth);

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many verification attempts, try again later.", code: "RATE_LIMITED" },
});

router.post("/", createOrder);
router.get("/", listMyOrders);
router.get("/:id", getMyOrder);
router.post("/:id/cancel", cancelMyOrder);
router.get("/:id/invoice", downloadInvoice);
router.post("/:id/cod/otp/send", otpLimiter, sendOtp);
router.post("/:id/cod/otp/verify", otpLimiter, verifyOtp);
export default router;

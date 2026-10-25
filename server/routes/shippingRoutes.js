import { Router } from "express";
import rateLimit from "express-rate-limit";
import { checkPincode } from "../controllers/shippingController.js";
import { shiprocketWebhook } from "../controllers/shippingWebhookController.js";

const router = Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many PIN code checks, try again later.", code: "RATE_LIMITED" },
});
router.post("/check", limiter, checkPincode);
router.post("/webhook", shiprocketWebhook); // raw-body not required: Shiprocket posts JSON with a shared-secret header, not an HMAC signature
export default router;

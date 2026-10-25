import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createPaymentOrder, verifyPayment, reportPaymentFailed } from "../controllers/paymentController.js";

const router = Router();
// NOTE: POST /api/payments/webhook is registered in server.js (needs the raw body).
router.post("/create-order", requireAuth, createPaymentOrder);
router.post("/verify", requireAuth, verifyPayment);
router.post("/failed", requireAuth, reportPaymentFailed);
export default router;

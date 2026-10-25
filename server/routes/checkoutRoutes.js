import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { checkoutSummary } from "../controllers/checkoutController.js";

const router = Router();
router.post("/summary", requireAuth, checkoutSummary);
export default router;

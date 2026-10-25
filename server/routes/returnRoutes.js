import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { uploadImages } from "../middleware/upload.js";
import { previewReturn, createReturn, listMyReturns, getMyReturn } from "../controllers/returnController.js";

const router = Router();
router.use(requireAuth);
router.post("/preview", previewReturn);
router.post("/", uploadImages.array("images", 4), createReturn);
router.get("/", listMyReturns);
router.get("/:id", getMyReturn);
export default router;

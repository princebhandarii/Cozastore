import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { uploadImages } from "../middleware/upload.js";
import { createReview, canReview, deleteMyReview } from "../controllers/reviewController.js";

const router = Router();
router.get("/can-review/:productId", requireAuth, canReview);
router.post("/", requireAuth, uploadImages.array("images", 3), createReview);
router.delete("/:id", requireAuth, deleteMyReview);
export default router;

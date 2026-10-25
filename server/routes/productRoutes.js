import { Router } from "express";
import { requireAuth, requireAdmin, optionalAuth } from "../middleware/auth.js";
import { listProductReviews } from "../controllers/reviewController.js";
import { uploadImages } from "../middleware/upload.js";
import {
  listProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  adminListProducts,
  adminGetProduct,
} from "../controllers/productController.js";

const router = Router();

router.get("/", listProducts);
router.get("/admin/all", requireAuth, requireAdmin, adminListProducts);
router.get("/admin/:id", requireAuth, requireAdmin, adminGetProduct);
router.get("/:id/reviews", optionalAuth, listProductReviews);
router.get("/:slug", getProductBySlug);

router.post("/", requireAuth, requireAdmin, uploadImages.array("images", 6), createProduct);
router.patch("/:id", requireAuth, requireAdmin, uploadImages.array("images", 6), updateProduct);
router.delete("/:id", requireAuth, requireAdmin, deleteProduct);

export default router;

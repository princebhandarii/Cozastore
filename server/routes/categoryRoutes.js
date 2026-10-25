import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { uploadImages } from "../middleware/upload.js";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  adminListCategories,
} from "../controllers/categoryController.js";

const router = Router();

router.get("/", listCategories);
router.get("/admin/all", requireAuth, requireAdmin, adminListCategories);

router.post("/", requireAuth, requireAdmin, uploadImages.single("image"), createCategory);
router.patch("/:id", requireAuth, requireAdmin, uploadImages.single("image"), updateCategory);
router.delete("/:id", requireAuth, requireAdmin, deleteCategory);

export default router;

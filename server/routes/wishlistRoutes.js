import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getWishlist, addToWishlist, removeFromWishlist } from "../controllers/wishlistController.js";

const router = Router();
router.use(requireAuth);
router.get("/", getWishlist);
router.post("/:productId", addToWishlist);
router.delete("/:productId", removeFromWishlist);
export default router;

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getCart, addToCart, updateCartItem, removeCartItem, clearCart } from "../controllers/cartController.js";

const router = Router();
router.use(requireAuth);
router.get("/", getCart);
router.post("/", addToCart);
router.delete("/", clearCart);
router.patch("/:itemId", updateCartItem);
router.delete("/:itemId", removeCartItem);
export default router;

import { Router } from "express";
import userRoutes from "./userRoutes.js";
import productRoutes from "./productRoutes.js";
import categoryRoutes from "./categoryRoutes.js";
import cartRoutes from "./cartRoutes.js";
import wishlistRoutes from "./wishlistRoutes.js";
import couponRoutes from "./couponRoutes.js";
import shippingRoutes from "./shippingRoutes.js";
import checkoutRoutes from "./checkoutRoutes.js";
import orderRoutes from "./orderRoutes.js";
import paymentRoutes from "./paymentRoutes.js";
import adminRoutes from "./adminRoutes.js";
import returnRoutes from "./returnRoutes.js";
import reviewRoutes from "./reviewRoutes.js";

const router = Router();

router.get("/health", (req, res) => res.json({ success: true, message: "OK" }));

router.use("/users", userRoutes);
router.use("/products", productRoutes);
router.use("/categories", categoryRoutes);
router.use("/cart", cartRoutes);
router.use("/wishlist", wishlistRoutes);
router.use("/coupons", couponRoutes);
router.use("/shipping", shippingRoutes);
router.use("/checkout", checkoutRoutes);
router.use("/orders", orderRoutes);
router.use("/payments", paymentRoutes);
router.use("/returns", returnRoutes);
router.use("/reviews", reviewRoutes);
router.use("/admin", adminRoutes);


export default router;

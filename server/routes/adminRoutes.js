import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { getAdminSettings, updateCodSettings } from "../controllers/adminSettingsController.js";
import {
  updateShippingSettings, updateOrderStatus, adminCancelOrder, adminRefund, keepCodToken, updateOrderRules, lowStock, inventoryLogs, adjustInventory,
} from "../controllers/adminFulfilmentController.js";
import {
  adminListReturns, adminGetReturn, adminUpdateReturnStatus, retryReturnRefund, manualReturnRefund, updateReturnRules, adminDownloadInvoice,
} from "../controllers/adminReturnController.js";
import { adminListReviews, adminSetReviewStatus, adminDeleteReview } from "../controllers/reviewController.js";
import { dashboard, analytics, listUsers, setUserStatus, listPayments } from "../controllers/adminDashboardController.js";
import { adminListOrders, adminGetOrder, confirmCodOrder, rejectCodOrder } from "../controllers/adminOrderController.js";

const router = Router();

// Every admin route: verified Firebase session AND role=admin from MongoDB.
router.use(requireAuth, requireAdmin);

router.get("/settings", getAdminSettings);
router.patch("/settings/cod", updateCodSettings);
router.patch("/settings/orders", updateOrderRules);
router.patch("/settings/shipping", updateShippingSettings);

router.get("/dashboard", dashboard);
router.get("/analytics", analytics);
router.get("/users", listUsers);
router.patch("/users/:id/status", setUserStatus);
router.get("/payments", listPayments);
router.patch("/settings/returns", updateReturnRules);

router.get("/orders", adminListOrders);
router.get("/orders/:id", adminGetOrder);
router.get("/orders/:id/invoice", adminDownloadInvoice);
router.patch("/orders/:id/status", updateOrderStatus);
router.post("/orders/:id/cancel", adminCancelOrder);
router.post("/orders/:id/refund", adminRefund);
router.post("/orders/:id/keep-token", keepCodToken);

router.get("/inventory", lowStock);
router.get("/inventory/logs", inventoryLogs);
router.post("/inventory/adjust", adjustInventory);

router.get("/returns", adminListReturns);
router.get("/returns/:id", adminGetReturn);
router.patch("/returns/:id", adminUpdateReturnStatus);
router.post("/returns/:id/retry-refund", retryReturnRefund);
router.post("/returns/:id/manual-refund", manualReturnRefund);

router.get("/reviews", adminListReviews);
router.patch("/reviews/:id", adminSetReviewStatus);
router.delete("/reviews/:id", adminDeleteReview);

router.patch("/cod/:id/confirm", confirmCodOrder);
router.patch("/cod/:id/reject", rejectCodOrder);

// Phase 8 adds: dashboard, users, analytics, products/categories screens...
export default router;

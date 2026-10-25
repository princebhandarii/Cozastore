import crypto from "crypto";
import Order from "../models/Order.js";
import { env } from "../config/env.js";
import { adminUpdateStatus } from "../services/orderLifecycleService.js";

// Maps Shiprocket's current_status strings to our own order status machine.
// Only forward-moving, known statuses are applied; anything else is ignored
// (logged) rather than guessed at.
const STATUS_MAP = {
  "OUT FOR DELIVERY": "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
};

const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a || ""), "utf8");
  const bufB = Buffer.from(String(b || ""), "utf8");
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

// POST /api/shipping/webhook  (Shiprocket courier status updates)
// Configure this URL in Shiprocket's webhook settings, with the same secret
// token as SHIPROCKET_WEBHOOK_TOKEN - Shiprocket sends it back in a header
// verified below, so a stranger can't push fake delivery updates.
export const shiprocketWebhook = async (req, res) => {
  try {
    if (!env.shiprocket.webhookToken) {
      return res.status(503).json({ success: false, message: "Webhook not configured", code: "WEBHOOK_NOT_CONFIGURED" });
    }
    const token = req.headers["x-api-key"] || req.headers["x-webhook-token"];
    if (!safeEqual(token, env.shiprocket.webhookToken)) {
      return res.status(401).json({ success: false, message: "Invalid webhook token", code: "INVALID_TOKEN" });
    }

    const body = req.body || {};
    const shipmentId = String(body.shipment_id || body.sr_shipment_id || "");
    const currentStatus = String(body.current_status || body.status || "").toUpperCase().trim();
    const mapped = STATUS_MAP[currentStatus];
    if (!shipmentId || !mapped) return res.json({ success: true, ignored: true });

    const order = await Order.findOne({ "shipping.shipmentId": shipmentId });
    if (!order) return res.json({ success: true, ignored: true }); // not one of ours

    // Only ever moves forward (SHIPPED -> OUT_FOR_DELIVERY -> DELIVERED); an
    // out-of-order or duplicate webhook that doesn't match a valid next step
    // is silently ignored rather than erroring Shiprocket's retry logic.
    if (order.status === "SHIPPED" && mapped === "OUT_FOR_DELIVERY") {
      await adminUpdateStatus({ orderId: order._id, to: "OUT_FOR_DELIVERY", note: "Courier status update", shipping: {} });
    } else if (order.status === "OUT_FOR_DELIVERY" && mapped === "DELIVERED") {
      await adminUpdateStatus({ orderId: order._id, to: "DELIVERED", note: "Courier status update", shipping: {} });
    }
    res.json({ success: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Shiprocket webhook error:", err);
    res.status(500).json({ success: false, message: "Webhook processing failed", code: "WEBHOOK_ERROR" });
  }
};

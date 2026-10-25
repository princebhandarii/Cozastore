import mongoose from "mongoose";
import { ORDER_STATUSES, assertTransition } from "../utils/orderStatus.js";

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    name: String,
    slug: String,
    sku: String,
    image: String,
    size: String,
    color: String,
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const addressSnapshot = new mongoose.Schema(
  {
    fullName: String,
    phone: String,
    addressLine1: String,
    addressLine2: String,
    landmark: String,
    city: String,
    state: String,
    pincode: String,
    addressType: String,
  },
  { _id: false }
);

const timelineSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    note: { type: String, default: "" },
    actor: { type: String, enum: ["system", "customer", "admin"], default: "system" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Cash-on-delivery bookkeeping. The token is paid online via Razorpay; the
// remainder is collected by the courier at delivery.
const codSchema = new mongoose.Schema(
  {
    tokenAmount: { type: Number, required: true, min: 1 },
    tokenPaid: { type: Boolean, default: false },
    tokenPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null },
    remainingAmount: { type: Number, required: true, min: 0 },
    remainingPaymentMethod: { type: String, default: "COD" },
    remainingPaid: { type: Boolean, default: false },
    // Settings are snapshotted at order time so later admin changes don't
    // alter the rules an existing order was placed under.
    otpRequired: { type: Boolean, default: false },
    otpVerified: { type: Boolean, default: false },
    cancellationPolicy: { type: String, enum: ["refundable", "non_refundable", "configurable"], default: "refundable" },
    confirmationStatus: {
      type: String,
      enum: ["AWAITING_TOKEN", "PENDING", "CONFIRMED", "REJECTED"],
      default: "AWAITING_TOKEN",
    },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    confirmedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
  },
  { _id: false }
);

// Shipment details. Until a courier integration is connected (Phase 9) these
// are entered by an admin - they are NOT synced from a courier.
const shippingSchema = new mongoose.Schema(
  {
    provider: { type: String, default: "manual" }, // "manual" or a real provider name (e.g. "shiprocket")
    shipmentId: { type: String, default: null, index: true },
    courier: { type: String, trim: true, default: null },
    trackingNumber: { type: String, trim: true, default: null },
    trackingUrl: { type: String, trim: true, default: null },
    estimatedDelivery: { type: Date, default: null },
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    shippingAddress: { type: addressSnapshot, required: true },

    // All money values are whole rupees, computed by the server.
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, default: null },
    shippingCharge: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },

    paymentMethod: { type: String, enum: ["ONLINE", "COD"], required: true },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PARTIALLY_PAID", "PAID", "FAILED", "REFUND_INITIATED", "REFUNDED"],
      default: "PENDING",
    },
    status: { type: String, enum: ORDER_STATUSES, default: "PENDING_PAYMENT", index: true },
    cod: { type: codSchema, default: undefined },
    shipping: { type: shippingSchema, default: undefined },
    // Set when a COD order with a "configurable" token policy is cancelled:
    // an admin decides whether the token is refunded or kept.
    invoice: {
      type: new mongoose.Schema({ number: String, issuedAt: Date }, { _id: false }),
      default: undefined,
    },
    // When the order first became CONFIRMED (payment received / COD accepted). Used by
    // dashboard & analytics so they don't have to dig through the timeline array.
    confirmedAt: { type: Date, default: null, index: true },
    needsRefundDecision: { type: Boolean, default: false },
    timeline: [timelineSchema],
  },
  { timestamps: true }
);

// The only sanctioned way to change status: validates the transition and
// writes a timeline entry, so history can never be skipped.
orderSchema.methods.pushStatus = function pushStatus(next, note = "", actor = "system") {
  assertTransition(this.status, next);
  this.status = next;
  const at = new Date();
  if (next === "CONFIRMED" && !this.confirmedAt) this.confirmedAt = at;
  this.timeline.push({ status: next, note, actor, at });
};

export default mongoose.model("Order", orderSchema);

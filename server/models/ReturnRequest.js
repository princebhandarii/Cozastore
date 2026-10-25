import mongoose from "mongoose";

export const RETURN_REASONS = ["DAMAGED", "DEFECTIVE", "WRONG_PRODUCT", "SIZE_ISSUE", "NOT_AS_EXPECTED", "OTHER"];
export const RETURN_STATUSES = ["RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_REJECTED", "RETURN_PICKED_UP", "RETURNED", "REFUND_INITIATED", "REFUNDED"];

const itemSchema = new mongoose.Schema(
  {
    orderItemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    name: String, sku: String, image: String, size: String, color: String,
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const timelineSchema = new mongoose.Schema(
  {
    status: { type: String, enum: RETURN_STATUSES, required: true },
    note: { type: String, default: "" },
    actor: { type: String, enum: ["system", "customer", "admin"], default: "system" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const returnSchema = new mongoose.Schema(
  {
    // One return request per order (unique): keeps the order-level status coherent.
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    reason: { type: String, enum: RETURN_REASONS, required: true },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    images: [{ url: String, publicId: String, _id: false }],

    status: { type: String, enum: RETURN_STATUSES, default: "RETURN_REQUESTED", index: true },
    adminNote: { type: String, default: "" },
    restocked: { type: Boolean, default: false },

    // Computed by the server when the request is made (utils/returnRefund.js).
    refundAmount: { type: Number, required: true, min: 0 },
    refundBreakdown: { itemsTotal: Number, discountShare: Number, shipping: Number },

    refund: {
      planned: { type: Boolean, default: false },
      razorpayAmount: { type: Number, default: 0 }, // sent back through Razorpay
      manualAmount: { type: Number, default: 0 }, // must be paid back by the store (e.g. COD cash)
      payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null },
      razorpayClaimed: { type: Boolean, default: false }, // guards against double refunds
      razorpayInitiated: { type: Boolean, default: false },
      razorpayRefundId: { type: String, index: true, sparse: true },
      razorpayProcessed: { type: Boolean, default: false },
      manualPaid: { type: Boolean, default: false },
      manualReference: { type: String, default: null },
      manualPaidAt: { type: Date, default: null },
      error: { type: String, default: null },
    },
    timeline: [timelineSchema],
  },
  { timestamps: true }
);

export default mongoose.model("ReturnRequest", returnSchema);

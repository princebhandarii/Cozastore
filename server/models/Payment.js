import mongoose from "mongoose";

const refundSchema = new mongoose.Schema(
  {
    refundId: { type: String, required: true },
    amount: { type: Number, required: true },
    reason: { type: String, default: "" },
    status: { type: String, default: "PENDING" }, // PENDING | PROCESSED | FAILED
    initiatedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    purpose: { type: String, enum: ["ORDER", "COD_TOKEN"], default: "ORDER" },
    provider: { type: String, default: "razorpay" },

    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    razorpaySignature: { type: String },

    amount: { type: Number, required: true }, // whole rupees
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["CREATED", "PAID", "FAILED", "REFUND_INITIATED", "REFUNDED"],
      default: "CREATED",
    },
    method: { type: String, default: null },
    failureReason: { type: String, default: null },
    paidAt: { type: Date, default: null },

    refunds: [refundSchema],
    needsManualRefund: { type: Boolean, default: false },
    refundError: { type: String, default: null },

    webhookEventIds: [String], // idempotency for webhook retries
  },
  { timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);

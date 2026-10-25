import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 30 },
    description: { type: String, trim: true, maxlength: 200, default: "" },
    discountType: { type: String, enum: ["percentage", "fixed"], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    minimumOrderValue: { type: Number, min: 0, default: 0 },
    maximumDiscount: { type: Number, min: 0, default: null }, // cap for percentage coupons
    startDate: { type: Date, default: () => new Date() },
    expiryDate: { type: Date, required: true },
    usageLimit: { type: Number, min: 0, default: null }, // null = unlimited
    usedCount: { type: Number, min: 0, default: 0 },
    perUserLimit: { type: Number, min: 1, default: 1 },
    // Per-user redemption counts. Incremented when an order is placed (Phase 4+).
    usedBy: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, count: { type: Number, default: 0 }, _id: false }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Coupon", couponSchema);

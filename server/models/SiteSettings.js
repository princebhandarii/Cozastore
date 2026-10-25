import mongoose from "mongoose";

// Single-document collection (key = "main"). Phase 8 adds store-wide settings
// (store name, return window, ...) next to `cod`.
const siteSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "main", unique: true },
    cod: {
      enabled: { type: Boolean, default: false },
      minOrderAmount: { type: Number, min: 0, default: 0 },
      maxOrderAmount: { type: Number, min: 0, default: 50000 },
      tokenType: { type: String, enum: ["fixed", "percentage"], default: "fixed" },
      tokenValue: { type: Number, min: 0, default: 100 }, // rupees, or percent
      otpRequired: { type: Boolean, default: false },
      cancellationPolicy: { type: String, enum: ["refundable", "non_refundable", "configurable"], default: "refundable" },
    },
    // null = fall back to FREE_SHIPPING_THRESHOLD / FLAT_SHIPPING_CHARGE from .env
    shipping: {
      freeThreshold: { type: Number, min: 0, default: null },
      flatCharge: { type: Number, min: 0, default: null },
    },
    returns: {
      enabled: { type: Boolean, default: true },
      windowDays: { type: Number, min: 1, max: 60, default: 7 },
    },
    orders: {
      cancelWhenConfirmed: { type: Boolean, default: true },
      cancelWhenProcessing: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

export default mongoose.model("SiteSettings", siteSettingsSchema);

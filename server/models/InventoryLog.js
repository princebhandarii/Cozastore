import mongoose from "mongoose";

const inventoryLogSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    sku: String,
    previousStock: { type: Number, required: true },
    quantityChanged: { type: Number, required: true }, // negative = stock removed
    newStock: { type: Number, required: true },
    reason: { type: String, required: true }, // e.g. ORDER_CONFIRMED, ADMIN_ADJUSTMENT, ORDER_CANCELLED
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // null = system
  },
  { timestamps: { createdAt: "timestamp", updatedAt: false } }
);

export default mongoose.model("InventoryLog", inventoryLogSchema);

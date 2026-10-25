import Product from "../models/Product.js";
import Coupon from "../models/Coupon.js";
import InventoryLog from "../models/InventoryLog.js";

// Undoes what order confirmation reserved: puts stock back (with inventory
// log rows) and releases the coupon redemption. Must run inside the caller's
// transaction so the order state change and the reversal succeed together.
export const reverseOrderReservations = async ({ order, reason, performedBy = null, session }) => {
  const logs = [];
  for (const item of order.items) {
    const filter = item.variantId
      ? { _id: item.product, "variants._id": item.variantId }
      : { _id: item.product };
    const update = item.variantId
      ? { $inc: { "variants.$.stock": item.quantity } }
      : { $inc: { stock: item.quantity } };

    const before = await Product.findOneAndUpdate(filter, update, { returnDocument: "before", session });
    if (!before) continue; // product/variant was deleted meanwhile - nothing to restore
    const previousStock = item.variantId ? before.variants.id(item.variantId).stock : before.stock;
    logs.push({
      product: item.product,
      variantId: item.variantId,
      sku: item.sku,
      previousStock,
      quantityChanged: item.quantity,
      newStock: previousStock + item.quantity,
      reason,
      order: order._id,
      performedBy,
    });
  }
  if (logs.length) await InventoryLog.insertMany(logs, { session });

  if (order.couponCode) {
    await Coupon.updateOne({ code: order.couponCode, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } }, { session });
    await Coupon.updateOne(
      { code: order.couponCode, "usedBy.user": order.user, "usedBy.count": { $gt: 0 } },
      { $inc: { "usedBy.$.count": -1 } },
      { session }
    );
  }
};

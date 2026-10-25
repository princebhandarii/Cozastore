import Product from "../models/Product.js";

// Products (or individual variants) at or below `threshold` units.
export const getLowStockRows = async (threshold = 5) => {
  const products = await Product.find({
    $or: [
      { "variants.0": { $exists: false }, stock: { $lte: threshold } },
      { variants: { $elemMatch: { stock: { $lte: threshold } } } },
    ],
  }).limit(200);

  const rows = [];
  for (const p of products) {
    if (p.variants.length === 0) {
      rows.push({ productId: p._id, name: p.name, sku: p.sku, variantId: null, label: null, stock: p.stock, isActive: p.isActive });
    } else {
      for (const v of p.variants) {
        if (v.stock <= threshold) rows.push({ productId: p._id, name: p.name, sku: v.sku, variantId: v._id, label: [v.size, v.color].filter(Boolean).join(" / "), stock: v.stock, isActive: p.isActive });
      }
    }
  }
  return rows.sort((a, b) => a.stock - b.stock);
};

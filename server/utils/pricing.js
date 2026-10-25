// Single source of truth for unit price. Used by cart now and by checkout /
// orders in later phases, so price logic can never drift between them.
export const getVariant = (product, variantId) =>
  variantId ? product.variants.id(variantId) : null;

export const getUnitPrice = (product, variant) => {
  const base = variant ? variant.price : product.price;
  return product.discount > 0 ? Math.round(base * (1 - product.discount / 100)) : base;
};

export const getAvailableStock = (product, variant) => (variant ? variant.stock : product.stock);

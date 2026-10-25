// Flat charge below the free-shipping threshold, free at/above it.
export const calculateShippingCharge = (amountAfterDiscount, { freeThreshold, flatCharge }) =>
  amountAfterDiscount >= freeThreshold ? 0 : flatCharge;

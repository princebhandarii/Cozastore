// COD token rules. Pure functions: the server is the only place these run.

export const calculateCodToken = ({ totalAmount, tokenType, tokenValue }) => {
  const raw = tokenType === "percentage" ? Math.round((totalAmount * tokenValue) / 100) : tokenValue;
  return Math.max(0, Math.round(raw));
};

// Decides whether COD may be offered for an order of `totalAmount`.
export const evaluateCodEligibility = (cod, totalAmount) => {
  if (!cod?.enabled) return { available: false, reason: "Cash on delivery is currently unavailable" };
  if (totalAmount < cod.minOrderAmount) {
    return { available: false, reason: `COD is available for orders of ₹${cod.minOrderAmount} or more` };
  }
  if (cod.maxOrderAmount > 0 && totalAmount > cod.maxOrderAmount) {
    return { available: false, reason: `COD is available for orders up to ₹${cod.maxOrderAmount}` };
  }
  const tokenAmount = calculateCodToken({ totalAmount, tokenType: cod.tokenType, tokenValue: cod.tokenValue });
  if (tokenAmount < 1) return { available: false, reason: "COD is not configured correctly" };
  if (tokenAmount >= totalAmount) {
    return { available: false, reason: "Order total is too low for COD - please pay online" };
  }
  return { available: true, tokenAmount, remainingAmount: totalAmount - tokenAmount };
};

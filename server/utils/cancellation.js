// Pure business rules for cancelling an order. `refund` describes what the
// customer gets back:
//   "none"   - nothing was paid (or the token is non-refundable)
//   "full"   - the whole online payment is refunded
//   "token"  - the COD token is refunded
//   "review" - COD token refund is left for an admin to decide
export const DEFAULT_ORDER_RULES = { cancelWhenConfirmed: true, cancelWhenProcessing: false };

const refundFor = (order) => {
  if (order.paymentMethod !== "COD") return "full";
  const policy = order.cod?.cancellationPolicy || "refundable";
  if (policy === "refundable") return "token";
  if (policy === "non_refundable") return "none";
  return "review";
};

export const getCancellationRule = (order, rules = DEFAULT_ORDER_RULES) => {
  switch (order.status) {
    case "PENDING_PAYMENT":
    case "PAYMENT_FAILED":
      return { allowed: true, refund: "none" };
    case "PENDING_COD_CONFIRMATION":
      return { allowed: true, refund: refundFor(order) };
    case "CONFIRMED":
      return rules.cancelWhenConfirmed
        ? { allowed: true, refund: refundFor(order) }
        : { allowed: false, reason: "This order can no longer be cancelled" };
    case "PROCESSING":
      return rules.cancelWhenProcessing
        ? { allowed: true, refund: refundFor(order) }
        : { allowed: false, reason: "This order is being prepared and can no longer be cancelled" };
    case "SHIPPED":
    case "OUT_FOR_DELIVERY":
      return { allowed: false, reason: "This order has already shipped and can't be cancelled" };
    case "DELIVERED":
      return { allowed: false, reason: "Delivered orders can be returned instead" };
    default:
      return { allowed: false, reason: "This order can't be cancelled" };
  }
};

// Statuses in which stock/coupon are currently reserved for the order.
export const HOLDS_RESERVATIONS = ["PENDING_COD_CONFIRMATION", "CONFIRMED", "PROCESSING"];

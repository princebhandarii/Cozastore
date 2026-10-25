// Pure return rules. Everything here runs on the server only.
export const STORE_FAULT_REASONS = ["DAMAGED", "DEFECTIVE", "WRONG_PRODUCT"];

// selections: [{ item: <order item>, quantity }]
export const computeReturnRefund = ({ order, selections, reason }) => {
  const itemsTotal = selections.reduce((n, s) => n + s.item.unitPrice * s.quantity, 0);
  // The order-level coupon discount is shared out in proportion to the returned value.
  const discountShare = order.subtotal > 0 ? Math.round((order.discount * itemsTotal) / order.subtotal) : 0;
  const allReturned = order.items.every((it) => {
    const sel = selections.find((s) => String(s.item._id) === String(it._id));
    return sel && sel.quantity === it.quantity;
  });
  // Shipping is refunded only when the whole order goes back because of our fault.
  const shipping = allReturned && STORE_FAULT_REASONS.includes(reason) ? order.shippingCharge : 0;
  const amount = Math.max(0, itemsTotal - discountShare + shipping);
  return { itemsTotal, discountShare, shipping, amount };
};

// How much of a refund can go back through Razorpay vs. must be paid by the store.
export const splitRefund = (total, razorpayRefundable) => {
  const razorpayAmount = Math.max(0, Math.min(total, razorpayRefundable));
  return { razorpayAmount, manualAmount: total - razorpayAmount };
};

export const getReturnEligibility = (order, rules, hasExistingReturn, now = new Date()) => {
  if (hasExistingReturn) return { allowed: false, reason: "A return has already been requested for this order" };
  if (!rules?.enabled) return { allowed: false, reason: "Returns are currently unavailable" };
  const deliveredAt = order.shipping?.deliveredAt;
  if (order.status !== "DELIVERED" || !deliveredAt) return { allowed: false, reason: "Only delivered orders can be returned" };
  const deadline = new Date(new Date(deliveredAt).getTime() + rules.windowDays * 24 * 60 * 60 * 1000);
  if (now > deadline) return { allowed: false, reason: `The ${rules.windowDays}-day return window has passed` };
  return { allowed: true, deadline };
};

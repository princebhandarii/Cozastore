const round2 = (n) => Math.round(n * 100) / 100;
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");

// Indian financial year runs April-March.
export const fiscalYear = (date = new Date()) => {
  const y = date.getFullYear();
  const start = date.getMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
};

export const formatInvoiceNumber = (fy, seq) => `INV/${fy}/${String(seq).padStart(6, "0")}`;

export const isInvoiceAvailable = (order) =>
  order.status !== "CANCELLED" && order.timeline.some((t) => t.status === "CONFIRMED");

// Tax-INCLUSIVE prices: splits the invoice total into taxable value + GST.
// Same state as the seller -> CGST + SGST; otherwise IGST.
export const computeGst = ({ totalAmount, ratePercent, sellerState, buyerState }) => {
  if (!ratePercent || ratePercent <= 0) return null;
  const taxable = round2(totalAmount / (1 + ratePercent / 100));
  const tax = round2(totalAmount - taxable);
  const intra = norm(sellerState) !== "" && norm(sellerState) === norm(buyerState);
  if (intra) {
    const cgst = round2(tax / 2);
    return { ratePercent, taxable, tax, cgst, sgst: round2(tax - cgst), igst: 0 };
  }
  return { ratePercent, taxable, tax, cgst: 0, sgst: 0, igst: tax };
};

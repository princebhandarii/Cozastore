import { env } from "../../config/env.js";
import Order from "../../models/Order.js";
import { nextSequence } from "../../models/Counter.js";
import { fiscalYear, formatInvoiceNumber, computeGst } from "../../utils/invoice.js";

// Invoice numbers are sequential per financial year and assigned once, the
// first time an invoice is generated. (If two requests race for the very first
// generation, the loser's sequence number is skipped - a gap, never a duplicate.)
export const ensureInvoice = async (order) => {
  if (order.invoice?.number) return order.invoice;
  const issuedAt = new Date();
  const number = formatInvoiceNumber(fiscalYear(issuedAt), await nextSequence(`invoice-${fiscalYear(issuedAt)}`));
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, "invoice.number": { $exists: false } },
    { $set: { invoice: { number, issuedAt } } },
    { returnDocument: "after" }
  );
  return (updated || (await Order.findById(order._id))).invoice;
};

export const buildInvoiceModel = (order, invoice) => ({
  store: env.store,
  invoice,
  orderNumber: order.orderNumber,
  orderDate: order.createdAt,
  customer: order.shippingAddress,
  items: order.items.map((i) => ({ name: i.name, sku: i.sku, options: [i.size, i.color].filter(Boolean).join(" / "), quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
  subtotal: order.subtotal,
  discount: order.discount,
  couponCode: order.couponCode,
  shippingCharge: order.shippingCharge,
  totalAmount: order.totalAmount,
  payment: {
    method: order.paymentMethod,
    status: order.paymentStatus,
    cod: order.cod && { tokenAmount: order.cod.tokenAmount, remainingAmount: order.cod.remainingAmount, remainingPaid: order.cod.remainingPaid },
  },
  gst: computeGst({ totalAmount: order.totalAmount, ratePercent: env.store.gstRatePercent, sellerState: env.store.state, buyerState: order.shippingAddress.state }),
});

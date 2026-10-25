import { refundRazorpayPayment } from "./payment/razorpayService.js";

// Issues a Razorpay refund and records it on the Payment/Order documents
// (the caller saves them). Never throws: if the refund API fails the payment
// is flagged `needsManualRefund` so an admin can refund from the dashboard.
export const issueRefund = async ({ payment, order, amountRupees, reason }) => {
  try {
    const refund = await refundRazorpayPayment({
      paymentId: payment.razorpayPaymentId,
      amountRupees,
      notes: { orderNumber: order.orderNumber, reason },
    });
    payment.refunds.push({ refundId: refund.id, amount: amountRupees, reason, status: "PENDING" });
    const total = payment.refunds.reduce((n, r) => n + r.amount, 0);
    if (total >= payment.amount) payment.status = "REFUND_INITIATED";
    payment.needsManualRefund = false;
    payment.refundError = null;
    order.paymentStatus = "REFUND_INITIATED";
    return { ok: true, refundId: refund.id };
  } catch (err) {
    payment.needsManualRefund = true;
    payment.refundError = err?.error?.description || err.message;
    return { ok: false, error: payment.refundError };
  }
};

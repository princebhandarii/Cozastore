import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { getOrderApi, cancelOrderApi } from "../../services/checkoutService";
import { payForOrder } from "../../utils/payForOrder";
import { formatPrice } from "../../utils/formatPrice";
import StatusBadge from "../../components/StatusBadge";
import CodOtpPanel from "../../components/CodOtpPanel";
import { downloadInvoice } from "../../utils/downloadInvoice";

export default function OrderDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const profile = useSelector((s) => s.auth.profile);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState("");
  const [invoiceBusy, setInvoiceBusy] = useState(false);

  const load = useCallback(() => getOrderApi(id).then(setOrder).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  const retryPayment = async () => {
    setPaying(true);
    setMessage("");
    try {
      const result = await payForOrder({ orderId: id, profile });
      if (result.status === "failed" || result.status === "refunded") setMessage(result.message);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setPaying(false);
      load();
    }
  };

  const cancelOrder = async () => {
    setCancelling(true);
    setNotice("");
    try {
      const res = await cancelOrderApi(id, cancelReason);
      setNotice(res.message);
      setCancelOpen(false);
      await load();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setCancelling(false);
    }
  };

  const getInvoice = async () => {
    setInvoiceBusy(true);
    setNotice("");
    try { await downloadInvoice(`/orders/${id}/invoice`); } catch { setNotice("Could not download the invoice. Please try again."); } finally { setInvoiceBusy(false); }
  };

  if (error) return <p className="py-24 text-center text-sm text-[var(--color-danger)]">{error}</p>;
  if (!order) return <div className="mx-auto max-w-3xl space-y-4 px-4 py-12">{[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-2xl skeleton" />)}</div>;

  const payable = ["PENDING_PAYMENT", "PAYMENT_FAILED"].includes(order.status);
  const a = order.shippingAddress;
  const cod = order.cod;
  const isCod = order.paymentMethod === "COD";
  const needsOtp = isCod && payable && cod?.otpRequired && !cod?.otpVerified;
  const payAmount = isCod ? cod.tokenAmount : order.totalAmount;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link to="/account/orders" className="text-xs text-[var(--muted)] underline">← All orders</Link>

      {params.get("placed") && order.status === "CONFIRMED" && (
        <div className="mt-4 rounded-xl bg-[var(--color-success)]/10 px-4 py-3 text-sm text-[var(--color-success)]">
          Payment received - your order is confirmed. Thank you!
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">{order.orderNumber}</h1>
        <StatusBadge status={order.status} />
      </div>
      <p className="text-xs text-[var(--muted)]">Placed {new Date(order.createdAt).toLocaleString("en-IN")}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {order.actions?.canTrack && (
          <Link to={`/account/orders/${id}/track`} className="rounded-full bg-ink-950 px-5 py-2 text-sm font-medium text-white dark:bg-white dark:text-ink-950">Track order</Link>
        )}
        {order.actions?.canCancel && (
          <button onClick={() => setCancelOpen((o) => !o)} className="rounded-full border border-[var(--border)] px-5 py-2 text-sm">Cancel order</button>
        )}
        {order.actions?.canReturn && (
          <Link to={`/account/returns/new?order=${id}`} className="rounded-full border border-[var(--border)] px-5 py-2 text-sm">Return items</Link>
        )}
        {order.actions?.canDownloadInvoice && (
          <button onClick={getInvoice} disabled={invoiceBusy} className="rounded-full border border-[var(--border)] px-5 py-2 text-sm disabled:opacity-50">{invoiceBusy ? "Preparing..." : "Download invoice"}</button>
        )}
        <Link to="/contact" className="rounded-full border border-[var(--border)] px-5 py-2 text-sm">Contact support</Link>
      </div>
      {order.actions?.canReturn && order.actions.returnDeadline && (
        <p className="mt-2 text-xs text-[var(--muted)]">Returns accepted until {new Date(order.actions.returnDeadline).toLocaleDateString("en-IN", { dateStyle: "medium" })}.</p>
      )}
      {order.returnRequest && (
        <p className="mt-2 text-sm">Return status: <Link to={`/account/returns/${order.returnRequest._id}`} className="underline">{order.returnRequest.status.replaceAll("_", " ").toLowerCase()}</Link></p>
      )}
      {!order.actions?.canCancel && order.actions?.cancelBlockedReason && !["CANCELLED", "REFUNDED"].includes(order.status) && (
        <p className="mt-2 text-xs text-[var(--muted)]">{order.actions.cancelBlockedReason}</p>
      )}
      {notice && <p className="mt-3 rounded-lg bg-[var(--border)] px-3 py-2 text-sm">{notice}</p>}

      {cancelOpen && (
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-sm">
          <p className="font-medium">Cancel this order?</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {{
              none: order.status === "PENDING_PAYMENT" || order.status === "PAYMENT_FAILED" ? "You haven't paid for this order, so nothing will be charged." : "Your COD token is non-refundable under the store policy.",
              full: "Your payment will be refunded to the original payment method.",
              token: "Your COD token will be refunded to the original payment method.",
              review: "The store will decide whether your COD token is refunded.",
            }[order.actions.cancelRefund]}
          </p>
          <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} maxLength={200} placeholder="Reason (optional)" className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm" rows={2} />
          <div className="mt-3 flex gap-2">
            <button onClick={cancelOrder} disabled={cancelling} className="rounded-full bg-[var(--color-danger)] px-5 py-2 text-xs font-medium text-white disabled:opacity-50">{cancelling ? "Cancelling..." : "Yes, cancel order"}</button>
            <button onClick={() => setCancelOpen(false)} className="rounded-full border border-[var(--border)] px-5 py-2 text-xs">Keep order</button>
          </div>
        </div>
      )}
      {order.status === "CANCELLED" && order.needsRefundDecision && (
        <p className="mt-4 rounded-xl bg-[var(--color-warning)]/10 px-4 py-3 text-sm text-[var(--color-warning)]">The store is reviewing whether your COD token will be refunded.</p>
      )}

      {payable && (
        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <p className="text-sm">{order.status === "PAYMENT_FAILED" ? "Your last payment attempt failed." : "This order is awaiting payment."}</p>
          {message && <p className="mt-2 text-xs text-[var(--color-danger)]">{message}</p>}
          {isCod && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Cash on delivery: pay the {formatPrice(cod.tokenAmount)} token now; {formatPrice(cod.remainingAmount)} is collected on delivery.
            </p>
          )}
          {needsOtp ? (
            <CodOtpPanel orderId={id} onVerified={load} />
          ) : (
            <button onClick={retryPayment} disabled={paying} className="mt-3 rounded-full bg-ink-950 px-6 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-ink-950">
              {paying ? "Opening payment..." : `Pay ${formatPrice(payAmount)}${isCod ? " token" : ""}`}
            </button>
          )}
        </div>
      )}

      {isCod && cod.confirmationStatus === "PENDING" && (
        <div className="mt-5 rounded-xl bg-[var(--color-warning)]/10 px-4 py-3 text-sm text-[var(--color-warning)]">
          Token received. Waiting for the store to confirm your COD order - you'll see the status change here.
        </div>
      )}
      {isCod && cod.confirmationStatus === "CONFIRMED" && (
        <div className="mt-5 rounded-xl bg-[var(--color-success)]/10 px-4 py-3 text-sm text-[var(--color-success)]">
          The store confirmed your COD order. Keep {formatPrice(cod.remainingAmount)} ready for delivery.
        </div>
      )}
      {isCod && cod.confirmationStatus === "REJECTED" && (
        <div className="mt-5 rounded-xl bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
          The store could not confirm this COD order{cod.rejectionReason ? `: ${cod.rejectionReason}` : "."} Any refund is shown below.
        </div>
      )}

      {order.payment?.refunds?.length > 0 && (
        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-sm">
          <p className="font-medium">Refund</p>
          {order.payment.refunds.map((r) => (
            <p key={r.refundId} className="mt-1 text-[var(--muted)]">{formatPrice(r.amount)} - {r.status.toLowerCase()} {r.reason && `(${r.reason})`}</p>
          ))}
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-sm font-medium">Items</h2>
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {order.items.map((i) => (
            <li key={i._id} className="flex items-center gap-3 py-3 text-sm">
              {i.image && <img src={i.image} alt="" className="h-14 w-12 rounded-lg object-cover" />}
              <div className="flex-1">
                <Link to={`/product/${i.slug}`} className="font-medium hover:underline">{i.name}</Link>
                {order.actions?.canReview && <Link to={`/product/${i.slug}#reviews`} className="ml-2 text-xs text-[var(--muted)] underline">Write a review</Link>}
                <p className="text-xs text-[var(--muted)]">{[i.size, i.color].filter(Boolean).join(" / ")} · Qty {i.quantity}</p>
              </div>
              <span>{formatPrice(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-[var(--border)] pt-3 text-sm">
          <div className="flex justify-between"><dt className="text-[var(--muted)]">Subtotal</dt><dd>{formatPrice(order.subtotal)}</dd></div>
          {order.discount > 0 && <div className="flex justify-between"><dt className="text-[var(--muted)]">Discount ({order.couponCode})</dt><dd>-{formatPrice(order.discount)}</dd></div>}
          <div className="flex justify-between"><dt className="text-[var(--muted)]">Shipping</dt><dd>{order.shippingCharge ? formatPrice(order.shippingCharge) : "Free"}</dd></div>
          <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{formatPrice(order.totalAmount)}</dd></div>
        </dl>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-sm">
          <h2 className="font-medium">Shipping address</h2>
          <p className="mt-2 text-[var(--muted)]">{a.fullName}<br />{a.addressLine1}{a.addressLine2 && `, ${a.addressLine2}`}<br />{a.city}, {a.state} - {a.pincode}<br />{a.phone}</p>
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-sm">
          <h2 className="font-medium">Payment</h2>
          <p className="mt-2 text-[var(--muted)]">
            {order.paymentMethod === "ONLINE" ? "Online (Razorpay)" : "Cash on delivery (token paid online)"}<br />
            Status: {order.paymentStatus.replaceAll("_", " ").toLowerCase()}
            {order.payment?.method && <><br />Method: {order.payment.method}</>}
            {isCod && (
              <>
                <br />Token: {formatPrice(cod.tokenAmount)} {cod.tokenPaid ? "(paid)" : "(unpaid)"}
                <br />Due on delivery: {formatPrice(cod.remainingAmount)} {cod.remainingPaid ? "(collected)" : ""}
              </>
            )}
          </p>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-sm font-medium">History</h2>
        <ol className="mt-3 space-y-2 text-sm">
          {[...order.timeline].reverse().map((t, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>{t.status.replaceAll("_", " ").toLowerCase()}{t.note && <span className="text-[var(--muted)]"> - {t.note}</span>}</span>
              <span className="shrink-0 text-xs text-[var(--muted)]">{new Date(t.at).toLocaleString("en-IN")}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

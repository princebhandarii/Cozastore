import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listAdminOrdersApi, adminGetOrderApi, updateOrderStatusApi, adminCancelOrderApi, adminRefundApi,
  keepTokenApi, getAdminSettingsApi, updateOrderRulesApi,
} from "../../services/adminService";
import { formatPrice } from "../../utils/formatPrice";
import StatusBadge from "../../components/StatusBadge";
import { downloadInvoice } from "../../utils/downloadInvoice";

const STATUS_FILTERS = ["PENDING_PAYMENT", "PAYMENT_FAILED", "PENDING_COD_CONFIRMATION", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];
const input = "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm";
const btn = "rounded-full bg-ink-950 px-5 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-ink-950";
const btnOutline = "rounded-full border border-[var(--border)] px-5 py-1.5 text-xs disabled:opacity-50";

function RulesPanel() {
  const [rules, setRules] = useState(null);
  useEffect(() => { getAdminSettingsApi().then((s) => setRules(s.orders)); }, []);
  if (!rules) return null;
  const toggle = async (key) => setRules(await updateOrderRulesApi({ [key]: !rules[key] }).then((s) => s.orders));
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
      <p className="font-medium">Customer cancellation rules</p>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
        <label className="flex items-center gap-2"><input type="checkbox" checked={rules.cancelWhenConfirmed} onChange={() => toggle("cancelWhenConfirmed")} /> Allow cancelling confirmed orders</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={rules.cancelWhenProcessing} onChange={() => toggle("cancelWhenProcessing")} /> Allow cancelling orders being processed</label>
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">Orders that have shipped can never be cancelled by customers.</p>
    </div>
  );
}

function OrderPanel({ id, onChanged }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ship, setShip] = useState({ courier: "", trackingNumber: "", trackingUrl: "", estimatedDelivery: "" });
  const [cancelReason, setCancelReason] = useState("");
  const [cancelRefund, setCancelRefund] = useState(true);

  const load = useCallback(() => adminGetOrderApi(id).then(setOrder).catch((e) => setError(e.message)), [id]);
  useEffect(() => { setOrder(null); setError(""); load(); }, [load]);

  const run = async (fn) => {
    setBusy(true); setError("");
    try { const r = await fn(); if (r?.message?.includes("failed")) setError(r.message); await load(); onChanged(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const setStatus = (status, extra = {}) => run(() => updateOrderStatusApi(id, { status, ...extra }));
  const [useCourierApi, setUseCourierApi] = useState(false);

  if (!order) return <div className="h-40 rounded-2xl skeleton" />;
  const a = order.shippingAddress;
  const st = order.status;
  const cancellable = ["PENDING_PAYMENT", "PAYMENT_FAILED", "CONFIRMED", "PROCESSING"].includes(st);
  const tokenPayment = order.payments?.find((p) => p.purpose === "COD_TOKEN" && p.status === "PAID");

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-medium">{order.orderNumber}</p>
        <StatusBadge status={st} />
      </div>
      {error && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">{error}</p>}

      <div className="text-[var(--muted)]">
        {order.user?.name || order.user?.email} · {a.fullName}, {a.addressLine1}, {a.city}, {a.state} - {a.pincode} · {a.phone}
      </div>
      <ul className="text-xs text-[var(--muted)]">
        {order.items.map((i) => <li key={i._id}>{i.name} {[i.size, i.color].filter(Boolean).join("/")} × {i.quantity} — {formatPrice(i.lineTotal)}</li>)}
      </ul>
      <p>
        Total {formatPrice(order.totalAmount)} · {order.paymentMethod} · payment {order.paymentStatus.toLowerCase().replaceAll("_", " ")}
        {order.cod && <> · token {formatPrice(order.cod.tokenAmount)}, <strong>due on delivery {formatPrice(order.cod.remainingAmount)}</strong>{order.cod.remainingPaid && " (collected)"}</>}
      </p>

      {order.payments?.some((p) => p.needsManualRefund) && (
        <div className="rounded-lg bg-[var(--color-warning)]/10 p-3 text-xs text-[var(--color-warning)]">
          A refund failed automatically and needs to be issued manually.
          {order.payments.filter((p) => p.needsManualRefund).map((p) => (
            <div key={p._id} className="mt-2 flex items-center gap-2">
              <span>{formatPrice(p.amount)} ({p.refundError})</span>
              <button disabled={busy} className={btn} onClick={() => run(() => adminRefundApi(id, { paymentId: p._id, amount: p.amount, reason: "Manual refund after automatic failure" }))}>Refund now</button>
            </div>
          ))}
        </div>
      )}

      {order.needsRefundDecision && tokenPayment && (
        <div className="rounded-lg bg-[var(--color-warning)]/10 p-3 text-xs text-[var(--color-warning)]">
          Customer cancelled a COD order. Refund the {formatPrice(tokenPayment.amount)} token?
          <div className="mt-2 flex gap-2">
            <button disabled={busy} className={btn} onClick={() => run(() => adminRefundApi(id, { paymentId: tokenPayment._id, amount: tokenPayment.amount, reason: "COD cancellation - token refunded" }))}>Refund token</button>
            <button disabled={busy} className={btnOutline} onClick={() => run(() => keepTokenApi(id))}>Keep token</button>
          </div>
        </div>
      )}

      {order.timeline.some((t) => t.status === "CONFIRMED") && st !== "CANCELLED" && (
        <button className={btnOutline} onClick={() => downloadInvoice(`/admin/orders/${id}/invoice`).catch((e) => setError(e.message))}>Download invoice (PDF)</button>
      )}

      <div className="space-y-3 border-t border-[var(--border)] pt-3">
        {st === "PENDING_COD_CONFIRMATION" && <p className="text-xs">Awaiting COD confirmation - <Link to="/admin/cod" className="underline">confirm or reject in COD</Link>.</p>}
        {st === "CONFIRMED" && <button disabled={busy} className={btn} onClick={() => setStatus("PROCESSING")}>Mark as processing</button>}
        {st === "PROCESSING" && (
          <div className="space-y-2">
            <div className="flex gap-1 rounded-full border border-[var(--border)] p-1 text-xs w-fit">
              <button type="button" onClick={() => setUseCourierApi(false)} className={`rounded-full px-3 py-1 ${!useCourierApi ? "bg-ink-950 text-white dark:bg-white dark:text-ink-950" : ""}`}>Enter manually</button>
              <button type="button" onClick={() => setUseCourierApi(true)} className={`rounded-full px-3 py-1 ${useCourierApi ? "bg-ink-950 text-white dark:bg-white dark:text-ink-950" : ""}`}>Book via courier API</button>
            </div>
            {useCourierApi ? (
              <div>
                <p className="text-xs text-[var(--muted)]">Creates a real shipment and AWB through the configured courier (Shiprocket). Requires SHIPROCKET_* to be set in server/.env.</p>
                <button disabled={busy} className={`${btn} mt-2`} onClick={() => setStatus("SHIPPED", { useCourierApi: true })}>Book shipment &amp; mark as shipped</button>
              </div>
            ) : (
              <div>
                <p className="text-xs font-medium">Enter tracking details yourself (no courier is contacted)</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input className={input} placeholder="Courier (e.g. Delhivery)" value={ship.courier} onChange={(e) => setShip({ ...ship, courier: e.target.value })} />
                  <input className={input} placeholder="Tracking number" value={ship.trackingNumber} onChange={(e) => setShip({ ...ship, trackingNumber: e.target.value })} />
                  <input className={input} placeholder="Tracking URL (optional)" value={ship.trackingUrl} onChange={(e) => setShip({ ...ship, trackingUrl: e.target.value })} />
                  <input className={input} type="date" value={ship.estimatedDelivery} onChange={(e) => setShip({ ...ship, estimatedDelivery: e.target.value })} />
                </div>
                <button disabled={busy || ship.courier.length < 2 || ship.trackingNumber.length < 3} className={`${btn} mt-2`}
                  onClick={() => setStatus("SHIPPED", { courier: ship.courier, trackingNumber: ship.trackingNumber, trackingUrl: ship.trackingUrl || undefined, estimatedDelivery: ship.estimatedDelivery || undefined })}>Mark as shipped</button>
              </div>
            )}
          </div>
        )}
        {st === "SHIPPED" && <button disabled={busy} className={btn} onClick={() => setStatus("OUT_FOR_DELIVERY")}>Mark out for delivery</button>}
        {st === "OUT_FOR_DELIVERY" && (
          <button disabled={busy} className={btn} onClick={() => setStatus("DELIVERED")}>
            Mark delivered{order.paymentMethod === "COD" ? ` (cash ${formatPrice(order.cod.remainingAmount)} collected)` : ""}
          </button>
        )}
        {cancellable && (
          <div className="space-y-2 border-t border-[var(--border)] pt-3">
            <input className={input} placeholder="Cancellation reason (shown to customer)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            {["CONFIRMED", "PROCESSING"].includes(st) && (
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={cancelRefund} onChange={(e) => setCancelRefund(e.target.checked)} /> Refund the customer{order.paymentMethod === "COD" ? " (token)" : ""}</label>
            )}
            <button disabled={busy || cancelReason.trim().length < 3} className="rounded-full bg-[var(--color-danger)] px-5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              onClick={() => run(() => adminCancelOrderApi(id, { reason: cancelReason, refund: cancelRefund }))}>Cancel order</button>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--border)] pt-3">
        <p className="text-xs font-medium">History</p>
        <ol className="mt-1 space-y-1 text-xs text-[var(--muted)]">
          {[...order.timeline].reverse().map((t, i) => (
            <li key={i}>{new Date(t.at).toLocaleString("en-IN")} — {t.status.replaceAll("_", " ").toLowerCase()} ({t.actor}){t.note && `: ${t.note}`}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1 });
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    listAdminOrdersApi({ status: status || undefined, page, limit: 15 })
      .then((r) => { setOrders(r.data); setMeta(r.meta); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [status, page]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Link to="/admin" className="text-xs text-[var(--muted)] underline">← Admin</Link>
      <h1 className="mt-2 font-display text-3xl font-semibold">Orders</h1>
      <div className="mt-6"><RulesPanel /></div>

      <div className="mt-6 flex items-center gap-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); setSelected(null); }} className="rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm">
          <option value="">All statuses</option>
          {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ").toLowerCase()}</option>)}
        </select>
      </div>
      {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-2">
          {loading && [0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl skeleton" />)}
          {!loading && orders.length === 0 && <p className="text-sm text-[var(--muted)]">No orders found.</p>}
          {orders.map((o) => (
            <button key={o._id} onClick={() => setSelected(o._id)} className={`block w-full rounded-xl border p-4 text-left text-sm ${selected === o._id ? "border-ink-950 dark:border-white" : "border-[var(--border)]"} bg-[var(--card)]`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{o.orderNumber}</span>
                <StatusBadge status={o.status} />
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {o.user?.name || o.user?.email} · {formatPrice(o.totalAmount)} · {o.paymentMethod} · {new Date(o.createdAt).toLocaleDateString("en-IN")}
                {o.needsRefundDecision && " · refund decision needed"}
              </p>
            </button>
          ))}
          {meta.pages > 1 && (
            <div className="flex items-center gap-2 pt-2 text-xs">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={btnOutline}>Prev</button>
              <span>Page {meta.page} of {meta.pages}</span>
              <button disabled={page >= meta.pages} onClick={() => setPage((p) => p + 1)} className={btnOutline}>Next</button>
            </div>
          )}
        </div>
        <div>{selected ? <OrderPanel id={selected} onChanged={load} /> : <p className="text-sm text-[var(--muted)]">Select an order to manage it.</p>}</div>
      </div>
    </div>
  );
}

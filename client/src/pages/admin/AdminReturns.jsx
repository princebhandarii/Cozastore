import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listAdminReturnsApi, adminGetReturnApi, updateReturnApi, retryReturnRefundApi, manualReturnRefundApi,
  getAdminSettingsApi, updateReturnRulesApi,
} from "../../services/adminService";
import { formatPrice } from "../../utils/formatPrice";
import { reasonLabel } from "../../utils/returnReasons";
import StatusBadge from "../../components/StatusBadge";

const STATUSES = ["RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_PICKED_UP", "RETURNED", "REFUND_INITIATED", "REFUNDED", "RETURN_REJECTED"];
const input = "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm";
const btn = "rounded-full bg-ink-950 px-5 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-ink-950";

function RulesPanel() {
  const [rules, setRules] = useState(null);
  const [days, setDays] = useState("");
  useEffect(() => { getAdminSettingsApi().then((s) => { setRules(s.returns); setDays(String(s.returns.windowDays)); }); }, []);
  if (!rules) return null;
  const save = async (body) => { const s = await updateReturnRulesApi(body); setRules(s.returns); setDays(String(s.returns.windowDays)); };
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
      <span className="font-medium">Return rules</span>
      <label className="flex items-center gap-2"><input type="checkbox" checked={rules.enabled} onChange={(e) => save({ enabled: e.target.checked })} /> Accept returns</label>
      <label className="flex items-center gap-2">Window (days after delivery)
        <input type="number" min="1" max="60" value={days} onChange={(e) => setDays(e.target.value)} onBlur={() => Number(days) !== rules.windowDays && save({ windowDays: Number(days) })} className="w-16 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1" />
      </label>
    </div>
  );
}

function ReturnPanel({ id, onChanged }) {
  const [ret, setRet] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [restock, setRestock] = useState(true);
  const [reference, setReference] = useState("");

  const load = useCallback(() => adminGetReturnApi(id).then(setRet).catch((e) => setError(e.message)), [id]);
  useEffect(() => { setRet(null); setError(""); setNote(""); load(); }, [load]);

  const run = async (fn) => {
    setBusy(true); setError("");
    try { const r = await fn(); if (typeof r?.message === "string" && r.message.includes("failing")) setError(r.message); await load(); onChanged(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const setStatus = (status, extra = {}) => run(() => updateReturnApi(id, { status, note: note || undefined, ...extra }));

  if (!ret) return <div className="h-40 rounded-2xl skeleton" />;
  const f = ret.refund;
  const st = ret.status;

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-sm">
      <div className="flex items-center justify-between"><p className="font-medium">{ret.order?.orderNumber}</p><StatusBadge status={st} /></div>
      {error && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">{error}</p>}
      <p className="text-[var(--muted)]">{ret.user?.name || ret.user?.email} · {ret.order?.paymentMethod} order · reason: <strong>{reasonLabel(ret.reason)}</strong></p>
      {ret.description && <p className="rounded-lg bg-[var(--bg)] p-3 text-xs">{ret.description}</p>}
      <ul className="text-xs text-[var(--muted)]">{ret.items.map((i) => <li key={i.orderItemId}>{i.name} {[i.size, i.color].filter(Boolean).join("/")} × {i.quantity} @ {formatPrice(i.unitPrice)}</li>)}</ul>
      {ret.images?.length > 0 && <div className="flex gap-2">{ret.images.map((img) => <a key={img.url} href={img.url} target="_blank" rel="noreferrer noopener"><img src={img.url} alt="" className="h-16 w-16 rounded-lg object-cover" /></a>)}</div>}
      <p>Refund due: <strong>{formatPrice(ret.refundAmount)}</strong> <span className="text-xs text-[var(--muted)]">(items {formatPrice(ret.refundBreakdown.itemsTotal)} − coupon {formatPrice(ret.refundBreakdown.discountShare)} + shipping {formatPrice(ret.refundBreakdown.shipping)})</span></p>

      <div className="space-y-3 border-t border-[var(--border)] pt-3">
        {(st === "RETURN_REQUESTED" || st === "RETURN_APPROVED") && (
          <input className={input} placeholder={st === "RETURN_REQUESTED" ? "Note / rejection reason (required to reject)" : "Note (optional)"} value={note} onChange={(e) => setNote(e.target.value)} />
        )}
        {st === "RETURN_REQUESTED" && (
          <div className="flex gap-2">
            <button disabled={busy} className={btn} onClick={() => setStatus("RETURN_APPROVED")}>Approve</button>
            <button disabled={busy || note.trim().length < 3} className="rounded-full bg-[var(--color-danger)] px-5 py-1.5 text-xs font-medium text-white disabled:opacity-50" onClick={() => setStatus("RETURN_REJECTED")}>Reject</button>
          </div>
        )}
        {st === "RETURN_APPROVED" && <button disabled={busy} className={btn} onClick={() => setStatus("RETURN_PICKED_UP")}>Mark picked up</button>}
        {st === "RETURN_PICKED_UP" && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> Items are in resellable condition - add back to stock</label>
            <button disabled={busy} className={btn} onClick={() => setStatus("RETURNED", { restock })}>Mark received back</button>
          </div>
        )}
        {st === "RETURNED" && (
          <div className="space-y-1">
            <button disabled={busy} className={btn} onClick={() => setStatus("REFUND_INITIATED")}>Start refund of {formatPrice(ret.refundAmount)}</button>
            <p className="text-xs text-[var(--muted)]">Nothing is refunded until you click this.{ret.order?.paymentMethod === "COD" && " COD: the online token goes back through Razorpay; the rest must be paid by you."}</p>
          </div>
        )}
        {st === "REFUND_INITIATED" && f.planned && (
          <div className="space-y-3">
            {f.razorpayAmount > 0 && (
              <div className="rounded-lg bg-[var(--bg)] p-3 text-xs">
                <p>Razorpay: <strong>{formatPrice(f.razorpayAmount)}</strong> — {f.razorpayProcessed ? "completed" : f.razorpayInitiated ? "initiated, waiting for Razorpay to confirm" : "not started"}</p>
                {f.error && <p className="mt-1 text-[var(--color-danger)]">{f.error}</p>}
                {!f.razorpayInitiated && <button disabled={busy} className={`${btn} mt-2`} onClick={() => run(() => retryReturnRefundApi(id))}>Retry Razorpay refund</button>}
              </div>
            )}
            {f.manualAmount > 0 && (
              <div className="rounded-lg bg-[var(--bg)] p-3 text-xs">
                <p>Pay the customer directly: <strong>{formatPrice(f.manualAmount)}</strong> {f.manualPaid ? `— sent (ref ${f.manualReference})` : "— pending"}</p>
                {!f.manualPaid && (
                  <div className="mt-2 flex gap-2"><input className={input} placeholder="UPI / bank transfer reference" value={reference} onChange={(e) => setReference(e.target.value)} />
                    <button disabled={busy || reference.trim().length < 3} className={btn} onClick={() => run(() => manualReturnRefundApi(id, reference))}>Mark paid</button></div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <ol className="space-y-1 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
        {[...ret.timeline].reverse().map((t, i) => <li key={i}>{new Date(t.at).toLocaleString("en-IN")} — {t.status.replaceAll("_", " ").toLowerCase()} ({t.actor}){t.note && `: ${t.note}`}</li>)}
      </ol>
    </div>
  );
}

export default function AdminReturns() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    listAdminReturnsApi({ status: status || undefined, limit: 50 }).then((r) => setItems(r.data)).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Link to="/admin" className="text-xs text-[var(--muted)] underline">← Admin</Link>
      <h1 className="mt-2 font-display text-3xl font-semibold">Returns</h1>
      <div className="mt-6"><RulesPanel /></div>
      <div className="mt-6">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setSelected(null); }} className="rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ").toLowerCase()}</option>)}
        </select>
      </div>
      {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-2">
          {loading && [0, 1].map((i) => <div key={i} className="h-16 rounded-xl skeleton" />)}
          {!loading && items.length === 0 && <p className="text-sm text-[var(--muted)]">No returns found.</p>}
          {items.map((r) => (
            <button key={r._id} onClick={() => setSelected(r._id)} className={`block w-full rounded-xl border bg-[var(--card)] p-4 text-left text-sm ${selected === r._id ? "border-ink-950 dark:border-white" : "border-[var(--border)]"}`}>
              <div className="flex items-center justify-between"><span className="font-medium">{r.order?.orderNumber}</span><StatusBadge status={r.status} /></div>
              <p className="mt-1 text-xs text-[var(--muted)]">{r.user?.name || r.user?.email} · {reasonLabel(r.reason)} · {formatPrice(r.refundAmount)} · {new Date(r.createdAt).toLocaleDateString("en-IN")}</p>
            </button>
          ))}
        </div>
        <div>{selected ? <ReturnPanel id={selected} onChanged={load} /> : <p className="text-sm text-[var(--muted)]">Select a return to manage it.</p>}</div>
      </div>
    </div>
  );
}

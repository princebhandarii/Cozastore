import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getAdminSettingsApi, updateCodSettingsApi, listAdminOrdersApi, confirmCodApi, rejectCodApi,
} from "../../services/adminService";
import { formatPrice } from "../../utils/formatPrice";

const field = "mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm";

function SettingsForm() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    getAdminSettingsApi().then((s) => setForm(s.cod)).catch((e) => setMsg({ type: "error", text: e.message }));
  }, []);

  if (!form) return <div className="h-48 rounded-2xl skeleton" />;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const { enabled, minOrderAmount, maxOrderAmount, tokenType, tokenValue, otpRequired, cancellationPolicy } = form;
      const saved = await updateCodSettingsApi({
        enabled, minOrderAmount: Number(minOrderAmount), maxOrderAmount: Number(maxOrderAmount),
        tokenType, tokenValue: Number(tokenValue), otpRequired, cancellationPolicy,
      });
      setForm(saved.cod);
      setMsg({ type: "success", text: "Saved." });
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:grid-cols-2">
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} />
        Cash on delivery enabled
      </label>
      <div><label className="text-xs font-medium text-[var(--muted)]">Minimum COD order (₹)</label>
        <input type="number" min="0" value={form.minOrderAmount} onChange={(e) => set("minOrderAmount", e.target.value)} className={field} /></div>
      <div><label className="text-xs font-medium text-[var(--muted)]">Maximum COD order (₹, 0 = no limit)</label>
        <input type="number" min="0" value={form.maxOrderAmount} onChange={(e) => set("maxOrderAmount", e.target.value)} className={field} /></div>
      <div><label className="text-xs font-medium text-[var(--muted)]">Token type</label>
        <select value={form.tokenType} onChange={(e) => set("tokenType", e.target.value)} className={field}>
          <option value="fixed">Fixed amount</option><option value="percentage">Percentage of order</option>
        </select></div>
      <div><label className="text-xs font-medium text-[var(--muted)]">{form.tokenType === "fixed" ? "Token amount (₹)" : "Token percentage (max 90)"}</label>
        <input type="number" min="1" value={form.tokenValue} onChange={(e) => set("tokenValue", e.target.value)} className={field} /></div>
      <div><label className="text-xs font-medium text-[var(--muted)]">Cancellation policy (token)</label>
        <select value={form.cancellationPolicy} onChange={(e) => set("cancellationPolicy", e.target.value)} className={field}>
          <option value="refundable">Refundable</option><option value="non_refundable">Non-refundable</option><option value="configurable">Decided per cancellation</option>
        </select></div>
      <label className="flex items-center gap-2 self-end text-sm">
        <input type="checkbox" checked={form.otpRequired} onChange={(e) => set("otpRequired", e.target.checked)} />
        Require phone OTP before COD
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={saving} className="rounded-full bg-ink-950 px-6 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-ink-950">{saving ? "Saving..." : "Save settings"}</button>
        {msg && <span className={`text-xs ${msg.type === "success" ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>{msg.text}</span>}
      </div>
      <p className="text-xs text-[var(--muted)] sm:col-span-2">Changes apply to new orders only; existing orders keep the rules they were placed under.</p>
    </form>
  );
}

function PendingOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null); // order id
  const [reason, setReason] = useState("");
  const [refundToken, setRefundToken] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    listAdminOrdersApi({ status: "PENDING_COD_CONFIRMATION", paymentMethod: "COD", limit: 50 })
      .then((r) => setOrders(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const confirm = async (id) => {
    setBusyId(id); setError("");
    try { await confirmCodApi(id); await load(); } catch (e) { setError(e.message); } finally { setBusyId(null); }
  };
  const reject = async (id) => {
    setBusyId(id); setError("");
    try {
      const res = await rejectCodApi(id, { reason, refundToken });
      if (res.message.includes("failed")) setError(res.message);
      setRejecting(null); setReason("");
      await load();
    } catch (e) { setError(e.message); } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}
      {loading && <div className="h-24 rounded-2xl skeleton" />}
      {!loading && orders.length === 0 && <p className="text-sm text-[var(--muted)]">No COD orders are waiting for confirmation.</p>}
      {orders.map((o) => (
        <div key={o._id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{o.orderNumber}</p>
            <p className="text-xs text-[var(--muted)]">{new Date(o.createdAt).toLocaleString("en-IN")}</p>
          </div>
          <p className="mt-1 text-[var(--muted)]">{o.user?.name || o.user?.email} · {o.shippingAddress.city}, {o.shippingAddress.state} - {o.shippingAddress.pincode} · {o.shippingAddress.phone}</p>
          <ul className="mt-2 text-xs text-[var(--muted)]">
            {o.items.map((i) => <li key={i._id}>{i.name} {[i.size, i.color].filter(Boolean).join("/")} × {i.quantity}</li>)}
          </ul>
          <p className="mt-2">Total {formatPrice(o.totalAmount)} · token paid {formatPrice(o.cod.tokenAmount)} · <strong>collect {formatPrice(o.cod.remainingAmount)} on delivery</strong></p>

          {rejecting === o._id ? (
            <div className="mt-3 space-y-2">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (shown to the customer)" className={field} />
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={refundToken} onChange={(e) => setRefundToken(e.target.checked)} /> Refund the token via Razorpay</label>
              <div className="flex gap-2">
                <button disabled={busyId === o._id || reason.trim().length < 3} onClick={() => reject(o._id)} className="rounded-full bg-[var(--color-danger)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50">Confirm rejection</button>
                <button onClick={() => setRejecting(null)} className="rounded-full border border-[var(--border)] px-4 py-1.5 text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <button disabled={busyId === o._id} onClick={() => confirm(o._id)} className="rounded-full bg-ink-950 px-5 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-ink-950">Confirm</button>
              <button onClick={() => { setRejecting(o._id); setReason(""); }} className="rounded-full border border-[var(--border)] px-5 py-1.5 text-xs">Reject</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AdminCod() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link to="/admin" className="text-xs text-[var(--muted)] underline">← Admin</Link>
      <h1 className="mt-2 font-display text-3xl font-semibold">COD</h1>
      <h2 className="mt-8 font-medium">Settings</h2>
      <div className="mt-3"><SettingsForm /></div>
      <h2 className="mt-10 font-medium">Waiting for confirmation</h2>
      <div className="mt-3"><PendingOrders /></div>
    </div>
  );
}

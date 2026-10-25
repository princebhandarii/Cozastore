import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getOrderApi } from "../../services/checkoutService";
import { previewReturnApi, createReturnApi } from "../../services/returnService";
import { RETURN_REASONS } from "../../utils/returnReasons";
import { formatPrice } from "../../utils/formatPrice";
import ImagePicker from "../../components/ImagePicker";

const field = "w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm";

export default function NewReturn() {
  const [params] = useSearchParams();
  const orderId = params.get("order");
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState({}); // itemId -> quantity
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!orderId) return setError("No order selected");
    getOrderApi(orderId).then((o) => {
      if (!o.actions?.canReturn) setError(o.actions?.returnBlockedReason || "This order can't be returned");
      setOrder(o);
    }).catch((e) => setError(e.message));
  }, [orderId]);

  const items = Object.entries(picked).map(([itemId, quantity]) => ({ itemId, quantity }));

  // The refund shown is computed by the server, not in the browser.
  useEffect(() => {
    if (!order || !reason || items.length === 0) { setPreview(null); return undefined; }
    const t = setTimeout(() => {
      previewReturnApi({ orderId, reason, items }).then(setPreview).catch(() => setPreview(null));
    }, 250);
    return () => clearTimeout(t);
  }, [order, reason, JSON.stringify(items)]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (item) => setPicked((p) => {
    const next = { ...p };
    if (next[item._id]) delete next[item._id]; else next[item._id] = item.quantity;
    return next;
  });

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const created = await createReturnApi({ orderId, reason, description, items, images: files });
      navigate(`/account/returns/${created._id}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!order) return <div className="mx-auto max-w-2xl px-4 py-12">{error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : <div className="h-40 rounded-2xl skeleton" />}</div>;

  const blocked = !order.actions?.canReturn;
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Link to={`/account/orders/${orderId}`} className="text-xs text-[var(--muted)] underline">← Order details</Link>
      <h1 className="mt-3 font-display text-2xl font-semibold">Return items from {order.orderNumber}</h1>
      {error && <p className="mt-4 rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p>}

      {!blocked && (
        <form onSubmit={submit} className="mt-6 space-y-6">
          <section>
            <h2 className="text-sm font-medium">1. Which items?</h2>
            <div className="mt-2 space-y-2">
              {order.items.map((it) => (
                <div key={it._id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-sm">
                  <input type="checkbox" checked={Boolean(picked[it._id])} onChange={() => toggle(it)} />
                  {it.image && <img src={it.image} alt="" className="h-12 w-10 rounded object-cover" />}
                  <div className="flex-1">
                    <p className="font-medium">{it.name}</p>
                    <p className="text-xs text-[var(--muted)]">{[it.size, it.color].filter(Boolean).join(" / ")} · {formatPrice(it.unitPrice)} each</p>
                  </div>
                  {picked[it._id] !== undefined && it.quantity > 1 && (
                    <select value={picked[it._id]} onChange={(e) => setPicked({ ...picked, [it._id]: Number(e.target.value) })} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs">
                      {Array.from({ length: it.quantity }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Qty {n}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium">2. Why are you returning them?</h2>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className={field} required>
              <option value="">Select a reason</option>
              {RETURN_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} placeholder="Tell us more (optional)" className={field} />
            <div>
              <p className="mb-1 text-xs text-[var(--muted)]">Photos (optional, up to 4) - helpful for damaged or wrong items</p>
              <ImagePicker files={files} setFiles={setFiles} max={4} onError={setError} />
            </div>
          </section>

          {preview && (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
              <p className="font-medium">Estimated refund: {formatPrice(preview.amount)}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Items {formatPrice(preview.itemsTotal)}{preview.discountShare > 0 && ` − coupon share ${formatPrice(preview.discountShare)}`}{preview.shipping > 0 && ` + shipping ${formatPrice(preview.shipping)}`}.
                Refunds are issued only after the store receives and checks the items.
                {order.paymentMethod === "COD" && " For cash-on-delivery orders, the part beyond your online token is paid back by the store directly."}
              </p>
            </section>
          )}

          <button disabled={submitting || items.length === 0 || !reason} className="w-full rounded-full bg-ink-950 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-ink-950">
            {submitting ? "Submitting..." : "Request return"}
          </button>
        </form>
      )}
    </div>
  );
}

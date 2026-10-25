import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getReturnApi } from "../../services/returnService";
import { formatPrice } from "../../utils/formatPrice";
import { reasonLabel } from "../../utils/returnReasons";
import StatusBadge from "../../components/StatusBadge";

export default function ReturnDetail() {
  const { id } = useParams();
  const [ret, setRet] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { getReturnApi(id).then(setRet).catch((e) => setError(e.message)); }, [id]);

  if (error) return <p className="py-24 text-center text-sm text-[var(--color-danger)]">{error}</p>;
  if (!ret) return <div className="mx-auto max-w-2xl px-4 py-12"><div className="h-40 rounded-2xl skeleton" /></div>;
  const f = ret.refund;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Link to="/account/returns" className="text-xs text-[var(--muted)] underline">← All returns</Link>
      <div className="mt-3 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Return for {ret.order?.orderNumber}</h1>
        <StatusBadge status={ret.status} />
      </div>
      <p className="text-xs text-[var(--muted)]">Reason: {reasonLabel(ret.reason)}{ret.description && ` — ${ret.description}`}</p>

      {ret.status === "RETURN_REJECTED" && (
        <p className="mt-4 rounded-xl bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">Your return was not approved{ret.adminNote ? `: ${ret.adminNote}` : "."} Please contact support if you have questions.</p>
      )}
      {ret.status === "RETURN_APPROVED" && <p className="mt-4 rounded-xl bg-[var(--color-success)]/10 px-4 py-3 text-sm text-[var(--color-success)]">Approved. The store will arrange pickup of the items.{ret.adminNote && ` Note: ${ret.adminNote}`}</p>}

      <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-sm">
        <h2 className="font-medium">Items</h2>
        <ul className="mt-2 space-y-1 text-[var(--muted)]">
          {ret.items.map((i) => <li key={i.orderItemId}>{i.name} {[i.size, i.color].filter(Boolean).join("/")} × {i.quantity}</li>)}
        </ul>
        {ret.images?.length > 0 && (
          <div className="mt-3 flex gap-2">{ret.images.map((img) => <a key={img.url} href={img.url} target="_blank" rel="noreferrer noopener"><img src={img.url} alt="" className="h-14 w-14 rounded-lg object-cover" /></a>)}</div>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-sm">
        <h2 className="font-medium">Refund: {formatPrice(ret.refundAmount)}</h2>
        {!f.planned ? (
          <p className="mt-1 text-xs text-[var(--muted)]">{ret.status === "RETURN_REJECTED" ? "No refund for this return." : "The refund starts after the store receives and checks your items."}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
            {f.razorpayAmount > 0 && <li>{formatPrice(f.razorpayAmount)} back to your original payment method — {f.razorpayProcessed ? "completed" : f.razorpayInitiated ? "in progress (usually 5-7 working days)" : "being started"}</li>}
            {f.manualAmount > 0 && <li>{formatPrice(f.manualAmount)} paid back by the store directly (cash-on-delivery portion) — {f.manualPaid ? `sent${f.manualReference ? ` (ref ${f.manualReference})` : ""}` : "pending"}</li>}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-sm font-medium">History</h2>
        <ol className="mt-2 space-y-1 text-sm">
          {[...ret.timeline].reverse().map((t, i) => (
            <li key={i} className="flex justify-between gap-3"><span>{t.status.replaceAll("_", " ").toLowerCase()}{t.note && <span className="text-[var(--muted)]"> - {t.note}</span>}</span><span className="shrink-0 text-xs text-[var(--muted)]">{new Date(t.at).toLocaleString("en-IN")}</span></li>
          ))}
        </ol>
      </section>
    </div>
  );
}

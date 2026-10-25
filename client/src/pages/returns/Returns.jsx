import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listReturnsApi } from "../../services/returnService";
import { formatPrice } from "../../utils/formatPrice";
import { reasonLabel } from "../../utils/returnReasons";
import StatusBadge from "../../components/StatusBadge";

export default function Returns() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { listReturnsApi().then(setItems).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-semibold">My returns</h1>
      <div className="mt-8 space-y-3">
        {loading && [0, 1].map((i) => <div key={i} className="h-20 rounded-2xl skeleton" />)}
        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
        {!loading && !error && items.length === 0 && <p className="text-sm text-[var(--muted)]">You haven't requested any returns.</p>}
        {items.map((r) => (
          <Link key={r._id} to={`/account/returns/${r._id}`} className="block rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 hover:shadow-md">
            <div className="flex items-center justify-between"><p className="text-sm font-medium">{r.order?.orderNumber}</p><StatusBadge status={r.status} /></div>
            <p className="mt-1 text-xs text-[var(--muted)]">{reasonLabel(r.reason)} · {r.items.length} item(s) · {new Date(r.createdAt).toLocaleDateString("en-IN")}</p>
            <p className="mt-2 text-sm font-semibold">Refund {formatPrice(r.refundAmount)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

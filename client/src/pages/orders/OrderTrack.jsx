import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getOrderApi } from "../../services/checkoutService";
import OrderTracker from "../../components/OrderTracker";
import StatusBadge from "../../components/StatusBadge";

export default function OrderTrack() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { getOrderApi(id).then(setOrder).catch((e) => setError(e.message)); }, [id]);

  if (error) return <p className="py-24 text-center text-sm text-[var(--color-danger)]">{error}</p>;
  if (!order) return <div className="mx-auto max-w-2xl space-y-4 px-4 py-12">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl skeleton" />)}</div>;

  const s = order.shipping;
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Link to={`/account/orders/${id}`} className="text-xs text-[var(--muted)] underline">← Order details</Link>
      <div className="mt-3 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Track {order.orderNumber}</h1>
        <StatusBadge status={order.status} />
      </div>

      {order.status === "CANCELLED" && (
        <p className="mt-4 rounded-xl bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">This order was cancelled.</p>
      )}

      <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <OrderTracker timeline={order.timeline} />
      </div>

      <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-sm">
        <h2 className="font-medium">Shipment</h2>
        {s?.trackingNumber ? (
          <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-2">
            <dt className="text-[var(--muted)]">Courier</dt><dd>{s.courier}</dd>
            <dt className="text-[var(--muted)]">Tracking number</dt><dd>{s.trackingNumber}</dd>
            {s.trackingUrl && (<><dt className="text-[var(--muted)]">Live tracking</dt><dd><a href={s.trackingUrl} target="_blank" rel="noreferrer noopener" className="underline">Open courier page</a></dd></>)}
            {s.estimatedDelivery && (<><dt className="text-[var(--muted)]">Estimated delivery</dt><dd>{new Date(s.estimatedDelivery).toLocaleDateString("en-IN", { dateStyle: "long" })}</dd></>)}
          </dl>
        ) : (
          <p className="mt-2 text-[var(--muted)]">Tracking details will appear here once your order ships.</p>
        )}
        {s?.trackingNumber && <p className="mt-3 text-xs text-[var(--muted)]">Status updates are entered by the store as your parcel moves.</p>}
      </div>
    </div>
  );
}

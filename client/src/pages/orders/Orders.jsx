import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listOrdersApi } from "../../services/checkoutService";
import { formatPrice } from "../../utils/formatPrice";
import StatusBadge from "../../components/StatusBadge";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listOrdersApi({ limit: 50 })
      .then((res) => setOrders(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold">My orders</h1>
      <div className="mt-8 space-y-3">
        {loading && [0, 1, 2].map((i) => <div key={i} className="h-24 rounded-2xl skeleton" />)}
        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
        {!loading && !error && orders.length === 0 && <p className="text-sm text-[var(--muted)]">No orders found.</p>}
        {orders.map((o) => (
          <Link key={o._id} to={`/account/orders/${o._id}`} className="block rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{o.orderNumber}</p>
              <StatusBadge status={o.status} />
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">{new Date(o.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })} · {o.items.length} item(s)</p>
            <p className="mt-2 text-sm font-semibold">{formatPrice(o.totalAmount)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

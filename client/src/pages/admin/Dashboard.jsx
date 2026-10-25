import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboardApi } from "../../services/adminService";
import { formatPrice } from "../../utils/formatPrice";
import StatusBadge from "../../components/StatusBadge";
import AdminPage from "../../components/admin/AdminPage";

const Card = ({ label, value, sub, warn }) => (
  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
    <p className="text-xs text-[var(--muted)]">{label}</p>
    <p className={`mt-1 text-2xl font-semibold ${warn ? "text-[var(--color-warning)]" : ""}`}>{value}</p>
    {sub && <p className="mt-1 text-xs text-[var(--muted)]">{sub}</p>}
  </div>
);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { getDashboardApi().then(setData).catch((e) => setError(e.message)); }, []);

  if (error) return <p className="text-sm text-[var(--color-danger)]">{error}</p>;
  if (!data) return <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-24 rounded-2xl skeleton" />)}</div>;
  const { cards, lowStock, recentOrders } = data;

  return (
    <AdminPage title="Dashboard" subtitle="Confirmed orders only - abandoned checkouts are never counted.">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Card label="Total revenue" value={formatPrice(cards.totalRevenue)} sub={cards.refundedViaReturns > 0 ? `after ${formatPrice(cards.refundedViaReturns)} in return refunds` : "net of return refunds"} />
        <Card label="Today's revenue" value={formatPrice(cards.todayRevenue)} />
        <Card label="Total orders" value={cards.totalOrders} />
        <Card label="Pending orders" value={cards.pendingOrders} sub="awaiting confirmation, processing" />
        <Card label="Delivered orders" value={cards.deliveredOrders} />
        <Card label="Cancelled orders" value={cards.cancelledOrders} />
        <Card label="Open return requests" value={cards.openReturnRequests} warn={cards.openReturnRequests > 0} />
        <Card label="Total customers" value={cards.totalCustomers} />
        <Card label="Total products" value={cards.totalProducts} />
        <Card label="Low stock products" value={cards.lowStockProducts} warn={cards.lowStockProducts > 0} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center justify-between"><p className="text-sm font-medium">Recent orders</p><Link to="/admin/orders" className="text-xs underline">View all</Link></div>
          <div className="mt-3 space-y-2 text-sm">
            {recentOrders.length === 0 && <p className="text-xs text-[var(--muted)]">No orders yet.</p>}
            {recentOrders.map((o) => (
              <div key={o._id} className="flex items-center justify-between border-b border-[var(--border)] pb-2 last:border-0">
                <div><p className="font-medium">{o.orderNumber}</p><p className="text-xs text-[var(--muted)]">{o.user?.name || o.user?.email}</p></div>
                <div className="text-right"><p>{formatPrice(o.totalAmount)}</p><StatusBadge status={o.status} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center justify-between"><p className="text-sm font-medium">Low stock</p><Link to="/admin/inventory" className="text-xs underline">View all</Link></div>
          <div className="mt-3 space-y-2 text-sm">
            {lowStock.length === 0 && <p className="text-xs text-[var(--muted)]">Nothing is low on stock.</p>}
            {lowStock.map((r) => (
              <div key={`${r.productId}-${r.variantId || ""}`} className="flex items-center justify-between border-b border-[var(--border)] pb-2 last:border-0">
                <div><p className="font-medium">{r.name}</p>{r.label && <p className="text-xs text-[var(--muted)]">{r.label}</p>}</div>
                <span className={r.stock === 0 ? "text-[var(--color-danger)]" : "text-[var(--color-warning)]"}>{r.stock} left</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminPage>
  );
}

import { useEffect, useState } from "react";
import { getAnalyticsApi } from "../../services/adminService";
import { formatPrice } from "../../utils/formatPrice";
import AdminPage from "../../components/admin/AdminPage";
import AnalyticsCharts from "../../components/admin/Charts";

export default function Analytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { setData(null); getAnalyticsApi(days).then(setData).catch((e) => setError(e.message)); }, [days]);

  return (
    <AdminPage
      title="Analytics"
      subtitle="Confirmed orders only, grouped by IST calendar day."
      actions={
        <div className="flex gap-1 rounded-full border border-[var(--border)] p-1 text-xs">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)} className={`rounded-full px-3 py-1 ${days === d ? "bg-ink-950 text-white dark:bg-white dark:text-ink-950" : ""}`}>{d}d</button>
          ))}
        </div>
      }
    >
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      {!data ? (
        <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-64 rounded-2xl skeleton" />)}</div>
      ) : (
        <>
          <div className="mb-4 flex gap-6 text-sm">
            <p><span className="text-[var(--muted)]">Revenue: </span><strong>{formatPrice(data.totals.revenue)}</strong></p>
            <p><span className="text-[var(--muted)]">Orders: </span><strong>{data.totals.orders}</strong></p>
          </div>
          <AnalyticsCharts data={data} />
        </>
      )}
    </AdminPage>
  );
}

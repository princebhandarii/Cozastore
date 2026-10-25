import { useCallback, useEffect, useState } from "react";
import { listPaymentsApi } from "../../services/adminService";
import { formatPrice } from "../../utils/formatPrice";
import AdminPage, { Pager, ErrorNote } from "../../components/admin/AdminPage";
import { input } from "../../components/admin/ui";

export default function Payments() {
  const [status, setStatus] = useState("");
  const [manualOnly, setManualOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    listPaymentsApi({ status: status || undefined, needsManualRefund: manualOnly ? "true" : undefined, page, limit: 20 })
      .then((r) => { setItems(r.data); setMeta(r.meta); }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [status, manualOnly, page]);
  useEffect(() => { load(); }, [load]);

  return (
    <AdminPage title="Payments">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className={`${input} max-w-[160px]`} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>{["CREATED", "PAID", "FAILED", "REFUND_INITIATED", "REFUNDED"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={manualOnly} onChange={(e) => { setManualOnly(e.target.checked); setPage(1); }} /> Needs manual refund only</label>
      </div>
      <ErrorNote message={error} />
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--card)] text-xs text-[var(--muted)]"><tr><th className="p-3">Order</th><th className="p-3">User</th><th className="p-3">Purpose</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Date</th></tr></thead>
          <tbody className="divide-y divide-[var(--border)]">
            {loading && <tr><td colSpan={6} className="p-6 text-center text-[var(--muted)]">Loading...</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-[var(--muted)]">No payments found.</td></tr>}
            {items.map((p) => (
              <tr key={p._id}>
                <td className="p-3">{p.order?.orderNumber}</td>
                <td className="p-3 text-[var(--muted)]">{p.user?.name || p.user?.email}</td>
                <td className="p-3">{p.purpose === "COD_TOKEN" ? "COD token" : "Order"}</td>
                <td className="p-3">{formatPrice(p.amount)}</td>
                <td className="p-3">{p.status}{p.needsManualRefund && <span className="ml-2 rounded-full bg-[var(--color-warning)]/10 px-2 py-0.5 text-xs text-[var(--color-warning)]">needs manual refund</span>}</td>
                <td className="p-3 text-xs text-[var(--muted)]">{new Date(p.createdAt).toLocaleDateString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager meta={meta} page={page} setPage={setPage} />
    </AdminPage>
  );
}

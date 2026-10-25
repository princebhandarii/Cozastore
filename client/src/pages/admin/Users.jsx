import { useCallback, useEffect, useState } from "react";
import { listUsersApi, setUserStatusApi } from "../../services/adminService";
import { formatPrice } from "../../utils/formatPrice";
import AdminPage, { Pager, ErrorNote } from "../../components/admin/AdminPage";
import { input, btnOutline } from "../../components/admin/ui";

export default function Users() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    listUsersApi({ q: q || undefined, role: role || undefined, page, limit: 15 }).then((r) => { setItems(r.data); setMeta(r.meta); }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [q, role, page]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (u) => {
    if (!window.confirm(`${u.isActive ? "Deactivate" : "Activate"} ${u.email}?`)) return;
    try { await setUserStatusApi(u._id, !u.isActive); load(); } catch (e) { setError(e.message); }
  };

  return (
    <AdminPage title="Users">
      <div className="mb-4 flex flex-wrap gap-2">
        <input className={`${input} max-w-xs`} placeholder="Search name or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className={`${input} max-w-[140px]`} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}><option value="">All roles</option><option value="customer">Customer</option><option value="admin">Admin</option></select>
      </div>
      <ErrorNote message={error} />
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--card)] text-xs text-[var(--muted)]"><tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Orders</th><th className="p-3">Spent</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
          <tbody className="divide-y divide-[var(--border)]">
            {loading && <tr><td colSpan={6} className="p-6 text-center text-[var(--muted)]">Loading...</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-[var(--muted)]">No users found.</td></tr>}
            {items.map((u) => (
              <tr key={u._id}>
                <td className="p-3"><p>{u.name || "—"}</p><p className="text-xs text-[var(--muted)]">{u.email}{u.phone && ` · ${u.phone}`}</p></td>
                <td className="p-3">{u.role}</td>
                <td className="p-3">{u.orderCount}</td>
                <td className="p-3">{formatPrice(u.totalSpent)}</td>
                <td className="p-3">{u.isActive ? <span className="text-[var(--color-success)]">Active</span> : <span className="text-[var(--color-danger)]">Deactivated</span>}</td>
                <td className="p-3 text-right">{u.role !== "admin" && <button onClick={() => toggle(u)} className={btnOutline}>{u.isActive ? "Deactivate" : "Activate"}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager meta={meta} page={page} setPage={setPage} />
    </AdminPage>
  );
}

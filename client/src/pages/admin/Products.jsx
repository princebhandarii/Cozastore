import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { adminListProductsApi, deleteProductApi } from "../../services/adminService";
import { formatPrice } from "../../utils/formatPrice";
import AdminPage, { Pager, ErrorNote } from "../../components/admin/AdminPage";
import { btnOutline, btnDanger } from "../../components/admin/ui";
import ProductFormModal from "../../components/admin/ProductFormModal";

export default function Products() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, id = edit

  const load = useCallback(() => {
    setLoading(true);
    adminListProductsApi({ page, limit: 15 }).then((r) => { setItems(r.data); setMeta(r.meta); }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [page]);
  useEffect(() => { load(); }, [load]);

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try { await deleteProductApi(p._id); load(); } catch (e) { setError(e.message); }
  };
  const stockOf = (p) => (p.variants?.length ? p.variants.reduce((n, v) => n + v.stock, 0) : p.stock);

  return (
    <AdminPage title="Products" actions={<button onClick={() => setEditing(null)} className="flex items-center gap-1 rounded-full bg-ink-950 px-4 py-2 text-xs font-medium text-white dark:bg-white dark:text-ink-950"><Plus size={14} /> New product</button>}>
      <ErrorNote message={error} />
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--card)] text-xs text-[var(--muted)]"><tr><th className="p-3">Product</th><th className="p-3">Category</th><th className="p-3">Price</th><th className="p-3">Stock</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
          <tbody className="divide-y divide-[var(--border)]">
            {loading && <tr><td colSpan={6} className="p-6 text-center text-[var(--muted)]">Loading...</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-[var(--muted)]">No products yet.</td></tr>}
            {items.map((p) => (
              <tr key={p._id}>
                <td className="flex items-center gap-2 p-3">{p.images?.[0]?.url && <img src={p.images[0].url} alt="" className="h-10 w-9 rounded object-cover" />}<Link to={`/product/${p.slug}`} target="_blank" className="hover:underline">{p.name}</Link></td>
                <td className="p-3 text-[var(--muted)]">{p.category?.name}</td>
                <td className="p-3">{formatPrice(p.price)}</td>
                <td className={`p-3 ${stockOf(p) <= 5 ? "text-[var(--color-warning)]" : ""}`}>{stockOf(p)}</td>
                <td className="p-3">{p.isActive ? <span className="rounded-full bg-[var(--color-success)]/10 px-2 py-0.5 text-xs text-[var(--color-success)]">Active</span> : <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]">Hidden</span>}</td>
                <td className="p-3"><div className="flex justify-end gap-2"><button onClick={() => setEditing(p._id)} className={btnOutline}><Pencil size={12} /></button><button onClick={() => remove(p)} className={btnDanger}><Trash2 size={12} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager meta={meta} page={page} setPage={setPage} />
      {editing !== undefined && <ProductFormModal productId={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); }} />}
    </AdminPage>
  );
}

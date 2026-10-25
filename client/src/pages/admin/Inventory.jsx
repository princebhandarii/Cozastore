import { useCallback, useEffect, useState } from "react";
import { lowStockApi, inventoryLogsApi, adjustInventoryApi } from "../../services/adminService";
import AdminPage, { Pager, ErrorNote } from "../../components/admin/AdminPage";
import { input, btn, btnOutline } from "../../components/admin/ui";
import Modal from "../../components/admin/Modal";

function AdjustModal({ row, onClose, onSaved }) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError("");
    try { await adjustInventoryApi({ productId: row.productId, variantId: row.variantId || undefined, delta: Number(delta), reason }); onSaved(); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return (
    <Modal title={`Adjust stock — ${row.name}${row.label ? ` (${row.label})` : ""}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3 text-sm">
        {error && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">{error}</p>}
        <p className="text-xs text-[var(--muted)]">Current stock: {row.stock}</p>
        <input className={input} type="number" placeholder="Change (e.g. 10 or -5)" value={delta} onChange={(e) => setDelta(e.target.value)} required />
        <input className={input} placeholder="Reason (e.g. stock count correction)" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} />
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className={btnOutline}>Cancel</button><button disabled={saving || !delta} className={btn}>{saving ? "Saving..." : "Save"}</button></div>
      </form>
    </Modal>
  );
}

function LowStockTab() {
  const [threshold, setThreshold] = useState(5);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adjusting, setAdjusting] = useState(null);

  const load = useCallback(() => { setLoading(true); lowStockApi(threshold).then((r) => setRows(r.data)).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, [threshold]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm">Threshold: <input className={`${input} w-20`} type="number" min="0" value={threshold} onChange={(e) => setThreshold(Number(e.target.value) || 0)} /></div>
      <ErrorNote message={error} />
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--card)] text-xs text-[var(--muted)]"><tr><th className="p-3">Product</th><th className="p-3">SKU</th><th className="p-3">Stock</th><th className="p-3" /></tr></thead>
          <tbody className="divide-y divide-[var(--border)]">
            {loading && <tr><td colSpan={4} className="p-6 text-center text-[var(--muted)]">Loading...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-[var(--muted)]">Nothing at or below this threshold.</td></tr>}
            {rows.map((r) => (
              <tr key={`${r.productId}-${r.variantId || ""}`}>
                <td className="p-3">{r.name}{r.label && <span className="text-xs text-[var(--muted)]"> · {r.label}</span>}{!r.isActive && <span className="ml-2 text-xs text-[var(--muted)]">(hidden)</span>}</td>
                <td className="p-3 text-[var(--muted)]">{r.sku}</td>
                <td className={`p-3 ${r.stock === 0 ? "text-[var(--color-danger)]" : "text-[var(--color-warning)]"}`}>{r.stock}</td>
                <td className="p-3 text-right"><button onClick={() => setAdjusting(r)} className={btnOutline}>Adjust</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adjusting && <AdjustModal row={adjusting} onClose={() => setAdjusting(null)} onSaved={() => { setAdjusting(null); load(); }} />}
    </div>
  );
}

function LogsTab() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); inventoryLogsApi({ page, limit: 20 }).then((r) => { setItems(r.data); setMeta(r.meta); }).finally(() => setLoading(false)); }, [page]);
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--card)] text-xs text-[var(--muted)]"><tr><th className="p-3">When</th><th className="p-3">Product</th><th className="p-3">Change</th><th className="p-3">New stock</th><th className="p-3">Reason</th></tr></thead>
          <tbody className="divide-y divide-[var(--border)]">
            {loading && <tr><td colSpan={5} className="p-6 text-center text-[var(--muted)]">Loading...</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-[var(--muted)]">No inventory activity yet.</td></tr>}
            {items.map((l) => (
              <tr key={l._id}>
                <td className="p-3 text-xs text-[var(--muted)]">{new Date(l.timestamp).toLocaleString("en-IN")}</td>
                <td className="p-3">{l.product?.name || "(deleted product)"} <span className="text-xs text-[var(--muted)]">{l.sku}</span></td>
                <td className={`p-3 ${l.quantityChanged < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}`}>{l.quantityChanged > 0 ? `+${l.quantityChanged}` : l.quantityChanged}</td>
                <td className="p-3">{l.newStock}</td>
                <td className="p-3 text-xs text-[var(--muted)]">{l.reason}{l.performedBy && ` · ${l.performedBy.name || l.performedBy.email}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager meta={meta} page={page} setPage={setPage} />
    </div>
  );
}

export default function Inventory() {
  const [tab, setTab] = useState("low");
  return (
    <AdminPage title="Inventory" actions={<div className="flex gap-1 rounded-full border border-[var(--border)] p-1 text-xs"><button onClick={() => setTab("low")} className={`rounded-full px-3 py-1 ${tab === "low" ? "bg-ink-950 text-white dark:bg-white dark:text-ink-950" : ""}`}>Low stock</button><button onClick={() => setTab("logs")} className={`rounded-full px-3 py-1 ${tab === "logs" ? "bg-ink-950 text-white dark:bg-white dark:text-ink-950" : ""}`}>Activity log</button></div>}>
      {tab === "low" ? <LowStockTab /> : <LogsTab />}
    </AdminPage>
  );
}

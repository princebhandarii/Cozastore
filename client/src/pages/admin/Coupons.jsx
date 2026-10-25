import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { listCouponsApi, saveCouponApi, deleteCouponApi } from "../../services/adminService";
import { formatPrice } from "../../utils/formatPrice";
import AdminPage, { ErrorNote } from "../../components/admin/AdminPage";
import { input, btn, btnOutline, btnDanger } from "../../components/admin/ui";
import Modal from "../../components/admin/Modal";

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const emptyForm = { code: "", description: "", discountType: "percentage", discountValue: "", minimumOrderValue: "", maximumDiscount: "", expiryDate: "", usageLimit: "", perUserLimit: "1", isActive: true };

function CouponModal({ coupon, onClose, onSaved }) {
  const [form, setForm] = useState(coupon ? {
    code: coupon.code, description: coupon.description || "", discountType: coupon.discountType, discountValue: coupon.discountValue,
    minimumOrderValue: coupon.minimumOrderValue || "", maximumDiscount: coupon.maximumDiscount ?? "", expiryDate: toDateInput(coupon.expiryDate),
    usageLimit: coupon.usageLimit ?? "", perUserLimit: coupon.perUserLimit, isActive: coupon.isActive,
  } : emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await saveCouponApi(coupon?._id, {
        ...form,
        discountValue: Number(form.discountValue),
        minimumOrderValue: form.minimumOrderValue === "" ? 0 : Number(form.minimumOrderValue),
        maximumDiscount: form.maximumDiscount === "" ? null : Number(form.maximumDiscount),
        usageLimit: form.usageLimit === "" ? null : Number(form.usageLimit),
        perUserLimit: Number(form.perUserLimit),
      });
      onSaved();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return (
    <Modal title={coupon ? "Edit coupon" : "New coupon"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3 text-sm">
        {error && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">{error}</p>}
        <input className={input} placeholder="CODE" value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} required disabled={Boolean(coupon)} />
        <input className={input} placeholder="Description" value={form.description} onChange={(e) => set("description", e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <select className={input} value={form.discountType} onChange={(e) => set("discountType", e.target.value)}><option value="percentage">Percentage</option><option value="fixed">Fixed (₹)</option></select>
          <input className={input} type="number" placeholder={form.discountType === "percentage" ? "% off" : "₹ off"} value={form.discountValue} onChange={(e) => set("discountValue", e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className={input} type="number" placeholder="Min order (₹)" value={form.minimumOrderValue} onChange={(e) => set("minimumOrderValue", e.target.value)} />
          <input className={input} type="number" placeholder="Max discount (₹, optional)" value={form.maximumDiscount} onChange={(e) => set("maximumDiscount", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className={input} type="date" value={form.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} required />
          <input className={input} type="number" placeholder="Usage limit (blank = ∞)" value={form.usageLimit} onChange={(e) => set("usageLimit", e.target.value)} />
        </div>
        <input className={input} type="number" min="1" placeholder="Per-user limit" value={form.perUserLimit} onChange={(e) => set("perUserLimit", e.target.value)} required />
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} /> Active</label>
        <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={onClose} className={btnOutline}>Cancel</button><button disabled={saving} className={btn}>{saving ? "Saving..." : "Save"}</button></div>
      </form>
    </Modal>
  );
}

export default function Coupons() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(undefined);

  const load = useCallback(() => { setLoading(true); listCouponsApi().then(setItems).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);
  const remove = async (c) => { if (window.confirm(`Delete ${c.code}?`)) { try { await deleteCouponApi(c._id); load(); } catch (e) { setError(e.message); } } };

  return (
    <AdminPage title="Coupons" actions={<button onClick={() => setEditing(null)} className="flex items-center gap-1 rounded-full bg-ink-950 px-4 py-2 text-xs font-medium text-white dark:bg-white dark:text-ink-950"><Plus size={14} /> New coupon</button>}>
      <ErrorNote message={error} />
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--card)] text-xs text-[var(--muted)]"><tr><th className="p-3">Code</th><th className="p-3">Discount</th><th className="p-3">Min order</th><th className="p-3">Used</th><th className="p-3">Expires</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
          <tbody className="divide-y divide-[var(--border)]">
            {loading && <tr><td colSpan={7} className="p-6 text-center text-[var(--muted)]">Loading...</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-[var(--muted)]">No coupons yet.</td></tr>}
            {items.map((c) => (
              <tr key={c._id}>
                <td className="p-3 font-medium">{c.code}</td>
                <td className="p-3">{c.discountType === "percentage" ? `${c.discountValue}%` : formatPrice(c.discountValue)}{c.maximumDiscount && ` (max ${formatPrice(c.maximumDiscount)})`}</td>
                <td className="p-3">{formatPrice(c.minimumOrderValue)}</td>
                <td className="p-3">{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""}</td>
                <td className="p-3">{new Date(c.expiryDate).toLocaleDateString("en-IN")}</td>
                <td className="p-3">{c.isActive ? <span className="text-[var(--color-success)]">Active</span> : <span className="text-[var(--muted)]">Inactive</span>}</td>
                <td className="p-3"><div className="flex justify-end gap-2"><button onClick={() => setEditing(c)} className={btnOutline}><Pencil size={12} /></button><button onClick={() => remove(c)} className={btnDanger}><Trash2 size={12} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing !== undefined && <CouponModal coupon={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); }} />}
    </AdminPage>
  );
}

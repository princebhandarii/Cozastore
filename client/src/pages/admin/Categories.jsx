import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { adminListCategoriesApi, saveCategoryApi, deleteCategoryApi } from "../../services/adminService";
import AdminPage, { ErrorNote } from "../../components/admin/AdminPage";
import { input, btn, btnOutline, btnDanger } from "../../components/admin/ui";
import Modal from "../../components/admin/Modal";

function CategoryModal({ category, onClose, onSaved }) {
  const [name, setName] = useState(category?.name || "");
  const [description, setDescription] = useState(category?.description || "");
  const [image, setImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const fd = new FormData();
      fd.append("name", name); fd.append("description", description);
      if (image) fd.append("image", image);
      await saveCategoryApi(category?._id, fd);
      onSaved();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return (
    <Modal title={category ? "Edit category" : "New category"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3 text-sm">
        {error && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">{error}</p>}
        <input className={input} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <textarea className={input} rows={2} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        {category?.image && <img src={category.image} alt="" className="h-16 w-16 rounded-lg object-cover" />}
        <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files[0])} className="text-xs" />
        <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={onClose} className={btnOutline}>Cancel</button><button disabled={saving} className={btn}>{saving ? "Saving..." : "Save"}</button></div>
      </form>
    </Modal>
  );
}

export default function Categories() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(undefined);

  const load = useCallback(() => { setLoading(true); adminListCategoriesApi().then(setItems).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.name}"?`)) return;
    try { await deleteCategoryApi(c._id); load(); } catch (e) { setError(e.message); }
  };

  return (
    <AdminPage title="Categories" actions={<button onClick={() => setEditing(null)} className="flex items-center gap-1 rounded-full bg-ink-950 px-4 py-2 text-xs font-medium text-white dark:bg-white dark:text-ink-950"><Plus size={14} /> New category</button>}>
      <ErrorNote message={error} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading && Array.from({ length: 3 }, (_, i) => <div key={i} className="h-24 rounded-2xl skeleton" />)}
        {!loading && items.length === 0 && <p className="text-sm text-[var(--muted)]">No categories yet.</p>}
        {items.map((c) => (
          <div key={c._id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
            <div className="flex items-center gap-3">{c.image && <img src={c.image} alt="" className="h-12 w-12 rounded-lg object-cover" />}<div><p className="font-medium">{c.name}</p><p className="text-xs text-[var(--muted)]">{c.productCount} product(s){!c.isActive && " · hidden"}</p></div></div>
            <div className="mt-3 flex gap-2"><button onClick={() => setEditing(c)} className={btnOutline}><Pencil size={12} /></button><button onClick={() => remove(c)} className={btnDanger}><Trash2 size={12} /></button></div>
          </div>
        ))}
      </div>
      {editing !== undefined && <CategoryModal category={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); }} />}
    </AdminPage>
  );
}

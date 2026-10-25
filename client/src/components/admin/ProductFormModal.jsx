import { useEffect, useState } from "react";
import { adminGetProductApi, saveProductApi, adminListCategoriesApi } from "../../services/adminService";
import { input, btn, btnOutline } from "./ui";
import Modal from "./Modal";
import ImagePicker from "../ImagePicker";

const emptyVariant = { size: "", color: "", sku: "", price: "", stock: "" };

export default function ProductFormModal({ productId, onClose, onSaved }) {
  const isNew = productId === null;
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ name: "", description: "", shortDescription: "", brand: "", category: "", price: "", compareAtPrice: "", discount: "", stock: "", sku: "", isFeatured: false, isActive: true });
  const [variants, setVariants] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [removeUrls, setRemoveUrls] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { adminListCategoriesApi().then(setCategories); }, []);
  useEffect(() => {
    if (isNew) return;
    adminGetProductApi(productId).then((p) => {
      setForm({ name: p.name, description: p.description, shortDescription: p.shortDescription || "", brand: p.brand || "", category: p.category?._id || "", price: p.price, compareAtPrice: p.compareAtPrice || "", discount: p.discount || "", stock: p.stock, sku: p.sku, isFeatured: p.isFeatured, isActive: p.isActive });
      setVariants(p.variants.map((v) => ({ _id: v._id, size: v.size || "", color: v.color || "", sku: v.sku, price: v.price, stock: v.stock })));
      setExistingImages(p.images);
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [productId, isNew]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setVariant = (i, k, v) => setVariants((vs) => vs.map((row, j) => (j === i ? { ...row, [k]: v } : row)));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const fd = new FormData();
      for (const [k, v] of Object.entries(form)) fd.append(k, v);
      // Existing variants keep their _id (new ones have none): carts and orders reference variants by id.
      const cleanVariants = variants.filter((v) => v.sku && v.price !== "").map((v) => ({ ...v, price: Number(v.price), stock: Number(v.stock) || 0, size: v.size || null, color: v.color || null }));
      fd.append("variants", JSON.stringify(cleanVariants));
      if (removeUrls.length) fd.append("removeImageUrls", JSON.stringify(removeUrls));
      newImages.forEach((f) => fd.append("images", f));
      await saveProductApi(isNew ? null : productId, fd);
      onSaved();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return (
    <Modal title={isNew ? "New product" : "Edit product"} onClose={onClose} wide>
      {loading ? <div className="h-64 rounded-xl skeleton" /> : (
        <form onSubmit={submit} className="max-h-[75vh] space-y-3 overflow-y-auto pr-1 text-sm">
          {error && <p className="rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-xs text-[var(--color-danger)]">{error}</p>}
          <input className={input} placeholder="Name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
          <textarea className={input} rows={3} placeholder="Description" value={form.description} onChange={(e) => set("description", e.target.value)} required />
          <input className={input} placeholder="Short description" value={form.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className={input} placeholder="Brand" value={form.brand} onChange={(e) => set("brand", e.target.value)} />
            <select className={input} value={form.category} onChange={(e) => set("category", e.target.value)} required><option value="">Category</option>{categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <input className={input} type="number" placeholder="Price" value={form.price} onChange={(e) => set("price", e.target.value)} required />
            <input className={input} type="number" placeholder="Compare-at" value={form.compareAtPrice} onChange={(e) => set("compareAtPrice", e.target.value)} />
            <input className={input} type="number" placeholder="Discount %" value={form.discount} onChange={(e) => set("discount", e.target.value)} />
            <input className={input} type="number" placeholder="Stock" value={form.stock} onChange={(e) => set("stock", e.target.value)} required />
          </div>
          <input className={input} placeholder="SKU" value={form.sku} onChange={(e) => set("sku", e.target.value)} required />
          <div className="flex gap-4 text-xs"><label className="flex items-center gap-2"><input type="checkbox" checked={form.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} /> Featured</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} /> Active (visible in shop)</label></div>

          <div>
            <div className="mb-1 flex items-center justify-between"><p className="text-xs font-medium">Variants (optional)</p><button type="button" className={btnOutline} onClick={() => setVariants([...variants, { ...emptyVariant }])}>+ Add variant</button></div>
            {variants.map((v, i) => (
              <div key={i} className="mb-2 grid grid-cols-6 gap-1">
                <input className={input} placeholder="Size" value={v.size} onChange={(e) => setVariant(i, "size", e.target.value)} />
                <input className={input} placeholder="Color" value={v.color} onChange={(e) => setVariant(i, "color", e.target.value)} />
                <input className={input} placeholder="SKU" value={v.sku} onChange={(e) => setVariant(i, "sku", e.target.value)} />
                <input className={input} type="number" placeholder="Price" value={v.price} onChange={(e) => setVariant(i, "price", e.target.value)} />
                <input className={input} type="number" placeholder="Stock" value={v.stock} onChange={(e) => setVariant(i, "stock", e.target.value)} />
                <button type="button" onClick={() => setVariants(variants.filter((_, j) => j !== i))} className="text-xs text-[var(--color-danger)]">Remove</button>
              </div>
            ))}
          </div>

          <div>
            <p className="mb-1 text-xs font-medium">Images</p>
            {existingImages.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {existingImages.filter((img) => !removeUrls.includes(img.url)).map((img) => (
                  <div key={img.url} className="relative h-16 w-16 overflow-hidden rounded-lg border border-[var(--border)]">
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setRemoveUrls([...removeUrls, img.url])} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 px-1 text-[10px] text-white">×</button>
                  </div>
                ))}
              </div>
            )}
            <ImagePicker files={newImages} setFiles={setNewImages} max={6} onError={setError} />
          </div>

          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={onClose} className={btnOutline}>Cancel</button><button disabled={saving} className={btn}>{saving ? "Saving..." : "Save product"}</button></div>
        </form>
      )}
    </Modal>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { listAdminReviewsApi, setReviewStatusApi, adminDeleteReviewApi } from "../../services/adminService";

export default function AdminReviews() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    listAdminReviewsApi({ status: status || undefined, limit: 50 }).then((r) => setItems(r.data)).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn) => { setError(""); try { await fn(); await load(); } catch (e) { setError(e.message); } };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link to="/admin" className="text-xs text-[var(--muted)] underline">← Admin</Link>
      <h1 className="mt-2 font-display text-3xl font-semibold">Reviews</h1>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-6 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm">
        <option value="">All</option><option value="PUBLISHED">Published</option><option value="HIDDEN">Hidden</option>
      </select>
      {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
      <div className="mt-4 space-y-3">
        {loading && <div className="h-20 rounded-xl skeleton" />}
        {!loading && items.length === 0 && <p className="text-sm text-[var(--muted)]">No reviews.</p>}
        {items.map((r) => (
          <div key={r._id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className="inline-flex">{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={13} className={n <= r.rating ? "fill-current" : "text-[var(--border)]"} />)}</span>
                <Link to={`/product/${r.product?.slug}`} className="font-medium underline">{r.product?.name}</Link>
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${r.status === "PUBLISHED" ? "bg-[var(--color-success)]/10 text-[var(--color-success)]" : "bg-[var(--border)] text-[var(--muted)]"}`}>{r.status.toLowerCase()}</span>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">{r.user?.name || r.user?.email} · {new Date(r.createdAt).toLocaleDateString("en-IN")}</p>
            {r.comment && <p className="mt-2 whitespace-pre-line">{r.comment}</p>}
            {r.images?.length > 0 && <div className="mt-2 flex gap-2">{r.images.map((img) => <a key={img.url} href={img.url} target="_blank" rel="noreferrer noopener"><img src={img.url} alt="" className="h-14 w-14 rounded-lg object-cover" /></a>)}</div>}
            <div className="mt-3 flex gap-2">
              <button onClick={() => act(() => setReviewStatusApi(r._id, r.status === "PUBLISHED" ? "HIDDEN" : "PUBLISHED"))} className="rounded-full border border-[var(--border)] px-4 py-1 text-xs">{r.status === "PUBLISHED" ? "Hide" : "Publish"}</button>
              <button onClick={() => window.confirm("Delete this review permanently?") && act(() => adminDeleteReviewApi(r._id))} className="rounded-full border border-[var(--color-danger)] px-4 py-1 text-xs text-[var(--color-danger)]">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

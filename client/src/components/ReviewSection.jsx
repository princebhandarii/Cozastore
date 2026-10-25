import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { Star, BadgeCheck } from "lucide-react";
import { listReviewsApi, canReviewApi, createReviewApi, deleteReviewApi } from "../services/returnService";
import ImagePicker from "./ImagePicker";

const Stars = ({ value, size = 14 }) => (
  <span className="inline-flex">{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} className={n <= Math.round(value) ? "fill-current" : "text-[var(--border)]"} />)}</span>
);

export default function ReviewSection({ productId, onChanged }) {
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);
  const [reviews, setReviews] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (p = 1, replace = true) => {
    setLoading(true);
    try {
      const res = await listReviewsApi(productId, { page: p, limit: 5 });
      setReviews((prev) => (replace ? res.data : [...prev, ...res.data]));
      setMeta(res.meta);
      setPage(p);
    } finally { setLoading(false); }
  }, [productId]);

  const loadEligibility = useCallback(() => {
    if (isAuthenticated) canReviewApi(productId).then(setEligibility).catch(() => setEligibility(null));
    else setEligibility(null);
  }, [productId, isAuthenticated]);

  useEffect(() => { load(1); }, [load, isAuthenticated]);
  useEffect(() => { loadEligibility(); }, [loadEligibility]);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError("");
    try {
      await createReviewApi({ productId, rating, comment, images: files });
      setRating(0); setComment(""); setFiles([]);
      await Promise.all([load(1), loadEligibility()]);
      onChanged?.();
    } catch (err) { setError(err.message); } finally { setSubmitting(false); }
  };

  const remove = async (id) => {
    await deleteReviewApi(id);
    await Promise.all([load(1), loadEligibility()]);
    onChanged?.();
  };

  return (
    <section id="reviews" className="mt-14 border-t border-[var(--border)] pt-10">
      <h2 className="font-display text-xl font-semibold">Customer reviews</h2>

      {meta && meta.total > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-8">
          <div><p className="text-3xl font-semibold">{meta.average?.toFixed(1)}</p><Stars value={meta.average} size={16} /><p className="mt-1 text-xs text-[var(--muted)]">{meta.total} review{meta.total === 1 ? "" : "s"}</p></div>
          <div className="w-56 space-y-1">
            {[5, 4, 3, 2, 1].map((n) => (
              <div key={n} className="flex items-center gap-2 text-xs">
                <span className="w-3">{n}</span>
                <div className="h-1.5 flex-1 rounded-full bg-[var(--border)]"><div className="h-full rounded-full bg-ink-950 dark:bg-white" style={{ width: `${meta.total ? (meta.distribution[n] / meta.total) * 100 : 0}%` }} /></div>
                <span className="w-5 text-right text-[var(--muted)]">{meta.distribution[n]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        {!isAuthenticated ? (
          <p className="text-sm text-[var(--muted)]"><Link to="/login" className="underline">Sign in</Link> to write a review.</p>
        ) : eligibility?.canReview ? (
          <form onSubmit={submit} className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <p className="text-sm font-medium">Write a review</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button type="button" key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}><Star size={22} className={n <= rating ? "fill-current" : "text-[var(--border)]"} /></button>
              ))}
            </div>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={3} placeholder="Share your experience (optional)" className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm" />
            <ImagePicker files={files} setFiles={setFiles} max={3} onError={setError} />
            {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
            <button disabled={submitting || rating === 0} className="rounded-full bg-ink-950 px-6 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-ink-950">{submitting ? "Posting..." : "Post review"}</button>
          </form>
        ) : eligibility ? (
          <p className="text-xs text-[var(--muted)]">{eligibility.reason}</p>
        ) : null}
      </div>

      <div className="mt-6 space-y-5">
        {loading && reviews.length === 0 && <div className="h-20 rounded-xl skeleton" />}
        {!loading && reviews.length === 0 && <p className="text-sm text-[var(--muted)]">No reviews yet.</p>}
        {reviews.map((r) => (
          <article key={r._id} className="border-b border-[var(--border)] pb-5 text-sm">
            <div className="flex items-center gap-2"><Stars value={r.rating} /><span className="font-medium">{r.author}</span><span className="flex items-center gap-1 text-xs text-[var(--color-success)]"><BadgeCheck size={13} /> Verified purchase</span></div>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{new Date(r.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>
            {r.comment && <p className="mt-2 whitespace-pre-line">{r.comment}</p>}
            {r.images?.length > 0 && <div className="mt-2 flex gap-2">{r.images.map((img) => <a key={img.url} href={img.url} target="_blank" rel="noreferrer noopener"><img src={img.url} alt="" className="h-16 w-16 rounded-lg object-cover" /></a>)}</div>}
            {r.mine && <button onClick={() => remove(r._id)} className="mt-2 text-xs text-[var(--color-danger)] underline">Delete my review</button>}
          </article>
        ))}
        {meta && page < meta.pages && <button onClick={() => load(page + 1, false)} className="rounded-full border border-[var(--border)] px-5 py-2 text-sm">Load more</button>}
      </div>
    </section>
  );
}

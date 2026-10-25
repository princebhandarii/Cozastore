export default function AdminPage({ title, subtitle, actions, children }) {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

export const Pager = ({ meta, page, setPage }) =>
  meta && meta.pages > 1 ? (
    <div className="mt-4 flex items-center gap-2 text-xs">
      <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-full border border-[var(--border)] px-4 py-1.5 disabled:opacity-50">Prev</button>
      <span>Page {meta.page} of {meta.pages}</span>
      <button disabled={page >= meta.pages} onClick={() => setPage(page + 1)} className="rounded-full border border-[var(--border)] px-4 py-1.5 disabled:opacity-50">Next</button>
    </div>
  ) : null;

export const ErrorNote = ({ message }) =>
  message ? <p className="mb-3 rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{message}</p> : null;

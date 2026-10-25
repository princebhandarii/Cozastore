// Shown while a lazy-loaded route chunk (currently: the whole /admin area)
// is being fetched. Kept tiny and dependency-free since it's part of the
// critical path for that chunk.
export default function RouteLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-300 border-t-ink-950 dark:border-ink-700 dark:border-t-white" />
    </div>
  );
}

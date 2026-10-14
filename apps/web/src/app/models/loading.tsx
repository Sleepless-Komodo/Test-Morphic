export default function ModelsLoading() {
  const shimmer = 'rounded-2xl bg-neutral-200/60 motion-safe:animate-pulse';

  return (
    <main className="min-h-screen bg-[#fafafa] px-4 sm:px-6 pt-24 sm:pt-28 pb-20" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading catalog…</span>

      {/* Floating Navbar Placeholder */}
      <div className="mx-auto mb-12 h-12 w-full max-w-5xl rounded-full bg-neutral-200/40 motion-safe:animate-pulse" />

      {/* Header Skeleton */}
      <div className="mx-auto max-w-5xl space-y-4 mb-10 text-center sm:text-left">
        <div className="h-6 w-36 rounded-full bg-neutral-200/60 motion-safe:animate-pulse" />
        <div className="h-10 sm:h-12 w-80 max-w-full rounded-2xl bg-neutral-200/70 motion-safe:animate-pulse" />
        <div className="h-4 w-96 max-w-full rounded-md bg-neutral-200/50 motion-safe:animate-pulse" />
      </div>

      {/* Search & Provider Filter Bar Skeleton */}
      <div className="mx-auto max-w-5xl mb-10 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="h-12 w-full sm:w-80 rounded-full bg-neutral-200/50 motion-safe:animate-pulse" />
        <div className="flex gap-2 w-full sm:w-auto overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 w-20 rounded-full bg-neutral-200/40 motion-safe:animate-pulse shrink-0" />
          ))}
        </div>
      </div>

      {/* Models Grid Skeleton (6 cards) */}
      <div className="mx-auto max-w-5xl grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-neutral-200/80 bg-white p-6 space-y-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="h-9 w-9 rounded-xl bg-neutral-200/60 motion-safe:animate-pulse" />
              <div className="h-5 w-16 rounded-full bg-neutral-200/50 motion-safe:animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className={`${shimmer} h-6 w-36`} />
              <div className={`${shimmer} h-3.5 w-48`} />
            </div>
            <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
              <div className="space-y-1">
                <div className="h-3 w-16 bg-neutral-200/40 rounded motion-safe:animate-pulse" />
                <div className="h-4 w-20 bg-neutral-200/60 rounded motion-safe:animate-pulse" />
              </div>
              <div className="h-8 w-20 rounded-full bg-neutral-900/10 motion-safe:animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

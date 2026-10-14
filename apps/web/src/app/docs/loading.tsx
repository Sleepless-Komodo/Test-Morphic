export default function DocsLoading() {
  const shimmer = 'rounded-xl bg-neutral-200/60 motion-safe:animate-pulse';

  return (
    <main className="min-h-screen bg-[#fafafa] pt-24 sm:pt-28 pb-20" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading documentation…</span>

      {/* Floating Navbar Placeholder */}
      <div className="mx-auto mb-10 h-12 w-full max-w-7xl px-4 sm:px-6">
        <div className="h-12 w-full rounded-full bg-neutral-200/40 motion-safe:animate-pulse" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-12">
        {/* Left Sidebar Skeleton (Desktop only) */}
        <div className="hidden lg:block space-y-6">
          <div className={`${shimmer} h-5 w-28`} />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className={`${shimmer} h-7 w-full rounded-lg`} />
            ))}
          </div>
          <div className={`${shimmer} h-5 w-32 mt-8`} />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`${shimmer} h-7 w-full rounded-lg`} />
            ))}
          </div>
        </div>

        {/* Main Content Area Skeleton */}
        <div className="space-y-8 max-w-3xl">
          <div className="space-y-3">
            <div className="h-5 w-36 rounded-full bg-neutral-200/50 motion-safe:animate-pulse" />
            <div className={`${shimmer} h-10 w-96 max-w-full`} />
            <div className={`${shimmer} h-4 w-full`} />
            <div className={`${shimmer} h-4 w-4/5`} />
          </div>

          {/* Quickstart Tabs Skeleton */}
          <div className="flex gap-2 border-b border-neutral-200/70 pb-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-24 rounded-lg bg-neutral-200/50 motion-safe:animate-pulse" />
            ))}
          </div>

          {/* Code Block Skeleton */}
          <div className="rounded-2xl bg-neutral-900 p-6 space-y-3 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="h-4 w-28 rounded bg-neutral-800 motion-safe:animate-pulse" />
              <div className="h-6 w-16 rounded bg-neutral-800 motion-safe:animate-pulse" />
            </div>
            <div className="h-4 w-3/4 rounded bg-neutral-800 motion-safe:animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-neutral-800 motion-safe:animate-pulse" />
            <div className="h-4 w-5/6 rounded bg-neutral-800 motion-safe:animate-pulse" />
            <div className="h-4 w-2/3 rounded bg-neutral-800 motion-safe:animate-pulse" />
          </div>

          {/* Additional text lines */}
          <div className="space-y-3 pt-4">
            <div className={`${shimmer} h-6 w-48`} />
            <div className={`${shimmer} h-4 w-full`} />
            <div className={`${shimmer} h-4 w-11/12`} />
          </div>
        </div>
      </div>
    </main>
  );
}

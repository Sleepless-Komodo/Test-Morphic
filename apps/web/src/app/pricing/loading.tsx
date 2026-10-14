export default function PricingLoading() {
  const shimmer = 'rounded-2xl bg-neutral-200/60 motion-safe:animate-pulse';

  return (
    <main className="min-h-screen bg-[#fafafa] px-4 sm:px-6 pt-24 sm:pt-28 pb-20" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading pricing…</span>

      {/* Floating Navbar Placeholder */}
      <div className="mx-auto mb-16 h-12 w-full max-w-5xl rounded-full bg-neutral-200/40 motion-safe:animate-pulse" />

      {/* Title & Toggle Skeleton */}
      <div className="mx-auto max-w-4xl text-center space-y-4 mb-16">
        <div className="mx-auto h-6 w-32 rounded-full bg-neutral-200/60 motion-safe:animate-pulse" />
        <div className="mx-auto h-12 w-80 sm:w-96 rounded-2xl bg-neutral-200/70 motion-safe:animate-pulse" />
        <div className="mx-auto h-4 w-64 max-w-full rounded-md bg-neutral-200/50 motion-safe:animate-pulse" />
        <div className="mx-auto mt-6 h-11 w-64 rounded-full bg-neutral-200/50 motion-safe:animate-pulse" />
      </div>

      {/* Cards & Details Two-Column Stage */}
      <div className="mx-auto max-w-5xl grid gap-8 lg:grid-cols-2 items-center">
        {/* Pass Card Skeleton */}
        <div className="relative aspect-[1.586/1] w-full rounded-[22px] bg-[#0a0a0a]/90 p-6 sm:p-7 flex flex-col justify-between shadow-2xl border border-white/10">
          <div className="flex items-center justify-between">
            <div className="h-8 w-24 rounded-lg bg-white/10 motion-safe:animate-pulse" />
            <div className="h-5 w-20 rounded-full bg-white/10 motion-safe:animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-10 w-44 rounded-lg bg-white/15 motion-safe:animate-pulse" />
            <div className="h-4 w-28 rounded-md bg-white/10 motion-safe:animate-pulse" />
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <div className="h-5 w-28 rounded-md bg-white/15 motion-safe:animate-pulse" />
            <div className="h-5 w-20 rounded-md bg-white/10 motion-safe:animate-pulse" />
          </div>
        </div>

        {/* Right Feature Panel Skeleton */}
        <div className="space-y-6">
          <div className="space-y-2">
            <div className={`${shimmer} h-8 w-44`} />
            <div className={`${shimmer} h-12 w-64`} />
            <div className={`${shimmer} h-4 w-full max-w-sm`} />
          </div>
          <div className="space-y-3 pt-4 border-t border-neutral-200/70">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full bg-neutral-200/70 motion-safe:animate-pulse shrink-0" />
                <div className={`${shimmer} h-4 w-3/4`} />
              </div>
            ))}
          </div>
          <div className="h-12 w-48 rounded-full bg-neutral-900/10 motion-safe:animate-pulse mt-4" />
        </div>
      </div>
    </main>
  );
}

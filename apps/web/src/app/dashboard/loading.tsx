// Shown instantly on navigation while the page's server data loads, so a click never feels stuck.
export default function DashboardLoading() {
  const block = 'rounded-2xl bg-neutral-200/60 motion-safe:animate-pulse';
  return (
    <div className="w-full space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2 border-b border-neutral-200/70 pb-4">
        <div className={`${block} h-8 w-56`} />
        <div className={`${block} h-4 w-80 max-w-full`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className={`${block} h-28`} />
        <div className={`${block} h-28`} />
        <div className={`${block} h-28`} />
      </div>
      <div className={`${block} h-72`} />
    </div>
  );
}

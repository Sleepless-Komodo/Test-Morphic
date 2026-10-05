// Short-lived in-process cache for admin aggregates. Every open admin tab auto-refreshes, so
// without this N tabs/admins = N copies of the same heavy queries. Concurrent callers for the
// same key share one in-flight promise; results live `ttlMs`. Values are kept as-is (Dates stay
// Dates), unlike unstable_cache which JSON-serializes.
// ponytail: per server instance, so on serverless each warm instance has its own copy. Move to
// Redis (already in the stack) if admin traffic ever spans many instances.

const MAX_ENTRIES = 300;
const store = new Map<string, { at: number; ttl: number; value: Promise<unknown> }>();

export function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && now - hit.at < hit.ttl) return hit.value as Promise<T>;

  const value = fn();
  store.delete(key); // re-insert so Map order stays oldest-first for eviction
  store.set(key, { at: now, ttl: ttlMs, value });
  // Failures are not cached: the next caller retries.
  value.catch(() => {
    if (store.get(key)?.value === value) store.delete(key);
  });
  if (store.size > MAX_ENTRIES) {
    // Map keeps insertion order, so the first keys are the oldest.
    for (const k of store.keys()) {
      store.delete(k);
      if (store.size <= MAX_ENTRIES) break;
    }
  }
  return value;
}

/** Drop cached entries whose key starts with `prefix` (after a write that changes them). */
export function invalidate(prefix: string) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}

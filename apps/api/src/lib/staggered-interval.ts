const MAX_TIMER_MS = 2 ** 31 - 1;

/**
 * Runs `fn` every `intervalMs`, with the whole schedule shifted by `offsetMs` so jobs do not all
 * open database connections in the same instant. Due times are counted from the start: `setInterval`
 * counts from the last tick, so it slips a little each time and the offsets would wear away.
 * Ticks missed while the process was frozen are skipped, not replayed.
 */
export function setStaggeredInterval(
  fn: () => void,
  intervalMs: number,
  offsetMs: number,
  now: () => number = () => performance.now(),
): void {
  const start = now() + offsetMs;
  let due = start + intervalMs;

  const arm = () => {
    const wait = Math.max(1, Math.ceil(due - now()));
    if (wait > MAX_TIMER_MS) {
      setTimeout(arm, MAX_TIMER_MS).unref();
      return;
    }
    setTimeout(() => {
      const elapsedTicks = Math.floor((now() - start) / intervalMs);
      due = Math.max(due + intervalMs, start + (elapsedTicks + 1) * intervalMs);
      arm();
      fn();
    }, wait).unref();
  };
  arm();
}

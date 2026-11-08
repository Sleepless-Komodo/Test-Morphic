/**
 * Pure helpers that keep client-controlled parameters from multiplying upstream work
 * beyond what the credit reservation covers. No I/O, no DB imports.
 */

export type GuardResult =
  | { ok: true }
  | { ok: false; code: 'unsupported_parameter'; message: string };

/** `n` and `best_of` multiply upstream generation but are not reflected in the reservation. */
export function rejectMultiplierParams(body: Record<string, unknown>): GuardResult {
  for (const key of ['n', 'best_of'] as const) {
    const value = body[key];
    if (value !== undefined && value !== null && value !== 1) {
      return { ok: false, code: 'unsupported_parameter', message: `${key} is not supported; only 1 is allowed` };
    }
  }
  return { ok: true };
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Effective output cap the reservation must cover: the smaller of the two fields that are present. */
export function requestedOutputCap(body: Record<string, unknown>): number | null {
  const caps = [positiveNumber(body.max_tokens), positiveNumber(body.max_completion_tokens)].filter(
    (v): v is number => v !== undefined,
  );
  return caps.length > 0 ? Math.min(...caps) : null;
}

/**
 * When a client sends both output-cap fields with different values, upstream may honour either one.
 * Make them identical (the smaller) so the reservation always covers what upstream may generate.
 * Returns the same object when nothing needs to change.
 */
export function unifyOutputCap<T extends Record<string, unknown>>(body: T): T {
  const maxTokens = positiveNumber(body.max_tokens);
  const maxCompletion = positiveNumber(body.max_completion_tokens);
  if (maxTokens === undefined || maxCompletion === undefined || maxTokens === maxCompletion) return body;
  const cap = Math.min(maxTokens, maxCompletion);
  return { ...body, max_tokens: cap, max_completion_tokens: cap };
}

/** Remove parameters that must never reach an upstream provider. */
export function stripMultiplierParams(payload: Record<string, unknown>): void {
  delete payload.n;
  delete payload.best_of;
}

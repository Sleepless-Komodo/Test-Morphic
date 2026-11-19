/**
 * Admin panel step-up (email OTP) rules.
 *
 * A verified admin session stays trusted while the admin keeps using the panel: the marker row
 * expires 24 hours after the last admin activity, and activity pushes that expiry forward (at
 * most once every 5 minutes, to keep writes off the hot path). A request from a different
 * country than the one at verification asks for the code again, a return to Indonesia included.
 */

export const ADMIN_STEP_UP_IDLE_MS = 24 * 60 * 60 * 1000;
export const ADMIN_STEP_UP_BUMP_MS = 5 * 60 * 1000;

const VALUE_PREFIX = 'verified';
/** Rows written before the 24h rule hold the bare word, with no timestamp or country. */
const LEGACY_VALUE = VALUE_PREFIX;

export function formatStepUpValue(lastBumpMs: number, country: string | null): string {
  return `${VALUE_PREFIX}:${lastBumpMs}:${country ?? '-'}`;
}

export function parseStepUpValue(value: string): { lastBumpMs: number; country: string | null } | null {
  if (value === LEGACY_VALUE) return { lastBumpMs: 0, country: null };
  const [prefix, rawMs, rawCountry, ...rest] = value.split(':');
  if (prefix !== VALUE_PREFIX || rest.length > 0 || !rawMs || !/^\d+$/.test(rawMs)) return null;
  const country = rawCountry && rawCountry !== '-' ? rawCountry : null;
  return { lastBumpMs: Number(rawMs), country };
}

export interface AdminStepUpDecision {
  required: boolean;
  reason: 'no_row' | 'expired' | 'country_changed' | 'ok';
  bump: boolean;
  storedCountry: string | null;
}

export function evaluateAdminStepUp(input: {
  row: { value: string; expiresAt: Date } | null;
  nowMs: number;
  country: string | null;
}): AdminStepUpDecision {
  const { row, nowMs, country } = input;
  if (!row) return { required: true, reason: 'no_row', bump: false, storedCountry: null };
  if (row.expiresAt.getTime() <= nowMs) {
    return { required: true, reason: 'expired', bump: false, storedCountry: null };
  }
  const parsed = parseStepUpValue(row.value);
  if (!parsed) return { required: true, reason: 'no_row', bump: false, storedCountry: null };
  // An undetected country skips the check: a missing geo header must not lock the admin in a loop.
  // Legacy rows never recorded a country; they pass once and get rewritten with one on the bump.
  const legacy = row.value === LEGACY_VALUE;
  if (country && !legacy && country !== parsed.country) {
    return { required: true, reason: 'country_changed', bump: false, storedCountry: parsed.country };
  }
  return {
    required: false,
    reason: 'ok',
    bump: nowMs - parsed.lastBumpMs >= ADMIN_STEP_UP_BUMP_MS,
    storedCountry: parsed.country,
  };
}

function normalizeCountry(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || code === 'XX' || code === 'T1') return null;
  return code;
}

function geoJsonCountry(raw: string): string | null {
  const decoders: Array<(v: string) => string> = [(v) => atob(v), (v) => v, (v) => decodeURIComponent(v)];
  for (const decode of decoders) {
    try {
      const parsed = JSON.parse(decode(raw)) as { country?: { code?: unknown } } | null;
      const code = normalizeCountry(parsed?.country?.code);
      if (code) return code;
    } catch {
      // Not this encoding; try the next one.
    }
  }
  return null;
}

/**
 * Country of the request as Netlify's edge resolved it from the client IP: `x-nf-geo` (JSON,
 * normally base64) first, then `x-country`. Returns null when neither yields a valid ISO code.
 */
export function parseGeoCountry(headers: Pick<Headers, 'get'>): string | null {
  const geo = headers.get('x-nf-geo');
  const fromGeo = geo ? geoJsonCountry(geo) : null;
  return fromGeo ?? normalizeCountry(headers.get('x-country'));
}

/**
 * Where to send the admin after verifying: a same-site path inside the admin panel, never the
 * verify page itself. Anything else falls back to `/admin`.
 */
export function safeAdminNextPath(raw: string | null | undefined): string {
  const fallback = '/admin';
  if (!raw || raw.includes('\\')) return fallback;
  const pathOnly = raw.split(/[?#]/, 1)[0]!;
  if (pathOnly !== '/admin' && !pathOnly.startsWith('/admin/')) return fallback;
  if (pathOnly.split('/').some((segment) => segment === '..' || segment === '.')) return fallback;
  if (pathOnly === '/admin/verify' || pathOnly.startsWith('/admin/verify/')) return fallback;
  return raw;
}

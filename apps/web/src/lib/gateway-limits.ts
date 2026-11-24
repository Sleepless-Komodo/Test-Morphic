/**
 * Limits every account gets, whichever package it bought. The pricing page, the keys page and the
 * `/api/backend` proxy read them from here so the numbers shown never drift from each other.
 *
 * The gateway enforces its own copies: `MAX_API_KEYS_PER_USER` in `apps/api/src/handlers/keys.ts`,
 * the other two in `gatewayGuards({ rpm, concurrency })` in `apps/api/src/routes/v1.ts`.
 * Change them together.
 */
export const MAX_API_KEYS_PER_USER = 5;
export const GATEWAY_RPM_PER_KEY = 120;
export const GATEWAY_CONCURRENT_REQUESTS_PER_KEY = 5;

/** The three limits in the shape `billing-format` takes. */
export const GATEWAY_LIMITS = {
  maxKeys: MAX_API_KEYS_PER_USER,
  rpmPerKey: GATEWAY_RPM_PER_KEY,
  concurrentPerKey: GATEWAY_CONCURRENT_REQUESTS_PER_KEY,
} as const;

/**
 * Where to send a user after sign-in. `next` comes from the address bar, so only a plain
 * same-site path is accepted; anything else falls back to the dashboard. Pure, no imports,
 * so both server and client code can use it.
 */

export const DEFAULT_NEXT_PATH = '/dashboard';

const MAX_NEXT_LENGTH = 512;
const PLACEHOLDER_ORIGIN = 'http://morphic.local';
const AUTH_PAGE_PREFIXES = ['/login', '/forgot-password', '/reset-password', '/api'];

const CONTROL_OR_BACKSLASH = /[\\\u0000-\u001f\u007f]/;

function isAuthPage(pathname: string): boolean {
  return AUTH_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Returns `raw` as a normalised same-site path (with query), or `fallback` if it is not one. */
export function safeNextPath(raw: string | null | undefined, fallback: string = DEFAULT_NEXT_PATH): string {
  if (!raw || raw.length > MAX_NEXT_LENGTH) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (CONTROL_OR_BACKSLASH.test(raw)) return fallback;

  let url: URL;
  try {
    url = new URL(raw, PLACEHOLDER_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
  if (isAuthPage(url.pathname)) return fallback;

  // Next.js adds `_rsc` to in-app navigation requests; it is not part of the page address.
  if (url.searchParams.has('_rsc')) url.searchParams.delete('_rsc');
  return url.pathname + url.search;
}

/** `path?next=…` unless `next` is the default destination, which every sign-in lands on anyway. */
export function withNext(path: string, next: string | null | undefined): string {
  const safe = safeNextPath(next, DEFAULT_NEXT_PATH);
  return safe === DEFAULT_NEXT_PATH ? path : `${path}?next=${encodeURIComponent(safe)}`;
}

/** `/login` that returns to the page the user was on, or plain `/login` when there is nothing to return to. */
export function loginUrl(currentPath?: string | null): string {
  return withNext('/login', currentPath);
}

/** Reads `?next=` from the current address. Browser only, call it from event handlers, not during render. */
export function nextPathFromLocation(): string {
  return safeNextPath(new URLSearchParams(window.location.search).get('next'));
}

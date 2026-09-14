/**
 * Secure Backend API Client for Morphic
 * Handles both server-side (forwarding Next.js session cookies)
 * and client-side (with credentials: 'include') requests to Hono API (port 8787).
 */

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

export async function fetchBackendApi<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const isServer = typeof window === 'undefined';
  const baseUrl = (
    (isServer ? process.env.INTERNAL_API_URL : undefined) ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8787'
  ).replace(/\/+$/, '');

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.method && options.method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }

  // If executing on the server (Server Component or Server Action), forward session cookie
  if (isServer) {
    try {
      const { headers: getNextHeaders } = await import('next/headers');
      const reqHeaders = await getNextHeaders();
      const cookie = reqHeaders.get('cookie');
      if (cookie && !headers.has('cookie')) {
        headers.set('cookie', cookie);
      }
    } catch {
      // In contexts where next/headers is not available, proceed without throwing
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const res = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
      credentials: isServer ? undefined : 'include',
      cache: options.cache || 'no-store',
    });

    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || '';
    let json: any = null;
    if (contentType.includes('application/json')) {
      json = await res.json();
    } else {
      const text = await res.text();
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
    }

    if (!res.ok) {
      const errorMsg =
        json?.error?.message ||
        json?.message ||
        `Backend API returned status ${res.status}`;
      return { data: null, error: errorMsg, status: res.status };
    }

    return { data: json as T, error: null, status: res.status };
  } catch (err: any) {
    const errorMsg =
      err?.name === 'AbortError'
        ? 'Request timeout to backend API'
        : err?.message || 'Failed to connect to backend API';
    return { data: null, error: errorMsg, status: 0 };
  }
}

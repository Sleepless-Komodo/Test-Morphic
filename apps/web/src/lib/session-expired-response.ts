import { NextRequest, NextResponse } from 'next/server';
import { getCookies } from 'better-auth/cookies';
import { auth } from '@/lib/auth';

/** `error.code` the browser helper and the checkout poller treat as "sign in again". */
export const SESSION_EXPIRED_CODE = 'session_expired';

type CookieToExpire = { name: string; attributes: ReturnType<typeof getCookies>['sessionData']['attributes'] };

/** Better Auth may split the signed cache cookies into `name.0`, `name.1`, … when they are large. */
function chunkedCookiesOf(req: NextRequest, base: CookieToExpire): CookieToExpire[] {
  return req.cookies
    .getAll()
    .filter((cookie) => cookie.name.startsWith(`${base.name}.`))
    .map((cookie) => ({ name: cookie.name, attributes: base.attributes }));
}

function sessionCookiesToExpire(req: NextRequest): CookieToExpire[] {
  const { sessionToken, sessionData, accountData, dontRememberToken } = getCookies(auth.options);
  return [
    sessionToken,
    sessionData,
    accountData,
    dontRememberToken,
    ...chunkedCookiesOf(req, sessionData),
    ...chunkedCookiesOf(req, accountData),
  ];
}

/**
 * 401 for a session the server no longer accepts. It also expires the session cookies, so a stale
 * signed cache cookie cannot make /login believe the user is still signed in.
 */
export function sessionExpiredResponse(req: NextRequest): NextResponse {
  const response = NextResponse.json(
    { error: { message: 'Session expired. Sign in again.', code: SESSION_EXPIRED_CODE } },
    { status: 401 },
  );

  for (const { name, attributes } of sessionCookiesToExpire(req)) {
    response.cookies.set({
      name,
      value: '',
      maxAge: 0,
      path: attributes.path ?? '/',
      domain: attributes.domain,
      httpOnly: attributes.httpOnly,
      secure: attributes.secure,
      sameSite: attributes.sameSite?.toLowerCase() as 'lax' | 'strict' | 'none' | undefined,
    });
  }
  return response;
}

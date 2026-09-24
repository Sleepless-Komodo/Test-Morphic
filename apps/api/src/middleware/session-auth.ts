import type { Context, Next } from 'hono';
import { db, schema as s } from '@morphic/db';
import { eq, and, gt, or } from 'drizzle-orm';

export interface AuthedSession {
  userId: string;
  sessionId: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    userSession: AuthedSession;
  }
}

/** Session authentication for user-facing management routes (API keys, account balance/usage) */
export async function sessionAuth(c: Context, next: Next) {
  const authHeader = c.req.header('authorization');
  let rawToken: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    rawToken = authHeader.slice('Bearer '.length).trim();
  } else {
    // Cookie fallbacks (Better Auth session cookies - secure or standard)
    const cookies = c.req.header('cookie');
    if (cookies) {
      const match = cookies.match(/(?:__Secure-)?(?:better-auth\.session_token|session_token)=([^;]+)/);
      if (match) {
        rawToken = decodeURIComponent(match[1]).trim();
      }
    }
  }

  if (!rawToken) {
    return c.json(
      { error: { message: 'unauthorized: session token required', type: 'auth_error', code: 'missing_session_token' } },
      401,
    );
  }

  const unsignedToken = rawToken.includes('.') ? rawToken.split('.')[0] : rawToken;

  const [session] = await db
    .select({
      id: s.sessions.id,
      userId: s.sessions.userId,
      expiresAt: s.sessions.expiresAt,
      suspended: s.users.suspended,
    })
    .from(s.sessions)
    .innerJoin(s.users, eq(s.sessions.userId, s.users.id))
    .where(
      and(
        or(eq(s.sessions.token, rawToken), eq(s.sessions.token, unsignedToken!)),
        gt(s.sessions.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!session) {
    return c.json(
      { error: { message: 'invalid or expired session token', type: 'auth_error', code: 'invalid_session_token' } },
      401,
    );
  }

  if (session.suspended) {
    return c.json(
      { error: { message: 'account suspended', type: 'auth_error', code: 'account_suspended' } },
      403,
    );
  }

  c.set('userSession', { userId: session.userId, sessionId: session.id });
  await next();
}

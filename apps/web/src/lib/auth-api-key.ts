import { createAuthEndpoint, APIError } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import { db, schema as s } from '@morphic/db';
import { eq, and } from 'drizzle-orm';
import { hashApiKey } from '@morphic/shared/keys';
import { z } from 'zod';
import type { BetterAuthPlugin } from 'better-auth';

export const apiKeyAuth = (): BetterAuthPlugin => {
  return {
    id: 'api-key-auth',
    endpoints: {
      signInApiKey: createAuthEndpoint(
        '/sign-in/api-key',
        {
          method: 'POST',
          body: z.object({
            apiKey: z.string().min(5),
          }),
        },
        async (ctx) => {
          const rawKey = ctx.body.apiKey.trim();
          if (!rawKey.startsWith('mp-')) {
            throw APIError.from('BAD_REQUEST', {
              code: 'INVALID_KEY_FORMAT',
              message: 'Format API key tidak valid (harus diawali mp-)',
            });
          }

          const keyHash = hashApiKey(rawKey);

          const [keyRow] = await db
            .select({
              id: s.apiKeys.id,
              userId: s.apiKeys.userId,
              status: s.apiKeys.status,
            })
            .from(s.apiKeys)
            .where(and(eq(s.apiKeys.keyHash, keyHash), eq(s.apiKeys.status, 'active')))
            .limit(1);

          if (!keyRow || !keyRow.userId) {
            throw APIError.from('UNAUTHORIZED', {
              code: 'INVALID_API_KEY',
              message: 'API Key tidak valid atau telah dinonaktifkan.',
            });
          }

          const [dbUser] = await db
            .select({
              id: s.users.id,
              suspended: s.users.suspended,
            })
            .from(s.users)
            .where(eq(s.users.id, keyRow.userId))
            .limit(1);

          if (!dbUser) {
            throw APIError.from('UNAUTHORIZED', {
              code: 'USER_NOT_FOUND',
              message: 'Akun pemilik API Key tidak ditemukan.',
            });
          }

          if (dbUser.suspended) {
            throw APIError.from('FORBIDDEN', {
              code: 'USER_SUSPENDED',
              message: 'Akun Anda sedang ditangguhkan. Hubungi support@morphic.sh.',
            });
          }

          const user = await ctx.context.internalAdapter.findUserById(keyRow.userId);
          if (!user) {
            throw APIError.from('UNAUTHORIZED', {
              code: 'USER_NOT_FOUND',
              message: 'Akun pemilik API Key tidak ditemukan.',
            });
          }

          await db
            .update(s.apiKeys)
            .set({ lastUsedAt: new Date() })
            .where(eq(s.apiKeys.id, keyRow.id))
            .catch(() => {});

          const session = await ctx.context.internalAdapter.createSession(user.id);
          if (!session) {
            throw APIError.from('INTERNAL_SERVER_ERROR', {
              code: 'SESSION_CREATE_FAILED',
              message: 'Gagal membuat sesi login.',
            });
          }

          await setSessionCookie(ctx, { session, user });

          return ctx.json({
            ok: true,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
            },
          });
        },
      ),
    },
  };
};

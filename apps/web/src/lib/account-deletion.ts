import { and, eq } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';

/**
 * Soft-delete: the user row is kept but anonymised and suspended so credit_ledger / payments /
 * usage stay intact for financial retention (their FKs are ON DELETE RESTRICT), while every way
 * back in (credentials, OAuth links, 2FA, sessions, API keys) is removed.
 * Deliberately not in a 'use server' file: it must never be callable from the client.
 */
export async function softDeleteUser(userId: string): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(s.apiKeys)
      .set({ status: 'revoked', revokedAt: now })
      .where(and(eq(s.apiKeys.userId, userId), eq(s.apiKeys.status, 'active')));
    await tx.delete(s.accounts).where(eq(s.accounts.userId, userId));
    await tx.delete(s.twoFactors).where(eq(s.twoFactors.userId, userId));
    await tx.delete(s.sessions).where(eq(s.sessions.userId, userId));
    await tx
      .update(s.users)
      .set({
        email: `deleted+${userId}@redacted.local`,
        name: 'Deleted User',
        image: null,
        emailVerified: false,
        suspended: true,
        twoFactorEnabled: false,
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(s.users.id, userId));
  });
}

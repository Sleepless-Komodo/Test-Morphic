import { randomBytes, createHash } from 'node:crypto';
import { Hono } from 'hono';
import { db, schema as s } from '@morphic/db';
import { eq, and, desc } from 'drizzle-orm';
import { sessionAuth } from '../middleware/session-auth';

const keys = new Hono();

keys.use('*', sessionAuth);

keys.post('/', async (c) => {
  const { userId } = c.get('userSession');
  let body: { name?: string; expiresIn?: string };

  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { message: 'invalid json body', type: 'invalid_request_error', code: 'invalid_json' } },
      400,
    );
  }

  const name = body.name?.trim();
  if (!name) {
    return c.json(
      { error: { message: 'key name is required', type: 'invalid_request_error', code: 'missing_key_name' } },
      400,
    );
  }

  let expiresAt: Date | null = null;
  if (body.expiresIn && body.expiresIn !== 'none') {
    if (body.expiresIn === '30d') {
      expiresAt = new Date(Date.now() + 30 * 86_400_000);
    } else if (body.expiresIn === '90d') {
      expiresAt = new Date(Date.now() + 90 * 86_400_000);
    } else {
      const parsed = new Date(body.expiresIn);
      if (!isNaN(parsed.getTime())) {
        expiresAt = parsed;
      }
    }
  }

  const rawKey = `mp-${randomBytes(32).toString('hex')}`;
  const keyPrefix = rawKey.slice(0, 10);
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  const [inserted] = await db
    .insert(s.apiKeys)
    .values({
      userId,
      name,
      keyHash,
      keyPrefix,
      status: 'active',
      expiresAt,
    })
    .returning({
      id: s.apiKeys.id,
      name: s.apiKeys.name,
      keyPrefix: s.apiKeys.keyPrefix,
      status: s.apiKeys.status,
      expiresAt: s.apiKeys.expiresAt,
      createdAt: s.apiKeys.createdAt,
    });

  return c.json(
    {
      id: inserted.id,
      name: inserted.name,
      prefix: inserted.keyPrefix,
      key: rawKey,
      status: inserted.status,
      expires_at: inserted.expiresAt?.toISOString() ?? null,
      created_at: inserted.createdAt.toISOString(),
    },
    201,
  );
});

keys.get('/', async (c) => {
  const { userId } = c.get('userSession');

  const rows = await db
    .select({
      id: s.apiKeys.id,
      name: s.apiKeys.name,
      prefix: s.apiKeys.keyPrefix,
      status: s.apiKeys.status,
      expiresAt: s.apiKeys.expiresAt,
      lastUsedAt: s.apiKeys.lastUsedAt,
      createdAt: s.apiKeys.createdAt,
      revokedAt: s.apiKeys.revokedAt,
    })
    .from(s.apiKeys)
    .where(eq(s.apiKeys.userId, userId))
    .orderBy(desc(s.apiKeys.createdAt));

  return c.json({
    data: rows.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      status: k.status,
      expires_at: k.expiresAt?.toISOString() ?? null,
      last_used_at: k.lastUsedAt?.toISOString() ?? null,
      created_at: k.createdAt.toISOString(),
      revoked_at: k.revokedAt?.toISOString() ?? null,
    })),
  });
});

keys.delete('/:id', async (c) => {
  const { userId } = c.get('userSession');
  const keyId = c.req.param('id');

  const [key] = await db
    .select({ id: s.apiKeys.id, status: s.apiKeys.status })
    .from(s.apiKeys)
    .where(and(eq(s.apiKeys.id, keyId), eq(s.apiKeys.userId, userId)))
    .limit(1);

  if (!key) {
    return c.json(
      { error: { message: 'api key not found', type: 'invalid_request_error', code: 'key_not_found' } },
      404,
    );
  }

  const revokedAt = new Date();
  await db
    .update(s.apiKeys)
    .set({ status: 'revoked', revokedAt })
    .where(eq(s.apiKeys.id, keyId));

  return c.json({
    id: keyId,
    status: 'revoked',
    revoked_at: revokedAt.toISOString(),
  });
});

export { keys };

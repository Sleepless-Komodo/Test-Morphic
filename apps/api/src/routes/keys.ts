import { randomBytes, createHash } from 'node:crypto';
import { Hono } from 'hono';
import { db, schema as s } from '@morphic/db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { sessionAuth, denyKeyDerivedSession } from '../middleware/session-auth';
import { sessionRateLimit } from '../middleware/session-ratelimit';

const keys = new Hono();

keys.use('*', sessionAuth);
keys.use('*', denyKeyDerivedSession);
keys.use('*', sessionRateLimit('keys', 30));

// Plaintext is returned once here and never stored; only the SHA-256 hash is kept.
async function mintKey(userId: string, name: string, expiresAt: Date | null) {
  const rawKey = `mp-${randomBytes(32).toString('hex')}`;
  const [inserted] = await db
    .insert(s.apiKeys)
    .values({
      userId,
      name,
      keyHash: createHash('sha256').update(rawKey).digest('hex'),
      keyPrefix: rawKey.slice(0, 10),
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
  return {
    id: inserted.id,
    name: inserted.name,
    prefix: inserted.keyPrefix,
    key: rawKey,
    status: inserted.status,
    expires_at: inserted.expiresAt?.toISOString() ?? null,
    created_at: inserted.createdAt.toISOString(),
  };
}

keys.post('/', async (c) => {
  const { userId } = c.get('userSession');

  // Enforce max 5 API keys per account
  const [keyCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(s.apiKeys)
    .where(eq(s.apiKeys.userId, userId));

  if ((keyCount?.count ?? 0) >= 5) {
    return c.json(
      {
        error: {
          message: 'Batas maksimal 5 API key telah tercapai. Hapus key yang tidak terpakai untuk membuat yang baru.',
          type: 'invalid_request_error',
          code: 'max_keys_exceeded',
        },
      },
      400,
    );
  }

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

  // Only the presets the dashboard offers; a free-form date could set a past or decades-long expiry.
  const EXPIRY_DAYS: Record<string, number | null> = { none: null, '30d': 30, '90d': 90 };
  const expiresIn = body.expiresIn ?? 'none';
  if (typeof expiresIn !== 'string' || !Object.hasOwn(EXPIRY_DAYS, expiresIn)) {
    return c.json(
      { error: { message: 'expiresIn must be one of: none, 30d, 90d', type: 'invalid_request_error', code: 'invalid_expiry' } },
      400,
    );
  }
  const days = EXPIRY_DAYS[expiresIn];
  const expiresAt = days === null ? null : new Date(Date.now() + days * 86_400_000);

  return c.json(await mintKey(userId, name, expiresAt), 201);
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

// ── POST /v1/keys/:id/rotate ───────────────────────────
// Mints a replacement with the same name and expiry preset, and lets the old key keep
// working for a grace period so deployed clients can switch over. Not counted against the
// 5-key cap: the old key is on its way out.
const GRACE_SECONDS = new Set([3600, 86_400, 604_800]);

keys.post('/:id/rotate', async (c) => {
  const { userId } = c.get('userSession');
  const keyId = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as { gracePeriodSeconds?: unknown };
  const grace = body.gracePeriodSeconds ?? 86_400;
  if (typeof grace !== 'number' || !GRACE_SECONDS.has(grace)) {
    return c.json(
      { error: { message: 'gracePeriodSeconds must be one of: 3600, 86400, 604800', type: 'invalid_request_error', code: 'invalid_grace_period' } },
      400,
    );
  }

  const [old] = await db
    .select({ id: s.apiKeys.id, name: s.apiKeys.name, status: s.apiKeys.status, expiresAt: s.apiKeys.expiresAt, createdAt: s.apiKeys.createdAt })
    .from(s.apiKeys)
    .where(and(eq(s.apiKeys.id, keyId), eq(s.apiKeys.userId, userId)))
    .limit(1);
  if (!old || old.status !== 'active' || (old.expiresAt && old.expiresAt <= new Date())) {
    return c.json(
      { error: { message: 'only an active, unexpired key can be rotated', type: 'invalid_request_error', code: 'key_not_rotatable' } },
      old ? 409 : 404,
    );
  }

  const graceEnd = new Date(Date.now() + grace * 1000);
  // Never extend a key that would have expired sooner on its own.
  const oldExpiresAt = old.expiresAt && old.expiresAt < graceEnd ? old.expiresAt : graceEnd;
  // Same lifetime as the old key (its 30d/90d preset); a no-expiry key stays no-expiry.
  const newExpiresAt = old.expiresAt ? new Date(Date.now() + (old.expiresAt.getTime() - old.createdAt.getTime())) : null;

  const minted = await mintKey(userId, old.name, newExpiresAt);
  await db.update(s.apiKeys).set({ expiresAt: oldExpiresAt }).where(eq(s.apiKeys.id, old.id));

  return c.json({ ...minted, rotated_from: { id: old.id, expires_at: oldExpiresAt.toISOString() } }, 201);
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

  // Hard delete: auth looks keys up by hash, so the key stops working on its next request.
  // Usage and request logs keep their rows (api_key_id is set null by the FK).
  await db.delete(s.apiKeys).where(and(eq(s.apiKeys.id, keyId), eq(s.apiKeys.userId, userId)));

  return c.json({ id: keyId, deleted: true });
});

export { keys };

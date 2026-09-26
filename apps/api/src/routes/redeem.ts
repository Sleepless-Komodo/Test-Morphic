import { Hono } from 'hono';
import { db, schema as s } from '@morphic/db';
import { eq, and, or, sql, lt, isNull } from 'drizzle-orm';
import { sessionAuth, denyKeyDerivedSession } from '../middleware/session-auth';
import { sessionRateLimit } from '../middleware/session-ratelimit';
import { grantCredits, grantEntitlement } from '@morphic/db/billing';

class RedeemError extends Error {
  constructor(public reason: 'code_fully_redeemed') {
    super(reason);
  }
}

/** Detect a Postgres unique-violation across drivers (neon-http: err.code; postgres-js: err.cause.code). */
function isUniqueViolation(err: any): boolean {
  return (
    err?.code === '23505' ||
    err?.cause?.code === '23505' ||
    typeof err?.message === 'string' &&
      (err.message.includes('unique constraint') || err.message.includes('duplicate key'))
  );
}

const redeem = new Hono();

redeem.use('*', sessionAuth);
redeem.use('*', denyKeyDerivedSession);
// Cap redemption attempts to blunt code brute-forcing (audit H3).
redeem.use('*', sessionRateLimit('redeem', 10));

// ── POST /v1/redeem ───────────────────────────────────
redeem.post('/', async (c) => {
  const { userId } = c.get('userSession');

  let body: { code?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { message: 'invalid json body', type: 'invalid_request_error', code: 'invalid_json' } },
      400,
    );
  }

  const { code } = body;
  if (!code || typeof code !== 'string') {
    return c.json(
      { error: { message: 'code is required', type: 'invalid_request_error', code: 'missing_code' } },
      400,
    );
  }

  const upperCode = code.trim().toUpperCase();

  // Fetch the active redeem code
  const [redeemCode] = await db
    .select()
    .from(s.redeemCodes)
    .where(and(eq(s.redeemCodes.code, upperCode), eq(s.redeemCodes.active, true)))
    .limit(1);

  if (!redeemCode) {
    return c.json(
      { error: { message: 'invalid or inactive code', type: 'invalid_request_error', code: 'invalid_code' } },
      400,
    );
  }

  // Check expiration
  if (redeemCode.expiresAt && redeemCode.expiresAt < new Date()) {
    return c.json(
      { error: { message: 'code has expired', type: 'invalid_request_error', code: 'code_expired' } },
      400,
    );
  }

  // Redeem atomically. The redemption count is bumped with a CONDITIONAL update so
  // concurrent redeemers cannot push a capped code past max_redemptions (audit H4):
  // the WHERE clause re-checks the cap inside the write, and zero rows means the code
  // is already full. The per-user unique constraint on `redemptions` blocks double-spend.
  try {
    await db.transaction(async (tx) => {
      const bumped = await tx
        .update(s.redeemCodes)
        .set({ redeemedCount: sql`${s.redeemCodes.redeemedCount} + 1` })
        .where(
          and(
            eq(s.redeemCodes.id, redeemCode.id),
            or(
              isNull(s.redeemCodes.maxRedemptions),
              lt(s.redeemCodes.redeemedCount, s.redeemCodes.maxRedemptions),
            ),
          ),
        )
        .returning({ id: s.redeemCodes.id });

      if (bumped.length === 0) {
        throw new RedeemError('code_fully_redeemed');
      }

      // Insert redemption (unique (code_id, user_id) throws if this user already redeemed).
      // This runs after the bump so a re-redeem attempt rolls back the increment too.
      await tx.insert(s.redemptions).values({ codeId: redeemCode.id, userId });
    });
  } catch (err: any) {
    if (err instanceof RedeemError && err.reason === 'code_fully_redeemed') {
      return c.json(
        { error: { message: 'code has reached maximum redemptions', type: 'invalid_request_error', code: 'code_fully_redeemed' } },
        400,
      );
    }
    // Unique-violation (23505) means this user already redeemed. postgres-js nests the
    // pg error under `.cause`, neon-http surfaces it directly — check both.
    if (isUniqueViolation(err)) {
      return c.json(
        { error: { message: 'you have already redeemed this code', type: 'invalid_request_error', code: 'code_already_redeemed' } },
        409,
      );
    }
    console.error('[redeem] transaction failed:', err);
    return c.json(
      { error: { message: 'failed to redeem code', type: 'server_error', code: 'redeem_failed' } },
      500,
    );
  }

  // If transaction succeeded, grant the rewards
  let grantedCredits = 0;
  let packageInfo = null;

  if (redeemCode.rewardType === 'package' && redeemCode.packageId) {
    // Fetch package details
    const [pkg] = await db
      .select()
      .from(s.packages)
      .where(eq(s.packages.id, redeemCode.packageId))
      .limit(1);

    if (pkg) {
      if (pkg.modelId) {
        // Model-specific package -> grant entitlement
        await grantEntitlement({
          userId,
          allowance: pkg.creditAllowance,
          modelId: pkg.modelId,
          durationHours: pkg.durationHours,
          source: 'redeem',
          packageId: pkg.id,
        });
      } else {
        // General credits package -> grant credits
        await grantCredits({
          userId,
          amount: pkg.creditAllowance,
          entryType: 'redeem',
          reference: `code:${redeemCode.id}`,
        });
      }
      grantedCredits = pkg.creditAllowance;
      packageInfo = { id: pkg.id, name: pkg.name };
    }
  } else if (redeemCode.rewardType === 'credits' && redeemCode.creditAmount) {
    // Direct credits
    await grantCredits({
      userId,
      amount: redeemCode.creditAmount,
      entryType: 'redeem',
      reference: `code:${redeemCode.id}`,
    });
    grantedCredits = redeemCode.creditAmount;
  }

  return c.json({
    ok: true,
    message: 'code redeemed successfully',
    reward: {
      type: redeemCode.rewardType,
      credits: grantedCredits,
      package: packageInfo,
    },
  });
});

export { redeem };

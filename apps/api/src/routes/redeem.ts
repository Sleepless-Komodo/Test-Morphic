import { Hono } from 'hono';
import { db, schema as s } from '@morphic/db';
import { eq, and, sql } from 'drizzle-orm';
import { sessionAuth } from '../middleware/session-auth.ts';
import { grantCredits, grantEntitlement } from '@morphic/db/billing';

const redeem = new Hono();

redeem.use('*', sessionAuth);

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

  // Check usage limit
  if (redeemCode.maxRedemptions && redeemCode.redeemedCount >= redeemCode.maxRedemptions) {
    return c.json(
      { error: { message: 'code has reached maximum redemptions', type: 'invalid_request_error', code: 'code_fully_redeemed' } },
      400,
    );
  }

  // Attempt to redeem within a transaction
  try {
    await db.transaction(async (tx) => {
      // 1. Insert redemption (throws if user already redeemed)
      await tx.insert(s.redemptions).values({
        codeId: redeemCode.id,
        userId,
      });

      // 2. Increment usage count
      await tx
        .update(s.redeemCodes)
        .set({ redeemedCount: sql`${s.redeemCodes.redeemedCount} + 1` })
        .where(eq(s.redeemCodes.id, redeemCode.id));
    });
  } catch (err: any) {
    // Unique constraint violation (23505) means already redeemed
    if (err.code === '23505' || err.message?.includes('unique constraint')) {
      return c.json(
        { error: { message: 'you have already redeemed this code', type: 'invalid_request_error', code: 'code_already_redeemed' } },
        409, // Conflict
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

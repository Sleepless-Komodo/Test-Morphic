import { and, eq, desc, gt, isNull } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { getGiftHistoryPageAction, requireUser } from '@/lib/actions';
import { RedeemView } from './redeem-view';

// Same view for every role. Admins create codes in the admin panel (/admin/codes).
export default async function RedeemPage() {
  const user = await requireUser();
  const warnEmpty = (what: string) => (err: unknown) => {
    console.warn(`[RedeemPage] ${what} read failed:`, err);
    return [];
  };

  const [coupons, giftPackages, gifts] = await Promise.all([
    // Every entitlement the user ever held, so the coupon list can show used/expired ones too.
    db
      .select({
        id: s.entitlements.id,
        allowance: s.entitlements.allowance,
        remaining: s.entitlements.remaining,
        source: s.entitlements.source,
        status: s.entitlements.status,
        expiresAt: s.entitlements.expiresAt,
        packageName: s.packages.name,
        modelName: s.models.displayName,
      })
      .from(s.entitlements)
      .leftJoin(s.packages, eq(s.entitlements.packageId, s.packages.id))
      .leftJoin(s.models, eq(s.entitlements.modelId, s.models.id))
      .where(eq(s.entitlements.userId, user.id))
      .orderBy(desc(s.entitlements.createdAt))
      .limit(100)
      .catch(warnEmpty('Entitlement')),
    // Gift card amounts = priced credit packages (model passes cannot become credit codes).
    db
      .select({
        id: s.packages.id,
        name: s.packages.name,
        priceCents: s.packages.priceCents,
        currency: s.packages.currency,
        creditAllowance: s.packages.creditAllowance,
      })
      .from(s.packages)
      .where(and(eq(s.packages.status, 'active'), isNull(s.packages.modelId), gt(s.packages.priceCents, 0)))
      .orderBy(s.packages.priceCents)
      .catch(warnEmpty('Gift package')),
    getGiftHistoryPageAction().catch((err) => {
      console.warn('[RedeemPage] Gift history read failed:', err);
      return { data: [], nextCursor: null };
    }),
  ]);

  return (
    <RedeemView
      coupons={coupons.map((c) => ({ ...c, expiresAt: c.expiresAt.toISOString() }))}
      giftPackages={giftPackages.map((p) => ({ ...p, priceCents: p.priceCents ?? 0 }))}
      transactions={gifts}
    />
  );
}

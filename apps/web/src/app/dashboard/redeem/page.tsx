import { and, eq, gt, isNull } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { getCouponsPageAction, getGiftHistoryPageAction, requireUser } from '@/lib/actions';
import { RedeemView } from './redeem-view';

const EMPTY_PAGE = { items: [], page: 1, lastPage: 1, total: 0, capped: false, hasNext: false };

// Same view for every role. Admins create codes in the admin panel (/admin/codes).
export default async function RedeemPage() {
  const user = await requireUser();
  const warnEmpty = (what: string) => (err: unknown) => {
    console.warn(`[RedeemPage] ${what} read failed:`, err);
    return [];
  };

  const [coupons, giftPackages, gifts] = await Promise.all([
    // Every entitlement the user ever held, so the coupon list can show used/expired ones too.
    getCouponsPageAction().catch((err) => {
      console.warn('[RedeemPage] Entitlement read failed:', err);
      return EMPTY_PAGE;
    }),
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
      return EMPTY_PAGE;
    }),
  ]);

  return (
    <RedeemView
      coupons={coupons}
      giftPackages={giftPackages.map((p) => ({ ...p, priceCents: p.priceCents ?? 0 }))}
      transactions={gifts}
    />
  );
}

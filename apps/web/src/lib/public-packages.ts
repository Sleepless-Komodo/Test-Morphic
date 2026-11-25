import { asc, eq } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import type { BillingPackage, PackageKind } from './billing-format';
import { memo } from './memo';

const PUBLIC_PACKAGES_TTL_MS = 60_000;

/** Active packages, cheapest first, with the model a pass is tied to. The one query behind Billing and the public pricing. */
export async function loadActivePackages(): Promise<BillingPackage[]> {
  const rows = await db
    .select({
      id: s.packages.id,
      name: s.packages.name,
      kind: s.packages.kind,
      creditAllowance: s.packages.creditAllowance,
      durationHours: s.packages.durationHours,
      priceCents: s.packages.priceCents,
      currency: s.packages.currency,
      modelDisplayName: s.models.displayName,
      modelPublicId: s.models.publicModelId,
    })
    .from(s.packages)
    .leftJoin(s.models, eq(s.packages.modelId, s.models.id))
    .where(eq(s.packages.status, 'active'))
    .orderBy(asc(s.packages.priceCents));

  return rows.map((row) => ({ ...row, kind: (row.kind ?? 'balance') as PackageKind }));
}

/** Same rows for every visitor, so one read serves the homepage and /pricing for a minute. */
export const loadPublicPackages = () => memo('public:packages', PUBLIC_PACKAGES_TTL_MS, loadActivePackages);

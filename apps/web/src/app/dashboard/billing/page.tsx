import { eq, desc, and, gt } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { requireUser } from '@/lib/actions';
import { getBalance } from '@morphic/db/billing';
import { fetchBackendApi } from '@/lib/api-client';
import { BillingView } from './billing-view';

const FALLBACK_CHEAP_PACKAGES = [
  {
    id: 'pkg-v4-1day',
    name: 'Pass Harian DeepSeek V4',
    nameEn: 'DeepSeek V4 Daily Pass',
    description: 'Akses penuh 24 jam untuk coding model DeepSeek V4 di Cursor & Cline.',
    descriptionEn: 'Full 24-hour access to DeepSeek V4 coding model for Cursor & Cline.',
    priceCents: 2500,
    creditAllowance: 15000,
    durationHours: 24,
  },
  {
    id: 'pkg-qwen-1day',
    name: 'Pass Harian Qwen Max',
    nameEn: 'Qwen Max Daily Pass',
    description: 'Akses 24 jam model serba bisa Qwen 2.5 Max bahasa Indonesia alami.',
    descriptionEn: '24-hour access to versatile Qwen 2.5 Max with natural multilingual & Indonesian fluency.',
    priceCents: 3500,
    creditAllowance: 22000,
    durationHours: 24,
  },
  {
    id: 'pkg-r1-1day',
    name: 'Pass Harian DeepSeek R1',
    nameEn: 'DeepSeek R1 Daily Pass',
    description: 'Akses 24 jam model penalaran bertahap Chain-of-Thought.',
    descriptionEn: '24-hour access to Chain-of-Thought step-by-step reasoning model.',
    priceCents: 4500,
    creditAllowance: 28000,
    durationHours: 24,
  },
  {
    id: 'pkg-all-1day',
    name: 'All-Access Pass (24 Jam)',
    nameEn: 'All-Access Pass (24h)',
    description: 'Akses bebas seluruh model (DeepSeek, Qwen, Kimi, GLM) selama 24 jam.',
    descriptionEn: 'Unlimited access to all models (DeepSeek, Qwen, Kimi, GLM) for 24 hours.',
    priceCents: 7500,
    creditAllowance: 45000,
    durationHours: 24,
  },
  {
    id: 'pkg-micro-5k',
    name: 'Mikro Saldo 30K',
    nameEn: 'Micro Balance 30K',
    description: 'Top up saldo fleksibel tanpa hangus untuk pemakaian sewaktu-waktu.',
    descriptionEn: 'Flexible credit top-up without expiry for on-demand usage.',
    priceCents: 5000,
    creditAllowance: 30000,
    durationHours: 24 * 30,
  },
  {
    id: 'pkg-week-9k',
    name: 'Paket Hemat Mingguan',
    nameEn: 'Weekly Saver Pack',
    description: 'Kredit cukup untuk 7 hari pemakaian coding harian intensif.',
    descriptionEn: 'Sufficient credits for 7 days of intensive daily coding.',
    priceCents: 9900,
    creditAllowance: 70000,
    durationHours: 24 * 7,
  },
];

export default async function BillingPage() {
  const user = await requireUser();
  let balance = 0;
  let displayPackages: any[] = FALLBACK_CHEAP_PACKAGES;
  let entitlements: any[] = [];
  let payments: any[] = [];
  let ledger: any[] = [];

  try {
    const [b, dbPackages, dbEntitlements, dbPayments] = await Promise.all([
      getBalance(user.id),
      db.select().from(s.packages).where(eq(s.packages.status, 'active')),
      db
        .select({
          id: s.entitlements.id,
          allowance: s.entitlements.allowance,
          remaining: s.entitlements.remaining,
          expiresAt: s.entitlements.expiresAt,
          packageName: s.packages.name,
          displayName: s.models.displayName,
        })
        .from(s.entitlements)
        .leftJoin(s.packages, eq(s.entitlements.packageId, s.packages.id))
        .leftJoin(s.models, eq(s.entitlements.modelId, s.models.id))
        .where(
          and(
            eq(s.entitlements.userId, user.id),
            eq(s.entitlements.status, 'active'),
            gt(s.entitlements.expiresAt, new Date()),
          ),
        ),
      db
        .select()
        .from(s.payments)
        .where(eq(s.payments.userId, user.id))
        .orderBy(desc(s.payments.createdAt))
        .limit(20),
    ]);
    balance = b;
    if (dbPackages.length > 0) displayPackages = dbPackages;
    entitlements = dbEntitlements;
    payments = dbPayments;
  } catch (err) {
    console.warn('[BillingPage] Database offline, showing fallback packages and zero balance:', err);
  }

  // Fetch balance from backend API if available
  try {
    const balRes = await fetchBackendApi<{ credits: number }>('/v1/account/balance');
    if (balRes.data?.credits != null) {
      balance = balRes.data.credits;
    }
  } catch {
    // Keep balance from getBalance
  }

  // Fetch credit ledger from backend API (authenticated via session cookie forwarding)
  const ledgerRes = await fetchBackendApi<{ data: any[]; total: number }>(
    '/v1/account/transactions?limit=50',
  );
  if (ledgerRes.data?.data) {
    ledger = ledgerRes.data.data;
  }

  return (
    <BillingView
      balance={balance}
      packages={displayPackages}
      entitlements={entitlements}
      payments={payments}
      ledger={ledger}
    />
  );
}

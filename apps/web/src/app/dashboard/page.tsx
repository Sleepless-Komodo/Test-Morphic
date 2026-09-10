import { headers } from 'next/headers';
import { and, eq, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema as s } from '@morphic/db';
import { getBalance } from '@morphic/db/billing';
import DeveloperGateway from '@/components/DeveloperGateway';

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  let userBalance = 0;
  let activeKeys = 0;
  let usage = { totalTokens: 0, promptTokens: 0, completionTokens: 0 };
  let modelCount = 0;
  let avgCreditsPer1m = 0;
  let minInputRate = 0;

  if (session?.user?.id) {
    try {
      userBalance = await getBalance(session.user.id);
    } catch {
      userBalance = 0;
    }

    try {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(s.apiKeys)
        .where(and(eq(s.apiKeys.userId, session.user.id), eq(s.apiKeys.status, 'active')));
      activeKeys = row?.count ?? 0;
    } catch {
      activeKeys = 0;
    }

    try {
      const [row] = await db
        .select({
          totalTokens: sql<number>`coalesce(sum(${s.usageRecords.totalTokens}),0)::bigint`,
          promptTokens: sql<number>`coalesce(sum(${s.usageRecords.promptTokens}),0)::bigint`,
          completionTokens: sql<number>`coalesce(sum(${s.usageRecords.completionTokens}),0)::bigint`,
        })
        .from(s.usageRecords)
        .where(eq(s.usageRecords.userId, session.user.id));
      usage = {
        totalTokens: Number(row?.totalTokens ?? 0),
        promptTokens: Number(row?.promptTokens ?? 0),
        completionTokens: Number(row?.completionTokens ?? 0),
      };
    } catch (err) {
      console.warn('[DashboardPage] Database offline, showing empty usage stats:', err);
    }
  }

  try {
    const [row] = await db
      .select({
        count: sql<number>`count(*)::int`,
        avgCreditsPer1m: sql<number>`coalesce(avg((${s.models.inputCreditsPer1m} + ${s.models.outputCreditsPer1m}) / 2.0), 0)::float`,
        minInputRate: sql<number>`coalesce(min(${s.models.inputCreditsPer1m}), 0)::int`,
      })
      .from(s.models)
      .where(eq(s.models.status, 'active'));
    modelCount = row?.count ?? 0;
    avgCreditsPer1m = Number(row?.avgCreditsPer1m ?? 0);
    minInputRate = Number(row?.minInputRate ?? 0);
  } catch (err) {
    console.warn('[DashboardPage] Database offline, showing empty model stats:', err);
  }

  return (
    <DeveloperGateway
      userBalance={userBalance}
      activeKeys={activeKeys}
      usage={usage}
      modelCount={modelCount}
      avgCreditsPer1m={avgCreditsPer1m}
      minInputRate={minInputRate}
    />
  );
}

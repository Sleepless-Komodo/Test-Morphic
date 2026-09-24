import { headers } from 'next/headers';
import { eq, sql, desc, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { getSessionWithRetry } from '@/lib/actions';
import { db, schema as s } from '@morphic/db';
import { getBalance } from '@morphic/db/billing';
import DeveloperGateway, { ModelItem } from '@/components/DeveloperGateway';

/**
 * Fetches active AI models and their provider info directly from PostgreSQL.
 * Maps DB schema attributes to DeveloperGateway UI expectations.
 * Returns undefined if database is offline or empty to allow graceful UI fallback.
 */
async function getModelsFromDb(): Promise<ModelItem[] | undefined> {
  try {
    const dbModels = await db
      .select({
        publicModelId: s.models.publicModelId,
        displayName: s.models.displayName,
        description: s.models.description,
        contextLength: s.models.contextLength,
        capabilities: s.models.capabilities,
        inputCreditsPer1m: s.models.inputCreditsPer1m,
        outputCreditsPer1m: s.models.outputCreditsPer1m,
        providerName: s.providers.name,
        status: s.models.status,
      })
      .from(s.models)
      .innerJoin(s.providers, eq(s.models.providerId, s.providers.id))
      .where(eq(s.models.status, 'active'));

    if (!dbModels || dbModels.length === 0) return undefined;

    return dbModels.map((m) => {
      // Map DB capability array tags to UI CapabilityTag union
      const caps: ('Chat' | 'Code' | 'Reasoning' | 'Vision' | 'Long Context')[] = [];
      const rawCaps = Array.isArray(m.capabilities) ? m.capabilities : [];
      if (rawCaps.includes('coding')) caps.push('Code');
      if (rawCaps.includes('reasoning')) caps.push('Reasoning');
      if (rawCaps.includes('chat') || rawCaps.includes('general')) caps.push('Chat');
      if (rawCaps.includes('multimodal') || rawCaps.includes('vision')) caps.push('Vision');
      if ((m.contextLength || 0) >= 128000) caps.push('Long Context');
      if (caps.length === 0) caps.push('Chat');

      const contextK = Math.round((m.contextLength || 0) / 1024);
      const contextWindow = contextK > 0 ? `${contextK}K Tokens` : '64K Tokens';
      const formattedProvider = m.providerName
        ? m.providerName.charAt(0).toUpperCase() + m.providerName.slice(1)
        : 'Provider';

      return {
        id: m.publicModelId,
        name: m.displayName,
        provider: formattedProvider,
        capabilities: caps,
        contextWindow,
        category: caps.includes('Code') ? 'Coding' : caps.includes('Reasoning') ? 'Reasoning' : caps.includes('Vision') ? 'Multimodal' : 'Chat',
        dailyRate: `Rp ${((m.inputCreditsPer1m || 100) * 25).toLocaleString('id-ID')} / hari`,
        dailyRateEn: `Rp ${((m.inputCreditsPer1m || 100) * 25).toLocaleString('en-US')} / day`,
        speed: 'Fast' as const,
        estimatedLatency: '~200ms',
        description: {
          id: m.description || `${m.displayName} AI model`,
          en: m.description || `${m.displayName} AI model`,
        },
        badge: formattedProvider.toUpperCase(),
        badgeEn: formattedProvider.toUpperCase(),
        badgeType: 'popular' as const,
      };
    });
  } catch (error) {
    console.warn('[DashboardPage] Failed to fetch active models from database:', error);
    return undefined;
  }
}

export default async function DashboardPage() {
  const session = await getSessionWithRetry();
  let userBalance = 0;
  let activeKeys = 0;
  let usage = { totalTokens: 0, promptTokens: 0, completionTokens: 0 };
  let recentRequests: any[] = [];
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

    try {
      recentRequests = await db
        .select({
          id: s.usageRecords.id,
          requestId: s.usageRecords.requestId,
          model: s.models.displayName,
          publicModelId: s.models.publicModelId,
          promptTokens: s.usageRecords.promptTokens,
          completionTokens: s.usageRecords.completionTokens,
          totalTokens: s.usageRecords.totalTokens,
          credits: s.usageRecords.creditsConsumed,
          status: s.usageRecords.status,
          streamed: s.usageRecords.streamed,
          latencyMs: s.usageRecords.latencyMs,
          createdAt: s.usageRecords.createdAt,
        })
        .from(s.usageRecords)
        .leftJoin(s.models, eq(s.usageRecords.modelId, s.models.id))
        .where(eq(s.usageRecords.userId, session.user.id))
        .orderBy(desc(s.usageRecords.createdAt))
        .limit(6);
    } catch (err) {
      console.warn('[DashboardPage] Database offline, showing empty recent requests:', err);
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

  const initialModels = await getModelsFromDb();

  return (
    <DeveloperGateway
      session={session}
      userBalance={userBalance}
      initialModels={initialModels}
      recentRequests={recentRequests}
      serverModelCount={modelCount}
      serverAvgCreditsPer1m={avgCreditsPer1m}
      serverMinInputRate={minInputRate}
    />
  );
}

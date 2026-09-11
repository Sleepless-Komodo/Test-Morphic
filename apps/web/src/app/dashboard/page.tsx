import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
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
      const caps: ('Chat' | 'Code' | 'Reasoning' | 'Multimodal' | 'Image' | 'Video')[] = [];
      const rawCaps = Array.isArray(m.capabilities) ? m.capabilities : [];
      if (rawCaps.includes('coding')) caps.push('Code');
      if (rawCaps.includes('reasoning')) caps.push('Reasoning');
      if (rawCaps.includes('chat') || rawCaps.includes('general')) caps.push('Chat');
      if (rawCaps.includes('multimodal')) caps.push('Multimodal');
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
        rate: `${m.inputCreditsPer1m || 100} credits / 1M in`,
        dailyPrice: `Rp ${((m.inputCreditsPer1m || 100) * 25).toLocaleString('id-ID')} / hari`,
        category: `${formattedProvider} Family`,
        description: m.description || `${m.displayName} AI model`,
        descriptionEn: m.description || `${m.displayName} AI model`,
        isAvailable: m.status === 'active',
        section: 'inference',
        badge: formattedProvider.toUpperCase(),
        badgeEn: formattedProvider.toUpperCase(),
      };
    });
  } catch (error) {
    console.warn('[DashboardPage] Failed to fetch active models from database:', error);
    return undefined;
  }
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  let userBalance = 0;

  if (session?.user?.id) {
    try {
      userBalance = await getBalance(session.user.id);
    } catch {
      userBalance = 0;
    }
  }

  const initialModels = await getModelsFromDb();

  return (
    <DeveloperGateway
      session={session}
      userBalance={userBalance}
      initialModels={initialModels}
    />
  );
}

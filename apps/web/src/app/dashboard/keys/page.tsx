import { eq } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { listApiKeys } from '@/lib/actions';
import { KeysView } from './keys-view';

export default async function KeysPage() {
  let keys: any[] = [];
  let availableModels: Array<{ id: string; name: string }> = [];

  try {
    const rawKeys = await listApiKeys();
    keys = (rawKeys || []).map((k: any) => ({
      ...k,
      expiresAt: k.expiresAt ? new Date(k.expiresAt) : null,
      lastUsedAt: k.lastUsedAt ? new Date(k.lastUsedAt) : null,
      createdAt: k.createdAt ? new Date(k.createdAt) : new Date(),
    }));
  } catch (err) {
    console.warn('[KeysPage] Error fetching api keys:', err);
    keys = [];
  }

  try {
    const dbModels = await db
      .select({
        id: s.models.publicModelId,
        name: s.models.displayName,
      })
      .from(s.models)
      .where(eq(s.models.status, 'active'));

    if (dbModels && dbModels.length > 0) {
      availableModels = dbModels;
    }
  } catch (err) {
    console.warn('[KeysPage] Error fetching active models:', err);
  }

  return <KeysView initialKeys={keys} availableModels={availableModels} />;
}

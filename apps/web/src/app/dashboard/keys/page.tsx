import { listApiKeys } from '@/lib/actions';
import { KeysView } from './keys-view';

export default async function KeysPage() {
  let keys: any[] = [];
  try {
    const rawKeys = await listApiKeys();
    keys = (rawKeys || []).map((k: any) => ({
      ...k,
      lastUsedAt: k.lastUsedAt ? new Date(k.lastUsedAt) : null,
      createdAt: k.createdAt ? new Date(k.createdAt) : new Date(),
    }));
  } catch (err) {
    console.warn('[KeysPage] Error fetching api keys:', err);
    keys = [];
  }

  return <KeysView initialKeys={keys} />;
}

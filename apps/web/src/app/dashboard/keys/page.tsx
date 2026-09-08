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
    console.warn('[KeysPage] Database offline, showing fallback sample keys:', err);
    keys = [
      {
        id: 'dev-key-1',
        name: 'Cursor & Cline Dev Key',
        keyPrefix: 'mp-live-9f82a4d1082c',
        status: 'active',
        lastUsedAt: new Date(),
        createdAt: new Date(),
      },
    ];
  }

  return <KeysView initialKeys={keys} />;
}

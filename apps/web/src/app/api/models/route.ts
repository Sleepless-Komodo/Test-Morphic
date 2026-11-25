import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { memo } from '@/lib/memo';
import { SLOW_TTL_MS } from '@/lib/refresh';

export const dynamic = 'force-dynamic';

// Public, read-only list of active models (no pricing internals, no provider credentials) for
// guest-facing search such as the command palette.
export async function GET() {
  try {
    // Every visitor sees the same list; admin model edits clear it (invalidateCatalog, 'public:model').
    const rows = await memo('public:model-search', SLOW_TTL_MS, () => db
      .select({
        id: s.models.publicModelId,
        name: s.models.displayName,
        contextLength: s.models.contextLength,
        capabilities: s.models.capabilities,
      })
      .from(s.models)
      .where(eq(s.models.status, 'active')));
    return NextResponse.json({ data: rows }, { headers: { 'cache-control': 'public, max-age=60' } });
  } catch (err) {
    console.warn('[api/models] catalog read failed:', err);
    return NextResponse.json({ data: [] }, { status: 503 });
  }
}

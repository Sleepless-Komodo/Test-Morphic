export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getSessionSafe } from '@/lib/auth';
import { cache } from 'react';
import { loadModelDetail, type ModelDetail } from '@/lib/model-detail';
import { matchSnapshot, type SnapshotModel } from '@/lib/model-catalog';
import snapshot from '@/data/model-catalog.json';
import { memo } from '@/lib/memo';
import { AutoRefresh } from '@/components/AutoRefresh';
import { makerFromId } from '@/lib/model-maker';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ModelDetailView } from './model-detail-view';
import { SLOW_TTL_MS } from '@/lib/refresh';

type Props = { params: Promise<{ id: string[] }> };

const idFrom = async (props: Props) => (await props.params).id.map(decodeURIComponent).join('/');

const catalog = snapshot.models as SnapshotModel[];

/** A model in our database: live stats from our logs, catalog metadata when it matches. Anything else is a 404. */
async function loadAny(id: string): Promise<ModelDetail | null> {
  const live = await loadModelDetail(id);
  if (!live) return null;
  const { providerModelId, ...detail } = live;
  return { ...detail, meta: matchSnapshot({ publicModelId: id, providerModelId }, catalog) ?? null };
}

// cache(): metadata and page share one load per request; memo: visitors share it for 5 min.
const getDetail = cache((id: string) => memo(`public:model:${id}`, SLOW_TTL_MS, () => loadAny(id)));

export async function generateMetadata(props: Props) {
  const detail = await getDetail(await idFrom(props)).catch(() => null);
  if (!detail) return { title: 'Model not found | Morphic AI Gateway' };
  return {
    title: `${detail.model.displayName} | Morphic AI Gateway`,
    description: detail.model.description ?? `${detail.model.displayName} on Morphic's OpenAI-compatible gateway.`,
  };
}

export default async function ModelPage(props: Props) {
  const id = await idFrom(props);
  const [session, detail] = await Promise.all([
    headers()
      .then((h) => getSessionSafe(h))
      .catch(() => null),
    getDetail(id),
  ]);
  if (!detail) notFound();

  const maker = makerFromId(detail.model.publicModelId);
  const related = detail.related.filter((r) => makerFromId(r.publicModelId) === maker).slice(0, 6);

  return (
    <main className="min-h-screen bg-[#fafafa] text-neutral-900 selection:bg-neutral-900 selection:text-white flex flex-col justify-between overflow-x-clip">
      <Navbar session={session} />
      <ModelDetailView detail={{ ...detail, related }} isLoggedIn={!!session} />
      <AutoRefresh />
      <Footer />
    </main>
  );
}

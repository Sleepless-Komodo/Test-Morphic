export const dynamic = 'force-dynamic';

import { headers } from 'next/headers';
import { getSessionSafe } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import DocsView from './docs-view';
import { loadPublicModels } from '@/lib/models-data';

export const metadata = {
  title: 'Dokumentasi | Morphic AI Gateway',
  description:
    'Panduan lengkap integrasi Morphic AI Gateway: setup Cursor, Cline, Windsurf, Claude Code, Python, Node.js SDK, dan referensi endpoint OpenAI-compatible.',
};

export default async function DocsPage() {
  const [session, models] = await Promise.all([
    headers()
      .then((h) => getSessionSafe(h))
      .catch((err) => {
        console.warn('[DocsPage] Session check failed, rendering as guest:', err);
        return null;
      }),
    // Samples and the model table use the ids we really serve; MODEL_ID placeholders when unreachable.
    loadPublicModels()
      .then((l) => l.models.map(({ id, name, maker, contextLength }) => ({ id, name, maker, contextLength })))
      .catch((err) => {
        console.warn('[DocsPage] Model list failed:', err);
        return [];
      }),
  ]);

  return (
    <main className="min-h-screen bg-[#fafafa] text-neutral-900 selection:bg-neutral-900 selection:text-white flex flex-col justify-between overflow-x-clip">
      <Navbar session={session} />
      <DocsView session={session} models={models} />
      <Footer />
    </main>
  );
}


export const dynamic = 'force-dynamic';

import { headers } from 'next/headers';
import { getSessionSafe } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AnalyticsBoard from '@/components/AnalyticsBoard';
import { memo } from '@/lib/memo';
import { AutoRefresh } from '@/components/AutoRefresh';
import { loadAppAnalytics, type PublicAnalytics } from '@/lib/public-analytics';
import { SLOW_TTL_MS } from '@/lib/refresh';

export const metadata = {
  title: 'Apps Analytics | Morphic AI Gateway',
  description: 'Which apps and agents send traffic through Morphic, and how much.',
};

export default async function AppsAnalyticsPage() {
  // Same rollup for every visitor; all renders share one query per 5 minutes.
  const [session, data] = await Promise.all([
    headers()
      .then((h) => getSessionSafe(h))
      .catch(() => null),
    memo('public:analytics:apps', SLOW_TTL_MS, loadAppAnalytics).catch((err): PublicAnalytics => {
      console.warn('[analytics/apps] read failed:', err);
      return { rows: [], entities: [], today: new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10) };
    }),
  ]);

  return (
    <main className="min-h-screen bg-[#fafafa] text-neutral-900 selection:bg-neutral-900 selection:text-white flex flex-col justify-between overflow-x-clip">
      <Navbar session={session} />
      <AnalyticsBoard kind="apps" data={data} />
      {/* The rollup is cached for 5 min, so most refreshes cost no query at all. */}
      <AutoRefresh />
      <Footer />
    </main>
  );
}

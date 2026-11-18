import { requireUser, getUsageLogsAction } from '@/lib/actions';
import { LogsView } from './logs-view';

export default async function LogsPage() {
  await requireUser();
  const res = await getUsageLogsAction().catch((err) => {
    console.warn('[LogsPage] Failed to fetch usage records:', err);
    return { data: [] as any[], nextCursor: null };
  });
  const recent = (res.data ?? []).map((u: any) => ({ ...u, createdAt: new Date(u.createdAt) }));
  return <LogsView recent={recent} initialNextCursor={res.nextCursor ?? null} />;
}

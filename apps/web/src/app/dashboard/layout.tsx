import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getBalance } from '@morphic/db/billing';
import { fetchBackendApi } from '@/lib/api-client';
import { DashboardShell } from '@/components/DashboardShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect('/login');
    return null;
  }

  let balance = 0;
  try {
    const balRes = await fetchBackendApi<{ credits: number }>('/v1/account/balance');
    if (balRes.data?.credits != null) {
      balance = balRes.data.credits;
    } else {
      balance = await getBalance(session.user.id);
    }
  } catch {
    try {
      balance = await getBalance(session.user.id);
    } catch {
      balance = 0;
    }
  }

  return <DashboardShell session={session} balance={balance}>{children}</DashboardShell>;
}

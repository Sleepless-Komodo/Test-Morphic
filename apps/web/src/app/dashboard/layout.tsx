import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionWithRetry } from '@/lib/actions';
import { getBalance } from '@morphic/db/billing';
import { DashboardShell } from '@/components/DashboardShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionWithRetry();

  if (!session) {
    redirect('/login');
    return null;
  }

  let balance = 0;
  try {
    balance = await getBalance(session.user.id);
  } catch {
    balance = 0;
  }

  return <DashboardShell session={session} balance={balance}>{children}</DashboardShell>;
}

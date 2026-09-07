import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getBalance } from '@morphic/db/billing';
import { DashboardHeader } from '@/components/DashboardHeader';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let session = await auth.api.getSession({ headers: await headers() });
  
  // Dev mode bypass: izinkan preview dashboard langsung tanpa login saat development
  if (!session && process.env.NODE_ENV === 'development') {
    session = {
      user: {
        id: 'dev-preview-user',
        name: 'Developer (Preview)',
        email: 'dev@morphic.local',
      },
      session: {
        id: 'dev-session-id',
        userId: 'dev-preview-user',
        expiresAt: new Date('2026-12-31T23:59:59Z'),
      },
    } as any;
  }

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

  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-900 font-body selection:bg-neutral-900 selection:text-white flex flex-col">
      <DashboardHeader session={session} balance={balance} />
      <div className="flex-1 w-full">
        {children}
      </div>
    </div>
  );
}

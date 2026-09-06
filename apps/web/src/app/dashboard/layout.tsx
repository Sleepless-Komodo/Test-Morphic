import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { auth } from '@/lib/auth';
import { SignOutButton } from './sign-out';

const nav = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/keys', label: 'API Keys' },
  { href: '/dashboard/models', label: 'Models' },
  { href: '/dashboard/usage', label: 'Usage' },
  { href: '/dashboard/billing', label: 'Billing' },
  { href: '/dashboard/redeem', label: 'Redeem' },
  { href: '/dashboard/settings', label: 'Settings' },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const [u] = await db.select().from(s.users).where(eq(s.users.id, session.user.id)).limit(1);
  if (!u || u.suspended) redirect('/login');

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r border-[var(--border)] p-4 flex flex-col gap-1 shrink-0">
        <Link href="/" className="font-bold text-lg mb-4 px-2">Morphic</Link>
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className="px-2 py-1.5 rounded-md text-sm hover:bg-[var(--card)]">
            {n.label}
          </Link>
        ))}
        {u.role === 'admin' && (
          <Link href="/admin" className="px-2 py-1.5 rounded-md text-sm text-[var(--accent)] hover:bg-[var(--card)] mt-2">
            Admin
          </Link>
        )}
        <div className="mt-auto px-2 text-sm text-[var(--muted)]">
          <div className="truncate">{u.email}</div>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-x-auto">{children}</main>
    </div>
  );
}

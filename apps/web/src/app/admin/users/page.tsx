import { desc, eq, sql } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { requireAdmin } from '@/lib/actions';
import { getServerTranslation } from '@/lib/i18n/server';
import { formatPageTotal, loadPage, readPage } from '@/lib/page-numbers';
import { cappedCount } from '@/lib/capped-count';
import { Pager } from '@/components/Pager';
import { Users as UsersIcon } from 'lucide-react';
import { UsersTable, type UserItem } from './users-table';

export const dynamic = 'force-dynamic';

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const admin = await requireAdmin('users:read');
  const { t, locale } = await getServerTranslation();
  const pageNo = readPage((await searchParams).page);

  const page = await loadPage(
    pageNo,
    (offset, limit) =>
      db
        .select({
          id: s.users.id,
          email: s.users.email,
          name: s.users.name,
          role: s.users.role,
          suspended: s.users.suspended,
          createdAt: s.users.createdAt,
          credits: s.balances.credits,
          // Bought token packs are entitlements, not balance credits; show them beside the wallet.
          packTokens: sql<number>`(
            select coalesce(sum(${s.entitlements.remaining}), 0)::bigint from ${s.entitlements}
            where ${s.entitlements.userId} = ${s.users.id} and ${s.entitlements.status} = 'active'
              and ${s.entitlements.unlimited} = false and ${s.entitlements.expiresAt} > now()
          )`,
        })
        .from(s.users)
        .leftJoin(s.balances, eq(s.users.id, s.balances.userId))
        .orderBy(desc(s.users.createdAt), desc(s.users.id))
        .limit(limit)
        .offset(offset),
    () => cappedCount(db.select({ id: s.users.id }).from(s.users).$dynamic()),
  );
  const users = page.items;

  const formattedUsers: UserItem[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    suspended: u.suspended,
    createdAt: u.createdAt.toISOString(),
    credits: u.credits ?? 0,
    packTokens: Number(u.packTokens ?? 0),
  }));

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-5 border-b border-neutral-200/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-extrabold tracking-tight text-neutral-950 flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-neutral-700" />
            {t.admin.users.title}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
            {t.admin.users.desc} ({formatPageTotal(page)})
          </p>
        </div>
      </div>

      {/* Interactive Users Table with Delete and Adjust capabilities */}
      <UsersTable users={formattedUsers} currentAdminId={admin.id} currentAdminRole={admin.role} />
      <Pager {...page} en={locale === 'en'} href={(p) => (p > 1 ? `/admin/users?page=${p}` : '/admin/users')} />
    </div>
  );
}

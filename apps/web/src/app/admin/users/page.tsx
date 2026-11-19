import { eq } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { requireAdmin } from '@/lib/actions';
import { getServerTranslation } from '@/lib/i18n/server';
import { PAGE_SIZE, cursorAt, keyset, readPageRequest, toPageBoth } from '@/lib/pagination';
import { Pager } from '@/components/Pager';
import { Users as UsersIcon } from 'lucide-react';
import { UsersTable, type UserItem } from './users-table';

export const dynamic = 'force-dynamic';

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ before?: string; after?: string }>;
}) {
  const admin = await requireAdmin('users:read');
  const { t, locale } = await getServerTranslation();
  const req = readPageRequest(await searchParams);
  const ks = keyset(s.users.createdAt, s.users.id, req);

  const page = toPageBoth(await db
    .select({
      id: s.users.id,
      email: s.users.email,
      name: s.users.name,
      role: s.users.role,
      suspended: s.users.suspended,
      createdAt: s.users.createdAt,
      credits: s.balances.credits,
      cursorAt: cursorAt(s.users.createdAt),
    })
    .from(s.users)
    .leftJoin(s.balances, eq(s.users.id, s.balances.userId))
    .where(ks.where)
    .orderBy(...ks.orderBy)
    .limit(PAGE_SIZE + 1), req);
  const users = page.items;

  const formattedUsers: UserItem[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    suspended: u.suspended,
    createdAt: u.createdAt.toISOString(),
    credits: u.credits ?? 0,
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
            {t.admin.users.desc} ({users.length})
          </p>
        </div>
      </div>

      {/* Interactive Users Table with Delete and Adjust capabilities */}
      <UsersTable users={formattedUsers} currentAdminId={admin.id} currentAdminRole={admin.role} />
      <Pager path="/admin/users" prevCursor={page.prevCursor} nextCursor={page.nextCursor} en={locale === 'en'} />
    </div>
  );
}

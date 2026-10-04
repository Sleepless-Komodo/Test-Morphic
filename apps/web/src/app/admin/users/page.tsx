import { desc, eq } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';
import { requireAdmin } from '@/lib/actions';
import { getServerTranslation } from '@/lib/i18n/server';
import { Users as UsersIcon } from 'lucide-react';
import { UsersTable, type UserItem } from './users-table';

export default async function AdminUsers() {
  const admin = await requireAdmin();
  const { t } = await getServerTranslation();

  const users = await db
    .select({
      id: s.users.id,
      email: s.users.email,
      name: s.users.name,
      role: s.users.role,
      suspended: s.users.suspended,
      createdAt: s.users.createdAt,
      credits: s.balances.credits,
    })
    .from(s.users)
    .leftJoin(s.balances, eq(s.users.id, s.balances.userId))
    .orderBy(desc(s.users.createdAt))
    .limit(100);

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
    <div className="space-y-6 max-w-6xl">
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
      <UsersTable users={formattedUsers} currentAdminId={admin.id} />
    </div>
  );
}

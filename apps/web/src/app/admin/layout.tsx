import { requireAdmin } from '@/lib/actions';
import { AdminShell } from './admin-shell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminUser = await requireAdmin('overview');
  return (
    <AdminShell
      user={{
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name || 'Admin',
        role: adminUser.role,
      }}
    >
      {children}
    </AdminShell>
  );
}

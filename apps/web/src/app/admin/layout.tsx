import { requireAdminForStepUp } from '@/lib/actions';
import { AdminShell } from './admin-shell';
import { ApiStatusBanner } from './api-status-banner';
import { StepUpWatcher } from './step-up-watcher';

// The step-up itself is enforced by `requireAdmin` in every admin page and action; the layout
// only renders the shell, so `/admin/verify` can show the OTP dialog inside it.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user: adminUser } = await requireAdminForStepUp();
  return (
    <AdminShell
      user={{
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name || 'Admin',
        role: adminUser.role,
      }}
    >
      <StepUpWatcher />
      <ApiStatusBanner />
      {children}
    </AdminShell>
  );
}

import { redirect } from 'next/navigation';
import { safeAdminNextPath } from '@morphic/shared/admin-step-up';
import { requireAdminForStepUp } from '@/lib/actions';
import { StepUpDialog } from '../step-up-dialog';

export const dynamic = 'force-dynamic';

export default async function AdminVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ user, required }, params] = await Promise.all([requireAdminForStepUp(), searchParams]);
  const next = safeAdminNextPath(params.next);
  if (!required) redirect(next);
  return <StepUpDialog email={user.email} next={next} />;
}

import { requireUser } from '@/lib/actions';
import { RedeemView } from './redeem-view';

// Same view for every role. Admins create codes in the admin panel (/admin/codes).
export default async function RedeemPage() {
  await requireUser();
  return <RedeemView />;
}

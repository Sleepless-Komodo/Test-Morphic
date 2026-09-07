import { requireUser } from '@/lib/actions';
import { RedeemView } from './redeem-view';

export default async function RedeemPage() {
  await requireUser();
  return <RedeemView />;
}

import { requireUser } from '@/lib/actions';
import { SettingsView } from './settings-view';

export default async function SettingsPage() {
  const user = await requireUser();
  return <SettingsView user={user} />;
}

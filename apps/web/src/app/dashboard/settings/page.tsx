import { listActiveSessions, requireUser } from '@/lib/actions';
import { SettingsView } from './settings-view';

export default async function SettingsPage() {
  const [user, sessions] = await Promise.all([requireUser(), listActiveSessions()]);
  return <SettingsView user={user} sessions={sessions} />;
}

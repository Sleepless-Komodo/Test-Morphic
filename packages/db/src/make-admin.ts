import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '../../.env') });
import { eq } from 'drizzle-orm';
import { ADMIN_ROLES, isAdminRole } from '@morphic/shared/admin-rbac';
import { db } from './index.ts';
import * as s from './schema.ts';

// Usage: pnpm --filter @morphic/db make-admin <email> [admin|super_admin|finance|support|security]
const email = process.argv[2];
const requestedRole = process.argv[3] ?? 'admin';
if (!email || !isAdminRole(requestedRole)) {
  console.error(`usage: make-admin <email> [${ADMIN_ROLES.join('|')}]`);
  process.exit(1);
}

const [u] = await db
  .update(s.users)
  .set({ role: requestedRole })
  .where(eq(s.users.email, email))
  .returning();
if (!u) {
  console.error(`no user with email ${email} (sign in once first)`);
  process.exit(1);
}
// Out-of-band privilege grant: leave the same trail as an in-app admin action (actor = CLI).
await db.insert(s.adminAuditLog).values({
  adminId: null,
  action: 'grant_admin',
  entity: 'user',
  entityId: u.id,
  detail: { actor: 'system_cli', email: u.email, role: requestedRole, osUser: process.env.USER ?? null },
});
console.log(`${u.email} is now ${requestedRole}`);
process.exit(0);

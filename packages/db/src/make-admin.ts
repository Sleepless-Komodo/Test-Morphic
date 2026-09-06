import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '../../.env') });
import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import * as s from './schema.ts';

// Usage: pnpm --filter @morphic/db make-admin <email>
const email = process.argv[2];
if (!email) {
  console.error('usage: make-admin <email>');
  process.exit(1);
}

const [u] = await db.update(s.users).set({ role: 'admin' }).where(eq(s.users.email, email)).returning();
if (!u) {
  console.error(`no user with email ${email} (sign in once first)`);
  process.exit(1);
}
console.log(`${u.email} is now admin`);
process.exit(0);

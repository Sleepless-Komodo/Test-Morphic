import { and, desc, eq, gte, ilike, lte, or, type SQL } from 'drizzle-orm';
import { db, schema as s } from '@morphic/db';

export interface AuditFilters {
  q?: string;
  action?: string;
  from?: string;
  to?: string;
}

function first(v: string | string[] | undefined): string | undefined {
  const x = Array.isArray(v) ? v[0] : v;
  return x?.trim() || undefined;
}

export function readAuditFilters(params: Record<string, string | string[] | undefined>): AuditFilters {
  return { q: first(params.q), action: first(params.action), from: first(params.from), to: first(params.to) };
}

/** Shared by the audit page and its CSV export so both apply identical filters. */
export function queryAuditLog(f: AuditFilters, limit: number) {
  const where: SQL[] = [];
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, '\\$&')}%`;
    where.push(or(ilike(s.users.email, like), ilike(s.adminAuditLog.entity, like), ilike(s.adminAuditLog.entityId, like))!);
  }
  if (f.action) where.push(eq(s.adminAuditLog.action, f.action));
  // Dates come from <input type="date"> and are read as whole days in WIB, the team's timezone.
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) where.push(gte(s.adminAuditLog.createdAt, new Date(`${f.from}T00:00:00+07:00`)));
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) where.push(lte(s.adminAuditLog.createdAt, new Date(`${f.to}T23:59:59.999+07:00`)));

  return db
    .select({
      id: s.adminAuditLog.id,
      action: s.adminAuditLog.action,
      entity: s.adminAuditLog.entity,
      entityId: s.adminAuditLog.entityId,
      detail: s.adminAuditLog.detail,
      createdAt: s.adminAuditLog.createdAt,
      adminEmail: s.users.email,
    })
    .from(s.adminAuditLog)
    .leftJoin(s.users, eq(s.adminAuditLog.adminId, s.users.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(s.adminAuditLog.createdAt))
    .limit(limit);
}

export async function listAuditActions(): Promise<string[]> {
  const rows = await db.selectDistinct({ action: s.adminAuditLog.action }).from(s.adminAuditLog).orderBy(s.adminAuditLog.action);
  return rows.map((r) => r.action);
}

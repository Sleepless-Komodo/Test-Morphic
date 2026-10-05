import { requireAdmin } from '@/lib/actions';
import { toCsv } from '@/lib/csv';
import { queryAuditLog, readAuditFilters } from '../query';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  await requireAdmin();
  const filters = readAuditFilters(Object.fromEntries(new URL(req.url).searchParams));
  // ponytail: 10k-row cap; stream if the log outgrows it.
  const rows = await queryAuditLog(filters, 10_000);
  const csv = toCsv(
    ['created_at', 'admin_email', 'action', 'entity', 'entity_id', 'detail'],
    rows.map((r) => [r.createdAt, r.adminEmail, r.action, r.entity, r.entityId, r.detail ? JSON.stringify(r.detail) : null]),
  );
  return new Response('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="morphic-audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

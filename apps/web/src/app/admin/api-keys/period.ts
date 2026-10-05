export const PERIODS = [
  { key: '24h', ms: 86_400_000, en: '24 hours', id: '24 jam' },
  { key: '7d', ms: 7 * 86_400_000, en: '7 days', id: '7 hari' },
  { key: '30d', ms: 30 * 86_400_000, en: '30 days', id: '30 hari' },
  { key: 'all', ms: null, en: 'All time', id: 'Semua' },
] as const;

export type Period = (typeof PERIODS)[number];

export function parsePeriod(v: string | undefined): { period: Period; since: Date | null } {
  const period = PERIODS.find((p) => p.key === v) ?? PERIODS[1];
  return { period, since: period.ms ? new Date(Date.now() - period.ms) : null };
}

export function keyStatus(k: { status: string; expiresAt: Date | null }): 'active' | 'revoked' | 'expired' {
  if (k.status === 'revoked') return 'revoked';
  if (k.expiresAt && k.expiresAt.getTime() < Date.now()) return 'expired';
  return 'active';
}

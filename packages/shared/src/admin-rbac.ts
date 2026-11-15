// Granular Admin RBAC & IP Allowlist helpers (FIX-P1-01).
// Pure TypeScript with zero Node-only imports so both Server Actions and client UI components can share it.

export const USER_ROLES = [
  'user',
  'admin',
  'super_admin',
  'finance',
  'support',
  'security',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ADMIN_ROLES = [
  'admin',
  'super_admin',
  'finance',
  'support',
  'security',
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ALL_ADMIN_PERMISSIONS = [
  'overview',
  'users:read',
  'users:write',
  'users:role',
  'users:delete',
  'finance:read',
  'finance:write',
  'catalog:read',
  'catalog:write',
  'codes:read',
  'codes:write',
  'security:read',
  'security:write',
  'announcements:read',
  'announcements:write',
] as const;

export type AdminPermission = (typeof ALL_ADMIN_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<AdminPermission>> = {
  // 'admin' is retained alongside 'super_admin' for backward compatibility with existing super-admin rows.
  admin: new Set(ALL_ADMIN_PERMISSIONS),
  super_admin: new Set(ALL_ADMIN_PERMISSIONS),
  finance: new Set<AdminPermission>([
    'overview',
    'finance:read',
    'finance:write',
    'codes:read',
    'codes:write',
    'security:read',
  ]),
  support: new Set<AdminPermission>([
    'overview',
    'users:read',
    'users:write',
    'finance:read',
    'announcements:read',
    'announcements:write',
    'security:read',
  ]),
  security: new Set<AdminPermission>([
    'overview',
    'security:read',
    'security:write',
    'users:read',
    'users:write',
    'catalog:read',
  ]),
};

export function isUserRole(role: string | null | undefined): role is UserRole {
  return typeof role === 'string' && (USER_ROLES as readonly string[]).includes(role);
}

export function isAdminRole(role: string | null | undefined): role is AdminRole {
  return typeof role === 'string' && (ADMIN_ROLES as readonly string[]).includes(role);
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'super_admin';
}

export function hasAdminPermission(
  role: string | null | undefined,
  permission: AdminPermission,
): boolean {
  if (!isAdminRole(role)) return false;
  return ROLE_PERMISSIONS[role].has(permission);
}

/**
 * Parse dotted IPv4 ("203.0.113.10") into an unsigned 32-bit bigint, or null if invalid.
 */
function parseIpv4(raw: string): bigint | null {
  const parts = raw.split('.');
  if (parts.length !== 4) return null;
  let out = 0n;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    if (part.length > 1 && part.startsWith('0')) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    out = (out << 8n) | BigInt(n);
  }
  return out;
}

/**
 * Parse IPv6 (including `::` compression and `::ffff:a.b.c.d` embedded IPv4) into 128-bit bigint.
 */
function parseIpv6(raw: string): bigint | null {
  const zoneIdx = raw.indexOf('%');
  const clean = (zoneIdx === -1 ? raw : raw.slice(0, zoneIdx)).toLowerCase();
  if (!clean || clean.includes(':::')) return null;

  let working = clean;
  // Handle trailing dotted IPv4 (e.g. ::ffff:192.0.2.128)
  if (working.includes('.')) {
    const lastColon = working.lastIndexOf(':');
    if (lastColon === -1) return null;
    const v4 = parseIpv4(working.slice(lastColon + 1));
    if (v4 === null) return null;
    const hi = Number((v4 >> 16n) & 0xffffn).toString(16);
    const lo = Number(v4 & 0xffffn).toString(16);
    working = `${working.slice(0, lastColon)}:${hi}:${lo}`;
  }

  const halves = working.split('::');
  if (halves.length > 2) return null;

  const parseGroups = (seg: string): number[] | null => {
    if (!seg) return [];
    const groups = seg.split(':');
    const nums: number[] = [];
    for (const g of groups) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
      nums.push(parseInt(g, 16));
    }
    return nums;
  };

  let groups: number[];
  if (halves.length === 2) {
    const left = parseGroups(halves[0]!);
    const right = parseGroups(halves[1]!);
    if (!left || !right) return null;
    const missing = 8 - (left.length + right.length);
    if (missing < 1) return null;
    groups = [...left, ...new Array<number>(missing).fill(0), ...right];
  } else {
    const full = parseGroups(halves[0]!);
    if (!full || full.length !== 8) return null;
    groups = full;
  }

  let out = 0n;
  for (const g of groups) {
    out = (out << 16n) | BigInt(g);
  }
  return out;
}

interface ParsedIp {
  version: 4 | 6;
  value: bigint;
}

const IPV4_MAPPED_PREFIX = 0xffff_0000_0000n;
const IPV4_MAPPED_MASK = ((1n << 96n) - 1n) << 32n;

function normalizeIp(raw: string): ParsedIp | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const v4 = parseIpv4(trimmed);
  if (v4 !== null) return { version: 4, value: v4 };
  const v6 = parseIpv6(trimmed);
  if (v6 === null) return null;
  // Canonicalize IPv4-mapped IPv6 (::ffff:a.b.c.d) to IPv4 so IPv4 rules match dual-stack sockets.
  if ((v6 & IPV4_MAPPED_MASK) === IPV4_MAPPED_PREFIX) {
    return { version: 4, value: v6 & 0xffff_ffffn };
  }
  return { version: 6, value: v6 };
}

function subnetMask(bits: number, prefix: number): bigint {
  if (prefix <= 0) return 0n;
  const hostBits = BigInt(bits - prefix);
  return (((1n << BigInt(prefix)) - 1n) << hostBits);
}

function matchesEntry(client: ParsedIp, entry: string): boolean {
  const slash = entry.indexOf('/');
  if (slash === -1) {
    const target = normalizeIp(entry);
    return target !== null && target.version === client.version && target.value === client.value;
  }
  const addrPart = entry.slice(0, slash).trim();
  const prefixPart = entry.slice(slash + 1).trim();
  if (!/^\d{1,3}$/.test(prefixPart)) return false;
  const prefix = Number(prefixPart);
  const net = normalizeIp(addrPart);
  if (!net || net.version !== client.version) return false;
  const totalBits = net.version === 4 ? 32 : 128;
  if (prefix < 0 || prefix > totalBits) return false;
  const mask = subnetMask(totalBits, prefix);
  return (client.value & mask) === (net.value & mask);
}

/**
 * Checks whether `clientIp` is permitted by `allowlistRaw` (`ADMIN_ALLOWED_IPS`).
 * - If `allowlistRaw` is unset or blank, returns `true` (opt-in enforcement).
 * - Once configured (comma-separated exact IPs and/or CIDRs, e.g. `203.0.113.10,10.0.0.0/8`),
 *   unknown/unparseable client IPs fail closed (`false`).
 */
export function isAdminIpAllowed(
  clientIp: string | null | undefined,
  allowlistRaw: string | null | undefined,
): boolean {
  const entries = (allowlistRaw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (entries.length === 0) return true;
  if (!clientIp || clientIp === 'unknown') return false;
  const parsed = normalizeIp(clientIp);
  if (!parsed) return false;
  return entries.some((entry) => matchesEntry(parsed, entry));
}

export function isLoopbackAdminIp(rawIp: string | null | undefined): boolean {
  if (!rawIp) return false;
  const trimmed = rawIp.trim().toLowerCase();
  if (trimmed === 'localhost' || trimmed === '127.0.0.1' || trimmed === '::1') return true;
  const parsed = normalizeIp(trimmed);
  if (!parsed) return false;
  if (parsed.version === 4) {
    // 127.0.0.0/8 loopback block
    return (parsed.value >> 24n) === 127n;
  }
  return parsed.value === 1n;
}

/**
 * Canonical string representation for an IP address so DB keys and comparisons
 * treat `::ffff:203.0.113.10` and `203.0.113.10` identically.
 */
export function canonicalizeAdminIp(rawIp: string | null | undefined): string | null {
  if (!rawIp) return null;
  const trimmed = rawIp.trim();
  if (!trimmed || trimmed === 'unknown') return null;
  if (trimmed.toLowerCase() === 'localhost') return '127.0.0.1';
  const parsed = normalizeIp(trimmed);
  if (!parsed) return null;
  if (parsed.version === 4) {
    const a = Number((parsed.value >> 24n) & 0xffn);
    const b = Number((parsed.value >> 16n) & 0xffn);
    const c = Number((parsed.value >> 8n) & 0xffn);
    const d = Number(parsed.value & 0xffn);
    return `${a}.${b}.${c}.${d}`;
  }
  const groups: string[] = [];
  for (let i = 7; i >= 0; i--) {
    const g = Number((parsed.value >> BigInt(i * 16)) & 0xffffn);
    groups.push(g.toString(16));
  }
  return groups.join(':');
}

/**
 * Compares two IP strings for admin session/step-up matching:
 * - IPv4: exact 32-bit match (including IPv4-mapped IPv6 `::ffff:a.b.c.d`).
 * - IPv6: matches on `/64` network prefix so Better Auth `/64`-collapsed session IPs
 *   (`2001:0db8:...:0000`) and SLAAC temporary privacy addresses on the same Wi-Fi/ISP
 *   router do not trigger false-positive Step-Up OTP prompts.
 */
/**
 * Network key for remembering a verified admin IP: the full address for IPv4, the /64 prefix
 * (as `a:b:c:d::`) for IPv6. Matches `isSameAdminIpOrIpv6Prefix`, so rotating IPv6 privacy
 * addresses inside one /64 do not trigger a new step-up.
 */
export function adminIpNetworkKey(rawIp: string | null | undefined): string | null {
  const canonical = canonicalizeAdminIp(rawIp);
  if (!canonical || !canonical.includes(':')) return canonical;
  return `${canonical.split(':').slice(0, 4).join(':')}::`;
}

export function isSameAdminIpOrIpv6Prefix(
  rawA: string | null | undefined,
  rawB: string | null | undefined,
): boolean {
  if (!rawA || !rawB) return false;
  const a = normalizeIp(rawA);
  const b = normalizeIp(rawB);
  if (!a || !b || a.version !== b.version) return false;
  if (a.version === 4) return a.value === b.value;
  return (a.value >> 64n) === (b.value >> 64n);
}

export interface AdminIpEvaluation {
  status: 'allowed' | 'step_up_required' | 'denied';
  canonicalClientIp: string | null;
  reason:
    | 'local_or_unknown'
    | 'allowlist_match'
    | 'allowlist_strict_deny'
    | 'step_up_trusted'
    | 'session_ip_match'
    | 'ip_changed_needs_otp'
    | 'outside_allowlist_needs_otp';
}

/**
 * Evaluates whether an admin request from `clientIp` should be allowed immediately,
 * challenged with a Step-Up Email OTP (`step_up_required`), or hard-denied (`denied`).
 *
 * - Default mode (`ADMIN_ALLOWED_IPS` unset):
 *   - Matches login `sessionIp` or an OTP-verified `trustedIps` entry -> `allowed`
 *   - New/changed public IP -> `step_up_required` (prevents stolen session cookie abuse without locking out dynamic ISP IPs)
 * - Allowlist mode (`ADMIN_ALLOWED_IPS` set):
 *   - Matches allowlist -> `allowed`
 *   - Outside allowlist -> `step_up_required` (or `denied` if `strictAllowlist` is true)
 */
export function evaluateAdminIpAccess(params: {
  clientIp: string | null | undefined;
  sessionIp: string | null | undefined;
  trustedIps?: Iterable<string>;
  allowlistRaw?: string | null;
  strictAllowlist?: boolean;
}): AdminIpEvaluation {
  const canonicalClientIp = canonicalizeAdminIp(params.clientIp);
  const trustedList: string[] = [];
  if (params.trustedIps) {
    for (const ip of params.trustedIps) {
      const c = canonicalizeAdminIp(ip);
      if (c) trustedList.push(c);
    }
  }
  const isTrustedClient = Boolean(
    canonicalClientIp &&
      trustedList.some((trusted) => isSameAdminIpOrIpv6Prefix(canonicalClientIp, trusted)),
  );

  const hasAllowlist = Boolean(params.allowlistRaw && params.allowlistRaw.trim());
  if (hasAllowlist) {
    if (isAdminIpAllowed(params.clientIp, params.allowlistRaw)) {
      return { status: 'allowed', canonicalClientIp, reason: 'allowlist_match' };
    }
    if (params.strictAllowlist) {
      return { status: 'denied', canonicalClientIp, reason: 'allowlist_strict_deny' };
    }
    if (isTrustedClient) {
      return { status: 'allowed', canonicalClientIp, reason: 'step_up_trusted' };
    }
    return { status: 'step_up_required', canonicalClientIp, reason: 'outside_allowlist_needs_otp' };
  }

  // Local dev / in-process test without proxy headers: do not prompt for OTP.
  if (!canonicalClientIp || isLoopbackAdminIp(canonicalClientIp)) {
    return { status: 'allowed', canonicalClientIp, reason: 'local_or_unknown' };
  }

  if (isTrustedClient) {
    return { status: 'allowed', canonicalClientIp, reason: 'step_up_trusted' };
  }

  const canonicalSessionIp = canonicalizeAdminIp(params.sessionIp);
  if (
    canonicalSessionIp &&
    !isLoopbackAdminIp(canonicalSessionIp) &&
    isSameAdminIpOrIpv6Prefix(canonicalClientIp, canonicalSessionIp)
  ) {
    return { status: 'allowed', canonicalClientIp, reason: 'session_ip_match' };
  }

  return { status: 'step_up_required', canonicalClientIp, reason: 'ip_changed_needs_otp' };
}

/**
 * Extract the trusted client IP from Next.js request headers using the same
 * anti-spoofing precedence as the API gateway (`apps/api/src/lib/ip.ts`):
 * - `cf-connecting-ip` ONLY when `TRUST_CF_CONNECTING_IP=1`
 * - Rightmost `x-forwarded-for` entry (proxy-appended hop, immune to client left-prepend)
 * - `x-real-ip` ONLY when `TRUST_X_REAL_IP=1`
 */
export function extractTrustedAdminIp(
  headers: Pick<Headers, 'get'>,
  env: Record<string, string | undefined> = process.env,
): string {
  if (env.TRUST_CF_CONNECTING_IP === '1') {
    const cf = headers.get('cf-connecting-ip')?.trim();
    if (cf) return cf;
  }
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const hops = xff
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1]!;
  }
  if (env.TRUST_X_REAL_IP === '1') {
    const real = headers.get('x-real-ip')?.trim();
    if (real) return real;
  }
  return 'unknown';
}

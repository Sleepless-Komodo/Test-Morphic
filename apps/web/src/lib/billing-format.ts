// Shared billing copy: token amounts, what a package delivers, and its price in the viewer's
// currency. Indonesian shows Rupiah (Duitku), English shows USD (PayPal); both buy the same package.
import { BALANCE_CREDITS_PER_IDR, IDR_PER_1M_BASE_TOKENS, IDR_PER_USD, TOKEN_PACK_HOURS, multiplier, packagePriceIdr, packagePriceUsdCents } from '@morphic/shared/credits';

export type PackageKind = 'balance' | 'tokens' | 'unlimited';

export interface BillingPackage {
  id: string;
  name: string;
  kind: PackageKind;
  creditAllowance: number;
  durationHours: number | null;
  priceCents: number | null;
  currency: string;
  modelDisplayName?: string | null;
  modelPublicId?: string | null;
}

/** "10 jt" / "10M": the number alone, for big display figures. */
export const fmtCompact = (n: number, en: boolean) =>
  new Intl.NumberFormat(en ? 'en-US' : 'id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

/** "10 jt token" / "10M tokens". 1 credit = 1 base token. */
export function fmtTokens(n: number, en: boolean): string {
  return `${fmtCompact(n, en)} ${en ? 'tokens' : 'token'}`;
}

/** Rupiah a balance is worth at the top-up rate, for the "≈ Rp" hint. */
export const balanceIdr = (credits: number) => Math.floor(credits / BALANCE_CREDITS_PER_IDR);

/** Balance credits as money at the top-up rate: "Rp20.000" / "$1.10". */
export function fmtBalance(credits: number, en: boolean): string {
  const idr = balanceIdr(credits);
  return en ? `$${(idr / IDR_PER_USD).toFixed(2)}` : `Rp${idr.toLocaleString('id-ID')}`;
}

export function fmtDuration(hours: number, en: boolean): string {
  if (hours % 24 === 0) {
    const d = hours / 24;
    return en ? `${d} day${d === 1 ? '' : 's'}` : `${d} hari`;
  }
  return en ? `${hours} hours` : `${hours} jam`;
}

/** The price as a number plus how to print it, so a price can be animated and still read "$1.00" or "Rp4.000". */
export function priceParts(
  pkg: Pick<BillingPackage, 'priceCents' | 'currency'>,
  en: boolean,
): { value: number; format: (value: number) => string } {
  const cents = pkg.priceCents ?? 0;
  return en
    ? { value: packagePriceUsdCents(cents, pkg.currency) / 100, format: (value) => `$${value.toFixed(2)}` }
    : { value: packagePriceIdr(cents, pkg.currency), format: (value) => `Rp${Math.round(value).toLocaleString('id-ID')}` };
}

/** Price in the viewer's currency, as the gateway will charge it (PayPal floor included). */
export function fmtPrice(pkg: Pick<BillingPackage, 'priceCents' | 'currency'>, en: boolean): string {
  const { value, format } = priceParts(pkg, en);
  return format(value);
}

/**
 * The undiscounted price, struck through next to a promo price: what the package is worth at the
 * base rate (token packs at Rp400 per 1M, balance at its Rupiah value). Null when the package is not
 * cheaper than that in the viewer's currency, e.g. both sit on the $1.00 PayPal floor.
 */
export function fmtListPrice(
  pkg: Pick<BillingPackage, 'kind' | 'creditAllowance' | 'priceCents' | 'currency'>,
  en: boolean,
): string | null {
  const listIdr =
    pkg.kind === 'tokens' ? Math.round((pkg.creditAllowance / 1_000_000) * IDR_PER_1M_BASE_TOKENS)
    : pkg.kind === 'balance' ? balanceIdr(pkg.creditAllowance)
    : 0;
  const list = priceParts({ priceCents: listIdr, currency: 'IDR' }, en);
  const price = priceParts(pkg, en);
  return listIdr > 0 && list.value > price.value ? list.format(list.value) : null;
}

/** One line on what the buyer gets and how it is charged. */
export function packageSummary(pkg: BillingPackage, en: boolean): string {
  const tokens = fmtTokens(pkg.creditAllowance, en);
  if (pkg.kind === 'unlimited') {
    const model = pkg.modelDisplayName ?? (en ? 'one model' : 'satu model');
    const span = fmtDuration(pkg.durationHours ?? 24, en);
    return en
      ? `${model} with no multiplier for ${span}, up to ${tokens} a day.`
      : `${model} tanpa multiplier selama ${span}, maksimal ${tokens} per hari.`;
  }
  if (pkg.kind === 'tokens') {
    const span = fmtDuration(pkg.durationHours ?? TOKEN_PACK_HOURS, en);
    return en
      ? `${tokens} for any model, charged by each model's multiplier. Valid ${span}.`
      : `${tokens} untuk semua model, dipotong sesuai multiplier model. Berlaku ${span}.`;
  }
  const money = fmtBalance(pkg.creditAllowance, en);
  return en
    ? `${money} added to your balance, spent at each model's per-token price. Never expires.`
    : `${money} masuk ke saldo, terpakai sesuai harga per token tiap model. Tidak hangus.`;
}

/** Per-account gateway limits shown next to a package; see `gateway-limits.ts` for the values. */
export interface GatewayLimits {
  maxKeys: number;
  rpmPerKey: number;
  concurrentPerKey: number;
}

/** The big figure on a pricing card and the unit under it. */
export function packageHeadline(pkg: BillingPackage, en: boolean): { amount: string; unit: string } {
  if (pkg.kind === 'unlimited') {
    const perDay = fmtTokens(pkg.creditAllowance, en);
    return {
      amount: fmtDuration(pkg.durationHours ?? 24, en),
      unit: en ? `up to ${perDay} a day` : `maks ${perDay} per hari`,
    };
  }
  if (pkg.kind === 'tokens') return { amount: fmtCompact(pkg.creditAllowance, en), unit: en ? 'tokens' : 'token' };
  return { amount: fmtBalance(pkg.creditAllowance, en), unit: en ? 'balance' : 'saldo' };
}

function limitFeatures(limits: GatewayLimits, en: boolean): string[] {
  return en
    ? [`${limits.maxKeys} API keys per account`, `${limits.rpmPerKey} requests/min, ${limits.concurrentPerKey} at once, per key`]
    : [`${limits.maxKeys} API key per akun`, `${limits.rpmPerKey} request/menit, ${limits.concurrentPerKey} bersamaan, per key`];
}

/** Short bullet list for a pricing card: what this kind of package does, then the limits every account has. */
export function packageFeatures(pkg: BillingPackage, en: boolean, limits: GatewayLimits): string[] {
  const tokens = fmtTokens(pkg.creditAllowance, en);
  if (pkg.kind === 'unlimited') {
    const model = pkg.modelDisplayName ?? (en ? 'one model' : 'satu model');
    const span = fmtDuration(pkg.durationHours ?? 24, en);
    return [
      en ? `${model} only` : `Khusus ${model}`,
      en ? 'No multiplier' : 'Tanpa multiplier',
      en ? `Fair use up to ${tokens} a day` : `Fair use hingga ${tokens} per hari`,
      en ? `Active for ${span}` : `Aktif ${span}`,
      ...limitFeatures(limits, en),
    ];
  }
  if (pkg.kind === 'tokens') {
    const span = fmtDuration(pkg.durationHours ?? TOKEN_PACK_HOURS, en);
    return [
      en ? `${tokens} for any model` : `${tokens} untuk semua model`,
      en ? "Charged by each model's multiplier" : 'Dipotong sesuai multiplier model',
      en ? `Valid ${span}` : `Berlaku ${span}`,
      ...limitFeatures(limits, en),
    ];
  }
  return [
    en ? "Spent at each model's per-token price" : 'Terpakai sesuai harga per token tiap model',
    en ? 'Never expires' : 'Tidak hangus',
    ...limitFeatures(limits, en),
  ];
}

export interface PricingColumn {
  kind: PackageKind;
  title: string;
  /** The cheapest package of this kind, which the column's button opens. */
  packageId: string;
  price: string;
}

export interface PricingMatrix {
  columns: PricingColumn[];
  groups: { title: string; rows: { name: string; cells: (string | boolean)[] }[] }[];
}

const MATRIX_KINDS: PackageKind[] = ['balance', 'tokens', 'unlimited'];

/**
 * Comparison of the kinds of package that are really on sale. Only facts we can back: what each
 * kind delivers (from the package rows) and the limits that apply to every account alike.
 */
export function buildPricingMatrix(packages: BillingPackage[], en: boolean, limits: GatewayLimits): PricingMatrix {
  const cheapestByKind = new Map<PackageKind, BillingPackage>();
  for (const pkg of [...packages].sort((a, b) => (a.priceCents ?? 0) - (b.priceCents ?? 0))) {
    if (!cheapestByKind.has(pkg.kind)) cheapestByKind.set(pkg.kind, pkg);
  }
  const kinds = MATRIX_KINDS.filter((kind) => cheapestByKind.has(kind));
  const pick = <T,>(by: Record<PackageKind, T>): T[] => kinds.map((kind) => by[kind]);
  const sameForAll = (value: string | boolean) => kinds.map(() => value);

  const titles: Record<PackageKind, string> = {
    balance: en ? 'Balance top-up' : 'Isi saldo',
    tokens: en ? 'Token pack' : 'Token pack',
    unlimited: en ? 'Unlimited pass' : 'Pass unlimited',
  };
  const columns = kinds.map((kind): PricingColumn => {
    const pkg = cheapestByKind.get(kind)!;
    return { kind, title: titles[kind], packageId: pkg.id, price: fmtPrice(pkg, en) };
  });

  const headline = (kind: PackageKind) => {
    const { amount, unit } = packageHeadline(cheapestByKind.get(kind)!, en);
    return `${amount} ${unit}`;
  };
  const validity = (kind: PackageKind) => {
    const hours = cheapestByKind.get(kind)!.durationHours;
    if (kind === 'balance') return en ? 'Never expires' : 'Tidak hangus';
    return fmtDuration(hours ?? (kind === 'tokens' ? TOKEN_PACK_HOURS : 24), en);
  };
  const passModels = [...new Set(packages.filter((p) => p.kind === 'unlimited').map((p) => p.modelDisplayName).filter(Boolean))];
  const allModels = en ? 'All models' : 'Semua model';

  return {
    columns,
    groups: [
      {
        title: en ? 'What you buy' : 'Yang Anda beli',
        rows: [
          { name: en ? 'Starting at' : 'Mulai dari', cells: columns.map((c) => c.price) },
          { name: en ? 'You get (smallest)' : 'Yang didapat (terkecil)', cells: kinds.map(headline) },
          { name: en ? 'Valid for' : 'Berlaku', cells: kinds.map(validity) },
          {
            name: en ? 'Models' : 'Model',
            cells: pick({ balance: allModels, tokens: allModels, unlimited: passModels.length ? passModels.join(', ') : en ? 'One model per pass' : 'Satu model per pass' }),
          },
          {
            name: en ? 'Charged by' : 'Dipotong menurut',
            cells: pick({
              balance: en ? 'Per-token price of each model' : 'Harga per token tiap model',
              tokens: en ? 'Model multiplier' : 'Multiplier model',
              unlimited: en ? 'No multiplier (daily fair use)' : 'Tanpa multiplier (fair use harian)',
            }),
          },
        ],
      },
      {
        title: en ? 'Same on every package' : 'Sama di semua paket',
        rows: [
          { name: en ? 'API keys per account' : 'API key per akun', cells: sameForAll(String(limits.maxKeys)) },
          { name: en ? 'Rate limit per key' : 'Batas per key', cells: sameForAll(`${limits.rpmPerKey} RPM`) },
          { name: en ? 'Requests at once per key' : 'Request bersamaan per key', cells: sameForAll(String(limits.concurrentPerKey)) },
          { name: en ? 'OpenAI-compatible API (/v1)' : 'API kompatibel OpenAI (/v1)', cells: sameForAll(true) },
          { name: en ? 'Streaming (SSE)' : 'Streaming (SSE)', cells: sameForAll(true) },
          { name: en ? 'Payment' : 'Pembayaran', cells: sameForAll(en ? 'PayPal (USD)' : 'QRIS (Rupiah)') },
        ],
      },
    ],
  };
}

/** A model price (credits per 1M) as its token multiplier: "520x", "5,2x". */
export function fmtMultiplier(per1m: number, en = false): string {
  const x = multiplier(per1m);
  // Below 0.1x one decimal would round a real price down to "0x"; keep two significant digits.
  const opts = x > 0 && x < 0.1 ? { maximumSignificantDigits: 2 } : { maximumFractionDigits: x < 10 ? 1 : 0 };
  return `${x.toLocaleString(en ? 'en-US' : 'id-ID', opts)}x`;
}

/** What 1M tokens of that model cost out of a token pack: "Rp208.000/1M". */
export const fmtIdrPer1m = (per1m: number) => `Rp${Math.ceil(multiplier(per1m) * IDR_PER_1M_BASE_TOKENS).toLocaleString('id-ID')}/1M`;

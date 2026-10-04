import type { CatalogModel } from './provider-catalog';

/** Average Rupiah actually paid per credit sold. Null until something has been sold. */
export function rupiahPerCredit(paidIdr: number, creditsSold: number): number | null {
  return creditsSold > 0 ? paidIdr / creditsSold : null;
}

/** Provider price for the model id we send upstream; exact match first, then case-insensitive. */
export function findPrice(catalog: CatalogModel[] | undefined, providerModelId: string): CatalogModel | null {
  if (!catalog) return null;
  const lower = providerModelId.toLowerCase();
  return catalog.find((m) => m.id === providerModelId) ?? catalog.find((m) => m.id.toLowerCase() === lower) ?? null;
}

/** Upstream cost in Rupiah, or null when the provider doesn't publish a price we need. */
export function costIdr(
  promptTokens: number,
  completionTokens: number,
  price: Pick<CatalogModel, 'inputPerM' | 'outputPerM'> | null,
  idrPerUsd: number,
): number | null {
  if (!price) return null;
  const inPart = promptTokens === 0 ? 0 : price.inputPerM === null ? null : (promptTokens / 1e6) * price.inputPerM;
  const outPart = completionTokens === 0 ? 0 : price.outputPerM === null ? null : (completionTokens / 1e6) * price.outputPerM;
  return inPart === null || outPart === null ? null : (inPart + outPart) * idrPerUsd;
}

export function margin(revenue: number | null, cost: number | null) {
  if (revenue === null || cost === null) return { margin: null, pct: null };
  const m = revenue - cost;
  return { margin: m, pct: revenue > 0 ? (m / revenue) * 100 : null };
}

// Validation for the admin model create/edit form. Pure so it can be unit tested.

export const MODEL_STATUSES = ['active', 'inactive', 'deprecated'] as const;
export type ModelStatus = (typeof MODEL_STATUSES)[number];

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PG_INT4 = 2_147_483_647;

export interface ParsedModelValues {
  providerId: string;
  publicModelId: string;
  providerModelId: string;
  displayName: string;
  description: string | null;
  contextLength: number;
  capabilities: string[];
  inputCreditsPer1m: number;
  outputCreditsPer1m: number;
  status: ModelStatus;
  providerCostInputPer1m?: number | null;
  providerCostOutputPer1m?: number | null;
}

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

function parseOptionalNonNegInt(
  raw: string,
  en: boolean,
  labelEn: string,
  labelId: string,
): { value: number | null } | { error: string } {
  if (raw === '') return { value: null };
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 0) {
    return {
      error: en
        ? `${labelEn} must be a whole number of 0 or more, or empty. (kode: invalid_input)`
        : `${labelId} harus bilangan bulat 0 atau lebih, atau dikosongkan. (kode: invalid_input)`,
    };
  }
  return { value: n };
}

/** Validate and normalize `FormData` for creating or updating a catalog model. */
export function parseModelForm(
  formData: FormData,
  en = true,
): { values: ParsedModelValues } | { error: string } {
  const str = (k: string) => String(formData.get(k) ?? '').trim();

  const providerId = str('providerId');
  if (!providerId || !isUuid(providerId)) {
    return {
      error: en
        ? 'Select a valid upstream provider first. (kode: invalid_provider)'
        : 'Pilih provider upstream yang valid terlebih dahulu. (kode: invalid_provider)',
    };
  }

  const publicModelId = str('publicModelId');
  if (!publicModelId) {
    return {
      error: en
        ? 'Public Model ID is required. (kode: invalid_input)'
        : 'Public Model ID wajib diisi. (kode: invalid_input)',
    };
  }
  if (publicModelId.length > 200) {
    return {
      error: en
        ? 'Public Model ID must be at most 200 characters. (kode: invalid_input)'
        : 'Public Model ID maksimal 200 karakter. (kode: invalid_input)',
    };
  }

  const providerModelId = str('providerModelId');
  if (!providerModelId) {
    return {
      error: en
        ? 'Provider Model ID is required. (kode: invalid_input)'
        : 'Provider Model ID wajib diisi. (kode: invalid_input)',
    };
  }
  if (providerModelId.length > 200) {
    return {
      error: en
        ? 'Provider Model ID must be at most 200 characters. (kode: invalid_input)'
        : 'Provider Model ID maksimal 200 karakter. (kode: invalid_input)',
    };
  }

  const displayName = str('displayName');
  if (!displayName) {
    return {
      error: en
        ? 'Display Name is required. (kode: invalid_input)'
        : 'Display Name wajib diisi. (kode: invalid_input)',
    };
  }
  if (displayName.length > 200) {
    return {
      error: en
        ? 'Display Name must be at most 200 characters. (kode: invalid_input)'
        : 'Display Name maksimal 200 karakter. (kode: invalid_input)',
    };
  }

  const rawDescription = str('description');
  if (rawDescription.length > 1000) {
    return {
      error: en
        ? 'Description must be at most 1000 characters. (kode: invalid_input)'
        : 'Deskripsi maksimal 1000 karakter. (kode: invalid_input)',
    };
  }

  const capabilities = Array.from(
    new Set(
      str('capabilities')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  );

  const rawContext = str('contextLength');
  const contextLength = rawContext === '' ? NaN : Number(rawContext);
  if (!Number.isSafeInteger(contextLength) || contextLength < 1024 || contextLength > MAX_PG_INT4) {
    return {
      error: en
        ? `Context length must be a whole number between 1,024 and ${MAX_PG_INT4.toLocaleString('en-US')}. (kode: invalid_input)`
        : `Context length harus bilangan bulat antara 1.024 hingga ${MAX_PG_INT4.toLocaleString('id-ID')}. (kode: invalid_input)`,
    };
  }

  const rawIn = str('inputCreditsPer1m');
  const inputCreditsPer1m = rawIn === '' ? NaN : Number(rawIn);
  if (!Number.isSafeInteger(inputCreditsPer1m) || inputCreditsPer1m < 1) {
    return {
      error: en
        ? 'Input Credits / 1M must be a whole number of at least 1. (kode: invalid_input)'
        : 'Input Credits / 1M harus bilangan bulat minimal 1. (kode: invalid_input)',
    };
  }

  const rawOut = str('outputCreditsPer1m');
  const outputCreditsPer1m = rawOut === '' ? NaN : Number(rawOut);
  if (!Number.isSafeInteger(outputCreditsPer1m) || outputCreditsPer1m < 1) {
    return {
      error: en
        ? 'Output Credits / 1M must be a whole number of at least 1. (kode: invalid_input)'
        : 'Output Credits / 1M harus bilangan bulat minimal 1. (kode: invalid_input)',
    };
  }

  const rawStatus = str('status');
  const status = rawStatus === '' ? 'active' : MODEL_STATUSES.find((s) => s === rawStatus);
  if (!status) {
    return {
      error: en
        ? 'Status must be active, inactive, or deprecated. (kode: invalid_input)'
        : 'Status harus active, inactive, atau deprecated. (kode: invalid_input)',
    };
  }

  const values: ParsedModelValues = {
    providerId,
    publicModelId,
    providerModelId,
    displayName,
    description: rawDescription || null,
    contextLength,
    capabilities,
    inputCreditsPer1m,
    outputCreditsPer1m,
    status,
  };

  if (formData.has('providerCostInputPer1m')) {
    const parsedCostIn = parseOptionalNonNegInt(
      str('providerCostInputPer1m'),
      en,
      'Upstream cost in / 1M',
      'Upstream cost in / 1M',
    );
    if ('error' in parsedCostIn) return { error: parsedCostIn.error };
    values.providerCostInputPer1m = parsedCostIn.value;
  }

  if (formData.has('providerCostOutputPer1m')) {
    const parsedCostOut = parseOptionalNonNegInt(
      str('providerCostOutputPer1m'),
      en,
      'Upstream cost out / 1M',
      'Upstream cost out / 1M',
    );
    if ('error' in parsedCostOut) return { error: parsedCostOut.error };
    values.providerCostOutputPer1m = parsedCostOut.value;
  }

  return { values };
}

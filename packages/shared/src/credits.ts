export interface ModelPricing {
  inputCreditsPer1m: number;
  outputCreditsPer1m: number;
}

export interface ReservationInput {
  promptTokens: number;
  requestedMaxTokens: number | null;
  modelContextLength: number;
  hardReserveCap: number;
  pricing: ModelPricing;
}

export function estimatePromptTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function tokensToCredits(tokens: number, creditsPer1m: number): number {
  return Math.ceil((tokens * creditsPer1m) / 1_000_000);
}

export function reserveOutputCap(input: ReservationInput): number {
  const cap = Math.min(
    input.requestedMaxTokens ?? input.modelContextLength,
    input.modelContextLength,
    input.hardReserveCap,
  );
  return Math.max(cap, 0);
}

export function estimateReservation(input: ReservationInput): number {
  const inputCredits = tokensToCredits(input.promptTokens, input.pricing.inputCreditsPer1m);
  const outputCredits = tokensToCredits(
    reserveOutputCap(input),
    input.pricing.outputCreditsPer1m,
  );
  return inputCredits + outputCredits;
}

export function actualUsageCredits(
  promptTokens: number,
  completionTokens: number,
  pricing: ModelPricing,
): number {
  return (
    tokensToCredits(promptTokens, pricing.inputCreditsPer1m) +
    tokensToCredits(completionTokens, pricing.outputCreditsPer1m)
  );
}

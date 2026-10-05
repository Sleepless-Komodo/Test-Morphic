// Same conversion the checkout uses for USD packages (apps/api/src/routes/payments.ts).
export const IDR_PER_USD = 16_000;

export const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

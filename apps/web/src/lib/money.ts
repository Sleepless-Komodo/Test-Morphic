// Same rate the checkout charges with (single source in @morphic/shared).
export { IDR_PER_USD } from '@morphic/shared/credits';

export const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

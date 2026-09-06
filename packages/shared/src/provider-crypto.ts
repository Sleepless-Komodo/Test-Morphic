import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';

function key(): Buffer {
  const hex = process.env.PROVIDER_ENC_KEY;
  if (!hex || hex.length !== 64 || /^0+$/.test(hex)) {
    throw new Error('PROVIDER_ENC_KEY must be 64-char (32-byte) hex, not all zeros');
  }
  return Buffer.from(hex, 'hex');
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64url'), tag.toString('base64url'), enc.toString('base64url')].join('.');
}

export function decrypt(payload: string): string {
  const [ivB, tagB, dataB] = payload.split('.');
  if (!ivB || !tagB || !dataB) throw new Error('malformed encrypted credential');
  const decipher = createDecipheriv(
    ALGO,
    key(),
    Buffer.from(ivB, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagB, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function resolveProviderCredential(
  encrypted: string | null,
  reference: string | null,
): string | null {
  if (encrypted) return decrypt(encrypted);
  if (reference?.startsWith('env:')) return process.env[reference.slice(4)] ?? null;
  return null;
}

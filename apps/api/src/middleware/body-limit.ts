import { bodyLimit } from 'hono/body-limit';

export const MANAGEMENT_MAX_BODY_BYTES = 1 * 1024 * 1024; // 1 MiB
export const WEBHOOK_MAX_BODY_BYTES = 1 * 1024 * 1024; // 1 MiB

/** Human label for a byte limit in 413 messages: whole MiB as "10MB", otherwise KB. */
export function formatBodyLimit(bytes: number): string {
  const mib = 1024 * 1024;
  return bytes % mib === 0 ? `${bytes / mib}MB` : `${Math.ceil(bytes / 1024)}KB`;
}

export function jsonBodyLimit(maxBytes: number, maxLabel: string) {
  return bodyLimit({
    maxSize: maxBytes,
    onError: (c) =>
      c.json(
        {
          error: {
            message: `payload too large, maximum allowed size is ${maxLabel}`,
            type: 'invalid_request_error',
            code: 'payload_too_large',
          },
        },
        413,
      ),
  });
}

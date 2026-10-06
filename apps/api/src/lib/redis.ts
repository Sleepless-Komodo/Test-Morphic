import { Redis } from 'ioredis';

/** Shared Redis client, or null when REDIS_URL is unset (callers fall back to in-process state). */
function createClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const client = new Redis(url, { maxRetriesPerRequest: 2 });
    client.on('error', (e: unknown) => console.error('[redis] error:', e));
    return client;
  } catch (e) {
    console.error('[redis] init failed, falling back to in-memory state:', e);
    return null;
  }
}

export const redis = createClient();

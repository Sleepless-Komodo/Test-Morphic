import type { Redis } from 'ioredis';
import type { IRateLimitStore } from '../ratelimit';

/**
 * Redis-backed rate-limit store. Chosen when REDIS_URL is set so limits survive
 * process restarts and hold across instances (audit M1). Counters use INCR+EXPIRE;
 * concurrency uses a sorted set scored by timestamp so stale tokens self-expire.
 */
export class RedisRateLimitStore implements IRateLimitStore {
  constructor(private readonly redis: Redis) {}

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, ttlSeconds);
    return count;
  }

  /**
   * Atomically prune stale slots, count active slots, and conditionally add
   * a new token — all in a single Lua eval to eliminate the TOCTOU race
   * between getConcurrency and addConcurrency.
   *
   * Returns: 1 if the slot was acquired, 0 if the limit was already reached.
   *
   * KEYS[1] = sorted-set key (e.g. "cc:<keyId>")
   * ARGV[1] = minTimestampMs  (stale threshold — prune scores ≤ this)
   * ARGV[2] = max concurrency slots
   * ARGV[3] = new token member
   * ARGV[4] = current timestampMs (score for the new token)
   * ARGV[5] = TTL in seconds for the sorted set
   */
  private static readonly ACQUIRE_SCRIPT = `
    local key   = KEYS[1]
    local minTs = tonumber(ARGV[1])
    local max   = tonumber(ARGV[2])
    local token = ARGV[3]
    local score = tonumber(ARGV[4])
    local ttl   = tonumber(ARGV[5])

    redis.call('ZREMRANGEBYSCORE', key, 0, minTs)
    local current = redis.call('ZCARD', key)
    if current >= max then
      return 0
    end
    redis.call('ZADD', key, score, token)
    redis.call('EXPIRE', key, ttl)
    return 1
  ` as const;

  /**
   * Atomically try to acquire a concurrency slot.
   * Returns true if the slot was granted, false if the limit is reached.
   *
   * Replaces the old getConcurrency + addConcurrency two-step which had a
   * race window: two concurrent callers could both read count < max and both
   * be admitted, pushing active count above the limit.
   */
  async acquireConcurrency(
    setKey: string,
    token: string,
    timestampMs: number,
    max: number,
    ttlSeconds: number,
  ): Promise<boolean> {
    const minTimestampMs = timestampMs - ttlSeconds * 1000;
    const result = await this.redis.eval(
      RedisRateLimitStore.ACQUIRE_SCRIPT,
      1,          // number of KEYS
      setKey,     // KEYS[1]
      String(minTimestampMs), // ARGV[1]
      String(max),            // ARGV[2]
      token,                  // ARGV[3]
      String(timestampMs),    // ARGV[4]
      String(ttlSeconds),     // ARGV[5]
    );
    return result === 1;
  }

  // getConcurrency and addConcurrency are kept to satisfy the IRateLimitStore
  // interface (used by InMemoryRateLimitStore compatibility). Redis callers
  // should use acquireConcurrency instead.
  async getConcurrency(setKey: string, minTimestampMs: number): Promise<number> {
    await this.redis.zremrangebyscore(setKey, 0, minTimestampMs);
    return this.redis.zcard(setKey);
  }

  async addConcurrency(setKey: string, token: string, timestampMs: number): Promise<void> {
    await this.redis.zadd(setKey, timestampMs, token);
    await this.redis.expire(setKey, 600);
  }

  async removeConcurrency(setKey: string, token: string): Promise<void> {
    await this.redis.zrem(setKey, token);
  }
}

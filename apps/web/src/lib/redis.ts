import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as { redis: Redis };

export const redis =
  globalForRedis.redis ||
  new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

const CACHE_TTL = 300; // 5 minutes

export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttl = CACHE_TTL
): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch {
    // Redis unavailable — fall through to fn
  }

  const result = await fn();

  try {
    await redis.set(key, JSON.stringify(result), 'EX', ttl);
  } catch {
    // Redis unavailable — ignore
  }

  return result;
}

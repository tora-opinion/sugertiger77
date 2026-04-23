import type { Env, RateLimitEntry } from '../types';

type LimiterName = 'upload' | 'cdn';

export async function checkRateLimit(
  env: Env,
  key: string,
  max: number,
  windowSec: number,
  limiterName: LimiterName,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  try {
    const rateLimiter =
      limiterName === 'upload' ? env.RATE_LIMITER_UPLOAD : env.RATE_LIMITER_CDN;
    if (rateLimiter) {
      const result = await rateLimiter.limit({ key });
      return {
        allowed: result.success,
        remaining: -1,
        resetAt: 0,
      };
    }

    const kv = env.RATE_LIMIT_KV;
    const kvKey = `rl:${key}`;
    const now = Math.floor(Date.now() / 1000);
    const entry = await kv.get<RateLimitEntry>(kvKey, 'json');

    if (!entry || entry.resetAt <= now) {
      const newEntry: RateLimitEntry = { count: 1, resetAt: now + windowSec };
      await kv.put(kvKey, JSON.stringify(newEntry), {
        expirationTtl: windowSec + 10,
      });
      return { allowed: true, remaining: max - 1, resetAt: newEntry.resetAt };
    }

    if (entry.count >= max) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    const ttl = entry.resetAt - now + 10;
    await kv.put(kvKey, JSON.stringify(entry), {
      expirationTtl: ttl > 10 ? ttl : 10,
    });
    return {
      allowed: true,
      remaining: max - entry.count,
      resetAt: entry.resetAt,
    };
  } catch (err) {
    console.error('Rate limit KV error:', err);
    const allowed = limiterName === 'cdn';
    return { allowed, remaining: -1, resetAt: 0 };
  }
}

import type { RateLimitEntry } from '../types';

export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  max: number,
  windowSec: number,
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
  unavailable?: boolean;
}> {
  const kvKey = `rl:${key}`;
  const now = Math.floor(Date.now() / 1000);
  let entry: RateLimitEntry | null;

  try {
    entry = await kv.get<RateLimitEntry>(kvKey, 'json');
  } catch {
    console.error('Rate limit KV error');
    return { allowed: false, remaining: 0, resetAt: 0, unavailable: true };
  }

  if (!entry || entry.resetAt <= now) {
    const newEntry: RateLimitEntry = { count: 1, resetAt: now + windowSec };
    try {
      await kv.put(kvKey, JSON.stringify(newEntry), {
        expirationTtl: windowSec + 10,
      });
    } catch {
      // KV limits writes to a key and concurrent writes can conflict. A failed
      // best-effort update may undercount, but must not turn a valid burst into 503s.
    }
    return { allowed: true, remaining: max - 1, resetAt: newEntry.resetAt };
  }

  if (
    !Number.isSafeInteger(entry.count) ||
    entry.count < 1 ||
    !Number.isSafeInteger(entry.resetAt)
  ) {
    console.error('Invalid rate limit KV entry');
    return { allowed: false, remaining: 0, resetAt: 0, unavailable: true };
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  const ttl = entry.resetAt - now + 10;
  try {
    await kv.put(kvKey, JSON.stringify(entry), {
      expirationTtl: ttl > 10 ? ttl : 10,
    });
  } catch {
    // Keep write failures permissive; KV's per-key write cap makes bursts lossy.
  }
  return {
    allowed: true,
    remaining: max - entry.count,
    resetAt: entry.resetAt,
  };
}

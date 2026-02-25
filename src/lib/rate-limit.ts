import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

const isRedisConfigured =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = isRedisConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

function createLimiter(window: Parameters<typeof Ratelimit.slidingWindow>, prefix: string) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(...window),
    prefix,
  });
}

/** Login: 5 attempts per 15 minutes (by IP) */
export const loginLimiter = createLimiter([5, "15 m"], "rl:login");

/** Bid: 30 per minute (by userId) */
export const bidLimiter = createLimiter([30, "1 m"], "rl:bid");

/** Invite: 10 per hour (by userId) */
export const inviteLimiter = createLimiter([10, "1 h"], "rl:invite");

/** Upload: 20 per hour (by userId) */
export const uploadLimiter = createLimiter([20, "1 h"], "rl:upload");

/** Public API: 100 per minute (by IP) */
export const publicApiLimiter = createLimiter([100, "1 m"], "rl:public");

/**
 * Check rate limit and return 429 response if exceeded, or null if OK.
 * If Redis is not configured, always returns null (allows request).
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<NextResponse | null> {
  if (!limiter) return null;

  try {
    const { success, reset } = await limiter.limit(identifier);
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Previse zahteva. Pokusajte ponovo kasnije." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        }
      );
    }
  } catch {
    // Redis down - allow request through
  }
  return null;
}

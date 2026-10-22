import type { Env } from '../src/types';
import { checkRateLimit } from '../src/protection/rate-limiter';
import { detectBot } from '../src/protection/bot-detector';
import { isHotlink } from '../src/protection/hotlink-guard';
import { errorResponse, corsHeaders } from '../src/utils/response';
import { getConfig } from '../src/config';

interface Context {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}

async function securityMiddleware(context: Context): Promise<Response> {
  try {
    const response = await context.next();
    const origin = context.request.headers.get('origin');
    const cors = corsHeaders(origin);

    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (!headers.has('Cache-Control')) {
      headers.set('Cache-Control', 'no-store');
    }
    for (const [k, v] of Object.entries(cors)) {
      if (v) headers.set(k, v);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    console.error('securityMiddleware error');
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function botMiddleware(context: Context): Promise<Response> {
  try {
    const url = new URL(context.request.url);
    if (
      url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/cdn/') ||
      url.pathname.startsWith('/preview/')
    ) {
      const check = detectBot(context.request);
      if (check.isBot) {
        return errorResponse(`Blocked: ${check.reason}`, 403);
      }
    }
    return context.next();
  } catch {
    console.error('botMiddleware error');
    return errorResponse('Request check unavailable', 503);
  }
}

async function rateLimitResponse(
  context: Context,
  key: string,
  max: number,
  windowSec: number,
): Promise<Response | null> {
  const result = await checkRateLimit(
    context.env.RATE_LIMIT_KV,
    key,
    max,
    windowSec,
  );
  if (result.unavailable) {
    return errorResponse('Rate limiter unavailable', 503);
  }
  return result.allowed ? null : errorResponse('Rate limit exceeded', 429);
}

async function rateLimitMiddleware(context: Context): Promise<Response> {
  try {
    const url = new URL(context.request.url);
    const ip =
      context.request.headers.get('cf-connecting-ip') || 'unknown';
    const cfg = getConfig(context.env);

    if (url.pathname === '/api/upload' && context.request.method === 'POST') {
      const limited = await rateLimitResponse(
        context,
        `upload:${ip}`,
        cfg.rateLimits.upload.max,
        cfg.rateLimits.upload.windowSec,
      );
      if (limited) return limited;
    }

    if (url.pathname === '/api/auth' && context.request.method === 'POST') {
      const limited = await rateLimitResponse(
        context,
        `auth:${ip}`,
        cfg.rateLimits.auth.max,
        cfg.rateLimits.auth.windowSec,
      );
      if (limited) return limited;
    }

    if (
      (url.pathname === '/api/images' || url.pathname.startsWith('/api/image/')) &&
      context.request.method !== 'OPTIONS'
    ) {
      const limited = await rateLimitResponse(
        context,
        `api:${ip}`,
        cfg.rateLimits.api.max,
        cfg.rateLimits.api.windowSec,
      );
      if (limited) return limited;
    }

    if (url.pathname.startsWith('/cdn/')) {
      const limited = await rateLimitResponse(
        context,
        `cdn:${ip}`,
        cfg.rateLimits.cdn.max,
        cfg.rateLimits.cdn.windowSec,
      );
      if (limited) return limited;
    }

    return context.next();
  } catch {
    console.error('rateLimitMiddleware error');
    return errorResponse('Rate limiter unavailable', 503);
  }
}

async function hotlinkMiddleware(context: Context): Promise<Response> {
  try {
    const url = new URL(context.request.url);
    if (url.pathname.startsWith('/cdn/')) {
      const cfg = getConfig(context.env);
      const check = isHotlink(context.request, cfg.corsOrigins);
      if (check.blocked) {
        return errorResponse('Hotlink not allowed', 403);
      }
    }
    return context.next();
  } catch {
    console.error('hotlinkMiddleware error');
    return errorResponse('Request check unavailable', 503);
  }
}

export const onRequest = [
  securityMiddleware,
  botMiddleware,
  rateLimitMiddleware,
  hotlinkMiddleware,
];

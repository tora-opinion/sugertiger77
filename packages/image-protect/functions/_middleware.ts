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
  } catch (err) {
    console.error('securityMiddleware error:', err);
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
  } catch (err) {
    console.error('botMiddleware error:', err);
    return context.next();
  }
}

async function rateLimitMiddleware(context: Context): Promise<Response> {
  try {
    const url = new URL(context.request.url);
    const ip =
      context.request.headers.get('cf-connecting-ip') || 'unknown';
    const cfg = getConfig(context.env);

    if (
      url.pathname === '/api/upload' &&
      context.request.method === 'POST'
    ) {
      const result = await checkRateLimit(
        context.env.RATE_LIMIT_KV,
        `upload:${ip}`,
        cfg.rateLimits.upload.max,
        cfg.rateLimits.upload.windowSec,
      );
      if (!result.allowed) {
        return errorResponse('Rate limit exceeded', 429);
      }
    }

    if (url.pathname.startsWith('/cdn/')) {
      const result = await checkRateLimit(
        context.env.RATE_LIMIT_KV,
        `cdn:${ip}`,
        cfg.rateLimits.cdn.max,
        cfg.rateLimits.cdn.windowSec,
      );
      if (!result.allowed) {
        return errorResponse('Rate limit exceeded', 429);
      }
    }

    return context.next();
  } catch (err) {
    console.error('rateLimitMiddleware error:', err);
    return context.next();
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
  } catch (err) {
    console.error('hotlinkMiddleware error:', err);
    return context.next();
  }
}

export const onRequest = [
  securityMiddleware,
  botMiddleware,
  rateLimitMiddleware,
  hotlinkMiddleware,
];

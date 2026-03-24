import type { Env } from '../src/types';
import { checkRateLimit } from '../src/protection/rate-limiter';
import { detectBot } from '../src/protection/bot-detector';
import { isHotlink } from '../src/protection/hotlink-guard';
import { errorResponse, addSecurityHeaders, corsHeaders } from '../src/utils/response';
import { getConfig } from '../src/config';

interface Context {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}

// Security + CORS headers (wraps everything)
async function securityMiddleware(context: Context): Promise<Response> {
  const response = await context.next();
  const origin = context.request.headers.get('origin');
  const cors = corsHeaders(origin);
  const secured = addSecurityHeaders(response);
  const headers = new Headers(secured.headers);
  for (const [k, v] of Object.entries(cors)) {
    if (v) headers.set(k, v);
  }
  return new Response(secured.body, {
    status: secured.status,
    statusText: secured.statusText,
    headers,
  });
}

// Bot detection for API/CDN/preview routes
async function botMiddleware(context: Context): Promise<Response> {
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
}

// Rate limiting
async function rateLimitMiddleware(context: Context): Promise<Response> {
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
}

// Hotlink protection for CDN routes
async function hotlinkMiddleware(context: Context): Promise<Response> {
  const url = new URL(context.request.url);
  if (url.pathname.startsWith('/cdn/')) {
    const cfg = getConfig(context.env);
    const check = isHotlink(context.request, cfg.corsOrigins);
    if (check.blocked) {
      return errorResponse('Hotlink not allowed', 403);
    }
  }
  return context.next();
}

export const onRequest = [
  securityMiddleware,
  botMiddleware,
  rateLimitMiddleware,
  hotlinkMiddleware,
];

import type { Env, RequestAuth } from '../src/types';
import { checkRateLimit } from '../src/protection/rate-limiter';
import { errorResponse, corsHeaders } from '../src/utils/response';
import { getConfig } from '../src/config';
import { validateApiKey } from '../src/auth/api-key';

interface Context {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
  data: Record<string, unknown> & { auth?: RequestAuth };
}

const FILE_ID_PATTERN = /^\/[0-9a-f]{16}$/;
// /{id} および /{id}/raw の両方にマッチ
const CDN_PATH_PATTERN = /^\/[0-9a-f]{16}(\/raw)?$/;

// Domain-based routing middleware
async function domainRoutingMiddleware(context: Context): Promise<Response> {
  const url = new URL(context.request.url);
  const host = url.hostname;

  // cdn.sugertiger77.com - CDN配信専用 (/{id} と /{id}/raw のみ許可)
  if (host === 'cdn.sugertiger77.com') {
    if (!CDN_PATH_PATTERN.test(url.pathname)) {
      return errorResponse('Not found', 404);
    }
  }

  // up.sugertiger77.com - アップロード/削除専用 (/{id} と /{id}/raw は不可)
  if (host === 'up.sugertiger77.com') {
    if (CDN_PATH_PATTERN.test(url.pathname)) {
      return errorResponse('File download not available on this domain. Use cdn.sugertiger77.com', 403);
    }
  }

  return context.next();
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

async function rateLimitMiddleware(context: Context): Promise<Response> {
  try {
    const url = new URL(context.request.url);
    const cfg = getConfig(context.env);

    // Upload start endpoints: rate limit by API key
    if (url.pathname === '/api/upload' || url.pathname === '/api/upload/start') {
      const auth = context.data.auth;
      if (auth?.apiKeyId) {
        const result = await checkRateLimit(
          context.env.RATE_LIMIT_KV,
          `upload:${auth.apiKeyId}`,
          cfg.rateLimits.upload.max,
          cfg.rateLimits.upload.windowSec,
        );
        if (!result.allowed) {
          return errorResponse('Rate limit exceeded', 429);
        }
      }
    }

    // CDN endpoints: rate limit by IP (/{id} と /{id}/raw 両パターン)
    if (url.pathname.startsWith('/cdn/') || CDN_PATH_PATTERN.test(url.pathname)) {
      const ip = context.request.headers.get('cf-connecting-ip') || 'unknown';
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

async function authMiddleware(context: Context): Promise<Response> {
  try {
    const url = new URL(context.request.url);

    if (!url.pathname.startsWith('/api/')) {
      return context.next();
    }

    const authHeader = context.request.headers.get('authorization');
    const auth = await validateApiKey(context.env.API_KEYS_KV, authHeader);
    context.data.auth = {
      apiKeyId: auth.valid && auth.keyId ? auth.keyId : null,
      keyData: auth.valid && auth.keyData ? auth.keyData : null,
    };

    return context.next();
  } catch (err) {
    console.error('authMiddleware error:', err);
    context.data.auth = { apiKeyId: null, keyData: null };
    return context.next();
  }
}

export const onRequest = [
  domainRoutingMiddleware,
  securityMiddleware,
  authMiddleware,
  rateLimitMiddleware,
];

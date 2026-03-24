import { config as appConfig } from '../config';

const ALLOWED_ORIGINS = new Set<string>(appConfig.corsOrigins);

export function corsHeaders(requestOrigin?: string | null): Record<string, string> {
  const origin =
    requestOrigin && ALLOWED_ORIGINS.has(requestOrigin)
      ? requestOrigin
      : '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Delete-Token',
    'Access-Control-Max-Age': '86400',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  return headers;
}

export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
  requestOrigin?: string | null,
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...corsHeaders(requestOrigin),
    ...extraHeaders,
  };
  return new Response(JSON.stringify(data), { status, headers });
}

export function errorResponse(message: string, status: number, requestOrigin?: string | null): Response {
  return jsonResponse({ success: false, error: message, code: status }, status, undefined, requestOrigin);
}

export function addSecurityHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  newHeaders.set('X-Content-Type-Options', 'nosniff');
  newHeaders.set('X-Frame-Options', 'DENY');
  newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (!newHeaders.has('Cache-Control')) {
    newHeaders.set('Cache-Control', 'no-store');
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export function optionsResponse(requestOrigin?: string | null): Response {
  return new Response(null, { status: 204, headers: corsHeaders(requestOrigin) });
}

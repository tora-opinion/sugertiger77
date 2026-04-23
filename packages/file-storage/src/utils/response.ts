import { config } from '../config';

const ALLOWED_ORIGINS = new Set<string>(config.corsOrigins);

export function corsHeaders(
  requestOrigin?: string | null,
): Record<string, string> {
  const origin =
    requestOrigin && ALLOWED_ORIGINS.has(requestOrigin) ? requestOrigin : '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

export function errorResponse(
  message: string,
  status: number,
  requestOrigin?: string | null,
): Response {
  return jsonResponse(
    { success: false, error: message, code: status },
    status,
    undefined,
    requestOrigin,
  );
}

export function optionsResponse(requestOrigin?: string | null): Response {
  return new Response(null, { status: 204, headers: corsHeaders(requestOrigin) });
}

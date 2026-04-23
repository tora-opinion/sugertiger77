import { config, getConfig } from '../config';
import type { Env } from '../types';

export function corsHeaders(
  requestOrigin?: string | null,
  env?: Env,
): Record<string, string> {
  const corsOrigins = env ? getConfig(env).corsOrigins : config.corsOrigins;
  const allowedOrigins = new Set<string>(corsOrigins);
  const origin =
    requestOrigin && allowedOrigins.has(requestOrigin) ? requestOrigin : '';
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
  env?: Env,
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...corsHeaders(requestOrigin, env),
    ...extraHeaders,
  };
  return new Response(JSON.stringify(data), { status, headers });
}

export function errorResponse(
  message: string,
  status: number,
  requestOrigin?: string | null,
  env?: Env,
): Response {
  return jsonResponse(
    { success: false, error: message, code: status },
    status,
    undefined,
    requestOrigin,
    env,
  );
}

export function optionsResponse(requestOrigin?: string | null, env?: Env): Response {
  return new Response(null, { status: 204, headers: corsHeaders(requestOrigin, env) });
}

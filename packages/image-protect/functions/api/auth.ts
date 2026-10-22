import type { Env } from '../../src/types';
import { authenticateAdmin, createSessionToken } from '../../src/auth';
import { getConfig } from '../../src/config';
import { parseAdminAuthBody } from '../../src/utils/auth-body';
import { readBodyWithinLimit } from '../../src/utils/body';
import {
  jsonResponse,
  errorResponse,
  optionsResponse,
} from '../../src/utils/response';

interface Context {
  request: Request;
  env: Env;
  params: Record<string, string>;
  next: () => Promise<Response>;
}

export const onRequestOptions = (): Response => optionsResponse();

export const onRequestPost = async (context: Context): Promise<Response> => {
  try {
    const contentType = context.request.headers.get('content-type') || '';
    if (contentType.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
      return errorResponse('Expected application/json', 400);
    }
    const contentLength = context.request.headers.get('content-length');
    if (contentLength !== null) {
      if (!/^\d+$/.test(contentLength)) {
        return errorResponse('Invalid Content-Length', 400);
      }
      if (Number(contentLength) > 8192) {
        return errorResponse('Request too large', 413);
      }
    }
    if (!context.request.body) {
      return errorResponse('Password required', 400);
    }
    const bodyBytes = await readBodyWithinLimit(context.request.body, 8192);
    if (!bodyBytes) {
      return errorResponse('Request too large', 413);
    }

    const parsedBody = parseAdminAuthBody(new TextDecoder().decode(bodyBytes));
    if (!parsedBody) return errorResponse('Invalid request body', 400);
    const { password } = parsedBody;

    const valid = await authenticateAdmin(
      password,
      context.env.ADMIN_PASSWORD_HASH,
    );

    if (!valid) {
      return errorResponse('Invalid password', 401);
    }

    const cfg = getConfig(context.env);
    const token = await createSessionToken(
      context.env.SIGNING_SECRET,
      cfg.sessionExpiry,
    );

    return jsonResponse({ success: true, token });
  } catch {
    console.error('Admin authentication failed');
    return errorResponse('Authentication failed', 500);
  }
};

import type { Env } from '../../src/types';
import { authenticateAdmin, createSessionToken } from '../../src/auth';
import { getConfig } from '../../src/config';
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
    const body = (await context.request.json()) as { password?: string };

    if (!body.password) {
      return errorResponse('Password required', 400);
    }

    const valid = await authenticateAdmin(
      body.password,
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Auth failed';
    return errorResponse(message, 500);
  }
};

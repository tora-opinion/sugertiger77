import type { Env } from '../../src/types';
import { listImages } from '../../src/storage/r2';
import { validateSession } from '../../src/auth';
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

export const onRequestGet = async (context: Context): Promise<Response> => {
  try {
    const authHeader = context.request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('Authorization required', 401);
    }

    const token = authHeader.slice(7);
    const valid = await validateSession(token, context.env.SIGNING_SECRET);
    if (!valid) {
      return errorResponse('Invalid or expired session', 401);
    }

    const url = new URL(context.request.url);
    const cursor = url.searchParams.get('cursor') || undefined;
    const limit = Math.min(
      Number(url.searchParams.get('limit')) || 50,
      100,
    );

    const result = await listImages(
      context.env.IMAGE_BUCKET,
      cursor,
      limit,
    );

    return jsonResponse({
      success: true,
      images: result.images,
      cursor: result.cursor,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list images';
    return errorResponse(message, 500);
  }
};

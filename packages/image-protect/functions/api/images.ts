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
    const limitValue = url.searchParams.get('limit');
    const requestedLimit = limitValue === null ? 50 : Number(limitValue);
    const limit = Number.isSafeInteger(requestedLimit)
      ? Math.max(1, Math.min(requestedLimit, 100))
      : 50;

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
  } catch {
    console.error('Image listing failed');
    return errorResponse('Failed to list images', 500);
  }
};

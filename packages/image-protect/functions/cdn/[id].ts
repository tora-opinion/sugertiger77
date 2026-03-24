import type { Env } from '../../src/types';
import { getImage } from '../../src/storage/r2';
import { errorResponse } from '../../src/utils/response';

interface Context {
  request: Request;
  env: Env;
  params: Record<string, string>;
  next: () => Promise<Response>;
}

const IMAGE_ID_PATTERN = /^[0-9a-f]{16}$/;

export const onRequestGet = async (context: Context): Promise<Response> => {
  try {
    const id = context.params.id;
    if (!id || !IMAGE_ID_PATTERN.test(id)) {
      return errorResponse('Invalid image ID', 400);
    }

    const result = await getImage(context.env.IMAGE_BUCKET, id);
    if (!result) {
      return errorResponse('Image not found', 404);
    }

    return new Response(result.body, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to serve image';
    return errorResponse(message, 500);
  }
};

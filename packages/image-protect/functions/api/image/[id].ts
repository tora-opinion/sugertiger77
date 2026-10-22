import type { Env } from '../../../src/types';
import { getImage, getImageMetadata, deleteImage } from '../../../src/storage/r2';
import { validateSignedUrl } from '../../../src/protection/signed-url';
import { validateSession } from '../../../src/auth';
import {
  jsonResponse,
  errorResponse,
  optionsResponse,
} from '../../../src/utils/response';

interface Context {
  request: Request;
  env: Env;
  params: Record<string, string>;
  next: () => Promise<Response>;
}

const IMAGE_ID_PATTERN = /^[0-9a-f]{16}$/;

export const onRequestOptions = (): Response => optionsResponse();

export const onRequestGet = async (context: Context): Promise<Response> => {
  try {
    const id = context.params.id;
    if (!id || !IMAGE_ID_PATTERN.test(id)) {
      return errorResponse('Invalid image ID', 400);
    }

    const check = await validateSignedUrl(
      context.request,
      context.env.SIGNING_SECRET,
      id,
    );
    if (!check.valid) {
      return errorResponse('Invalid or expired signed URL', 403);
    }

    const result = await getImage(context.env.IMAGE_BUCKET, id);
    if (!result) {
      return errorResponse('Image not found', 404);
    }

    return new Response(result.body, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    console.error('Signed image request failed');
    return errorResponse('Failed to serve image', 500);
  }
};

export const onRequestDelete = async (
  context: Context,
): Promise<Response> => {
  try {
    const id = context.params.id;
    if (!id || !IMAGE_ID_PATTERN.test(id)) {
      return errorResponse('Invalid image ID', 400);
    }

    // Check session token
    const authHeader = context.request.headers.get('authorization');
    const deleteToken = context.request.headers.get('x-delete-token');

    let authorized = false;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      authorized = await validateSession(token, context.env.SIGNING_SECRET);
    }

    if (!authorized && deleteToken) {
      const metadata = await getImageMetadata(context.env.IMAGE_BUCKET, id);
      if (metadata && metadata.deleteToken === deleteToken) {
        authorized = true;
      }
    }

    if (!authorized) {
      return errorResponse('Unauthorized', 401);
    }

    await deleteImage(context.env.IMAGE_BUCKET, id);

    return jsonResponse({ success: true, message: 'Image deleted' });
  } catch {
    console.error('Image delete failed');
    return errorResponse('Delete failed', 500);
  }
};

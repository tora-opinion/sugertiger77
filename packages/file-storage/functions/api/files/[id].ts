import type { Env, RequestAuth } from '../../../src/types';
import { getFileMetadata, deleteFile } from '../../../src/storage/r2';
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
  data: Record<string, unknown> & { auth?: RequestAuth };
}

const FILE_ID_PATTERN = /^[0-9a-f]{16}$/;

export const onRequestOptions = (context: Context): Response => {
  return optionsResponse(context.request.headers.get('origin'), context.env);
};

export const onRequestDelete = async (context: Context): Promise<Response> => {
  const origin = context.request.headers.get('origin');

  try {
    const id = context.params.id;
    if (!id || !FILE_ID_PATTERN.test(id)) {
      return errorResponse('Invalid file ID', 400, origin, context.env);
    }

    // Check delete token auth
    const deleteTokenHeader = context.request.headers.get('x-delete-token');

    // Get file metadata to verify
    const metadata = await getFileMetadata(context.env.FILE_BUCKET, id);
    if (!metadata) {
      return errorResponse('File not found', 404, origin, context.env);
    }

    const requesterApiKeyId = context.data.auth?.apiKeyId;
    const ownerApiKeyId = metadata.apiKeyId;

    if (ownerApiKeyId) {
      if (requesterApiKeyId) {
        if (requesterApiKeyId !== ownerApiKeyId) {
          return errorResponse('Forbidden', 403, origin, context.env);
        }
      } else if (
        !deleteTokenHeader ||
        deleteTokenHeader !== metadata.deleteToken
      ) {
        return errorResponse('Unauthorized', 401, origin, context.env);
      }
    } else if (
      !deleteTokenHeader ||
      deleteTokenHeader !== metadata.deleteToken
    ) {
      return errorResponse('Delete token required', 401, origin, context.env);
    }

    await deleteFile(context.env.FILE_BUCKET, id);

    return jsonResponse({ success: true }, 200, undefined, origin, context.env);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    console.error('Delete error:', err);
    return errorResponse(message, 500, origin, context.env);
  }
};

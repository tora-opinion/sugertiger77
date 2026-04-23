import type { Env, RequestAuth, UploadState } from '../../../../src/types';
import {
  resumeMultipartUpload,
  abortMultipartUpload,
} from '../../../../src/storage/r2';
import {
  jsonResponse,
  errorResponse,
  optionsResponse,
} from '../../../../src/utils/response';

interface Context {
  request: Request;
  env: Env;
  params: Record<string, string>;
  next: () => Promise<Response>;
  data: Record<string, unknown> & { auth?: RequestAuth };
}

export const onRequestOptions = (context: Context): Response => {
  return optionsResponse(context.request.headers.get('origin'));
};

export const onRequestDelete = async (context: Context): Promise<Response> => {
  const origin = context.request.headers.get('origin');

  try {
    const { uploadId } = context.params;

    if (!uploadId) {
      return errorResponse('Invalid uploadId', 400, origin);
    }

    const auth = context.data.auth;
    if (!auth?.apiKeyId) {
      return errorResponse('Invalid or missing API key', 401, origin);
    }

    // Get upload state
    const stateJson = await context.env.UPLOAD_STATE_KV.get(
      `upload:${uploadId}`,
    );
    if (!stateJson) {
      return errorResponse('Upload not found', 404, origin);
    }

    const state = JSON.parse(stateJson) as UploadState;

    // Verify API key matches
    if (state.apiKeyId !== auth.apiKeyId) {
      return errorResponse('Unauthorized', 403, origin);
    }

    // Resume and abort
    const upload = await resumeMultipartUpload(
      context.env.FILE_BUCKET,
      state.fileId,
      uploadId,
    );

    await abortMultipartUpload(upload);

    // Delete upload state
    await context.env.UPLOAD_STATE_KV.delete(`upload:${uploadId}`);

    return jsonResponse({ success: true }, 200, undefined, origin);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to abort upload';
    console.error('Abort upload error:', err);
    return errorResponse(message, 500, origin);
  }
};

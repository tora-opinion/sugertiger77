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
  return optionsResponse(context.request.headers.get('origin'), context.env);
};

export const onRequestDelete = async (context: Context): Promise<Response> => {
  const origin = context.request.headers.get('origin');

  try {
    const { uploadId } = context.params;

    if (!uploadId) {
      return errorResponse('Invalid uploadId', 400, origin, context.env);
    }

    const auth = context.data.auth;
    if (!auth?.apiKeyId) {
      return errorResponse('Invalid or missing API key', 401, origin, context.env);
    }

    // Get upload state
    const stateJson = await context.env.UPLOAD_STATE_KV.get(
      `upload:${uploadId}`,
    );
    if (!stateJson) {
      return errorResponse('Upload not found', 404, origin, context.env);
    }

    const state = JSON.parse(stateJson) as UploadState;

    // Verify API key matches
    if (state.apiKeyId !== auth.apiKeyId) {
      return errorResponse('Unauthorized', 403, origin, context.env);
    }

    // Resume and abort
    const upload = await resumeMultipartUpload(
      context.env.FILE_BUCKET,
      state.fileId,
      uploadId,
    );

    await abortMultipartUpload(upload);

    // Delete upload state (best-effort; multipart upload is already aborted)
    try {
      await context.env.UPLOAD_STATE_KV.delete(`upload:${uploadId}`);
    } catch (kvErr) {
      console.error('Failed to delete upload state after abort:', {
        uploadId,
        fileId: state.fileId,
        error: kvErr instanceof Error ? kvErr.message : String(kvErr),
      });
    }

    return jsonResponse({ success: true }, 200, undefined, origin, context.env);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to abort upload';
    console.error('Abort upload error:', err);
    return errorResponse(message, 500, origin, context.env);
  }
};

import type { Env, RequestAuth, UploadState } from '../../../../../src/types';
import { resumeMultipartUpload, uploadPart } from '../../../../../src/storage/r2';
import { getConfig } from '../../../../../src/config';
import {
  jsonResponse,
  errorResponse,
  optionsResponse,
} from '../../../../../src/utils/response';

interface Context {
  request: Request;
  env: Env;
  params: Record<string, string>;
  next: () => Promise<Response>;
  data: Record<string, unknown> & { auth?: RequestAuth };
}

const PART_SIZE_MARGIN_BYTES = 1024 * 1024; // 1MB

export const onRequestOptions = (context: Context): Response => {
  return optionsResponse(context.request.headers.get('origin'), context.env);
};

export const onRequestPut = async (context: Context): Promise<Response> => {
  const origin = context.request.headers.get('origin');

  try {
    const { uploadId, partNumber } = context.params;
    if (!uploadId || !/^(?:[1-9]\d{0,3}|10000)$/.test(partNumber)) {
      return errorResponse('Invalid uploadId or partNumber', 400, origin, context.env);
    }

    const partNum = Number(partNumber);

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

    const cfg = getConfig(context.env);
    const maxPartSize = cfg.partSize + PART_SIZE_MARGIN_BYTES;

    const contentLengthHeader = context.request.headers.get('content-length');
    if (contentLengthHeader === null) {
      return errorResponse('Content-Length header is required', 411, origin, context.env);
    }

    if (!context.request.body) {
      return errorResponse('Empty part data', 400, origin, context.env);
    }

    const contentLength = Number(contentLengthHeader);
    if (!Number.isInteger(contentLength) || contentLength <= 0) {
      return errorResponse(
        'Invalid Content-Length header',
        400,
        origin,
        context.env,
      );
    }
    if (contentLength > maxPartSize) {
      return errorResponse(
        `Part size exceeds allowed limit (${maxPartSize} bytes).`,
        413,
        origin,
        context.env,
      );
    }

    // Resume and upload part (stream body directly to R2 to avoid double-buffering)
    const upload = await resumeMultipartUpload(
      context.env.FILE_BUCKET,
      state.fileId,
      uploadId,
    );

    const uploadedPart = await uploadPart(
      upload,
      partNum,
      context.request.body,
      { contentLength },
    );

    return jsonResponse(
      {
        partNumber: partNum,
        etag: uploadedPart.etag,
      },
      200,
      undefined,
      origin,
      context.env,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to upload part';
    console.error('Upload part error:', err);
    return errorResponse(message, 500, origin, context.env);
  }
};

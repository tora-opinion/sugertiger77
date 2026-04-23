import type { Env, FileMetadata, RequestAuth, UploadState } from '../../../src/types';
import { startMultipartUpload } from '../../../src/storage/r2';
import { generateId, generateDeleteToken } from '../../../src/utils/crypto';
import { getConfig } from '../../../src/config';
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

interface StartRequest {
  filename: string;
  contentType?: string;
  size: number;
}

export const onRequestOptions = (context: Context): Response => {
  return optionsResponse(context.request.headers.get('origin'), context.env);
};

export const onRequestPost = async (context: Context): Promise<Response> => {
  const origin = context.request.headers.get('origin');

  try {
    const auth = context.data.auth;
    if (!auth?.apiKeyId) {
      return errorResponse('Invalid or missing API key', 401, origin, context.env);
    }

    const cfg = getConfig(context.env);
    let rawBody: unknown;
    try {
      rawBody = await context.request.json();
    } catch {
      return errorResponse('Invalid JSON body', 400, origin, context.env);
    }

    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      return errorResponse('Invalid request body', 400, origin, context.env);
    }

    const body = rawBody as Partial<StartRequest>;

    if (typeof body.filename !== 'string' || body.filename.trim().length === 0) {
      return errorResponse(
        'Invalid filename. filename must be a non-empty string.',
        400,
        origin,
        context.env,
      );
    }

    if (body.contentType !== undefined && typeof body.contentType !== 'string') {
      return errorResponse(
        'Invalid contentType. contentType must be a string when provided.',
        400,
        origin,
        context.env,
      );
    }

    if (
      typeof body.size !== 'number' ||
      !Number.isInteger(body.size) ||
      body.size <= 0 ||
      body.size > cfg.maxFileSize
    ) {
      return errorResponse(
        `Invalid file size. Size must be an integer between 1 and ${cfg.maxFileSize} bytes.`,
        400,
        origin,
        context.env,
      );
    }

    const fileId = generateId();
    const deleteToken = generateDeleteToken();
    const contentType =
      typeof body.contentType === 'string' && body.contentType.trim().length > 0
        ? body.contentType
        : 'application/octet-stream';

    const metadata: FileMetadata = {
      id: fileId,
      filename: body.filename,
      contentType,
      size: body.size,
      uploadedAt: new Date().toISOString(),
      deleteToken,
      apiKeyId: auth.apiKeyId,
    };

    const upload = await startMultipartUpload(
      context.env.FILE_BUCKET,
      fileId,
      metadata,
    );

    // Store upload state in KV
    const uploadState: UploadState = {
      fileId,
      uploadId: upload.uploadId,
      filename: body.filename,
      contentType,
      size: body.size,
      createdAt: new Date().toISOString(),
      apiKeyId: auth.apiKeyId,
      deleteToken,
    };

    await context.env.UPLOAD_STATE_KV.put(
      `upload:${upload.uploadId}`,
      JSON.stringify(uploadState),
      { expirationTtl: 86400 }, // 24 hours
    );

    return jsonResponse(
      {
        success: true,
        uploadId: upload.uploadId,
        fileId,
        partSize: cfg.partSize,
      },
      200,
      undefined,
      origin,
      context.env,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to start upload';
    console.error('Start upload error:', err);
    return errorResponse(message, 500, origin, context.env);
  }
};

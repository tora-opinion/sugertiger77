import type { Env, FileMetadata, RequestAuth } from '../../src/types';
import { uploadFile } from '../../src/storage/r2';
import { generateId, generateDeleteToken } from '../../src/utils/crypto';
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
  data: Record<string, unknown> & { auth?: RequestAuth };
}

export const onRequestOptions = (context: Context): Response => {
  return optionsResponse(context.request.headers.get('origin'));
};

export const onRequestPost = async (context: Context): Promise<Response> => {
  const origin = context.request.headers.get('origin');

  try {
    const auth = context.data.auth;
    if (!auth?.apiKeyId) {
      return errorResponse('Invalid or missing API key', 401, origin);
    }

    const cfg = getConfig(context.env);
    const contentType = context.request.headers.get('content-type') || '';

    if (!contentType.includes('multipart/form-data')) {
      return errorResponse('Expected multipart/form-data', 400, origin);
    }

    const formData = await context.request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return errorResponse('No file provided', 400, origin);
    }

    if (
      !Number.isInteger(file.size) ||
      file.size <= 0 ||
      file.size > cfg.maxFileSize
    ) {
      return errorResponse(
        `Invalid file size. Size must be an integer between 1 and ${cfg.maxFileSize} bytes.`,
        400,
        origin,
      );
    }

    // Check size (small file upload only, use multipart for larger)
    if (file.size > cfg.smallFileThreshold) {
      return errorResponse(
        `File too large for direct upload. Max: ${cfg.smallFileThreshold / 1024 / 1024}MB. Use multipart upload for larger files.`,
        400,
        origin,
      );
    }

    const id = generateId();
    const deleteToken = generateDeleteToken();
    const data = await file.arrayBuffer();

    const metadata: FileMetadata = {
      id,
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      uploadedAt: new Date().toISOString(),
      deleteToken,
      apiKeyId: auth.apiKeyId,
    };

    await uploadFile(
      context.env.FILE_BUCKET,
      id,
      data,
      metadata,
      metadata.contentType,
    );

    const cdnUrl = `https://cdn.sugertiger77.com/${id}`;

    return jsonResponse(
      {
        success: true,
        id,
        cdnUrl,
        deleteToken,
      },
      200,
      undefined,
      origin,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    console.error('Upload error:', err);
    return errorResponse(message, 500, origin);
  }
};

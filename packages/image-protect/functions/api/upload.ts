import type { Env, ImageMetadata } from '../../src/types';
import { generateId, generateDeleteToken } from '../../src/utils/crypto';
import { uploadImage } from '../../src/storage/r2';
import { generateSignedUrl } from '../../src/protection/signed-url';
import { getConfig } from '../../src/config';
import { readBodyWithinLimit } from '../../src/utils/body';
import {
  isAllowedImageUpload,
  MULTIPART_OVERHEAD_LIMIT,
} from '../../src/protection/image-validation';
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

export const onRequestPost = async (context: Context): Promise<Response> => {
  try {
    const cfg = getConfig(context.env);
    const contentType = context.request.headers.get('content-type') || '';

    if (
      contentType.split(';', 1)[0].trim().toLowerCase() !== 'multipart/form-data' ||
      !/;\s*boundary=(?:"[^"]+"|[^;\s]+)/i.test(contentType)
    ) {
      return errorResponse('Expected multipart/form-data', 400);
    }

    const maxRequestSize = cfg.maxFileSize + MULTIPART_OVERHEAD_LIMIT;
    const contentLength = context.request.headers.get('content-length');
    if (contentLength !== null) {
      if (!/^\d+$/.test(contentLength)) {
        return errorResponse('Invalid Content-Length', 400);
      }
      if (Number(contentLength) > maxRequestSize) {
        return errorResponse('Request too large', 413);
      }
    }

    if (!context.request.body) {
      return errorResponse('No file provided', 400);
    }
    const body = await readBodyWithinLimit(context.request.body, maxRequestSize);
    if (!body) {
      return errorResponse('Request too large', 413);
    }

    const headers = new Headers(context.request.headers);
    headers.delete('content-length');
    headers.delete('transfer-encoding');
    let formData: FormData;
    try {
      formData = await new Request(context.request.url, {
        method: 'POST',
        headers,
        body,
      }).formData();
    } catch {
      return errorResponse('Invalid multipart request', 400);
    }

    const fileEntries = formData.getAll('file') as unknown as Array<string | File>;
    const candidate = fileEntries[0];
    const file = fileEntries.length === 1 && candidate instanceof File
      ? candidate
      : null;

    if (!file) {
      return errorResponse('Exactly one file is required', 400);
    }

    if ([...formData.keys()].some((name) => name !== 'file')) {
      return errorResponse('Unexpected multipart field', 400);
    }

    if (file.size === 0) {
      return errorResponse('File is empty', 400);
    }
    if (file.size > cfg.maxFileSize) {
      return errorResponse(
        `File too large. Max: ${cfg.maxFileSize / 1024 / 1024}MB`,
        413,
      );
    }

    const data = await file.arrayBuffer();
    const imageBytes = new Uint8Array(data);
    if (!isAllowedImageUpload(file.type, imageBytes, cfg.allowedTypes)) {
      return errorResponse(
        'File content does not match an allowed image type',
        400,
      );
    }

    const id = generateId();
    const deleteToken = generateDeleteToken();

    const metadata: ImageMetadata = {
      id,
      filename: file.name,
      contentType: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      deleteToken,
    };

    await uploadImage(
      context.env.IMAGE_BUCKET,
      id,
      data,
      metadata,
      file.type,
    );

    const baseUrl = new URL(context.request.url).origin;
    const cdnUrl = `${baseUrl}/cdn/${id}`;
    const signedUrl = await generateSignedUrl(
      baseUrl,
      id,
      context.env.SIGNING_SECRET,
      cfg.signedUrlExpiry,
    );

    return jsonResponse({
      success: true,
      id,
      cdnUrl,
      deleteToken,
      signedUrl,
    });
  } catch {
    console.error('Image upload failed');
    return errorResponse('Upload failed', 500);
  }
};

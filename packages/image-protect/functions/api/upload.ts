import type { Env, ImageMetadata } from '../../src/types';
import { generateId, generateDeleteToken } from '../../src/utils/crypto';
import { uploadImage } from '../../src/storage/r2';
import { generateSignedUrl } from '../../src/protection/signed-url';
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
}

export const onRequestOptions = (): Response => optionsResponse();

export const onRequestPost = async (context: Context): Promise<Response> => {
  try {
    const cfg = getConfig(context.env);
    const contentType = context.request.headers.get('content-type') || '';

    if (!contentType.includes('multipart/form-data')) {
      return errorResponse('Expected multipart/form-data', 400);
    }

    const formData = await context.request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return errorResponse('No file provided', 400);
    }

    if (!cfg.allowedTypes.includes(file.type)) {
      return errorResponse(
        `File type not allowed. Accepted: ${cfg.allowedTypes.join(', ')}`,
        400,
      );
    }

    if (file.size > cfg.maxFileSize) {
      return errorResponse(
        `File too large. Max: ${cfg.maxFileSize / 1024 / 1024}MB`,
        400,
      );
    }

    const id = generateId();
    const deleteToken = generateDeleteToken();
    const data = await file.arrayBuffer();

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
    const previewUrl = `${baseUrl}/preview/${id}`;
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
      previewUrl,
      deleteToken,
      signedUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return errorResponse(message, 500);
  }
};

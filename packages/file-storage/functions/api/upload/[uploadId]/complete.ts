import type { Env, RequestAuth, UploadState } from '../../../../src/types';
import {
  resumeMultipartUpload,
  completeMultipartUpload,
} from '../../../../src/storage/r2';
import { getConfig } from '../../../../src/config';
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

interface CompleteRequest {
  parts?: { partNumber: number; etag: string }[];
}

const MAX_MULTIPART_PARTS = 10000;

function validateParts(parts: CompleteRequest['parts']): {
  ok: true;
  parts: { partNumber: number; etag: string }[];
} | {
  ok: false;
  message: string;
} {
  if (!Array.isArray(parts) || parts.length === 0) {
    return { ok: false, message: 'No parts uploaded' };
  }

  if (parts.length > MAX_MULTIPART_PARTS) {
    return {
      ok: false,
      message: `Too many parts. Maximum is ${MAX_MULTIPART_PARTS}.`,
    };
  }

  const seen = new Set<number>();

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];

    if (!part || typeof part !== 'object') {
      return {
        ok: false,
        message: `Invalid part at index ${index}: expected object.`,
      };
    }

    if (
      !Number.isInteger(part.partNumber) ||
      part.partNumber < 1 ||
      part.partNumber > MAX_MULTIPART_PARTS
    ) {
      return {
        ok: false,
        message: `Invalid partNumber at index ${index}: must be an integer between 1 and ${MAX_MULTIPART_PARTS}.`,
      };
    }

    if (seen.has(part.partNumber)) {
      return {
        ok: false,
        message: `Duplicate partNumber: ${part.partNumber}.`,
      };
    }
    seen.add(part.partNumber);

    if (
      typeof part.etag !== 'string' ||
      part.etag.length < 1 ||
      part.etag.length > 256
    ) {
      return {
        ok: false,
        message: `Invalid etag for partNumber ${part.partNumber}: must be a string between 1 and 256 characters.`,
      };
    }
  }

  return {
    ok: true,
    parts: [...parts].sort((a, b) => a.partNumber - b.partNumber),
  };
}

export const onRequestOptions = (context: Context): Response => {
  return optionsResponse(context.request.headers.get('origin'));
};

export const onRequestPost = async (context: Context): Promise<Response> => {
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

    let rawBody: unknown;
    try {
      rawBody = await context.request.json();
    } catch {
      return errorResponse('Invalid request body', 400, origin);
    }

    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      return errorResponse('Invalid request body', 400, origin);
    }

    const body = rawBody as CompleteRequest;
    const validatedParts = validateParts(body.parts);
    if (!validatedParts.ok) {
      return errorResponse(validatedParts.message, 400, origin);
    }

    const cfg = getConfig(context.env);

    // Resume and complete
    const upload = await resumeMultipartUpload(
      context.env.FILE_BUCKET,
      state.fileId,
      uploadId,
    );

    await completeMultipartUpload(upload, validatedParts.parts);

    const completedObject = await context.env.FILE_BUCKET.head(state.fileId);
    if (!completedObject) {
      return errorResponse('Failed to verify uploaded object', 500, origin);
    }

    if (completedObject.size > cfg.maxFileSize) {
      try {
        await context.env.FILE_BUCKET.delete(state.fileId);
      } catch (delErr) {
        console.error(
          'Failed to delete oversized object (leak):',
          {
            fileId: state.fileId,
            uploadId,
            size: completedObject.size,
            maxFileSize: cfg.maxFileSize,
            error: delErr instanceof Error ? delErr.message : String(delErr),
          },
        );
      }
      try {
        await context.env.UPLOAD_STATE_KV.delete(`upload:${uploadId}`);
      } catch (kvErr) {
        console.error('Failed to delete upload state after size violation:', {
          uploadId,
          error: kvErr instanceof Error ? kvErr.message : String(kvErr),
        });
      }
      return errorResponse('Uploaded size exceeds MAX_FILE_SIZE', 413, origin);
    }

    // Delete upload state (best-effort; object is already persisted)
    try {
      await context.env.UPLOAD_STATE_KV.delete(`upload:${uploadId}`);
    } catch (kvErr) {
      console.error('Failed to delete upload state after success:', {
        uploadId,
        fileId: state.fileId,
        error: kvErr instanceof Error ? kvErr.message : String(kvErr),
      });
    }

    const cdnUrl = `https://cdn.sugertiger77.com/${state.fileId}`;

    return jsonResponse(
      {
        success: true,
        id: state.fileId,
        cdnUrl,
        deleteToken: state.deleteToken,
      },
      200,
      undefined,
      origin,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to complete upload';
    console.error('Complete upload error:', err);
    return errorResponse(message, 500, origin);
  }
};

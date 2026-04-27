import type { FileMetadata } from '../types';

function buildCustomMetadata(metadata: FileMetadata): Record<string, string> {
  return {
    id: metadata.id,
    filename: metadata.filename,
    contentType: metadata.contentType,
    size: String(metadata.size),
    uploadedAt: metadata.uploadedAt,
    deleteToken: metadata.deleteToken,
    ...(metadata.apiKeyId ? { apiKeyId: metadata.apiKeyId } : {}),
  };
}

export async function uploadFile(
  bucket: R2Bucket,
  id: string,
  data: ArrayBuffer,
  metadata: FileMetadata,
  contentType: string,
): Promise<void> {
  await bucket.put(id, data, {
    httpMetadata: { contentType },
    customMetadata: buildCustomMetadata(metadata),
  });
}

export async function getFileMetadata(
  bucket: R2Bucket,
  id: string,
): Promise<FileMetadata | null> {
  const obj = await bucket.head(id);
  if (!obj) return null;

  const custom = obj.customMetadata || {};
  return {
    id: custom.id || id,
    filename: custom.filename || 'unknown',
    contentType: custom.contentType || 'application/octet-stream',
    size: obj.size,
    uploadedAt: custom.uploadedAt || '',
    deleteToken: custom.deleteToken || '',
    apiKeyId: custom.apiKeyId,
  };
}

export async function getFile(
  bucket: R2Bucket,
  id: string,
): Promise<{
  body: ReadableStream;
  metadata: FileMetadata;
  contentType: string;
} | null> {
  const obj = await bucket.get(id);
  if (!obj) return null;

  const custom = obj.customMetadata || {};
  const metadata: FileMetadata = {
    id: custom.id || id,
    filename: custom.filename || 'unknown',
    contentType: custom.contentType || 'application/octet-stream',
    size: obj.size,
    uploadedAt: custom.uploadedAt || '',
    deleteToken: custom.deleteToken || '',
    apiKeyId: custom.apiKeyId,
  };

  return {
    body: obj.body,
    metadata,
    contentType: obj.httpMetadata?.contentType || metadata.contentType,
  };
}

export async function deleteFile(bucket: R2Bucket, id: string): Promise<void> {
  await bucket.delete(id);
}

export async function startMultipartUpload(
  bucket: R2Bucket,
  fileId: string,
  metadata: FileMetadata,
): Promise<R2MultipartUpload> {
  return bucket.createMultipartUpload(fileId, {
    httpMetadata: { contentType: metadata.contentType },
    customMetadata: buildCustomMetadata(metadata),
  });
}

export async function resumeMultipartUpload(
  bucket: R2Bucket,
  fileId: string,
  uploadId: string,
): Promise<R2MultipartUpload> {
  return bucket.resumeMultipartUpload(fileId, uploadId);
}

export async function uploadPart(
  upload: R2MultipartUpload,
  partNumber: number,
  data: ArrayBuffer,
): Promise<R2UploadedPart>;
export async function uploadPart(
  upload: R2MultipartUpload,
  partNumber: number,
  data: ReadableStream<Uint8Array>,
  options: { contentLength: number },
): Promise<R2UploadedPart>;
export async function uploadPart(
  upload: R2MultipartUpload,
  partNumber: number,
  data: ArrayBuffer | ReadableStream<Uint8Array>,
  options?: { contentLength: number },
): Promise<R2UploadedPart> {
  if (data instanceof ReadableStream) {
    // `contentLength` is required by the R2 runtime when uploading a stream,
    // but is not declared on R2UploadPartOptions in @cloudflare/workers-types
    // (verified up to 4.20260426.1). Cast is needed until the types catch up.
    return upload.uploadPart(partNumber, data, {
      contentLength: options!.contentLength,
    } as R2UploadPartOptions);
  }
  return upload.uploadPart(partNumber, data);
}

export async function completeMultipartUpload(
  upload: R2MultipartUpload,
  parts: R2UploadedPart[],
): Promise<R2Object> {
  return upload.complete(parts);
}

export async function abortMultipartUpload(
  upload: R2MultipartUpload,
): Promise<void> {
  await upload.abort();
}

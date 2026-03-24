import type { ImageMetadata } from '../types';

export async function uploadImage(
  bucket: R2Bucket,
  id: string,
  data: ArrayBuffer,
  metadata: ImageMetadata,
  contentType: string,
): Promise<void> {
  await bucket.put(id, data, {
    httpMetadata: { contentType },
    customMetadata: {
      id: metadata.id,
      filename: metadata.filename,
      contentType: metadata.contentType,
      size: String(metadata.size),
      uploadedAt: metadata.uploadedAt,
      deleteToken: metadata.deleteToken,
    },
  });
}

export async function getImageMetadata(
  bucket: R2Bucket,
  id: string,
): Promise<ImageMetadata | null> {
  const obj = await bucket.head(id);
  if (!obj) return null;

  const custom = obj.customMetadata || {};
  return {
    id: custom.id || id,
    filename: custom.filename || 'unknown',
    contentType: custom.contentType || 'application/octet-stream',
    size: Number(custom.size) || 0,
    uploadedAt: custom.uploadedAt || '',
    deleteToken: custom.deleteToken || '',
  };
}

export async function getImage(
  bucket: R2Bucket,
  id: string,
): Promise<{
  body: ReadableStream;
  metadata: ImageMetadata;
  contentType: string;
} | null> {
  const obj = await bucket.get(id);
  if (!obj) return null;

  const custom = obj.customMetadata || {};
  const metadata: ImageMetadata = {
    id: custom.id || id,
    filename: custom.filename || 'unknown',
    contentType: custom.contentType || 'application/octet-stream',
    size: Number(custom.size) || 0,
    uploadedAt: custom.uploadedAt || '',
    deleteToken: custom.deleteToken || '',
  };

  return {
    body: obj.body,
    metadata,
    contentType: obj.httpMetadata?.contentType || metadata.contentType,
  };
}

export async function deleteImage(
  bucket: R2Bucket,
  id: string,
): Promise<void> {
  await bucket.delete(id);
}

export async function listImages(
  bucket: R2Bucket,
  cursor?: string,
  limit = 50,
): Promise<{ images: ImageMetadata[]; cursor?: string }> {
  const listed = await bucket.list({
    limit,
    cursor: cursor || undefined,
  });

  const images: ImageMetadata[] = listed.objects.map((obj) => {
    const custom = obj.customMetadata || {};
    return {
      id: custom.id || obj.key,
      filename: custom.filename || 'unknown',
      contentType: custom.contentType || 'application/octet-stream',
      size: Number(custom.size) || obj.size,
      uploadedAt: custom.uploadedAt || obj.uploaded.toISOString(),
      deleteToken: '',
    };
  });

  return {
    images,
    cursor: listed.truncated ? listed.cursor : undefined,
  };
}

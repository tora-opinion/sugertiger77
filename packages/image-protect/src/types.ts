export interface Env {
  IMAGE_BUCKET: R2Bucket;
  RATE_LIMIT_KV: KVNamespace;
  ADMIN_PASSWORD_HASH: string;
  SIGNING_SECRET: string;
  MAX_FILE_SIZE: string;
  ALLOWED_TYPES: string;
  RATE_LIMIT_UPLOAD: string;
  RATE_LIMIT_CDN: string;
  SIGNED_URL_EXPIRY: string;
}

export interface ImageMetadata {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  deleteToken: string;
}

export interface AuthSession {
  authenticated: boolean;
  expiresAt: number;
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface UploadResponse {
  success: true;
  id: string;
  cdnUrl: string;
  previewUrl: string;
  deleteToken: string;
  signedUrl: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code: number;
}

export interface PagesContext {
  request: Request;
  env: Env;
  params: Record<string, string>;
  next: () => Promise<Response>;
  data: Record<string, unknown>;
}

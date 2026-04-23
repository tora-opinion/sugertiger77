export interface Env {
  FILE_BUCKET: R2Bucket;
  RATE_LIMIT_KV: KVNamespace;
  RATE_LIMITER_UPLOAD?: RateLimit;
  RATE_LIMITER_CDN?: RateLimit;
  API_KEYS_KV: KVNamespace;
  UPLOAD_STATE_KV: KVNamespace;
  MAX_FILE_SIZE: string;
  PART_SIZE: string;
  RATE_LIMIT_UPLOAD: string;
  RATE_LIMIT_CDN: string;
  CDN_HOST?: string;
  UPLOAD_HOST?: string;
}

export interface FileMetadata {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  deleteToken: string;
  apiKeyId?: string;
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface UploadState {
  fileId: string;
  uploadId: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: string;
  apiKeyId: string;
  deleteToken: string;
}

export interface ApiKeyInfo {
  id: string;
  createdAt: string;
  name?: string;
}

export interface RequestAuth {
  apiKeyId: string | null;
  keyData: ApiKeyInfo | null;
}

export interface PagesContext {
  request: Request;
  env: Env;
  params: Record<string, string>;
  next: () => Promise<Response>;
  data: Record<string, unknown>;
}

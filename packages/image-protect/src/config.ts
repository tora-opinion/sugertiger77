export const config = {
  maxFileSize: 10 * 1024 * 1024,
  maxFileSizeLimit: 25 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  rateLimits: {
    upload: { max: 10, windowSec: 60 },
    cdn: { max: 100, windowSec: 60 },
    api: { max: 100, windowSec: 60 },
    auth: { max: 5, windowSec: 300 },
  },
  signedUrlExpiry: 3600,
  sessionExpiry: 86400,
  corsOrigins: ['https://protect.sugertiger77.com', 'http://localhost:8788'],
} as const;

export function getConfig(env: {
  MAX_FILE_SIZE?: string;
  ALLOWED_TYPES?: string;
  RATE_LIMIT_UPLOAD?: string;
  RATE_LIMIT_CDN?: string;
  SIGNED_URL_EXPIRY?: string;
}) {
  const positiveInteger = (
    value: string | undefined,
    fallback: number,
    maximum: number,
  ): number => {
    if (!value || !/^\d+$/.test(value)) return fallback;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum
      ? parsed
      : fallback;
  };

  return {
    maxFileSize: positiveInteger(
      env.MAX_FILE_SIZE,
      config.maxFileSize,
      config.maxFileSizeLimit,
    ),
    allowedTypes: env.ALLOWED_TYPES
      ? [...new Set(env.ALLOWED_TYPES.split(',').map((type) => type.trim()).filter(Boolean))]
      : [...config.allowedTypes],
    rateLimits: {
      upload: {
        max: positiveInteger(env.RATE_LIMIT_UPLOAD, config.rateLimits.upload.max, 1000),
        windowSec: 60,
      },
      cdn: {
        max: positiveInteger(env.RATE_LIMIT_CDN, config.rateLimits.cdn.max, 10000),
        windowSec: 60,
      },
      api: config.rateLimits.api,
      auth: config.rateLimits.auth,
    },
    signedUrlExpiry: positiveInteger(
      env.SIGNED_URL_EXPIRY,
      config.signedUrlExpiry,
      7 * 24 * 60 * 60,
    ),
    sessionExpiry: config.sessionExpiry,
    corsOrigins: [...config.corsOrigins],
  };
}

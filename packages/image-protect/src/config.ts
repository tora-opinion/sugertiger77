export const config = {
  maxFileSize: 10 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  rateLimits: {
    upload: { max: 10, windowSec: 60 },
    cdn: { max: 100, windowSec: 60 },
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
  return {
    maxFileSize: Number(env.MAX_FILE_SIZE) || config.maxFileSize,
    allowedTypes: env.ALLOWED_TYPES?.split(',') || [...config.allowedTypes],
    rateLimits: {
      upload: {
        max: Number(env.RATE_LIMIT_UPLOAD) || config.rateLimits.upload.max,
        windowSec: 60,
      },
      cdn: {
        max: Number(env.RATE_LIMIT_CDN) || config.rateLimits.cdn.max,
        windowSec: 60,
      },
    },
    signedUrlExpiry:
      Number(env.SIGNED_URL_EXPIRY) || config.signedUrlExpiry,
    sessionExpiry: config.sessionExpiry,
    corsOrigins: [...config.corsOrigins],
  };
}

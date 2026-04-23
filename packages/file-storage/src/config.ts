export const config = {
  maxFileSize: 1024 * 1024 * 1024, // 1GB
  partSize: 16 * 1024 * 1024, // 16MB
  smallFileThreshold: 100 * 1024 * 1024, // 100MB
  rateLimits: {
    upload: { max: 20, windowSec: 60 },
    cdn: { max: 200, windowSec: 60 },
  },
  corsOrigins: [
    'https://cdn.sugertiger77.com',
    'https://up.sugertiger77.com',
    'http://localhost:8788',
  ],
} as const;

export function getConfig(env: {
  MAX_FILE_SIZE?: string;
  PART_SIZE?: string;
  RATE_LIMIT_UPLOAD?: string;
  RATE_LIMIT_CDN?: string;
}) {
  return {
    maxFileSize: Number(env.MAX_FILE_SIZE) || config.maxFileSize,
    partSize: Number(env.PART_SIZE) || config.partSize,
    smallFileThreshold: config.smallFileThreshold,
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
    corsOrigins: [...config.corsOrigins],
  };
}

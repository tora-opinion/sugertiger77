const SOCIAL_CRAWLER_ORIGINS = [
  'https://twitter.com',
  'https://x.com',
  'https://t.co',
  'https://www.facebook.com',
  'https://facebook.com',
  'https://www.linkedin.com',
  'https://discord.com',
];

export function isHotlink(
  request: Request,
  allowedOrigins: string[],
): { blocked: boolean; reason?: string } {
  const referer = request.headers.get('referer');

  // No referer — allow (direct access, privacy browsers, bookmarks)
  if (!referer) {
    return { blocked: false };
  }

  try {
    const refererOrigin = new URL(referer).origin;

    // Allow social media crawlers for OGP/card previews
    if (SOCIAL_CRAWLER_ORIGINS.includes(refererOrigin)) {
      return { blocked: false };
    }

    for (const allowed of allowedOrigins) {
      if (refererOrigin === allowed) {
        return { blocked: false };
      }
    }

    return {
      blocked: true,
      reason: `Hotlink from ${refererOrigin}`,
    };
  } catch {
    // Malformed referer — block
    return { blocked: true, reason: 'Invalid referer' };
  }
}

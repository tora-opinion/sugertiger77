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

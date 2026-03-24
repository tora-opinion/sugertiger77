import type { Env } from '../../src/types';
import { getImage, getImageMetadata } from '../../src/storage/r2';
import { errorResponse } from '../../src/utils/response';

interface Context {
  request: Request;
  env: Env;
  params: Record<string, string>;
  next: () => Promise<Response>;
}

const IMAGE_ID_PATTERN = /^[0-9a-f]{16}$/;

const SOCIAL_CRAWLERS = [
  /Twitterbot/i,
  /facebookexternalhit/i,
  /LinkedInBot/i,
  /Discordbot/i,
  /Slackbot/i,
  /TelegramBot/i,
  /WhatsApp/i,
  /Pinterestbot/i,
];

function isSocialCrawler(ua: string): boolean {
  return SOCIAL_CRAWLERS.some((p) => p.test(ua));
}

function wantsBrowserView(request: Request): boolean {
  const accept = request.headers.get('accept') || '';
  if (!accept) return false;
  // img tags send Accept starting with image/; browser navigation starts with text/html
  const firstType = accept.split(',')[0].trim().split(';')[0].trim();
  if (firstType.startsWith('image/')) return false;
  return accept.includes('text/html');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export const onRequestGet = async (context: Context): Promise<Response> => {
  try {
    const id = context.params.id;
    if (!id || !IMAGE_ID_PATTERN.test(id)) {
      return errorResponse('Invalid image ID', 400);
    }

    const ua = context.request.headers.get('user-agent') || '';
    const needsHtml = isSocialCrawler(ua) || wantsBrowserView(context.request);

    // Raw query param forces raw image delivery (for img tags on the viewer page)
    const url = new URL(context.request.url);
    if (url.searchParams.has('raw')) {
      return serveRawImage(context.env, id);
    }

    if (needsHtml) {
      return serveViewerPage(context, id);
    }

    return serveRawImage(context.env, id);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to serve image';
    return errorResponse(message, 500);
  }
};

async function serveRawImage(env: Env, id: string): Promise<Response> {
  const result = await getImage(env.IMAGE_BUCKET, id);
  if (!result) {
    return errorResponse('Image not found', 404);
  }

  return new Response(result.body, {
    status: 200,
    headers: {
      'Content-Type': result.contentType,
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function serveViewerPage(context: Context, id: string): Promise<Response> {
  const metadata = await getImageMetadata(context.env.IMAGE_BUCKET, id);
  if (!metadata) {
    return new Response(notFoundPage(), {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'same-origin',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
      },
    });
  }

  const baseUrl = new URL(context.request.url).origin;
  const cdnUrl = `${baseUrl}/cdn/${id}`;
  const rawUrl = `${baseUrl}/cdn/${id}?raw=1`;
  const title = `${metadata.filename} — Image Protect`;
  const description = `保護された画像 (${formatSize(metadata.size)}) — Image Protect by sugertiger77`;

  const html = fullscreenViewer({
    title,
    description,
    cdnUrl,
    rawUrl,
    filename: metadata.filename,
    size: formatSize(metadata.size),
  });

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
    },
  });
}

interface ViewerData {
  title: string;
  description: string;
  cdnUrl: string;
  rawUrl: string;
  filename: string;
  size: string;
}

function fullscreenViewer(data: ViewerData): string {
  const t = escapeHtml(data.title);
  const d = escapeHtml(data.description);
  const cdn = escapeHtml(data.cdnUrl);
  const raw = escapeHtml(data.rawUrl);
  const fn = escapeHtml(data.filename);
  const sz = escapeHtml(data.size);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${t}</title>
  <meta name="description" content="${d}" />
  <link rel="canonical" href="${cdn}" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

  <!-- OGP -->
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:image" content="${raw}" />
  <meta property="og:url" content="${cdn}" />
  <meta property="og:type" content="article" />
  <meta property="og:locale" content="ja_JP" />
  <meta property="og:site_name" content="Image Protect" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@sugertiger77" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${raw}" />

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    body {
      background: #0a0a0a;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .viewer {
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      cursor: zoom-in;
    }
    .viewer img {
      max-width: 100vw;
      max-height: 100vh;
      object-fit: contain;
      display: block;
      user-select: none;
      -webkit-user-drag: none;
    }
    .overlay {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 1rem 1.5rem;
      background: linear-gradient(transparent, rgba(0,0,0,0.7));
      display: flex;
      align-items: center;
      justify-content: space-between;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
      z-index: 10;
    }
    body:hover .overlay,
    body:focus-within .overlay { opacity: 1; pointer-events: auto; }
    .info {
      color: rgba(255,255,255,0.9);
      font-size: 0.8125rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .info .badge {
      background: rgba(37,99,235,0.8);
      color: #fff;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.6875rem;
      font-weight: 600;
    }
    .actions { display: flex; gap: 0.5rem; }
    .actions a {
      color: #fff;
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(8px);
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      text-decoration: none;
      font-size: 0.75rem;
      font-weight: 600;
      transition: background 0.2s;
    }
    .actions a:hover { background: rgba(255,255,255,0.25); }
    @media (prefers-reduced-motion: reduce) {
      * { transition: none !important; }
    }
  </style>
</head>
<body>
  <div class="viewer" id="viewer" data-raw-url="${raw}">
    <img src="${raw}" alt="${fn}" loading="eager" />
  </div>
  <div class="overlay">
    <div class="info">
      <span class="badge">🛡️ Protected</span>
      <span>${fn} · ${sz}</span>
    </div>
    <div class="actions">
      <a href="${raw}" target="_blank" rel="noopener">原寸表示</a>
      <a href="/">Image Protect</a>
    </div>
  </div>
  <script>
    document.getElementById('viewer').addEventListener('click', function() {
      window.open(this.dataset.rawUrl, '_blank', 'noopener');
    });
  </script>
</body>
</html>`;
}

function notFoundPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>画像が見つかりません — Image Protect</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #0a0a0a;
      color: #f9fafb;
      text-align: center;
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #9ca3af; margin-bottom: 1rem; }
    a { color: #3b82f6; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div>
    <h1>😔 画像が見つかりません</h1>
    <p>この画像は存在しないか、削除された可能性があります。</p>
    <a href="/">Image Protect トップへ</a>
  </div>
</body>
</html>`;
}

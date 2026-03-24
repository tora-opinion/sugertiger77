import type { Env } from '../../src/types';
import { getImageMetadata } from '../../src/storage/r2';
import { errorResponse } from '../../src/utils/response';

interface Context {
  request: Request;
  env: Env;
  params: Record<string, string>;
  next: () => Promise<Response>;
}

const IMAGE_ID_PATTERN = /^[0-9a-f]{16}$/;

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

    const metadata = await getImageMetadata(context.env.IMAGE_BUCKET, id);
    if (!metadata) {
      return new Response(notFoundPage(), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const baseUrl = new URL(context.request.url).origin;
    const cdnUrl = `${baseUrl}/cdn/${id}`;
    const previewUrl = `${baseUrl}/preview/${id}`;
    const title = `${metadata.filename} — Image Protect`;
    const description = `保護された画像 (${formatSize(metadata.size)}) — Image Protect by sugertiger77`;

    const html = previewPage({
      title,
      description,
      cdnUrl,
      previewUrl,
      filename: metadata.filename,
      size: formatSize(metadata.size),
      contentType: metadata.contentType,
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; frame-ancestors 'none'",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load preview';
    return errorResponse(message, 500);
  }
};

interface PreviewData {
  title: string;
  description: string;
  cdnUrl: string;
  previewUrl: string;
  filename: string;
  size: string;
  contentType: string;
}

function previewPage(data: PreviewData): string {
  const t = escapeHtml(data.title);
  const d = escapeHtml(data.description);
  const cdn = escapeHtml(data.cdnUrl);
  const preview = escapeHtml(data.previewUrl);
  const fn = escapeHtml(data.filename);
  const sz = escapeHtml(data.size);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${t}</title>
  <meta name="description" content="${d}" />
  <link rel="canonical" href="${preview}" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

  <!-- OGP -->
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:image" content="${cdn}" />
  <meta property="og:url" content="${preview}" />
  <meta property="og:type" content="article" />
  <meta property="og:locale" content="ja_JP" />
  <meta property="og:site_name" content="Image Protect" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@sugertiger77" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${cdn}" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;600;700&display=swap" rel="stylesheet" />

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #ffffff;
      --bg-secondary: #f9fafb;
      --fg: #111827;
      --fg-muted: #6b7280;
      --accent: #2563eb;
      --accent-hover: #1d4ed8;
      --card-bg: #ffffff;
      --card-border: #e5e7eb;
      --font: 'Inter', 'Noto Sans JP', ui-sans-serif, system-ui, sans-serif;
      --radius: 16px;
      --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      --shadow-lg: 0 10px 25px rgba(0,0,0,0.08);
    }

    .dark {
      --bg: #030712;
      --bg-secondary: #111827;
      --fg: #f9fafb;
      --fg-muted: #9ca3af;
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --card-bg: #1f2937;
      --card-border: #374151;
    }

    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--fg);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .header {
      position: sticky;
      top: 0;
      z-index: 50;
      backdrop-filter: blur(12px);
      background: color-mix(in srgb, var(--bg) 80%, transparent);
      border-bottom: 1px solid var(--card-border);
      padding: 0.75rem 0;
    }

    .container {
      max-width: 1024px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }

    .header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .logo {
      font-weight: 700;
      font-size: 1.125rem;
      color: var(--fg);
      text-decoration: none;
    }

    .nav-link {
      color: var(--fg-muted);
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      transition: color 200ms;
    }
    .nav-link:hover { color: var(--accent); }

    .viewer {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 1.5rem;
      gap: 1.5rem;
    }

    .image-container {
      max-width: 100%;
      max-height: 70vh;
      border-radius: var(--radius);
      overflow: hidden;
      box-shadow: var(--shadow-lg);
      background: var(--bg-secondary);
    }

    .image-container img {
      display: block;
      max-width: 100%;
      max-height: 70vh;
      object-fit: contain;
    }

    .image-info {
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .image-info h1 {
      font-size: 1.25rem;
      font-weight: 600;
      word-break: break-all;
    }

    .image-meta {
      font-size: 0.875rem;
      color: var(--fg-muted);
    }

    .actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      justify-content: center;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      border-radius: 10px;
      font-weight: 600;
      font-size: 0.875rem;
      text-decoration: none;
      border: none;
      cursor: pointer;
      transition: background 200ms, transform 100ms;
    }
    .btn:active { transform: scale(0.97); }

    .btn-primary {
      background: var(--accent);
      color: #fff;
    }
    .btn-primary:hover { background: var(--accent-hover); }

    .btn-secondary {
      background: var(--bg-secondary);
      color: var(--fg);
      border: 1px solid var(--card-border);
    }
    .btn-secondary:hover { background: var(--card-border); }

    .footer {
      padding: 1.5rem 0;
      text-align: center;
      font-size: 0.75rem;
      color: var(--fg-muted);
      border-top: 1px solid var(--card-border);
    }
    .footer a { color: var(--accent); text-decoration: none; }

    .shield-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.75rem;
      background: color-mix(in srgb, var(--accent) 10%, transparent);
      color: var(--accent);
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    @media (prefers-reduced-motion: reduce) {
      * { transition: none !important; animation: none !important; }
    }
  </style>

  <script>
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  </script>
</head>
<body>
  <header class="header">
    <div class="container header-inner">
      <a href="/" class="logo">🛡️ Image Protect</a>
      <nav style="display:flex;gap:1rem;align-items:center;">
        <a href="/" class="nav-link">アップロード</a>
        <a href="https://sugertiger77.com" class="nav-link" target="_blank" rel="noopener">Portfolio</a>
      </nav>
    </div>
  </header>

  <main class="viewer">
    <div class="image-container">
      <img src="${cdn}" alt="${fn}" loading="eager" />
    </div>
    <div class="image-info">
      <h1>${fn}</h1>
      <p class="image-meta">${sz} · <span class="shield-badge">🛡️ Protected</span></p>
    </div>
    <div class="actions">
      <a href="${cdn}" class="btn btn-primary" target="_blank" rel="noopener">原寸で表示</a>
      <a href="/" class="btn btn-secondary">Image Protect へ</a>
    </div>
  </main>

  <footer class="footer">
    <div class="container">
      <p>&copy; 2025 sugertiger77 — <a href="https://sugertiger77.com">sugertiger77.com</a></p>
    </div>
  </footer>
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
      font-family: 'Inter', 'Noto Sans JP', system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #f9fafb;
      color: #111827;
      text-align: center;
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #6b7280; margin-bottom: 1rem; }
    a { color: #2563eb; text-decoration: none; font-weight: 600; }
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

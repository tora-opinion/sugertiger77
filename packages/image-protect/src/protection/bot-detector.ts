const BLOCKED_UA_PATTERNS = [
  /python-requests/i,
  /python-urllib/i,
  /scrapy/i,
  /wget/i,
  /curl\//i,
  /httrack/i,
  /libwww/i,
  /Go-http-client/i,
  /Java\//i,
  /Apache-HttpClient/i,
  /node-fetch/i,
  /axios/i,
  /puppeteer/i,
  /playwright/i,
  /selenium/i,
  /headless/i,
  /PhantomJS/i,
  /CasperJS/i,
  /okhttp/i,
];

// AI training crawlers — block on CDN/preview routes
const AI_CRAWLER_PATTERNS = [
  /GPTBot/i,
  /ChatGPT-User/i,
  /ClaudeBot/i,
  /anthropic-ai/i,
  /CCBot/i,
  /Google-Extended/i,
  /Bytespider/i,
  /PerplexityBot/i,
  /cohere-ai/i,
  /Applebot-Extended/i,
  /Amazonbot/i,
  /FacebookBot/i,
  /Omgilibot/i,
  /YouBot/i,
  /Diffbot/i,
  /ImagesiftBot/i,
  /Ai2Bot/i,
];

const ALLOWED_BOTS = [
  /Googlebot/i,
  /Bingbot/i,
  /Slurp/i,
  /DuckDuckBot/i,
  /facebookexternalhit/i,
  /Twitterbot/i,
  /LinkedInBot/i,
  /Discordbot/i,
];

export function detectBot(
  request: Request,
): { isBot: boolean; reason?: string } {
  const ua = request.headers.get('user-agent') || '';

  if (!ua) {
    return { isBot: true, reason: 'Missing User-Agent' };
  }

  for (const pattern of ALLOWED_BOTS) {
    if (pattern.test(ua)) {
      return { isBot: false };
    }
  }

  for (const pattern of AI_CRAWLER_PATTERNS) {
    if (pattern.test(ua)) {
      return { isBot: true, reason: `AI crawler blocked: ${ua.slice(0, 50)}` };
    }
  }

  for (const pattern of BLOCKED_UA_PATTERNS) {
    if (pattern.test(ua)) {
      return { isBot: true, reason: `Blocked UA: ${ua.slice(0, 50)}` };
    }
  }

  return { isBot: false };
}

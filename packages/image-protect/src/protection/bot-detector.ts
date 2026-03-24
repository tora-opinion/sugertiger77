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

  for (const pattern of BLOCKED_UA_PATTERNS) {
    if (pattern.test(ua)) {
      return { isBot: true, reason: `Blocked UA: ${ua.slice(0, 50)}` };
    }
  }

  return { isBot: false };
}

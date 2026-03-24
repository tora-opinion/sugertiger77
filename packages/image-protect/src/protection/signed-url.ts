const encoder = new TextEncoder();

async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacVerify(
  data: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const expected = await hmacSign(data, secret);
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

const IMAGE_ID_PATTERN = /^[0-9a-f]{16}$/;

export async function generateSignedUrl(
  baseUrl: string,
  imageId: string,
  secret: string,
  expirySec: number,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + expirySec;
  const payload = `${imageId}:${exp}`;
  const sig = await hmacSign(payload, secret);
  return `${baseUrl}/api/image/${imageId}?sig=${sig}&exp=${exp}`;
}

export async function validateSignedUrl(
  request: Request,
  secret: string,
): Promise<{ valid: boolean; imageId?: string }> {
  try {
    const url = new URL(request.url);
    const sig = url.searchParams.get('sig');
    const exp = url.searchParams.get('exp');
    if (!sig || !exp) return { valid: false };

    const now = Math.floor(Date.now() / 1000);
    if (Number(exp) < now) return { valid: false };

    const pathParts = url.pathname.split('/');
    const imageId = pathParts[pathParts.length - 1];
    if (!imageId || !IMAGE_ID_PATTERN.test(imageId)) return { valid: false };

    const payload = `${imageId}:${exp}`;
    const valid = await hmacVerify(payload, sig, secret);
    return { valid, imageId: valid ? imageId : undefined };
  } catch {
    return { valid: false };
  }
}

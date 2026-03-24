import { verifyPassword } from './utils/crypto';

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

export async function createSessionToken(
  secret: string,
  expirySec: number,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + expirySec;
  const payload = `session:${exp}`;
  const sig = await hmacSign(payload, secret);
  return btoa(JSON.stringify({ exp, sig }));
}

export async function validateSession(
  token: string,
  secret: string,
): Promise<boolean> {
  try {
    const { exp, sig } = JSON.parse(atob(token)) as {
      exp: number;
      sig: string;
    };
    const now = Math.floor(Date.now() / 1000);
    if (exp < now) return false;
    const payload = `session:${exp}`;
    return hmacVerify(payload, sig, secret);
  } catch {
    return false;
  }
}

export async function authenticateAdmin(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return verifyPassword(password, passwordHash);
}

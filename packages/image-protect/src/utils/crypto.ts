const encoder = new TextEncoder();
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;

// --- PBKDF2 Password Hashing ---

async function derivePbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Hash password with PBKDF2. Returns "salt$hash" hex string. */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);
  const hash = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `${bytesToHex(salt)}$${hash}`;
}

/** Verify password against "salt$hash" format. Timing-safe. */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 2) return false;
  const salt = hexToBytes(parts[0]);
  const expectedHash = parts[1];
  const computed = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
  if (computed.length !== expectedHash.length) return false;
  let result = 0;
  for (let i = 0; i < computed.length; i++) {
    result |= computed.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return result === 0;
}

// --- ID / Token Generation ---

export function generateId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateDeleteToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// --- HMAC Signing ---

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

// --- Signed URLs ---

export async function createSignedUrl(
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

export async function verifySignedUrl(
  url: string,
  secret: string,
): Promise<{ valid: boolean; imageId?: string }> {
  try {
    const parsed = new URL(url);
    const sig = parsed.searchParams.get('sig');
    const exp = parsed.searchParams.get('exp');
    if (!sig || !exp) return { valid: false };

    const now = Math.floor(Date.now() / 1000);
    if (Number(exp) < now) return { valid: false };

    const pathParts = parsed.pathname.split('/');
    const imageId = pathParts[pathParts.length - 1];
    if (!imageId) return { valid: false };

    const payload = `${imageId}:${exp}`;
    const valid = await hmacVerify(payload, sig, secret);
    return { valid, imageId: valid ? imageId : undefined };
  } catch {
    return { valid: false };
  }
}

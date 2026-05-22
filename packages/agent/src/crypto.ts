const encoder = new TextEncoder();

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return 'agk_' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function deriveEncryptionKey(keyMaterial: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptCardData(plaintext: string, encryptionKey: string): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const keyBytes = hexToBytes(encryptionKey);
  const key = await deriveEncryptionKey(keyBytes);
  const encoded = encoder.encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return bytesToHex(combined);
}

export async function decryptCardData(hexData: string, encryptionKey: string): Promise<string> {
  const combined = hexToBytes(hexData);
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const keyBytes = hexToBytes(encryptionKey);
  const key = await deriveEncryptionKey(keyBytes);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

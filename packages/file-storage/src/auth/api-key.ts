import type { ApiKeyInfo } from '../types';

export async function validateApiKey(
  kv: KVNamespace,
  authHeader: string | null,
): Promise<{ valid: boolean; keyId?: string; keyData?: ApiKeyInfo }> {
  if (!authHeader) {
    return { valid: false };
  }

  const match = authHeader.match(/^Bearer\s+(fsk_[a-f0-9]{32})$/i);
  if (!match) {
    return { valid: false };
  }

  const apiKey = match[1];
  const keyInfo = await kv.get<ApiKeyInfo>(`apikey:${apiKey}`, 'json');

  if (!keyInfo) {
    return { valid: false };
  }

  return { valid: true, keyId: keyInfo.id, keyData: keyInfo };
}

export function createApiKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const randomPart = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `fsk_${randomPart}`;
}

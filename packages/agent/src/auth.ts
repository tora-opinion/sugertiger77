const encoder = new TextEncoder();

export async function sha256(data: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function validateApiKey(request: Request, kv: KVNamespace): Promise<{ valid: boolean; keyId?: string; keyName?: string }> {
  const auth = request.headers.get('Authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/);
  if (!match) return { valid: false };
  const keyHash = await sha256(match[1]);
  const stored = await kv.get('apikey:' + keyHash);
  if (!stored) return { valid: false };
  const data = JSON.parse(stored) as { id: string; name: string };
  return { valid: true, keyId: data.id, keyName: data.name };
}

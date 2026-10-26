export function parseAdminAuthBody(json: string): { password: string } | null {
  let body: unknown;
  try {
    body = JSON.parse(json) as unknown;
  } catch {
    return null;
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return null;
  }

  const password = (body as { password?: unknown }).password;
  if (typeof password !== 'string' || !password) return null;
  return { password };
}

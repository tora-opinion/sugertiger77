const INVALID_FILENAME_CHARS = /[\u0000-\u001f\u007f"\\\r\n]/g;
const NON_ASCII_CHARS = /[^\x20-\x7e]/g;
const RESERVED_FILENAME = /^\.{1,2}$/;
const MAX_FILENAME_LENGTH = 255;

function sanitizeAsciiFilename(filename: string, fallback: string): string {
  const sanitized = filename
    .replace(INVALID_FILENAME_CHARS, '')
    .replace(NON_ASCII_CHARS, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_FILENAME_LENGTH);

  if (!sanitized || RESERVED_FILENAME.test(sanitized)) {
    return fallback;
  }

  return sanitized;
}

function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function buildInlineContentDisposition(
  filename: string,
  fileId: string,
): string {
  const fallback = `file-${fileId}`;
  const safeSource = filename.trim() || fallback;
  const asciiFilename = sanitizeAsciiFilename(safeSource, fallback);
  const encodedFilename = encodeRfc5987(safeSource);
  return `inline; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`;
}

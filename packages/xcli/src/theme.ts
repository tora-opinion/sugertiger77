// Color theme: orange accent, truecolor with 256-color fallback, honors NO_COLOR / non-TTY.

export type RGB = [number, number, number];

const env = process.env;
export const colorEnabled = !env.NO_COLOR && env.TERM !== "dumb" && (process.stdout.isTTY ?? false);
export const truecolor = colorEnabled && (
  /truecolor|24bit/i.test(env.COLORTERM ?? "") || !!env.WT_SESSION || env.TERM_PROGRAM === "vscode" || process.platform === "win32"
);

function to256([r, g, b]: RGB): number {
  const c = (v: number) => Math.round((v / 255) * 5);
  return 16 + 36 * c(r) + 6 * c(g) + c(b);
}

export function fg(rgb: RGB): string {
  if (!colorEnabled) return "";
  return truecolor ? `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m` : `\x1b[38;5;${to256(rgb)}m`;
}

export function bg(rgb: RGB): string {
  if (!colorEnabled) return "";
  return truecolor ? `\x1b[48;2;${rgb[0]};${rgb[1]};${rgb[2]}m` : `\x1b[48;5;${to256(rgb)}m`;
}

export const RESET = colorEnabled ? "\x1b[0m" : "";

const paint = (rgb: RGB) => (s: string) => (colorEnabled ? `${fg(rgb)}${s}\x1b[39m` : s);
const sgr = (on: number, off: number) => (s: string) => (colorEnabled ? `\x1b[${on}m${s}\x1b[${off}m` : s);

export const ORANGE: RGB = [255, 138, 42];
export const ORANGE_SOFT: RGB = [255, 186, 120];
export const ORANGE_DEEP: RGB = [214, 96, 24];

export const t = {
  accent: paint(ORANGE),
  soft: paint(ORANGE_SOFT),
  deep: paint(ORANGE_DEEP),
  text: paint([236, 232, 226]),
  muted: paint([138, 132, 128]),
  faint: paint([92, 88, 86]),
  ok: paint([126, 211, 132]),
  err: paint([255, 106, 106]),
  warn: paint([255, 204, 92]),
  info: paint([120, 190, 255]),
  bold: sgr(1, 22),
  italic: sgr(3, 23),
};

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;
export function stripAnsi(s: string): string {
  return s.replace(ANSI, "");
}

function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0x303e) || (cp >= 0x3041 && cp <= 0x33ff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x1f300 && cp <= 0x1faff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  );
}

/** Display width in terminal cells (CJK = 2). */
export function strWidth(s: string): number {
  let w = 0;
  for (const ch of stripAnsi(s)) w += isWide(ch.codePointAt(0) ?? 0) ? 2 : 1;
  return w;
}

/** Truncate plain text to a display width. */
export function truncW(s: string, max: number): string {
  if (strWidth(s) <= max) return s;
  let w = 0;
  let out = "";
  for (const ch of s) {
    const cw = isWide(ch.codePointAt(0) ?? 0) ? 2 : 1;
    if (w + cw > max - 1) break;
    out += ch;
    w += cw;
  }
  return out + "…";
}

export function padW(s: string, width: number): string {
  return s + " ".repeat(Math.max(0, width - strWidth(s)));
}

export function termCols(): number {
  return Math.max(40, process.stdout.columns ?? 80);
}

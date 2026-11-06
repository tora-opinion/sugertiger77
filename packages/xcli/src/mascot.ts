// Mikan — xcli's original mascot: a small mandarin orange with a leaf.
// Pixel art is drawn with half-block characters (2 vertical pixels per terminal cell).

import { bg, colorEnabled, fg, RESET, type RGB, strWidth, t, termCols, truncW } from "./theme.js";

const W = 12;
const H = 12; // 6 terminal lines

const PALETTE: Record<string, RGB> = {
  O: [255, 138, 42], // peel
  o: [214, 96, 24], // peel shade
  h: [255, 200, 140], // highlight
  L: [104, 196, 84], // leaf
  l: [62, 142, 51], // stem
  E: [43, 26, 16], // eye
  W: [255, 255, 255], // eye shine
  B: [255, 118, 128], // blush
  m: [120, 44, 14], // mouth
  T: [110, 198, 255], // tear / sweat
};

// Body without face. Top two rows are headroom for jumping.
const BODY: string[] = [
  "............",
  "............",
  "......Ll....",
  ".....LL.....",
  "...oOOOOo...",
  "..OhhOOOOO..",
  ".OOOOOOOOOO.",
  ".OOOOOOOOOO.",
  ".OOOOOOOOOO.",
  "..OOOOOOOO..",
  "...oOOOOo...",
  "...o....o...",
];

type Eyes = "open" | "closed" | "happy";
type Mouth = "smile" | "open" | "frown" | "o" | "none";
interface FaceOpts {
  eyes?: Eyes;
  look?: "center" | "left" | "right" | "up";
  mouth?: Mouth;
  blush?: boolean;
  lift?: number; // pixels to move up
  extra?: Array<[number, number, string]>; // [x, y, color] in body coordinates
}

function face(o: FaceOpts = {}): string[] {
  const g = BODY.map((r) => r.split(""));
  const set = (x: number, y: number, c: string) => {
    if (y >= 0 && y < H && x >= 0 && x < W) g[y]![x] = c;
  };
  const look = o.look ?? "center";
  const dx = look === "left" ? -1 : look === "right" ? 1 : 0;
  const ey = look === "up" ? 5 : 6;
  const eyes = o.eyes ?? "open";
  for (const x0 of [3 + dx, 7 + dx]) {
    if (eyes === "open") {
      set(x0, ey, "E"); set(x0 + 1, ey, "W"); set(x0, ey + 1, "E"); set(x0 + 1, ey + 1, "E");
    } else if (eyes === "closed") {
      set(x0, ey + 1, "E"); set(x0 + 1, ey + 1, "E");
    } else {
      set(x0, ey, "E"); set(x0 + 1, ey, "E");
    }
  }
  switch (o.mouth ?? "smile") {
    case "smile": set(4, 8, "m"); set(5, 9, "m"); set(6, 9, "m"); set(7, 8, "m"); break;
    case "open": set(5, 8, "m"); set(6, 8, "m"); set(5, 9, "m"); set(6, 9, "m"); break;
    case "frown": set(4, 9, "m"); set(5, 8, "m"); set(6, 8, "m"); set(7, 9, "m"); break;
    case "o": set(5, 8, "m"); set(6, 8, "m"); break;
    case "none": break;
  }
  if (o.blush) { set(2, 8, "B"); set(9, 8, "B"); }
  for (const [x, y, c] of o.extra ?? []) set(x, y, c);
  let rows = g.map((r) => r.join(""));
  const lift = o.lift ?? 0;
  if (lift > 0) rows = [...rows.slice(lift), ...Array<string>(lift).fill(".".repeat(W))];
  return rows;
}

export interface Frame {
  grid: string[];
  /** Text shown to the right of the sprite, per terminal line (0..5). */
  text?: Record<number, string>;
}

export interface Animation {
  name: string;
  label: string;
  interval: number;
  frames: Frame[];
}

const armUp: Array<[number, number, string]> = [[11, 5, "O"], [11, 6, "O"], [10, 4, "o"]];
const armDown: Array<[number, number, string]> = [[11, 8, "O"], [11, 9, "o"]];

export const ANIMATIONS: Record<string, Animation> = {
  wave: {
    name: "wave", label: "あいさつ", interval: 220,
    frames: [
      { grid: face({ blush: true, extra: armUp }), text: { 2: t.bold(t.accent("まいど！")) } },
      { grid: face({ blush: true, extra: armDown }), text: { 2: t.bold(t.accent("まいど！")) } },
    ],
  },
  idle: {
    name: "idle", label: "まばたき", interval: 180,
    frames: [
      ...Array.from({ length: 10 }, () => ({ grid: face() })),
      { grid: face({ eyes: "closed" }) },
      { grid: face() },
      { grid: face({ eyes: "closed" }) },
    ],
  },
  think: {
    name: "think", label: "考え中", interval: 280,
    frames: [
      { grid: face({ look: "up", mouth: "o" }), text: { 1: t.muted("·") } },
      { grid: face({ look: "up", mouth: "o" }), text: { 1: t.muted("· ·") } },
      { grid: face({ look: "up", mouth: "o" }), text: { 1: t.muted("· · ·") } },
      { grid: face({ look: "up", mouth: "o" }), text: { 1: t.soft("· · · ?") } },
    ],
  },
  work: {
    name: "work", label: "作業中", interval: 160,
    frames: [
      { grid: face({ eyes: "happy", mouth: "o" }) },
      { grid: face({ eyes: "happy", mouth: "o", lift: 1, extra: [[11, 3, "T"]] }) },
      { grid: face({ eyes: "happy", mouth: "o", lift: 2, extra: [[11, 4, "T"]] }) },
      { grid: face({ eyes: "happy", mouth: "o", lift: 1 }) },
    ],
  },
  search: {
    name: "search", label: "ネット探索", interval: 300,
    frames: [
      { grid: face({ look: "left", mouth: "o" }), text: { 1: t.soft("?") } },
      { grid: face({ look: "center", mouth: "o" }), text: { 1: t.soft(" ?") } },
      { grid: face({ look: "right", mouth: "o" }), text: { 1: t.soft("  ?") } },
      { grid: face({ look: "center", mouth: "smile" }), text: { 1: t.accent("  !") } },
    ],
  },
  happy: {
    name: "happy", label: "よろこび", interval: 130,
    frames: [
      { grid: face({ eyes: "happy", mouth: "open", blush: true }), text: { 1: t.accent("♪") } },
      { grid: face({ eyes: "happy", mouth: "open", blush: true, lift: 1 }), text: { 0: t.soft("♪") } },
      { grid: face({ eyes: "happy", mouth: "open", blush: true, lift: 2, extra: armUp }), text: { 0: t.accent(" ♪") } },
      { grid: face({ eyes: "happy", mouth: "open", blush: true, lift: 1 }), text: { 1: t.soft(" ♪") } },
    ],
  },
  sad: {
    name: "sad", label: "しょんぼり", interval: 320,
    frames: [
      { grid: face({ eyes: "closed", mouth: "frown", extra: [[3, 8, "T"]] }) },
      { grid: face({ eyes: "closed", mouth: "frown", extra: [[3, 9, "T"]] }) },
      { grid: face({ eyes: "closed", mouth: "frown", extra: [[3, 10, "T"]] }) },
      { grid: face({ eyes: "closed", mouth: "frown" }) },
    ],
  },
  sleep: {
    name: "sleep", label: "おやすみ", interval: 450,
    frames: [
      { grid: face({ eyes: "closed", mouth: "o" }), text: { 2: t.muted("z") } },
      { grid: face({ eyes: "closed", mouth: "o" }), text: { 1: t.soft("Z"), 2: t.muted("z") } },
      { grid: face({ eyes: "closed", mouth: "none" }), text: { 0: t.accent("Z"), 1: t.soft("Z"), 2: t.muted("z") } },
      { grid: face({ eyes: "closed", mouth: "none" }), text: { 0: t.soft("Z"), 1: t.muted("z") } },
    ],
  },
};

export const ANIMATION_ORDER = ["wave", "idle", "think", "work", "search", "happy", "sad", "sleep"] as const;

function cell(top: string, bot: string): string {
  const T = PALETTE[top];
  const B = PALETTE[bot];
  if (!T && !B) return " ";
  if (T && !B) return `${fg(T)}▀${RESET}`;
  if (!T && B) return `${fg(B)}▄${RESET}`;
  return `${fg(T!)}${bg(B!)}▀${RESET}`;
}

/** Sprite as terminal lines (each exactly W cells wide). */
export function spriteLines(grid: string[]): string[] {
  const lines: string[] = [];
  for (let y = 0; y < H; y += 2) {
    let s = "";
    for (let x = 0; x < W; x++) s += cell(grid[y]?.[x] ?? ".", grid[y + 1]?.[x] ?? ".");
    lines.push(s);
  }
  return lines;
}

export const SPRITE_WIDTH = W;
export const SPRITE_LINES = H / 2;

/** Compose a frame with right-hand text into full terminal lines. */
export function composeFrame(frame: Frame, right: Record<number, string> = {}, indent = 2): string[] {
  const sprite = spriteLines(frame.grid);
  const max = termCols() - indent - W - 4;
  return sprite.map((s, i) => {
    const txt = right[i] ?? frame.text?.[i] ?? "";
    return " ".repeat(indent) + s + "  " + (strWidth(txt) > max ? truncW(txt, max) : txt);
  });
}

export function canAnimate(): boolean {
  return colorEnabled && !!process.stdout.isTTY && !process.env.XCLI_NO_ANIM && !process.env.CI;
}

const out = (s: string) => process.stdout.write(s);
const HIDE = "\x1b[?25l";
const SHOW = "\x1b[?25h";
let cursorHookInstalled = false;

/** In-place sprite animator. Anything else writing to stdout must call stop() first. */
export class Animator {
  private timer: NodeJS.Timeout | undefined;
  private drawn = 0;
  private i = 0;
  private anim: Animation | undefined;
  private right: (() => Record<number, string>) | undefined;
  private startedAt = 0;

  get active(): boolean { return this.anim !== undefined; }
  elapsed(): number { return Date.now() - this.startedAt; }

  play(anim: Animation, right?: () => Record<number, string>): void {
    this.stop();
    if (!canAnimate()) return;
    if (!cursorHookInstalled) { process.on("exit", () => out(SHOW)); cursorHookInstalled = true; }
    this.anim = anim;
    this.right = right;
    this.i = 0;
    this.startedAt = Date.now();
    out(HIDE);
    this.draw();
    this.timer = setInterval(() => { this.i++; this.draw(); }, anim.interval);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    if (!this.anim) return;
    if (this.drawn) out(`\x1b[${this.drawn}A\r\x1b[J`);
    this.drawn = 0;
    this.anim = undefined;
    out(SHOW);
  }

  private draw(): void {
    if (!this.anim) return;
    const frame = this.anim.frames[this.i % this.anim.frames.length]!;
    const lines = composeFrame(frame, this.right?.() ?? {});
    let s = this.drawn ? `\x1b[${this.drawn}A\r` : "";
    for (const l of lines) s += `${l}\x1b[K\n`;
    out(s);
    this.drawn = lines.length;
  }
}

export const animator = new Animator();

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Play an animation for a fixed time, then erase it. */
export async function playFor(name: keyof typeof ANIMATIONS, ms: number, right?: () => Record<number, string>): Promise<void> {
  if (!canAnimate()) return;
  animator.play(ANIMATIONS[name]!, right);
  await sleep(ms);
  animator.stop();
}

/** Print one frame statically (stays on screen). */
export function printFrame(name: keyof typeof ANIMATIONS, frameIndex: number, right: Record<number, string> = {}): void {
  if (!colorEnabled) {
    for (const v of Object.values(right)) if (v) out(`  ${v}\n`);
    return;
  }
  const anim = ANIMATIONS[name]!;
  out(composeFrame(anim.frames[frameIndex % anim.frames.length]!, right).join("\n") + "\n");
}

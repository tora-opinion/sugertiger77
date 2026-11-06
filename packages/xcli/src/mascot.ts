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
  T: [110, 198, 255], // tear / sweat
};

// Body only: no face, no limbs. Two empty rows on top are headroom for jumping.
// Design rule: 1-pixel eyes, no nose / mouth, 1-pixel stubby hands and feet.
const BODY: string[] = [
  "............",
  "............",
  "......l.....",
  ".....LL.....",
  "...OOOOOO...",
  "..OhOOOOOO..",
  ".OOOOOOOOOO.",
  ".OOOOOOOOOO.",
  ".OOOOOOOOOO.",
  ".OOOOOOOOOO.",
  "..OOOOOOOO..",
  "............",
];

type Arm = "rest" | "up" | "high" | "down";
type Feet = "stand" | "stepA" | "stepB";
interface Pose {
  eyes?: "open" | "closed";
  look?: "center" | "left" | "right";
  eyeRow?: -1 | 0 | 1; // -1 = looking up, 1 = looking down
  left?: Arm;
  right?: Arm;
  feet?: Feet;
  lift?: number; // pixels to move up (jump / bounce)
  extra?: Array<[number, number, string]>; // [x, y, color] in body coordinates
}

const ARM_L: Record<Arm, [number, number]> = { rest: [0, 8], up: [0, 7], high: [0, 6], down: [0, 9] };
const ARM_R: Record<Arm, [number, number]> = { rest: [11, 8], up: [11, 7], high: [11, 6], down: [11, 9] };
const FEET: Record<Feet, Array<[number, number]>> = {
  stand: [[3, 11], [8, 11]],
  stepA: [[2, 11], [7, 11]],
  stepB: [[4, 11], [9, 11]],
};

function pose(p: Pose = {}): string[] {
  const g = BODY.map((r) => r.split(""));
  const set = (x: number, y: number, c: string) => {
    if (y >= 0 && y < H && x >= 0 && x < W) g[y]![x] = c;
  };
  const dx = p.look === "left" ? -1 : p.look === "right" ? 1 : 0;
  const ey = 7 + (p.eyeRow ?? 0);
  const eye = p.eyes === "closed" ? "o" : "E";
  set(3 + dx, ey, eye);
  set(8 + dx, ey, eye);
  set(...ARM_L[p.left ?? "rest"], "o");
  set(...ARM_R[p.right ?? "rest"], "o");
  for (const [x, y] of FEET[p.feet ?? "stand"]) set(x, y, "o");
  for (const [x, y, c] of p.extra ?? []) set(x, y, c);
  let rows = g.map((r) => r.join(""));
  const lift = p.lift ?? 0;
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

const hi = (s: string) => ({ 2: t.bold(t.accent(s)) });

export const ANIMATIONS: Record<string, Animation> = {
  wave: {
    name: "wave", label: "あいさつ", interval: 200,
    frames: [
      { grid: pose({ right: "high" }), text: hi("まいど！") },
      { grid: pose({ right: "up" }), text: hi("まいど！") },
      { grid: pose({ right: "high" }), text: hi("まいど！") },
      { grid: pose({ right: "up", eyes: "closed" }), text: hi("まいど！") },
    ],
  },
  idle: {
    name: "idle", label: "まばたき", interval: 160,
    frames: [
      ...Array.from({ length: 12 }, () => ({ grid: pose() })),
      { grid: pose({ eyes: "closed" }) },
      { grid: pose() },
      { grid: pose({ eyes: "closed" }) },
      ...Array.from({ length: 6 }, () => ({ grid: pose() })),
      { grid: pose({ look: "left" }) },
      { grid: pose({ look: "left" }) },
      { grid: pose({ look: "right" }) },
      { grid: pose({ look: "right" }) },
    ],
  },
  think: {
    name: "think", label: "考え中", interval: 300,
    frames: [
      { grid: pose({ eyeRow: -1, look: "right", right: "up" }), text: { 1: t.muted("·") } },
      { grid: pose({ eyeRow: -1, look: "right", right: "up" }), text: { 1: t.muted("· ·") } },
      { grid: pose({ eyeRow: -1, look: "right", right: "up" }), text: { 1: t.muted("· · ·") } },
      { grid: pose({ eyeRow: -1, look: "left", right: "up" }), text: { 1: t.soft("· · · ?") } },
    ],
  },
  work: {
    name: "work", label: "作業中", interval: 150,
    frames: [
      { grid: pose({ feet: "stepA", left: "up", right: "down" }) },
      { grid: pose({ feet: "stand", lift: 1, extra: [[11, 4, "T"]] }) },
      { grid: pose({ feet: "stepB", left: "down", right: "up" }) },
      { grid: pose({ feet: "stand", lift: 1, extra: [[11, 4, "T"]] }) },
    ],
  },
  search: {
    name: "search", label: "ネット探索", interval: 280,
    frames: [
      { grid: pose({ look: "left", right: "high" }), text: { 1: t.soft("?") } },
      { grid: pose({ look: "center", right: "high" }), text: { 1: t.soft(" ?") } },
      { grid: pose({ look: "right", right: "high" }), text: { 1: t.soft("  ?") } },
      { grid: pose({ look: "center", left: "up", right: "up", lift: 1 }), text: { 1: t.accent("  !") } },
    ],
  },
  happy: {
    name: "happy", label: "よろこび", interval: 130,
    frames: [
      { grid: pose({ eyeRow: -1, left: "up", right: "up" }), text: { 1: t.accent("♪") } },
      { grid: pose({ eyeRow: -1, left: "high", right: "high", lift: 1 }), text: { 0: t.soft("♪") } },
      { grid: pose({ eyeRow: -1, eyes: "closed", left: "high", right: "high", lift: 2 }), text: { 0: t.accent(" ♪") } },
      { grid: pose({ eyeRow: -1, left: "high", right: "high", lift: 1 }), text: { 1: t.soft(" ♪") } },
    ],
  },
  sad: {
    name: "sad", label: "しょんぼり", interval: 340,
    frames: [
      { grid: pose({ eyeRow: 1, left: "down", right: "down", extra: [[3, 9, "T"]] }) },
      { grid: pose({ eyeRow: 1, left: "down", right: "down", extra: [[3, 10, "T"]] }) },
      { grid: pose({ eyeRow: 1, left: "down", right: "down", extra: [[3, 11, "T"]] }) },
      { grid: pose({ eyeRow: 1, eyes: "closed", left: "down", right: "down" }) },
    ],
  },
  sleep: {
    name: "sleep", label: "おやすみ", interval: 480,
    frames: [
      { grid: pose({ eyes: "closed", left: "down", right: "down" }), text: { 2: t.muted("z") } },
      { grid: pose({ eyes: "closed", left: "down", right: "down" }), text: { 1: t.soft("Z"), 2: t.muted("z") } },
      { grid: pose({ eyes: "closed", left: "down", right: "down", lift: 1 }), text: { 0: t.accent("Z"), 1: t.soft("Z"), 2: t.muted("z") } },
      { grid: pose({ eyes: "closed", left: "down", right: "down" }), text: { 0: t.soft("Z"), 1: t.muted("z") } },
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

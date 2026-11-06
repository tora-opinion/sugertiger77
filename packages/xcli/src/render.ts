import { ANIMATION_ORDER, ANIMATIONS, animator, canAnimate, composeFrame, playFor, printFrame, SPRITE_LINES } from "./mascot.js";
import { colorEnabled, padW, strWidth, t, termCols, truncW } from "./theme.js";
import type { AgentEvent, ToolCall, Usage } from "./types.js";

const out = (s: string) => process.stdout.write(s);
const cols = () => Math.min(termCols(), 120);
const WEB_TOOLS = new Set(["WebSearch", "WebFetch"]);
const LOOK_TOOLS = new Set(["Read", "Glob", "Grep", "WebSearch", "WebFetch"]);

// ---------- startup / shutdown ----------

/** Short waving greeting, then erased (TTY only). */
export async function renderGreeting(): Promise<void> {
  await playFor("wave", 1300, () => ({ 3: t.muted("xcli を起動中…") }));
}

export function renderBanner(opts: { model: string; cwd: string; version: string; web: boolean }): void {
  const w = Math.max(56, cols() - 2);
  const inner = w - 2;
  const info: Record<number, string> = {
    0: t.bold(t.accent("✻ xcli")) + t.muted(`  v${opts.version}`),
    1: t.soft("どのモデルでも動く、ターミナルの相棒"),
    3: t.muted("model ") + t.text(truncW(opts.model, inner - 26)),
    4: t.muted("cwd   ") + t.text(truncW(opts.cwd, inner - 26)),
    5: t.muted("web   ") + (opts.web ? t.ok("無制限") + t.muted("  WebSearch · WebFetch") : t.warn("無効")),
  };
  // Open-right frame: CJK / ambiguous-width glyphs make a closed right border drift between terminals.
  const border = t.deep;
  out(border("╭─") + border("─".repeat(w - 3)) + "\n");
  const body = colorEnabled
    ? composeFrame(ANIMATIONS.idle!.frames[0]!, info, 1)
    : Object.values(info).map((s) => " " + s);
  for (const line of body) out(border("│") + " " + line + "\n");
  out(border("╰─") + border("─".repeat(w - 3)) + "\n");
  out(
    "  " + t.accent("/help") + t.muted(" コマンド  ") + t.faint("·") +
    "  " + t.accent("/mascot") + t.muted(" Mikan を眺める  ") + t.faint("·") +
    "  " + t.accent("Ctrl+C") + t.muted(" 中断") + "\n\n",
  );
}

export async function renderGoodbye(): Promise<void> {
  if (canAnimate()) await playFor("sleep", 1400, () => ({ 4: t.muted("おやすみ〜 また呼んでな") }));
  else out(t.muted("おやすみ〜\n"));
}

// ---------- input ----------

export function renderInputRule(): void {
  out("\n" + t.faint("─".repeat(Math.max(20, cols() - 1))) + "\n");
}

export function renderPromptPrefix(): string {
  return t.bold(t.accent("❯ "));
}

export function renderContinuationPrefix(): string {
  return t.faint("… ");
}

// ---------- agent events ----------

/** Stateful renderer for agent events; shows Mikan while waiting. */
export class EventRenderer {
  private inText = false;
  private toolStartedAt = 0;
  private turnStartedAt = Date.now();

  /** Call right before agent.run(): Mikan thinks until the first event. */
  start(): void {
    this.turnStartedAt = Date.now();
    this.think();
  }

  private think(): void {
    animator.play(ANIMATIONS.think!, () => ({
      3: t.accent("考え中") + t.muted(`… ${fmtMs(Date.now() - this.turnStartedAt)}`) + t.faint("  (Ctrl+C で中断)"),
    }));
  }

  handle = (ev: AgentEvent): void => {
    if (ev.type !== "usage") animator.stop();
    switch (ev.type) {
      case "text":
        if (!this.inText) {
          out("\n" + t.accent("● "));
          this.inText = true;
        }
        out(t.text(ev.delta.replace(/\n/g, "\n  ")));
        break;
      case "tool_start": {
        this.endText();
        this.toolStartedAt = Date.now();
        const name = ev.call.function.name;
        out(t.accent("⏺ ") + t.bold(name) + t.muted("(") + t.soft(summarizeArgs(ev.call, ev.args)) + t.muted(")") + "\n");
        const anim = WEB_TOOLS.has(name) || LOOK_TOOLS.has(name) ? ANIMATIONS.search! : ANIMATIONS.work!;
        const verb = WEB_TOOLS.has(name) ? "ネットを探索中" : LOOK_TOOLS.has(name) ? "調べ中" : "作業中";
        animator.play(anim, () => ({ 3: t.accent(verb) + t.muted(`… ${fmtMs(Date.now() - this.toolStartedAt)}`) }));
        break;
      }
      case "tool_end": {
        const ms = Date.now() - this.toolStartedAt;
        const first = firstLines(ev.result, 3);
        const mark = ev.isError ? t.err("  ⎿  ✗ ") : t.faint("  ⎿  ");
        const body = ev.isError ? t.err(first) : t.muted(first);
        out(mark + body.replace(/\n/g, "\n     ") + t.faint(`  ${fmtMs(ms)}`) + "\n");
        this.turnStartedAt = Date.now();
        this.think();
        break;
      }
      case "warning":
        this.endText();
        out(t.warn("⚠ ") + t.warn(ev.message) + "\n");
        break;
      case "usage":
        break;
      case "done":
        this.endText();
        break;
    }
  };

  private endText(): void {
    if (this.inText) {
      out("\n");
      this.inText = false;
    }
  }
}

// ---------- messages ----------

export function renderDisplay(text: string): void {
  animator.stop();
  out(text.replace(/^/gm, "     ") + "\n");
}

export function renderError(msg: string): void {
  animator.stop();
  out(t.err("✗ ") + t.err(msg) + "\n");
}

/** API / run failure: a sad Mikan with the message. */
export function renderFailure(msg: string): void {
  animator.stop();
  const lines = wrap(msg, Math.max(20, cols() - 22));
  const right: Record<number, string> = { 1: t.bold(t.err("うまくいかんかった…")) };
  lines.slice(0, 4).forEach((l, i) => { right[i + 2] = t.muted(l); });
  out("\n");
  printFrame("sad", 3, right);
  // anything that did not fit beside Mikan goes below, so no diagnostic is lost
  for (const l of lines.slice(4)) out("  " + t.muted(l) + "\n");
}

/** Write pre-styled text as-is (stops any running animation first). */
export function renderRaw(text: string): void {
  animator.stop();
  out(text + "\n");
}

export function renderInfo(msg: string): void {
  animator.stop();
  out(t.muted(msg) + "\n");
}

export async function renderSuccess(msg: string): Promise<void> {
  animator.stop();
  if (canAnimate()) await playFor("happy", 900, () => ({ 3: t.ok("✓ ") + t.text(msg) }));
  out(t.ok("✓ ") + t.text(msg) + "\n");
}

export function renderUsage(u: Usage, model: string): void {
  out(
    t.muted("  model ") + t.accent(model) +
    t.faint("  ·  ") + t.muted("in ") + t.text(fmtNum(u.promptTokens)) +
    t.faint("  ·  ") + t.muted("out ") + t.text(fmtNum(u.completionTokens)) + t.muted(" tok") + "\n",
  );
}

export function renderModelList(apiModels: string[], registered: { id: string; alias?: string }[], current: string): void {
  const reg = new Map(registered.map((m) => [m.id, m]));
  const all = Array.from(new Set([...registered.map((m) => m.id), ...apiModels]));
  for (const id of all) {
    const r = reg.get(id);
    const isCur = id === current;
    const cur = isCur ? t.accent("▸ ") : "  ";
    const star = r ? t.soft("★ ") : "  ";
    const alias = r?.alias ? t.muted(` (${r.alias})`) : "";
    out(cur + star + (isCur ? t.bold(t.accent(id)) : t.text(id)) + alias + "\n");
  }
  out("\n" + t.muted("  ") + t.soft("★") + t.muted(" 登録済み  ·  一覧に無いコードも ") + t.accent("/model <code>") + t.muted(" でそのまま使えるで") + "\n");
}

export function renderHelp(): void {
  const rows: [string, string][] = [
    ["/model <code|alias>", "モデル切替（一覧に無いコードもOK）"],
    ["/model add <code> [opts]", "モデルを登録  --alias a  --no-tools  --context n"],
    ["/model rm <code|alias>", "登録解除"],
    ["/models", "利用可能モデル一覧"],
    ["/clear", "会話をリセット"],
    ["/compact", "会話を要約してコンテキスト節約"],
    ["/cost", "トークン使用量"],
    ["/resume [id]", "過去セッション一覧 / 再開"],
    ["/yes", "以降の許可確認をスキップ（切替）"],
    ["/mascot [name]", "Mikan のアニメーションを再生"],
    ["/exit", "終了"],
  ];
  const w = Math.max(...rows.map((r) => strWidth(r[0])));
  out("\n");
  for (const [c, d] of rows) out("  " + t.accent(padW(c, w)) + "  " + t.muted(d) + "\n");
  out("\n");
}

/** Plays every Mikan animation (or one by name). */
export async function renderMascot(name?: string): Promise<void> {
  const names = name ? [name] : [...ANIMATION_ORDER];
  for (const n of names) {
    const anim = ANIMATIONS[n];
    if (!anim) { renderError(`そんなアニメーションは無いで: ${n}（${ANIMATION_ORDER.join(", ")}）`); return; }
    if (!canAnimate()) { out(t.muted(`(アニメーション非対応の端末やで) ${n}`) + "\n"); continue; }
    await playFor(n as keyof typeof ANIMATIONS, name ? 3200 : 1700, () => ({
      2: t.bold(t.accent(anim.label)),
      3: t.muted(n),
      4: t.faint(`${names.indexOf(n) + 1}/${names.length}`),
    }));
  }
  printFrame("idle", 0, { 2: t.soft("Mikan") + t.muted(" やで。よろしゅう！") });
}

export const MASCOT_HEIGHT = SPRITE_LINES;

// ---------- helpers ----------

function summarizeArgs(call: ToolCall, args: Record<string, unknown>): string {
  const pick = ["command", "file_path", "pattern", "url", "query", "path"];
  for (const k of pick) {
    if (typeof args[k] === "string") return truncW(String(args[k]).replace(/\s+/g, " "), 80);
  }
  return truncW(call.function.arguments.replace(/\s+/g, " "), 80);
}

function firstLines(s: string, n: number): string {
  const lines = s.trimEnd().split("\n");
  const head = lines.slice(0, n).map((l) => truncW(l, cols() - 10)).join("\n");
  return lines.length > n ? head + `\n… +${lines.length - n} 行` : head;
}

function wrap(s: string, width: number): string[] {
  const out: string[] = [];
  for (const para of s.split("\n")) {
    let line = "";
    for (const ch of para) {
      if (strWidth(line + ch) > width) { out.push(line); line = ""; }
      line += ch;
    }
    out.push(line);
  }
  return out;
}

function fmtMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

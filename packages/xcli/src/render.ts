import pc from "picocolors";
import type { AgentEvent, ToolCall, Usage } from "./types.js";

const out = (s: string) => process.stdout.write(s);
const cols = () => Math.max(40, Math.min(process.stdout.columns ?? 80, 120));

/** Startup banner. */
export function renderBanner(opts: { model: string; cwd: string; version: string; web: boolean }): void {
  const w = cols() - 2;
  const line = (s = "") => {
    const visible = stripAnsi(s);
    const pad = Math.max(0, w - 2 - visible.length);
    return pc.dim("│") + " " + s + " ".repeat(pad) + pc.dim("│");
  };
  out(pc.dim("╭" + "─".repeat(w) + "╮") + "\n");
  out(line(pc.bold(pc.magenta("✻ xcli")) + pc.dim(`  v${opts.version}`)) + "\n");
  out(line() + "\n");
  out(line(pc.dim("model ") + pc.cyan(truncate(opts.model, w - 12))) + "\n");
  out(line(pc.dim("cwd   ") + truncate(opts.cwd, w - 12)) + "\n");
  out(line(pc.dim("web   ") + (opts.web ? pc.green("無制限 (WebSearch / WebFetch)") : pc.yellow("無効"))) + "\n");
  out(pc.dim("╰" + "─".repeat(w) + "╯") + "\n");
  out(pc.dim("  /help でコマンド一覧 · Ctrl+C で生成中断 · /exit で終了") + "\n\n");
}

export function renderPromptPrefix(): string {
  return pc.bold(pc.magenta("❯ "));
}

/** Stateful renderer for agent events. */
export class EventRenderer {
  private inText = false;
  private lastToolStart = 0;

  handle = (ev: AgentEvent): void => {
    switch (ev.type) {
      case "text":
        if (!this.inText) {
          out("\n" + pc.magenta("● "));
          this.inText = true;
        }
        out(ev.delta.replace(/\n/g, "\n  "));
        break;
      case "tool_start":
        this.endText();
        this.lastToolStart = Date.now();
        out(pc.cyan("● ") + pc.bold(ev.call.function.name) + pc.dim("(" + summarizeArgs(ev.call, ev.args) + ")") + "\n");
        break;
      case "tool_end": {
        const ms = Date.now() - this.lastToolStart;
        const first = firstLines(ev.result, 3);
        const mark = ev.isError ? pc.red("  ⎿ ✗ ") : pc.dim("  ⎿ ");
        const body = ev.isError ? pc.red(first) : pc.dim(first);
        out(mark + body.replace(/\n/g, "\n" + pc.dim("    ")) + pc.dim(`  (${fmtMs(ms)})`) + "\n");
        break;
      }
      case "warning":
        this.endText();
        out(pc.yellow("⚠ " + ev.message) + "\n");
        break;
      case "usage":
        break;
      case "done":
        this.endText();
        out("\n");
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

export function renderDisplay(text: string): void {
  out(text.replace(/^/gm, "    ") + "\n");
}

export function renderError(msg: string): void {
  out(pc.red("✗ " + msg) + "\n");
}

export function renderInfo(msg: string): void {
  out(pc.dim(msg) + "\n");
}

export function renderUsage(u: Usage, model: string): void {
  out(
    pc.dim("model ") + pc.cyan(model) + pc.dim("  ·  input ") + fmtNum(u.promptTokens) +
      pc.dim(" tok  ·  output ") + fmtNum(u.completionTokens) + pc.dim(" tok") + "\n",
  );
}

export function renderModelList(apiModels: string[], registered: { id: string; alias?: string }[], current: string): void {
  const reg = new Map(registered.map((m) => [m.id, m]));
  const all = Array.from(new Set([...registered.map((m) => m.id), ...apiModels]));
  for (const id of all) {
    const r = reg.get(id);
    const cur = id === current ? pc.green("▸ ") : "  ";
    const star = r ? pc.yellow("★ ") : "  ";
    const alias = r?.alias ? pc.dim(` (${r.alias})`) : "";
    out(cur + star + (id === current ? pc.bold(id) : id) + alias + "\n");
  }
  out(pc.dim(`\n  ★ = 登録済み  ·  一覧に無いモデルコードも /model <code> でそのまま使えるで`) + "\n");
}

export function renderHelp(): void {
  const rows: [string, string][] = [
    ["/model <code|alias>", "モデル切替（一覧に無いコードもOK）"],
    ["/model add <code> [--alias a] [--no-tools] [--context n]", "モデルを登録"],
    ["/model rm <code|alias>", "登録解除"],
    ["/models", "利用可能モデル一覧"],
    ["/clear", "会話をリセット"],
    ["/compact", "会話を要約してコンテキスト節約"],
    ["/cost", "トークン使用量"],
    ["/resume [id]", "過去セッション一覧 / 再開"],
    ["/yes", "以降の許可確認をスキップ（切替）"],
    ["/exit", "終了"],
  ];
  const w = Math.max(...rows.map((r) => r[0].length));
  for (const [c, d] of rows) out("  " + pc.cyan(c.padEnd(w)) + "  " + pc.dim(d) + "\n");
}

// ---------- helpers ----------

function summarizeArgs(call: ToolCall, args: Record<string, unknown>): string {
  const pick = ["command", "file_path", "pattern", "url", "query", "path"];
  for (const k of pick) {
    if (typeof args[k] === "string") return truncate(String(args[k]).replace(/\s+/g, " "), 80);
  }
  return truncate(call.function.arguments.replace(/\s+/g, " "), 80);
}

function firstLines(s: string, n: number): string {
  const lines = s.trimEnd().split("\n");
  const head = lines.slice(0, n).map((l) => truncate(l, cols() - 8)).join("\n");
  return lines.length > n ? head + `\n… +${lines.length - n} 行` : head;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, Math.max(0, n - 1)) + "…" : s;
}

function fmtMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

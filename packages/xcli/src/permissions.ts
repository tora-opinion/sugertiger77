import { strWidth, t, termCols } from "./theme.js";
import type { PermissionRequest } from "./types.js";

export function formatPermissionRequest(req: PermissionRequest): string {
  const w = Math.min(termCols(), 100) - 2;
  const bar = t.accent("│");
  const lines = [
    t.accent("╭─ ") + t.bold(t.accent("許可が要るで")) + " " + t.accent("─".repeat(Math.max(0, w - 16))),
    `${bar} ${t.bold(req.tool)}`,
  ];
  // never truncate: the user must see the complete command/path before approving
  for (const l of wrapW(req.summary.replace(/^[^:]+:\s*/, ""), Math.max(20, w - 4))) lines.push(`${bar} ${t.soft(l)}`);
  if (req.detail) for (const l of req.detail.split("\n")) lines.push(`${bar} ${l}`);
  lines.push(t.accent("╰" + "─".repeat(Math.max(0, w - 1))));
  return lines.join("\n");
}

export const PERMISSION_QUESTION =
  `  ${t.bold(t.accent("y"))}${t.muted(" はい")}   ${t.bold(t.accent("a"))}${t.muted(" このツールは常に許可")}   ${t.bold(t.accent("n"))}${t.muted(" いいえ")}  ${t.accent("❯")}`;

export function createPermissionPrompter(opts: { yes: boolean; ask: (question: string) => Promise<string>; print: (text: string) => void }): (req: PermissionRequest) => Promise<boolean> {
  const approved = new Set<string>();
  return async (req) => {
    if (opts.yes || approved.has(req.tool)) return true;
    opts.print(formatPermissionRequest(req));
    const answer = (await opts.ask(PERMISSION_QUESTION)).trim().toLowerCase();
    if (answer === "a") { approved.add(req.tool); return true; }
    return answer === "y" || answer === "yes";
  };
}

function wrapW(text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    let line = "";
    for (const ch of para) {
      if (strWidth(line + ch) > width) { out.push(line); line = ""; }
      line += ch;
    }
    out.push(line);
  }
  return out;
}

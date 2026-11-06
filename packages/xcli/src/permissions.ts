import { t, termCols, truncW } from "./theme.js";
import type { PermissionRequest } from "./types.js";

export function formatPermissionRequest(req: PermissionRequest): string {
  const w = Math.min(termCols(), 100) - 2;
  const bar = t.accent("│");
  const lines = [
    t.accent("╭─ ") + t.bold(t.accent("許可が要るで")) + " " + t.accent("─".repeat(Math.max(0, w - 16))),
    `${bar} ${t.bold(req.tool)}  ${t.soft(truncW(req.summary.replace(/^[^:]+:\s*/, ""), w - req.tool.length - 6))}`,
  ];
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

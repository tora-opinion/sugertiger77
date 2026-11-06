import pc from "picocolors";
import type { PermissionRequest } from "./types.js";

export function createPermissionPrompter(opts: { yes: boolean; ask: (question: string) => Promise<string>; print: (text: string) => void }): (req: PermissionRequest) => Promise<boolean> {
  const approved = new Set<string>();
  return async (req) => {
    if (opts.yes || approved.has(req.tool)) return true;
    opts.print(`${pc.yellow(req.summary)}${req.detail ? `\n${req.detail}` : ""}`);
    const answer = (await opts.ask("許可しますか? [y]はい / [a]このツールは常に許可 / [n]いいえ")).trim().toLowerCase();
    if (answer === "a") { approved.add(req.tool); return true; }
    return answer === "y" || answer === "yes";
  };
}

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function buildSystemPrompt(cwd: string): string {
  const shell = process.platform === "win32" ? "PowerShell" : "bash";
  const date = new Date().toISOString().slice(0, 10);
  let git = "このディレクトリは Git リポジトリではないか、状態を取得できません。";
  try {
    const branch = execFileSync("git", ["branch", "--show-current"], { cwd, encoding: "utf8", timeout: 1500 }).trim();
    const status = execFileSync("git", ["status", "--short"], { cwd, encoding: "utf8", timeout: 1500 }).trim();
    git = `ブランチ: ${branch || "(detached)"}\n変更: ${status || "なし"}`;
  } catch { /* git is optional */ }
  const instructions: string[] = [];
  for (const name of ["AGENTS.md", "CLAUDE.md", "XCLI.md"]) {
    const file = path.join(cwd, name);
    if (existsSync(file)) {
      try { instructions.push(`--- ${name} ---\n${readFileSync(file, "utf8")}`); } catch { /* unreadable files are ignored */ }
    }
  }
  const repoInstructions = instructions.join("\n\n").slice(0, 20_000);
  return `You are xcli, a concise terminal coding agent.\nEnvironment: cwd=${cwd}; platform=${process.platform}; shell=${shell}; date=${date}.\nGit status:\n${git}\nUse tools to inspect and change the user's project. Read files before editing. Prefer Edit over Write for existing files. WebSearch and WebFetch tools are available without restriction. Be concise and report what you changed and what you verified.\n${repoInstructions ? `\nProject instructions:\n${repoInstructions}` : ""}`;
}

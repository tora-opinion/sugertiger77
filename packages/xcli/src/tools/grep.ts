import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import picomatch from "picomatch";
import type { Tool } from "../types.js";

const execFileAsync = promisify(execFile);
type GrepArgs = { pattern: string; path?: string; glob?: string; case_insensitive?: boolean; output_mode?: "content" | "files_with_matches" | "count"; context?: number; head_limit?: number };

export async function grepJsFallback(args: GrepArgs, cwd: string): Promise<string> {
  const root = path.resolve(cwd, args.path ?? ".");
  const matcher = new RegExp(args.pattern, args.case_insensitive ? "gi" : "g");
  const mode = args.output_mode ?? "files_with_matches";
  const head = Math.max(0, args.head_limit ?? 250);
  const context = Math.max(0, args.context ?? 0);
  const records: Array<{ file: string; lines: string[]; count: number }> = [];
  const globMatcher = args.glob ? picomatch(args.glob, { basename: !args.glob.includes("/") }) : undefined;
  async function visit(dir: string): Promise<void> {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile()) await scanFile(full, root);
    }
  }
  async function scanFile(full: string, base: string): Promise<void> {
    const info = await stat(full);
    if (info.size > 2 * 1024 * 1024) return;
    const rel = path.relative(base, full).split(path.sep).join("/");
    if (globMatcher && !globMatcher(rel)) return;
    const buffer = await readFile(full);
    if (buffer.includes(0)) return;
    const lines = buffer.toString("utf8").split(/\r?\n/);
    const matched: number[] = [];
    for (let i = 0; i < lines.length; i++) { matcher.lastIndex = 0; if (matcher.test(lines[i])) matched.push(i); }
    if (matched.length) {
      const selected = new Set<number>();
      for (const index of matched) {
        for (let line = Math.max(0, index - context); line <= Math.min(lines.length - 1, index + context); line++) selected.add(line);
      }
      records.push({ file: full, lines: mode === "content" ? [...selected].sort((a, b) => a - b).map((i) => `${i + 1}:${lines[i]}`) : [], count: matched.length });
    }
  }
  const rootInfo = await stat(root).catch(() => undefined);
  if (rootInfo?.isFile()) await scanFile(root, path.dirname(root));
  else await visit(root);
  if (mode === "count") return records.slice(0, head).map((r) => `${path.relative(cwd, r.file)}:${r.count}`).join("\n");
  if (mode === "content") return records.flatMap((r) => [`${path.relative(cwd, r.file)}:`, ...r.lines]).slice(0, head).join("\n");
  return records.slice(0, head).map((r) => path.relative(cwd, r.file)).join("\n");
}

export const grepTool: Tool = {
  name: "Grep",
  description: "Search file contents using a regular expression.",
  parameters: { type: "object", properties: { pattern: { type: "string" }, path: { type: "string" }, glob: { type: "string" }, case_insensitive: { type: "boolean" }, output_mode: { type: "string", enum: ["content", "files_with_matches", "count"] }, context: { type: "number" }, head_limit: { type: "number" } }, required: ["pattern"], additionalProperties: false },
  readOnly: true,
  async run(args, ctx) {
    if (typeof args.pattern !== "string") throw new Error("Grep: pattern is required.");
    const normalized: GrepArgs = { pattern: args.pattern, path: typeof args.path === "string" ? args.path : undefined, glob: typeof args.glob === "string" ? args.glob : undefined, case_insensitive: args.case_insensitive === true, output_mode: args.output_mode as GrepArgs["output_mode"], context: typeof args.context === "number" ? args.context : undefined, head_limit: typeof args.head_limit === "number" ? args.head_limit : 250 };
    try {
      await execFileAsync("rg", ["--version"], { cwd: ctx.cwd, windowsHide: true });
      const flags = ["--no-heading", "--color", "never", "--glob", "!**/node_modules/**", "--glob", "!**/.git/**"];
      if (normalized.case_insensitive) flags.push("--ignore-case");
      if (normalized.glob) flags.push("--glob", normalized.glob);
      if (normalized.output_mode === "content") flags.push("--line-number", "--context", String(normalized.context ?? 0));
      else if (normalized.output_mode === "count") flags.push("--count");
      else flags.push("--files-with-matches");
      flags.push("-e", normalized.pattern, "--", normalized.path ?? ".");
      const result = await execFileAsync("rg", flags, { cwd: ctx.cwd, maxBuffer: 10 * 1024 * 1024, windowsHide: true });
      return limitLines(result.stdout, normalized.head_limit);
    } catch (error) {
      const e = error as NodeJS.ErrnoException & { code?: number | string; stdout?: string; stderr?: string };
      if (e.code === "ENOENT") return grepJsFallback(normalized, ctx.cwd);
      // rg exits 1 for "no matches"; anything else (2 = bad regex / missing path) is a real error
      if ((e.code as unknown) === 1 && typeof e.stdout === "string") return limitLines(e.stdout, normalized.head_limit);
      if (typeof e.stderr === "string" && e.stderr.trim()) throw new Error(`Grep: ${e.stderr.trim()}`);
      throw error;
    }
  },
};

function limitLines(text: string, limit = 250): string {
  const trimmed = text.trimEnd();
  if (!trimmed) return "";
  return trimmed.split(/\r?\n/).slice(0, Math.max(0, limit)).join("\n");
}

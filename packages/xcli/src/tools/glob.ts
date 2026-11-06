import { stat } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import type { Tool } from "../types.js";

export const globTool: Tool = {
  name: "Glob",
  description: "Find files matching a glob pattern.",
  parameters: { type: "object", properties: { pattern: { type: "string" }, path: { type: "string" } }, required: ["pattern"], additionalProperties: false },
  readOnly: true,
  async run(args, ctx) {
    if (typeof args.pattern !== "string" || !args.pattern) throw new Error("Glob: pattern is required.");
    const cwd = typeof args.path === "string" ? path.resolve(ctx.cwd, args.path) : ctx.cwd;
    const matches = await fg(args.pattern, { cwd, onlyFiles: true, dot: true, ignore: ["**/node_modules/**", "**/.git/**"], absolute: true });
    const dated = await Promise.all(matches.map(async (file) => ({ file, mtime: (await stat(file)).mtimeMs })));
    return dated.sort((a, b) => b.mtime - a.mtime || a.file.localeCompare(b.file)).slice(0, 500).map((item) => path.relative(ctx.cwd, item.file) || ".").join("\n");
  },
};

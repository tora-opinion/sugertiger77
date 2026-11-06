import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Tool } from "../types.js";
import { coloredDiff } from "../util/diff.js";

export const writeTool: Tool = {
  name: "Write",
  description: "Write content to a file, creating parent directories as needed.",
  parameters: { type: "object", properties: { file_path: { type: "string" }, content: { type: "string" } }, required: ["file_path", "content"], additionalProperties: false },
  readOnly: false,
  async run(args, ctx) {
    if (typeof args.file_path !== "string" || !args.file_path) throw new Error("Write: file_path is required.");
    if (typeof args.content !== "string") throw new Error("Write: content must be a string.");
    const target = path.resolve(ctx.cwd, args.file_path);
    let before = "";
    try { before = await readFile(target, "utf8"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, args.content, "utf8");
    ctx.display?.(coloredDiff(args.file_path, before, args.content));
    return `Wrote ${args.content.length} characters to ${args.file_path}.`;
  },
};

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Tool } from "../types.js";

export const readTool: Tool = {
  name: "Read",
  description: "Read a file with line numbers.",
  parameters: { type: "object", properties: { file_path: { type: "string" }, offset: { type: "number" }, limit: { type: "number" } }, required: ["file_path"], additionalProperties: false },
  readOnly: true,
  async run(args, ctx) {
    const filePath = args.file_path;
    if (typeof filePath !== "string" || !filePath) throw new Error("Read: file_path is required.");
    const target = path.resolve(ctx.cwd, filePath);
    let info;
    try { info = await stat(target); } catch { throw new Error(`Read: file not found: ${filePath}`); }
    if (!info.isFile()) throw new Error(`Read: not a file: ${filePath}`);
    const content = await readFile(target, "utf8");
    const lines = content.split(/\r?\n/);
    const offset = Math.max(1, Math.floor(typeof args.offset === "number" ? args.offset : 1));
    const limit = Math.max(0, Math.floor(typeof args.limit === "number" ? args.limit : 2000));
    return lines.slice(offset - 1, offset - 1 + limit).map((line, i) => `${String(offset + i).padStart(6)}\t${line.length > 2000 ? `${line.slice(0, 2000)}… [line truncated]` : line}`).join("\n");
  },
};

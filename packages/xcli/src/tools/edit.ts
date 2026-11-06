import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Tool } from "../types.js";
import { coloredDiff } from "../util/diff.js";

export function applyEdit(content: string, oldStr: string, newStr: string, replaceAll = false): string {
  if (!oldStr) throw new Error("Edit: old_string must not be empty.");
  const occurrences = content.split(oldStr).length - 1;
  if (occurrences === 0) throw new Error("Edit: old_string not found in file.");
  if (!replaceAll && occurrences > 1) throw new Error(`Edit: old_string occurs ${occurrences} times; provide a more specific string or set replace_all=true.`);
  if (replaceAll) return content.split(oldStr).join(newStr);
  const index = content.indexOf(oldStr);
  return content.slice(0, index) + newStr + content.slice(index + oldStr.length);
}

export const editTool: Tool = {
  name: "Edit",
  description: "Replace a unique string in a file.",
  parameters: { type: "object", properties: { file_path: { type: "string" }, old_string: { type: "string" }, new_string: { type: "string" }, replace_all: { type: "boolean" } }, required: ["file_path", "old_string", "new_string"], additionalProperties: false },
  readOnly: false,
  async run(args, ctx) {
    for (const key of ["file_path", "old_string", "new_string"] as const) if (typeof args[key] !== "string") throw new Error(`Edit: ${key} must be a string.`);
    const filePath = args.file_path as string;
    const target = path.resolve(ctx.cwd, filePath);
    let before: string;
    try { before = await readFile(target, "utf8"); } catch { throw new Error(`Edit: file not found: ${filePath}`); }
    const after = applyEdit(before, args.old_string as string, args.new_string as string, args.replace_all === true);
    ctx.display?.(coloredDiff(filePath, before, after));
    await writeFile(target, after, "utf8");
    return `Edited ${filePath}.`;
  },
};

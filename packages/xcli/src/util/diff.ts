import { createTwoFilesPatch } from "diff";
import pc from "picocolors";

export function coloredDiff(path: string, before: string, after: string): string {
  const patch = createTwoFilesPatch(path, path, before, after, "before", "after");
  const lines = patch.split("\n");
  const clipped = lines.length > 200
    ? [...lines.slice(0, 199), "... diff truncated after 200 lines"]
    : lines;
  return clipped.map((line) => {
    if (line.startsWith("+") && !line.startsWith("+++")) return pc.green(line);
    if (line.startsWith("-") && !line.startsWith("---")) return pc.red(line);
    if (line.startsWith("@@")) return pc.cyan(line);
    return line;
  }).join("\n");
}

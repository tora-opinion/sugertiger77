import { createTwoFilesPatch } from "diff";
import { t } from "../theme.js";

export function coloredDiff(path: string, before: string, after: string): string {
  const patch = createTwoFilesPatch(path, path, before, after, "before", "after");
  // drop the "Index:" / "===" / "---" / "+++" header; show our own
  const body = patch.split("\n").filter((l) => !/^(Index: |={5,}|--- |\+\+\+ )/.test(l));
  const clipped = body.length > 200 ? [...body.slice(0, 199), "… diff truncated after 200 lines"] : body;
  const added = body.filter((l) => l.startsWith("+")).length;
  const removed = body.filter((l) => l.startsWith("-")).length;
  const header = t.bold(path) + "  " + t.ok(`+${added}`) + " " + t.err(`-${removed}`);
  return [header, ...clipped.map((line) => {
    if (line.startsWith("+")) return t.ok(line);
    if (line.startsWith("-")) return t.err(line);
    if (line.startsWith("@@")) return t.deep(line);
    return t.muted(line);
  })].join("\n");
}

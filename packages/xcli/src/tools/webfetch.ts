import { parse } from "node-html-parser";
import TurndownService from "turndown";
import type { Tool } from "../types.js";

export function htmlToMarkdown(html: string): string {
  const root = parse(html);
  const title = root.querySelector("title")?.text.trim() ?? "";
  for (const node of root.querySelectorAll("script, style, noscript, svg, iframe")) node.remove();
  const content = root.querySelector("main") ?? root.querySelector("article") ?? root.querySelector("body") ?? root;
  const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  const markdown = turndown.turndown(content.toString()).trim();
  return `${title ? `# ${title}\n\n` : ""}${markdown}`.trim();
}

export const webFetchTool: Tool = {
  name: "WebFetch",
  description: "Fetch a URL and return readable text or Markdown.",
  parameters: { type: "object", properties: { url: { type: "string" }, max_chars: { type: "number" } }, required: ["url"], additionalProperties: false },
  readOnly: true,
  async run(args, ctx) {
    if (typeof args.url !== "string") throw new Error("WebFetch: url is required.");
    const url = new URL(args.url);
    const timeout = AbortSignal.timeout(30000);
    const signal = AbortSignal.any([ctx.signal, timeout]);
    const response = await fetch(url, { redirect: "follow", signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; xcli/0.1)" } });
    const type = response.headers.get("content-type") ?? "application/octet-stream";
    let text: string;
    if (/text\/html/i.test(type)) text = `${htmlToMarkdown(await response.text())}\n\nFinal URL: ${response.url}`;
    else if (/json|text\//i.test(type)) text = await response.text();
    else { const bytes = await response.arrayBuffer(); text = `Binary response: ${type}; ${bytes.byteLength} bytes.`; }
    const max = Math.max(0, Math.floor(typeof args.max_chars === "number" ? args.max_chars : 100000));
    return text.length > max ? `${text.slice(0, max)}\n\n[Truncated at ${max} characters.]` : text;
  },
};

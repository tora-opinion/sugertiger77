import { parse } from "node-html-parser";
import type { Tool } from "../types.js";

type SearchResult = { title: string; url: string; snippet: string };
export function parseDuckDuckGoHtml(html: string): SearchResult[] {
  const root = parse(html);
  return root.querySelectorAll("a.result__a").map((anchor) => {
    const raw = anchor.getAttribute("href") ?? "";
    let url = raw;
    try { const parsed = new URL(raw, "https://duckduckgo.com"); const redirect = parsed.searchParams.get("uddg"); if (redirect) url = redirect; } catch { /* retain original href */ }
    return { title: anchor.text.trim(), url, snippet: anchor.closest(".result")?.querySelector(".result__snippet")?.text.trim() ?? "" };
  }).filter((item) => item.title && item.url);
}

async function jsonResponse(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error(`Search provider returned HTTP ${response.status}.`);
  return response.json();
}

export const webSearchTool: Tool = {
  name: "WebSearch",
  description: "Search the web for pages matching a query.",
  parameters: { type: "object", properties: { query: { type: "string" }, max_results: { type: "number" } }, required: ["query"], additionalProperties: false },
  readOnly: true,
  async run(args, ctx) {
    const signal = AbortSignal.any([ctx.signal, AbortSignal.timeout(30000)]);
    if (typeof args.query !== "string" || !args.query) throw new Error("WebSearch: query is required.");
    const limit = Math.max(1, Math.min(50, Math.floor(typeof args.max_results === "number" ? args.max_results : 10)));
    let results: SearchResult[];
    if (process.env.TAVILY_API_KEY) {
      const data = await jsonResponse(await fetch("https://api.tavily.com/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query: args.query, max_results: limit }), signal })) as { results?: Array<{ title?: string; url?: string; content?: string }> };
      results = (data.results ?? []).map((r) => ({ title: r.title ?? "", url: r.url ?? "", snippet: r.content ?? "" }));
    } else if (process.env.BRAVE_API_KEY) {
      const url = new URL("https://api.search.brave.com/res/v1/web/search"); url.searchParams.set("q", args.query); url.searchParams.set("count", String(limit));
      const data = await jsonResponse(await fetch(url, { headers: { "X-Subscription-Token": process.env.BRAVE_API_KEY, Accept: "application/json" }, signal })) as { web?: { results?: Array<{ title?: string; url?: string; description?: string }> } };
      results = (data.web?.results ?? []).map((r) => ({ title: r.title ?? "", url: r.url ?? "", snippet: r.description ?? "" }));
    } else if (process.env.SEARXNG_URL) {
      const url = new URL("search", process.env.SEARXNG_URL.endsWith("/") ? process.env.SEARXNG_URL : `${process.env.SEARXNG_URL}/`); url.searchParams.set("format", "json"); url.searchParams.set("q", args.query);
      const data = await jsonResponse(await fetch(url, { signal })) as { results?: Array<{ title?: string; url?: string; content?: string }> };
      results = (data.results ?? []).map((r) => ({ title: r.title ?? "", url: r.url ?? "", snippet: r.content ?? "" }));
    } else {
      const body = new URLSearchParams({ q: args.query });
      const response = await fetch("https://html.duckduckgo.com/html/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0 (compatible; xcli/0.1)" }, body, signal });
      if (!response.ok) throw new Error(`DuckDuckGo returned HTTP ${response.status}.`);
      results = parseDuckDuckGoHtml(await response.text());
    }
    return results.slice(0, limit).map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`).join("\n\n") || "No results found.";
  },
};

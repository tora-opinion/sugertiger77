import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { applyEdit } from "../tools/edit.js";
import { readTool } from "../tools/read.js";
import { grepJsFallback } from "../tools/grep.js";
import { bashTool } from "../tools/bash.js";
import { htmlToMarkdown } from "../tools/webfetch.js";
import { parseDuckDuckGoHtml } from "../tools/websearch.js";
import { accumulateToolCall } from "../client.js";
import type { ToolCall } from "../types.js";
import type { ToolContext } from "../types.js";

test("applyEdit requires unique match unless replace_all", () => {
  assert.throws(() => applyEdit("x x", "x", "y"), /occurs 2 times/);
  assert.equal(applyEdit("x x", "x", "y", true), "y y");
});

test("applyEdit inserts replacement strings literally", () => {
  assert.equal(applyEdit("old", "old", "$&"), "$&");
});

test("htmlToMarkdown strips script and retains headings and links", () => {
  const result = htmlToMarkdown("<html><head><title>Page</title></head><body><main><script>alert(1)</script><h2>Heading</h2><a href=\"https://example.com\">Link</a></main></body></html>");
  assert.match(result, /# Page/);
  assert.match(result, /## Heading/);
  assert.match(result, /\[Link\]\(https:\/\/example\.com\)/);
  assert.doesNotMatch(result, /alert/);
});

test("parseDuckDuckGoHtml decodes uddg redirect", () => {
  const html = '<div class="result"><a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample.com%2Fa%3Fx%3D1">Example</a><a class="result__snippet">A snippet</a></div>';
  assert.deepEqual(parseDuckDuckGoHtml(html), [{ title: "Example", url: "https://example.com/a?x=1", snippet: "A snippet" }]);
});

test("tool call delta accumulation keeps ids and duplicate names stable", () => {
  const call: ToolCall = { id: "", type: "function", function: { name: "", arguments: "" } };
  accumulateToolCall(call, { id: "call_1", function: { name: "read", arguments: "{\"path\":" } });
  accumulateToolCall(call, { id: "call_1", function: { name: "read", arguments: "\"a\"}" } });
  assert.deepEqual(call, { id: "call_1", type: "function", function: { name: "read", arguments: "{\"path\":\"a\"}" } });
});

test("Read honors offset and limit", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "xcli-read-"));
  try {
    await writeFile(path.join(cwd, "sample.txt"), "one\ntwo\nthree\nfour", "utf8");
    const ctx: ToolContext = { cwd, signal: new AbortController().signal, askPermission: async () => true };
    assert.equal(await readTool.run({ file_path: "sample.txt", offset: 2, limit: 2 }, ctx), "     2\ttwo\n     3\tthree");
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

test("Grep JS fallback searches and counts matching files", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "xcli-grep-"));
  try {
    await mkdir(path.join(cwd, "src"));
    await writeFile(path.join(cwd, "src", "a.txt"), "hello\nworld\nhello\n", "utf8");
    await writeFile(path.join(cwd, "other.txt"), "no match\n", "utf8");
    assert.equal(await grepJsFallback({ pattern: "hello", output_mode: "count" }, cwd), `src${path.sep}a.txt:2`);
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

test("Grep JS fallback supports common glob patterns and basename matching", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "xcli-glob-"));
  try {
    await mkdir(path.join(cwd, "src", "nested"), { recursive: true });
    await mkdir(path.join(cwd, "lib"), { recursive: true });
    await writeFile(path.join(cwd, "src", "a.ts"), "hit", "utf8");
    await writeFile(path.join(cwd, "src", "nested", "b.tsx"), "hit", "utf8");
    await writeFile(path.join(cwd, "lib", "c.ts"), "hit", "utf8");
    assert.equal((await grepJsFallback({ pattern: "hit", glob: "*.ts" }, cwd)).split("\n").length, 2);
    assert.equal((await grepJsFallback({ pattern: "hit", glob: "**/*.ts" }, cwd)).split("\n").length, 2);
    assert.equal((await grepJsFallback({ pattern: "hit", glob: "src/**/*.{ts,tsx}" }, cwd)).split("\n").length, 2);
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

test("Bash reports timeout", async () => {
  const ctx: ToolContext = { cwd: process.cwd(), signal: new AbortController().signal, askPermission: async () => true };
  const command = process.platform === "win32" ? "Start-Sleep -Seconds 5" : "sleep 5";
  const result = await bashTool.run({ command, timeout_ms: 50 }, ctx);
  assert.match(result, /timed out after 50 ms/);
});

test("Grep JS fallback searches a single file path", async () => {
  const { grepJsFallback } = await import("../tools/grep.js");
  const { mkdtemp, writeFile } = await import("node:fs/promises");
  const os = await import("node:os"); const p = await import("node:path");
  const dir = await mkdtemp(p.join(os.tmpdir(), "xcli-grepfile-"));
  await writeFile(p.join(dir, "a.txt"), "hay\nneedle\n");
  const out = await grepJsFallback({ pattern: "needle", path: "a.txt" }, dir);
  assert.match(out, /a\.txt/);
});

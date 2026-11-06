#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Agent } from "./agent.js";
import { addModel, loadConfig, removeModel, resolveModel, saveConfig } from "./config.js";
import { createPermissionPrompter } from "./permissions.js";
import { runRepl, parseModelArgs } from "./repl.js";
import { renderError, renderHelp, renderInfo, renderModelList } from "./render.js";
import { Session } from "./session.js";
import { getTools } from "./tools/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(await readFile(path.resolve(here, "../package.json"), "utf8")) as { version: string };
const help = `xcli [prompt]\n  -p, --print <prompt>       一度だけ実行して回答を出力\n  -m, --model <code|alias>   モデルを指定\n  -y, --yes                  許可確認を省略\n  --no-web                   WebFetch / WebSearch を無効化\n  -r, --resume [id]          セッションを再開\n  --cwd <dir>                作業ディレクトリ\n  models                     APIと登録済みモデルの一覧\n  model add|rm|list          モデル登録を管理\n  sessions                   最近のセッション一覧\n  -h, --help                 ヘルプ\n  -v, --version              バージョン`;

async function main(argv: string[]): Promise<number> {
  if (argv[0] === "model" && argv[1] === "add") {
    const cfg = await loadConfig(); const entry = parseModelArgs(argv.slice(2));
    await saveConfig(addModel(cfg, entry)); renderInfo(`モデル ${entry.id} を登録しました。`); return 0;
  }
  if (argv[0] === "model" && argv[1] === "rm") {
    const cfg = await loadConfig(); const target = argv[2];
    if (!target || !removeModel(cfg, target)) throw new Error("登録モデルが見つかりません。");
    await saveConfig(cfg); renderInfo(`モデル ${target} を解除しました。`); return 0;
  }
  let prompt: string | undefined;
  let print = false; let model: string | undefined; let yes = false; let noWeb = false;
  let cwd = process.cwd(); let resume: string | undefined;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "-h" || arg === "--help") { console.log(help); return 0; }
    if (arg === "-v" || arg === "--version") { console.log(pkg.version); return 0; }
    if (arg === "-p" || arg === "--print") { print = true; prompt = argv[++i]; if (!prompt) throw new Error(`${arg} の後にプロンプトが必要です。`); }
    else if (arg === "-m" || arg === "--model") { model = argv[++i]; if (!model) throw new Error(`${arg} の後にモデルが必要です。`); }
    else if (arg === "-y" || arg === "--yes") yes = true;
    else if (arg === "--no-web") noWeb = true;
    else if (arg === "--cwd") { const val = argv[++i]; if (!val) throw new Error("--cwd の後にディレクトリが必要です。"); cwd = path.resolve(val); }
    else if (arg === "-r" || arg === "--resume") { resume = argv[i + 1] && !argv[i + 1]!.startsWith("-") ? argv[++i]! : "__latest__"; }
    else if (arg.startsWith("-")) throw new Error(`不明なオプション: ${arg}`);
    else positional.push(arg);
  }
  if (!print && !prompt && positional[0] !== "models" && positional[0] !== "model" && positional[0] !== "sessions") prompt = positional.join(" ") || undefined;
  const command = positional[0];
  const cfg = await loadConfig();
  if (command === "models") {
    const { getEndpoint } = await import("./config.js"); const { createClient, listModels } = await import("./client.js");
    const id = resolveModel(cfg, model || cfg.defaultModel).id;
    renderModelList(await listModels(createClient((model && cfg.models.find((m) => m.id === model)?.baseURL) || cfg.baseURL, getEndpoint(cfg, id).apiKey)), cfg.models, id); return 0;
  }
  if (command === "sessions") { for (const s of await Session.list()) console.log(`${s.id}\t${s.firstUserMessage}`); return 0; }
  if (command === "model") {
    const sub = positional[1];
    if (sub === "list") { for (const m of cfg.models) console.log(`${m.id}${m.alias ? `\t${m.alias}` : ""}`); return 0; }
    if (sub === "add") { const entry = parseModelArgs(argv.slice(argv.indexOf("model") + 2)); const next = addModel(cfg, entry); await saveConfig(next); renderInfo(`モデル ${entry.id} を登録しました。`); return 0; }
    if (sub === "rm") { if (!positional[2] || !removeModel(cfg, positional[2])) throw new Error("登録モデルが見つかりません。"); await saveConfig(cfg); renderInfo(`モデル ${positional[2]} を解除しました。`); return 0; }
    throw new Error("使い方: xcli model add|rm|list");
  }
  if (!print) { await runRepl({ cwd, model, yes, noWeb, resume, version: pkg.version, initialPrompt: prompt }); return 0; }
  if (!prompt) throw new Error("プロンプトが必要です。");
  const actualModel = resolveModel(cfg, model || cfg.defaultModel);
  // print mode: stdout carries only the answer; diagnostics go to stderr
  if (!actualModel.registered && process.env.XCLI_VERBOSE) console.error(`未登録モデルコード ${actualModel.id} をそのまま使用します。`);
  if (noWeb) cfg.web = false;
  let denied = false; let output = "";
  const nonInteractive = !process.stdin.isTTY;
  const askPermission = createPermissionPrompter({ yes, ask: async () => "n", print: (s) => { if (!yes && nonInteractive) denied = true; else console.error(s); } });
  const session = await Session.create(actualModel.id, cwd);
  const agent = new Agent({ cfg, model: actualModel.id, cwd, tools: getTools({ web: cfg.web }), session, askPermission, stopOnDeny: !yes && nonInteractive, onEvent: (event) => {
    if (event.type === "text") output += event.delta;
    else if (event.type === "warning") console.error(`⚠ ${event.message}`);
    else if (event.type === "tool_start" && process.env.XCLI_VERBOSE) console.error(`● ${event.call.function.name}`);
  } });
  await agent.run(prompt, new AbortController().signal);
  if (denied) { console.error("書き込みツールの実行を拒否しました。許可する場合は --yes を指定してください。"); return 1; }
  process.stdout.write(output);
  return 0;
}

try { process.exitCode = await main(process.argv.slice(2)); }
catch (error) { const { formatApiError } = await import("./client.js"); console.error("✗ " + formatApiError(error)); process.exitCode = 1; }

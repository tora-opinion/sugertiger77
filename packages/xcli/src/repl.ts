import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import path from "node:path";
import { Agent } from "./agent.js";
import { addModel, loadConfig, removeModel, resolveModel, saveConfig } from "./config.js";
import { createPermissionPrompter } from "./permissions.js";
import { buildSystemPrompt } from "./prompt.js";
import { EventRenderer, renderBanner, renderContinuationPrefix, renderDisplay, renderError, renderFailure, renderGoodbye, renderGreeting, renderHelp, renderInfo, renderInputRule, renderMascot, renderModelList, renderPromptPrefix, renderRaw, renderSuccess, renderUsage } from "./render.js";
import { Session } from "./session.js";
import { getTools } from "./tools/index.js";
import type { ChatMessage } from "./types.js";

export async function runRepl(options: { cwd: string; model?: string; yes?: boolean; noWeb?: boolean; resume?: string; version?: string; initialPrompt?: string }): Promise<void> {
  let cfg = await loadConfig();
  if (options.noWeb) cfg.web = false;
  let current = resolveModel(cfg, options.model || cfg.defaultModel).id;
  let cwd = options.cwd;
  let session: Session;
  let messages: ChatMessage[] | undefined;
  if (options.resume) {
    const sessions = await Session.list();
    const id = options.resume === "__latest__" ? sessions[0]?.id : options.resume;
    if (!id) { renderInfo("再開できるセッションがありません。"); return; }
    const loaded = await Session.load(id);
    session = await Session.open(id);
    cwd = loaded.meta.cwd;
    current = loaded.meta.model;
    messages = [{ role: "system", content: buildSystemPrompt(cwd) }, ...loaded.messages];
    if (path.resolve(cwd) !== path.resolve(options.cwd)) renderInfo(`セッションの作業ディレクトリを使用します: ${cwd}`);
    renderInfo(`セッション ${id} を再開しました。`);
  } else session = await Session.create(current, options.cwd);

  await renderGreeting();
  renderBanner({ model: current, cwd, version: options.version || "0.1.0", web: cfg.web });
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  // rl.question never settles once stdin closes (Ctrl+D / EOF); race it against close so the loop exits cleanly
  const closed = new Promise<never>((_, reject) => rl.once("close", () => reject(new Error("input closed"))));
  closed.catch(() => undefined);
  const ask = (q: string): Promise<string> => Promise.race([rl.question(q), closed]);
  let yes = options.yes === true;
  let agent: Agent;
  let controller: AbortController | undefined;
  let generating = false;
  let ctrlPressed = false;
  let prompter = createPermissionPrompter({ yes, ask: (q) => ask(q + " "), print: renderRaw });
  const askPermission: typeof prompter = (req) => prompter(req);
  const makeAgent = () => new Agent({ cfg, model: current, cwd, tools: getTools({ web: cfg.web }), session, askPermission, onEvent: (event) => {
    // hold the latest warning back: if the run fails it is shown with a sad Mikan instead
    if (event.type === "warning") { if (pendingWarning) renderer.handle({ type: "warning", message: pendingWarning }); pendingWarning = event.message; return; }
    if (event.type === "usage") return;
    if (event.type !== "done" && pendingWarning) { renderer.handle({ type: "warning", message: pendingWarning }); pendingWarning = undefined; }
    renderer.handle(event);
  }, messages, display: renderDisplay });
  let renderer = new EventRenderer();
  let pendingWarning: string | undefined;
  agent = makeAgent();
  let lastSigint = 0;
  const onSigint = () => {
    // rl and process may both report the same keypress; collapse duplicates
    const now = Date.now(); if (now - lastSigint < 100) return; lastSigint = now;
    if (generating) { controller?.abort(); renderInfo("生成を中断しました。"); return; }
    if (ctrlPressed) { rl.close(); return; }
    ctrlPressed = true;
    renderInfo("もう一度 Ctrl+C を押すと終了します。");
    setTimeout(() => { ctrlPressed = false; }, 1500).unref();
  };
  process.on("SIGINT", onSigint);
  rl.on("SIGINT", onSigint);
  try {
    while (true) {
      let input: string;
      if (options.initialPrompt !== undefined) { input = options.initialPrompt; options.initialPrompt = undefined; }
      else { renderInputRule(); try { input = await ask(renderPromptPrefix()); } catch { break; } }
      ctrlPressed = false;
      let lines = input;
      while (lines.endsWith("\\")) {
        lines = lines.slice(0, -1) + "\n";
        try { lines += await ask(renderContinuationPrefix()); } catch { lines += ""; break; }
      }
      const text = lines.trim();
      if (!text) continue;
      if (text.startsWith("/")) {
        const [command, ...args] = text.split(/\s+/);
        try {
          if (command === "/exit") break;
          if (command === "/help") renderHelp();
          else if (command === "/mascot") await renderMascot(args[0]);
          else if (command === "/yes") { yes = !yes; prompter = createPermissionPrompter({ yes, ask: (q) => ask(q + " "), print: renderRaw }); renderInfo(`許可確認スキップ: ${yes ? "有効" : "無効"}`); }
          else if (command === "/clear") { agent.clear(); renderInfo("会話をリセットしました。"); }
          else if (command === "/cost") renderUsage(agent.getUsage(), current);
          else if (command === "/compact") { controller = new AbortController(); await agent.compact(controller.signal); controller = undefined; await renderSuccess("会話を要約したで"); }
          else if (command === "/models") { const endpoint = await import("./config.js").then((m) => m.getEndpoint(cfg, current)); const { createClient, listModels } = await import("./client.js"); renderModelList(await listModels(createClient(endpoint.baseURL, endpoint.apiKey)), cfg.models, current); }
          else if (command === "/resume") { const entries = await Session.list(); if (!args[0]) entries.forEach((s) => renderInfo(`${s.id}  ${s.firstUserMessage.slice(0, 80)}`)); else { const data = await Session.load(args[0]); session = await Session.open(args[0]); current = data.meta.model; cwd = data.meta.cwd; messages = [{ role: "system", content: buildSystemPrompt(cwd) }, ...data.messages]; agent = makeAgent(); if (path.resolve(cwd) !== path.resolve(process.cwd())) renderInfo(`セッションの作業ディレクトリを使用します: ${cwd}`); renderInfo(`セッション ${args[0]} を再開しました。`); } }
          else if (command === "/model" && args[0] === "add") { const entry = parseModelArgs(args.slice(1)); Object.assign(cfg, addModel(cfg, entry)); await saveConfig(cfg); if (resolveModel(cfg, current).id === entry.id) agent.setModel(entry.id); await renderSuccess(`モデル ${entry.id} を登録したで`); }
          else if (command === "/model" && args[0] === "rm") { if (!args[1] || !removeModel(cfg, args[1])) renderInfo("登録モデルが見つかりません。"); else { await saveConfig(cfg); renderInfo(`モデル ${args[1]} を解除しました。`); } }
          else if (command === "/model" && args[0]) { const resolved = resolveModel(cfg, args[0]); if (!resolved.registered) renderInfo(`未登録コード ${resolved.id} をそのまま使用します。`); current = resolved.id; agent.setModel(current); await renderSuccess(`モデルを ${current} に切り替えたで`); }
          else renderInfo("不明なコマンドです。/help を参照してください。");
        } catch (error) { renderError(error instanceof Error ? error.message : String(error)); }
        continue;
      }
      renderer = new EventRenderer();
      pendingWarning = undefined;
      controller = new AbortController(); generating = true;
      renderer.start();
      try {
        await agent.run(text, controller.signal);
        const aborted = controller.signal.aborted;
        if (agent.lastRunFailed && !aborted) renderFailure(pendingWarning ?? "原因不明のエラーや");
        else if (pendingWarning) renderer.handle({ type: "warning", message: pendingWarning });
        pendingWarning = undefined;
      }
      catch (error) { const { formatApiError } = await import("./client.js"); renderFailure(formatApiError(error)); }
      finally { generating = false; controller = undefined; }
    }
  } finally { process.removeListener("SIGINT", onSigint); rl.removeListener("SIGINT", onSigint); rl.close(); await renderGoodbye(); }
}

export function parseModelArgs(args: string[]): { id: string; alias?: string; tools?: boolean; contextTokens?: number; baseURL?: string; apiKeyEnv?: string } {
  const id = args[0]; if (!id) throw new Error("モデルコードが必要です。");
  const entry: { id: string; alias?: string; tools?: boolean; contextTokens?: number; baseURL?: string; apiKeyEnv?: string } = { id };
  for (let i = 1; i < args.length; i++) {
    const flag = args[i]; const value = args[i + 1];
    if (flag === "--no-tools") entry.tools = false;
    else if (["--alias", "--context", "--base-url", "--api-key-env"].includes(flag || "")) {
      if (!value) throw new Error(`${flag} の値が必要です。`); i++;
      if (flag === "--alias") entry.alias = value;
      else if (flag === "--context") { const n = Number(value); if (!Number.isFinite(n) || n <= 0) throw new Error("--context は正の数で指定してください。"); entry.contextTokens = n; }
      else if (flag === "--base-url") entry.baseURL = value;
      else entry.apiKeyEnv = value;
    } else throw new Error(`不明なオプション: ${flag}`);
  }
  return entry;
}

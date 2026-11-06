import type OpenAI from "openai";
import { getEndpoint } from "./config.js";
import { createClient, formatApiError, isToolsUnsupportedError, streamChat } from "./client.js";
import { buildSystemPrompt } from "./prompt.js";
import type { Session } from "./session.js";
import type { AgentEvent, ChatMessage, Tool, ToolCall, ToolContext, Usage, XcliConfig } from "./types.js";

type AgentOptions = {
  cfg: XcliConfig; model: string; cwd: string; tools: Tool[]; session?: Session;
  askPermission: ToolContext["askPermission"]; onEvent(event: AgentEvent): void;
  messages?: ChatMessage[];
  display?: ToolContext["display"];
  stopOnDeny?: boolean;
  clientFactory?: (baseURL: string, apiKey: string) => OpenAI;
};

export class Agent {
  /** true when the last run() ended with an API/fatal error */
  lastRunFailed = false;
  readonly messages: ChatMessage[];
  private model: string;
  private readonly cfg: XcliConfig;
  private readonly cwd: string;
  private readonly tools: Tool[];
  private readonly session?: Session;
  private readonly askPermission: ToolContext["askPermission"];
  private readonly onEvent: (event: AgentEvent) => void;
  private readonly display?: ToolContext["display"];
  private readonly stopOnDeny: boolean;
  private readonly clientFactory: (baseURL: string, apiKey: string) => OpenAI;
  private usage: Usage = { promptTokens: 0, completionTokens: 0 };
  private lastPromptTokens = 0;
  private textOnly = false;

  constructor(options: AgentOptions) {
    this.cfg = options.cfg; this.model = options.model; this.cwd = options.cwd; this.tools = options.tools;
    this.session = options.session; this.askPermission = options.askPermission; this.onEvent = options.onEvent;
    this.display = options.display;
    this.stopOnDeny = options.stopOnDeny === true;
    this.clientFactory = options.clientFactory ?? createClient;
    this.messages = options.messages ? [...options.messages] : [{ role: "system", content: buildSystemPrompt(options.cwd) }];
  }

  setModel(id: string): void { this.model = id; this.textOnly = false; }
  clear(): void { this.messages.splice(0, this.messages.length, { role: "system", content: buildSystemPrompt(this.cwd) }); this.usage = { promptTokens: 0, completionTokens: 0 }; this.lastPromptTokens = 0; void this.session?.reset(); }
  getUsage(): Usage { return { ...this.usage }; }

  private async push(message: ChatMessage): Promise<void> { this.messages.push(message); await this.session?.append(message); }
  private endpoint(): OpenAI { const endpoint = getEndpoint(this.cfg, this.model); return this.clientFactory(endpoint.baseURL, endpoint.apiKey); }

  async run(userInput: string, signal: AbortSignal): Promise<void> {
    this.lastRunFailed = false;
    await this.push({ role: "user", content: userInput });
    let turns = 0;
    try {
      while (!signal.aborted && turns < this.cfg.maxTurns) {
        turns++;
        const entry = this.cfg.models.find((item) => item.id === this.model);
        if (entry?.tools === false && !this.textOnly) {
          this.textOnly = true;
          this.onEvent({ type: "warning", message: "このモデルはツール呼び出しに対応していないため、テキストのみで実行します。" });
        }
        if (entry?.contextTokens && this.lastPromptTokens > entry.contextTokens * 0.8) await this.compact(signal);
        let response: Awaited<ReturnType<typeof streamChat>>;
        try {
          response = await streamChat({ client: this.endpoint(), model: this.model, messages: this.messages,
            ...(this.textOnly || entry?.tools === false ? {} : { tools: this.tools }), signal,
            onText: (delta) => this.onEvent({ type: "text", delta }) });
        } catch (error) {
          if (!this.textOnly && isToolsUnsupportedError(error)) {
            this.textOnly = true;
            this.onEvent({ type: "warning", message: "このモデルはツール呼び出しに対応していないため、テキストのみで続行します。" });
            continue;
          }
          throw error;
        }
        if (response.usage) { this.usage = { promptTokens: this.usage.promptTokens + response.usage.promptTokens, completionTokens: this.usage.completionTokens + response.usage.completionTokens }; this.lastPromptTokens = response.usage.promptTokens; this.onEvent({ type: "usage", usage: response.usage }); }
        await this.push(response.message);
        if (!response.message.tool_calls?.length) break;
        for (let i = 0; i < response.message.tool_calls.length; i++) {
          const call = response.message.tool_calls[i]!;
          if (signal.aborted) {
            for (const pending of response.message.tool_calls.slice(i)) await this.push({ role: "tool", tool_call_id: pending.id, content: "Error: aborted by user" });
            break;
          }
          const denied = await this.executeTool(call, signal);
          if (denied && this.stopOnDeny) {
            for (const pending of response.message.tool_calls.slice(i + 1)) await this.push({ role: "tool", tool_call_id: pending.id, content: "Error: skipped after permission was denied" });
            return;
          }
          if (signal.aborted) {
            for (const pending of response.message.tool_calls.slice(i + 1)) await this.push({ role: "tool", tool_call_id: pending.id, content: "Error: aborted by user" });
            break;
          }
        }
      }
      if (turns >= this.cfg.maxTurns) this.onEvent({ type: "warning", message: `最大ターン数（${this.cfg.maxTurns}）に達しました。` });
    } catch (error) {
      this.lastRunFailed = true;
      if (!signal.aborted) this.onEvent({ type: "warning", message: formatApiError(error) });
    } finally { this.onEvent({ type: "done" }); }
  }

  private async executeTool(call: ToolCall, signal: AbortSignal): Promise<boolean> {
    let args: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(call.function.arguments || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("引数は JSON オブジェクトで指定してください");
      args = parsed as Record<string, unknown>;
    } catch (error) {
      await this.push({ role: "tool", tool_call_id: call.id, content: `Error: 引数 JSON を解析できません: ${error instanceof Error ? error.message : String(error)}` });
      return false;
    }
    const tool = this.tools.find((item) => item.name === call.function.name);
    if (!tool) { await this.push({ role: "tool", tool_call_id: call.id, content: `Error: 不明なツールです: ${call.function.name}` }); return false; }
    const summary = this.toolSummary(tool.name, args);
    this.onEvent({ type: "tool_start", call, args });
    let result = ""; let isError = false;
    try {
      if (!tool.readOnly && !(await this.askPermission({ tool: tool.name, summary }))) { result = "User denied permission"; isError = true; }
      else if (signal.aborted) { result = "Error: aborted by user"; isError = true; }
      else result = await tool.run(args, { cwd: this.cwd, signal, askPermission: this.askPermission, display: this.display });
    } catch (error) { isError = true; result = `Error: ${error instanceof Error ? error.message : String(error)}`; }
    await this.push({ role: "tool", tool_call_id: call.id, content: result });
    this.onEvent({ type: "tool_end", call, result, isError });
    return result === "User denied permission";
  }

  private toolSummary(name: string, args: Record<string, unknown>): string {
    const target = args.command ?? args.file_path ?? args.path ?? args.query ?? "";
    return `${name}: ${String(target)}`.trim();
  }

  async compact(signal: AbortSignal): Promise<void> {
    if (this.messages.length < 3) return;
    const client = this.endpoint();
    const summaryResponse = await streamChat({ client, model: this.model, signal,
      messages: [{ role: "system", content: "Summarize the conversation for continuation. Preserve user goals, decisions, file paths, current state, and unresolved work. Be concise." },
        { role: "user", content: this.messages.slice(1).map((message) => `${message.role}: ${message.content || ""}`).join("\n").slice(-80_000) }],
      onText: () => undefined });
    const system = this.messages[0];
    const summary: ChatMessage = { role: "user", content: `Conversation summary for continuation:\n${summaryResponse.message.content || ""}` };
    this.messages.splice(0, this.messages.length, system, summary);
    await this.session?.reset();
    await this.session?.append(summary);
  }
}

import OpenAI from "openai";
import type { ChatCompletionChunk } from "openai/resources/chat/completions";
import type { ChatMessage, Tool, ToolCall, Usage } from "./types.js";

export function createClient(baseURL: string, apiKey: string): OpenAI {
  return new OpenAI({ baseURL, apiKey, maxRetries: 0 });
}

function apiMessage(message: ChatMessage): OpenAI.Chat.Completions.ChatCompletionMessageParam {
  if (message.role === "assistant") return {
    role: "assistant", content: message.content,
    ...(message.tool_calls ? { tool_calls: message.tool_calls.map((call) => ({
      id: call.id, type: "function" as const,
      function: { name: call.function.name, arguments: call.function.arguments },
    })) } : {}),
  };
  if (message.role === "tool") return { role: "tool", tool_call_id: message.tool_call_id || "", content: message.content || "" };
  return { role: message.role, content: message.content || "" };
}

function toTool(tool: Tool): OpenAI.Chat.Completions.ChatCompletionTool {
  return { type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters as unknown as Record<string, unknown> } };
}

export function accumulateToolCall(current: ToolCall, part: { id?: string | null; function?: { name?: string | null; arguments?: string | null } }): ToolCall {
  if (part.id && !current.id) current.id = part.id;
  const name = part.function?.name;
  if (name && (!current.function.name || name !== current.function.name)) current.function.name += name;
  if (part.function?.arguments) current.function.arguments += part.function.arguments;
  return current;
}

function retryable(error: unknown): boolean {
  if (error && typeof error === "object") {
    const status = "status" in error ? Number(error.status) : 0;
    if (status === 429) return !`${errorText(error)} ${JSON.stringify(error)}`.includes("free_limit_reached");
    if (status >= 500) return true;
    if ("status" in error && status > 0) return false;
    return "name" in error && /network|timeout|connection|fetch/i.test(String(error.name));
  }
  return false;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return String(error);
}

export async function streamChat(args: {
  client: OpenAI; model: string; messages: ChatMessage[]; tools?: Tool[]; signal?: AbortSignal;
  onText(delta: string): void;
}): Promise<{ message: ChatMessage; usage?: Usage }> {
  let lastError: unknown;
  let emitted = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const stream = await args.client.chat.completions.create({
        model: args.model,
        messages: args.messages.map(apiMessage),
        ...(args.tools?.length ? { tools: args.tools.map(toTool), tool_choice: "auto" as const } : {}),
        stream: true,
        stream_options: { include_usage: true },
      }, { signal: args.signal });
      let content = "";
      const calls = new Map<number, ToolCall>();
      let usage: Usage | undefined;
      for await (const chunk of stream as AsyncIterable<ChatCompletionChunk>) {
        const choice = chunk.choices[0];
        if (choice?.delta.content) { content += choice.delta.content; emitted = true; args.onText(choice.delta.content); }
        for (const part of choice?.delta.tool_calls || []) {
          const call = calls.get(part.index) || { id: "", type: "function" as const, function: { name: "", arguments: "" } };
          accumulateToolCall(call, part);
          calls.set(part.index, call);
        }
        if (chunk.usage) usage = { promptTokens: chunk.usage.prompt_tokens, completionTokens: chunk.usage.completion_tokens };
      }
      return { message: { role: "assistant", content: content || null, ...(calls.size ? { tool_calls: [...calls.entries()].sort(([a], [b]) => a - b).map(([, call]) => call) } : {}) }, ...(usage ? { usage } : {}) };
    } catch (error) {
      lastError = error;
      // never retry once text reached the user: a retry would duplicate output
      if (attempt === 2 || emitted || !retryable(error) || args.signal?.aborted) throw error;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 250 * 2 ** attempt);
        args.signal?.addEventListener("abort", () => { clearTimeout(timer); reject(args.signal?.reason); }, { once: true });
      });
    }
  }
  throw lastError;
}

export function formatApiError(err: unknown): string {
  const raw = `${errorText(err)} ${err && typeof err === "object" ? JSON.stringify(err) : ""}`;
  const code = err && typeof err === "object" && "code" in err ? String(err.code) : raw;
  if (code.includes("free_limit_reached")) return "無料利用枠に達しました。時間をおいてから再度お試しください。";
  if (code.includes("model_not_granted")) return "このモデルを利用する権限がありません。利用可能なモデルを選んでください。";
  if (code.includes("model_location_not_supported")) return "このモデルは現在の接続地域では利用できません。";
  if (code.includes("unsupported_capability")) return "このモデルは要求された機能に対応していません。";
  return `API エラー: ${errorText(err)}`;
}

export function isToolsUnsupportedError(err: unknown): boolean {
  const raw = `${errorText(err)} ${err && typeof err === "object" ? JSON.stringify(err) : ""}`;
  const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
  return code.includes("unsupported_capability") || /tools?.{0,30}(unsupported|not support)|function calling.{0,30}(unsupported|not support)/i.test(raw);
}

export async function listModels(client: OpenAI): Promise<string[]> {
  const result = await client.models.list();
  return result.data.map((model) => model.id);
}

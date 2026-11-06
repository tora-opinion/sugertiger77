// Shared contracts. Do NOT change signatures without updating all modules.

export interface JSONSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolContext {
  cwd: string;
  /** Aborted when the user presses Ctrl+C during a turn. */
  signal: AbortSignal;
  /** Ask permission for a non-readOnly tool. Resolves true if allowed. */
  askPermission: (req: PermissionRequest) => Promise<boolean>;
  /** Optional side-channel for rich output (e.g. diffs) shown to the user, not sent to the model. */
  display?: (text: string) => void;
}

export interface PermissionRequest {
  tool: string;
  /** One-line human readable summary, e.g. "Bash: npm test" */
  summary: string;
  /** Optional details, e.g. a unified diff for Edit/Write */
  detail?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  /** readOnly tools (Read/Glob/Grep/WebFetch/WebSearch) are auto-allowed. */
  readOnly: boolean;
  /** Returns text sent back to the model as the tool result. Throw Error for failures. */
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
}

export interface ModelEntry {
  id: string;
  alias?: string;
  /** false => model does not support tool calling; run text-only. Default true. */
  tools?: boolean;
  contextTokens?: number;
  /** Per-model gateway override */
  baseURL?: string;
  /** Name of env var holding the API key for this model's baseURL */
  apiKeyEnv?: string;
}

export interface XcliConfig {
  baseURL: string;        // default https://api.experientiallabs.ai/v1
  apiKeyEnv: string;      // default EXPLABS_API_KEY
  defaultModel: string;   // default deepseek-v4.1-flash:free
  models: ModelEntry[];
  maxTurns: number;       // default 50
  web: boolean;           // default true (WebFetch/WebSearch enabled, unrestricted)
}

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
}

/** Events emitted by the agent loop for rendering. */
export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool_start"; call: ToolCall; args: Record<string, unknown> }
  | { type: "tool_end"; call: ToolCall; result: string; isError: boolean }
  | { type: "usage"; usage: Usage }
  | { type: "warning"; message: string }
  | { type: "done" };

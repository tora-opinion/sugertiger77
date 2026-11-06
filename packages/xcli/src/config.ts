import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ModelEntry, XcliConfig } from "./types.js";

const DEFAULTS: XcliConfig = {
  baseURL: "https://api.experientiallabs.ai/v1",
  apiKeyEnv: "EXPLABS_API_KEY",
  defaultModel: "deepseek-v4.1-flash:free",
  models: [],
  maxTurns: 50,
  web: true,
};

export function getConfigHome(): string {
  return process.env.XCLI_HOME || path.join(os.homedir(), ".xcli");
}

export async function loadConfig(): Promise<XcliConfig> {
  let stored: Partial<XcliConfig> = {};
  try {
    stored = JSON.parse(await fs.readFile(path.join(getConfigHome(), "config.json"), "utf8")) as Partial<XcliConfig>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return {
    ...DEFAULTS,
    ...stored,
    models: Array.isArray(stored.models) ? stored.models : DEFAULTS.models,
    baseURL: process.env.XCLI_BASE_URL || stored.baseURL || DEFAULTS.baseURL,
    defaultModel: process.env.XCLI_MODEL || stored.defaultModel || DEFAULTS.defaultModel,
  };
}

export async function saveConfig(cfg: XcliConfig): Promise<void> {
  const home = getConfigHome();
  await fs.mkdir(home, { recursive: true });
  await fs.writeFile(path.join(home, "config.json"), `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
}

export function addModel(cfg: XcliConfig, entry: ModelEntry): XcliConfig {
  if (entry.alias && cfg.models.some((item) => item.id !== entry.id && item.alias === entry.alias)) {
    throw new Error(`モデル別名「${entry.alias}」は既に使われています`);
  }
  return { ...cfg, models: [...cfg.models.filter((item) => item.id !== entry.id), entry] };
}

export function removeModel(cfg: XcliConfig, idOrAlias: string): boolean {
  const found = cfg.models.find((item) => item.id === idOrAlias || item.alias === idOrAlias);
  if (!found) return false;
  cfg.models = cfg.models.filter((item) => item.id !== found.id);
  return true;
}

export function resolveModel(cfg: XcliConfig, input: string): { id: string; entry?: ModelEntry; registered: boolean } {
  const entry = cfg.models.find((item) => item.id === input || item.alias === input);
  return entry ? { id: entry.id, entry, registered: true } : { id: input, registered: false };
}

export function getEndpoint(cfg: XcliConfig, modelId: string): { baseURL: string; apiKey: string } {
  const model = cfg.models.find((item) => item.id === modelId);
  const baseURL = model?.baseURL || cfg.baseURL;
  const apiKeyEnv = model?.apiKeyEnv || cfg.apiKeyEnv;
  const apiKey = process.env[apiKeyEnv];
  if (!apiKey) throw new Error(`環境変数 ${apiKeyEnv} に API キーを設定してください`);
  return { baseURL, apiKey };
}

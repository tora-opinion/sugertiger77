import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { getConfigHome } from "./config.js";
import type { ChatMessage } from "./types.js";

export interface SessionMeta { type: "meta"; model: string; cwd: string; createdAt: string }
export interface SessionSummary { id: string; mtime: Date; firstUserMessage: string }

export class Session {
  readonly id: string;
  readonly file: string;
  private constructor(id: string) { this.id = id; this.file = path.join(getConfigHome(), "sessions", `${id}.jsonl`); }

  static async create(model: string, cwd: string): Promise<Session> {
    const session = new Session(`${Date.now()}-${randomBytes(4).toString("hex")}`);
    await fs.mkdir(path.dirname(session.file), { recursive: true });
    const meta: SessionMeta = { type: "meta", model, cwd, createdAt: new Date().toISOString() };
    await fs.writeFile(session.file, `${JSON.stringify(meta)}\n`, "utf8");
    return session;
  }

  static async open(id: string): Promise<Session> {
    const session = new Session(id);
    await fs.access(session.file);
    return session;
  }

  async append(msg: ChatMessage): Promise<void> {
    await fs.appendFile(this.file, `${JSON.stringify(msg)}\n`, "utf8");
  }

  /** Marks a history reset (/clear, /compact); messages before it are dropped on load. */
  async reset(): Promise<void> {
    await fs.appendFile(this.file, `${JSON.stringify({ type: "reset" })}
`, "utf8");
  }

  static async load(id: string): Promise<{ meta: SessionMeta; messages: ChatMessage[] }> {
    const file = path.join(getConfigHome(), "sessions", `${id}.jsonl`);
    const lines = (await fs.readFile(file, "utf8")).split(/\r?\n/).filter(Boolean);
    const meta = JSON.parse(lines.shift() || "null") as SessionMeta;
    let messages: ChatMessage[] = [];
    for (const line of lines) {
      const parsed = JSON.parse(line) as ChatMessage | { type: "reset" };
      if ("type" in parsed && parsed.type === "reset") messages = [];
      else messages.push(parsed as ChatMessage);
    }
    return { meta, messages };
  }

  static async list(limit = 20): Promise<SessionSummary[]> {
    const directory = path.join(getConfigHome(), "sessions");
    let files: string[];
    try { files = await fs.readdir(directory); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
    const entries = await Promise.all(files.filter((file) => file.endsWith(".jsonl")).map(async (file) => {
      const fullPath = path.join(directory, file);
      const [stat, firstLine] = await Promise.all([fs.stat(fullPath), fs.readFile(fullPath, "utf8").then((text) => text.split(/\r?\n/).filter(Boolean).slice(1).find((line) => {
        try { return (JSON.parse(line) as ChatMessage).role === "user"; } catch { return false; }
      }))]);
      let firstUserMessage = "";
      if (firstLine) { const msg = JSON.parse(firstLine) as ChatMessage; firstUserMessage = typeof msg.content === "string" ? msg.content : ""; }
      return { id: file.slice(0, -6), mtime: stat.mtime, firstUserMessage };
    }));
    return entries.sort((a, b) => b.mtime.getTime() - a.mtime.getTime()).slice(0, Math.max(0, limit));
  }
}

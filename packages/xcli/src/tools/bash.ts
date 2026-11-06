import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Tool } from "../types.js";

const execFileAsync = promisify(execFile);
const MAX_OUTPUT = 30000;
function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT) return text;
  const half = Math.floor((MAX_OUTPUT - 64) / 2);
  return `${text.slice(0, half)}\n... output truncated ...\n${text.slice(-half)}`;
}

export const bashTool: Tool = {
  name: "Bash",
  description: "Run a shell command in the project directory.",
  parameters: { type: "object", properties: { command: { type: "string" }, timeout_ms: { type: "number" } }, required: ["command"], additionalProperties: false },
  readOnly: false,
  async run(args, ctx) {
    if (typeof args.command !== "string") throw new Error("Bash: command is required.");
    const timeout = Math.min(600000, Math.max(1, Math.floor(typeof args.timeout_ms === "number" ? args.timeout_ms : 120000)));
    let executable: string;
    let argv: string[];
    if (process.platform === "win32") {
      let pwsh = false;
      try { await execFileAsync("pwsh", ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], { windowsHide: true }); pwsh = true; } catch { /* use Windows PowerShell */ }
      executable = pwsh ? "pwsh" : "powershell.exe";
      argv = ["-NoProfile", "-NonInteractive", "-Command", args.command];
    } else { executable = "bash"; argv = ["-lc", args.command]; }
    return await new Promise<string>((resolve, reject) => {
      const child = spawn(executable, argv, { cwd: ctx.cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      let output = "";
      let settled = false;
      let timedOut = false;
      let terminating = false;
      let termination: Promise<void> = Promise.resolve();
      const append = (chunk: Buffer) => { output += chunk.toString(); if (output.length > MAX_OUTPUT * 3) output = output.slice(0, MAX_OUTPUT * 2) + output.slice(-MAX_OUTPUT); };
      child.stdout.on("data", append); child.stderr.on("data", append);
      const kill = () => {
        if (terminating || settled) return;
        terminating = true;
        if (process.platform === "win32" && child.pid) {
          termination = new Promise<void>((resolve) => {
            const killer = spawn("taskkill", ["/T", "/F", "/PID", String(child.pid)], { windowsHide: true, stdio: "ignore" });
            killer.once("error", () => resolve());
            killer.once("close", () => resolve());
          });
        } else child.kill("SIGKILL");
      };
      const timer = setTimeout(() => { if (!settled && !terminating) { timedOut = true; kill(); } }, timeout);
      const onAbort = () => { if (!settled) kill(); };
      ctx.signal.addEventListener("abort", onAbort, { once: true });
      if (ctx.signal.aborted) onAbort();
      child.on("error", (error) => { if (!settled) { settled = true; clearTimeout(timer); ctx.signal.removeEventListener("abort", onAbort); reject(error); } });
      child.on("close", async (code, signal) => {
        if (settled) return;
        settled = true; clearTimeout(timer); ctx.signal.removeEventListener("abort", onAbort);
        await termination;
        if (timedOut) { resolve(`${truncate(output)}\nCommand timed out after ${timeout} ms (exit code ${code ?? "unknown"}).`); return; }
        if (ctx.signal.aborted) { resolve(`${truncate(output)}\nCommand aborted (exit code ${code ?? "unknown"}).`); return; }
        resolve(`${truncate(output)}\n[exit code ${code ?? signal ?? "unknown"}]`);
      });
    });
  },
};

import type { Tool } from "../types.js";
import { readTool } from "./read.js";
import { writeTool } from "./write.js";
import { editTool } from "./edit.js";
import { globTool } from "./glob.js";
import { grepTool } from "./grep.js";
import { bashTool } from "./bash.js";
import { webFetchTool } from "./webfetch.js";
import { webSearchTool } from "./websearch.js";

export function getTools(opts: { web: boolean }): Tool[] {
  const tools = [readTool, writeTool, editTool, globTool, grepTool, bashTool];
  return opts.web ? [...tools, webFetchTool, webSearchTool] : tools;
}

export function toolByName(tools: Tool[], name: string): Tool | undefined {
  return tools.find((tool) => tool.name === name);
}

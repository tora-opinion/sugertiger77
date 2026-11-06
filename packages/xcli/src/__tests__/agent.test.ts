import assert from "node:assert/strict";
import test from "node:test";
import type OpenAI from "openai";
import { Agent } from "../agent.js";

test("Agent keeps conversation messages across run calls", async () => {
  const previousKey = process.env.XCLI_TEST_KEY;
  process.env.XCLI_TEST_KEY = "test";
  const requests: Array<{ messages: unknown[] }> = [];
  let responseNumber = 0;
  const fakeClient = {
    chat: { completions: { create: async (request: { messages: unknown[] }) => {
      requests.push(request);
      const content = `answer-${++responseNumber}`;
      return (async function* () {
        yield { choices: [{ delta: { content }, index: 0, finish_reason: "stop" }], usage: null };
        yield { choices: [], usage: { prompt_tokens: 10, completion_tokens: 2 } };
      })();
    } } },
  } as unknown as OpenAI;
  try {
    const agent = new Agent({
      cfg: { baseURL: "https://example.test/v1", apiKeyEnv: "XCLI_TEST_KEY", defaultModel: "test-model", models: [], maxTurns: 3, web: false },
      model: "test-model", cwd: process.cwd(), tools: [], askPermission: async () => true,
      onEvent: () => undefined, clientFactory: () => fakeClient,
    });
    await agent.run("first question", new AbortController().signal);
    await agent.run("second question", new AbortController().signal);
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[1]!.messages.slice(1, 4), [
      { role: "user", content: "first question" },
      { role: "assistant", content: "answer-1" },
      { role: "user", content: "second question" },
    ]);
  } finally {
    if (previousKey === undefined) delete process.env.XCLI_TEST_KEY;
    else process.env.XCLI_TEST_KEY = previousKey;
  }
});

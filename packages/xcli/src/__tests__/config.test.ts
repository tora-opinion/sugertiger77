import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { addModel, loadConfig, removeModel, resolveModel } from "../config.js";

test("resolveModel resolves aliases and passes unknown model ids through", () => {
  const cfg = { baseURL: "", apiKeyEnv: "", defaultModel: "", models: [{ id: "vendor/model", alias: "short" }], maxTurns: 1, web: true };
  assert.deepEqual(resolveModel(cfg, "short"), { id: "vendor/model", entry: cfg.models[0], registered: true });
  assert.deepEqual(resolveModel(cfg, "future-model-code"), { id: "future-model-code", registered: false });
});

test("addModel upserts by id and rejects aliases owned by another model", () => {
  const cfg = { baseURL: "", apiKeyEnv: "", defaultModel: "", models: [{ id: "one", alias: "first" }], maxTurns: 1, web: true };
  const updated = addModel(cfg, { id: "one", alias: "renamed" });
  assert.equal(updated.models.length, 1);
  assert.equal(updated.models[0]?.alias, "renamed");
  assert.throws(() => addModel(updated, { id: "two", alias: "renamed" }), /別名/);
});

test("removeModel accepts id or alias", () => {
  const cfg = { baseURL: "", apiKeyEnv: "", defaultModel: "", models: [{ id: "one", alias: "first" }], maxTurns: 1, web: true };
  assert.equal(removeModel(cfg, "first"), true);
  assert.equal(cfg.models.length, 0);
  assert.equal(removeModel(cfg, "missing"), false);
});

test("loadConfig applies defaults and environment overrides in XCLI_HOME", async () => {
  const previous = { home: process.env.XCLI_HOME, model: process.env.XCLI_MODEL, base: process.env.XCLI_BASE_URL };
  const home = await mkdtemp(path.join(os.tmpdir(), "xcli-config-"));
  try {
    process.env.XCLI_HOME = home; process.env.XCLI_MODEL = "override-model"; process.env.XCLI_BASE_URL = "https://gateway.example/v1";
    const cfg = await loadConfig();
    assert.equal(cfg.defaultModel, "override-model");
    assert.equal(cfg.baseURL, "https://gateway.example/v1");
    assert.equal(cfg.apiKeyEnv, "EXPLABS_API_KEY");
    assert.deepEqual(cfg.models, []);
  } finally {
    if (previous.home === undefined) delete process.env.XCLI_HOME; else process.env.XCLI_HOME = previous.home;
    if (previous.model === undefined) delete process.env.XCLI_MODEL; else process.env.XCLI_MODEL = previous.model;
    if (previous.base === undefined) delete process.env.XCLI_BASE_URL; else process.env.XCLI_BASE_URL = previous.base;
    await rm(home, { recursive: true, force: true });
  }
});

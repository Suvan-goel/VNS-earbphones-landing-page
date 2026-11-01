const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const source = fs.readFileSync(path.join(__dirname, "../src/lib/scene-health.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);
const { sceneRecoveryReason, loadingBudgetMs } = context.exports;

test("a loaded scene is recovered if a requested frame is never drawn", () => {
  const health = { lastDrawAt: 1000, loadingSince: 0, ready: true, pendingSince: 1000 };
  assert.equal(sceneRecoveryReason(health, 2000, true), null);
  assert.equal(sceneRecoveryReason(health, 4100, true), "stalled");
});

test("a quiet scene that nothing has asked to redraw is healthy", () => {
  const health = { lastDrawAt: 1000, loadingSince: 0, ready: true, pendingSince: null };
  assert.equal(sceneRecoveryReason(health, 60000, true), null);
});

test("a paused or background scene must not be restarted", () => {
  assert.equal(sceneRecoveryReason({ lastDrawAt: 0, loadingSince: 0, ready: false, pendingSince: 0 }, 90000, false), null);
});

test("an active renderer cannot hide an indefinitely pending asset load", () => {
  const health = { lastDrawAt: 30950, loadingSince: 0, ready: false, pendingSince: null };
  assert.equal(sceneRecoveryReason(health, 31000, true), "loading");
  health.ready = true;
  assert.equal(sceneRecoveryReason(health, 31000, true), null);
});

test("returning from a pause gets a fresh grace period", () => {
  assert.equal(sceneRecoveryReason({ lastDrawAt: 90000, loadingSince: 90000, ready: false, pendingSince: 90000 }, 90100, true), null);
});

test("the initial load has extra time for decoding and shader compilation", () => {
  const health = { lastDrawAt: 0, loadingSince: 0, ready: false, pendingSince: 0 };
  assert.equal(sceneRecoveryReason(health, 8000, true), null);
  assert.equal(sceneRecoveryReason(health, 11000, true), "stalled");
  assert.equal(sceneRecoveryReason(health, 31000, true), "loading");
});

test("a slow connection gets a longer loading allowance", () => {
  assert.equal(loadingBudgetMs(null), 30000);
  assert.equal(loadingBudgetMs(10), 30000);
  assert.equal(loadingBudgetMs(1.5), 90000);
  const health = { lastDrawAt: 0, loadingSince: 0, ready: false, pendingSince: null };
  assert.equal(sceneRecoveryReason(health, 31000, true, loadingBudgetMs(1.5)), null);
  assert.equal(sceneRecoveryReason(health, 91000, true, loadingBudgetMs(1.5)), "loading");
});

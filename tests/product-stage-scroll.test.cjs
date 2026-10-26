const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/product-stage-scroll.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleContext = { exports: {} };
vm.runInNewContext(compiled, moduleContext);
const { productStageProgress, readProductStageProgress } = moduleContext.exports;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test("a late scene reads the restored page position without a scroll event", () => {
  const stage = { clientHeight: 900 };
  const track = { getBoundingClientRect: () => ({ top: -2667.6 }) };
  near(readProductStageProgress(track, stage), 0.57);
});

test("native scrolling and responsive size changes are sampled afresh", () => {
  let top = 0;
  const track = { getBoundingClientRect: () => ({ top }) };
  const stage = { clientHeight: 900 };
  near(readProductStageProgress(track, stage), 0);
  top = -2667.6;
  near(readProductStageProgress(track, stage), 0.57);
  stage.clientHeight = 720;
  near(readProductStageProgress(track, stage), 0.7125);
  top = 0;
  near(readProductStageProgress(track, stage), 0);
});

test("hidden or unmounted layouts cannot create bogus progress", () => {
  const track = { getBoundingClientRect: () => ({ top: -2000 }) };
  assert.equal(readProductStageProgress(track, { clientHeight: 0 }), null);
  assert.equal(readProductStageProgress(null, { clientHeight: 900 }), null);
  assert.equal(readProductStageProgress(track, null), null);
});

test("the existing portrait entry holds the model, then resumes the closing chapter", () => {
  near(productStageProgress(4.42), 0.85);
  near(productStageProgress(4.92), 0.85);
  near(productStageProgress(5.42), 0.85);
  near(productStageProgress(5.68), 0.9);
  near(productStageProgress(6.2), 1);
  near(productStageProgress(10), 1);
  near(productStageProgress(-2), 0);
});

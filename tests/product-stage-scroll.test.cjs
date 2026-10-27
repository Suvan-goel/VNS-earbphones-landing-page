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
const {
  STORY_SCROLL_SCREENS,
  PORTRAIT_ENTRY_START,
  MODEL_SCROLL_SCREENS,
  CLOSING_SCROLL_SCREENS,
  productStageProgress,
  measuredProductStageProgress,
  readProductStageProgress,
} = moduleContext.exports;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test("cached layout follows native restored scroll, resize and reverse scrolling", () => {
  // No Motion scroll event is needed after mounting midway through the story.
  near(measuredProductStageProgress(2787.6, 120, 900), 0.57);
  near(measuredProductStageProgress(2787.6, 120, 720), 0.7125);
  near(measuredProductStageProgress(120, 120, 720), 0);
  near(measuredProductStageProgress(10000, 120, 720), 0.85);
  near(measuredProductStageProgress(0, 120, 720), 0);
});

test("unmeasured and hidden cached layouts defer to the source value", () => {
  for (const height of [0, 1, -1, NaN, Infinity]) {
    assert.equal(measuredProductStageProgress(2000, 0, height), null);
  }
  assert.equal(measuredProductStageProgress(2000, NaN, 720), null);
});

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

test("the two pinned tracks retain the original model and closing scroll distances", () => {
  near(MODEL_SCROLL_SCREENS, 4.42);
  near(CLOSING_SCROLL_SCREENS, 0.78);
  near(MODEL_SCROLL_SCREENS + CLOSING_SCROLL_SCREENS, STORY_SCROLL_SCREENS);
  near(MODEL_SCROLL_SCREENS / STORY_SCROLL_SCREENS, PORTRAIT_ENTRY_START);
});

test("the original story timing is unchanged throughout the model track", () => {
  for (const [distance, progress] of [[0, 0], [1.3, 0.25], [2.6, 0.5], [3.9, 0.75], [4.42, 0.85]]) {
    near(productStageProgress(distance), progress);
  }
});

test("the model holds its final pose after its track regardless of later page length", () => {
  for (const distance of [4.42, 4.92, 5.42, 7.68, 8.2, 10, 100]) {
    near(productStageProgress(distance), 0.85);
  }
});

test("restoring below the model clamps its pose and resizing samples the new geometry", () => {
  const stage = { clientHeight: 800 };
  let top = -6 * stage.clientHeight;
  const track = { getBoundingClientRect: () => ({ top }) };
  near(readProductStageProgress(track, stage), 0.85);
  stage.clientHeight = 1000;
  near(readProductStageProgress(track, stage), 0.85);
  top = -3.9 * stage.clientHeight;
  near(readProductStageProgress(track, stage), 0.75);
  stage.clientHeight = 1200;
  near(readProductStageProgress(track, stage), 0.625);
});

test("scrolling back from later sections restores every model pose without retained state", () => {
  const distances = [0, 1.3, 2.6, 3.9, 4.42, 5.42, 8.2];
  const forward = distances.map((distance) => productStageProgress(distance));
  for (let index = distances.length - 1; index >= 0; index -= 1) {
    near(productStageProgress(distances[index]), forward[index]);
  }
});

test("invalid scroll distances leave the initial story visible", () => {
  for (const distance of [-1, NaN, Infinity, -Infinity]) {
    near(productStageProgress(distance), 0);
  }
});

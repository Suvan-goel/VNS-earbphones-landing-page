const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } = require("next/constants");

function loadConfig(reservations = false) {
  const source = fs.readFileSync(path.join(__dirname, "../next.config.ts"), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const context = { exports: {}, require, process: { env: { RESERVATIONS_LOCAL_TEST: String(reservations) } } };
  vm.runInNewContext(compiled, context);
  return context.exports.default;
}

test("production builds cannot overwrite a running preview's files", () => {
  const config = loadConfig();
  assert.equal(config(PHASE_DEVELOPMENT_SERVER).distDir, ".next-dev");
  assert.equal(config(PHASE_PRODUCTION_BUILD).distDir, ".next");
  assert.equal(config(PHASE_PRODUCTION_SERVER).distDir, ".next");
  assert.equal(loadConfig(true)(PHASE_DEVELOPMENT_SERVER).distDir, ".next-reservations");
});

test("preview watchers ignore all generated builds but keep watching source files", () => {
  const config = loadConfig()(PHASE_DEVELOPMENT_SERVER);
  const ignored = config.webpack({ watchOptions: {} }).watchOptions.ignored;
  for (const dir of [".next", ".next-dev", ".next-reservations"])
    assert.ok(ignored.test(`/project/${dir}/server/app/page.js`));
  assert.equal(ignored.test("/project/src/components/ProductStage.tsx"), false);
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

let THREE;
test.before(async () => { THREE = await import("three"); });
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/components/three/NeuralGlow.tsx"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

// Exercise the real pipeline setup and frame routing. Only GPU draw calls are
// recorded: Three's materials, uniforms and render targets are the real objects.
function mountGlow(t, mobile) {
  let frame, currentTarget = null, progressValue = 0;
  const calls = [], cleanups = [];
  const renderer = {
    capabilities: { maxSamples: 4 },
    getRenderTarget: () => currentTarget,
    setRenderTarget: (target) => { currentTarget = target; },
    clear() {},
    render: () => calls.push({ kind: "scene", target: currentTarget }),
  };
  class Quad {
    constructor(material) { this.material = material; }
    render() { calls.push({ kind: "quad", material: this.material, target: currentTarget }); }
    dispose() {}
  }
  const modules = {
    react: {
      useMemo: (fn) => fn(), useRef: (current) => ({ current }),
      useEffect: (fn) => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); },
    },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
    "@react-three/fiber": {
      useThree: () => ({ gl: renderer, size: { width: 390, height: 400 }, viewport: { dpr: 2 } }),
      useFrame: (fn) => { frame = fn; },
    },
    three: THREE,
    "three/addons/postprocessing/Pass.js": { FullScreenQuad: Quad },
    "./sceneQuality": { useSceneQuality: () => ({ mobile }) },
  };
  const context = { exports: {}, require: (name) => {
    assert.ok(name in modules, `Unexpected dependency: ${name}`);
    return modules[name];
  } };
  vm.runInNewContext(compiled, context);
  const element = context.exports.NeuralGlow({ progress: { get: () => progressValue } });
  element.type(element.props);
  t.after(() => cleanups.forEach((cleanup) => cleanup()));
  return (value) => {
    progressValue = value; calls.length = 0;
    frame({ gl: renderer, scene: {}, camera: {} });
    assert.equal(currentTarget, null, "Each frame must restore the canvas destination");
    return calls.slice();
  };
}

for (const mobile of [false, true]) {
  test(`${mobile ? "mobile" : "desktop"}: the sculpture uses one colour pipeline across the glow boundary`, (t) => {
    const render = mountGlow(t, mobile);
    let beauty;
    for (const progress of [0, 0, 0, 0.41, 0.4599, 0.4601, 0.74, 0.4601, 0.4599, 0.42, 0.28, 0]) {
      const calls = render(progress);
      const scene = calls.find((call) => call.kind === "scene");
      assert.ok(scene.target?.isWebGLRenderTarget, "Bypassing the linear scene buffer changes transparent surface brightness");
      beauty ??= scene.target;
      assert.equal(scene.target, beauty);
      assert.equal(calls.at(-1).kind, "quad", "Every visible frame must use the same final colour/alpha conversion");
      assert.equal(calls.at(-1).target, null);
    }
  });

  test(`${mobile ? "mobile" : "desktop"}: the halo fades continuously and stale buffers cannot flash on exit`, (t) => {
    const render = mountGlow(t, mobile);
    for (let i = 0; i < 4; i++) render(0);
    let previous = 0;
    for (let step = 0; step <= 100; step++) {
      const calls = render(0.4 + step * 0.0012);
      const strength = calls.at(-1).material.uniforms.glowStrength.value;
      assert.ok(strength >= previous && strength - previous < 0.04);
      previous = strength;
    }
    assert.equal(previous, 1);
    const idle = render(0.28);
    assert.equal(idle.at(-1).material.uniforms.glowStrength.value, 0, "Previously rendered glow must contribute nothing before the reveal");
    assert.equal(idle.filter((call) => call.kind === "quad").length, 1, "Skip extraction and blur when no glow is visible");
  });
}

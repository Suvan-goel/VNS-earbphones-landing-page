const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

let THREE;
test.before(async () => { THREE = await import("three"); });

const source = fs.readFileSync(path.join(__dirname, "../src/components/three/Mannequin.tsx"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

const motionValue = (value) => ({ get: () => value, set: (next) => { value = next; } });
const geometrySnapshot = (geometry) => ({
  indices: geometry.index && Array.from(geometry.index.array),
  attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name, Array.from(attribute.array)])),
});

function compileMaterial(mesh, basic = false) {
  const base = basic ? THREE.ShaderLib.basic : THREE.ShaderLib.standard;
  const shader = {
    uniforms: THREE.UniformsUtils.clone(base.uniforms),
    vertexShader: base.vertexShader,
    fragmentShader: base.fragmentShader,
  };
  mesh.material.onBeforeCompile(shader);
  return shader;
}

// Exercise the actual material preparation and frame callback with real Three
// objects. React/R3F hooks are the boundary; no GPU renderer is simulated.
function mountMannequin(t, mobile, reduce = true, cachedFibres = false) {
  const stone = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  stone.name = "Cymba_Marble_Mannequin";
  const brain = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), new THREE.MeshStandardMaterial());
  brain.name = "Cortical_Brain";
  const stem = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial());
  stem.name = "Brainstem";
  const arbors = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.001, 0.6, 5, 12), new THREE.MeshStandardMaterial());
  arbors.name = "Cortical_Neural_Arbors";
  const input = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.003, 0.8, 5, 16), new THREE.MeshStandardMaterial());
  input.name = "Ear_to_Cortex_Signal";
  const scene = new THREE.Group();
  scene.add(stone, brain, stem, arbors, input);
  if (cachedFibres) {
    const fibres = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1, 6, 3, true), new THREE.MeshStandardMaterial());
    fibres.name = "Internal_Neural_Fibres";
    scene.add(fibres);
  }
  const originals = scene.children.map((mesh) => ({ mesh, geometry: geometrySnapshot(mesh.geometry) }));
  const timers = new Map();
  let timerId = 0;
  const listeners = new Set();
  const preference = { matches: reduce, addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn) };
  const maps = [], cleanups = [], frames = [];
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react: {
      useMemo: (prepare) => prepare(),
      useRef: (current) => ({ current }),
      useEffect: (effect) => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@react-three/drei": {
      useGLTF: () => ({ scene }),
      useTexture: (urls) => Object.fromEntries(Object.keys(urls).map((key) => {
        const texture = new THREE.Texture();
        maps.push(texture);
        return [key, texture];
      })),
    },
    "@react-three/fiber": { useFrame: (frame) => frames.push(frame) },
    three: THREE,
    "./productAssets": {},
    "./sceneQuality": { useSceneQuality: () => ({ mobile }) },
  };
  const context = {
    exports: {},
    require: (name) => { assert.ok(name in modules, `Unexpected dependency: ${name}`); return modules[name]; },
    document: { createElement: () => ({ getContext: () => null }) },
    window: { matchMedia: () => preference },
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
  };
  vm.runInNewContext(compiled, context, { filename: "Mannequin.tsx" });
  const reveal = motionValue(1), stimulation = motionValue(0), stimulationVisibility = motionValue(1);
  const element = context.exports.Mannequin({ reveal, stimulation, stimulationVisibility });
  const root = new THREE.Group();
  element.props.ref.current = root;
  const model = element.props.children.find((child) => child.type === "primitive").props.object;
  const preparedBrain = model.getObjectByName(brain.name);
  const shader = compileMaterial(preparedBrain);
  const nerves = model.getObjectByName(arbors.name), nerveShader = compileMaterial(nerves);
  assert.equal(frames.length, 1);
  let requested = 0;
  const state = { gl: { shadowMap: { needsUpdate: false } }, clock: { elapsedTime: 0 }, invalidate: () => { requested++; } };
  function step(delta = 1 / 60) {
    requested = 0;
    state.clock.elapsedTime += delta;
    frames[0](state, delta);
    return requested;
  }
  function settle() {
    for (let count = 0; count < 240; count++) if (step() === 0) return count + 1;
    assert.fail("The signal continued requesting frames after four seconds at a fixed target");
  }
  t.after(() => {
    cleanups.forEach((cleanup) => cleanup());
    originals.forEach(({ mesh }) => { mesh.geometry.dispose(); mesh.material.dispose(); });
    assert.equal(timers.size, 0, "Unmount must clear animation timers");
    assert.equal(listeners.size, 0, "Unmount must release motion preferences");
    maps.forEach((texture) => texture.dispose());
  });
  return {
    reveal, stimulation, stimulationVisibility, root, model, shader, step, settle, originals,
    brain: preparedBrain, stem: model.getObjectByName(stem.name), nerves, nerveShader, input: model.getObjectByName(input.name), surface: model.getObjectByName(stone.name), depth: model.getObjectByName(`${stone.name}_RevealDepth`),
    timers, setReduced: (value) => { preference.matches = value; listeners.forEach((fn) => fn()); },
    fireTimer: () => { const [id, timer] = timers.entries().next().value; timers.delete(id); timer.callback(); return requested; },
  };
}

for (const mobile of [false, true]) {
  const device = mobile ? "mobile" : "desktop";

  test(`${device}: the brainstem shares the reveal and stays behind internal signals`, (t) => {
    const scene = mountMannequin(t, mobile);
    const shader = compileMaterial(scene.stem);
    assert.equal(shader.uniforms.skullReveal, scene.shader.uniforms.skullReveal);
    assert.equal(shader.uniforms.pulseTime, scene.shader.uniforms.pulseTime);
    assert.equal(scene.stem.material.depthWrite, true, "The brainstem must occlude nerves on its far side");
    assert.ok(scene.stem.renderOrder < scene.input.renderOrder);
    assert.ok(scene.stem.renderOrder < scene.surface.renderOrder);
    for (const target of [0, 0.3, 1, 0.4, 0]) {
      scene.stimulation.set(target); scene.settle();
      assert.equal(scene.stem.visible, scene.brain.visible, "The brainstem must enter and leave with the brain");
    }
    scene.stimulation.set(1); scene.settle();
    scene.reveal.set(0.5); scene.step();
    assert.equal(scene.stem.visible, false, "No early brainstem flash through the fading head");
  });

  test(`${device}: the response waits for ear contact and replays from the source`, (t) => {
    const scene = mountMannequin(t, mobile, false);
    scene.stimulation.set(0.1); scene.settle();
    assert.equal(scene.input.visible, false, "No input cue before the earbuds seat");
    assert.equal(scene.nerveShader.uniforms.pulseTime.value, 0, "The response clock must wait for contact");
    scene.stimulation.set(1); scene.settle();
    assert.equal(scene.input.visible, true);
    const inputShader = compileMaterial(scene.input);
    const shellShader = compileMaterial(scene.surface);
    assert.equal(shellShader.uniforms.pulseTime, scene.nerveShader.uniforms.pulseTime, "The ear contact, under-skin glow and brain must follow one clock");
    assert.equal(shellShader.uniforms.neuralActivity, scene.nerveShader.uniforms.neuralActivity, "The skin light must stop with the neural response on rewind");
    assert.equal(inputShader.uniforms.pulseTime, scene.nerveShader.uniforms.pulseTime, "The source and brain must follow the same pulse");
    assert.ok(scene.input.renderOrder < scene.surface.renderOrder, "The head must cover the internal nerves until the shell becomes transparent");
    assert.equal(scene.input.material.depthTest, true, "The near side of the head must occlude the far input path");
    const before = scene.nerveShader.uniforms.pulseTime.value;
    scene.step(60);
    assert.ok(scene.nerveShader.uniforms.pulseTime.value - before < 0.04, "A background pause cannot skip the causal sequence");
    scene.stimulation.set(0); scene.step();
    assert.equal(scene.input.visible, false);
    assert.equal(scene.nerveShader.uniforms.pulseTime.value, 0, "Rewind must reset the response rather than keep an arbitrary phase");
    scene.stimulation.set(1);
    for(let frame=0;frame<3;frame++) scene.step();
    assert.ok(scene.nerveShader.uniforms.pulseTime.value < 0.04, "Re-entry starts at the ear source");
  });

  test(`${device}: a gradual rewind closes the crown without a final snap`, (t) => {
    const scene = mountMannequin(t, mobile);
    scene.stimulation.set(1);
    scene.settle();
    let previous = 1;
    for (let frame = 1; frame <= 120; frame++) {
      const target = 1 - frame / 120;
      scene.stimulation.set(target);
      scene.step();
      const opening = scene.shader.uniforms.skullReveal.value;
      assert.ok(opening <= previous, "Rewinding cannot brighten the brain");
      assert.ok(previous - opening < 0.02, `The crown snapped closed at frame ${frame}: ${previous} to ${opening}`);
      previous = opening;
    }
    assert.equal(previous, 0);
    assert.equal(scene.brain.visible, false);
  });

  test(`${device}: returning to the entrance cannot flash the previously revealed brain`, (t) => {
    const scene = mountMannequin(t, mobile, false);
    for (const visibility of [0, 0.15, 0.5, 1]) {
      scene.reveal.set(visibility);
      scene.step();
      assert.equal(scene.brain.visible, false, "A fresh entrance must keep the brain hidden");
      assert.equal(scene.nerves.visible, false, "A fresh entrance must keep every strand hidden");
    }
    for (const delta of [1 / 60, 60]) {
      scene.reveal.set(1);
      scene.stimulation.set(1);
      scene.settle();
      assert.equal(scene.brain.visible, true);
      scene.stimulation.set(0);
      scene.reveal.set(0.5);
      assert.equal(scene.step(delta), 0, "The entrance must not keep a stale reveal animating");
      assert.equal(scene.brain.visible, false, "Hide the brain on the first frame back at the entrance");
      assert.equal(scene.nerves.visible, false, "Do not leave luminous strands behind during rewind");
      assert.equal(scene.shader.uniforms.skullReveal.value, 0, "Restore the opaque crown immediately");
      assert.equal(scene.shader.uniforms.neuralActivity.value, 0);
      assert.equal(scene.timers.size, 0, "Cancel the old brain shimmer");
      scene.reveal.set(1);
      scene.step();
      assert.equal(scene.brain.visible, false, "Finishing the head fade cannot reveal the brain early");
      scene.stimulation.set(0.1);
      scene.step();
      assert.ok(scene.shader.uniforms.skullReveal.value > 0);
      assert.ok(scene.shader.uniforms.skullReveal.value < 0.1, "Re-enter the brain reveal from zero, not its previous pose");
    }
  });

  test(`${device}: a partially visible head cannot expose the cortex`, (t) => {
    const scene = mountMannequin(t, mobile);
    scene.stimulation.set(1);
    scene.settle();
    scene.reveal.set(0.5);
    assert.equal(scene.step(), 0);
    assert.equal(scene.brain.visible, false);
    assert.equal(scene.shader.uniforms.skullReveal.value, 0);
    assert.equal(scene.nerves.visible, false);
    scene.reveal.set(1);
    scene.step();
    assert.ok(scene.shader.uniforms.skullReveal.value < 0.08, "A remounted head starts its intended reveal smoothly");
  });

  test(`${device}: the skull opens ahead of the signals and reduced motion settles`, (t) => {
    const scene = mountMannequin(t, mobile);
    const checkpoints = [0.12, 0.25, 0.5, 0.75, 1];
    let previousOpening = 0;
    for (const target of checkpoints) {
      scene.stimulation.set(target);
      assert.ok(scene.step() > 0, "A changed target must continue its damped reveal");
      scene.settle();
      assert.equal(scene.shader.uniforms.neuralActivity.value, target);
      const opening = scene.shader.uniforms.skullReveal.value;
      if (target < 1) assert.ok(opening > target && opening < 1, "The skull should reveal more of the brain early, while continuing to open");
      else assert.equal(opening, 1, "The final transparency must stay unchanged");
      if (target === 0.5) assert.ok(opening >= 0.6 && opening <= 0.7, "By half signal strength, the skull should already be noticeably more transparent");
      assert.ok(opening > previousOpening, "The shell must continue revealing beyond the early activation stages");
      previousOpening = opening;
      assert.equal(scene.brain.visible, true);
      assert.equal(scene.timers.size, 0, "Reduced motion must not schedule idle frames");
      assert.equal(scene.step(60), 0, "A later incidental frame must not restart idle animation");
    }
  });

  test(`${device}: opening fades smoothly and reverse scrolling cannot retain excess transparency`, (t) => {
    const scene = mountMannequin(t, mobile);
    scene.stimulation.set(1);
    let previous = 0;
    for (let frame = 0; frame < 60; frame++) {
      scene.step();
      const opening = scene.shader.uniforms.skullReveal.value;
      assert.ok(opening >= previous, "Opening must be monotonic at a fixed target");
      assert.ok(opening - previous < 0.08, "A scroll jump must not create a visible one-frame opacity jump");
      if (frame === 5) assert.ok(opening < 0.42, "The earlier reveal should still fade smoothly over the first 100 ms");
      if (frame === 29) assert.ok(opening < 0.99, "The reveal must continue beyond the first half second");
      previous = opening;
    }
    scene.settle();
    assert.equal(scene.shader.uniforms.skullReveal.value, 1);
    scene.stimulation.set(0.25);
    scene.step(60);
    assert.ok(scene.shader.uniforms.skullReveal.value > 0.25 && scene.shader.uniforms.skullReveal.value < 0.4, "Closing must immediately follow the earlier reveal curve rather than retain its old transparency");
    previous = scene.shader.uniforms.skullReveal.value;
    for (let frame = 0; frame < 60; frame++) {
      scene.step();
      const opening = scene.shader.uniforms.skullReveal.value;
      assert.ok(opening <= previous, "Closing must be monotonic at a fixed target");
      assert.ok(previous - opening < 0.08, "Reverse scroll must also fade without an opacity jump");
      previous = opening;
    }
    scene.settle();
    assert.equal(scene.shader.uniforms.neuralActivity.value, 0.25);
    scene.stimulation.set(0);
    assert.equal(scene.step(), 0, "Leaving the reveal phase resets on the first frame");
    assert.equal(scene.shader.uniforms.neuralActivity.value, 0);
    assert.equal(scene.shader.uniforms.skullReveal.value, 0);
    assert.equal(scene.brain.visible, false);
    assert.equal(scene.step(), 0);
  });

  test(`${device}: hidden stimulation and a hidden sculpture stop drawing`, (t) => {
    const scene = mountMannequin(t, mobile, false);
    scene.stimulation.set(1);
    scene.settle();
    assert.equal(scene.timers.size, 1);
    scene.stimulationVisibility.set(0);
    assert.equal(scene.step(), 0);
    assert.equal(scene.brain.visible, false);
    assert.equal(scene.shader.uniforms.skullReveal.value, 0);
    assert.equal(scene.timers.size, 0);
    scene.stimulationVisibility.set(1);
    scene.reveal.set(0);
    assert.equal(scene.step(), 0);
    assert.equal(scene.root.visible, false);
    assert.equal(scene.brain.visible, false);
    assert.equal(scene.timers.size, 0);
    scene.reveal.set(1);
    assert.ok(scene.step() > 0, "Returning to the visible signal must finish its reveal");
    scene.settle();
    assert.equal(scene.root.visible, true);
    assert.equal(scene.brain.visible, true);
  });

  test(`${device}: the new arbors share the cortex reveal while obsolete overlays stay hidden`, (t) => {
    const scene = mountMannequin(t, mobile, true, true);
    const fibre = scene.model.getObjectByName("Internal_Neural_Fibres");
    for (const target of [0, 0.25, 1, 0.4, 0]) {
      scene.stimulation.set(target);
      scene.settle();
      assert.equal(fibre.visible, false, "The old asset's fibre overlay must never return during scrolling");
      assert.equal(scene.nerves.visible, scene.brain.visible, "Arbors must enter and leave with the cortex");
      assert.equal(scene.nerveShader.uniforms.neuralActivity.value, target);
    }
    assert.equal(scene.model.getObjectByName(`${fibre.name}_RevealDepth`), undefined, "Cached fibres must not create occluding depth meshes");
    assert.doesNotMatch(scene.shader.fragmentShader, /diffuseColor\.rgb\s*=\s*mix/, "The cortex must retain its neutral tissue between lit fibres");
    assert.equal(scene.nerves.material.depthTest, true, "Rear strands must be occluded by the actual brain");
    assert.equal(scene.nerves.material.depthWrite, false, "Fine translucent strands must not punch holes in the cortex");
    assert.ok(scene.nerves.renderOrder > scene.brain.renderOrder && scene.nerves.renderOrder < scene.surface.renderOrder);
    for (const { mesh, geometry } of scene.originals) {
      assert.deepEqual(geometrySnapshot(mesh.geometry), geometry, `${mesh.name} loader geometry must remain untouched`);
    }
  });
}

function resolveIncludes(shaderSource) {
  return shaderSource.replace(/#include <([\w_]+)>/g, (_, name) => {
    assert.ok(name in THREE.ShaderChunk, `Missing Three shader chunk: ${name}`);
    return resolveIncludes(THREE.ShaderChunk[name]);
  });
}

for (const mobile of [false, true]) {
  test(`${mobile ? "mobile" : "desktop"}: cortex, shell and fixed face guard link to installed Three shaders`, (t) => {
    const scene = mountMannequin(t, mobile);
    const { shader, nerveShader } = scene;
    const addedUniforms = Object.keys(shader.uniforms).filter((name) => !(name in THREE.ShaderLib.standard.uniforms));
    assert.deepEqual(addedUniforms, ["neuralActivity", "skullReveal", "pulseTime"]);
    for (const name of ["neuralActivity", "pulseTime"]) {
      assert.match(nerveShader.fragmentShader, new RegExp(`uniform\\s+float\\s+${name}\\s*;`));
      assert.ok(nerveShader.fragmentShader.match(new RegExp(`\\b${name}\\b`, "g")).length > 1, `${name} must reach the fibre shading code`);
    }
    for (const mesh of [scene.brain, scene.stem, scene.nerves, scene.input, scene.surface, scene.depth]) {
      const patch = mesh === scene.brain ? shader : compileMaterial(mesh, mesh === scene.depth);
      assert.equal(patch.uniforms.neuralActivity, shader.uniforms.neuralActivity, "All layers share the same activation value");
      assert.equal(patch.uniforms.skullReveal, shader.uniforms.skullReveal, "The shell and depth guard share the same reveal state");
      for (const code of [patch.vertexShader, patch.fragmentShader]) assert.doesNotMatch(resolveIncludes(code), /#include/);
      for (const [, type, name] of patch.fragmentShader.matchAll(/varying\s+(\w+)\s+(vSculpturePosition|vSulcus|vNeuralPath)\s*;/g)) {
        assert.match(patch.vertexShader, new RegExp(`varying\\s+${type}\\s+${name}\\s*;`), `${name} must link across shader stages`);
        assert.match(patch.vertexShader, new RegExp(`\\b${name}\\s*=`), `${name} needs a vertex value`);
      }
    }
    const shell = compileMaterial(scene.surface);
    assert.match(shell.fragmentShader, /diffuseColor\.a\s*\*=.*skullReveal/, "The continuous reveal must control the shell opacity");
    assert.doesNotMatch(shell.fragmentShader.match(/diffuseColor\.a\s*\*=([^;]+);/)[1], /underSkin|pulseTime|subdermal/, "Travelling light must not open another transparent window");
    const guard = compileMaterial(scene.depth, true);
    const discard = guard.fragmentShader.match(/if\s*\(([^;]+)\)\s*discard\s*;/);
    assert.ok(discard, "The face needs a spatial depth guard");
    assert.match(discard[1], /crownMask\(vSculpturePosition\)/);
    assert.doesNotMatch(discard[1], /neuralActivity|skullReveal|pulseTime/, "An animated depth cutoff would make the cortex pop in");
    assert.equal(scene.brain.material.depthWrite, true, "The cortex must occlude its far side");
    assert.equal(scene.surface.material.depthWrite, false, "The translucent shell must reveal the inner cortex");
    assert.equal(nerveShader.uniforms.pulseTime, shader.uniforms.pulseTime, "All fibre animation must honour reduced motion and scene suspension");
    assert.equal(scene.depth.material.colorWrite, false, "The face guard must not draw another coloured shell");
  });

  test(`${mobile ? "mobile" : "desktop"}: cortical motion schedules one capped frame and respects reduced motion`, (t) => {
    const scene = mountMannequin(t, mobile, false);
    scene.stimulation.set(1);
    scene.settle();
    assert.equal(scene.timers.size, 1);
    assert.ok([...scene.timers.values()][0].delay >= 1000 / 30);
    assert.ok(scene.fireTimer() > 0);
    scene.step(); scene.step();
    assert.equal(scene.timers.size, 1, "Scrolling cannot accumulate timer callbacks");
    const previousTime = scene.shader.uniforms.pulseTime.value;
    scene.step(0.1);
    assert.ok(scene.shader.uniforms.pulseTime.value > previousTime);
    scene.setReduced(true); scene.step();
    assert.equal(scene.timers.size, 0);
    assert.equal(scene.shader.uniforms.pulseTime.value, -1, "Reduced motion holds a steady response along the whole pathway");
    scene.setReduced(false); scene.step();
    assert.equal(scene.timers.size, 1, "Disabling reduced motion must resume one capped timer");
    scene.reveal.set(0); scene.step();
    assert.equal(scene.timers.size, 0);
    scene.reveal.set(1); scene.step();
    scene.stimulationVisibility.set(0); scene.step();
    assert.equal(scene.timers.size, 0);
    assert.equal(scene.brain.visible, false);
  });
}

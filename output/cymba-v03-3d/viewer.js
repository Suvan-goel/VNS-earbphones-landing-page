import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

const $ = id => document.getElementById(id);
const container = $('canvas-container');
const focusButtons = [...document.querySelectorAll('button[data-focus]')];
const angleButtons = [...document.querySelectorAll('[data-angle]')];
const views = {
  product: { title: 'CYMBA One', subtitle: 'Smoked graphite · Champagne · Silicone', number: '01 / Product', groups: ['Left earbud', 'Right earbud'], facts: [['Finish study', 'Smoked graphite / champagne'], ['Contacts', 'Separate stimulation / EEG'], ['Fit system', '5 tips · 3 fins']], footnote: 'Exterior and contact faces are shown together, with the tips inward. Select either earbud to inspect it from every side. Display posing leaves source dimensions unchanged.' },
  left: { title: 'Left earbud', subtitle: 'Contact surfaces & internal architecture', number: '02 / Anatomy', groups: ['Left earbud'], facts: [['Active electrode', '75.4 mm² nominal'], ['Return electrode', '100 mm² nominal'], ['Dimensional units', 'Millimetres']], footnote: 'Nominal contact areas follow the specification. Actual tissue contact depends on fit and compression.' },
  right: { title: 'Right earbud', subtitle: 'Mirrored hardware · shared DRL', number: '03 / Anatomy', groups: ['Right earbud'], facts: [['Active electrode', '75.4 mm² nominal'], ['Return electrode', '100 mm² nominal'], ['Default role', 'Sensing']], footnote: 'Both earbuds contain stimulation hardware. The right earbud defaults to sensing; the assembly shares one DRL reference.' },
  hub: { title: 'Control hub', subtitle: 'Enclosure, connections & electronics packaging', number: '04 / Architecture', groups: ['Hub'], facts: [['Nominal shell', '25 × 77 × 12 mm'], ['Dimensional units', 'Millimetres']], footnote: 'Internal placement is an engineering packaging proposal. Electronic parts represent spatial envelopes.' },
  system: { title: 'Complete system', subtitle: 'Bilateral earbuds, cable harness & control hub', number: '05 / System', groups: ['Left earbud', 'Right earbud', 'Hub', 'Cable', 'System'], facts: [['Earbud branches', '150 mm each'], ['Main cable', '1,000 mm'], ['Cable arrangement', 'Coiled for display']], footnote: 'Cable routing is posed for inspection. Specified lengths are preserved in the CAD construction.' },
  fit: { title: 'Fit kit', subtitle: 'Interchangeable fit components', number: '06 / Fit', groups: ['Fit kit'], facts: [['Tip sizes', '5'], ['Fin sizes', '3'], ['Dimensional units', 'Millimetres']], footnote: 'Fit variants are shown separately. Individual part notes distinguish specified sizes from assumed geometry.' },
  cable: { title: 'Cable cross section', subtitle: 'Conductor arrangement & shielding', number: '07 / Construction', groups: ['Cable section'], facts: [['Detail', 'Cable construction'], ['Dimensional units', 'Millimetres']], footnote: 'A short inspection sample illustrates cable structure. It is separate from the full cable harness.' }
};

let renderer, scene, camera, controls, model;
let parts = [], visibleParts = [], selected = null, focus = 'product';
const productLeads = [];
let showShells = true, explosion = 0, transition = null;
let viewAngle = 'exterior', finishTexture;
const basePositions = new Map();
const displayGroups = new Map();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const axes = ['x', 'y', 'z'].map((name, index) => ({ name, vector: new THREE.Vector3(index === 0 ? 1 : 0, index === 1 ? 1 : 0, index === 2 ? 1 : 0), line: $(`axis-${name}`), label: $(`axis-${name}-label`) }));
const inverseCamera = new THREE.Quaternion();
const axisVector = new THREE.Vector3();
let pointerStart;

function fail(message, error) {
  console.error(error || message);
  $('loading').classList.add('error');
  $('loading-text').textContent = message;
  $('loading-links').hidden = false;
  document.querySelectorAll('.focus-button,.controls button,.controls input').forEach(el => el.disabled = true);
}

function studioEnvironment() {
  const width = 1024, height = 512, data = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height;
    // A photographed-product lighting rig, built locally: large diffused key,
    // narrow edge light, soft overhead strip, and negative fill between them.
    const top = Math.max(0, 1 - v * 1.5);
    const softbox = 5.8 * Math.exp(-(((u - .23) / .105) ** 6 + ((v - .37) / .205) ** 6));
    const rim = 4.5 * Math.exp(-(((u - .72) / .035) ** 6 + ((v - .42) / .24) ** 6));
    const overhead = 1.7 * Math.exp(-(((u - .47) / .24) ** 6 + ((v - .18) / .075) ** 6));
    const light = .10 + top * .48 + softbox + rim + overhead;
    const offset = (y * width + x) * 4;
    data[offset] = light * 1.015; data[offset + 1] = light; data[offset + 2] = light * .975; data[offset + 3] = 1;
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromEquirectangular(texture).texture;
  texture.dispose(); generator.dispose();
  return environment;
}

function makeFinishTexture() {
  const size = 128, values = new Uint8Array(size * size * 4);
  let seed = 87017;
  for (let i = 0; i < size * size; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = 80 + ((seed >>> 24) * .38);
    values[i * 4] = values[i * 4 + 1] = values[i * 4 + 2] = value;
    values[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(values, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function finishMaterial(source, spec) {
  let finish = String(spec.material || source.name).toLowerCase();
  const isTip = finish === 'tip' || /removable silicone tip|fit kit.*\btip\b/i.test(spec.name);
  const isSmokedShell = finish === 'shell' && /inner housing shell/i.test(spec.name) && /earbud/i.test(spec.group);
  const isBraidedCable = Array.isArray(spec.cableCenterlineMm) && spec.cableCenterlineMm.length > 1 && Number(spec.cableRadiusMm) > 0;
  if (isTip) finish = 'tip';
  const settings = {
    shell: { color: '#303331', metalness: .06, roughness: .42, clearcoat: .12, clearcoatRoughness: .38 },
    face: { color: '#202224', metalness: .10, roughness: .52, clearcoat: .10, clearcoatRoughness: .42 },
    silicone: { color: '#202224', metalness: 0, roughness: .66, clearcoat: 0 },
    tip: { color: '#757679', metalness: 0, roughness: .48, clearcoat: .08, clearcoatRoughness: .5, transmission: .22, thickness: .0007, ior: 1.42, attenuationColor: '#939497', attenuationDistance: .002 },
    stim: { color: '#303331', metalness: .02, roughness: .61, clearcoat: 0 },
    stim_return: { color: '#bdb39c', metalness: .56, roughness: .43, clearcoat: .08 },
    eeg: { color: '#424746', metalness: .06, roughness: .54, clearcoat: 0 },
    gold: { color: '#c4b79f', metalness: .91, roughness: .25, clearcoat: .12, clearcoatRoughness: .2 },
    steel: { color: '#9da5a7', metalness: .87, roughness: .29 },
    glass: { color: '#172d28', metalness: .12, roughness: .13, clearcoat: 1, clearcoatRoughness: .08 },
    battery: { color: '#7a8184', metalness: .72, roughness: .37 },
    chip: { color: '#272d30', metalness: .08, roughness: .61 },
    pcb: { color: '#245b4d', metalness: .12, roughness: .56 }
  };
  const material = new THREE.MeshPhysicalMaterial();
  THREE.MeshStandardMaterial.prototype.copy.call(material, source);
  material.defines = { STANDARD: '', PHYSICAL: '' };
  if (settings[finish]) material.setValues(settings[finish]);
  if (isSmokedShell) material.setValues({ color: '#464741', metalness: .02, roughness: .29, clearcoat: .42, clearcoatRoughness: .21, transmission: .38, thickness: .0012, ior: 1.48, attenuationColor: '#716859', attenuationDistance: .0025 });
  if (isBraidedCable) material.setValues({ color: '#27292a', metalness: .02, roughness: .54, clearcoat: .08, clearcoatRoughness: .45 });
  // Physical transmission retains depth and the material's absorption. Alpha
  // transparency would expose every internal part and create sorting artifacts.
  material.opacity = 1;
  material.transparent = false;
  material.name = source.name;
  material.side = THREE.FrontSide;
  material.envMapIntensity = 1;
  material.userData.originalEmissive = material.emissive.clone();
  material.userData.originalEmissiveIntensity = material.emissiveIntensity;
  const isSoft = ['silicone', 'tip', 'stim', 'eeg'].includes(finish);
  const isCoated = ['shell', 'face'].includes(finish);
  if (isSoft || isCoated || finish === 'gold' || finish === 'stim_return') {
    // CAD tessellation has no UVs. Triplanar finish grain remains consistent in
    // true model millimetres, including in posed and exploded display views.
    material.onBeforeCompile = shader => {
      shader.uniforms.finishGrain = { value: finishTexture };
      shader.vertexShader = `varying vec3 vFinishPosition;\nvarying vec3 vFinishNormal;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFinishPosition = position;\nvFinishNormal = normal;');
      shader.fragmentShader = `uniform sampler2D finishGrain;\nvarying vec3 vFinishPosition;\nvarying vec3 vFinishNormal;\n${shader.fragmentShader}`
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          vec3 finishWeights = pow(abs(normalize(vFinishNormal)), vec3(4.0));
          finishWeights /= max(dot(finishWeights, vec3(1.0)), 0.001);
          vec3 finishPoint = vFinishPosition * ${isSoft ? '160.0' : '220.0'};
          float finishNoise = texture2D(finishGrain, finishPoint.yz).r * finishWeights.x
            + texture2D(finishGrain, finishPoint.xz).r * finishWeights.y
            + texture2D(finishGrain, finishPoint.xy).r * finishWeights.z;
          roughnessFactor = clamp(roughnessFactor + (finishNoise - 0.5) * ${isSoft ? '.12' : '.035'}, .04, 1.0);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          vec3 finishDx = dFdx(-vViewPosition), finishDy = dFdy(-vViewPosition);
          vec3 finishR1 = cross(finishDy, normal), finishR2 = cross(normal, finishDx);
          float finishDet = dot(finishDx, finishR1);
          vec3 finishGradient = sign(finishDet) * (dFdx(finishNoise) * finishR1 + dFdy(finishNoise) * finishR2);
          normal = normalize((abs(finishDet) + 1.0e-16) * normal - ${isSoft ? '.000008' : '.000003'} * finishGradient);`);
    };
    material.customProgramCacheKey = () => `cymba-finish-${finish}`;
  }
  if (isBraidedCable) applyCableBraid(material, spec);
  return material;
}

function applyCableBraid(material, spec) {
  const radiusMm = Number(spec.cableRadiusMm);
  const strandCount = Math.max(8, Math.min(32, Math.round(Math.PI * 2 * radiusMm / .55 / 2) * 2));
  material.onBeforeCompile = shader => {
    shader.vertexShader = `attribute vec3 braidCoord;\nvarying vec3 vBraidCoord;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBraidCoord = braidCoord;');
    shader.fragmentShader = `varying vec3 vBraidCoord;\n${shader.fragmentShader}`
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float braidTheta = atan(vBraidCoord.z, vBraidCoord.y);
        float braidDistance = vBraidCoord.x * 1000.0;
        float braidA = braidTheta * ${strandCount.toFixed(1)} + braidDistance * ${(strandCount / radiusMm).toFixed(5)};
        float braidB = braidTheta * ${strandCount.toFixed(1)} - braidDistance * ${(strandCount / radiusMm).toFixed(5)};
        float braidYarnA = pow(0.5 + 0.5 * cos(braidA), 1.7);
        float braidYarnB = pow(0.5 + 0.5 * cos(braidB), 1.7);
        float braidOver = mod(floor((braidA + 3.141593) / 6.283185) + floor((braidB + 3.141593) / 6.283185), 2.0);
        float braidHeight = max(braidYarnA * mix(1.0, 0.76, braidOver), braidYarnB * mix(0.76, 1.0, braidOver));
        float braidFibres = 0.5 + 0.5 * cos(mix(braidA, braidB, braidOver) * 5.0);
        braidHeight = braidHeight * (0.95 + 0.05 * braidFibres);
        diffuseColor.rgb *= 0.79 + 0.21 * braidHeight;
        roughnessFactor = clamp(roughnessFactor + 0.07 * (1.0 - braidHeight), 0.04, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 braidDx = dFdx(-vViewPosition);
        vec3 braidDy = dFdy(-vViewPosition);
        vec3 braidR1 = cross(braidDy, normal);
        vec3 braidR2 = cross(normal, braidDx);
        float braidDet = dot(braidDx, braidR1);
        vec3 braidGradient = sign(braidDet) * (dFdx(braidHeight) * braidR1 + dFdy(braidHeight) * braidR2);
        normal = normalize((abs(braidDet) + 1.0e-16) * normal - 0.000018 * braidGradient);`);
  };
  material.customProgramCacheKey = () => `cymba-braid-${strandCount}-${radiusMm}`;
}

function prepareCableBraid(mesh, spec) {
  if (!Array.isArray(spec.cableCenterlineMm) || spec.cableCenterlineMm.length < 2 || !(Number(spec.cableRadiusMm) > 0)) return;
  const points = spec.cableCenterlineMm.map(point => new THREE.Vector3(...point).multiplyScalar(.001));
  const segments = [], bins = new Map(), cellSize = Math.max(.004, Number(spec.cableRadiusMm) * .0025);
  const key = (x, y, z) => `${x},${y},${z}`;
  const previousTangent = new THREE.Vector3();
  const normal = new THREE.Vector3(0, 0, 1), rotation = new THREE.Quaternion();
  let arcLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const delta = points[i + 1].clone().sub(points[i]), length = delta.length();
    if (length < 1e-9) continue;
    const tangent = delta.clone().divideScalar(length);
    if (segments.length) normal.applyQuaternion(rotation.setFromUnitVectors(previousTangent, tangent));
    else if (Math.abs(normal.dot(tangent)) > .95) normal.set(0, 1, 0);
    normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
    const index = segments.length;
    segments.push({ start: points[i], delta, length, lengthSq: length * length, arcLength, normal: normal.clone(), binormal: new THREE.Vector3().crossVectors(tangent, normal).normalize() });
    const low = points[i].clone().min(points[i + 1]).divideScalar(cellSize).floor();
    const high = points[i].clone().max(points[i + 1]).divideScalar(cellSize).floor();
    for (let x = low.x; x <= high.x; x++) for (let y = low.y; y <= high.y; y++) for (let z = low.z; z <= high.z; z++) {
      const binKey = key(x, y, z);
      if (!bins.has(binKey)) bins.set(binKey, []);
      bins.get(binKey).push(index);
    }
    arcLength += length;
    previousTangent.copy(tangent);
  }
  if (!segments.length) return;
  const positions = mesh.geometry.getAttribute('position'), coords = new Float32Array(positions.count * 3);
  const point = new THREE.Vector3(), fromStart = new THREE.Vector3(), radial = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    const bx = Math.floor(point.x / cellSize), by = Math.floor(point.y / cellSize), bz = Math.floor(point.z / cellSize);
    const candidates = new Set();
    for (let x = bx - 1; x <= bx + 1; x++) for (let y = by - 1; y <= by + 1; y++) for (let z = bz - 1; z <= bz + 1; z++) {
      (bins.get(key(x, y, z)) || []).forEach(index => candidates.add(index));
    }
    let nearest = segments[0], nearestT = 0, nearestDistance = Infinity;
    const evaluate = index => {
      const segment = segments[index];
      fromStart.copy(point).sub(segment.start);
      const t = THREE.MathUtils.clamp(fromStart.dot(segment.delta) / segment.lengthSq, 0, 1);
      const distance = radial.copy(fromStart).addScaledVector(segment.delta, -t).lengthSq();
      if (distance < nearestDistance) { nearest = segment; nearestT = t; nearestDistance = distance; }
    };
    if (candidates.size) candidates.forEach(evaluate); else segments.forEach((_, index) => evaluate(index));
    radial.copy(point).sub(nearest.start).addScaledVector(nearest.delta, -nearestT).normalize();
    coords[i * 3] = nearest.arcLength + nearestT * nearest.length;
    coords[i * 3 + 1] = radial.dot(nearest.normal);
    coords[i * 3 + 2] = radial.dot(nearest.binormal);
  }
  mesh.geometry.setAttribute('braidCoord', new THREE.BufferAttribute(coords, 3));
}

function prepareDisplayGroups() {
  model.updateMatrixWorld(true);
  for (const groupName of ['Left earbud', 'Right earbud', 'Control hub']) {
    const meshes = parts.filter(mesh => groupName === 'Control hub' ? String(mesh.userData.spec.group).startsWith('Hub') : mesh.userData.spec.group === groupName);
    if (!meshes.length) continue;
    const bounds = new THREE.Box3();
    meshes.forEach(mesh => bounds.expandByObject(mesh));
    const center = bounds.getCenter(new THREE.Vector3());
    const group = new THREE.Group();
    group.name = `${groupName} display pose`;
    group.position.copy(center);
    model.add(group);
    group.updateMatrixWorld(true);
    meshes.forEach(mesh => {
      group.attach(mesh);
      basePositions.set(mesh.uuid, mesh.position.clone());
    });
    displayGroups.set(groupName, { group, center });
  }
}

function prepareProductLeads() {
  // Extend the branch beyond the close product framing, like the site images.
  // Only its first 22 mm affects framing; the rest crops at the stage edge.
  // These derived presentation meshes are not additional parts
  // and never replace the full, measured CAD cables in the System view.
  for (const [side, groupName] of [['L', 'Left earbud'], ['R', 'Right earbud']]) {
    const branch = parts.find(mesh => mesh.userData.spec.group === 'Cable' && mesh.userData.spec.name.startsWith(`${side} |`) && /branch cable/i.test(mesh.userData.spec.name));
    const display = displayGroups.get(groupName);
    if (!branch || !display) continue;
    const originalSpec = branch.userData.spec;
    if (!Array.isArray(originalSpec.cableCenterlineMm) || originalSpec.cableCenterlineMm.length < 2 || !(Number(originalSpec.cableRadiusMm) > 0)) continue;
    const points = [new THREE.Vector3(...originalSpec.cableCenterlineMm[0])];
    let remainingMm = 80;
    for (let i = 1; i < originalSpec.cableCenterlineMm.length && remainingMm > 0; i++) {
      const point = new THREE.Vector3(...originalSpec.cableCenterlineMm[i]);
      const previous = points[points.length - 1];
      const distance = previous.distanceTo(point);
      if (distance < 1e-8) continue;
      if (distance <= remainingMm) { points.push(point); remainingMm -= distance; }
      else { points.push(previous.clone().lerp(point, remainingMm / distance)); remainingMm = 0; }
    }
    if (points.length < 2) continue;
    const spec = { ...originalSpec, cableCenterlineMm: points.map(point => point.toArray()) };
    const curve = new THREE.CatmullRomCurve3(points.map(point => point.clone().multiplyScalar(.001)), false, 'centripetal');
    const geometry = new THREE.TubeGeometry(curve, 80, Number(spec.cableRadiusMm) * .001, 20, false);
    const sourceMaterial = Array.isArray(branch.material) ? branch.material[0] : branch.material;
    const lead = new THREE.Mesh(geometry, finishMaterial(sourceMaterial, spec));
    lead.name = `${side} | Product presentation — clipped branch lead`;
    lead.userData.presentationOnly = true;
    const frameBounds = new THREE.Box3().expandByPoint(points[0].clone().multiplyScalar(.001));
    let frameLength = 22;
    for (let i = 1; i < points.length && frameLength > 0; i++) {
      const distance = points[i - 1].distanceTo(points[i]);
      const end = points[i - 1].clone().lerp(points[i], Math.min(1, frameLength / distance));
      frameBounds.expandByPoint(end.multiplyScalar(.001));
      frameLength -= distance;
    }
    lead.userData.frameBounds = frameBounds.expandByScalar(Number(spec.cableRadiusMm) * .001);
    prepareCableBraid(lead, spec);
    lead.visible = false;
    model.add(lead);
    model.updateMatrixWorld(true);
    display.group.attach(lead);
    productLeads.push(lead);
  }
}

function updateProductLeadsVisibility() {
  productLeads.forEach(lead => { lead.visible = focus === 'product' && explosion === 0; });
}

function applyDisplayPose() {
  displayGroups.forEach(({ group, center }, name) => {
    group.position.copy(center);
    group.rotation.set(0, 0, 0);
    if (name === 'Control hub') {
      if (focus === 'hub') group.rotation.z = THREE.MathUtils.degToRad(-66);
    } else if (focus === 'product') {
      const left = name === 'Left earbud';
      group.position.set(left ? -.023 : .023, left ? .001 : -.001, 0);
      group.rotation.set(THREE.MathUtils.degToRad(-6), THREE.MathUtils.degToRad(left ? 130 : -18), THREE.MathUtils.degToRad(left ? -7 : 7));
    }
  });
  model.updateMatrixWorld(true);
}

function textValue(value) {
  if (Array.isArray(value)) return value.join('; ');
  if (value && typeof value === 'object') return Object.entries(value).map(([key, val]) => `${key}: ${val}`).join('; ');
  return value == null ? '' : String(value);
}

function metadata(mesh) {
  let meta = {}, current = mesh;
  const chain = [];
  while (current && current !== model?.parent) { chain.push(current); current = current.parent; }
  chain.reverse().forEach(node => Object.assign(meta, node.userData || {}));
  meta.name = meta.name || mesh.name || 'Unnamed component';
  meta.group = meta.group || inferGroup(meta.name);
  return meta;
}

function inferGroup(name) {
  if (/cross.section|cable.section/i.test(name)) return 'Cable section';
  if (/fit.kit|fit.variant|size.[sl]/i.test(name)) return 'Fit kit';
  if (/left|^L[_ -]/i.test(name)) return 'Left earbud';
  if (/right|^R[_ -]/i.test(name)) return 'Right earbud';
  if (/hub|battery|controller/i.test(name)) return 'Hub';
  if (/cable|wire|y.split/i.test(name)) return 'Cable';
  return 'System';
}

function isShell(mesh) {
  const meta = mesh.userData.spec;
  return /shell|housing|enclosure|faceplate|outer face|lid|rear cover|front cover/i.test(`${meta.name} ${meta.role} ${meta.material || ''}`);
}

function currentBox() {
  const box = new THREE.Box3();
  visibleParts.forEach(mesh => box.expandByObject(mesh));
  productLeads.forEach(lead => { if (lead.visible) box.union(lead.userData.frameBounds.clone().applyMatrix4(lead.matrixWorld)); });
  return box;
}

function measure(mesh) {
  return mesh.userData.sourceDimensions.clone();
}

function dimensions(size) {
  return [size.x, size.y, size.z].map(n => n >= 100 ? n.toFixed(0) : n.toFixed(1)).join(' × ');
}

function updateFacts() {
  const view = views[focus];
  const rows = view.facts.slice();
  if (visibleParts.length) {
    const size = currentBox().getSize(new THREE.Vector3()).multiplyScalar(1000);
    if (explosion === 0 && !['product', 'hub'].includes(focus)) rows.push(['Model envelope', `${dimensions(size)} mm`]);
    $('envelope').textContent = ['product', 'hub'].includes(focus) && explosion === 0 ? 'Posed arrangement · true-scale parts' : explosion > 0 ? 'Exploded layout · millimetres' : `${dimensions(size)} mm · model envelope`;
  }
  $('facts').replaceChildren(...rows.map(([label, value]) => {
    const row = document.createElement('div'); row.className = 'fact';
    const dt = document.createElement('dt'); dt.textContent = label;
    const dd = document.createElement('dd'); dd.textContent = value;
    row.append(dt, dd); return row;
  }));
  $('fact-footnote').textContent = view.footnote;
}

function updatePartList() {
  $('part-count').textContent = String(visibleParts.length).padStart(2, '0');
  const buttons = visibleParts.map(mesh => {
    const button = document.createElement('button');
    button.className = 'part-button';
    button.textContent = mesh.userData.spec.name;
    button.setAttribute('aria-pressed', String(selected === mesh));
    button.dataset.part = mesh.uuid;
    button.addEventListener('click', () => selectPart(mesh));
    return button;
  });
  $('part-list').replaceChildren(...buttons);
}

function clearSelection() {
  if (selected) {
    const materials = Array.isArray(selected.material) ? selected.material : [selected.material];
    materials.forEach(mat => {
      if (mat.userData.originalEmissive && mat.emissive) mat.emissive.copy(mat.userData.originalEmissive);
      if (mat.userData.originalEmissiveIntensity !== undefined) mat.emissiveIntensity = mat.userData.originalEmissiveIntensity;
    });
  }
  selected = null;
  $('annotation').hidden = true;
  $('selection-hint').hidden = false;
  document.querySelectorAll('.part-button').forEach(button => button.setAttribute('aria-pressed', 'false'));
}

function selectPart(mesh) {
  clearSelection();
  selected = mesh;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  materials.forEach(mat => { if (mat.emissive) { mat.emissive.set('#a7b4a6'); mat.emissiveIntensity = .09; } });
  const meta = mesh.userData.spec;
  $('part-name').textContent = meta.name;
  $('part-type').textContent = meta.group || 'Selected component';
  $('part-role').textContent = textValue(meta.role) || 'Geometry reconstructed for assembly inspection.';
  $('part-notes').textContent = textValue(meta.notes);
  $('part-notes').hidden = !textValue(meta.notes);
  $('part-source').textContent = `Source: ${textValue(meta.source) || 'Design assumption; no dimension specified.'}`;
  $('part-dim').textContent = `Unposed part envelope: ${dimensions(measure(mesh))} mm`;
  $('annotation').hidden = false;
  $('selection-hint').hidden = true;
  document.querySelectorAll('.part-button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.part === mesh.uuid)));
  $('live-status').textContent = `Selected ${meta.name}. ${textValue(meta.notes)}`;
}

function visibility() {
  updateProductLeadsVisibility();
  const allowed = views[focus].groups;
  parts.forEach(mesh => {
    const partGroup = String(mesh.userData.spec.group).toLowerCase();
    const matching = allowed.some(group => {
      const allowedGroup = group.toLowerCase();
      return partGroup === allowedGroup || (allowedGroup === 'hub' && partGroup.startsWith('hub '));
    });
    mesh.visible = matching && (showShells || !isShell(mesh));
  });
  visibleParts = parts.filter(mesh => mesh.visible);
  if (selected && !selected.visible) clearSelection();
  updatePartList(); updateFacts();
}

function frame(instant = false) {
  if (!visibleParts.length) return;
  const box = currentBox(), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const radius = size.length() * .5;
  camera.fov = focus === 'system' ? 34 : 30;
  camera.updateProjectionMatrix();
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const angles = { exterior: [focus === 'right' ? .85 : -.85, .18, -1], contacts: [.36, .22, 1], profile: [1, .08, .08] };
  const direction = new THREE.Vector3(...(focus === 'product' ? [.06, .05, 1] : focus === 'system' ? [.13, .15, 1] : focus === 'cable' ? [.55, .5, 1] : ['left', 'right'].includes(focus) ? angles[viewAngle] : [.5, .38, 1])).normalize();
  const target = center.clone();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const padding = focus === 'product' ? (innerWidth <= 760 ? 1.04 : 1.09) : (innerWidth <= 760 ? 1.11 : 1.17);
  let distance = .008;
  // Fit the projected box rather than a sphere: tall earbuds can use the full
  // narrow viewport without treating their height as an equally wide object.
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const corner = new THREE.Vector3(x, y, z).sub(target);
    const projectedX = Math.abs(corner.dot(right)), projectedY = Math.abs(corner.dot(up));
    const needed = corner.dot(direction) + Math.max(projectedX / Math.tan(horizontalFov / 2), projectedY / Math.tan(verticalFov / 2)) * padding;
    distance = Math.max(distance, needed);
  }
  const destination = target.clone().addScaledVector(direction, distance);
  camera.near = Math.max(.000005, distance / 1000); camera.far = Math.max(4, distance * 30); camera.updateProjectionMatrix();
  controls.minDistance = Math.max(.001, radius * .18);
  controls.maxDistance = Math.max(.3, radius * 16);
  if (instant || reducedMotion) { camera.position.copy(destination); controls.target.copy(target); controls.update(); transition = null; }
  else transition = { start: performance.now(), from: camera.position.clone(), to: destination, fromTarget: controls.target.clone(), toTarget: target };
}

function setFocus(next, instant = false) {
  if (!views[next]) return;
  focus = next;
  document.body.dataset.focus = focus;
  viewAngle = 'exterior';
  angleButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.angle === viewAngle)));
  $('view-angles').hidden = !['left', 'right'].includes(focus);
  clearSelection();
  focusButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.focus === focus)));
  $('view-title').textContent = views[focus].title;
  $('view-subtitle').textContent = views[focus].subtitle;
  $('view-number').textContent = views[focus].number;
  applyDisplayPose(); visibility(); frame(instant);
  $('live-status').textContent = `${views[focus].title}, ${visibleParts.length} visible parts.`;
}

function setExplosion(value) {
  explosion = value;
  updateProductLeadsVisibility();
  $('explode-output').textContent = `${Math.round(value * 100)}%`;
  parts.forEach(mesh => {
    const offset = mesh.userData.spec.explode || [0, 0, 0];
    const base = basePositions.get(mesh.uuid);
    if (Array.isArray(offset) && offset.length >= 3) mesh.position.copy(base).add(new THREE.Vector3(...offset).multiplyScalar(value * .001));
  });
  model.updateMatrixWorld(true);
  updateFacts();
  if (selected) $('part-dim').textContent = `Unposed part envelope: ${dimensions(measure(selected))} mm`;
}

function init() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute('aria-label', 'Interactive CYMBA One model. Drag to orbit; scroll or pinch to zoom; choose a part from the component list for accessible inspection.');
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.tabIndex = 0;
    container.append(renderer.domElement);
    scene = new THREE.Scene();
    scene.environment = studioEnvironment();
    scene.environmentIntensity = .85;
    finishTexture = makeFinishTexture();
    scene.add(new THREE.HemisphereLight(0xfffcf5, 0x6f7e82, .5));
    const key = new THREE.DirectionalLight(0xfffaf1, 2.2); key.position.set(-.25, .4, .5); scene.add(key);
    const fill = new THREE.DirectionalLight(0xe5edfa, .55); fill.position.set(.4, .05, .15); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 1.5); rim.position.set(.1, .3, -.5); scene.add(rim);
    camera = new THREE.PerspectiveCamera(32, container.clientWidth / container.clientHeight, .00001, 10);
    camera.position.set(.07, .055, .09);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = .09; controls.enablePan = true;
    controls.rotateSpeed = .72; controls.zoomSpeed = .7; controls.panSpeed = .75;
    controls.addEventListener('start', () => { transition = null; });
    renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); fail('The 3D rendering session was interrupted. Reload this page to restore the model. The CAD files are still available below.'); });
  } catch (error) {
    fail('This browser could not start the 3D viewer. Open the STEP or FreeCAD model to inspect the complete assembly.', error); return;
  }

  const loader = new GLTFLoader();
  loader.load('./assembly.glb?revision=e4c507772e01', gltf => {
    model = gltf.scene; scene.add(model);
    model.updateMatrixWorld(true);
    model.traverse(node => {
      if (!node.isMesh) return;
      const spec = metadata(node);
      node.userData.spec = spec;
      prepareCableBraid(node, spec);
      node.geometry.computeBoundingBox();
      node.userData.sourceDimensions = node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld).getSize(new THREE.Vector3()).multiplyScalar(1000);
      node.frustumCulled = true;
      const materialArray = Array.isArray(node.material) ? node.material : [node.material];
      const clones = materialArray.map(material => finishMaterial(material, spec));
      node.material = Array.isArray(node.material) ? clones : clones[0];
      parts.push(node); basePositions.set(node.uuid, node.position.clone());
    });
    if (!parts.length) { fail('The model contains no inspectable geometry. The original CAD downloads remain available below.'); return; }
    prepareDisplayGroups();
    prepareProductLeads();
    model.updateMatrixWorld(true);
    setFocus('product', true);
    if (!visibleParts.length) setFocus('system', true);
    $('loading').hidden = true;
    window.__cymbaViewer = { get parts() { return parts; }, get focus() { return focus; }, get visibleParts() { return visibleParts; }, setFocus, setExplosion, frame, renderer, scene, camera, controls, setAngle: angle => { viewAngle = angle; angleButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.angle === angle))); frame(); } };
  }, event => {
    if (event.total) $('loading-text').textContent = `Preparing the product model… ${Math.round(event.loaded / event.total * 100)}%`;
  }, error => fail(location.protocol === 'file:' ? 'To view the interactive model, open this folder through a local web server. The STEP and FreeCAD downloads also open directly in CAD software.' : 'The 3D model could not be loaded. Check that assembly.glb is beside this page, then reload. The CAD files are available below.', error));

  focusButtons.forEach(button => button.addEventListener('click', () => { if (model) setFocus(button.dataset.focus); }));
  angleButtons.forEach(button => button.addEventListener('click', () => {
    if (!model) return;
    viewAngle = button.dataset.angle;
    angleButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    frame();
  }));
  $('explode').addEventListener('input', event => { if (model) setExplosion(Number(event.target.value) / 100); });
  $('explode').addEventListener('change', () => { if (model) frame(); });
  $('shell-toggle').addEventListener('click', () => {
    if (!model) return;
    showShells = !showShells;
    $('shell-toggle').setAttribute('aria-checked', String(showShells));
    visibility();
  });
  $('reset').addEventListener('click', () => {
    if (!model) return;
    showShells = true; $('shell-toggle').setAttribute('aria-checked', 'true');
    $('explode').value = '0'; setExplosion(0); clearSelection(); setFocus(focus);
  });
  $('close-selection').addEventListener('click', clearSelection);
  window.addEventListener('keydown', event => { if (event.key === 'Escape') clearSelection(); });
  container.addEventListener('pointerdown', event => { pointerStart = { x: event.clientX, y: event.clientY, time: performance.now() }; });
  container.addEventListener('pointerup', event => {
    if (!model || !pointerStart || event.button !== 0) return;
    const movement = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
    if (movement > 6 || performance.now() - pointerStart.time > 550) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(visibleParts, false)[0];
    if (hit) selectPart(hit.object); else clearSelection();
  });
  let previousViewport = [container.clientWidth, container.clientHeight];
  const resize = new ResizeObserver(() => {
    const width = container.clientWidth, height = container.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height);
    if (model && (Math.abs(width - previousViewport[0]) > 2 || Math.abs(height - previousViewport[1]) > 2)) frame(true);
    previousViewport = [width, height];
  });
  resize.observe(container);
  function render(now) {
    requestAnimationFrame(render);
    if (transition) {
      const t = Math.min(1, (now - transition.start) / 560), ease = 1 - (1 - t) ** 3;
      camera.position.lerpVectors(transition.from, transition.to, ease);
      controls.target.lerpVectors(transition.fromTarget, transition.toTarget, ease);
      if (t === 1) transition = null;
    }
    controls.update();
    inverseCamera.copy(camera.quaternion).invert();
    axes.forEach(axis => {
      axisVector.copy(axis.vector).applyQuaternion(inverseCamera);
      axis.line.setAttribute('x2', 30 + axisVector.x * 20);
      axis.line.setAttribute('y2', 30 - axisVector.y * 20);
      axis.label.setAttribute('x', 30 + axisVector.x * 25);
      axis.label.setAttribute('y', 33 - axisVector.y * 25);
      axis.line.style.opacity = .45 + (axisVector.z + 1) * .25;
      axis.label.style.opacity = .6 + (axisVector.z + 1) * .2;
    });
    renderer.render(scene, camera);
  }
  requestAnimationFrame(render);
}

updateFacts();
init();

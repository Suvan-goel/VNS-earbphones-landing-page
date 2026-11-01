/**
 * Web-ready stone maps for the mannequin. Run with Node 22.18+:
 *   node scripts/build-stone-maps.mjs
 *
 * - cymba-sculpture-ao.webp: the baked cavity occlusion with the previous
 *   fibre network removed. The Blender bake left the stone beside the old
 *   fibres a few levels lighter and dark contact lines where the tubes touched
 *   it, which rendered as a faint tree and short dark strokes on the scalp once
 *   that network was replaced. The mean halo profile is measured by distance
 *   from those fibres and subtracted, then every narrow dark pit on the scalp
 *   (an earlier layout left some too) is lifted to the stone around it, and the
 *   black gutters between the atlas islands are padded so filtering never pulls
 *   them into the stone. 1024 px, every device.
 * - cymba-sculpture-stone-normal.webp: the 2048 px grain, gutters padded, reduced to 1024 px.
 *   Desktop only; at 35% strength the extra resolution never reached a pixel.
 * - cymba-sculpture-stone-roughness.webp: the honed-stone roughness, gutters padded, desktop only.
 *
 * The PNG sources stay unchanged. A report is written next to this script.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import draco from "draco3d";
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = fileURLToPath(new URL("../", import.meta.url));
const models = path.join(root, "public/models");
const decoderModule = await draco.createDecoderModule({});
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

function decode(bytes, attributeIds) {
  const decoder = new decoderModule.Decoder();
  const buffer = new decoderModule.DecoderBuffer();
  buffer.Init(new Int8Array(bytes), bytes.length);
  const mesh = new decoderModule.Mesh();
  const status = decoder.DecodeBufferToMesh(buffer, mesh);
  if (!status.ok()) throw new Error(status.error_msg());
  const attributes = {};
  for (const [name, id] of Object.entries(attributeIds)) {
    const attribute = decoder.GetAttributeByUniqueId(mesh, id);
    const values = new decoderModule.DracoFloat32Array();
    decoder.GetAttributeFloatForAllPoints(mesh, attribute, values);
    attributes[name] = Float32Array.from({ length: values.size() }, (_, index) => values.GetValue(index));
    decoderModule.destroy(values);
  }
  const indices = new Uint32Array(mesh.num_faces() * 3);
  const face = new decoderModule.DracoInt32Array();
  for (let index = 0; index < mesh.num_faces(); index++) {
    decoder.GetFaceFromMesh(mesh, index, face);
    for (let corner = 0; corner < 3; corner++) indices[index * 3 + corner] = face.GetValue(corner);
  }
  for (const object of [face, mesh, buffer, decoder]) decoderModule.destroy(object);
  return { attributes, indices };
}

function readNode(file, nodeName) {
  const bytes = fs.readFileSync(file);
  const jsonLength = bytes.readUInt32LE(12);
  const document = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  const binary = bytes.subarray(28 + jsonLength);
  const node = document.nodes.find((candidate) => candidate.name === nodeName);
  if (!node) throw new Error(`${nodeName} is missing from ${file}`);
  const extension = document.meshes[node.mesh].primitives[0].extensions.KHR_draco_mesh_compression;
  const view = document.bufferViews[extension.bufferView];
  return decode(binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength), extension.attributes);
}

// ------------------------------------------------- where the old fibres lay
// The original organic model carries the network the occlusion was baked
// around. Project its vertices onto the head and record, for every texel, how
// far (in scene units) the nearest old fibre ran.
const source = path.join(models, "cymba-neural-mannequin-organic.glb");
const head = readNode(source, "Cymba_Marble_Mannequin");
const oldFibres = readNode(source, "Purple_Surface_Nerve_Fibres");
const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(head.attributes.POSITION, 3));
geometry.setIndex(new THREE.BufferAttribute(head.indices, 1));
const bvh = new MeshBVH(geometry);
const SIZE = 1024;
const REACH = 0.05; // the halo is gone well inside this distance
const distance = new Float32Array(SIZE * SIZE).fill(Infinity);
const target = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };
const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), p = new THREE.Vector3(), bary = new THREE.Vector3();
const uv = head.attributes.TEXCOORD_0, positions = head.attributes.POSITION, indices = head.indices;
const fibrePositions = oldFibres.attributes.POSITION;
let painted = 0;
for (let i = 0; i < fibrePositions.length / 3; i++) {
  p.fromArray(fibrePositions, i * 3);
  bvh.closestPointToPoint(p, target);
  if (target.distance > 0.06) continue;
  const f = target.faceIndex * 3;
  const ia = indices[f], ib = indices[f + 1], ic = indices[f + 2];
  a.fromArray(positions, ia * 3); b.fromArray(positions, ib * 3); c.fromArray(positions, ic * 3);
  THREE.Triangle.getBarycoord(target.point, a, b, c, bary);
  const u = bary.x * uv[ia * 2] + bary.y * uv[ib * 2] + bary.z * uv[ic * 2];
  const v = bary.x * uv[ia * 2 + 1] + bary.y * uv[ib * 2 + 1] + bary.z * uv[ic * 2 + 1];
  const worldArea = new THREE.Triangle(a, b, c).getArea();
  const uvArea = Math.abs((uv[ib * 2] - uv[ia * 2]) * (uv[ic * 2 + 1] - uv[ia * 2 + 1]) - (uv[ic * 2] - uv[ia * 2]) * (uv[ib * 2 + 1] - uv[ia * 2 + 1])) / 2;
  const texelsPerUnit = Math.sqrt(uvArea / Math.max(worldArea, 1e-12)) * SIZE;
  const radius = Math.min(48, REACH * texelsPerUnit);
  // Mannequin.tsx loads the maps with flipY = false: glTF rows run down from v = 0.
  const cx = u * SIZE, cy = v * SIZE;
  for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(SIZE - 1, Math.ceil(cy + radius)); y++)
    for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(SIZE - 1, Math.ceil(cx + radius)); x++) {
      const d = Math.hypot(x - cx, y - cy) / texelsPerUnit;
      if (d < distance[y * SIZE + x]) distance[y * SIZE + x] = d;
    }
  painted++;
}

// ------------------------------------------------- remove the halo
// The bake left a smooth pale halo around every old fibre: about six levels
// at the fibre, gone by 0.02 units. Measure that mean profile against the
// stone further out and subtract it, so the local variation underneath stays.
const aoSource = path.join(models, "cymba-sculpture-ao.png");
const ao = await sharp(aoSource).toColourspace("b-w").raw().toBuffer({ resolveWithObject: true });
if (ao.info.width !== SIZE || ao.info.channels !== 1) throw new Error("Expected a 1024 px occlusion map.");
const BIN = 0.0025, HALO = 0.025;
const bins = Array.from({ length: Math.ceil(REACH / BIN) }, () => [0, 0]);
for (let i = 0; i < ao.data.length; i++) {
  if (ao.data[i] < 8 || distance[i] >= REACH) continue; // island texels only, never the gutters
  const bin = bins[Math.floor(distance[i] / BIN)];
  bin[0] += ao.data[i]; bin[1]++;
}
const means = bins.map(([sum, count]) => count ? sum / count : NaN);
const baselineBins = means.slice(Math.round(0.03 / BIN));
const baseline = baselineBins.reduce((n, v) => n + v, 0) / baselineBins.length;
// The measured excess is already back at the baseline by 0.02 units.
const profile = means.map((mean) => Math.max(0, mean - baseline));
const halo = (d) => {
  if (d >= HALO) return 0;
  const x = d / BIN - 0.5, i = Math.max(0, Math.floor(x)), f = Math.min(1, Math.max(0, x - i));
  return profile[i] * (1 - f) + (profile[i + 1] ?? 0) * f;
};
const cleaned = Buffer.from(ao.data);
let filled = 0, loweredSum = 0;
for (let i = 0; i < cleaned.length; i++) {
  if (ao.data[i] < 8 || distance[i] >= HALO) continue;
  const value = Math.max(0, Math.round(ao.data[i] - halo(distance[i])));
  loweredSum += ao.data[i] - value;
  cleaned[i] = value;
  filled++;
}
// The bake also left dark contact pits where tubes touched the stone, and not
// only under the fibres this GLB carries: an earlier layout left pits of its own.
// The scalp is smooth stone, so any narrow dark feature there is an artefact.
// Every scalp texel (rasterised from the head triangles above the brow line,
// behind the face and clear of the ears) darker than the surrounding level (two
// box blurs of PIT_RADIUS texels over scalp texels) by more than PIT_TOLERANCE is
// lifted to that level less the tolerance; the grain within the tolerance stays.
// Elsewhere on the head the same lift applies with PIT_TOLERANCE_ELSEWHERE, deep
// enough that only the tube pits go and real cavities keep their shading.
const PIT_RADIUS = 12, PIT_TOLERANCE = 6, PIT_TOLERANCE_ELSEWHERE = 20;
const scalp = (x, y, z) => y > 0.55 && z < 0.45 && !(Math.abs(x) > 0.95 && y < 0.8);
const onScalp = new Uint8Array(SIZE * SIZE);
{
  const tri = [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()];
  for (let f = 0; f < indices.length; f += 3) {
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) { const v = indices[f + k]; cx += positions[v * 3]; cy += positions[v * 3 + 1]; cz += positions[v * 3 + 2]; tri[k].set(uv[v * 2] * SIZE, uv[v * 2 + 1] * SIZE); }
    if (!scalp(cx / 3, cy / 3, cz / 3)) continue;
    const minX = Math.max(0, Math.floor(Math.min(tri[0].x, tri[1].x, tri[2].x))), maxX = Math.min(SIZE - 1, Math.ceil(Math.max(tri[0].x, tri[1].x, tri[2].x)));
    const minY = Math.max(0, Math.floor(Math.min(tri[0].y, tri[1].y, tri[2].y))), maxY = Math.min(SIZE - 1, Math.ceil(Math.max(tri[0].y, tri[1].y, tri[2].y)));
    const [p0, p1, p2] = tri;
    const area = (p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y);
    if (Math.abs(area) < 1e-9) continue;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((p1.x - px) * (p2.y - py) - (p2.x - px) * (p1.y - py)) / area;
      const w1 = ((p2.x - px) * (p0.y - py) - (p0.x - px) * (p2.y - py)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 >= -0.002 && w1 >= -0.002 && w2 >= -0.002) onScalp[y * SIZE + x] = 1;
    }
  }
}
function boxBlur(src, radius) {
  const tmp = new Float64Array(SIZE * SIZE), out = new Float64Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    let sum = 0;
    for (let x = -radius; x <= radius; x++) sum += src[y * SIZE + Math.min(SIZE - 1, Math.max(0, x))];
    for (let x = 0; x < SIZE; x++) {
      tmp[y * SIZE + x] = sum;
      sum += src[y * SIZE + Math.min(SIZE - 1, x + radius + 1)] - src[y * SIZE + Math.max(0, x - radius)];
    }
  }
  for (let x = 0; x < SIZE; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) sum += tmp[Math.min(SIZE - 1, Math.max(0, y)) * SIZE + x];
    for (let y = 0; y < SIZE; y++) {
      out[y * SIZE + x] = sum;
      sum += tmp[Math.min(SIZE - 1, y + radius + 1) * SIZE + x] - tmp[Math.max(0, y - radius) * SIZE + x];
    }
  }
  return out;
}
const scalpValue = new Float64Array(SIZE * SIZE), scalpWeight = new Float64Array(SIZE * SIZE);
let scalpTexels = 0;
for (let i = 0; i < cleaned.length; i++) {
  if (cleaned[i] < 8) continue;
  scalpValue[i] = cleaned[i]; scalpWeight[i] = 1; if (onScalp[i]) scalpTexels++;
}
const levelValue = boxBlur(boxBlur(scalpValue, PIT_RADIUS), PIT_RADIUS);
const levelWeight = boxBlur(boxBlur(scalpWeight, PIT_RADIUS), PIT_RADIUS);
let inpainted = 0, inpaintChange = 0, darkestBefore = 255, darkestAfter = 255;
for (let i = 0; i < cleaned.length; i++) {
  if (cleaned[i] < 8 || levelWeight[i] <= 0) continue;
  if (onScalp[i]) darkestBefore = Math.min(darkestBefore, cleaned[i]);
  // Off the scalp only a deep narrow pit goes: wide real cavities keep their shading.
  const floor = levelValue[i] / levelWeight[i] - (onScalp[i] ? PIT_TOLERANCE : PIT_TOLERANCE_ELSEWHERE);
  if (cleaned[i] >= floor) { darkestAfter = Math.min(darkestAfter, cleaned[i]); continue; }
  const value = Math.round(floor);
  darkestAfter = Math.min(darkestAfter, value);
  inpaintChange += value - cleaned[i];
  cleaned[i] = value;
  inpainted++;
}
// The atlas is an automatic unwrap with thousands of small islands and black
// gutters between them. Filtering and mipmaps pull that black into every island
// edge, which draws as thin dark seams across the stone whatever the islands
// hold. Pad each map: gutter texels take the value of the nearest island texels
// (PAD_STEPS rings), and anything further out takes the island mean.
const PAD_STEPS = 48;
function padIslands(data, width, height, channels, inside) {
  const filled = Uint8Array.from(inside);
  const out = Buffer.from(data);
  let remaining = 0;
  for (let i = 0; i < inside.length; i++) if (!inside[i]) remaining++;
  for (let step = 0; step < PAD_STEPS && remaining > 0; step++) {
    const next = Uint8Array.from(filled);
    const source = Buffer.from(out);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (filled[i]) continue;
      let count = 0; const sum = new Float64Array(channels);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = ny * width + nx;
        if (!filled[j]) continue;
        count++;
        for (let c = 0; c < channels; c++) sum[c] += source[j * channels + c];
      }
      if (!count) continue;
      for (let c = 0; c < channels; c++) out[i * channels + c] = Math.round(sum[c] / count);
      next[i] = 1; remaining--;
    }
    filled.set(next);
  }
  const mean = new Float64Array(channels); let n = 0;
  for (let i = 0; i < inside.length; i++) { if (!inside[i]) continue; n++; for (let c = 0; c < channels; c++) mean[c] += data[i * channels + c]; }
  for (let i = 0; i < inside.length; i++) { if (filled[i]) continue; for (let c = 0; c < channels; c++) out[i * channels + c] = Math.round(mean[c] / n); }
  return { data: out, gutterTexels: inside.length - n, remainingAfterRings: remaining };
}
const island = new Uint8Array(SIZE * SIZE);
let islandTexels = 0;
for (let i = 0; i < cleaned.length; i++) if (cleaned[i] >= 8) { island[i] = 1; islandTexels++; }
const padded = padIslands(cleaned, SIZE, SIZE, 1, island);
// Verify: the mean by distance should now sit on the baseline.
const check = Array.from({ length: Math.ceil(REACH / BIN) }, () => [0, 0]);
for (let i = 0; i < cleaned.length; i++) {
  if (cleaned[i] < 8 || distance[i] >= REACH) continue;
  const bin = check[Math.floor(distance[i] / BIN)];
  bin[0] += cleaned[i]; bin[1]++;
}
const residual = check.map(([sum, count]) => count ? +(sum / count - baseline).toFixed(2) : null);

// ------------------------------------------------- encode
const outputs = [];
async function write(name, pipeline, note) {
  const file = path.join(models, name);
  await pipeline.toFile(file);
  const bytes = fs.readFileSync(file);
  const meta = await sharp(file).metadata();
  outputs.push({ file: `public/models/${name}`, bytes: bytes.length, width: meta.width, height: meta.height, sha256: hash(bytes), note });
}
await write("cymba-sculpture-ao.webp",
  sharp(padded.data, { raw: { width: SIZE, height: SIZE, channels: 1 } }).webp({ quality: 88, effort: 6 }),
  "cavity occlusion, old fibre halo subtracted, scalp pits lifted, islands padded; both layouts");
async function paddedSource(file, channels, note) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const inside = new Uint8Array(info.width * info.height);
  const scale = info.width / SIZE;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) inside[y * info.width + x] = island[Math.floor(y / scale) * SIZE + Math.floor(x / scale)];
  const result = padIslands(data, info.width, info.height, info.channels, inside);
  return sharp(result.data, { raw: { width: info.width, height: info.height, channels: info.channels } });
}
await write("cymba-sculpture-stone-normal.webp",
  (await paddedSource(path.join(models, "cymba-sculpture-stone-normal.png"))).resize(1024, 1024, { kernel: "lanczos3" }).webp({ quality: 92, effort: 6, smartSubsample: false }),
  "stone grain normal, 2048 to 1024 px, islands padded; desktop only");
await write("cymba-sculpture-stone-roughness.webp",
  (await paddedSource(path.join(models, "cymba-sculpture-stone-roughness.png"))).toColourspace("b-w").webp({ quality: 88, effort: 6 }),
  "honed roughness, islands padded; desktop only");

const report = {
  source: "public/models/cymba-neural-mannequin-organic.glb (old fibre network) and the PNG bakes",
  oldFibreVerticesPainted: painted,
  occlusion: {
    baseline: +baseline.toFixed(2),
    haloProfileByDistance: profile.slice(0, Math.round(HALO / BIN)).map((v) => +v.toFixed(2)),
    texelsAdjusted: filled,
    meanLowering: filled ? +(loweredSum / filled).toFixed(2) : 0,
    residualByDistanceAfter: residual,
    padding: { rings: PAD_STEPS, gutterTexels: padded.gutterTexels, filledByIslandMean: padded.remainingAfterRings },
    scalpPits: { scalpTexels, blurRadiusTexels: PIT_RADIUS, tolerance: PIT_TOLERANCE, toleranceElsewhere: PIT_TOLERANCE_ELSEWHERE, texelsLifted: inpainted, meanLift: inpainted ? +(inpaintChange / inpainted).toFixed(2) : 0, darkestScalpTexelBefore: darkestBefore, darkestScalpTexelAfter: darkestAfter },
  },
  sourcesUnchanged: true,
  outputs,
};
fs.writeFileSync(path.join(root, "scripts/stone-maps-report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));

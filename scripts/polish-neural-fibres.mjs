/**
 * Offline-only refinement of the existing baked nerve tubes. Neither source
 * asset is overwritten. The head, materials and every non-nerve buffer view
 * are copied byte-for-byte. No subdivisions, additional meshes or attributes.
 * Run: node scripts/polish-neural-fibres.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import draco from "draco3d";
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";

const root = fileURLToPath(new URL("../", import.meta.url));
const decoderModule = await draco.createDecoderModule({});
const encoderModule = await draco.createEncoderModule({});
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const pad4 = (bytes, value = 0) => Buffer.concat([bytes, Buffer.alloc((4 - bytes.length % 4) % 4, value)]);
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const scale = (a, s) => a.map((v) => v * s);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const length = (a) => Math.hypot(...a);
const lerp = (a, b, t) => add(scale(a, 1 - t), scale(b, t));
const smoothstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

function readGlb(file) {
  const bytes = fs.readFileSync(file), jsonLength = bytes.readUInt32LE(12);
  const document = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  const binary = bytes.subarray(28 + jsonLength);
  const views = document.bufferViews.map((view) => Buffer.from(binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)));
  return { bytes, document, views };
}

function decode(bytes, ids) {
  const decoder = new decoderModule.Decoder(), buffer = new decoderModule.DecoderBuffer();
  buffer.Init(new Int8Array(bytes), bytes.length);
  const mesh = new decoderModule.Mesh(), status = decoder.DecodeBufferToMesh(buffer, mesh);
  if (!status.ok()) throw new Error(status.error_msg());
  const attributes = {};
  for (const [name, id] of Object.entries(ids)) {
    const values = new decoderModule.DracoFloat32Array();
    decoder.GetAttributeFloatForAllPoints(mesh, decoder.GetAttributeByUniqueId(mesh, id), values);
    attributes[name] = Float32Array.from({ length: values.size() }, (_, i) => values.GetValue(i));
    decoderModule.destroy(values);
  }
  const indices = new Uint32Array(mesh.num_faces() * 3), face = new decoderModule.DracoInt32Array();
  for (let i = 0; i < mesh.num_faces(); i++) {
    decoder.GetFaceFromMesh(mesh, i, face);
    for (let c = 0; c < 3; c++) indices[i * 3 + c] = face.GetValue(c);
  }
  for (const object of [face, mesh, buffer, decoder]) decoderModule.destroy(object);
  return { attributes, indices };
}

function pathsFrom(decoded) {
  const positions = decoded.attributes.POSITION, uv = decoded.attributes.TEXCOORD_0;
  const count = positions.length / 3, parent = Uint32Array.from({ length: count }, (_, i) => i);
  const find = (v) => { while (parent[v] !== v) { parent[v] = parent[parent[v]]; v = parent[v]; } return v; };
  for (let i = 0; i < decoded.indices.length; i += 3) {
    const a = find(decoded.indices[i]);
    parent[find(decoded.indices[i + 1])] = a; parent[find(decoded.indices[i + 2])] = a;
  }
  const components = new Map();
  for (let v = 0; v < count; v++) {
    const component = find(v);
    if (!components.has(component)) components.set(component, new Map());
    const rings = components.get(component), u = uv[v * 2];
    if (!rings.has(u)) rings.set(u, []);
    rings.get(u).push(v);
  }
  return [...components.values()].map((groups, pathIndex) => ({
    pathIndex,
    rings: [...groups.entries()].sort(([a], [b]) => a - b).map(([u, vertices], ringIndex) => {
      if (vertices.length !== 6) throw new Error(`Expected six-sided rings, got ${vertices.length}`);
      const centre = [0, 1, 2].map((axis) => vertices.reduce((sum, v) => sum + positions[v * 3 + axis], 0) / vertices.length);
      const radius = Math.max(...vertices.map((v) => length(sub([...positions.subarray(v * 3, v * 3 + 3)], centre))));
      return { pathIndex, ringIndex, u, energy: uv[vertices[0] * 2 + 1], vertices, centre, radius, junction: false };
    }),
  }));
}

function identifyJunctions(paths) {
  // Find endpoint-to-segment attachments, including mobile segments where an
  // intermediate ring was removed. Growth distance rejects unrelated crossings.
  const cellSize = 0.04, reach = 0.0045, cells = new Map();
  const key = (x, y, z) => `${x},${y},${z}`;
  for (const path of paths) for (let i = 0; i < path.rings.length - 1; i++) {
    const a = path.rings[i], b = path.rings[i + 1], segment = { path, i, a, b };
    const low = a.centre.map((v, axis) => Math.floor((Math.min(v, b.centre[axis]) - reach) / cellSize));
    const high = a.centre.map((v, axis) => Math.floor((Math.max(v, b.centre[axis]) + reach) / cellSize));
    for (let x = low[0]; x <= high[0]; x++) for (let y = low[1]; y <= high[1]; y++) for (let z = low[2]; z <= high[2]; z++) {
      const k = key(x, y, z); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(segment);
    }
  }
  let attachments = 0;
  for (const path of paths) {
    for (const endIndex of [0, path.rings.length - 1]) {
      const endpoint = path.rings[endIndex];
      const cell = endpoint.centre.map((v) => Math.floor(v / cellSize));
      for (const candidate of cells.get(key(...cell)) ?? []) {
        if (candidate.path === path) continue;
        const ab = sub(candidate.b.centre, candidate.a.centre);
        const t = Math.max(0, Math.min(1, dot(sub(endpoint.centre, candidate.a.centre), ab) / Math.max(1e-20, dot(ab, ab))));
        const u = candidate.a.u + (candidate.b.u - candidate.a.u) * t;
        if (Math.abs(endpoint.u - u) > 0.002 || length(sub(endpoint.centre, lerp(candidate.a.centre, candidate.b.centre, t))) > reach) continue;
        endpoint.junction = true; attachments++;
        for (let i = Math.max(0, candidate.i - 1); i <= Math.min(candidate.path.rings.length - 1, candidate.i + 2); i++) candidate.path.rings[i].junction = true;
      }
    }
    path.freeTip = !path.rings.at(-1).junction;
  }
  // Junction discovery may have marked an earlier path's tip subsequently.
  for (const path of paths) path.freeTip = !path.rings.at(-1).junction;
  return attachments;
}

const desktopSource = path.join(root, "public/models/cymba-neural-mannequin-organic-detailed-desktop.glb");
const desktop = readGlb(desktopSource);
const headNode = desktop.document.nodes.find((node) => node.name === "Cymba_Marble_Mannequin");
const headPrimitive = desktop.document.meshes[headNode.mesh].primitives[0];
const headDraco = headPrimitive.extensions.KHR_draco_mesh_compression;
const head = decode(desktop.views[headDraco.bufferView], headDraco.attributes);
const headGeometry = new THREE.BufferGeometry();
headGeometry.setAttribute("position", new THREE.BufferAttribute(head.attributes.POSITION, 3));
headGeometry.setIndex(new THREE.BufferAttribute(head.indices, 1));
const headBvh = new MeshBVH(headGeometry);
const nearestSurface = (point) => headBvh.closestPointToPoint(new THREE.Vector3(...point)).point.toArray();

function refine(decoded, paths) {
  const original = decoded.attributes.POSITION.slice(), updated = original.slice();
  let movedRings = 0, maxCentreDisplacement = 0, taperedRings = 0, minRadiusScale = 1;
  let minOriginalCentreClearance = Infinity, minRefinedCentreClearance = Infinity, maxCentreClearanceLoss = 0;
  const displacementCap = 0.00075;
  for (const path of paths) {
    const rings = path.rings;
    let centres = rings.map((r) => [...r.centre]);
    const offsets = rings.map((r) => sub(r.centre, nearestSurface(r.centre)));
    // Low-strength fairing preserves the large arcs. Surface reprojection uses
    // the full-resolution head for both variants and retains original clearance.
    for (let pass = 0; pass < 2; pass++) {
      centres = centres.map((centre, i) => {
        if (i === 0 || i === centres.length - 1 || rings[i].junction) return centre;
        const t = (rings[i].u - rings[i - 1].u) / (rings[i + 1].u - rings[i - 1].u);
        const candidate = lerp(centre, lerp(centres[i - 1], centres[i + 1], t), 0.28);
        const surfaceCandidate = add(nearestSurface(candidate), offsets[i]);
        let movement = sub(surfaceCandidate, rings[i].centre);
        const distance = length(movement);
        if (distance > displacementCap) movement = scale(movement, displacementCap / distance);
        const result = add(rings[i].centre, movement);
        // A local scan ridge can interrupt the nearest-surface projection.
        // Keep its original centre rather than bury any part of that fibre.
        if (length(sub(result, nearestSurface(result))) < length(offsets[i]) - 0.000005) return [...rings[i].centre];
        return result;
      });
    }
    for (let i = 0; i < rings.length; i++) {
      const ring = rings[i], centre = centres[i];
      const originalClearance = length(offsets[i]), refinedClearance = length(sub(centre, nearestSurface(centre)));
      minOriginalCentreClearance = Math.min(minOriginalCentreClearance, originalClearance);
      minRefinedCentreClearance = Math.min(minRefinedCentreClearance, refinedClearance);
      maxCentreClearanceLoss = Math.max(maxCentreClearanceLoss, originalClearance - refinedClearance);
      const centreDisplacement = length(sub(centre, ring.centre));
      maxCentreDisplacement = Math.max(maxCentreDisplacement, centreDisplacement);
      if (centreDisplacement > 1e-8) movedRings++;
      // Suppress only raised radius ripples, never increase a ring's width.
      let radiusScale = 1;
      if (i > 0 && i < rings.length - 1 && !ring.junction) {
        const t = (ring.u - rings[i - 1].u) / (rings[i + 1].u - rings[i - 1].u);
        const neighbourRadius = rings[i - 1].radius * (1 - t) + rings[i + 1].radius * t;
        radiusScale = Math.min(1, (ring.radius * 0.65 + neighbourRadius * 0.35) / ring.radius);
      }
      if (path.freeTip && !ring.junction) {
        const t = (ring.u - rings[0].u) / (rings.at(-1).u - rings[0].u);
        radiusScale *= 1 - 0.65 * smoothstep(0.66, 1, t);
      }
      minRadiusScale = Math.min(minRadiusScale, radiusScale);
      if (radiusScale < 0.999999) taperedRings++;
      for (const v of ring.vertices) for (let axis = 0; axis < 3; axis++) {
        updated[v * 3 + axis] = centre[axis] + (original[v * 3 + axis] - ring.centre[axis]) * radiusScale;
      }
    }
  }
  const normals = new Float64Array(updated.length);
  for (let i = 0; i < decoded.indices.length; i += 3) {
    const [a, b, c] = [...decoded.indices.subarray(i, i + 3)];
    const ab = sub([...updated.subarray(b * 3, b * 3 + 3)], [...updated.subarray(a * 3, a * 3 + 3)]);
    const ac = sub([...updated.subarray(c * 3, c * 3 + 3)], [...updated.subarray(a * 3, a * 3 + 3)]);
    const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    for (const v of [a, b, c]) for (let axis = 0; axis < 3; axis++) normals[v * 3 + axis] += n[axis];
  }
  const normalResult = new Float32Array(updated.length);
  for (let i = 0; i < normals.length; i += 3) {
    const magnitude = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
    for (let axis = 0; axis < 3; axis++) normalResult[i + axis] = magnitude > 1e-15 ? normals[i + axis] / magnitude : decoded.attributes.NORMAL[i + axis];
  }
  decoded.attributes.POSITION = updated; decoded.attributes.NORMAL = normalResult;
  return { movedRings, maxCentreDisplacement, taperedRings, minRadiusScale, maxRadiusScale: 1,
    minOriginalCentreClearance, minRefinedCentreClearance, maxCentreClearanceLoss,
    endpointCentresPreservedBeforeCompression: true, junctionRingsPreservedBeforeCompression: true };
}

function encode(decoded, speed = 0) {
  const mesh = new encoderModule.Mesh(), builder = new encoderModule.MeshBuilder();
  const count = decoded.attributes.POSITION.length / 3;
  builder.AddFacesToMesh(mesh, decoded.indices.length / 3, decoded.indices);
  const ids = {};
  for (const [name, kind, size] of [["POSITION", "POSITION", 3], ["NORMAL", "NORMAL", 3], ["TEXCOORD_0", "TEX_COORD", 2]]) {
    ids[name] = builder.AddFloatAttributeToMesh(mesh, encoderModule[kind], count, size, decoded.attributes[name]);
  }
  const encoder = new encoderModule.Encoder(), output = new encoderModule.DracoInt8Array();
  encoder.SetSpeedOptions(speed, speed); encoder.SetEncodingMethod(encoderModule.MESH_EDGEBREAKER_ENCODING);
  encoder.SetAttributeQuantization(encoderModule.POSITION, 18);
  encoder.SetAttributeQuantization(encoderModule.NORMAL, 12);
  encoder.SetAttributeQuantization(encoderModule.TEX_COORD, 20);
  const size = encoder.EncodeMeshToDracoBuffer(mesh, output);
  if (size <= 0) throw new Error("Draco encoding failed");
  const bytes = Buffer.from(Array.from({ length: size }, (_, i) => output.GetValue(i) & 255));
  for (const object of [output, encoder, builder, mesh]) encoderModule.destroy(object);
  return { bytes, ids, speed };
}


function writeGlb(document, views) {
  const chunks = []; let offset = 0;
  for (let i = 0; i < views.length; i++) {
    document.bufferViews[i].byteOffset = offset; document.bufferViews[i].byteLength = views[i].length;
    const bytes = pad4(views[i]); chunks.push(bytes); offset += bytes.length;
  }
  document.buffers[0].byteLength = offset;
  const json = pad4(Buffer.from(JSON.stringify(document)), 32), binary = Buffer.concat(chunks);
  const header = Buffer.alloc(20), binaryHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + binary.length, 8);
  header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  binaryHeader.writeUInt32LE(binary.length, 0); binaryHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, json, binaryHeader, binary]);
}

const quantiles = (values) => {
  const sorted = values.slice().sort((a, b) => a - b);
  return Object.fromEntries([0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].map((q) => [q, sorted[Math.round((sorted.length - 1) * q)]]));
};
const ringKey = (ring) => `${ring.u.toFixed(5)}:${ring.energy.toFixed(5)}`;
const reports = [];
for (const variant of ["desktop", "mobile"]) {
  const sourcePath = path.join(root, `public/models/cymba-neural-mannequin-organic-detailed-${variant}.glb`);
  const outputPath = path.join(root, `public/models/cymba-neural-mannequin-polished-${variant}.glb`);
  const source = readGlb(sourcePath), { document, views } = source;
  const node = document.nodes.find((n) => n.name === "Purple_Surface_Nerve_Fibres");
  const mesh = document.meshes[node.mesh];
  if (mesh.primitives.length !== 1) throw new Error("Expected one nerve draw call");
  const primitive = mesh.primitives[0], extension = primitive.extensions.KHR_draco_mesh_compression, nerveView = extension.bufferView;
  const originalViews = views.map((view) => Buffer.from(view));
  const decoded = decode(views[nerveView], extension.attributes), originalUv = decoded.attributes.TEXCOORD_0.slice();
  const sourcePositions = decoded.attributes.POSITION.slice(), sourceTriangleCount = decoded.indices.length / 3;
  const paths = pathsFrom(decoded), attachments = identifyJunctions(paths);
  if (paths.length !== 1129) throw new Error("Unexpected nerve topology");
  const stats = refine(decoded, paths);
  if (!originalUv.every((v, i) => v === decoded.attributes.TEXCOORD_0[i])) throw new Error("Original growth/importance UVs changed");
  // Compression settings change representation only; precision stays exactly
  // at the existing asset's 18/12/20-bit position/normal/UV quantization.
  const encodings = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((speed) => encode(decoded, speed));
  const encoded = encodings.reduce((best, item) => item.bytes.length < best.bytes.length ? item : best);
  const verified = decode(encoded.bytes, encoded.ids);
  if (verified.indices.length !== decoded.indices.length || verified.attributes.POSITION.length > sourcePositions.length) throw new Error(`Geometry budget increased: ${JSON.stringify({ sourceVertices: sourcePositions.length / 3, inputVertices: decoded.attributes.POSITION.length / 3, outputVertices: verified.attributes.POSITION.length / 3, inputIndices: decoded.indices.length, outputIndices: verified.indices.length })}`);
  const finalPaths = pathsFrom(verified);
  if (finalPaths.length !== paths.length) throw new Error("Disconnected branch topology changed");
  const finalRings = new Map();
  for (const path of finalPaths) for (const ring of path.rings) {
    const key = ringKey(ring); if (!finalRings.has(key)) finalRings.set(key, []); finalRings.get(key).push(ring);
  }
  let maxUvError = 0, maxEndpointCentreError = 0, maxJunctionVertexError = 0, maxEncodedRadiusGrowth = 0;
  for (const path of paths) for (const [i, ring] of path.rings.entries()) {
    const candidates = finalRings.get(ringKey(ring)); if (!candidates?.length) throw new Error("Missing growth ring after compression");
    const match = candidates.reduce((nearest, candidate) => length(sub(candidate.centre, ring.centre)) < length(sub(nearest.centre, ring.centre)) ? candidate : nearest);
    maxUvError = Math.max(maxUvError, Math.abs(ring.u - match.u), Math.abs(ring.energy - match.energy));
    if (i === 0 || i === path.rings.length - 1) maxEndpointCentreError = Math.max(maxEndpointCentreError, length(sub(ring.centre, match.centre)));
    if (ring.junction) {
      for (const v of ring.vertices) {
        const original = [...sourcePositions.subarray(v * 3, v * 3 + 3)];
        maxJunctionVertexError = Math.max(maxJunctionVertexError, Math.min(...match.vertices.map((w) => length(sub(original, [...verified.attributes.POSITION.subarray(w * 3, w * 3 + 3)])))));
      }
    }
    maxEncodedRadiusGrowth = Math.max(maxEncodedRadiusGrowth, match.radius - ring.radius);
  }
  if (maxUvError > 1e-5 || maxEndpointCentreError > 0.00003 || maxJunctionVertexError > 0.00003 || maxEncodedRadiusGrowth > 0.00003) throw new Error(`Endpoint, junction, taper or UV validation failed: ${JSON.stringify({ maxUvError, maxEndpointCentreError, maxJunctionVertexError, maxEncodedRadiusGrowth })}`);
  for (const values of Object.values(verified.attributes)) if (values.some((v) => !Number.isFinite(v))) throw new Error("Non-finite geometry");
  views[nerveView] = encoded.bytes; extension.attributes = encoded.ids;
  for (const accessorIndex of Object.values(primitive.attributes)) document.accessors[accessorIndex].count = verified.attributes.POSITION.length / 3;
  document.accessors[primitive.indices].count = verified.indices.length;
  const positionAccessor = document.accessors[primitive.attributes.POSITION];
  positionAccessor.min = [Infinity, Infinity, Infinity]; positionAccessor.max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < verified.attributes.POSITION.length; i++) {
    positionAccessor.min[i % 3] = Math.min(positionAccessor.min[i % 3], verified.attributes.POSITION[i]);
    positionAccessor.max[i % 3] = Math.max(positionAccessor.max[i % 3], verified.attributes.POSITION[i]);
  }
  node.extras = { ...node.extras, refinement: "Surface-constrained fairing; preserved endpoints and junctions; unchanged growth UVs; finer free tips; no added geometry." };
  const output = writeGlb(document, views);
  fs.writeFileSync(outputPath, output);
  const check = readGlb(outputPath);
  const otherViewsByteIdentical = originalViews.every((view, i) => i === nerveView || view.equals(check.views[i]));
  if (!otherViewsByteIdentical || !source.bytes.equals(fs.readFileSync(sourcePath))) throw new Error("Original asset/head preservation failed");
  reports.push({ variant, source: path.relative(root, sourcePath), output: path.relative(root, outputPath), sourceSha256: hash(source.bytes), sha256: hash(output),
    sourceBytes: source.bytes.length, bytes: output.length, byteChange: output.length - source.bytes.length,
    sourceNerveVertices: sourcePositions.length / 3, nerveVertices: verified.attributes.POSITION.length / 3,
    sourceNerveTriangles: sourceTriangleCount, nerveTriangles: verified.indices.length / 3, nervePrimitives: mesh.primitives.length,
    paths: paths.length, rings: paths.reduce((n, p) => n + p.rings.length, 0), freeTips: paths.filter((p) => p.freeTip).length,
    protectedJunctionRings: paths.reduce((n, p) => n + p.rings.filter((r) => r.junction).length, 0), attachmentMatches: attachments,
    importanceVertexQuantiles: quantiles(Array.from(originalUv).filter((_, i) => i % 2)), importancePathQuantiles: quantiles(paths.map((p) => p.rings[0].energy)),
    ...stats, compressionSpeed: encoded.speed, positionQuantizationBits: 18, normalQuantizationBits: 12, uvQuantizationBits: 20,
    maxUvError, maxEndpointCentreError, maxJunctionVertexError, maxEncodedRadiusGrowth,
    topologyPreserved: true, noAddedAttributes: true, nonNerveBufferViewsByteIdentical: otherViewsByteIdentical, originalAssetUnchanged: true,
  });
}
headGeometry.dispose();
fs.writeFileSync(path.join(root, "scripts/polished-neural-fibres-report.json"), JSON.stringify(reports, null, 2) + "\n");
console.log(JSON.stringify(reports, null, 2));

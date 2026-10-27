/** Refine only the existing fibre tubes; retain all other GLB buffer views byte-for-byte.
 * Run from the repository: node output/neural-mannequin/refine_organic_fibres.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);
const draco = require("draco3d");
const source = path.join(root, "public/models/cymba-neural-mannequin-organic.glb");
const destination = path.join(root, "public/models/cymba-neural-mannequin-organic-detailed.glb");
const reportPath = path.join(root, "output/neural-mannequin/organic-fibres-detailed-report.json");
const hash = (data) => crypto.createHash("sha256").update(data).digest("hex");
const originalBytes = fs.readFileSync(source);
const sourceHash = hash(originalBytes);
const jsonLength = originalBytes.readUInt32LE(12);
const document = JSON.parse(originalBytes.subarray(20, 20 + jsonLength).toString());
const originalBinary = originalBytes.subarray(28 + jsonLength);
const nerveNode = document.nodes.find((node) => node.name === "Purple_Surface_Nerve_Fibres");
if (!nerveNode) throw new Error("Expected the existing organic fibre mesh.");
const primitive = document.meshes[nerveNode.mesh].primitives[0];
const extension = primitive.extensions.KHR_draco_mesh_compression;
const nerveView = extension.bufferView;
const bufferViewBytes = (index) => {
  const view = document.bufferViews[index];
  return originalBinary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
};
const originalViews = document.bufferViews.map((_, index) => Buffer.from(bufferViewBytes(index)));
const decoderModule = await draco.createDecoderModule({});
const encoderModule = await draco.createEncoderModule({});

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

function components(vertexCount, indices) {
  const parents = Uint32Array.from({ length: vertexCount }, (_, index) => index);
  const find = (value) => {
    while (parents[value] !== value) {
      parents[value] = parents[parents[value]];
      value = parents[value];
    }
    return value;
  };
  for (let index = 0; index < indices.length; index += 3) {
    const parent = find(indices[index]);
    parents[find(indices[index + 1])] = parent;
    parents[find(indices[index + 2])] = parent;
  }
  const result = new Map();
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const parent = find(vertex);
    if (!result.has(parent)) result.set(parent, []);
    result.get(parent).push(vertex);
  }
  return [...result.values()];
}

const decoded = decode(originalViews[nerveView], extension.attributes);
const positions = decoded.attributes.POSITION;
const originalPositions = positions.slice();
const uv = decoded.attributes.TEXCOORD_0;
const vertexCount = positions.length / 3;
const paths = components(vertexCount, decoded.indices);
if (paths.length !== 1129) throw new Error(`Unexpected fibre topology: ${paths.length} paths.`);
const seamGroups = [];
let rings = 0;
let minMultiplier = Infinity;
let maxMultiplier = -Infinity;
const smoothstep = (low, high, value) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

for (const vertices of paths) {
  const pathRings = new Map();
  for (const vertex of vertices) {
    const distance = uv[vertex * 2];
    if (!pathRings.has(distance)) pathRings.set(distance, []);
    pathRings.get(distance).push(vertex);
  }
  const orderedRings = [...pathRings.entries()].sort((a, b) => a[0] - b[0]);
  const energy = uv[vertices[0] * 2 + 1];
  // Deterministic phases avoid changing the original seeded branching or centre lines.
  const phase = (energy * 97.31 + orderedRings[0][0] * 173.17) % (Math.PI * 2);
  for (const [growthDistance, ring] of orderedRings) {
    if (ring.length !== 7) throw new Error("Expected six tube sides plus the existing UV seam.");
    rings++;
    const unique = new Map();
    for (const vertex of ring) {
      const key = `${positions[vertex * 3]},${positions[vertex * 3 + 1]},${positions[vertex * 3 + 2]}`;
      if (!unique.has(key)) unique.set(key, []);
      unique.get(key).push(vertex);
    }
    if (unique.size !== 6) throw new Error(`Unexpected ring seam: ${unique.size} distinct positions.`);
    const centre = [0, 0, 0];
    for (const group of unique.values()) {
      for (let axis = 0; axis < 3; axis++) centre[axis] += positions[group[0] * 3 + axis] / 6;
      if (group.length > 1) seamGroups.push(group);
    }
    const radius = Math.max(...ring.map((vertex) => Math.hypot(...centre.map((value, axis) => positions[vertex * 3 + axis] - value))));
    const baseScale = 1.30 + 0.25 * smoothstep(0.0008, 0.0045, radius);
    const distance = (growthDistance - 0.018) / 0.94 * 6.585585539243895;
    // Soft changes in bundle thickness, not added branches or a string of beads.
    const variation = 1 + 0.035 * Math.sin(distance * 14 + phase)
      + 0.018 * Math.sin(distance * 31 + phase * 1.7)
      + 0.025 * Math.exp(-Math.pow(Math.sin(distance * 18 + phase * 0.6) / 0.35, 2));
    const multiplier = baseScale * variation;
    minMultiplier = Math.min(minMultiplier, multiplier);
    maxMultiplier = Math.max(maxMultiplier, multiplier);
    for (const vertex of ring) {
      for (let axis = 0; axis < 3; axis++) {
        positions[vertex * 3 + axis] = centre[axis] + (positions[vertex * 3 + axis] - centre[axis]) * multiplier;
      }
    }
  }
}

// Smooth only the modified tube surface; preserve the six-sided cross-section and seams.
const normalSums = new Float64Array(positions.length);
for (let index = 0; index < decoded.indices.length; index += 3) {
  const ids = [...decoded.indices.subarray(index, index + 3)];
  const a = ids[0] * 3, b = ids[1] * 3, c = ids[2] * 3;
  const ab = [0, 1, 2].map((axis) => positions[b + axis] - positions[a + axis]);
  const ac = [0, 1, 2].map((axis) => positions[c + axis] - positions[a + axis]);
  const normal = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
  for (const vertex of ids) for (let axis = 0; axis < 3; axis++) normalSums[vertex * 3 + axis] += normal[axis];
}
for (const group of seamGroups) {
  const average = [0, 1, 2].map((axis) => group.reduce((sum, vertex) => sum + normalSums[vertex * 3 + axis], 0));
  for (const vertex of group) for (let axis = 0; axis < 3; axis++) normalSums[vertex * 3 + axis] = average[axis];
}
const normals = new Float32Array(positions.length);
for (let vertex = 0; vertex < vertexCount; vertex++) {
  const length = Math.hypot(...normalSums.subarray(vertex * 3, vertex * 3 + 3));
  for (let axis = 0; axis < 3; axis++) normals[vertex * 3 + axis] = length > 1e-12
    ? normalSums[vertex * 3 + axis] / length : decoded.attributes.NORMAL[vertex * 3 + axis];
}

const mesh = new encoderModule.Mesh();
const builder = new encoderModule.MeshBuilder();
builder.AddFacesToMesh(mesh, decoded.indices.length / 3, decoded.indices);
const ids = {
  POSITION: builder.AddFloatAttributeToMesh(mesh, encoderModule.POSITION, vertexCount, 3, positions),
  NORMAL: builder.AddFloatAttributeToMesh(mesh, encoderModule.NORMAL, vertexCount, 3, normals),
  TEXCOORD_0: builder.AddFloatAttributeToMesh(mesh, encoderModule.TEX_COORD, vertexCount, 2, uv),
};
const encoder = new encoderModule.Encoder();
encoder.SetSpeedOptions(4, 4);
encoder.SetEncodingMethod(encoderModule.MESH_EDGEBREAKER_ENCODING);
encoder.SetAttributeQuantization(encoderModule.POSITION, 18);
encoder.SetAttributeQuantization(encoderModule.NORMAL, 12);
encoder.SetAttributeQuantization(encoderModule.TEX_COORD, 20);
const encoded = new encoderModule.DracoInt8Array();
const encodedLength = encoder.EncodeMeshToDracoBuffer(mesh, encoded);
if (encodedLength <= 0) throw new Error("Fibre compression failed.");
const compressed = Buffer.from(Array.from({ length: encodedLength }, (_, index) => encoded.GetValue(index) & 255));
for (const object of [encoded, encoder, builder, mesh]) encoderModule.destroy(object);
const verified = decode(compressed, ids);
if (verified.indices.length !== decoded.indices.length)
  throw new Error("Compression changed the expected fibre triangle count.");
const exportedVertexCount = verified.attributes.POSITION.length / 3;
if (components(exportedVertexCount, verified.indices).length !== paths.length) throw new Error("Fibre paths changed during compression.");
for (const attribute of Object.values(verified.attributes)) if (attribute.some((value) => !Number.isFinite(value))) throw new Error("Invalid fibre data.");
const sortedUv = (values) => [...new Map(Array.from({ length: values.length / 2 }, (_, index) => {
  const pair = [values[index * 2], values[index * 2 + 1]];
  return [pair.join(","), pair];
})).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
const uvBefore = sortedUv(uv), uvAfter = sortedUv(verified.attributes.TEXCOORD_0);
if (uvBefore.length !== uvAfter.length) throw new Error("Growth ring count changed during compression.");
let maxUvError = 0;
for (let index = 0; index < uvBefore.length; index++) for (let axis = 0; axis < 2; axis++)
  maxUvError = Math.max(maxUvError, Math.abs(uvBefore[index][axis] - uvAfter[index][axis]));
if (maxUvError > 0.00001) throw new Error(`Growth UVs changed by ${maxUvError}.`);
extension.attributes = ids;
for (const accessorIndex of Object.values(primitive.attributes)) document.accessors[accessorIndex].count = exportedVertexCount;
const positionAccessor = document.accessors[primitive.attributes.POSITION];
positionAccessor.min = [Infinity, Infinity, Infinity];
positionAccessor.max = [-Infinity, -Infinity, -Infinity];
for (let index = 0; index < verified.attributes.POSITION.length; index++) {
  const axis = index % 3;
  positionAccessor.min[axis] = Math.min(positionAccessor.min[axis], verified.attributes.POSITION[index]);
  positionAccessor.max[axis] = Math.max(positionAccessor.max[axis], verified.attributes.POSITION[index]);
}

const chunks = [];
let offset = 0;
for (let index = 0; index < document.bufferViews.length; index++) {
  const bytes = index === nerveView ? compressed : originalViews[index];
  document.bufferViews[index].byteOffset = offset;
  document.bufferViews[index].byteLength = bytes.length;
  chunks.push(bytes, Buffer.alloc((4 - bytes.length % 4) % 4));
  offset += bytes.length + (4 - bytes.length % 4) % 4;
}
document.buffers[0].byteLength = offset;
nerveNode.extras = { ...nerveNode.extras, refinement: "Original paths; fuller tapered fibres with restrained organic radius variation." };
const json = Buffer.from(JSON.stringify(document));
const paddedJson = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
const binary = Buffer.concat(chunks);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + paddedJson.length + binary.length, 8);
header.writeUInt32LE(paddedJson.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
const binaryHeader = Buffer.alloc(8);
binaryHeader.writeUInt32LE(binary.length, 0); binaryHeader.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(destination, Buffer.concat([header, paddedJson, binaryHeader, binary]));

const allOtherViewsPreserved = originalViews.every((bytes, index) => index === nerveView
  || hash(bytes) === hash(binary.subarray(document.bufferViews[index].byteOffset,
    document.bufferViews[index].byteOffset + document.bufferViews[index].byteLength)));
if (!allOtherViewsPreserved || hash(fs.readFileSync(source)) !== sourceHash) throw new Error("Original data preservation check failed.");
let maxDisplacement = 0;
for (let vertex = 0; vertex < vertexCount; vertex++) maxDisplacement = Math.max(maxDisplacement,
  Math.hypot(...[0, 1, 2].map((axis) => positions[vertex * 3 + axis] - originalPositions[vertex * 3 + axis])));
const report = {
  source, destination, sourceSha256: sourceHash, sha256: hash(fs.readFileSync(destination)),
  sourceBytes: originalBytes.length, bytes: fs.statSync(destination).size,
  paths: paths.length, rings, sourceFibreVertices: vertexCount, fibreVertices: exportedVertexCount,
  fibreTriangles: decoded.indices.length / 3,
  meshes: document.meshes.length, materials: document.materials.length,
  mainRadiusScale: 1.55, fineRadiusScale: 1.30,
  appliedScaleRange: [minMultiplier, maxMultiplier], maxVertexDisplacement: maxDisplacement,
  maxUvError, headGeometryAndAllTexturesByteIdentical: allOtherViewsPreserved,
  originalGlbUnchanged: true, originalBlendUnchanged: "Not opened or written",
  centreLinesUnchangedBeforeCompression: true, topologyUnchanged: true,
  notes: "UV.x remains inherited growth distance, UV.y remains fibre energy. Identical seam vertices are welded by Draco after normal averaging. No new branches or render passes.",
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));

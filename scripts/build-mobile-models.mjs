/**
 * Produce mobile geometry without lowering texture resolution or changing the
 * original models. Run: node scripts/build-mobile-models.mjs
 * Draco and meshoptimizer are already dependencies of the 3D toolchain.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import draco from "draco3d";
import { MeshoptSimplifier } from "meshoptimizer";

const root = fileURLToPath(new URL("../", import.meta.url));
const decoderModule = await draco.createDecoderModule({});
const encoderModule = await draco.createEncoderModule({});
await MeshoptSimplifier.ready;
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const sizes = { POSITION: 3, NORMAL: 3, TEXCOORD_0: 2 };

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

function encode({ attributes, indices }) {
  const vertexCount = attributes.POSITION.length / 3;
  const mesh = new encoderModule.Mesh();
  const builder = new encoderModule.MeshBuilder();
  builder.AddFacesToMesh(mesh, indices.length / 3, indices);
  const ids = {
    POSITION: builder.AddFloatAttributeToMesh(mesh, encoderModule.POSITION, vertexCount, 3, attributes.POSITION),
    NORMAL: builder.AddFloatAttributeToMesh(mesh, encoderModule.NORMAL, vertexCount, 3, attributes.NORMAL),
    TEXCOORD_0: builder.AddFloatAttributeToMesh(mesh, encoderModule.TEX_COORD, vertexCount, 2, attributes.TEXCOORD_0),
  };
  const encoder = new encoderModule.Encoder();
  encoder.SetSpeedOptions(4, 4);
  encoder.SetEncodingMethod(encoderModule.MESH_EDGEBREAKER_ENCODING);
  encoder.SetAttributeQuantization(encoderModule.POSITION, 18);
  encoder.SetAttributeQuantization(encoderModule.NORMAL, 12);
  encoder.SetAttributeQuantization(encoderModule.TEX_COORD, 20);
  const encoded = new encoderModule.DracoInt8Array();
  const length = encoder.EncodeMeshToDracoBuffer(mesh, encoded);
  if (length <= 0) throw new Error("Mobile mesh compression failed.");
  const bytes = Buffer.from(Array.from({ length }, (_, index) => encoded.GetValue(index) & 255));
  for (const object of [encoded, encoder, builder, mesh]) encoderModule.destroy(object);
  return { bytes, ids };
}

function components(indices, vertexCount) {
  const parent = Uint32Array.from({ length: vertexCount }, (_, index) => index);
  const find = (v) => {
    while (parent[v] !== v) { parent[v] = parent[parent[v]]; v = parent[v]; }
    return v;
  };
  for (let i = 0; i < indices.length; i += 3) {
    const p = find(indices[i]);
    parent[find(indices[i + 1])] = p;
    parent[find(indices[i + 2])] = p;
  }
  const groups = new Map();
  for (const v of new Set(indices)) {
    const p = find(v);
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push(v);
  }
  return [...groups.values()];
}
const componentCount = (indices, vertexCount) => components(indices, vertexCount).length;

function simplifyFibres(decoded) {
  const { POSITION: positions, NORMAL: normals, TEXCOORD_0: uv } = decoded.attributes;
  const paths = components(decoded.indices, positions.length / 3);
  const output = { POSITION: [], NORMAL: [], TEXCOORD_0: [] }, indices = [];
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const normalize = (a) => a.map((v) => v / Math.max(1e-10, Math.hypot(...a)));
  let sourceRings = 0, keptRings = 0, maxCentreError = 0;
  for (const pathVertices of paths) {
    const groups = new Map();
    for (const v of pathVertices) {
      const distance = uv[v * 2];
      if (!groups.has(distance)) groups.set(distance, []);
      groups.get(distance).push(v);
    }
    const rings = [...groups.entries()].sort(([a], [b]) => a - b).map(([distance, vertices]) => {
      if (vertices.length !== 6) throw new Error(`Expected six-sided fibre rings; found ${vertices.length}`);
      const centre = [0, 1, 2].map((axis) => vertices.reduce((sum, v) => sum + positions[v * 3 + axis], 0) / 6);
      const radius = Math.max(...vertices.map((v) => Math.hypot(...sub([...positions.subarray(v * 3, v * 3 + 3)], centre))));
      return { distance, vertices, centre, radius };
    });
    // Reduce only samples along a tube. Keep every branch, all six sides, the
    // original endpoint rings and normals, and growth-distance/energy UVs.
    const keep = new Set([0, rings.length - 1]);
    function select(first, last) {
      if (last - first < 2) return;
      const start = rings[first], end = rings[last];
      let worst = 1, selected = -1;
      for (let i = first + 1; i < last; i++) {
        const ring = rings[i];
        const t = (ring.distance - start.distance) / (end.distance - start.distance);
        const expected = start.centre.map((v, axis) => v + (end.centre[axis] - v) * t);
        const centreError = Math.hypot(...sub(ring.centre, expected));
        const radiusError = Math.abs(ring.radius - (start.radius + (end.radius - start.radius) * t));
        const error = Math.max(centreError / 0.0015, radiusError / 0.00025);
        if (error > worst) { worst = error; selected = i; }
      }
      if (selected >= 0) { keep.add(selected); select(first, selected); select(selected, last); }
    }
    select(0, rings.length - 1);
    const selected = [...keep].sort((a, b) => a - b);
    for (let j = 0; j < selected.length - 1; j++) {
      const a = rings[selected[j]], b = rings[selected[j + 1]];
      for (let i = selected[j] + 1; i < selected[j + 1]; i++) {
        const t = (rings[i].distance - a.distance) / (b.distance - a.distance);
        maxCentreError = Math.max(maxCentreError, Math.hypot(...rings[i].centre.map((v, axis) => v - a.centre[axis] - (b.centre[axis] - a.centre[axis]) * t)));
      }
    }
    sourceRings += rings.length; keptRings += selected.length;
    let previousRadials = null;
    const pathBase = output.POSITION.length / 3;
    for (const selectedIndex of selected) {
      const ring = rings[selectedIndex];
      const tangent = normalize(sub(rings[Math.min(selectedIndex + 1, rings.length - 1)].centre, rings[Math.max(selectedIndex - 1, 0)].centre));
      const axisX = normalize(sub([...positions.subarray(ring.vertices[0] * 3, ring.vertices[0] * 3 + 3)], ring.centre));
      const axisY = normalize(cross(tangent, axisX));
      let ordered = ring.vertices.map((v) => ({ v, radial: normalize(sub([...positions.subarray(v * 3, v * 3 + 3)], ring.centre)) }));
      ordered.sort((a, b) => Math.atan2(dot(a.radial, axisY), dot(a.radial, axisX)) - Math.atan2(dot(b.radial, axisY), dot(b.radial, axisX)));
      if (previousRadials) {
        let best = 0, bestScore = -Infinity;
        for (let shift = 0; shift < 6; shift++) {
          const score = ordered.reduce((sum, _, i) => sum + dot(ordered[(i + shift) % 6].radial, previousRadials[i]), 0);
          if (score > bestScore) { best = shift; bestScore = score; }
        }
        ordered = ordered.map((_, i) => ordered[(i + best) % 6]);
      }
      previousRadials = ordered.map(({ radial }) => radial);
      for (const { v } of ordered) {
        output.POSITION.push(...positions.subarray(v * 3, v * 3 + 3));
        output.NORMAL.push(...normals.subarray(v * 3, v * 3 + 3));
        output.TEXCOORD_0.push(...uv.subarray(v * 2, v * 2 + 2));
      }
    }
    for (let ring = 0; ring < selected.length - 1; ring++) for (let side = 0; side < 6; side++) {
      const a = pathBase + ring * 6 + side, b = pathBase + ring * 6 + (side + 1) % 6;
      const c = b + 6, d = a + 6;
      indices.push(a, b, c, a, c, d);
    }
  }
  return { attributes: Object.fromEntries(Object.entries(output).map(([name, values]) => [name, Float32Array.from(values)])), indices: Uint32Array.from(indices),
    measuredError: maxCentreError, sourceRings, keptRings, paths: paths.length };
}

function simplify(decoded, { ratio, error, weights }) {
  const { POSITION: positions, NORMAL: normals, TEXCOORD_0: uv } = decoded.attributes;
  const vertexCount = positions.length / 3;
  const attributes = new Float32Array(vertexCount * 5);
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    attributes.set(normals.subarray(vertex * 3, vertex * 3 + 3), vertex * 5);
    attributes.set(uv.subarray(vertex * 2, vertex * 2 + 2), vertex * 5 + 3);
  }
  // Keep seam constraints, open tube ends and every disconnected fibre. No
  // component pruning, permissive seam merging or texture downsampling.
  const [indices, measuredError] = MeshoptSimplifier.simplifyWithAttributes(
    decoded.indices, positions, 3, attributes, 5, weights, null,
    Math.floor(decoded.indices.length / 3 * ratio) * 3, error, ["LockBorder"],
  );
  const [remap, count] = MeshoptSimplifier.compactMesh(indices);
  const compact = {};
  for (const [name, values] of Object.entries(decoded.attributes)) {
    const size = sizes[name];
    if (!size) throw new Error(`Unsupported attribute ${name}`);
    compact[name] = new Float32Array(count * size);
    for (let vertex = 0; vertex < remap.length; vertex++) {
      if (remap[vertex] !== 0xffffffff) compact[name].set(values.subarray(vertex * size, vertex * size + size), remap[vertex] * size);
    }
  }
  return { attributes: compact, indices, measuredError };
}

function bounds(values, size) {
  const min = Array(size).fill(Infinity), max = Array(size).fill(-Infinity);
  for (let i = 0; i < values.length; i++) {
    min[i % size] = Math.min(min[i % size], values[i]);
    max[i % size] = Math.max(max[i % size], values[i]);
  }
  return { min, max };
}

const reports = [];
for (const name of ["cymba-earbuds-hero", "cymba-neural-mannequin-organic-detailed"]) {
  const source = path.join(root, `public/models/${name}.glb`);
  const destination = path.join(root, `public/models/${name}-mobile.glb`);
  const original = fs.readFileSync(source);
  const jsonLength = original.readUInt32LE(12);
  const document = JSON.parse(original.subarray(20, 20 + jsonLength));
  const binary = original.subarray(28 + jsonLength);
  const originalViews = document.bufferViews.map((v) => binary.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
  const replacements = new Map();
  const meshes = [];
  for (let meshIndex = 0; meshIndex < document.meshes.length; meshIndex++) {
    const mesh = document.meshes[meshIndex];
    const nodeName = document.nodes.find((node) => node.mesh === meshIndex)?.name ?? mesh.name;
    const fibre = nodeName.includes("Fibres");
    for (const primitive of mesh.primitives) {
      const extension = primitive.extensions.KHR_draco_mesh_compression;
      const originalMesh = decode(originalViews[extension.bufferView], extension.attributes);
      const settings = name.includes("earbuds")
          ? { ratio: 0.28, error: 0.0012, weights: [0.1, 0.1, 0.1, 1, 1] }
          : { ratio: 0.25, error: 0.001, weights: [0.1, 0.1, 0.1, 1, 1] };
      const mobileMesh = fibre ? simplifyFibres(originalMesh) : simplify(originalMesh, settings);
      const encoded = encode(mobileMesh);
      const verified = decode(encoded.bytes, encoded.ids);
      const sourceComponents = componentCount(originalMesh.indices, originalMesh.attributes.POSITION.length / 3);
      const outputComponents = componentCount(verified.indices, verified.attributes.POSITION.length / 3);
      if (verified.indices.length !== mobileMesh.indices.length || (fibre && sourceComponents !== outputComponents))
        throw new Error(`Mobile topology validation failed for ${nodeName}: ${sourceComponents} -> ${outputComponents}`);
      for (const values of Object.values(verified.attributes)) if (values.some((v) => !Number.isFinite(v))) throw new Error("Invalid mobile vertex data");
      extension.attributes = encoded.ids;
      replacements.set(extension.bufferView, encoded.bytes);
      const count = verified.attributes.POSITION.length / 3;
      for (const [attribute, accessorIndex] of Object.entries(primitive.attributes)) {
        const accessor = document.accessors[accessorIndex];
        accessor.count = count;
        if (attribute === "POSITION") Object.assign(accessor, bounds(verified.attributes.POSITION, 3));
      }
      document.accessors[primitive.indices].count = verified.indices.length;
      document.accessors[primitive.indices].componentType = count > 65535 ? 5125 : 5123;
      meshes.push({ name: nodeName, trianglesBefore: originalMesh.indices.length / 3, triangles: verified.indices.length / 3,
        verticesBefore: originalMesh.attributes.POSITION.length / 3, vertices: count,
        componentsBefore: sourceComponents, components: outputComponents,
        ...(fibre ? { maxCentreError: mobileMesh.measuredError, sourceRings: mobileMesh.sourceRings, keptRings: mobileMesh.keptRings } : { relativeError: mobileMesh.measuredError }),
        uvBefore: bounds(originalMesh.attributes.TEXCOORD_0, 2), uv: bounds(verified.attributes.TEXCOORD_0, 2),
        settings: fibre ? { method: "resample along original six-sided tubes", centreTolerance: 0.0015, radiusTolerance: 0.00025 } : settings });
    }
  }
  let offset = 0;
  const chunks = originalViews.map((originalView, index) => {
    const bytes = replacements.get(index) ?? originalView;
    document.bufferViews[index].byteOffset = offset;
    document.bufferViews[index].byteLength = bytes.length;
    const padded = Buffer.concat([bytes, Buffer.alloc((4 - bytes.length % 4) % 4)]);
    offset += padded.length;
    return padded;
  });
  document.buffers[0].byteLength = offset;
  const json = Buffer.from(JSON.stringify(document));
  const paddedJson = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const outputBinary = Buffer.concat(chunks);
  const header = Buffer.alloc(20), binaryHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + paddedJson.length + outputBinary.length, 8);
  header.writeUInt32LE(paddedJson.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  binaryHeader.writeUInt32LE(outputBinary.length, 0); binaryHeader.writeUInt32LE(0x004e4942, 4);
  const output = Buffer.concat([header, paddedJson, binaryHeader, outputBinary]);
  fs.writeFileSync(destination, output);
  const texturesUnchanged = originalViews.every((bytes, index) => replacements.has(index) || bytes.equals(outputBinary.subarray(document.bufferViews[index].byteOffset, document.bufferViews[index].byteOffset + document.bufferViews[index].byteLength)));
  if (!texturesUnchanged || !original.equals(fs.readFileSync(source))) throw new Error("Original asset preservation failed");
  reports.push({ source: path.relative(root, source), destination: path.relative(root, destination), sourceSha256: hash(original), sha256: hash(output),
    sourceBytes: original.length, bytes: output.length, trianglesBefore: meshes.reduce((n, m) => n + m.trianglesBefore, 0), triangles: meshes.reduce((n, m) => n + m.triangles, 0),
    allTexturesByteIdentical: texturesUnchanged, originalUnchanged: true, meshes });
}
fs.writeFileSync(path.join(root, "scripts/mobile-models-report.json"), JSON.stringify(reports, null, 2) + "\n");
console.log(JSON.stringify(reports, null, 2));

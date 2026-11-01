/**
 * Compact delivery copies of the hero models, for faster loading with the same picture.
 *
 * Reads the finished delivery files (the earbuds and the stimulated mannequin, desktop and
 * phone) and writes a `-compact.glb` beside each one:
 *   - Draco geometry is re-encoded with quantization matched to what a screen can show
 *     (positions 14 bits: 0.00026 of the bust's height, under a tenth of a device pixel at
 *     any size the head is drawn; normals 11 bits; texture coordinates 16 bits), instead of
 *     the 18/12/20 bits of the source files.
 *   - The cortical arbors keep every path but drop half of their tube triangles with a
 *     meshoptimizer pass bounded to about half a device pixel of error; their UV channel
 *     (growth distance, arbor id and importance) is untouched, so the signal animation is
 *     identical.
 *   - The earbud atlas textures are stored as WebP (EXT_texture_webp) at quality 90 instead
 *     of JPEG, decoding to within about one level of the current texels before filtering.
 * The sculpture, brain, brainstem and ear signal meshes keep every triangle. Node and mesh
 * extras (cable anchors, provenance, the pre-smoothed-normals flag) are preserved.
 *
 * Rebuild: node scripts/build-compact-models.mjs
 * Then copy each `versionKey` from scripts/compact-models-report.json into
 * src/lib/product-asset-urls.ts and src/app/page.tsx.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import draco from "draco3d";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const modelsDir = path.join(root, "public/models");
const decoderModule = await draco.createDecoderModule({});
const encoderModule = await draco.createEncoderModule({});
await MeshoptSimplifier.ready;

const QUANTIZATION = { POSITION: 14, NORMAL: 11, TEX_COORD: 16 };
const WEBP_QUALITY = 90;
/** Per file: which meshes to simplify (triangle ratio, relative error bound) and whether to convert textures. */
const JOBS = [
  { source: "cymba-earbuds-hero.glb", textures: true },
  { source: "cymba-earbuds-hero-mobile.glb", textures: true },
  { source: "cymba-stimulated-mannequin-desktop.glb", simplify: { Cortical_Neural_Arbors: { ratio: 0.5, error: 0.0005 } } },
  { source: "cymba-stimulated-mannequin-mobile.glb", simplify: { Cortical_Neural_Arbors: { ratio: 0.5, error: 0.0008 } } },
];

const pad4 = (bytes, fill = 0) => Buffer.concat([bytes, Buffer.alloc((4 - (bytes.length % 4)) % 4, fill)]);
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

function readGlb(file) {
  const bytes = fs.readFileSync(file);
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binary = bytes.subarray(28 + jsonLength);
  const views = json.bufferViews.map((view) => Buffer.from(binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)));
  return { bytes, json, views };
}

function writeGlb(json, views) {
  let offset = 0;
  const chunks = views.map((view, index) => {
    json.bufferViews[index].byteOffset = offset;
    json.bufferViews[index].byteLength = view.length;
    const padded = pad4(view);
    offset += padded.length;
    return padded;
  });
  const binary = Buffer.concat(chunks);
  json.buffers = [{ byteLength: binary.length }];
  const text = pad4(Buffer.from(JSON.stringify(json)), 0x20);
  const header = Buffer.alloc(12);
  header.write("glTF", 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + text.length + 8 + binary.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(text.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binary.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, text, binHeader, binary]);
}

function decode(bytes, attributeIds) {
  const decoder = new decoderModule.Decoder();
  const buffer = new decoderModule.DecoderBuffer();
  buffer.Init(new Int8Array(bytes), bytes.length);
  const mesh = new decoderModule.Mesh();
  const status = decoder.DecodeBufferToMesh(buffer, mesh);
  if (!status.ok()) throw new Error(status.error_msg());
  const count = mesh.num_points();
  const attributes = {};
  for (const [name, id] of Object.entries(attributeIds)) {
    const attribute = decoder.GetAttributeByUniqueId(mesh, id);
    const values = new decoderModule.DracoFloat32Array();
    decoder.GetAttributeFloatForAllPoints(mesh, attribute, values);
    const components = attribute.num_components();
    const data = new Float32Array(count * components);
    for (let i = 0; i < data.length; i++) data[i] = values.GetValue(i);
    attributes[name] = { data, components };
    decoderModule.destroy(values);
  }
  const indices = new Uint32Array(mesh.num_faces() * 3);
  const face = new decoderModule.DracoInt32Array();
  for (let i = 0; i < mesh.num_faces(); i++) {
    decoder.GetFaceFromMesh(mesh, i, face);
    for (let j = 0; j < 3; j++) indices[i * 3 + j] = face.GetValue(j);
  }
  for (const item of [face, mesh, buffer, decoder]) decoderModule.destroy(item);
  return { attributes, indices, count };
}

/** Keep only the vertices the (simplified) index buffer still references. */
function compact({ attributes, indices }) {
  const remap = new Int32Array(attributes.POSITION.data.length / 3).fill(-1);
  let next = 0;
  const remapped = new Uint32Array(indices.length);
  for (let i = 0; i < indices.length; i++) {
    const vertex = indices[i];
    if (remap[vertex] === -1) remap[vertex] = next++;
    remapped[i] = remap[vertex];
  }
  const out = {};
  for (const [name, { data, components }] of Object.entries(attributes)) {
    const packed = new Float32Array(next * components);
    for (let vertex = 0; vertex < remap.length; vertex++) {
      const target = remap[vertex];
      if (target === -1) continue;
      for (let c = 0; c < components; c++) packed[target * components + c] = data[vertex * components + c];
    }
    out[name] = { data: packed, components };
  }
  return { attributes: out, indices: remapped, count: next };
}

function simplify(decoded, { ratio, error }) {
  const target = Math.floor((decoded.indices.length / 3) * ratio) * 3;
  const [indices, measuredError] = MeshoptSimplifier.simplify(decoded.indices, decoded.attributes.POSITION.data, 3, target, error, ["LockBorder"]);
  return { result: compact({ attributes: decoded.attributes, indices }), measuredError };
}

function encode({ attributes, indices, count }) {
  const mesh = new encoderModule.Mesh();
  const builder = new encoderModule.MeshBuilder();
  builder.AddFacesToMesh(mesh, indices.length / 3, indices);
  const ids = {};
  for (const [name, { data, components }] of Object.entries(attributes)) {
    const kind = name === "POSITION" ? "POSITION" : name === "NORMAL" ? "NORMAL" : name.startsWith("TEXCOORD") ? "TEX_COORD" : "GENERIC";
    ids[name] = builder.AddFloatAttributeToMesh(mesh, encoderModule[kind], count, components, data);
  }
  const encoder = new encoderModule.Encoder();
  // Speed 3 produced the smallest files of the tested settings for these meshes.
  encoder.SetSpeedOptions(3, 3);
  encoder.SetEncodingMethod(encoderModule.MESH_EDGEBREAKER_ENCODING);
  for (const [kind, bits] of Object.entries(QUANTIZATION)) encoder.SetAttributeQuantization(encoderModule[kind], bits);
  const output = new encoderModule.DracoInt8Array();
  const size = encoder.EncodeMeshToDracoBuffer(mesh, output);
  if (size <= 0) throw new Error("Unable to encode geometry");
  const bytes = Buffer.alloc(size);
  for (let i = 0; i < size; i++) bytes[i] = output.GetValue(i) & 255;
  for (const item of [output, encoder, builder, mesh]) encoderModule.destroy(item);
  return { bytes, ids };
}

function bounds(data, components) {
  const min = Array(components).fill(Infinity), max = Array(components).fill(-Infinity);
  for (let i = 0; i < data.length; i += components) {
    for (let c = 0; c < components; c++) { min[c] = Math.min(min[c], data[i + c]); max[c] = Math.max(max[c], data[i + c]); }
  }
  return { min, max };
}

async function build(job) {
  const sourcePath = path.join(modelsDir, job.source);
  const target = job.source.replace(/\.glb$/, "-compact.glb");
  const { bytes: sourceBytes, json, views } = readGlb(sourcePath);
  const report = { source: job.source, output: target, sourceBytes: sourceBytes.length, meshes: [], textures: [] };
  for (const mesh of json.meshes) {
    for (const primitive of mesh.primitives) {
      const extension = primitive.extensions?.KHR_draco_mesh_compression;
      if (!extension) throw new Error(`${job.source}: ${mesh.name} is not Draco compressed`);
      const sourceView = views[extension.bufferView];
      let decoded = decode(sourceView, extension.attributes);
      const sourceTriangles = decoded.indices.length / 3;
      let simplification = null;
      const settings = job.simplify?.[mesh.name];
      if (settings) {
        const { result, measuredError } = simplify(decoded, settings);
        decoded = result;
        simplification = { ...settings, measuredError };
      }
      const encoded = encode(decoded);
      // Verify the re-encoded buffer decodes with every triangle. Draco merges vertices that
      // quantize to the same values, so the accessors describe what the decoder produces.
      const verified = decode(encoded.bytes, encoded.ids);
      if (verified.indices.length !== decoded.indices.length) throw new Error(`${mesh.name}: re-encoded geometry lost triangles`);
      views[extension.bufferView] = encoded.bytes;
      extension.attributes = encoded.ids;
      for (const [name, accessorIndex] of Object.entries(primitive.attributes)) {
        const accessor = json.accessors[accessorIndex];
        accessor.count = verified.count;
        if (accessor.min && accessor.max) {
          const { min, max } = bounds(verified.attributes[name].data, verified.attributes[name].components);
          accessor.min = min; accessor.max = max;
        }
      }
      if (primitive.indices != null) json.accessors[primitive.indices].count = verified.indices.length;
      report.meshes.push({ name: mesh.name, sourceBytes: sourceView.length, bytes: encoded.bytes.length, sourceTriangles, triangles: verified.indices.length / 3, sourceVertices: decoded.count, vertices: verified.count, simplification });
    }
  }
  if (job.textures && json.images?.length) {
    const converted = new Set();
    for (const [index, image] of json.images.entries()) {
      const sourceView = views[image.bufferView];
      const meta = await sharp(sourceView).metadata();
      const webp = await sharp(sourceView).webp({ quality: WEBP_QUALITY, effort: 6 }).toBuffer();
      // A JPEG that WebP cannot shrink by at least 15% stays as it is: no change for no gain.
      const keep = webp.length > sourceView.length * 0.85;
      // Measure the texel change against the decoded source before filtering.
      const before = await sharp(sourceView).raw().toBuffer();
      const after = await sharp(webp).raw().toBuffer();
      let sum = 0, max = 0;
      for (let i = 0; i < before.length; i++) { const d = Math.abs(before[i] - after[i]); sum += d; if (d > max) max = d; }
      if (!keep) {
        views[image.bufferView] = webp;
        image.mimeType = "image/webp";
        converted.add(index);
      }
      report.textures.push({ image: index, size: `${meta.width}x${meta.height}`, sourceFormat: meta.format, sourceBytes: sourceView.length, bytes: keep ? sourceView.length : webp.length, converted: !keep, meanTexelDelta: keep ? 0 : +(sum / before.length).toFixed(3), maxTexelDelta: keep ? 0 : max });
    }
    if (converted.size) {
      for (const texture of json.textures) {
        if (!converted.has(texture.source)) continue;
        texture.extensions = { ...texture.extensions, EXT_texture_webp: { source: texture.source } };
        delete texture.source;
      }
      json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), "EXT_texture_webp"])];
      json.extensionsRequired = [...new Set([...(json.extensionsRequired ?? []), "EXT_texture_webp"])];
    }
  }
  const output = writeGlb(json, views);
  fs.writeFileSync(path.join(modelsDir, target), output);
  report.bytes = output.length;
  report.versionKey = sha(output).slice(0, 8);
  return report;
}

const reports = [];
for (const job of JOBS) {
  const report = await build(job);
  reports.push(report);
  console.log(`${report.source} ${(report.sourceBytes / 1024).toFixed(0)} KB -> ${report.output} ${(report.bytes / 1024).toFixed(0)} KB (v=${report.versionKey})`);
  for (const mesh of report.meshes) console.log(`  ${mesh.name}: ${(mesh.sourceBytes / 1024).toFixed(0)} -> ${(mesh.bytes / 1024).toFixed(0)} KB, ${mesh.sourceTriangles} -> ${mesh.triangles} tris${mesh.simplification ? ` (error ${mesh.simplification.measuredError.toExponential(2)})` : ""}`);
  for (const texture of report.textures) console.log(`  texture ${texture.image} ${texture.size}: ${(texture.sourceBytes / 1024).toFixed(0)} KB ${texture.sourceFormat}${texture.converted ? ` -> ${(texture.bytes / 1024).toFixed(0)} KB webp, texel delta mean ${texture.meanTexelDelta} max ${texture.maxTexelDelta}` : " kept"}`);
}
fs.writeFileSync(path.join(root, "scripts/compact-models-report.json"), JSON.stringify({ generated: new Date().toISOString(), quantization: QUANTIZATION, webpQuality: WEBP_QUALITY, models: reports }, null, 2) + "\n");

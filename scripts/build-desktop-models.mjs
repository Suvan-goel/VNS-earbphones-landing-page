/**
 * Produce the desktop head without the embedded textures the page never
 * samples. Mannequin.tsx replaces the base colour, normal and roughness maps
 * with its own stone maps (public/models/cymba-sculpture-*.webp), so the
 * 2.5 MB of images inside the source file were downloaded and decoded for
 * nothing. Geometry bytes are copied unchanged; the source file is not
 * modified. Run with Node 22+: node scripts/build-desktop-models.mjs
 * (validation: scripts/desktop-models-report.json).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const pad4 = (bytes, fill = 0) => Buffer.concat([bytes, Buffer.alloc((4 - bytes.length % 4) % 4, fill)]);

function readGlb(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) throw new Error("Not a glTF 2 binary");
  const jsonLength = bytes.readUInt32LE(12);
  if (bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error("The first chunk must be JSON");
  const document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binaryStart = 20 + jsonLength;
  if (bytes.readUInt32LE(binaryStart + 4) !== 0x004e4942) throw new Error("The second chunk must be BIN");
  const binaryLength = bytes.readUInt32LE(binaryStart);
  return { document, binary: bytes.subarray(binaryStart + 8, binaryStart + 8 + binaryLength) };
}

function writeGlb(document, binary) {
  const json = pad4(Buffer.from(JSON.stringify(document)), 32);
  const header = Buffer.alloc(20), binaryHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + binary.length, 8);
  header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  binaryHeader.writeUInt32LE(binary.length, 0); binaryHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, json, binaryHeader, binary]);
}

/** Drop every material texture reference, then the textures, images and samplers nothing uses any more. */
function stripTextures(document) {
  let references = 0;
  const strip = (value) => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key.endsWith("Texture") && child && Number.isInteger(child.index)) { delete value[key]; references++; }
      else strip(child);
    }
  };
  strip(document.materials);
  const imageViews = (document.images ?? []).map((image) => image.bufferView).filter(Number.isInteger);
  const removed = { references, textures: document.textures?.length ?? 0, images: document.images?.length ?? 0, samplers: document.samplers?.length ?? 0 };
  delete document.textures;
  delete document.images;
  delete document.samplers;
  // An extension that only described textures (for example KHR_texture_transform) is no longer used.
  const body = JSON.stringify({ ...document, extensionsUsed: undefined, extensionsRequired: undefined });
  for (const key of ["extensionsUsed", "extensionsRequired"]) {
    if (document[key]) document[key] = document[key].filter((name) => body.includes(`"${name}"`));
  }
  return { removedViews: new Set(imageViews), removed };
}

const reports = [];
for (const name of ["cymba-neural-mannequin-organic-detailed"]) {
  const source = path.join(root, "public/models", `${name}.glb`);
  const destination = path.join(root, "public/models", `${name}-desktop.glb`);
  const original = fs.readFileSync(source);
  const { document, binary } = readGlb(original);
  if (document.animations?.length || document.skins?.length || document.buffers.length !== 1) throw new Error("Unexpected glTF content");
  const originalViews = document.bufferViews.map((view) => binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength));
  const { removedViews, removed } = stripTextures(document);
  // Repack the binary chunk without the image views; every other view keeps its exact bytes.
  const viewMap = new Map();
  const bufferViews = [];
  const chunks = [];
  let offset = 0;
  originalViews.forEach((bytes, index) => {
    if (removedViews.has(index)) return;
    const view = { ...document.bufferViews[index], byteOffset: offset, byteLength: bytes.length };
    viewMap.set(index, bufferViews.length);
    bufferViews.push(view);
    const padded = pad4(bytes);
    offset += padded.length;
    chunks.push(padded);
  });
  document.bufferViews = bufferViews;
  const remap = (holder) => {
    if (holder && Number.isInteger(holder.bufferView)) {
      if (!viewMap.has(holder.bufferView)) throw new Error("A removed buffer view is still referenced");
      holder.bufferView = viewMap.get(holder.bufferView);
    }
  };
  for (const accessor of document.accessors) { remap(accessor); remap(accessor.sparse?.indices); remap(accessor.sparse?.values); }
  for (const mesh of document.meshes) for (const primitive of mesh.primitives) remap(primitive.extensions?.KHR_draco_mesh_compression);
  document.buffers[0].byteLength = offset;
  const outputBinary = Buffer.concat(chunks);
  const output = writeGlb(document, outputBinary);
  fs.writeFileSync(destination, output);
  // Verify: the written file parses, the kept views are byte-identical and the source is untouched.
  const check = readGlb(fs.readFileSync(destination));
  const geometryUnchanged = originalViews.every((bytes, index) => {
    if (removedViews.has(index)) return true;
    const view = check.document.bufferViews[viewMap.get(index)];
    return bytes.equals(check.binary.subarray(view.byteOffset, view.byteOffset + view.byteLength));
  });
  if (!geometryUnchanged || check.document.textures || check.document.images || !original.equals(fs.readFileSync(source))) throw new Error("Original asset preservation failed");
  reports.push({
    source: path.relative(root, source), destination: path.relative(root, destination),
    sourceSha256: hash(original), sha256: hash(output), versionKey: hash(output).slice(0, 8),
    sourceBytes: original.length, bytes: output.length,
    removed: { ...removed, bytes: [...removedViews].reduce((n, index) => n + originalViews[index].length, 0) },
    extensionsUsed: check.document.extensionsUsed ?? [], materials: check.document.materials.map((material) => material.name),
    geometryByteIdentical: geometryUnchanged, originalUnchanged: true,
  });
}
fs.writeFileSync(path.join(root, "scripts/desktop-models-report.json"), JSON.stringify(reports, null, 2) + "\n");
console.log(JSON.stringify(reports, null, 2));

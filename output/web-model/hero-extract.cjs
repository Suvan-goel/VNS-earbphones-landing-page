const fs = require('node:fs');
const path = require('node:path');
const { Matrix4, Vector3, Quaternion, Box3 } = require('three');
const makeDecoder = require('../../public/draco/draco_decoder.js');
const root = path.resolve(__dirname, '../..');
const src = fs.readFileSync(path.join(root, 'public/models/cymba-wired-assembly-web.glb'));
const len = src.readUInt32LE(12);
const doc = JSON.parse(src.subarray(20, 20 + len));
const bin = src.subarray(28 + len);
const clone = item => JSON.parse(JSON.stringify(item));
const result = { asset: { ...doc.asset, extras: { purpose: 'Original paired earbuds for the hero; complete assembly preserved separately.' } }, scene: 0, scenes: [{ name: 'Paired cymba earbuds', nodes: [0,1] }], nodes: [], meshes: [], accessors: [], materials: [], textures: clone(doc.textures), samplers: clone(doc.samplers), images: clone(doc.images), bufferViews: [], buffers: [], extensionsUsed: ['KHR_draco_mesh_compression'], extensionsRequired: ['KHR_draco_mesh_compression'] };
const chunks = [], views = new Map(), materials = new Map();
let offset = 0;
function view(index) {
  if (views.has(index)) return views.get(index);
  const source = doc.bufferViews[index];
  const bytes = bin.subarray(source.byteOffset || 0, (source.byteOffset || 0) + source.byteLength);
  const target = result.bufferViews.length;
  result.bufferViews.push({ ...source, buffer: 0, byteOffset: offset });
  chunks.push(bytes); offset += bytes.length;
  const padding = (4 - offset % 4) % 4;
  if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding; }
  views.set(index, target); return target;
}
for (const node of doc.nodes.filter(item => item.name.startsWith('Earbud ·'))) {
  const targetNode = clone(node); targetNode.mesh = result.meshes.length; result.nodes.push(targetNode);
  const mesh = clone(doc.meshes[node.mesh]);
  for (const primitive of mesh.primitives) {
    const refs = [primitive.indices, ...Object.values(primitive.attributes)];
    const map = new Map();
    for (const index of refs) { const accessor = clone(doc.accessors[index]); if (accessor.bufferView !== undefined) accessor.bufferView = view(accessor.bufferView); map.set(index, result.accessors.length); result.accessors.push(accessor); }
    primitive.indices = map.get(primitive.indices);
    for (const key of Object.keys(primitive.attributes)) primitive.attributes[key] = map.get(primitive.attributes[key]);
    const compression = primitive.extensions.KHR_draco_mesh_compression;
    compression.bufferView = view(compression.bufferView);
    if (!materials.has(primitive.material)) { materials.set(primitive.material, result.materials.length); result.materials.push(clone(doc.materials[primitive.material])); }
    primitive.material = materials.get(primitive.material);
  }
  result.meshes.push(mesh);
}
for (const image of result.images) image.bufferView = view(image.bufferView);
result.buffers.push({ byteLength: offset });
let json = Buffer.from(JSON.stringify(result));
json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
const binary = Buffer.concat(chunks);
const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67,0); header.writeUInt32LE(2,4); header.writeUInt32LE(28 + json.length + binary.length,8); header.writeUInt32LE(json.length,12); header.writeUInt32LE(0x4e4f534a,16);
const chunkHeader = Buffer.alloc(8); chunkHeader.writeUInt32LE(binary.length,0); chunkHeader.writeUInt32LE(0x004e4942,4);
const output = Buffer.concat([header,json,chunkHeader,binary]);
const outputPath = path.join(root,'public/models/cymba-earbuds-hero.glb');
fs.writeFileSync(outputPath,output);
(async () => {
  const draco = await makeDecoder({}); const entries = [];
  for (const node of result.nodes) {
    const matrix = new Matrix4().compose(new Vector3().fromArray(node.translation || [0,0,0]),new Quaternion().fromArray(node.rotation || [0,0,0,1]),new Vector3().fromArray(node.scale || [1,1,1]));
    const front = new Matrix4().makeRotationX(Math.PI/2).multiply(matrix);
    const box = new Box3(); let triangles=0;
    for (const p of result.meshes[node.mesh].primitives) {
      const ext=p.extensions.KHR_draco_mesh_compression, v=result.bufferViews[ext.bufferView];
      const bytes=binary.subarray(v.byteOffset,v.byteOffset+v.byteLength);
      const b=new draco.DecoderBuffer();b.Init(bytes,bytes.length);const d=new draco.Decoder(),mesh=new draco.Mesh();
      const status=d.DecodeBufferToMesh(b,mesh);if(!status.ok())throw Error(status.error_msg()); triangles+=mesh.num_faces();
      const attribute=d.GetAttributeByUniqueId(mesh,ext.attributes.POSITION),positions=new draco.DracoFloat32Array();d.GetAttributeFloatForAllPoints(mesh,attribute,positions);
      for(let i=0;i<positions.size();i+=3)box.expandByPoint(new Vector3(positions.GetValue(i),positions.GetValue(i+1),positions.GetValue(i+2)).applyMatrix4(front));
      [positions,mesh,d,b].forEach(o=>draco.destroy(o));
    }
    const size=box.getSize(new Vector3()),center=box.getCenter(new Vector3());
    entries.push({name:node.name,triangles,worldMatrixGLTF:matrix.elements,frontMatrix:front.elements,frontBoundsMetres:{min:box.min.toArray(),max:box.max.toArray()},frontCenterMetres:center.toArray(),frontSizeMetres:size.toArray(),heightNormalization:1/size.y});
  }
  const report={path:outputPath,sizeBytes:output.length,decodedWithBundledDraco:true,geometryBytesUnchanged:true,textureBytesUnchanged:true,entries};
  fs.writeFileSync(path.join(__dirname,'hero-asset-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})();

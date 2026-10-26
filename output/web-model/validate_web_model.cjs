const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const createDecoder = require('../../public/draco/draco_decoder.js');
const { Matrix4, Vector3, Quaternion, Box3 } = require('three');

(async () => {
  const root = path.resolve(__dirname, '../..');
  const modelPath = path.join(root, 'public/models/cymba-wired-assembly-web.glb');
  const bytes = fs.readFileSync(modelPath);
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(8) !== bytes.length) throw Error('Invalid GLB header');
  const jsonLength = bytes.readUInt32LE(12);
  const doc = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  const binStart = 20 + jsonLength + 8;
  const bin = bytes.subarray(binStart);
  if (doc.meshes.length !== 29 || doc.nodes.length !== 29 || doc.cameras?.length || doc.lights?.length) throw Error('Unexpected exported components');
  const images = await Promise.all(doc.images.map(async image => {
    if (image.uri || image.bufferView == null) throw Error('Image must be embedded');
    const view = doc.bufferViews[image.bufferView];
    const data = bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    const info = await sharp(data).metadata();
    if (info.width > 2048 || info.height > 2048) throw Error('Oversized texture');
    return { name: image.name, type: image.mimeType, size: [info.width, info.height], bytes: data.length };
  }));
  const draco = await createDecoder({});
  let triangles = 0, vertices = 0;
  const bounds = new Box3();
  for (const node of doc.nodes) {
    const world = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(new Vector3().fromArray(node.translation || [0,0,0]), new Quaternion().fromArray(node.rotation || [0,0,0,1]), new Vector3().fromArray(node.scale || [1,1,1]));
    for (const primitive of doc.meshes[node.mesh].primitives) {
      const ext = primitive.extensions.KHR_draco_mesh_compression;
      const view = doc.bufferViews[ext.bufferView];
      const data = bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
      const buffer = new draco.DecoderBuffer();buffer.Init(data, data.length);
      const decoder = new draco.Decoder(); const mesh = new draco.Mesh();
      const result = decoder.DecodeBufferToMesh(buffer, mesh);
      if (!result.ok() || mesh.num_faces() * 3 !== doc.accessors[primitive.indices].count) throw Error('Draco decode mismatch');
      triangles += mesh.num_faces(); vertices += mesh.num_points();
      const attr = decoder.GetAttributeByUniqueId(mesh, ext.attributes.POSITION);
      const position = new draco.DracoFloat32Array();
      decoder.GetAttributeFloatForAllPoints(mesh, attr, position);
      for(let i=0;i<position.size();i+=3) bounds.expandByPoint(new Vector3(position.GetValue(i),position.GetValue(i+1),position.GetValue(i+2)).applyMatrix4(world));
      draco.destroy(position);draco.destroy(mesh);draco.destroy(decoder);draco.destroy(buffer);
    }
  }
  const frontBounds = bounds.clone().applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2));
  const posterPath = path.join(root, 'public/models/cymba-wired-assembly-poster.webp');
  await sharp(path.join(__dirname, 'poster-transparent.png')).webp({quality:85,alphaQuality:100,effort:6}).toFile(posterPath);
  const posterInfo = await sharp(posterPath).metadata();
  if (!posterInfo.hasAlpha || posterInfo.width !== 1600 || posterInfo.height !== 900) throw Error('Poster is not 1600x900 transparent');
  const report = {
    size_bytes:bytes.length,meshes:doc.meshes.length,nodes:doc.nodes.length,triangles,vertices,images,
    extensionsRequired:doc.extensionsRequired,decoded_with_bundled_decoder:true,
    bounds_metres:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    front_rotated_bounds_metres:{min:frontBounds.min.toArray(),max:frontBounds.max.toArray()},
    poster:{path:posterPath,size_bytes:fs.statSync(posterPath).size,width:posterInfo.width,height:posterInfo.height,transparent:posterInfo.hasAlpha}
  };
  fs.writeFileSync(path.join(__dirname, 'glb-validation.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
})();

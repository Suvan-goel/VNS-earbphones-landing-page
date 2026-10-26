const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const T=require('three'),sharp=require('sharp');
const makeDecoder=require('../../public/draco/draco_decoder.js');
const root=path.resolve(__dirname,'../..');
async function inspect(file,draco){
 const bytes=fs.readFileSync(file),len=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+len)),bin=bytes.subarray(28+len),entries=[];
 for(const node of doc.nodes.filter(n=>n.mesh!==undefined)){
  const matrix=new T.Matrix4().makeRotationX(Math.PI/2).multiply(new T.Matrix4().compose(new T.Vector3(...(node.translation||[0,0,0])),new T.Quaternion(...(node.rotation||[0,0,0,1])),new T.Vector3(...(node.scale||[1,1,1]))));
  const box=new T.Box3();let triangles=0;
  for(const p of doc.meshes[node.mesh].primitives){
   const ext=p.extensions.KHR_draco_mesh_compression,v=doc.bufferViews[ext.bufferView],data=bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);
   const buf=new draco.DecoderBuffer();buf.Init(data,data.length);const dec=new draco.Decoder(),mesh=new draco.Mesh(),status=dec.DecodeBufferToMesh(buf,mesh);assert(status.ok());
   triangles+=mesh.num_faces();const attr=dec.GetAttributeByUniqueId(mesh,ext.attributes.POSITION),positions=new draco.DracoFloat32Array();dec.GetAttributeFloatForAllPoints(mesh,attr,positions);
   for(let i=0;i<positions.size();i+=3)box.expandByPoint(new T.Vector3(positions.GetValue(i),positions.GetValue(i+1),positions.GetValue(i+2)).applyMatrix4(matrix));
   [positions,mesh,dec,buf].forEach(o=>draco.destroy(o));
  }entries.push({name:node.name,triangles,min:box.min.toArray(),max:box.max.toArray()});
 }
 const images=[];for(const im of doc.images){const v=doc.bufferViews[im.bufferView],meta=await sharp(bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength)).metadata();images.push({name:im.name,width:meta.width,height:meta.height});}
 return {bytes:bytes.length,entries,images,materials:doc.materials.map(m=>m.name)};
}
(async()=>{
 const draco=await makeDecoder({}),before=await inspect(path.join(root,'public/models/cymba-earbuds-hero.glb'),draco),after=await inspect(path.join(root,'public/models/cymba-earbuds-refined.glb'),draco);
 assert.equal(after.entries.length,2);assert.equal(after.materials.length,1);assert(after.bytes<2_000_000);
 let maxBoundsDifferenceMetres=0;for(let i=0;i<2;i++){assert.equal(after.entries[i].triangles,before.entries[i].triangles);for(const k of ['min','max'])for(let axis=0;axis<3;axis++)maxBoundsDifferenceMetres=Math.max(maxBoundsDifferenceMetres,Math.abs(after.entries[i][k][axis]-before.entries[i][k][axis]));}
 assert(maxBoundsDifferenceMetres<.000002);
 const result={passed:true,sourceBytes:before.bytes,refinedBytes:after.bytes,maxBoundsDifferenceMetres,triangles:after.entries.reduce((a,e)=>a+e.triangles,0),images:after.images,material:after.materials[0]};
 fs.writeFileSync(path.join(__dirname,'validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});

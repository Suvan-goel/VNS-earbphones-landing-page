/**
 * Build the approved sparse, engraved pathway composition on the original bust.
 * Paths are authored as smooth angular curves and projected to each delivery
 * mesh. Conformal strips carry a concave bevel normal profile: shallow relief
 * shading without changing the sculpture silhouette or its cached geometry.
 * The existing bust and every non-path buffer are retained byte-for-byte.
 * Run: node scripts/build-engraved-pathways.mjs
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
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const pad4 = (bytes, value = 0) => Buffer.concat([bytes, Buffer.alloc((4 - bytes.length % 4) % 4, value)]);
const smoothstep = (a, b, value) => THREE.MathUtils.smoothstep(value, a, b);
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


// Five primary routes and three tiny secondary forks per hemisphere. The long
// negative spaces, rounded Y junctions and narrow tips follow the approved still.
const routes = [
  { id: "stem", width: 0.011, points: [[83,-17],[83,-6],[80,8],[72,24],[60,39],[45,48],[24,50],[8,49]] },
  { id: "front-low", parent: "stem", at: 0.30, width: 0.009, points: [[68,21],[52,27],[36,28],[22,23]] },
  { id: "front-high", parent: "stem", at: 0.48, width: 0.009, points: [[55,40],[41,45],[23,45],[4,41]] },
  { id: "crown", parent: "stem", at: 0.57, width: 0.009, points: [[67,52],[74,65],[91,74],[112,77]] },
  { id: "rear", parent: "stem", at: 0.14, width: 0.009, points: [[86,9],[94,20],[101,36],[111,52],[132,65]] },
  { id: "front-low-fork", parent: "front-low", at: 0.52, width: 0.006, points: [[37,33],[24,32]] },
  { id: "front-high-fork", parent: "front-high", at: 0.68, width: 0.0055, points: [[15,43],[6,42]] },
  { id: "rear-fork", parent: "rear", at: 0.58, width: 0.0055, points: [[116,43],[127,51]] },
];

function makePathways(head, mobile) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(head.attributes.POSITION, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(head.attributes.NORMAL, 3));
  geometry.setIndex(new THREE.BufferAttribute(head.indices.slice(), 1));
  const bvh = new MeshBVH(geometry);
  const pos = geometry.getAttribute("position"), nor = geometry.getAttribute("normal"), idx = geometry.index;
  const origin = new THREE.Vector3(0, 0.52, 0);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), bary = new THREE.Vector3();
  function normalAt(point, faceIndex) {
    const ids = [0,1,2].map(i => idx.getX(faceIndex * 3 + i));
    THREE.Triangle.getBarycoord(point, a.fromBufferAttribute(pos,ids[0]), b.fromBufferAttribute(pos,ids[1]), c.fromBufferAttribute(pos,ids[2]), bary);
    const normal = new THREE.Vector3().addScaledVector(a.fromBufferAttribute(nor,ids[0]),bary.x)
      .addScaledVector(b.fromBufferAttribute(nor,ids[1]),bary.y)
      .addScaledVector(c.fromBufferAttribute(nor,ids[2]),bary.z).normalize();
    // The scan has a few oppositely oriented patches. All scalp decals must
    // offset towards the exterior even where those source normals disagree.
    if (normal.dot(point.clone().sub(origin)) < 0) normal.negate();
    return normal;
  }
  function radial(angles, side) {
    const az = THREE.MathUtils.degToRad(angles.x), el = THREE.MathUtils.degToRad(angles.y);
    const direction = new THREE.Vector3(side * Math.sin(az)*Math.cos(el), Math.sin(el), Math.cos(az)*Math.cos(el));
    const hit = bvh.raycastFirst(new THREE.Ray(origin.clone().addScaledVector(direction,4),direction.clone().negate()),THREE.DoubleSide);
    if (!hit) throw new Error(`Path leaves sculpture: ${angles.toArray()}`);
    return { point: hit.point, normal: normalAt(hit.point,hit.faceIndex) };
  }
  function nearest(point) {
    const direction = point.clone().sub(origin).normalize();
    const result = bvh.raycastFirst(new THREE.Ray(origin.clone().addScaledVector(direction,4),direction.clone().negate()),THREE.DoubleSide);
    if (!result || result.point.distanceTo(point) > 0.06) throw new Error("Engraved strip is not on the sculpture");
    return { point:result.point.clone(), normal:normalAt(result.point,result.faceIndex) };
  }
  const paths = [];
  for (const side of [1,-1]) {
    const composed = new Map();
    for (const definition of routes) {
      const parent = composed.get(definition.parent);
      const points = definition.points.map(([az,el]) => new THREE.Vector3(az,el,0));
      if (parent) {
        const start = parent.curve.getPointAt(definition.at);
        // Begin tangent to the parent before slowly separating at the Y.
        const tangent = parent.curve.getTangentAt(definition.at);
        points.unshift(start, start.clone().addScaledVector(tangent,1.8));
      }
      const curve = new THREE.CatmullRomCurve3(points,false,"centripetal");
      const count = Math.max(24,Math.ceil(curve.getLength() * (mobile ? 1.5 : 2.5)));
      const samples = Array.from({length:count+1},(_,i) => radial(curve.getPointAt(i/count),side));
      const lengths = [0];
      for(let i=1;i<samples.length;i++) lengths.push(lengths[i-1]+samples[i].point.distanceTo(samples[i-1].point));
      const parentIndex = parent ? definition.at * (parent.samples.length-1) : 0;
      const attachment = parent ? THREE.MathUtils.lerp(parent.lengths[Math.floor(parentIndex)],parent.lengths[Math.ceil(parentIndex)],parentIndex%1) : 0;
      const route = { ...definition, side, curve, samples, lengths, start: parent ? parent.start + attachment : 0 };
      composed.set(definition.id,route); paths.push(route);
    }
  }
  const maxDistance = Math.max(...paths.map(p=>p.start+p.lengths.at(-1)));
  const positions=[], normals=[], uvs=[], indices=[];
  const acrossSteps = 8;
  for(const route of paths) {
    const base=positions.length/3;
    for(let i=0;i<route.samples.length;i++) {
      const t=i/(route.samples.length-1), sample=route.samples[i];
      const previous=route.samples[Math.max(0,i-1)].point, next=route.samples[Math.min(route.samples.length-1,i+1)].point;
      const tangent=next.clone().sub(previous).normalize();
      // A stable radial frame avoids the scan's tiny normal discontinuities
      // twisting these subpixel channels into alternating narrow/wide faces.
      const across=new THREE.Vector3().crossVectors(tangent,sample.point.clone().sub(origin).normalize()).normalize();
      const taper=(1-0.94*smoothstep(0.83,1,t)) * (route.parent ? 0.70+0.30*smoothstep(0,0.12,t) : 0.15+0.85*smoothstep(0,0.08,t));
      const halfWidth=route.width*taper*1.38;
      for(let j=0;j<=acrossSteps;j++) {
        const x=j/acrossSteps*2-1;
        const surface=nearest(sample.point.clone().addScaledVector(across,x*halfWidth));
        // The decal remains on the surface; the normals encode a shallow U
        // recess, with the lip fading to the original normal at either edge.
        const slope=2.2*x*(1-x*x);
        const outward=surface.point.clone().sub(origin).normalize();
        const grooveNormal=outward.clone().addScaledVector(across,-slope).normalize();
        positions.push(...surface.point.addScaledVector(outward,0.006).toArray());
        normals.push(...grooveNormal.toArray());
        uvs.push((route.start+route.lengths[i])/maxDistance,j/acrossSteps);
      }
      if(i<route.samples.length-1) for(let j=0;j<acrossSteps;j++) {
        const v=base+i*(acrossSteps+1)+j, w=v+acrossSteps+1;
        indices.push(v,w,v+1,v+1,w,w+1);
      }
    }
  }
  // Ensure all ribbons face outwards, including mirrored hemisphere strips.
  for(let i=0;i<indices.length;i+=3) {
    const [ia,ib,ic]=indices.slice(i,i+3);
    a.fromArray(positions,ia*3); b.fromArray(positions,ib*3).sub(a); c.fromArray(positions,ic*3).sub(a);
    if(b.cross(c).dot(a.sub(origin))<0) [indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  }
  let minimumClearance = Infinity, buriedTriangles = 0;
  // A few scan creases are narrower than a strip segment. Correct only those
  // contact points instead of floating the whole composition above the head.
  for (let pass=0;pass<6;pass++) {
    minimumClearance=Infinity; buriedTriangles=0;
    for (let i=0; i<indices.length; i+=3) {
      const midpoint = new THREE.Vector3();
      for (let j=0;j<3;j++) midpoint.add(new THREE.Vector3().fromArray(positions,indices[i+j]*3));
      midpoint.multiplyScalar(1/3);
      const direction=midpoint.clone().sub(origin).normalize();
      const hit=bvh.raycastFirst(new THREE.Ray(origin.clone().addScaledVector(direction,4),direction.clone().negate()),THREE.DoubleSide);
      const clearance=midpoint.clone().sub(hit.point).dot(direction);
      minimumClearance=Math.min(minimumClearance,clearance);
      if (clearance<0) {
        buriedTriangles++;
        if (pass<5) for (let j=0;j<3;j++) {
          const offset=indices[i+j]*3, vertex=new THREE.Vector3().fromArray(positions,offset);
          vertex.addScaledVector(vertex.clone().sub(origin).normalize(),-clearance+0.001);
          vertex.toArray(positions,offset);
        }
      }
    }
    if (!buriedTriangles) break;
  }
  if (buriedTriangles) throw new Error(`${buriedTriangles} pathway triangles intersect the scalp (${minimumClearance})`);
  geometry.dispose();
  return { attributes:{POSITION:new Float32Array(positions),NORMAL:new Float32Array(normals),TEXCOORD_0:new Float32Array(uvs)},indices:new Uint32Array(indices),
    minimumClearance,
    routes:paths.map(p=>({id:p.id,side:p.side,samples:p.samples.length,length:p.lengths.at(-1),start:p.start})) };
}

const reports=[];
for(const variant of ["desktop","mobile"]) {
  const sourcePath=path.join(root,`public/models/cymba-neural-mannequin-organic-detailed-${variant}.glb`);
  const outputPath=path.join(root,`public/models/cymba-mannequin-engraved-${variant}.glb`);
  const source=readGlb(sourcePath), {document,views}=source;
  const before=views.map(view=>Buffer.from(view));
  const headNode=document.nodes.find(n=>n.name==="Cymba_Marble_Mannequin");
  const headExtension=document.meshes[headNode.mesh].primitives[0].extensions.KHR_draco_mesh_compression;
  const head=decode(views[headExtension.bufferView],headExtension.attributes);
  const paths=makePathways(head,variant==="mobile"), encoded=encode(paths);
  const node=document.nodes.find(n=>n.name==="Purple_Surface_Nerve_Fibres");
  const primitive=document.meshes[node.mesh].primitives[0], extension=primitive.extensions.KHR_draco_mesh_compression;
  views[extension.bufferView]=encoded.bytes; extension.attributes=encoded.ids;
  const verified=decode(encoded.bytes,encoded.ids);
  const parents=Uint32Array.from({length:verified.attributes.POSITION.length/3},(_,i)=>i);
  const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
  for(let i=0;i<verified.indices.length;i+=3) {
    const a=find(verified.indices[i]); parents[find(verified.indices[i+1])]=a; parents[find(verified.indices[i+2])]=a;
  }
  if(new Set(parents.map((_,i)=>find(i))).size!==routes.length*2) throw new Error("Disconnected pathway geometry");
  for(const values of Object.values(verified.attributes)) if(values.some(v=>!Number.isFinite(v))) throw new Error("Nonfinite pathway attribute");
  for(const index of verified.indices) if(index>=verified.attributes.POSITION.length/3) throw new Error("Invalid pathway index");
  for(const [name,id] of Object.entries(primitive.attributes)) {
    const accessor=document.accessors[id],values=verified.attributes[name];
    accessor.count=values.length/(name==="TEXCOORD_0"?2:3);
    if(name==="POSITION") {
      accessor.min=[Infinity,Infinity,Infinity]; accessor.max=[-Infinity,-Infinity,-Infinity];
      for(let i=0;i<values.length;i++){accessor.min[i%3]=Math.min(accessor.min[i%3],values[i]);accessor.max[i%3]=Math.max(accessor.max[i%3],values[i]);}
      if(accessor.min[1]<0.02) throw new Error("A pathway extends onto the neck");
    }
  }
  document.accessors[primitive.indices].count=verified.indices.length;
  node.extras={visualization:"Illustrative engraved pathways based on the approved concept",profile:"Surface-constrained concave relief shading",routes:routes.length*2,primaryRoutesPerHemisphere:5};
  const output=writeGlb(document,views); fs.writeFileSync(outputPath,output);
  const reread=readGlb(outputPath);
  const retained=before.every((view,i)=>i===extension.bufferView||view.equals(reread.views[i]));
  if(!retained||!source.bytes.equals(fs.readFileSync(sourcePath))) throw new Error("Original sculpture preservation failed");
  const report={variant,output:path.relative(root,outputPath),sha256:hash(output),bytes:output.length,vertices:verified.attributes.POSITION.length/3,triangles:verified.indices.length/3,sculpturePreserved:retained,minimumClearance:paths.minimumClearance,routes:paths.routes};
  reports.push(report);
  console.log(JSON.stringify({...report,routes:report.routes.length}));
}
fs.writeFileSync(path.join(root,"scripts/engraved-pathways-report.json"),JSON.stringify(reports,null,2)+"\n");

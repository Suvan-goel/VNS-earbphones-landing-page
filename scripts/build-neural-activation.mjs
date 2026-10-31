/** Bake illustrative, surface-following neural arbors onto the retained cortex.
 * Original sculpture/cortex buffers remain byte-identical. No runtime tracing.
 * Run after build-cortical-brain.mjs; generates both delivery variants.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import * as THREE from 'three';
import draco from 'draco3d';
import { MeshBVH } from 'three-mesh-bvh';
import { MeshoptSimplifier } from 'meshoptimizer';

const root = fileURLToPath(new URL('../', import.meta.url));
const decoderModule = await draco.createDecoderModule({});
const encoderModule = await draco.createEncoderModule({});
await MeshoptSimplifier.ready;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const pad4 = (bytes, fill = 0) => Buffer.concat([bytes, Buffer.alloc((4 - bytes.length % 4) % 4, fill)]);
function readGlb(file) {
  const bytes = fs.readFileSync(file), jsonLength = bytes.readUInt32LE(12);
  const document = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  const binary = bytes.subarray(28 + jsonLength);
  const views = document.bufferViews.map(v => Buffer.from(binary.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength)));
  return { document, views };
}
function decode(bytes, ids) {
  const decoder = new decoderModule.Decoder(), buffer = new decoderModule.DecoderBuffer(), mesh = new decoderModule.Mesh();
  buffer.Init(new Int8Array(bytes), bytes.length);
  const status = decoder.DecodeBufferToMesh(buffer, mesh);
  if (!status.ok()) throw new Error(status.error_msg());
  const attributes = {};
  for (const [name, id] of Object.entries(ids)) {
    const values = new decoderModule.DracoFloat32Array();
    decoder.GetAttributeFloatForAllPoints(mesh, decoder.GetAttributeByUniqueId(mesh, id), values);
    attributes[name] = Float32Array.from({length: values.size()}, (_, i) => values.GetValue(i));
    decoderModule.destroy(values);
  }
  const indices = new Uint32Array(mesh.num_faces() * 3), face = new decoderModule.DracoInt32Array();
  for (let i = 0; i < mesh.num_faces(); i++) {
    decoder.GetFaceFromMesh(mesh, i, face);
    for (let j = 0; j < 3; j++) indices[i * 3 + j] = face.GetValue(j);
  }
  for (const item of [face, mesh, buffer, decoder]) decoderModule.destroy(item);
  return { attributes, indices };
}
function encode(geometry) {
  const mesh = new encoderModule.Mesh(), builder = new encoderModule.MeshBuilder();
  builder.AddFacesToMesh(mesh, geometry.index.count / 3, geometry.index.array);
  const attributes = {};
  for (const [name, attribute, kind] of [['POSITION','position','POSITION'],['NORMAL','normal','NORMAL'],['TEXCOORD_0','uv','TEX_COORD']]) {
    const a = geometry.getAttribute(attribute);
    attributes[name] = builder.AddFloatAttributeToMesh(mesh, encoderModule[kind], a.count, a.itemSize, a.array);
  }
  const encoder = new encoderModule.Encoder(), output = new encoderModule.DracoInt8Array();
  encoder.SetSpeedOptions(3, 3); encoder.SetEncodingMethod(encoderModule.MESH_EDGEBREAKER_ENCODING);
  encoder.SetAttributeQuantization(encoderModule.POSITION, 18);
  encoder.SetAttributeQuantization(encoderModule.NORMAL, 10);
  encoder.SetAttributeQuantization(encoderModule.TEX_COORD, 20);
  const size = encoder.EncodeMeshToDracoBuffer(mesh, output);
  if (size <= 0) throw new Error('Unable to encode neural geometry');
  const bytes = Buffer.from(Array.from({length: size}, (_, i) => output.GetValue(i) & 255));
  for (const item of [output, encoder, builder, mesh]) encoderModule.destroy(item);
  return {bytes, attributes};
}
function writeGlb(document, views) {
  let offset = 0;
  const chunks = views.map((v, i) => {
    document.bufferViews[i].byteOffset = offset; document.bufferViews[i].byteLength = v.length;
    const padded = pad4(v); offset += padded.length; return padded;
  });
  document.buffers[0].byteLength = offset;
  const json = pad4(Buffer.from(JSON.stringify(document)), 32), bin = Buffer.concat(chunks);
  const header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + bin.length, 8);
  header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  binHeader.writeUInt32LE(bin.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, json, binHeader, bin]);
}

function appendGeometry(document, views, name, geometry, description) {
  geometry.computeBoundingBox();
  const encoded = encode(geometry), decoded = decode(encoded.bytes, encoded.attributes);
  const material = document.materials.length;
  document.materials.push({name, pbrMetallicRoughness:{baseColorFactor:[.24,.12,.44,1],metallicFactor:0,roughnessFactor:.5}});
  const primitive = {attributes:{},indices:0,material,extensions:{KHR_draco_mesh_compression:{bufferView:views.length,attributes:encoded.attributes}}};
  document.bufferViews.push({buffer:0,byteLength:encoded.bytes.length}); views.push(encoded.bytes);
  for (const [attribute,size] of [['POSITION',3],['NORMAL',3],['TEXCOORD_0',2]]) {
    primitive.attributes[attribute] = document.accessors.length;
    const accessor = {componentType:5126,type:size === 3 ? 'VEC3' : 'VEC2',count:decoded.attributes[attribute].length / size};
    if (attribute === 'POSITION') {
      const p = decoded.attributes.POSITION;
      accessor.min = [Infinity,Infinity,Infinity]; accessor.max = [-Infinity,-Infinity,-Infinity];
      for (let i=0;i<p.length;i++) {accessor.min[i%3]=Math.min(accessor.min[i%3],p[i]);accessor.max[i%3]=Math.max(accessor.max[i%3],p[i]);}
    }
    document.accessors.push(accessor);
  }
  primitive.indices = document.accessors.length;
  document.accessors.push({componentType:5125,type:'SCALAR',count:decoded.indices.length});
  const mesh = document.meshes.length; document.meshes.push({name,primitives:[primitive]});
  document.scenes[0].nodes.push(document.nodes.length);
  document.nodes.push({name,mesh,extras:{illustrative:true,method:description}});
  return encoded.bytes.length;
}

/** Matching segmented anatomy, with the same fit transform as the cortex. */
function brainstemGeometry(mobile) {
  const filename=`${root}source-assets/brain/brain-atlas-source.glb`;
  const provenance=JSON.parse(fs.readFileSync(`${root}source-assets/brain/brain-atlas.provenance.json`,'utf8'));
  if(hash(fs.readFileSync(filename))!==provenance.asset.sha256)throw new Error('Brain anatomy source checksum mismatch');
  const source=readGlb(filename),node=source.document.nodes.find(n=>n.name==='brain-stem');
  const primitive=source.document.meshes[node.mesh].primitives[0];
  const attribute=index=>{
    const accessor=source.document.accessors[index],view=source.views[accessor.bufferView];
    const size={SCALAR:1,VEC2:2,VEC3:3}[accessor.type],Type={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[accessor.componentType];
    const start=view.byteOffset+(accessor.byteOffset??0);
    return new Type(view.buffer.slice(start,start+accessor.count*size*Type.BYTES_PER_ELEMENT));
  };
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(attribute(primitive.attributes.POSITION),3));
  geometry.setAttribute('normal',new THREE.BufferAttribute(attribute(primitive.attributes.NORMAL),3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(attribute(primitive.indices)),1));
  geometry.scale(.0153,.0122,.0126).translate(0,.60,.12);
  const uv=new Float32Array(geometry.attributes.position.count*2);
  for(let i=0;i<uv.length;i+=2)uv[i]=.85;
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  if(mobile) {
    const [indices]=MeshoptSimplifier.simplifyWithAttributes(geometry.index.array,geometry.attributes.position.array,3,
      geometry.attributes.normal.array,3,[.75,.75,.75],null,6000*3,.005,['LockBorder']);
    geometry.setIndex(new THREE.BufferAttribute(indices,1));
  }
  geometry.computeBoundingBox();
  geometry.userData.anatomy={source:'brain-atlas-source.glb',region:'brain-stem',sourceSha256:provenance.asset.sha256,
    sourceTriangles:source.document.accessors[primitive.indices].count/3,triangles:geometry.index.count/3,
    bounds:{min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()}};
  return geometry;
}

/** Illustrative branching nerves in the space beneath the head's surface.
 * They enter from inside each ear and merge into the retained cortical folds. */
function inputPaths(document, views, mobile) {
  const surface = name => {
    const node = document.nodes.find(n => n.name === name);
    const source = document.meshes[node.mesh].primitives[0].extensions.KHR_draco_mesh_compression;
    const decoded = decode(views[source.bufferView], source.attributes);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(decoded.attributes.POSITION,3));
    geometry.setIndex(new THREE.BufferAttribute(decoded.indices,1));
    return {geometry,bvh:new MeshBVH(geometry)};
  };
  const head = surface('Cymba_Marble_Mannequin'), cortex = surface('Cortical_Brain'), stem=surface('Brainstem');
  const nearest = (surface,p) => {
    const hit=surface.bvh.closestPointToPoint(p), triangle=new THREE.Triangle();
    const face=hit.faceIndex*3, geometry=surface.geometry;
    triangle.a.fromBufferAttribute(geometry.attributes.position,geometry.index.getX(face));
    triangle.b.fromBufferAttribute(geometry.attributes.position,geometry.index.getX(face+1));
    triangle.c.fromBufferAttribute(geometry.attributes.position,geometry.index.getX(face+2));
    return {point:hit.point,normal:triangle.getNormal(new THREE.Vector3()),distance:hit.distance};
  };
  const onCortex = p => {const hit=nearest(cortex,p);return hit.point.addScaledVector(hit.normal,.009);};
  const onStem = p => {const hit=nearest(stem,p);return hit.point.addScaledVector(hit.normal,.009);};
  const withinHead = (p,avoidCortex) => {
    // The tubes must remain beneath the skin, including their full radius.
    // Keep the upper branches outside the solid cortex until they join it.
    if(avoidCortex) {
      const brainHit=nearest(cortex,p);
      if(p.clone().sub(brainHit.point).dot(brainHit.normal)<.009) p.copy(brainHit.point).addScaledVector(brainHit.normal,.009);
    }
    const skin=nearest(head,p);
    if(p.clone().sub(skin.point).dot(skin.normal)>-.065) p.copy(skin.point).addScaledVector(skin.normal,-.065);
    return p;
  };
  const positions=[], normals=[], uvs=[], indices=[];
  const sides=mobile?5:6;
  let pathCount=0,minHeadClearance=Infinity;
  const addPath = (sample,side,radius,importance,startDistance=0,avoidCortex=true) => {
    const segments=importance===1?(mobile?34:48):importance>.5?(mobile?26:38):(mobile?14:22);
    const points=Array.from({length:segments+1},(_,i)=>withinHead(sample(i/segments),avoidCortex));
    const distances=[startDistance];
    for(let i=1;i<=segments;i++)distances.push(distances[i-1]+points[i].distanceTo(points[i-1]));
    const base=positions.length/3;
    for(let i=0;i<=segments;i++) {
      const t=i/segments,p=points[i];
      const tangent=points[Math.min(i+1,segments)].clone().sub(points[Math.max(0,i-1)]).normalize();
      const n=new THREE.Vector3().crossVectors(tangent,new THREE.Vector3(side,0,.15)).normalize();
      const b=new THREE.Vector3().crossVectors(tangent,n).normalize();
      const thickness=radius*(importance===1?1-.28*t:1-.88*t);
      for(let j=0;j<sides;j++) {
        const a=j/sides*Math.PI*2,normal=n.clone().multiplyScalar(Math.cos(a)).addScaledVector(b,Math.sin(a));
        const vertex=p.clone().addScaledVector(normal,thickness),skin=nearest(head,vertex);
        const clearance=-vertex.clone().sub(skin.point).dot(skin.normal);
        minHeadClearance=Math.min(minHeadClearance,clearance);
        if(clearance<.045)throw new Error('An input nerve reaches the head surface');
        positions.push(...vertex.toArray());normals.push(...normal.toArray());
        // Daughter branches inherit travel distance at their junction.
        uvs.push(.10+distances[i]/1.45,importance);
        if(i<segments) {const a=base+i*sides+j,c=base+i*sides+(j+1)%sides;indices.push(a,c,a+sides,c,c+sides,a+sides);}
      }
    }
    pathCount++;
    return {at:t=>{
      const index=t*segments,lo=Math.floor(index),hi=Math.ceil(index);
      return {point:points[lo].clone().lerp(points[hi],index-lo),distance:THREE.MathUtils.lerp(distances[lo],distances[hi],index-lo)};
    }};
  };
  for(const side of [-1,1]) {
    const trunk=new THREE.CatmullRomCurve3([
      new THREE.Vector3(side*.94,-.065,.15),
      new THREE.Vector3(side*.91,.065,.12),
      new THREE.Vector3(side*.92,.23,.08),
      new THREE.Vector3(side*.94,.43,.025),
    ]);
    const main=addPath(t=>trunk.getPoint(t),side,.010,1);
    const entry=main.at(.18),stemTip=onStem(new THREE.Vector3(side*.19,.32,-.14));
    const toStem=new THREE.CatmullRomCurve3([entry.point,new THREE.Vector3(side*.70,.14,.04),new THREE.Vector3(side*.41,.24,-.09),stemTip]);
    const stemBranch=addPath(t=>toStem.getPoint(t),side,.0068,.72,entry.distance,false);
    const stemStart=stemBranch.at(1);
    for(let strand=0;strand<2;strand++) {
      const upper=new THREE.CatmullRomCurve3([stemStart.point,onStem(new THREE.Vector3(side*(.12+strand*.06),.48,-.025)),
        onStem(new THREE.Vector3(side*(.10+strand*.05),.70,-.12))]);
      addPath(t=>onStem(upper.getPoint(t)),side,.0034,.45,stemStart.distance,false);
    }
    for(let j=0;j<5;j++) {
      const start=main.at(.35+j*.125);
      const tip=onCortex(new THREE.Vector3(side*.99,.53+j*.085,.32-j*.18));
      const middle=start.point.clone().lerp(tip,.48).add(new THREE.Vector3(side*.018,.025,(j%2?1:-1)*.025));
      const curve=new THREE.CatmullRomCurve3([start.point,middle,tip]);
      const branch=addPath(t=>curve.getPoint(t),side,.0062,.72,start.distance);
      for(let k=0;k<2;k++) {
        const fork=branch.at(.45+k*.28);
        const end=onCortex(fork.point.clone().add(new THREE.Vector3(side*.035,.12+k*.035,(k?1:-1)*.095)));
        const bend=fork.point.clone().lerp(end,.5).add(new THREE.Vector3(side*.012,.008,(k?1:-1)*.018));
        const twig=new THREE.CatmullRomCurve3([fork.point,bend,end]);
        addPath(t=>twig.getPoint(t),side,.0034,.45,fork.distance);
      }
    }
  }
  head.geometry.dispose();cortex.geometry.dispose();stem.geometry.dispose();
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
  return {geometry,pathCount,minHeadClearance};
}

// Fixed seed and shared arbors keep the same composition on phone and desktop.
let seed = 71683;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const direction = (azimuth, elevation) => new THREE.Vector3(Math.cos(elevation) * Math.sin(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.cos(azimuth));
const arbors = [];
for (let i = 0; i < 84; i++) {
  const azimuth = i * 2.399963229728653 + (random() - .5) * .24;
  const elevation = Math.asin(-.70 + 1.64 * (i + .5) / 84);
  const origin = direction(azimuth, elevation);
  const east = new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));
  const north = new THREE.Vector3().crossVectors(origin, east).normalize();
  const heading = random() * Math.PI * 2;
  const axis = east.clone().multiplyScalar(Math.cos(heading)).addScaledVector(north, Math.sin(heading));
  const cross = new THREE.Vector3().crossVectors(origin, axis).normalize();
  const phase = random() * Math.PI * 2;
  const length = .50 + random() * .62;
  const trunk = t => origin.clone().addScaledVector(axis, (t - .35) * length)
    .addScaledVector(cross, Math.sin(t * 4.1 + phase) * .045 + Math.sin(t * 8 + phase) * .012).normalize();
  const paths = [{sample: trunk, parent: -1, join: 0, radius: .006 + random() * .001, importance: 1}];
  for (let j = 0; j < 5; j++) {
    const join = .18 + j * .145, sign = j % 2 ? 1 : -1;
    const branchLength = .15 + random() * .20;
    const start = trunk(join), bend = random() * 1.5;
    const branch = t => start.clone().addScaledVector(axis, t * branchLength * .75)
      .addScaledVector(cross, sign * branchLength * (t * .8 + .12 * Math.sin(t * 3.4 + bend) * t)).normalize();
    const parent = paths.length;
    paths.push({sample: branch, parent: 0, join, radius: .0042, importance: .72});
    for (let k = 0; k < 2; k++) {
      const at = .42 + k * .3, tip = branch(at), twigLength = .075 + random() * .11;
      const twig = t => tip.clone().addScaledVector(axis, twigLength * t * (k ? 1 : -.55))
        .addScaledVector(cross, sign * twigLength * (t + .1 * Math.sin(t * 5) * t)).normalize();
      paths.push({sample: twig, parent, join: at, radius: .0027, importance: .45});
    }
  }
  arbors.push({paths, index: i});
}

const reports = [];
for (const mobile of [false, true]) {
  const variant = mobile ? 'mobile' : 'desktop';
  const {document, views} = readGlb(`${root}public/models/cymba-cortical-mannequin-${variant}.glb`);
  const originalHashes = views.map(hash);
  const brainNode = document.nodes.find(n => n.name === 'Cortical_Brain');
  const source = document.meshes[brainNode.mesh].primitives[0].extensions.KHR_draco_mesh_compression;
  const decoded = decode(views[source.bufferView], source.attributes);
  const brain = new THREE.BufferGeometry();
  brain.setAttribute('position', new THREE.BufferAttribute(decoded.attributes.POSITION, 3));
  brain.setIndex(new THREE.BufferAttribute(decoded.indices, 1));
  const bvh = new MeshBVH(brain);
  // Ray-project onto the real folded surface, then lift by only a hair's width.
  const centre = new THREE.Vector3(0, .94, -.02), ray = new THREE.Ray();
  const project = d => {
    const radial = d.clone().multiply(new THREE.Vector3(1, .72, 1.09));
    ray.origin.copy(centre).addScaledVector(radial, 2.4);
    ray.direction.copy(radial).normalize().negate();
    const hit = bvh.raycastFirst(ray, THREE.DoubleSide);
    if (!hit) throw new Error('Neural strand missed the cortex');
    return hit.point.addScaledVector(radial.normalize(), .006);
  };
  const positions = [], normals = [], uvs = [], indices = [];
  let paths = 0, maxSurfaceGap = 0;
  for (const arbor of arbors) {
    const distances = new Map();
    // Phones keep every main arbor and branch; only the finest twigs thin out.
    for (let pathIndex = 0; pathIndex < arbor.paths.length; pathIndex++) {
      const path = arbor.paths[pathIndex];
      if (mobile && path.importance < .5 && pathIndex % 2) continue;
      const segments = path.importance === 1 ? (mobile ? 48 : 64) : path.importance > .5 ? (mobile ? 22 : 30) : (mobile ? 12 : 16);
      const sides = mobile ? 4 : 5;
      const points = Array.from({length: segments + 1}, (_, i) => project(path.sample(i / segments)));
      const base = positions.length / 3;
      const parentDistances = distances.get(path.parent);
      const parentIndex = parentDistances ? path.join * (parentDistances.length - 1) : 0;
      let distance = parentDistances ? THREE.MathUtils.lerp(parentDistances[Math.floor(parentIndex)], parentDistances[Math.ceil(parentIndex)], parentIndex % 1) : 0;
      const branchDistances = [];
      distances.set(pathIndex, branchDistances);
      for (let i = 0; i <= segments; i++) {
        const p = points[i], t = i / segments;
        if (i > 0) distance += p.distanceTo(points[i - 1]);
        branchDistances.push(distance);
        const tangent = points[Math.min(i + 1, segments)].clone().sub(points[Math.max(i - 1, 0)]).normalize();
        const radial = p.clone().sub(centre).normalize();
        const normal = new THREE.Vector3().crossVectors(tangent, radial).normalize();
        const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
        const radius = path.radius * (mobile ? 1.14 : 1) * (.15 + .85 * Math.pow(1 - t, .55));
        maxSurfaceGap = Math.max(maxSurfaceGap, bvh.closestPointToPoint(p).distance);
        for (let side = 0; side < sides; side++) {
          const angle = side / sides * Math.PI * 2;
          const n = normal.clone().multiplyScalar(Math.cos(angle)).addScaledVector(binormal, Math.sin(angle));
          const v = p.clone().addScaledVector(n, radius);
          positions.push(v.x, v.y, v.z); normals.push(n.x, n.y, n.z);
          // U is continuous path distance; integer V identifies the shared arbor.
          // Branch pulses inherit their parent's phase, rather than random blinking.
          uvs.push(distance, arbor.index + path.importance * .5);
          if (i < segments) {
            const a = base + i * sides + side, b = base + i * sides + (side + 1) % sides;
            indices.push(a, b, a + sides, b, b + sides, a + sides);
          }
        }
      }
      paths++;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices);
  const arborBytes=appendGeometry(document,views,'Cortical_Neural_Arbors',geometry,'Seeded branching paths projected onto the retained folded cortex; not measured tractography');
  const stem=brainstemGeometry(mobile);
  const stemBytes=appendGeometry(document,views,'Brainstem',stem,'Matching segmented brainstem from the retained brain atlas, aligned with the cortex using its original fit transform');
  const inputs=inputPaths(document,views,mobile);
  const inputBytes=appendGeometry(document,views,'Ear_to_Cortex_Signal',inputs.geometry,'Illustrative branching nerves beneath the sculpture surface, from inside each ear to the cortical folds; not measured anatomy');
  if (!originalHashes.every((h,i) => hash(views[i]) === h)) throw new Error('Original sculpture/cortex buffers changed');
  if (maxSurfaceGap > .007) throw new Error('A fibre floats above the cortex');
  const output = writeGlb(document, views), filename = `public/models/cymba-stimulated-mannequin-${variant}.glb`;
  fs.writeFileSync(root + filename, output);
  const report = {variant,filename,sha256:hash(output),bytes:output.length,addedBytes:arborBytes+inputBytes+stemBytes,arbors:arbors.length,paths,inputPaths:inputs.pathCount,minInputHeadClearance:inputs.minHeadClearance,brainstem:stem.userData.anatomy,triangles:indices.length/3+inputs.geometry.index.count/3+stem.index.count/3,maxSurfaceGap,originalGeometryPreserved:true,originalBufferHashes:originalHashes};
  reports.push(report); console.log(JSON.stringify(report));
  brain.dispose(); geometry.dispose(); inputs.geometry.dispose();stem.dispose();
}
fs.writeFileSync(`${root}scripts/neural-activation-report.json`, JSON.stringify(reports,null,2)+'\n');
const urlsPath = `${root}src/lib/product-asset-urls.ts`;
let urls = fs.readFileSync(urlsPath, 'utf8');
for (const report of reports) {
  const constant = report.variant === 'mobile' ? 'MANNEQUIN_MOBILE_MODEL_URL' : 'MANNEQUIN_MODEL_URL';
  urls = urls.replace(new RegExp(`export const ${constant} = "[^"]+";`), `export const ${constant} = "/${report.filename.replace(/^public\//,'')}?v=${report.sha256.slice(0,8)}";`);
}
fs.writeFileSync(urlsPath, urls);

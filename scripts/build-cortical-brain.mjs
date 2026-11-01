/** Fit a smoothly shaded cortical surface inside the original bust. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import draco from "draco3d";
import * as THREE from "three";
import { MeshoptSimplifier } from "meshoptimizer";
import { MeshBVH } from "three-mesh-bvh";

const root = fileURLToPath(new URL("../", import.meta.url));
await MeshoptSimplifier.ready;
const decoderModule = await draco.createDecoderModule({});
const encoderModule = await draco.createEncoderModule({});
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const pad4 = (bytes, value = 0) => Buffer.concat([bytes, Buffer.alloc((4 - bytes.length % 4) % 4, value)]);
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


const brainSource=readGlb(path.join(root,'source-assets/brain/brain-atlas-source.glb'));
const provenance=JSON.parse(fs.readFileSync(path.join(root,'source-assets/brain/brain-atlas.provenance.json')));
if(hash(brainSource.bytes)!==provenance.asset.sha256) throw new Error('Brain source checksum mismatch');
function attribute(source,index) {
  const accessor=source.document.accessors[index],view=source.views[accessor.bufferView];
  const size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[accessor.type];
  const Type={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[accessor.componentType];
  return new Type(view.buffer.slice(view.byteOffset+(accessor.byteOffset??0),view.byteOffset+(accessor.byteOffset??0)+accessor.count*size*Type.BYTES_PER_ELEMENT));
}
/** Constrain a deformation continuously, not just at its endpoints. The signed
 * face area along a linear move is quadratic; keeping its minimum positive
 * prevents a thin sulcal triangle from turning inside out during fairing. */
function guardFaceOrientation(previous,proposed,indices,protectedVertices) {
  const count=previous.length/3;
  let minimumRatio=1,limitedTriangles=0;
  for(let attempt=0;attempt<24;attempt++) {
    const affected=new Uint8Array(count);let invalid=0;minimumRatio=1;
    for(let i=0;i<indices.length;i+=3) {
      const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
      const ex=previous[b]-previous[a],ey=previous[b+1]-previous[a+1],ez=previous[b+2]-previous[a+2];
      const fx=previous[c]-previous[a],fy=previous[c+1]-previous[a+1],fz=previous[c+2]-previous[a+2];
      const nx=ey*fz-ez*fy,ny=ez*fx-ex*fz,nz=ex*fy-ey*fx,area=nx*nx+ny*ny+nz*nz;
      if(area<1e-24) throw new Error('Degenerate source triangle during posterior fairing');
      const qex=proposed[b]-proposed[a],qey=proposed[b+1]-proposed[a+1],qez=proposed[b+2]-proposed[a+2];
      const qfx=proposed[c]-proposed[a],qfy=proposed[c+1]-proposed[a+1],qfz=proposed[c+2]-proposed[a+2];
      const end=((qey*qfz-qez*qfy)*nx+(qez*qfx-qex*qfz)*ny+(qex*qfy-qey*qfx)*nz)/area;
      const dex=qex-ex,dey=qey-ey,dez=qez-ez,dfx=qfx-fx,dfy=qfy-fy,dfz=qfz-fz;
      const quadratic=((dey*dfz-dez*dfy)*nx+(dez*dfx-dex*dfz)*ny+(dex*dfy-dey*dfx)*nz)/area;
      const linear=end-1-quadratic,t=quadratic>0?-linear/(2*quadratic):-1;
      const minimum=Math.min(1,end,t>0&&t<1?1+linear*t+quadratic*t*t:1);
      minimumRatio=Math.min(minimumRatio,minimum);
      if(minimum<.12) {invalid++;affected[indices[i]]=1;affected[indices[i+1]]=1;affected[indices[i+2]]=1;}
    }
    if(!invalid) return {minimumRatio,limitedTriangles};
    limitedTriangles+=invalid;
    for(let i=0;i<count;i++) if(affected[i]) {
      protectedVertices.add(i);
      for(let k=0;k<3;k++) proposed[i*3+k]=attempt<16?(proposed[i*3+k]+previous[i*3+k])*.5:previous[i*3+k];
    }
  }
  throw new Error('Unable to preserve posterior triangle orientation');
}
/** Art-directed posterior fairing. The scan has many pinched, narrow ridge
 * junctions: round their short-scale geometry while leaving the large sulci and
 * separated hemispheres in place. The broad blend avoids a visible edited seam. */
function fairPosterior(positions,indices) {
  const count=positions.length/3,neighbours=Array.from({length:count},()=>new Set());
  for(let i=0;i<indices.length;i+=3) for(let k=0;k<3;k++) {
    const a=indices[i+k],b=indices[i+(k+1)%3];neighbours[a].add(b);neighbours[b].add(a);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setIndex(new THREE.BufferAttribute(indices,1));geometry.computeVertexNormals();
  const normals=geometry.attributes.normal.array,weights=new Float32Array(count),regions=new Float32Array(count);
  for(let i=0;i<count;i++) {
    const x=positions[i*3],y=positions[i*3+1],z=positions[i*3+2];
    const posterior=1-THREE.MathUtils.smoothstep(z,-.48,.48);
    const lateral=THREE.MathUtils.smoothstep(Math.abs(x),.08,.27);
    const superior=THREE.MathUtils.smoothstep(y,.38,.72);
    const region=posterior*lateral*superior;regions[i]=region;
    let dx=0,dy=0,dz=0,edgeLength=0;
    for(const j of neighbours[i]) {
      const a=positions[j*3]-x,b=positions[j*3+1]-y,c=positions[j*3+2]-z;
      dx+=a;dy+=b;dz+=c;edgeLength+=Math.hypot(a,b,c);
    }
    // Positive mean-curvature projection identifies the inward sulcal floor.
    // Preserve these groove anchors more than the small projecting ridge tips.
    const concavity=(dx*normals[i*3]+dy*normals[i*3+1]+dz*normals[i*3+2])/Math.max(edgeLength,1e-6);
    const grooveAnchor=THREE.MathUtils.smoothstep(concavity,.055,.22);
    weights[i]=region*(1-.63*grooveAnchor);
  }
  geometry.dispose();
  let current=positions.slice(),next=new Float32Array(positions.length);
  const protectedVertices=new Set();let minimumOrientationRatio=1;
  const cycles=34;
  for(let pass=0;pass<cycles*2;pass++) {
    const factor=pass%2===0?.50:-.53;
    for(let i=0;i<count;i++) {
      const weight=weights[i],adjacent=neighbours[i];
      for(let k=0;k<3;k++) {
        let average=0;for(const j of adjacent) average+=current[j*3+k];average/=adjacent.size;
        next[i*3+k]=current[i*3+k]+factor*weight*(average-current[i*3+k]);
      }
      const dx=next[i*3]-positions[i*3],dy=next[i*3+1]-positions[i*3+1],dz=next[i*3+2]-positions[i*3+2],distance=Math.hypot(dx,dy,dz);
      if(distance>.080) {
        const scale=.080/distance;
        next[i*3]=positions[i*3]+dx*scale;next[i*3+1]=positions[i*3+1]+dy*scale;next[i*3+2]=positions[i*3+2]+dz*scale;
      }
    }
    const orientation=guardFaceOrientation(current,next,indices,protectedVertices);
    minimumOrientationRatio=Math.min(minimumOrientationRatio,orientation.minimumRatio);
    // Freeze a protected vertex for both halves of subsequent Taubin cycles.
    // Unequal clipped forward/backward moves would otherwise drift at a pinch.
    for(const i of protectedVertices) weights[i]=0;
    [current,next]=[next,current];
  }
  const beforeFit=current.slice();
  const displacements=[],delta=new THREE.Vector3();let maximumDisplacement=0;
  for(let i=0;i<count;i++) {
    const x=positions[i*3],y=positions[i*3+1],z=positions[i*3+2];
    delta.set(current[i*3]-x,current[i*3+1]-y,current[i*3+2]-z);
    if(delta.length()>.080) delta.setLength(.080);
    // The reference has a central/anterior dome that slopes down into a tapered
    // occipital back. Remove the prior posterior lift and lower the upper rear
    // smoothly, anchored above the inferior cortex. Narrowing follows the same
    // continuous rearward profile; the frontal crown and folds stay in place.
    const fittedX=x+delta.x,fittedY=y+delta.y,fittedZ=z+delta.z;
    const rear=1-THREE.MathUtils.smoothstep(fittedZ,-.90,.35);
    const upper=THREE.MathUtils.smoothstep(fittedY,.58,1.20);
    delta.x-=fittedX*.055*rear;
    delta.y-=.20*rear*upper;
    current[i*3]=x+delta.x;current[i*3+1]=y+delta.y;current[i*3+2]=z+delta.z;
  }
  const fitOrientation=guardFaceOrientation(beforeFit,current,indices,protectedVertices);
  minimumOrientationRatio=Math.min(minimumOrientationRatio,fitOrientation.minimumRatio);
  for(let i=0;i<count;i++) {
    delta.set(current[i*3]-positions[i*3],current[i*3+1]-positions[i*3+1],current[i*3+2]-positions[i*3+2]);
    maximumDisplacement=Math.max(maximumDisplacement,delta.length());
    if(regions[i]>.5) displacements.push(delta.length());
  }
  const roughness=values=>{
    let sum=0,total=0;
    for(let i=0;i<count;i++) if(regions[i]>.5) {
      let dx=0,dy=0,dz=0,length=0;
      for(const j of neighbours[i]) {
        const a=values[j*3]-values[i*3],b=values[j*3+1]-values[i*3+1],c=values[j*3+2]-values[i*3+2];
        dx+=a;dy+=b;dz+=c;length+=Math.hypot(a,b,c);
      }
      sum+=Math.hypot(dx,dy,dz)/Math.max(length,1e-6);total++;
    }
    return sum/total;
  };
  displacements.sort((a,b)=>a-b);
  const crownProfile=values=>Array.from({length:11},(_,i)=>{
    const z=+(1-i*.2).toFixed(2);let maximumY=-Infinity;
    for(let vertex=0;vertex<count;vertex++) if(Math.abs(values[vertex*3+2]-z)<.10) maximumY=Math.max(maximumY,values[vertex*3+1]);
    return {z,maximumY};
  });
  return {positions:current,report:{cycles,posteriorVertices:displacements.length,meanPosteriorDisplacement:displacements.reduce((sum,value)=>sum+value,0)/displacements.length,p95PosteriorDisplacement:displacements[Math.floor(displacements.length*.95)],maximumDisplacement,posteriorRoughnessBefore:roughness(positions),posteriorRoughnessAfter:roughness(current),fairingMidlineProtected:true,deepSulciAnchored:true,orientationProtectedVertices:protectedVertices.size,minimumStepSignedAreaRatio:minimumOrientationRatio,continuousOrientationValidated:true,posteriorTaper:{maximumUpperDrop:.20,maximumInwardFraction:.055,transitionZ:[.35,-.90],crownProfileBefore:crownProfile(positions),crownProfileAfter:crownProfile(current)}}};
}
/** One Loop pass removes the angular facets left by the source scan's decimation.
 * Closed hemisphere topology is kept intact, including the deep sulcal folds. */
function refineCortex(positions, curvature, indices) {
  const count=positions.length/3, neighbours=Array.from({length:count},()=>new Set()), edges=new Map();
  const key=(a,b)=>Math.min(a,b)*count+Math.max(a,b);
  for(let i=0;i<indices.length;i+=3) {
    const triangle=[indices[i],indices[i+1],indices[i+2]];
    for(let k=0;k<3;k++) {
      const a=triangle[k],b=triangle[(k+1)%3],opposite=triangle[(k+2)%3];
      neighbours[a].add(b);neighbours[b].add(a);
      const id=key(a,b),edge=edges.get(id);
      if(edge) edge.opposites.push(opposite);
      else edges.set(id,{a,b,opposites:[opposite],index:count+edges.size});
    }
  }
  if([...edges.values()].some(edge=>edge.opposites.length!==2)) throw new Error('Cortex must contain closed manifold hemispheres');
  const refined=new Float32Array((count+edges.size)*3),values=new Float32Array(count+edges.size);
  for(let i=0;i<count;i++) {
    const adjacent=neighbours[i],n=adjacent.size;
    const beta=(5/8-Math.pow(3/8+1/4*Math.cos(2*Math.PI/n),2))/n;
    for(let c=0;c<3;c++) {
      let sum=0;for(const j of adjacent) sum+=positions[j*3+c];
      refined[i*3+c]=(1-n*beta)*positions[i*3+c]+beta*sum;
    }
    let sum=0;for(const j of adjacent) sum+=curvature[j];
    values[i]=(1-n*beta)*curvature[i]+beta*sum;
  }
  for(const edge of edges.values()) {
    const {a,b,index,opposites:[c,d]}=edge;
    for(let k=0;k<3;k++) refined[index*3+k]=3/8*(positions[a*3+k]+positions[b*3+k])+1/8*(positions[c*3+k]+positions[d*3+k]);
    values[index]=3/8*(curvature[a]+curvature[b])+1/8*(curvature[c]+curvature[d]);
  }
  const refinedIndices=new Uint32Array(indices.length*4);let at=0;
  for(let i=0;i<indices.length;i+=3) {
    const a=indices[i],b=indices[i+1],c=indices[i+2];
    const ab=edges.get(key(a,b)).index,bc=edges.get(key(b,c)).index,ca=edges.get(key(c,a)).index;
    refinedIndices.set([a,ab,ca,b,bc,ab,c,ca,bc,ab,bc,ca],at);at+=12;
  }
  // Keep the fitted brain's original dimensions after fairing; it must not shrink
  // away from the scalp or change the established crown/shell relationship.
  const bounds=values=>new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(values,3));
  const before=bounds(positions),after=bounds(refined),scale=before.getSize(new THREE.Vector3()).divide(after.getSize(new THREE.Vector3()));
  for(let i=0;i<refined.length/3;i++) for(let c=0;c<3;c++) refined[i*3+c]=(refined[i*3+c]-after.min.getComponent(c))*scale.getComponent(c)+before.min.getComponent(c);
  return {positions:refined,curvature:values,indices:refinedIndices,scale:scale.toArray()};
}

function brainGeometry(mobile) {
  const primitive=brainSource.document.meshes.find(m=>m.name==='unified-cortex').primitives[0];
  const positions=attribute(brainSource,primitive.attributes.POSITION);
  const curvature=attribute(brainSource,primitive.attributes._CURVATURE);
  for(let i=0;i<positions.length/3;i++) {
    positions[i*3]*=0.0153;
    positions[i*3+1]=positions[i*3+1]*0.0122+0.60;
    positions[i*3+2]=positions[i*3+2]*0.0126+0.12;
  }
  const original=new Uint32Array(attribute(brainSource,primitive.indices));
  const faired=fairPosterior(positions,original),refined=refineCortex(faired.positions,curvature,original),uv=new Float32Array(refined.positions.length/3*2);
  for(let i=0;i<refined.curvature.length;i++) uv[i*2]=THREE.MathUtils.clamp((refined.curvature[i]+0.35)/0.8,0,1);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(refined.positions,3));
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  geometry.setIndex(new THREE.BufferAttribute(refined.indices,1));geometry.computeVertexNormals();
  // Simplify with the smooth high-resolution normals, then retain those normals.
  // Recomputing them from the reduced triangles made the rear gyri look crumpled.
  const normals=geometry.attributes.normal.array,attributes=new Float32Array(refined.positions.length/3*4);
  for(let i=0;i<refined.positions.length/3;i++) attributes.set([normals[i*3],normals[i*3+1],normals[i*3+2],uv[i*2]],i*4);
  const vertexCount=refined.positions.length/3,locked=new Uint8Array(vertexCount);
  let indices,error,simplificationPasses=0;
  for(let pass=0;pass<4;pass++) {
    [indices,error]=MeshoptSimplifier.simplifyWithAttributes(refined.indices,refined.positions,3,attributes,4,[0.75,0.75,0.75,0.15],locked,(mobile?62000:118000)*3,0.008,['LockBorder']);
    simplificationPasses++;
    // Close sulcal sheets can pinch into a non-manifold edge at phone detail.
    // Protect only those neighbourhoods and retry, instead of accepting holes
    // or inflating the entire mobile model's triangle budget.
    const edges=new Map();
    for(let i=0;i<indices.length;i+=3) for(let k=0;k<3;k++) {
      const a=indices[i+k],b=indices[i+(k+1)%3],key=Math.min(a,b)*vertexCount+Math.max(a,b);
      const edge=edges.get(key)??{a,b,count:0};edge.count++;edges.set(key,edge);
    }
    const pinches=[...edges.values()].filter(edge=>edge.count>2);
    if(!pinches.length) break;
    if(pass===3) throw new Error('Unable to preserve sulcal topology');
    for(const {a,b} of pinches) {locked[a]=1;locked[b]=1;}
    for(let ring=0;ring<2;ring++) {
      const expanded=locked.slice();
      for(let i=0;i<refined.indices.length;i+=3) {
        const a=refined.indices[i],b=refined.indices[i+1],c=refined.indices[i+2];
        if(locked[a]||locked[b]||locked[c]) {expanded[a]=1;expanded[b]=1;expanded[c]=1;}
      }
      locked.set(expanded);
    }
  }
  geometry.setIndex(new THREE.BufferAttribute(indices,1));
  const reference=new THREE.BufferGeometry();
  reference.setAttribute('position',new THREE.BufferAttribute(positions,3));reference.setIndex(new THREE.BufferAttribute(original.slice(),1));
  const referenceBvh=new MeshBVH(reference),distances=[],point=new THREE.Vector3();
  const used=[...new Set(indices)],stride=Math.max(1,Math.floor(used.length/10000));
  for(let i=0;i<used.length;i+=stride) {
    point.fromArray(refined.positions,used[i]*3);distances.push(referenceBvh.closestPointToPoint(point).distance);
  }
  distances.sort((a,b)=>a-b);reference.dispose();
  const bounds=new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(positions,3));
  const sourceScale=bounds.getSize(new THREE.Vector3()).length();
  const deviation={samples:distances.length,mean:distances.reduce((sum,value)=>sum+value,0)/distances.length,p95:distances[Math.floor(distances.length*.95)],maximum:distances.at(-1),maximumFractionOfBrainDiagonal:distances.at(-1)/sourceScale};
  if(deviation.maximumFractionOfBrainDiagonal>.085) throw new Error('Cortex fairing/taper deviated too far from the source');
  geometry.userData.refinement={sourceTriangles:original.length/3,refinedTriangles:refined.indices.length/3,posteriorFairing:faired.report,simplificationError:error,simplificationPasses,protectedSulcalVertices:locked.reduce((sum,value)=>sum+value,0),boundsRestorationScale:refined.scale,highResolutionNormalsPreserved:true,sourceBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},sourceSurfaceDeviation:deviation};
  console.log(JSON.stringify({cortex:mobile?'mobile':'desktop',triangles:indices.length/3,...geometry.userData.refinement}));
  return geometry;
}
function geometryData(geometry) {
  return {attributes:{POSITION:geometry.attributes.position.array,NORMAL:geometry.attributes.normal.array,TEXCOORD_0:geometry.attributes.uv.array},indices:geometry.index.array};
}
/** The accepted correction is a small, feathered nudge of the lower rear corner.
 * It is applied to the freshly rebuilt/encoded baseline, never to an active
 * output asset, so successive builds cannot accumulate the deformation. */
function applyLocalRearCorrection(data, {centre=[.55,.83,-.875],radii=[.28,.20,.27],amplitude=.030,coordinateSpace='xyz',protectSlivers=false,outward=false}={}) {
  const before=data.attributes.POSITION.slice(),positions=data.attributes.POSITION,normals=data.attributes.NORMAL;
  let affectedVertices=0,maximumDisplacement=0,minimumJacobian=1,maximumChangedY=-Infinity;
  const direction=new THREE.Vector3(),gradient=new THREE.Vector3(),normal=new THREE.Vector3();
  for(let i=0;i<positions.length;i+=3) {
    const x=positions[i],y=positions[i+1],z=positions[i+2],sign=x<0?-1:1;
    const offset=coordinateSpace==='rim'?[(Math.abs(x)-z)*Math.SQRT1_2-centre[0],y-centre[1],(Math.abs(x)+z)*Math.SQRT1_2-centre[2]]:[Math.abs(x)-centre[0],y-centre[1],z-centre[2]];
    const r2=offset.reduce((sum,value,k)=>sum+value*value/(radii[k]*radii[k]),0);
    if(r2>=1)continue;
    const oneMinus=1-r2,weight=oneMinus*oneMinus*oneMinus;
    direction.set(outward?sign*Math.SQRT1_2:-sign*Math.SQRT1_2,0,outward?-Math.SQRT1_2:Math.SQRT1_2).multiplyScalar(amplitude);
    if(coordinateSpace==='rim') {
      const radialGradient=offset[0]/(radii[0]*radii[0]),depthGradient=offset[2]/(radii[2]*radii[2]);
      gradient.set(sign*(radialGradient+depthGradient)*Math.SQRT1_2,offset[1]/(radii[1]*radii[1]),(depthGradient-radialGradient)*Math.SQRT1_2).multiplyScalar(-6*oneMinus*oneMinus);
    } else gradient.set(sign*offset[0]/(radii[0]*radii[0]),offset[1]/(radii[1]*radii[1]),offset[2]/(radii[2]*radii[2])).multiplyScalar(-6*oneMinus*oneMinus);
    const determinant=1+gradient.dot(direction);if(determinant<.5)throw new Error('Unsafe local rear correction');
    minimumJacobian=Math.min(minimumJacobian,determinant);
    positions[i]+=direction.x*weight;positions[i+1]+=direction.y*weight;positions[i+2]+=direction.z*weight;
    // Exact inverse-transpose of I + direction ⊗ gradient retains the detailed
    // baseline normals, including every normal outside the local patch.
    normal.fromArray(normals,i);normal.addScaledVector(gradient,-direction.dot(normal)/determinant).normalize().toArray(normals,i);
    affectedVertices++;maximumChangedY=Math.max(maximumChangedY,y);maximumDisplacement=Math.max(maximumDisplacement,direction.length()*weight);
  }
  const sliverSafeguard=protectSlivers?protectLocalSlivers(before,data):undefined;
  let minimumFaceOrientation=1,flippedFaces=0;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),u=new THREE.Vector3(),v=new THREE.Vector3();
  const faceNormal=(values,i)=>{a.fromArray(values,data.indices[i]*3);b.fromArray(values,data.indices[i+1]*3);c.fromArray(values,data.indices[i+2]*3);return u.subVectors(b,a).cross(v.subVectors(c,a)).clone();};
  for(let i=0;i<data.indices.length;i+=3) {
    const n=faceNormal(before,i),m=faceNormal(positions,i),ratio=n.dot(m)/n.lengthSq();minimumFaceOrientation=Math.min(minimumFaceOrientation,ratio);if(ratio<=0)flippedFaces++;
  }
  if(flippedFaces)throw new Error('Local rear correction flipped a triangle');
  return {centre,radii,amplitude,coordinateSpace,direction:outward?'outward':'inward',affectedVertices,totalVertices:positions.length/3,maximumDisplacement,maximumChangedY,minimumJacobian,minimumFaceOrientation,flippedFaces,sliverSafeguard,upperHalfUnchanged:maximumChangedY<1.03};
}
function protectLocalSlivers(before,data) {
 const positions=data.attributes.POSITION;
 // A handful of nearly collinear source vertices need sub-pixel corrections
 // after sampling a smooth warp. Project their displacement minimally onto a
 // positive-area constraint, rather than locking points and making a spike.
 const desired=positions.slice(),guardedVertices=new Set();let guardPasses=0;
 const ga=new THREE.Vector3(),gb=new THREE.Vector3(),gc=new THREE.Vector3(),gn=new THREE.Vector3(),gm=new THREE.Vector3(),gu=new THREE.Vector3(),gv=new THREE.Vector3(),gd=new THREE.Vector3();
 const sampleNormal=(values,ids,target)=>{ga.fromArray(values,ids[0]*3);gb.fromArray(values,ids[1]*3);gc.fromArray(values,ids[2]*3);return target.subVectors(gb,ga).cross(gv.subVectors(gc,ga));};
 for(;guardPasses<12;guardPasses++) {
  let changes=0;
  for(let i=0;i<data.indices.length;i+=3) {
   const ids=Array.from(data.indices.slice(i,i+3));sampleNormal(before,ids,gn);const normalSquared=gn.lengthSq();sampleNormal(positions,ids,gm);
   const ratio=gn.dot(gm)/normalSquared;if(ratio>=.30)continue;
   const sign=before[ids[0]*3]<0?-1:1;gd.set(-sign*Math.SQRT1_2,0,Math.SQRT1_2);
   const coefficients=[gn.dot(gu.subVectors(gb,gc).cross(gd))*-1,gn.dot(gu.subVectors(gc,ga).cross(gd))*-1,gn.dot(gu.subVectors(gb,ga).cross(gd))].map(v=>v/normalSquared);
   const lengthSquared=coefficients.reduce((sum,value)=>sum+value*value,0),scale=(.65-ratio)/lengthSquared;
   for(let k=0;k<3;k++){const id=ids[k],delta=scale*coefficients[k];positions[id*3]+=gd.x*delta;positions[id*3+2]+=gd.z*delta;guardedVertices.add(id);}
   changes++;
  }
  if(!changes)break;
 }
 if(guardPasses===12)throw new Error('Sliver safeguard did not converge');
 let maximumGuardAdjustment=0;for(const id of guardedVertices)maximumGuardAdjustment=Math.max(maximumGuardAdjustment,Math.hypot(positions[id*3]-desired[id*3],positions[id*3+1]-desired[id*3+1],positions[id*3+2]-desired[id*3+2]));
 if(maximumGuardAdjustment>.0015)throw new Error('Sliver safeguard exceeded its local limit');
 return {guardedVertices:guardedVertices.size,guardPasses,maximumGuardAdjustment};
}
function validateClosedCortex(decoded) {
  const {POSITION:positions,NORMAL:normals}=decoded.attributes,count=positions.length/3,parent=Uint32Array.from({length:count},(_,i)=>i),edges=new Map();
  const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const join=(a,b)=>{parent[find(a)]=find(b);};
  for(let i=0;i<decoded.indices.length;i+=3) for(let k=0;k<3;k++) {
    const a=decoded.indices[i+k],b=decoded.indices[i+(k+1)%3];
    if(a>=count||b>=count||a===b) throw new Error('Invalid cortical triangle');
    join(a,b);const key=Math.min(a,b)*count+Math.max(a,b),edge=edges.get(key)??{count:0,direction:0};
    edge.count++;edge.direction+=a<b?1:-1;edges.set(key,edge);
  }
  const boundaryEdges=[...edges.values()].filter(edge=>edge.count===1).length;
  const nonManifoldEdges=[...edges.values()].filter(edge=>edge.count>2).length;
  const inconsistentWindingEdges=[...edges.values()].filter(edge=>edge.direction!==0).length;
  const used=new Set(decoded.indices),components=new Set([...used].map(find)).size,eulerNumber=used.size-edges.size+decoded.indices.length/3;
  if(boundaryEdges||nonManifoldEdges||inconsistentWindingEdges||components!==2||eulerNumber!==4) throw new Error(`Cortex topology changed: ${JSON.stringify({boundaryEdges,nonManifoldEdges,inconsistentWindingEdges,components,eulerNumber})}`);
  let minimumNormalLength=Infinity,maximumNormalLength=0;
  for(let i=0;i<normals.length;i+=3) {
    const length=Math.hypot(normals[i],normals[i+1],normals[i+2]);minimumNormalLength=Math.min(minimumNormalLength,length);maximumNormalLength=Math.max(maximumNormalLength,length);
  }
  if(minimumNormalLength<.99||maximumNormalLength>1.01) throw new Error('Invalid cortical normals');
  return {components,eulerNumber,boundaryEdges,nonManifoldEdges,inconsistentWindingEdges,minimumNormalLength,maximumNormalLength};
}
function validateEncodedLocalCorrection(before,data,decoded,{profileStart=.55,profileStep=.025,profileCount=13,profileHalfWindow=.0125}={}) {
 const positions=data.attributes.POSITION;
 const ga=new THREE.Vector3(),gb=new THREE.Vector3(),gc=new THREE.Vector3(),gn=new THREE.Vector3(),gm=new THREE.Vector3(),gv=new THREE.Vector3();
 const sampleNormal=(values,ids,target)=>{ga.fromArray(values,ids[0]*3);gb.fromArray(values,ids[1]*3);gc.fromArray(values,ids[2]*3);return target.subVectors(gb,ga).cross(gv.subVectors(gc,ga));};
 // Match decoded vertices back to their pre-encoding source positions to verify
 // that position quantization has not inverted a protected narrow triangle.
 const cellSize=.00005,cells=new Map(),mapping=new Uint32Array(decoded.attributes.POSITION.length/3),matched=new Set();
 const cellKey=(x,y,z)=>`${x},${y},${z}`;
 for(let i=0;i<positions.length/3;i++){const key=cellKey(Math.floor(positions[i*3]/cellSize),Math.floor(positions[i*3+1]/cellSize),Math.floor(positions[i*3+2]/cellSize));const bucket=cells.get(key)??[];bucket.push(i);cells.set(key,bucket);}
 for(let i=0;i<mapping.length;i++){
  const values=decoded.attributes.POSITION,x=values[i*3],y=values[i*3+1],z=values[i*3+2],ix=Math.floor(x/cellSize),iy=Math.floor(y/cellSize),iz=Math.floor(z/cellSize);let nearest=-1,best=Infinity;
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)for(const id of cells.get(cellKey(ix+dx,iy+dy,iz+dz))??[]){const distance=(positions[id*3]-x)**2+(positions[id*3+1]-y)**2+(positions[id*3+2]-z)**2;if(distance<best){best=distance;nearest=id;}}
  if(nearest<0||best>1e-9||matched.has(nearest))throw new Error('Encoded vertex correspondence failed');mapping[i]=nearest;matched.add(nearest);
 }
 let encodedMinimumFaceOrientation=Infinity,encodedFlippedFaces=0;
 for(let i=0;i<decoded.indices.length;i+=3){const ids=Array.from(decoded.indices.slice(i,i+3)),baseIds=ids.map(id=>mapping[id]);sampleNormal(before,baseIds,gn);sampleNormal(decoded.attributes.POSITION,ids,gm);const ratio=gn.dot(gm)/gn.lengthSq();encodedMinimumFaceOrientation=Math.min(encodedMinimumFaceOrientation,ratio);if(ratio<=0)encodedFlippedFaces++;}
 if(encodedFlippedFaces)throw new Error('Encoding inverted a cortical triangle');
 const profile=values=>Array.from({length:profileCount},(_,bin)=>{const y=profileStart+bin*profileStep;let right=-Infinity;for(let i=0;i<values.length;i+=3)if(Math.abs(values[i+1]-y)<profileHalfWindow)right=Math.max(right,(values[i]-values[i+2])*Math.SQRT1_2);return {y,right};});
 const profileBefore=profile(before),profileAfter=profile(decoded.attributes.POSITION),projectedProfile=profileAfter.map((row,i)=>({y:row.y,before:profileBefore[i].right,after:row.right,reduction:profileBefore[i].right-row.right}));
 return {encodedMinimumFaceOrientation,encodedFlippedFaces,projectedProfile};
}
function updatePrimitive(document,views,primitive,data) {
  validateClosedCortex(data);
  const encoded=encode(data), extension=primitive.extensions.KHR_draco_mesh_compression;
  views[extension.bufferView]=encoded.bytes;extension.attributes=encoded.ids;
  const decoded=decode(encoded.bytes,encoded.ids);
  for(const [name,id] of Object.entries(primitive.attributes)) {
    const accessor=document.accessors[id],values=decoded.attributes[name];
    if(values.some(v=>!Number.isFinite(v))) throw new Error('Nonfinite geometry');
    accessor.count=values.length/(name==='TEXCOORD_0'?2:3);
    if(name==='POSITION') {
      accessor.min=[Infinity,Infinity,Infinity];accessor.max=[-Infinity,-Infinity,-Infinity];
      values.forEach((v,i)=>{accessor.min[i%3]=Math.min(accessor.min[i%3],v);accessor.max[i%3]=Math.max(accessor.max[i%3],v);});
    }
  }
  document.accessors[primitive.indices].count=decoded.indices.length;
  const positionAccessor=document.accessors[primitive.attributes.POSITION];
  return {triangles:decoded.indices.length/3,vertices:decoded.attributes.POSITION.length/3,bounds:{min:positionAccessor.min,max:positionAccessor.max},topology:validateClosedCortex(decoded)};
}
const reports=[];
for(const variant of ['desktop','mobile']) {
  const source=readGlb(path.join(root,`public/models/cymba-neural-mannequin-organic-detailed-${variant}.glb`));
  const {document,views}=source;
  const headNode=document.nodes.find(n=>n.name==='Cymba_Marble_Mannequin');
  const headView=document.meshes[headNode.mesh].primitives[0].extensions.KHR_draco_mesh_compression.bufferView;
  const originalHead=Buffer.from(views[headView]);
  // Remove the old line-overlay geometry completely. Activity is now a property
  // of the cortex material, and no convex-hull network sits above the folds.
  if(document.nodes.length!==2 || document.meshes.length!==2 || views.length!==2) throw new Error('Unexpected mannequin source layout');
  const headMesh=document.meshes[headNode.mesh],headPrimitive=headMesh.primitives[0];
  const headMaterial=document.materials[headPrimitive.material],keptAccessors=[];
  for(const name of Object.keys(headPrimitive.attributes)) {
    keptAccessors.push(document.accessors[headPrimitive.attributes[name]]);headPrimitive.attributes[name]=keptAccessors.length-1;
  }
  keptAccessors.push(document.accessors[headPrimitive.indices]);headPrimitive.indices=keptAccessors.length-1;
  headPrimitive.extensions.KHR_draco_mesh_compression.bufferView=0;headPrimitive.material=0;headNode.mesh=0;
  document.nodes=[headNode];document.meshes=[headMesh];document.materials=[headMaterial];document.accessors=keptAccessors;
  document.bufferViews=[document.bufferViews[headView]];views.splice(0,views.length,originalHead);
  for(const scene of document.scenes) scene.nodes=[0];
  const cortex=brainGeometry(variant==='mobile');
  const material=document.materials.length;
  document.materials.push({name:'Pearl cortical surface',pbrMetallicRoughness:{baseColorFactor:[.85,.78,.79,1],metallicFactor:0,roughnessFactor:.45}});
  const primitive={attributes:{},indices:0,material,extensions:{KHR_draco_mesh_compression:{bufferView:views.length,attributes:{}}}};
  views.push(Buffer.alloc(0));document.bufferViews.push({buffer:0,byteLength:0});
  for(const name of ['POSITION','NORMAL','TEXCOORD_0']) {
    primitive.attributes[name]=document.accessors.length;
    document.accessors.push({componentType:5126,type:name==='TEXCOORD_0'?'VEC2':'VEC3',count:0});
  }
  primitive.indices=document.accessors.length;document.accessors.push({componentType:5125,type:'SCALAR',count:0});
  // Encode/decode the deterministic baseline first, matching the visually
  // approved isolated candidate exactly while always starting from source data.
  updatePrimitive(document,views,primitive,geometryData(cortex));
  const baselineExtension=primitive.extensions.KHR_draco_mesh_compression;
  const corrected=decode(views[baselineExtension.bufferView],baselineExtension.attributes);
  const localRearCorrection=applyLocalRearCorrection(corrected);
  updatePrimitive(document,views,primitive,corrected);
  // Reproduce the separately reviewed, slight follow-up above the ear from the
  // decoded first correction. These two fixed stages never read active assets.
  const secondExtension=primitive.extensions.KHR_draco_mesh_compression;
  const smoothed=decode(views[secondExtension.bufferView],secondExtension.attributes);
  const localAboveEarSmoothing=applyLocalRearCorrection(smoothed,{centre:[.53,.84,-.85],radii:[.25,.18,.24],amplitude:.016});
  updatePrimitive(document,views,primitive,smoothed);
  // The circled lower tip sits below both earlier patches. This final rim-aligned
  // patch follows only that tip and its adjacent fold, with no effect above Y .91.
  const thirdExtension=primitive.extensions.KHR_draco_mesh_compression;
  const lowerTip=decode(views[thirdExtension.bufferView],thirdExtension.attributes),beforeLowerTip=lowerTip.attributes.POSITION.slice();
  const localLowerTipSmoothing=applyLocalRearCorrection(lowerTip,{centre:[1.03,.69,-.19],radii:[.22,.22,.50],amplitude:.055,coordinateSpace:'rim',protectSlivers:true});
  updatePrimitive(document,views,primitive,lowerTip);
  const finalExtension=primitive.extensions.KHR_draco_mesh_compression;
  Object.assign(localLowerTipSmoothing,validateEncodedLocalCorrection(beforeLowerTip,lowerTip,decode(views[finalExtension.bufferView],finalExtension.attributes)));
  // A final, very subtle outward curve rounds the marked mid-rear wall. Its
  // compact patch leaves the newly corrected lower tip and the crown untouched.
  const roundExtension=primitive.extensions.KHR_draco_mesh_compression;
  const rounded=decode(views[roundExtension.bufferView],roundExtension.attributes),beforeRounding=rounded.attributes.POSITION.slice();
  const localRearRounding=applyLocalRearCorrection(rounded,{centre:[.91,1.06,-.05],radii:[.20,.28,.50],amplitude:.026,coordinateSpace:'rim',protectSlivers:true,outward:true});
  const roundedCortexReport=updatePrimitive(document,views,primitive,rounded);
  const roundedExtension=primitive.extensions.KHR_draco_mesh_compression;
  Object.assign(localRearRounding,validateEncodedLocalCorrection(beforeRounding,rounded,decode(views[roundedExtension.bufferView],roundedExtension.attributes),{profileStart:.75,profileStep:.05,profileCount:14,profileHalfWindow:.025}));
  const brainReport={...roundedCortexReport,...cortex.userData.refinement,sourceSurfaceDeviation:{...cortex.userData.refinement.sourceSurfaceDeviation,stage:'before local rear corrections'},localRearCorrection,localAboveEarSmoothing,localLowerTipSmoothing,localRearRounding};cortex.dispose();
  const mesh=document.meshes.length;document.meshes.push({name:'Cortical_Brain',primitives:[primitive]});
  const node=document.nodes.length;document.nodes.push({name:'Cortical_Brain',mesh,extras:{source:'OpenNeuro ds006128, CC0-1.0; brain-explorer cortical surface',illustrative:true}});document.scenes[0].nodes.push(node);
  if(!originalHead.equals(views[0])) throw new Error('Original sculpture changed');
  const output=writeGlb(document,views),filename=`public/models/cymba-cortical-mannequin-${variant}.glb`;
  fs.writeFileSync(path.join(root,filename),output);
  const report={variant,filename,bytes:output.length,sha256:hash(output),cortex:brainReport,networkRemoved:true,sculpturePreserved:true,sculptureGeometrySha256:hash(originalHead)};reports.push(report);console.log(JSON.stringify(report));
}
fs.writeFileSync(path.join(root,'scripts/cortical-brain-report.json'),JSON.stringify(reports,null,2)+'\n');

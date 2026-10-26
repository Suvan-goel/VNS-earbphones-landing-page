"""Export native CAD, STEP solids and portable binary glTF from one geometry registry."""
from common import *
import json, struct, os, hashlib, MeshPart
from pathlib import Path

def export_all(outdir, metrics):
 out=Path(outdir);out.mkdir(parents=True,exist_ok=True)
 doc=App.newDocument('CYMBA_v03_Concept')
 groups={}; objects=[]; records=[]; errors=[]
 for i,p in enumerate(PARTS):
  s=p['shape']
  if s.isNull() or not s.isValid() or not s.Solids: errors.append(p['name'])
  gname=p['group']
  if gname not in groups:groups[gname]=doc.addObject('App::DocumentObjectGroup','Group'+str(len(groups)));groups[gname].Label=gname
  o=doc.addObject('Part::Feature','Part'+str(i).zfill(3));o.Label=p['name'];o.Shape=s;groups[gname].addObject(o)
  for prop,value in [('Role',p['role']),('Source',p['source']),('Assumptions',p['notes']),('Finish',p['material'])]:
   o.addProperty('App::PropertyString',prop,'Specification');setattr(o,prop,value)
  o.addProperty('App::PropertyVector','ExplodeOffset','Specification');o.ExplodeOffset=V(*p['explode'])
  if 'contactAreaMm2' in p:o.addProperty('App::PropertyArea','ContactFaceArea','Specification');o.ContactFaceArea=p['contactAreaMm2']
  bb=s.optimalBoundingBox(False)
  records.append({**{k:v for k,v in p.items() if k!='shape'},'objectName':o.Name,'valid':s.isValid(),'solids':len(s.Solids),'volumeMm3':s.Volume,'boundsMm':[[bb.XMin,bb.YMin,bb.ZMin],[bb.XMax,bb.YMax,bb.ZMax]]})
  objects.append(o)
 if errors:raise RuntimeError('Invalid or non-solid parts: '+str(errors))
 doc.recompute();doc.saveAs(str(out/'editable.FCStd'))
 print('Export STEP',flush=True)
 import Import
 main=[o for o,p in zip(objects,PARTS) if p['group'] not in ['Fit kit','Cable section']]
 Import.export(main,str(out/'assembly.step'))
 Import.export([o for o,p in zip(objects,PARTS) if p['group']=='Fit kit'],str(out/'fit-kit.step'))
 # glTF meters, named nodes, all source metadata in node extras.
 gltf={'asset':{'version':'2.0','generator':'CYMBA v0.3 FreeCAD solid tessellation','extras':{'sourceUnits':'millimeters','geometryStatus':'concept pre-prototype; assumed package dimensions'}},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':[],'buffers':[],'bufferViews':[],'accessors':[]}
 matids={}
 for name,m in MATERIALS.items():
  matids[name]=len(gltf['materials']);gltf['materials'].append({'name':name,'pbrMetallicRoughness':{'baseColorFactor':[(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for v in m['color']]+[1],'metallicFactor':m['metallic'],'roughnessFactor':m['roughness']},'doubleSided':False})
 # Preserve the same optical finishes in supporting glTF viewers. The special
 # smoked housing material is assigned only to earbud shells, never the hub.
 def linear_rgb(code):
  values=[int(code[i:i+2],16)/255 for i in (0,2,4)]
  return [(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for v in values]
 def physical_material(name,color,metal,rough,transmission,thickness,attenuation):
  return {'name':name,'pbrMetallicRoughness':{'baseColorFactor':linear_rgb(color)+[1],'metallicFactor':metal,'roughnessFactor':rough},'doubleSided':False,
   'extensions':{'KHR_materials_transmission':{'transmissionFactor':transmission},'KHR_materials_ior':{'ior':1.48 if name=='smoked_shell' else 1.42},
    'KHR_materials_volume':{'thicknessFactor':thickness,'attenuationColor':linear_rgb(attenuation),'attenuationDistance':.0025 if name=='smoked_shell' else .002},
    'KHR_materials_clearcoat':{'clearcoatFactor':.42 if name=='smoked_shell' else .08,'clearcoatRoughnessFactor':.21 if name=='smoked_shell' else .5}}}
 gltf['extensionsUsed']=['KHR_materials_transmission','KHR_materials_ior','KHR_materials_volume','KHR_materials_clearcoat']
 gltf['materials'][matids['tip']]=physical_material('tip','757679',0,.48,.22,.0007,'939497')
 matids['smoked_shell']=len(gltf['materials']);gltf['materials'].append(physical_material('smoked_shell','464741',.02,.29,.38,.0012,'716859'))
 blob=bytearray()
 def accessor(data,component,typ,count,minimum=None,maximum=None,target=None):
  while len(blob)%4:blob.append(0)
  off=len(blob);blob.extend(data);view={'buffer':0,'byteOffset':off,'byteLength':len(data)}
  if target:view['target']=target
  vi=len(gltf['bufferViews']);gltf['bufferViews'].append(view)
  a={'bufferView':vi,'componentType':component,'count':count,'type':typ}
  if minimum is not None:a['min']=minimum;a['max']=maximum
  ai=len(gltf['accessors']);gltf['accessors'].append(a);return ai
 triangles=0
 for i,(p,record) in enumerate(zip(PARTS,records)):
  # Tessellate each face separately to preserve intentional sharp edges.
  vertices=[];indices=[];normals=[]
  for face in p['shape'].Faces:
   face_mesh=MeshPart.meshFromShape(Shape=face,LinearDeflection=.035,AngularDeflection=.20,Relative=False)
   vv,tt=face_mesh.Topology
   if not tt:continue
   start=len(vertices);ns=[[0.,0.,0.] for v in vv]
   for tri in tt:
    a,b,c=[vv[j] for j in tri];n=(b-a).cross(c-a)
    for j in tri:
     ns[j][0]+=n.x;ns[j][1]+=n.y;ns[j][2]+=n.z
    indices.extend(start+j for j in tri)
   vertices.extend((v.x*.001,v.y*.001,v.z*.001) for v in vv)
   surface=face.Surface
   exact_finish=p['group'] in ['Left earbud','Right earbud','Fit kit'] and p['material'] in ['shell','face','silicone','tip','stim','stim_return','eeg','gold','glass']
   for v,n in zip(vv,ns):
    # Use the exact underlying CAD surface normal for continuous highlights.
    # Triangle averages are only a fallback at singular surface parameters.
    if exact_finish:
     try:
      u,w=surface.parameter(v);exact=face.normalAt(u,w)
      if exact.dot(V(*n))<0:exact=-exact
      n=[exact.x,exact.y,exact.z]
     except Exception:pass
    ll=math.sqrt(sum(x*x for x in n)) or 1;normals.append(tuple(x/ll for x in n))
  if not vertices:raise RuntimeError('Empty mesh '+p['name'])
  mins=[min(v[j] for v in vertices) for j in range(3)];maxs=[max(v[j] for v in vertices) for j in range(3)]
  pos=accessor(struct.pack('<'+'f'*(3*len(vertices)),*[x for v in vertices for x in v]),5126,'VEC3',len(vertices),mins,maxs,34962)
  normal=accessor(struct.pack('<'+'f'*(3*len(normals)),*[x for v in normals for x in v]),5126,'VEC3',len(normals),target=34962)
  idx=accessor(struct.pack('<'+'I'*len(indices),*indices),5125,'SCALAR',len(indices),target=34963)
  material_key='smoked_shell' if p['material']=='shell' and 'Inner housing shell' in p['name'] else p['material']
  mi=len(gltf['meshes']);gltf['meshes'].append({'name':p['name'],'primitives':[{'attributes':{'POSITION':pos,'NORMAL':normal},'indices':idx,'material':matids[material_key]}]})
  ni=len(gltf['nodes']);gltf['nodes'].append({'name':p['name'],'mesh':mi,'extras':{k:v for k,v in record.items() if k not in ['boundsMm']}});gltf['scenes'][0]['nodes'].append(ni)
  triangles+=len(indices)//3
  if i%25==0:print('Tessellated',i,'/',len(PARTS),flush=True)
 while len(blob)%4:blob.append(0)
 gltf['buffers']=[{'byteLength':len(blob)}]
 js=json.dumps(gltf,separators=(',',':')).encode()
 while len(js)%4:js+=b' '
 length=12+8+len(js)+8+len(blob)
 with open(out/'assembly.glb','wb') as f:
  f.write(struct.pack('<III',0x46546c67,2,length));f.write(struct.pack('<II',len(js),0x4e4f534a));f.write(js);f.write(struct.pack('<II',len(blob),0x004e4942));f.write(blob)
 report={'status':'Concept CAD geometry checks; not manufacturing or medical validation','cadUnits':'mm','glbUnits':'m','partCount':len(PARTS),'triangleCount':triangles,'allShapesValid':not errors,'metrics':metrics,'parts':records}
 (out/'model-manifest.json').write_text(json.dumps(report,indent=2))
 (out/'validation.json').write_text(json.dumps({k:v for k,v in report.items() if k!='parts'},indent=2))
 print('FINISHED',len(PARTS),'parts',triangles,'triangles',flush=True)
 return doc

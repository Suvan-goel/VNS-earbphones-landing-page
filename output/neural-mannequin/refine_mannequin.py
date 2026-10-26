"""Refine the user-supplied Meshy bust in Blender and export a web-ready asset."""
import bpy, bmesh, json, math, hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT=Path('/Users/suvangoel/VNS-earbuds-site')
OUT=ROOT/'output/neural-mannequin'
SOURCE=Path('/Users/suvangoel/Downloads/Meshy_AI_neural_head_bust_fron_1025174930_image-to-3d-texture.glb')
DEST=ROOT/'public/models/cymba-neural-mannequin.glb'
SIZE=2048
SCALE=2.25
SHIFT=Vector((0,-.2875,-.2875))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
scene=bpy.context.scene
head=next(o for o in scene.objects if o.type=='MESH')
bpy.context.view_layer.objects.active=head
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
head.name='Cymba_Marble_Mannequin'
original_faces=len(head.data.polygons)
source=bpy.data.images['Image_0'];source.scale(SIZE,SIZE)
pixels=np.empty(SIZE*SIZE*4,dtype=np.float32);source.pixels.foreach_get(pixels)
source_rgb=pixels.reshape(SIZE,SIZE,4)[:,:,:3].copy()

# Retain the supplied sculpture and UVs, removing redundant triangulation.
bm=bmesh.new();bm.from_mesh(head.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000008)
bm.to_mesh(head.data);bm.free()
smooth=head.modifiers.new('Very gentle surface refinement','SMOOTH');smooth.factor=.22;smooth.iterations=2
bpy.ops.object.modifier_apply(modifier=smooth.name)
dec=head.modifiers.new('Web silhouette preservation','DECIMATE');dec.ratio=.19
bpy.ops.object.modifier_apply(modifier=dec.name)
for face in head.data.polygons:face.use_smooth=True

# Bake continuous object-space geological veining into the original UV atlas.
mat=bpy.data.materials.new('Honed ivory marble with purple neural inlay');mat.use_nodes=True
head.data.materials.clear();head.data.materials.append(mat)
nodes=mat.node_tree.nodes;links=mat.node_tree.links;nodes.clear()
out=nodes.new('ShaderNodeOutputMaterial');out.location=(950,0)
emit=nodes.new('ShaderNodeEmission');links.new(emit.outputs[0],out.inputs['Surface'])
coord=nodes.new('ShaderNodeTexCoord')
mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(2.2,.9,1.6)
links.new(coord.outputs['Generated'],mapping.inputs[0])
noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=3.1;noise.inputs['Detail'].default_value=4;noise.inputs['Roughness'].default_value=.65
links.new(mapping.outputs['Vector'],noise.inputs['Vector'])
wave=nodes.new('ShaderNodeTexWave');wave.wave_type='BANDS';wave.bands_direction='DIAGONAL'
wave.inputs['Scale'].default_value=1.9;wave.inputs['Distortion'].default_value=10;wave.inputs['Detail'].default_value=5;wave.inputs['Detail Scale'].default_value=1.1;wave.inputs['Detail Roughness'].default_value=.65
links.new(mapping.outputs['Vector'],wave.inputs['Vector'])
veins=nodes.new('ShaderNodeValToRGB');veins.color_ramp.elements[0].position=.015;veins.color_ramp.elements[0].color=(.49,.46,.41,1)
veins.color_ramp.elements[1].position=.065;veins.color_ramp.elements[1].color=(.77,.735,.67,1)
links.new(wave.outputs['Color'],veins.inputs[0])
clouds=nodes.new('ShaderNodeValToRGB');clouds.color_ramp.elements[0].color=(.68,.65,.59,1);clouds.color_ramp.elements[1].color=(.84,.81,.74,1)
links.new(noise.outputs['Fac'],clouds.inputs[0])
mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MIX';mix.inputs[0].default_value=.22
links.new(clouds.outputs[0],mix.inputs[1]);links.new(veins.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],emit.inputs['Color'])
bake=bpy.data.images.new('Marble procedural bake',width=SIZE,height=SIZE,alpha=False,float_buffer=True)
target=nodes.new('ShaderNodeTexImage');target.image=bake;nodes.active=target
scene.render.engine='CYCLES';scene.cycles.samples=1;scene.render.bake.margin=12
bpy.ops.object.bake(type='EMIT')
data=np.empty(SIZE*SIZE*4,dtype=np.float32);bake.pixels.foreach_get(data)
linear=np.clip(data.reshape(SIZE,SIZE,4)[:,:,:3],0,1)
marble=np.where(linear<=.0031308,linear*12.92,1.055*linear**(1/2.4)-.055)
# A height bake separates the painted cranial drawing from the old neck line.
position=nodes.new('ShaderNodeNewGeometry')
height_offset=nodes.new('ShaderNodeVectorMath');height_offset.operation='MULTIPLY_ADD';height_offset.inputs[1].default_value=(.5,.5,.5);height_offset.inputs[2].default_value=(.5,.5,.5)
links.new(position.outputs['Position'],height_offset.inputs[0]);links.new(height_offset.outputs[0],emit.inputs['Color'])
height_bake=bpy.data.images.new('Surface height bake',width=SIZE,height=SIZE,alpha=False,float_buffer=True)
target.image=height_bake;bpy.ops.object.bake(type='EMIT')
height_data=np.empty(SIZE*SIZE*4,dtype=np.float32);height_bake.pixels.foreach_get(height_data)
position_map=height_data.reshape(SIZE,SIZE,4)[:,:,:3]*2-1
height=position_map[:,:,2]

def smoothstep(a,b,x):
    v=np.clip((x-a)/(b-a),0,1);return v*v*(3-2*v)

# Recover the original purple neural drawing independently of painted stone.
r,g,b=[source_rgb[:,:,i] for i in range(3)]
region=smoothstep(.025,.10,b-g)*smoothstep(.005,.065,b-r)
region=np.maximum.reduce([np.roll(np.roll(region,dy,0),dx,1) for dy in (-2,0,2) for dx in (-2,0,2)])
# The source contains a wide purple painted halo around a pale fibre core.
# Keep the bright fine fibre, rather than converting that entire halo to neon.
lum=source_rgb@np.array([.2126,.7152,.0722],dtype=np.float32)
blur=sum(np.roll(lum,i,0) for i in range(-7,8))/15
blur=sum(np.roll(blur,i,1) for i in range(-7,8))/15
ridge=smoothstep(.012,.10,lum-blur)*region
side_position=np.abs(position_map[:,:,0])
scalp=smoothstep(.39,.45,height)*smoothstep(.20,.25,side_position)
temple=smoothstep(.44,.49,side_position)*smoothstep(.22,.30,height)
ear=smoothstep(.48,.505,side_position)
location=np.maximum.reduce([scalp,temple,ear])*(1-smoothstep(.12,.25,position_map[:,:,1]))
signal=np.maximum(region*smoothstep(.72,.89,g),ridge*.9)*smoothstep(.02,.08,height)*location
signal=np.clip(signal,0,1)
core=smoothstep(.70,.91,g)*signal
purple=np.array([.48,.18,.86],dtype=np.float32)
inlay=purple[None,None,:]*(1-core[:,:,None]*.38)+np.array([.75,.53,1.0],dtype=np.float32)[None,None,:]*core[:,:,None]*.38
base=marble*(1-signal[:,:,None]*.96)+inlay*signal[:,:,None]*.96
emission=signal[:,:,None]*(np.array([.38,.055,1.0],dtype=np.float32)[None,None,:]*(1-core[:,:,None]*.45)+np.array([.70,.32,1.0],dtype=np.float32)[None,None,:]*core[:,:,None]*.45)

def make_image(name,rgb,space='sRGB'):
    image=bpy.data.images.new(name,width=SIZE,height=SIZE,alpha=False)
    image.colorspace_settings.name=space
    rgba=np.ones((SIZE,SIZE,4),dtype=np.float32);rgba[:,:,:3]=np.clip(rgb,0,1)
    image.pixels.foreach_set(rgba.ravel());image.update()
    image.filepath_raw=str(OUT/(name+'.png'));image.file_format='PNG';image.save();image.pack()
    return image

albedo=make_image('ivory-marble-basecolor',base)
emissive=make_image('purple-nerve-emission',emission)
rough=.40+(marble.mean(axis=2)-.86)*.18
orm=make_image('marble-roughness',np.stack([np.ones_like(rough),rough,np.zeros_like(rough)],axis=2),'Non-Color')
nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');out.location=(620,0)
bs=nodes.new('ShaderNodeBsdfPrincipled');bs.location=(300,0)
bs.inputs['Roughness'].default_value=.41;bs.inputs['Metallic'].default_value=0
bs.inputs['IOR'].default_value=1.48;bs.inputs['Specular IOR Level'].default_value=.30
bs.inputs['Coat Weight'].default_value=.18;bs.inputs['Coat Roughness'].default_value=.32
links.new(bs.outputs['BSDF'],out.inputs['Surface'])
for label,im,socket,loc in [('Ivory marble · baked procedural veins',albedo,'Base Color',(-500,250)),('Purple surface neural drawing',emissive,'Emission Color',(-500,-150))]:
    n=nodes.new('ShaderNodeTexImage');n.image=im;n.label=label;n.location=loc;links.new(n.outputs['Color'],bs.inputs[socket])
bs.inputs['Emission Strength'].default_value=2.0
n=nodes.new('ShaderNodeTexImage');n.image=orm;n.location=(-500,-500)
sep=nodes.new('ShaderNodeSeparateColor');sep.location=(-180,-500);links.new(n.outputs['Color'],sep.inputs[0]);links.new(sep.outputs['Green'],bs.inputs['Roughness'])

# Fine surface branches wrap across the previously blank occipital region.
bm=bmesh.new();bm.from_mesh(head.data);bvh=BVHTree.FromBMesh(bm);bm.free()
nerve=bpy.data.materials.new('Purple neural fibres');nerve.use_nodes=True
nbs=nerve.node_tree.nodes.get('Principled BSDF')
nbs.inputs['Base Color'].default_value=(.30,.055,.72,1)
nbs.inputs['Roughness'].default_value=.32
nbs.inputs['Emission Color'].default_value=(.29,.045,1,1)
nbs.inputs['Emission Strength'].default_value=2.0
curves=[]

def spline(points,steps=10):
    a=[Vector(points[0])]+[Vector(p) for p in points]+[Vector(points[-1])]
    result=[]
    for i in range(1,len(a)-2):
        p0,p1,p2,p3=a[i-1:i+3]
        for j in range(steps):
            t=j/steps
            result.append((2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)*.5)
    return result+[Vector(points[-1])]

def branch(name,points,radius=.0023,side='back'):
    sampled=spline(points)
    coords=[]
    for p in sampled:
        if side=='nearest':
            hit,normal,_,_=bvh.find_nearest(p)
            if hit is not None:coords.append(hit+normal*.0012)
            continue
        if side=='back':origin=Vector((p.x,2,p.y));direction=Vector((0,-1,0))
        elif side=='front':origin=Vector((p.x,-2,p.y));direction=Vector((0,1,0))
        else:
            sign=1 if side=='right' else -1
            origin=Vector((sign*2,p.x,p.y));direction=Vector((-sign,0,0))
        hit,normal,_,_=bvh.ray_cast(origin,direction)
        if hit is not None:coords.append(hit+normal*.0012)
    if len(coords)<3:return
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=1;data.bevel_resolution=2;data.bevel_depth=radius*1.8
    line=data.splines.new('POLY');line.points.add(len(coords)-1)
    for i,(point,co) in enumerate(zip(line.points,coords)):
        point.co=(*co,1);point.radius=1-(i/(len(coords)-1))**2*.87
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);data.materials.append(nerve);curves.append(obj)

branch('Brainstem surface projection',[(0,-.22),(0,-.12),(.005,.01),(0,.12)],.0031)
# Follow the original supplied neck drawing in 3D, instead of estimating its
# course from a front projection (which could jump at the silhouette).
verts=np.empty(len(head.data.vertices)*3,dtype=np.float32);head.data.vertices.foreach_get('co',verts);verts=verts.reshape(-1,3)
indices=np.empty(len(head.data.loops),dtype=np.int32);head.data.loops.foreach_get('vertex_index',indices)
uv=np.empty(len(head.data.loops)*2,dtype=np.float32);head.data.uv_layers.active.data.foreach_get('uv',uv);uv=uv.reshape(-1,2)
samples=source_rgb[np.clip((uv[:,1]*SIZE).astype(int),0,SIZE-1),np.clip((uv[:,0]*SIZE).astype(int),0,SIZE-1)]
weight=np.maximum(0,samples[:,2]-samples[:,1])*np.maximum(0,samples[:,2]-samples[:,0]+.02)
loop_co=verts[indices]
for sign in [-1,1]:
    neck=[]
    for z in np.linspace(.055,-.85,24):
        select=(abs(loop_co[:,2]-z)<.026)&(loop_co[:,0]*sign>.08)&(weight>.006)
        if select.sum()<3:continue
        co=loop_co[select];w=weight[select]
        keep=w>=np.percentile(w,55)
        point=np.average(co[keep],axis=0,weights=w[keep]);point[2]=z
        neck.append(tuple(point))
    branch('Continuous cervical surface signal '+str(sign),neck,.0019,'nearest')
for sign in [-1,1]:
    def B(name,pts,r=.0022):branch(name+('_L' if sign<0 else '_R'),[(sign*x,z) for x,z in pts],r)
    B('Occipital main arbor',[(0,-.04),(.07,.15),(.20,.35),(.29,.57),(.25,.77),(.14,.88)],.0030)
    branches=[
      ([(.055,.12),(.17,.18),(.32,.23),(.44,.36)],.0021),
      ([(.12,.24),(.17,.41),(.11,.57),(.055,.72)],.0021),
      ([(.20,.35),(.32,.40),(.43,.49),(.48,.60)],.0021),
      ([(.27,.53),(.35,.63),(.39,.76)],.0020),
      ([(.28,.64),(.20,.72),(.18,.82)],.0018),
      ([(.25,.76),(.29,.82),(.30,.86)],.0017),
      ([(.18,.19),(.26,.13),(.35,.14)],.0014),
      ([(.31,.23),(.34,.31),(.40,.34)],.0014),
      ([(.17,.40),(.24,.46),(.22,.54)],.0014),
      ([(.12,.55),(.045,.58),(.025,.64)],.0014),
      ([(.10,.60),(.14,.68),(.10,.73)],.0013),
      ([(.34,.42),(.39,.36),(.45,.36)],.0014),
      ([(.42,.48),(.42,.57),(.46,.61)],.0014),
      ([(.34,.62),(.29,.69),(.31,.74)],.0014),
      ([(.37,.69),(.43,.70),(.44,.75)],.0013),
      ([(.20,.72),(.15,.76),(.12,.80)],.0013),
    ]
    for i,(pts,radius) in enumerate(branches):B('Occipital branch '+str(i+1),pts,radius)
    # These lateral posterior branches link the new back motif to the silhouette.
    side='right' if sign>0 else 'left'
    for i,pts in enumerate([
        [(.10,.34),(.22,.43),(.34,.56),(.30,.72)],
        [(.21,.43),(.30,.41),(.43,.47)],
        [(.30,.53),(.18,.60),(.14,.72)],
        [(.32,.59),(.41,.63),(.43,.72)],
        [(.19,.61),(.21,.69),(.18,.78)],
    ]):branch('Lateral posterior fibre '+side+' '+str(i),pts,.0018 if i==0 else .00125,side)

# Normalize Blender Z-up into the existing web stage (glTF Y-up, front +Z).
transform=Matrix.Translation(SHIFT)@Matrix.Scale(SCALE,4)
head.data.transform(transform)
for obj in curves:obj.data.transform(transform)
head['source']='User-supplied Meshy AI neural head bust, 25 October 2026'
head['finish']='Blender baked honed ivory marble; purple-only emissive surface fibres'
head['visualization']='Schematic artistic neural projection, not anatomical or measured activation'
head['web_revision']='neural-mannequin-v1'

# Keep editable curves in the authoring file; export a mesh copy of those curves.
for obj in scene.objects:obj.select_set(False)
head.select_set(True)
exports=[head]
for obj in curves:
    copy=obj.copy();copy.data=obj.data.copy();scene.collection.objects.link(copy)
    bpy.context.view_layer.objects.active=copy;copy.select_set(True)
    head.select_set(False)
    bpy.ops.object.convert(target='MESH')
    exports.append(bpy.context.object)
    bpy.context.object.select_set(False)
for obj in exports[1:]:obj.select_set(True)
bpy.context.view_layer.objects.active=exports[1]
bpy.ops.object.join()
joined=bpy.context.object;joined.name='Purple_Surface_Nerve_Fibres'
exports=[head,joined]
for obj in exports:obj.select_set(True)
bpy.context.view_layer.objects.active=head
bpy.ops.export_scene.gltf(filepath=str(DEST),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,
    export_image_format='JPEG',export_image_quality=92,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,
    export_draco_position_quantization=16,export_draco_normal_quantization=12,export_draco_texcoord_quantization=14)
for obj in exports:obj.data.calc_loop_triangles()
triangles=sum(len(o.data.loop_triangles) for o in exports)
for obj in exports[1:]:bpy.data.objects.remove(obj,do_unlink=True)

# A reusable studio and several inspection angles are saved with the model.
scene.world=bpy.data.worlds.new('Soft pearl studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.75,.76,.79,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
for name,loc,power,size in [('Key',(-4,-6,6),600,5),('Fill',(4,-3,3),300,4),('Rim',(2,4,5),500,3)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=size
    obj=bpy.data.objects.new(name,d);scene.collection.objects.link(obj);obj.location=loc;obj.rotation_euler=(-obj.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',d);scene.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO';d.ortho_scale=5.3
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=900;scene.render.resolution_y=1050;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
for name,loc in [('front',(0,-15,-.25)),('angle',(9,-15,-.25)),('side',(15,0,-.25)),('back',(0,15,-.25))]:
    cam.location=loc;cam.rotation_euler=(Vector((0,0,-.25))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/('refined-'+name+'.png'));bpy.ops.render.render(write_still=True)
cam.location=(9,-15,-.25);cam.rotation_euler=(Vector((0,0,-.25))-cam.location).to_track_quat('-Z','Y').to_euler()
for obj in scene.objects:obj.select_set(False)
head.select_set(True);bpy.context.view_layer.objects.active=head
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'cymba-neural-mannequin.blend'))
coords=[Vector((v.co.x,v.co.z,-v.co.y)) for v in head.data.vertices]
report={'source':str(SOURCE),'sourceSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'sourceTriangles':original_faces,'exportTriangles':triangles,
 'webModel':str(DEST),'sizeBytes':DEST.stat().st_size,'blend':str(OUT/'cymba-neural-mannequin.blend'),'textureResolution':[SIZE,SIZE],
 'addedNerveCurves':len(curves),'palette':'Violet, amethyst and lilac; no pink','surface':'Opaque honed ivory marble, irregular soft grey/taupe veins',
 'bounds':{'min':[min(v[i] for v in coords) for i in range(3)],'max':[max(v[i] for v in coords) for i in range(3)]},
 'earCanalsApprox':[[-1.1475,.05,.04],[1.1475,.05,.04]],'note':'Schematic artistic surface highlights, not anatomical or measured activation. Original supplied GLB remains unchanged.'}
(OUT/'refinement-report.json').write_text(json.dumps(report,indent=2))
print('REFINEMENT_COMPLETE='+json.dumps(report),flush=True)

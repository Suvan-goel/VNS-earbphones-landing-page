"""Author tapered surface filaments over clean marble; retain the supplied bust."""
import bpy, bmesh, math, json, random
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path('/Users/suvangoel/VNS-earbuds-site')
OUT = ROOT / 'output/neural-mannequin'
DEST = ROOT / 'public/models/cymba-neural-mannequin-premium.glb'
bpy.ops.wm.open_mainfile(filepath=str(OUT / 'cymba-neural-mannequin.blend'))
scene = bpy.context.scene
head = bpy.data.objects['Cymba_Marble_Mannequin']
for obj in scene.objects: obj.select_set(False)
head.select_set(True)
bpy.context.view_layer.objects.active = head

def smoothstep(a, b, x):
    t = max(0, min(1, (x-a)/(b-a)))
    return t*t*(3-2*t)

# Quiet the raised, irregular scanned cranial drawing without changing the face.
group = head.vertex_groups.new(name='Scalp surface refinement')
for v in head.data.vertices:
    weight = smoothstep(.25, .72, v.co.z)
    if weight > 0: group.add([v.index], weight, 'REPLACE')
smooth = head.modifiers.new('Soften legacy cranial ridges', 'SMOOTH')
smooth.vertex_group = group.name
smooth.factor = .70
smooth.iterations = 6
bpy.ops.object.modifier_apply(modifier=smooth.name)

# Re-bake the same honed ivory stone without a painted purple network.
mat = head.data.materials[0]
nodes, links = mat.node_tree.nodes, mat.node_tree.links
nodes.clear()
out = nodes.new('ShaderNodeOutputMaterial')
emit = nodes.new('ShaderNodeEmission')
links.new(emit.outputs[0], out.inputs['Surface'])
coord = nodes.new('ShaderNodeTexCoord')
mapping = nodes.new('ShaderNodeVectorMath'); mapping.operation = 'MULTIPLY'
mapping.inputs[1].default_value = (2.2, .9, 1.6)
links.new(coord.outputs['Generated'], mapping.inputs[0])
noise = nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value = 3.1; noise.inputs['Detail'].default_value = 4
noise.inputs['Roughness'].default_value = .65
links.new(mapping.outputs['Vector'], noise.inputs['Vector'])
wave = nodes.new('ShaderNodeTexWave'); wave.wave_type = 'BANDS'; wave.bands_direction = 'DIAGONAL'
wave.inputs['Scale'].default_value = 1.9; wave.inputs['Distortion'].default_value = 10
wave.inputs['Detail'].default_value = 5; wave.inputs['Detail Scale'].default_value = 1.1
links.new(mapping.outputs['Vector'], wave.inputs['Vector'])
veins = nodes.new('ShaderNodeValToRGB')
veins.color_ramp.elements[0].position = .015; veins.color_ramp.elements[0].color = (.49,.46,.41,1)
veins.color_ramp.elements[1].position = .065; veins.color_ramp.elements[1].color = (.77,.735,.67,1)
links.new(wave.outputs['Color'], veins.inputs[0])
clouds = nodes.new('ShaderNodeValToRGB')
clouds.color_ramp.elements[0].color = (.68,.65,.59,1)
clouds.color_ramp.elements[1].color = (.84,.81,.74,1)
links.new(noise.outputs['Fac'], clouds.inputs[0])
mix = nodes.new('ShaderNodeMixRGB'); mix.inputs[0].default_value = .22
links.new(clouds.outputs[0], mix.inputs[1]); links.new(veins.outputs[0], mix.inputs[2])
links.new(mix.outputs[0], emit.inputs['Color'])
size = 2048
bake = bpy.data.images.new('Clean ivory marble bake', width=size, height=size, alpha=False, float_buffer=True)
image_node = nodes.new('ShaderNodeTexImage'); image_node.image = bake; nodes.active = image_node
scene.render.engine = 'CYCLES'; scene.cycles.samples = 1; scene.render.bake.margin = 12
bpy.ops.object.bake(type='EMIT')
pixels = np.empty(size*size*4, dtype=np.float32); bake.pixels.foreach_get(pixels)
rgba = pixels.reshape(size,size,4)
linear = np.clip(rgba[:,:,:3],0,1)
rgba[:,:,:3] = np.where(linear<=.0031308, linear*12.92, 1.055*linear**(1/2.4)-.055)
rgba[:,:,3] = 1
albedo = bpy.data.images.new('Premium clean ivory marble', width=size,height=size,alpha=False)
albedo.pixels.foreach_set(rgba.ravel()); albedo.update()
albedo.filepath_raw = str(OUT / 'premium-clean-marble.png'); albedo.file_format='PNG'; albedo.save(); albedo.pack()
nodes.clear(); out = nodes.new('ShaderNodeOutputMaterial'); bs = nodes.new('ShaderNodeBsdfPrincipled')
links.new(bs.outputs['BSDF'], out.inputs['Surface'])
bs.inputs['Roughness'].default_value=.43; bs.inputs['Specular IOR Level'].default_value=.28
bs.inputs['Coat Weight'].default_value=.12; bs.inputs['Coat Roughness'].default_value=.35
tex = nodes.new('ShaderNodeTexImage'); tex.image=albedo; links.new(tex.outputs['Color'],bs.inputs['Base Color'])

nerve = bpy.data.materials['Purple neural fibres']
nbs = nerve.node_tree.nodes.get('Principled BSDF')
nbs.inputs['Base Color'].default_value=(.045,.008,.12,1)
nbs.inputs['Roughness'].default_value=.38
nbs.inputs['Emission Color'].default_value=(.13,.012,1,1)
nbs.inputs['Emission Strength'].default_value=2.0

# Keep the continuous cervical and posterior paths, but refine their weights.
curves=[]
for obj in list(scene.objects):
    if obj.type != 'CURVE': continue
    if obj.name.startswith('Lateral posterior'):
        bpy.data.objects.remove(obj,do_unlink=True)
        continue
    obj.data.bevel_depth *= .58
    obj.data.bevel_resolution = 2
    curves.append(obj)

# Recover the source's fine luminous cores over the complete cranial surface.
# The previous atlas clipped the forehead branches and left disconnected tips.
source=bpy.data.images['Image_0'].copy(); source.scale(size,size)
source_pixels=np.empty(size*size*4,dtype=np.float32); source.pixels.foreach_get(source_pixels)
rgb=source_pixels.reshape(size,size,4)[:,:,:3]
r,g,b=[rgb[:,:,i] for i in range(3)]
def ss(a,b,v):
    t=np.clip((v-a)/(b-a),0,1); return t*t*(3-2*t)
region=ss(.015,.08,b-g)*ss(-.015,.05,b-r)
region=np.maximum.reduce([np.roll(np.roll(region,dy,0),dx,1) for dy in (-4,-2,0,2,4) for dx in (-4,-2,0,2,4)])
lum=rgb@np.array([.2126,.7152,.0722],dtype=np.float32)
blur=sum(np.roll(lum,i,0) for i in range(-7,8))/15
blur=sum(np.roll(blur,i,1) for i in range(-7,8))/15
ridge=ss(.008,.065,lum-blur)*region
signal=np.maximum(region*ss(.72,.89,g),ridge*.92)
# Bake a local-space position mask: keep the face clean, include the temples.
material_backup=mat.copy()
nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');emit=nodes.new('ShaderNodeEmission')
links.new(emit.outputs[0],out.inputs['Surface'])
geo=nodes.new('ShaderNodeNewGeometry')
remap=nodes.new('ShaderNodeVectorMath'); remap.operation='MULTIPLY_ADD'
remap.inputs[1].default_value=(.2,.2,.2);remap.inputs[2].default_value=(.5,.5,.5)
links.new(geo.outputs['Position'],remap.inputs[0]);links.new(remap.outputs[0],emit.inputs['Color'])
pos=bpy.data.images.new('Premium position bake',width=size,height=size,alpha=False,float_buffer=True)
node=nodes.new('ShaderNodeTexImage');node.image=pos;nodes.active=node
bpy.ops.object.bake(type='EMIT')
data=np.empty(size*size*4,dtype=np.float32);pos.pixels.foreach_get(data)
position=(data.reshape(size,size,4)[:,:,:3]-.5)/.2
boundary=.83-.53*ss(.42,1.20,np.abs(position[:,:,0]))
cortex=ss(boundary,boundary+.10,position[:,:,2])
ear=ss(1.09,1.17,np.abs(position[:,:,0]))*ss(-.10,.01,position[:,:,2])*(1-ss(.18,.34,position[:,:,2]))
signal*=np.maximum(cortex,ear)*(1-ss(.22,.55,position[:,:,1]))
signal=ss(.025,.75,signal)
# Remove isolated scan/compression marks, retaining connected fine branches.
from collections import deque
mask=signal>.10
seen=np.zeros_like(mask,dtype=bool)
for sy,sx in zip(*np.nonzero(mask)):
    if seen[sy,sx]:continue
    queue=deque([(int(sy),int(sx))]);seen[sy,sx]=True;component=[]
    while queue:
        y,x=queue.popleft();component.append((y,x))
        for dy,dx in ((-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)):
            ny,nx=y+dy,x+dx
            if 0<=ny<size and 0<=nx<size and mask[ny,nx] and not seen[ny,nx]:
                seen[ny,nx]=True;queue.append((ny,nx))
    if len(component)<48:
        for y,x in component:signal[y,x]=0
signal[signal<=.10]=0
rgba=np.ones((size,size,4),dtype=np.float32)
rgba[:,:,:3]=signal[:,:,None]*np.array([.38,.12,1.0],dtype=np.float32)[None,None,:]
emission=bpy.data.images.new('Premium continuous nerve cores',width=size,height=size,alpha=False)
emission.pixels.foreach_set(rgba.ravel());emission.update()
emission.filepath_raw=str(OUT/'premium-nerve-cores.png');emission.file_format='PNG';emission.save();emission.pack()
head.data.materials[0]=material_backup
bs=material_backup.node_tree.nodes.get('Principled BSDF')
node=material_backup.node_tree.nodes.new('ShaderNodeTexImage');node.image=emission
material_backup.node_tree.links.new(node.outputs['Color'],bs.inputs['Emission Color'])
bs.inputs['Emission Strength'].default_value=2.0

head['web_revision']='premium-filaments-v2'
head['finish']='Clean honed ivory marble with continuous cranial fibre emission and finer posterior filaments'
head['visualization']='Schematic artistic projection, not anatomical or measured activity'

# Export joined filaments while keeping every curve editable in the authoring file.
for obj in scene.objects:obj.select_set(False)
mesh_fibres=[]
for obj in curves:
    copy=obj.copy();copy.data=obj.data.copy();scene.collection.objects.link(copy)
    bpy.context.view_layer.objects.active=copy;copy.select_set(True)
    bpy.ops.object.convert(target='MESH');mesh_fibres.append(bpy.context.object)
    bpy.context.object.select_set(False)
for obj in mesh_fibres:obj.select_set(True)
bpy.context.view_layer.objects.active=mesh_fibres[0];bpy.ops.object.join()
joined=bpy.context.object;joined.name='Purple_Surface_Nerve_Fibres'
head.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(DEST),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,
  export_image_format='JPEG',export_image_quality=92,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,
  export_draco_position_quantization=16,export_draco_normal_quantization=12,export_draco_texcoord_quantization=14)
triangles=sum(len(o.data.polygons) for o in [head,joined])
bpy.data.objects.remove(joined,do_unlink=True)
scene.render.engine='BLENDER_EEVEE'
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'cymba-neural-mannequin-premium.blend'))
report={'webModel':str(DEST),'bytes':DEST.stat().st_size,'editableCurves':len(curves),'polygons':triangles,'originalPreserved':True}
(OUT/'premium-fibres-report.json').write_text(json.dumps(report,indent=2))
print('PREMIUM_FIBRES_COMPLETE='+json.dumps(report),flush=True)

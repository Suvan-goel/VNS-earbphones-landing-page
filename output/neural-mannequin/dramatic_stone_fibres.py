"""Add surface-following neural arborisation and bake a honed mineral finish.

Starts from the preserved premium source on every run; never accumulates edits.
"""
import bpy, bmesh, math, json, random, sys
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path('/Users/suvangoel/VNS-earbuds-site')
OUT = ROOT / 'output/neural-mannequin'
BRIGHT_MARBLE = '--bright-marble' in sys.argv
FINISH = 'marble' if BRIGHT_MARBLE else 'stone'
DEST = ROOT / ('public/models/cymba-neural-mannequin-%s.glb' % FINISH)
bpy.ops.wm.open_mainfile(filepath=str(OUT / 'cymba-neural-mannequin-premium.blend'))
scene = bpy.context.scene
head = bpy.data.objects['Cymba_Marble_Mannequin']
random.seed(44)
bm = bmesh.new(); bm.from_mesh(head.data)
bvh = BVHTree.FromBMesh(bm); bm.free()
nerve = bpy.data.materials['Purple neural fibres']
original_curves = [o for o in scene.objects if o.type == 'CURVE']

def project(point, offset=.009):
    hit, normal, _, _ = bvh.find_nearest(point)
    return hit + normal * offset, normal

def add_curve(name, points, radius):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'; data.resolution_u = 1
    data.bevel_depth = 1; data.bevel_resolution = 2
    spline = data.splines.new('POLY'); spline.points.add(len(points)-1)
    for i, (p, co) in enumerate(zip(spline.points, points)):
        p.co = (*co, 1)
        p.radius = radius * (1 - .88 * (i/(len(points)-1))**1.35)
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj); data.materials.append(nerve)
    return obj

def grow(start, initial, length, bend, phase):
    points = [start.copy()]
    direction = initial.normalized()
    steps = max(16, int(length/.009))
    for i in range(1, steps+1):
        _, normal = project(points[-1])
        tangent = direction - normal * direction.dot(normal)
        tangent.normalize()
        cross = normal.cross(tangent).normalized()
        steering = cross * (bend/steps + .018*math.sin(phase+i*.39))
        direction = (tangent + steering).normalized()
        point, _ = project(points[-1] + direction * (length/steps))
        # Keep all added arborisation on the cranial surface, away from the eyes.
        if point.z < .48 or (point.y < -.65 and point.z < 1.03): break
        points.append(point)
    return points

# A stronger primary fibre, with finer tapered branches retaining hierarchy.
for obj in original_curves:
    obj.data.bevel_depth *= 1.32 if obj.name.startswith('Traced') else 1.18

candidates = []
for obj in original_curves:
    if not obj.name.startswith('Traced cranial'): continue
    pts = [Vector(p.co[:3]) for p in obj.data.splines[0].points]
    length = sum((b-a).length for a,b in zip(pts,pts[1:]))
    if len(pts) >= 3 and length > .055 and min(p.z for p in pts) > .48:
        candidates.append((length, obj, pts))
candidates.sort(key=lambda entry: -entry[0])
roots = []; added = 0
for length, obj, pts in candidates:
    index = max(1, min(len(pts)-2, int(len(pts)*random.uniform(.35,.70))))
    root = pts[index]
    if any((root-p).length < .055 for p in roots): continue
    roots.append(root)
    tangent = (pts[index+1]-pts[index-1]).normalized()
    if tangent.z < 0: tangent = -tangent
    _, normal = project(root)
    transverse = normal.cross(tangent).normalized()
    sign = random.choice([-1,1])
    direction = (tangent*.68 + transverse*sign*.74).normalized()
    coords = grow(root, direction, random.uniform(.19,.34), sign*.65, random.uniform(0,6))
    if len(coords) < 8: continue
    add_curve('Additional cranial arbor %03d' % added, coords, random.uniform(.0043,.0058)); added += 1
    # One lateral dendrite makes the new fibres read as nerves, with a fine tip.
    branch_index = int(len(coords)*.52)
    twig_direction = (coords[branch_index+1]-coords[branch_index-1]).normalized()
    _, normal = project(coords[branch_index])
    twig_direction = (twig_direction*.60 - normal.cross(twig_direction)*sign*.80).normalized()
    twig = grow(coords[branch_index], twig_direction, random.uniform(.09,.17), -sign*.6, 2)
    if len(twig)>6:
        add_curve('Additional dendrite %03d' % added, twig, .0036); added += 1
    if len(roots) >= 112: break

# Broaden the posterior network while preserving its continuous cervical trunks.
for obj in original_curves:
    if not obj.name.startswith('Occipital main'): continue
    pts = [Vector(p.co[:3]) for p in obj.data.splines[0].points]
    if len(pts)<6: continue
    for fraction in [.35,.65]:
        i = min(len(pts)-2,max(1,int(len(pts)*fraction)))
        root = pts[i]; _,normal = project(root)
        tangent = (pts[i+1]-pts[i-1]).normalized()
        direction = (tangent*.75+normal.cross(tangent)*random.choice([-1,1])*.65).normalized()
        coords = grow(root,direction,.24,.3,3)
        if len(coords)>6: add_curve('Posterior fine arbor %03d'%added,coords,.0044); added+=1

print('Added %s branching curves' % added, flush=True)

# Three portable maps: mineral colour, tangent-space grain, and matte roughness.
for obj in scene.objects: obj.select_set(False)
head.select_set(True); bpy.context.view_layer.objects.active = head
mat = head.data.materials[0]
mat.name = 'Clean ivory marble - subtle mineral grain' if BRIGHT_MARBLE else 'Honed ivory limestone - mineral grain'
nodes, links = mat.node_tree.nodes, mat.node_tree.links
nodes.clear()
out = nodes.new('ShaderNodeOutputMaterial')
emit = nodes.new('ShaderNodeEmission'); links.new(emit.outputs[0],out.inputs['Surface'])
texcoord = nodes.new('ShaderNodeTexCoord')
mapping = nodes.new('ShaderNodeVectorMath'); mapping.operation='MULTIPLY'
mapping.inputs[1].default_value = (1.4,.85,1.9)
links.new(texcoord.outputs['Generated'],mapping.inputs[0])

def noise(scale,detail):
    node=nodes.new('ShaderNodeTexNoise')
    node.inputs['Scale'].default_value=scale; node.inputs['Detail'].default_value=detail
    node.inputs['Roughness'].default_value=.72
    links.new(mapping.outputs['Vector'],node.inputs['Vector'])
    return node.outputs['Fac']

def ramp(socket,low,high,positions=(0,1)):
    node=nodes.new('ShaderNodeValToRGB')
    node.color_ramp.elements[0].position=positions[0];node.color_ramp.elements[0].color=(*low,1)
    node.color_ramp.elements[1].position=positions[1];node.color_ramp.elements[1].color=(*high,1)
    links.new(socket,node.inputs[0]);return node.outputs[0]

def mix(a,b,factor,mode='MIX'):
    node=nodes.new('ShaderNodeMixRGB');node.blend_type=mode;node.inputs[0].default_value=factor
    links.new(a,node.inputs[1]);links.new(b,node.inputs[2]);return node.outputs[0]

cloud=noise(5.8,5)
grain=noise(112,3)
pores=noise(245,2)
mineral=ramp(cloud,(.65,.64,.61) if BRIGHT_MARBLE else (.32,.305,.278),
             (.86,.85,.81) if BRIGHT_MARBLE else (.66,.64,.585),(.20,.79))
granules=ramp(grain,(.74,.73,.70) if BRIGHT_MARBLE else (.43,.415,.38),
              (.95,.94,.90) if BRIGHT_MARBLE else (.82,.80,.75),(.23,.77))
body=mix(mineral,granules,.13 if BRIGHT_MARBLE else .33,'MULTIPLY')
wave=nodes.new('ShaderNodeTexWave');wave.wave_type='BANDS';wave.bands_direction='DIAGONAL'
wave.inputs['Scale'].default_value=4.4;wave.inputs['Distortion'].default_value=11
wave.inputs['Detail'].default_value=5;wave.inputs['Detail Scale'].default_value=1.4
links.new(mapping.outputs[0],wave.inputs['Vector'])
veins=ramp(wave.outputs['Fac'],(.50,.51,.50) if BRIGHT_MARBLE else (.38,.37,.34),(1,1,1),(.005,.055))
albedo=mix(body,veins,.24 if BRIGHT_MARBLE else .22,'MULTIPLY')
roughness=ramp(grain,(.40,.40,.40) if BRIGHT_MARBLE else (.62,.62,.62),
               (.62,.62,.62) if BRIGHT_MARBLE else (.89,.89,.89),(.15,.85))
height=mix(grain,pores,.40)

scene.render.engine='CYCLES';scene.cycles.samples=4
scene.render.bake.margin=16;scene.render.bake.use_clear=True

def bake(name,socket,kind='EMIT',color=True):
    if BRIGHT_MARBLE: name=name.replace('honed-stone','clean-marble')
    if kind=='EMIT':
        links.new(emit.outputs[0],out.inputs['Surface']);links.new(socket,emit.inputs['Color'])
    image=bpy.data.images.new(name+' bake',width=2048,height=2048,alpha=False,float_buffer=True)
    image.colorspace_settings.name='Non-Color' if not color else 'Linear Rec.709'
    image_node=nodes.new('ShaderNodeTexImage');image_node.image=image;nodes.active=image_node
    bpy.ops.object.bake(type=kind)
    pixels=np.empty(2048*2048*4,dtype=np.float32);image.pixels.foreach_get(pixels)
    pixels=pixels.reshape(2048,2048,4);pixels[:,:,3]=1
    if color:
        rgb=np.clip(pixels[:,:,:3],0,1)
        pixels[:,:,:3]=np.where(rgb<=.0031308,rgb*12.92,1.055*rgb**(1/2.4)-.055)
    result=bpy.data.images.new(name,width=2048,height=2048,alpha=False)
    result.colorspace_settings.name='sRGB' if color else 'Non-Color'
    result.pixels.foreach_set(pixels.ravel());result.update()
    result.filepath_raw=str(OUT/(name+'.png'));result.file_format='PNG';result.save();result.pack()
    nodes.remove(image_node);bpy.data.images.remove(image)
    print('Baked '+name,flush=True)
    return result

color_map=bake('honed-stone-mineral-colour',albedo)
rough_map=bake('honed-stone-roughness',roughness,color=False)
bs=nodes.new('ShaderNodeBsdfPrincipled');links.new(bs.outputs[0],out.inputs['Surface'])
bump=nodes.new('ShaderNodeBump')
bump.inputs['Strength'].default_value=.25 if BRIGHT_MARBLE else .48
bump.inputs['Distance'].default_value=.018 if BRIGHT_MARBLE else .025
links.new(height,bump.inputs['Height']);links.new(bump.outputs['Normal'],bs.inputs['Normal'])
normal_map=bake('honed-stone-surface-normal',None,kind='NORMAL',color=False)

nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');bs=nodes.new('ShaderNodeBsdfPrincipled')
links.new(bs.outputs[0],out.inputs['Surface'])
bs.inputs['Specular IOR Level'].default_value=.30 if BRIGHT_MARBLE else .22
bs.inputs['Coat Weight'].default_value=0
for image,socket in [(color_map,'Base Color'),(rough_map,'Roughness')]:
    node=nodes.new('ShaderNodeTexImage');node.image=image;links.new(node.outputs['Color'],bs.inputs[socket])
node=nodes.new('ShaderNodeTexImage');node.image=normal_map
normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.65 if BRIGHT_MARBLE else .85
links.new(node.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bs.inputs['Normal'])

head['web_revision']='clean-marble-fibres-v1' if BRIGHT_MARBLE else 'dramatic-stone-fibres-v1'
head['finish']='Bright honed ivory marble; subtle veins, fine grain and satin roughness' if BRIGHT_MARBLE else 'Honed ivory stone; baked mineral colour, fine grain normal and variable matte roughness'
head['visualization']='Schematic artistic projection, not anatomical or measured activity'
curves=[o for o in scene.objects if o.type=='CURVE']
for obj in scene.objects:obj.select_set(False)
copies=[]
for obj in curves:
    copy=obj.copy();copy.data=obj.data.copy();scene.collection.objects.link(copy)
    bpy.context.view_layer.objects.active=copy;copy.select_set(True);bpy.ops.object.convert(target='MESH')
    copies.append(bpy.context.object);bpy.context.object.select_set(False)
for obj in copies:obj.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join()
joined=bpy.context.object;joined.name='Purple_Surface_Nerve_Fibres';head.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(DEST),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,
    export_image_format='AUTO',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,
    export_draco_position_quantization=16,export_draco_normal_quantization=12,export_draco_texcoord_quantization=14)
triangles=0
for obj in [head,joined]:obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
bpy.data.objects.remove(joined,do_unlink=True)
scene.render.engine='BLENDER_EEVEE'
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/('cymba-neural-mannequin-%s.blend' % FINISH)))
report={'webModel':str(DEST),'bytes':DEST.stat().st_size,'curvesBefore':len(original_curves),'addedBranches':added,
    'editableCurves':len(curves),'triangles':triangles,'stoneMaps':['mineral colour','tangent normal','roughness'],'sourcePreserved':True}
(OUT/('bright-marble-report.json' if BRIGHT_MARBLE else 'dramatic-stone-report.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)

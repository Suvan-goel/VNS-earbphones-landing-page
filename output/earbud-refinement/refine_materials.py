"""Refine the original earbud's PBR surfaces in Blender; preserve its geometry."""
import bpy, json, math, hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix, Euler
ROOT=Path('/Users/suvangoel/VNS-earbuds-site')
OUT=ROOT/'output/earbud-refinement';OUT.mkdir(exist_ok=True)
SOURCE=ROOT/'public/models/cymba-earbuds-hero.glb'
DEST=ROOT/'public/models/cymba-earbuds-refined.glb'
source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
scene=bpy.context.scene
buds=[o for o in scene.objects if o.type=='MESH']
material=buds[0].data.materials[0]
images={n.image.name:n.image for n in material.node_tree.nodes if n.type=='TEX_IMAGE'}
base=images['Image_0'];width,height=base.size
pixels=np.array(base.pixels[:],dtype=np.float32).reshape(height,width,4)
rgb=pixels[:,:,:3]
print('SOURCE_PIXEL_RANGE='+json.dumps(np.percentile(rgb,[5,25,50,75,95],axis=(0,1)).tolist()),flush=True)
def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1)
    return t*t*(3-2*t)
def rgb_color(hex):
    s=np.array([int(hex[i:i+2],16)/255 for i in (0,2,4)],dtype=np.float32)
    # Blender's byte-backed image pixels store sRGB channel values.
    return s
# The original UV atlas explicitly separates blue-grey silicone, warm metal,
# and black elastomer. Flatten the painted lighting within each surface family.
red,green,blue=[rgb[:,:,i] for i in range(3)]
lum=rgb@np.array([.2126,.7152,.0722],dtype=np.float32)
warm=smooth(.035,.14,(red-blue)/np.maximum(red,.015))*smooth(.018,.065,red)
tip=smooth(.012,.045,blue-red)*smooth(.08,.20,lum)
# Close tiny holes from scan/JPEG colour noise so silicone stays one surface.
for _ in range(2):
    tip=np.maximum.reduce([np.roll(np.roll(tip,dy,0),dx,1) for dy in (-1,0,1) for dx in (-1,0,1)])
for _ in range(2):
    tip=np.minimum.reduce([np.roll(np.roll(tip,dy,0),dx,1) for dy in (-1,0,1) for dx in (-1,0,1)])
sensor=smooth(.006,.03,green-red)*smooth(.008,.06,lum)*(1-tip)
# Keep dark anodized housing distinct from the lighter metal rings, while
# compressing the old painted light/shadow range into a subtle colour change.
metal_light=smooth(.43,.74,lum)
metal_color=rgb_color('3C3B37')[None,None,:]*(1-metal_light[:,:,None])+rgb_color('A39078')[None,None,:]*metal_light[:,:,None]
black_variation=np.clip(lum/.06,0,1)*.13+.94
rubber=rgb_color('202225')[None,None,:]*black_variation[:,:,None]
# A consistent, slightly warm smoke-grey silicone; no chalky white sheen.
silicone=rgb_color('626966')[None,None,:]*(.98+.025*smooth(.12,.5,lum))[:,:,None]
color=rubber*(1-warm[:,:,None])+metal_color*warm[:,:,None]
color=color*(1-tip[:,:,None])+silicone*tip[:,:,None]
color=color*(1-sensor[:,:,None])+rgb_color('172626')[None,None,:]*sensor[:,:,None]
# Micro-scale finish stays subtle. No large-scale noise or baked reflections.
rng=np.random.default_rng(41)
grain=rng.normal(0,1,(height,width)).astype(np.float32)
rough=.53*(1-warm)+(.48-.06*metal_light)*warm
rough=rough*(1-tip)+.64*tip
rough=rough*(1-sensor)+.24*sensor
rough=np.clip(rough+grain*.006,0,1)
metallic=.86*warm*(1-tip)*(1-sensor)
# Gentle tangent-space grain replaces the scan's ridged, inconsistent normals.
normal=np.empty_like(rgb);normal[:,:,0]=.5+grain*.002
normal[:,:,1]=.5+rng.normal(0,.002,(height,width));normal[:,:,2]=1
# ORM/normal channels are non-colour; the albedo image uses sRGB encoding.
def image(name,data,color_space):
    im=bpy.data.images.new(name,width=width,height=height,alpha=False)
    im.colorspace_settings.name=color_space
    rgba=np.ones((height,width,4),dtype=np.float32);rgba[:,:,:3]=data
    im.pixels.foreach_set(rgba.ravel());im.update()
    im.filepath_raw=str(OUT/(name+'.png'));im.file_format='PNG';im.save();im.pack()
    return im
albedo=image('Cymba_refined_basecolor',color,'sRGB')
orm=np.stack([np.ones_like(rough),rough,metallic],axis=2)
packed=image('Cymba_refined_roughness_metallic',orm,'Non-Color')
normalmap=image('Cymba_refined_microfinish',normal,'Non-Color')
material.name='Cymba · smoke silicone / satin champagne / charcoal'
nodes=material.node_tree.nodes;links=material.node_tree.links;nodes.clear()
out=nodes.new('ShaderNodeOutputMaterial');out.location=(640,80)
bsdf=nodes.new('ShaderNodeBsdfPrincipled');bsdf.location=(320,80)
bsdf.inputs['IOR'].default_value=1.46
bsdf.inputs['Specular IOR Level'].default_value=.35
links.new(bsdf.outputs['BSDF'],out.inputs['Surface'])
color_node=nodes.new('ShaderNodeTexImage');color_node.image=albedo;color_node.label='Refined surface colours';color_node.location=(-460,300)
links.new(color_node.outputs['Color'],bsdf.inputs['Base Color'])
orm_node=nodes.new('ShaderNodeTexImage');orm_node.image=packed;orm_node.label='Satin metal / soft-touch silicone';orm_node.location=(-460,-20)
sep=nodes.new('ShaderNodeSeparateColor');sep.mode='RGB';sep.location=(-180,-20)
links.new(orm_node.outputs['Color'],sep.inputs['Color']);links.new(sep.outputs['Green'],bsdf.inputs['Roughness']);links.new(sep.outputs['Blue'],bsdf.inputs['Metallic'])
norm_node=nodes.new('ShaderNodeTexImage');norm_node.image=normalmap;norm_node.label='Very fine moulded surface';norm_node.location=(-460,-330)
norm=nodes.new('ShaderNodeNormalMap');norm.location=(-180,-260);links.new(norm_node.outputs['Color'],norm.inputs['Color']);links.new(norm.outputs['Normal'],bsdf.inputs['Normal'])
for ob in buds:
    for face in ob.data.polygons:face.use_smooth=True
    ob['finish_revision']='satin-champagne-smoke-silicone-v1'
    ob.select_set(True)
bpy.context.view_layer.objects.active=buds[0]
# Web copy retains both meshes, source transforms, UVs, and accepted silhouette.
bpy.ops.export_scene.gltf(filepath=str(DEST),export_format='GLB',use_selection=True,export_apply=False,export_yup=True,
    export_image_format='JPEG',export_image_quality=88,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,
    export_draco_position_quantization=16,export_draco_normal_quantization=12,export_draco_texcoord_quantization=14)
# Save an editable Blender file with the materials and studio hero arrangement.
entries=json.loads((ROOT/'output/web-model/hero-asset-report.json').read_text())['entries']
for ob in buds:
    side='L' if ' · L · ' in ob.name else 'R';entry=next(e for e in entries if ' · '+side+' · ' in e['name'])
    center=Vector(entry['frontCenterMetres']);height_m=entry['frontSizeMetres'][1]
    ob.data.transform(Matrix.Scale(1/height_m,4)@Matrix.Translation(-center)@ob.matrix_world)
    sign=-1 if side=='L' else 1
    pos=Vector((sign*.68,.26 if side=='L' else 1.0,0 if side=='L' else -.05))
    rot=Euler((-.06,sign*.10,sign*.09),'XYZ').to_matrix().to_4x4()
    ob.matrix_world=Matrix.Translation(pos)@rot@Matrix.Scale(.9,4)
scene.world=bpy.data.worlds.new('Soft studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.3,.3,.3,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
for name,loc,energy,size in [('Key',(-3,4,6),650,5),('Fill',(4,1,4),400,4),('Rim',(1,3,-2),500,3)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',d);scene.collection.objects.link(cam);scene.camera=cam
cam.location=(0,.4,6);cam.rotation_euler=(0,0,0);d.type='ORTHO';d.ortho_scale=3.2
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.film_transparent=True;scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.render.filepath=str(OUT/'refined-pair-review.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'cymba-earbuds-refined.blend'))
bpy.ops.render.render(write_still=True)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash
report={'source':str(SOURCE),'sourceSHA256':source_hash,'sourceUnchanged':True,'webModel':str(DEST),'sizeBytes':DEST.stat().st_size,
 'blend':str(OUT/'cymba-earbuds-refined.blend'),'finish':'Smoke-grey silicone, satin champagne accents, graphite bronze housing, charcoal soft-touch rubber',
 'triangles':sum(len(o.data.polygons) for o in buds),'textureResolution':[width,height]}
(OUT/'refinement-report.json').write_text(json.dumps(report,indent=2));print('REFINED_COMPLETE='+json.dumps(report),flush=True)

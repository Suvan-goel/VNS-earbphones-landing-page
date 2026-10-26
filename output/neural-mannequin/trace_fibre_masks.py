"""Render the cranial core masks in surface space for clean curve tracing."""
import bpy, json
from pathlib import Path
from mathutils import Vector
OUT=Path('/Users/suvangoel/VNS-earbuds-site/output/neural-mannequin')
bpy.ops.wm.open_mainfile(filepath=str(OUT/'cymba-neural-mannequin-premium.blend'))
scene=bpy.context.scene;head=bpy.data.objects['Cymba_Marble_Mannequin']
for obj in scene.objects:
    if obj.type in ('MESH','CURVE'):obj.hide_render=obj!=head
mat=bpy.data.materials.new('Trace only neural cores');mat.use_nodes=True
n=mat.node_tree.nodes;l=mat.node_tree.links;n.clear()
out=n.new('ShaderNodeOutputMaterial');em=n.new('ShaderNodeEmission');tex=n.new('ShaderNodeTexImage')
tex.image=bpy.data.images['Premium continuous nerve cores']
sep=n.new('ShaderNodeSeparateColor');l.new(tex.outputs['Color'],sep.inputs[0]);l.new(sep.outputs['Blue'],em.inputs['Color']);l.new(em.outputs[0],out.inputs['Surface'])
head.data.materials.clear();head.data.materials.append(mat)
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(0,0,0,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=0
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1200;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
cam=scene.camera;cam.data.type='ORTHO';cam.data.ortho_scale=3.0
centre=Vector((0,0,.65));report={}
for sign in [-1,1]:
    cam.location=(sign*10,0,.65);cam.rotation_euler=(centre-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/f'core-mask-{sign}.png');bpy.ops.render.render(write_still=True)
    q=cam.rotation_euler.to_quaternion()
    report[str(sign)]={'centre':list(centre),'right':list(q@Vector((1,0,0))),'up':list(q@Vector((0,1,0))),'direction':list(q@Vector((0,0,-1))),'scale':3.0,'size':1200}
(OUT/'trace-projection.json').write_text(json.dumps(report,indent=2))

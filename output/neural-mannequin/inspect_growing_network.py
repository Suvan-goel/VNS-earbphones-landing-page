"""Render the authoring asset from angles hidden by the site's 45 degree turn."""
import bpy, json
from pathlib import Path
from mathutils import Vector
OUT=Path('/Users/suvangoel/VNS-earbuds-site/output/neural-mannequin')
bpy.ops.wm.open_mainfile(filepath=str(OUT/'cymba-neural-mannequin-growing.blend'))
scene=bpy.context.scene
for obj in scene.objects:
    obj.hide_render=obj.type not in ['MESH']
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.65,.65,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
for pos,power,size in [((3,-4,6),900,5),((-4,1,4),700,4),((2,5,4),800,4)]:
    data=bpy.data.lights.new('Inspection softbox','AREA');data.energy=power;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new('Inspection softbox',data);scene.collection.objects.link(obj);obj.location=pos
    obj.rotation_euler=(Vector((0,0,.5))-obj.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Inspection camera');camera=bpy.data.objects.new('Inspection camera',data)
scene.collection.objects.link(camera);scene.camera=camera;data.type='ORTHO';data.ortho_scale=4.9
for label,pos,target in [('back',(0,7,1),(0,0,-.2)),('crown',(0,-.6,8),(0,0,.5))]:
    camera.location=pos;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/('network-coverage-'+label+'.png'));bpy.ops.render.render(write_still=True)
print('Back and crown inspection images saved',flush=True)

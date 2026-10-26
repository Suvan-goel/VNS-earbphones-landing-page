import bpy, math, json
from mathutils import Vector
from pathlib import Path
base=Path('/Users/suvangoel/VNS-earbuds-site/output/mannequin-source')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(base/'LeePerrySmith.glb'))
meshes=[o for o in bpy.data.objects if o.type=='MESH']
for o in list(bpy.data.objects):
 if o.type!='MESH': bpy.data.objects.remove(o,do_unlink=True)
for o in meshes:
 print('MESH',o.name,'bound', [list(o.matrix_world@Vector(c)) for c in o.bound_box])
 mat=bpy.data.materials.new('Ivory ceramic');mat.diffuse_color=(.58,.53,.45,1);mat.use_nodes=True
 bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.58,.53,.45,1);bs.inputs['Roughness'].default_value=.46
 o.data.materials.clear();o.data.materials.append(mat)
 for p in o.data.polygons:p.use_smooth=True
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('World');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.5,.5,.5,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
for name,loc,power,size in [('Key',(-7,-10,10),1500,7),('Fill',(6,-6,5),700,6),('Rim',(2,5,8),1700,5)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
c=bpy.data.cameras.new('Camera');co=bpy.data.objects.new('Camera',c);scene.collection.objects.link(co);scene.camera=co;c.type='ORTHO';c.ortho_scale=10
for name,loc in [('front',(0,-20,0)),('side',(20,0,0)),('threequarter',(13,-20,0))]:
 co.location=loc;co.rotation_euler=(Vector((0,0,0))-co.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(base/f'source-{name}.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(base/'source-inspection.blend'))

import bpy, json, math
from pathlib import Path
from mathutils import Vector

ROOT=Path('/Users/suvangoel/VNS-earbuds-site')
OUT=ROOT/'output/neural-mannequin'
SOURCE=Path('/Users/suvangoel/Downloads/Meshy_AI_neural_head_bust_fron_1025174930_image-to-3d-texture.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
head=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bpy.context.view_layer.objects.active=head
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
report={'name':head.name,'bounds':[list(min(v.co[i] for v in head.data.vertices) for i in range(3)),list(max(v.co[i] for v in head.data.vertices) for i in range(3))],'vertices':len(head.data.vertices),'faces':len(head.data.polygons),'images':[]}
for im in bpy.data.images:
    if im.type=='IMAGE':
        report['images'].append({'name':im.name,'size':list(im.size)})
        im.filepath_raw=str(OUT/(im.name+'.png'));im.file_format='PNG';im.save()
(OUT/'source-report.json').write_text(json.dumps(report,indent=2))
print('SOURCE_REPORT='+json.dumps(report),flush=True)
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=600;scene.render.resolution_y=700;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Soft studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.55,.55,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
for name,loc,power,size in [('Key',(-3,-4,5),250,4),('Fill',(3,-2,3),160,3),('Rim',(1,3,4),220,3)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=size
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',d);scene.collection.objects.link(cam);scene.camera=cam;d.type='ORTHO';d.ortho_scale=2.5
for name,loc in [('front',(0,-8,0)),('side',(8,0,0)),('back',(0,8,0)),('angle',(5,-8,0))]:
    cam.location=loc;cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/('source-'+name+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source-inspection.blend'))

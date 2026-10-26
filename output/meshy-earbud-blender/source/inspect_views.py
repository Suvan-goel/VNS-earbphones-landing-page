import bpy, math
from mathutils import Vector
from pathlib import Path

OUT=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(OUT/'earbud-source.blend'))
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.resolution_x=600
scene.render.resolution_y=680
scene.render.resolution_percentage=100
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.65,.65,.65,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
scene.render.image_settings.file_format='PNG'
obj=next(o for o in scene.objects if o.type=='MESH')
pts=[obj.matrix_world@Vector(v) for v in obj.bound_box]
center=sum(pts,Vector())/8
print('BOUNDS', [list(p) for p in pts],flush=True)
for n,loc,energy,size in [('Key',(1,-3,4),350,4),('Fill',(-3,-1,1),180,3),('Rim',(2,3,2),250,3)]:
    data=bpy.data.lights.new(n,'AREA');data.energy=energy;data.shape='DISK';data.size=size
    light=bpy.data.objects.new(n,data);scene.collection.objects.link(light);light.location=loc
    light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Camera');camera=bpy.data.objects.new('Camera',data);scene.collection.objects.link(camera)
scene.camera=camera;data.type='ORTHO';data.ortho_scale=2.6
for name,loc in [('front',(0,-5,.1)),('back',(0,5,.1)),('side',(5,0,.1))]:
    camera.location=center+Vector(loc);camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/'previews'/('source-'+name+'.png'))
    bpy.ops.render.render(write_still=True)

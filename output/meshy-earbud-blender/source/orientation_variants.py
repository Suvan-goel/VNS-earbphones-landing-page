import bpy,math
from pathlib import Path
from mathutils import Matrix,Vector

out=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(out/'cymba-wired-assembly.blend'))
scene=bpy.context.scene
scene.cycles.samples=20
scene.render.resolution_x=1100;scene.render.resolution_y=600
cam=scene.camera
cam.data.ortho_scale=100
cam.location=(0,14,120)
target=Vector((0,52,6))
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
old=Matrix.Rotation(math.radians(-90),4,'X')@Matrix.Rotation(math.radians(55),4,'Z')
mirror=Matrix.Diagonal((-1,1,1,1))
buds=[bpy.data.objects['Earbud · L · supplied textured mesh'],bpy.data.objects['Earbud · R · mirrored supplied textured mesh']]
original=[[v.co.copy() for v in o.data.vertices] for o in buds]
for angle in [25,30,35]:
    new=Matrix.Rotation(math.radians(-18),4,'Z')@Matrix.Rotation(math.radians(-90),4,'X')@Matrix.Rotation(math.radians(angle),4,'Z')
    delta=new@old.inverted()
    for i,ob in enumerate(buds):
        rotation=delta if i==0 else mirror@delta@mirror
        for v,co in zip(ob.data.vertices,original[i]): v.co=rotation@co
        ob.location.z=.65-min(v.co.z for v in ob.data.vertices)
        wire=bpy.data.objects[('Left' if i==0 else 'Right')+' earbud · editable wire']
        ps=wire.data.splines[0].bezier_points
        ps[0].co.z=ob.location.z
        ps[1].co.z=3.7+(ob.location.z-4.2)*.22
        ob.data.update()
    scene.render.filepath=str(out/'previews'/('orientation-upright-'+str(angle)+'.png'))
    bpy.ops.render.render(write_still=True)

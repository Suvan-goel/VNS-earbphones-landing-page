import bpy,sys,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root/'source'))
from earbud_orientation import correct_existing_scene
bpy.ops.wm.open_mainfile(filepath=str(root/'cymba-session-before-orientation.blend'))
print('CORRECTION',json.dumps(correct_existing_scene()),flush=True)
scene=bpy.context.scene
scene.camera=bpy.data.objects['Camera · reference layout']
scene.camera.data.ortho_scale=100
scene.camera.location=(0,14,120)
scene.camera.rotation_euler=(Vector((0,52,6))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=1100;scene.render.resolution_y=600;scene.cycles.samples=24
scene.render.filepath=str(root/'previews'/'corrected-earbuds-review.png')
bpy.ops.render.render(write_still=True)

import bpy,sys,json,importlib
from pathlib import Path
from mathutils import Quaternion
source=Path('/Users/suvangoel/VNS-earbuds-site/output/meshy-earbud-blender/source')
sys.path.insert(0,str(source))
import wide_layout
importlib.reload(wide_layout)
if bpy.context.object and bpy.context.object.mode!='OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
report=wide_layout.apply_wide_layout()
bpy.ops.object.select_all(action='DESELECT')
for screen in bpy.data.screens:
    for area in screen.areas:
        if area==bpy.context.area and area.type=='CONSOLE': area.type='VIEW_3D'
        if area.type=='VIEW_3D':
            space=area.spaces.active
            space.region_3d.view_rotation=Quaternion((1,0,0,0))
            space.region_3d.view_perspective='ORTHO'
            space.region_3d.view_distance=195
            space.region_3d.view_location=(3,6,4)
            space.overlay.show_overlays=False
            space.shading.type='MATERIAL'
            space.shading.use_scene_world=True
            space.shading.use_scene_lights=True
bpy.context.scene.cycles.samples=64
bpy.ops.wm.save_as_mainfile(filepath=str(source.parent/'cymba-wired-assembly.blend'))
(source.parent/'wide-layout-validation.json').write_text(json.dumps(report,indent=2))
print('16:9 arrangement saved with vertical controller beside earbuds.')

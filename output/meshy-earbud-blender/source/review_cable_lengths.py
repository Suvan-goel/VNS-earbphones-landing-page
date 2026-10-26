import bpy,sys,json
from pathlib import Path
source=Path(__file__).resolve().parent;out=source.parent
sys.path.insert(0,str(source))
from cable_lengths import apply_cable_lengths
bpy.ops.wm.open_mainfile(filepath=str(out/'cymba-session-before-cable-lengths.blend'))
report=apply_cable_lengths()
(out/'cable-lengths-validation.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out/'cymba-cable-lengths-review.blend'))
scene=bpy.context.scene;scene.cycles.samples=32;scene.render.resolution_percentage=75
scene.render.filepath=str(out/'cymba-cable-lengths-review.png')
bpy.ops.render.render(write_still=True)
print('CABLE LENGTH REVIEW COMPLETE',flush=True)

import bpy,sys,json
from pathlib import Path
source=Path(__file__).resolve().parent;out=source.parent
sys.path.insert(0,str(source))
from refine_middle_cable import apply_refinement
bpy.ops.wm.open_mainfile(filepath=str(out/'cymba-session-before-coil-refinement.blend'))
report=apply_refinement()
(out/'coil-refinement-validation.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out/'cymba-coil-refinement-review.blend'))
scene=bpy.context.scene;scene.cycles.samples=32;scene.render.resolution_percentage=75
scene.render.filepath=str(out/'cymba-coil-refinement-review.png')
bpy.ops.render.render(write_still=True)
print('MIDDLE CABLE REVIEW COMPLETE',flush=True)

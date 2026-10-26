import bpy,sys,json
from pathlib import Path
source=Path(__file__).resolve().parent;out=source.parent
sys.path.insert(0,str(source))
from product_layout import apply_layout
bpy.ops.wm.open_mainfile(filepath=str(out/'cymba-session-before-layout.blend'))
report=apply_layout()
(out/'layout-validation.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out/'cymba-layout-review.blend'))
scene=bpy.context.scene;scene.cycles.samples=32
scene.render.resolution_percentage=75
scene.render.filepath=str(out/'cymba-layout-review.png')
bpy.ops.render.render(write_still=True)
print('LAYOUT REVIEW COMPLETE',flush=True)

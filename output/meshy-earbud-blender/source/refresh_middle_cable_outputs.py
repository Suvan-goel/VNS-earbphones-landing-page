import bpy,json,shutil,sys,time
from pathlib import Path
from mathutils import Matrix
source=Path(__file__).resolve().parent;out=source.parent
sys.path.insert(0,str(source))
from product_layout import products,fingerprint
bpy.ops.wm.open_mainfile(filepath=str(out/'cymba-wired-assembly.blend'))
scene=bpy.context.scene
assert scene.get('product_layout_revision')==4
obs=products();assert len(obs)==29
report=json.loads((out/'coil-refinement-validation.json').read_text())
for name,expected in report['component_fingerprints'].items():
    assert fingerprint(bpy.data.objects[name])==expected,name
assert (scene.render.resolution_x,scene.render.resolution_y)==(1920,1080)
scene.cycles.samples=64
scene.camera=bpy.data.objects['Camera · reference layout']
scene.render.filepath=str(out/'cymba-assembly-preview.png')
bpy.ops.render.render(write_still=True)
shutil.copy2(out/'cymba-assembly-preview.png',out/'cymba-wide-layout-16x9.png')
scene.camera=bpy.data.objects['Camera · three-quarter']
scene.render.filepath=str(out/'cymba-assembly-perspective.png')
bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
matrices={o.name:o.matrix_world.copy() for o in obs}
for ob in obs:
    ob.select_set(True)
    ob.matrix_world=Matrix.Scale(.001,4)@ob.matrix_world
bpy.ops.export_scene.gltf(filepath=str(out/'cymba-wired-assembly.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
for ob in obs: ob.matrix_world=matrices[ob.name]
bpy.context.view_layer.update()
info=json.loads((out/'assembly-info.json').read_text())
info.update({'layout_revision':4,'layout':'16:9 landscape with a refined vertical oval main cable coil, balanced cable tails and short USB-C lead',
             'render_resolution':[1920,1080],'model_geometry_preserved':True,
             'middle_cable_length_mm':report['middle_cable_length_after_mm']})
info['cable_lengths_mm']['Junction to controller · editable wire']=report['middle_cable_length_after_mm']
(out/'assembly-info.json').write_text(json.dumps(info,indent=2))
print('VERIFIED: unchanged components, new cable lengths, updated previews and GLB.',flush=True)

import bpy,json
from pathlib import Path
from mathutils import Matrix,Vector
out=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(out/'cymba-wired-assembly.blend'))
scene=bpy.context.scene
assert scene.get('product_layout_revision')==1
products=[o for c in bpy.data.collections if c.name.startswith(('01','02','03','04')) for o in c.objects]
assert len(products)==29
scene.cycles.samples=64
scene.render.filepath=str(out/'cymba-assembly-preview.png')
bpy.ops.render.render(write_still=True)
scene.camera=bpy.data.objects['Camera · three-quarter']
scene.camera.location=(10,-101,300)
scene.camera.rotation_euler=(Vector((4,-1,3))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera.data.ortho_scale=178
scene.render.filepath=str(out/'cymba-assembly-perspective.png')
bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
for ob in products:
    ob.select_set(True)
    ob.matrix_world=Matrix.Scale(.001,4)@ob.matrix_world
bpy.ops.export_scene.gltf(filepath=str(out/'cymba-wired-assembly.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
info=json.loads((out/'assembly-info.json').read_text())
info.update({'layout_revision':1,'layout':'Centered controller; balanced paired buds; smooth cable branches and compact oval USB coil','model_geometry_preserved':True})
(out/'assembly-info.json').write_text(json.dumps(info,indent=2))
print('FINAL LAYOUT PREVIEWS AND EXPORT COMPLETE',flush=True)

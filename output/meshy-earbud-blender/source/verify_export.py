"""Reopen the saved scene, validate dependencies, and export in glTF metres."""
import bpy,json,math
from pathlib import Path
from mathutils import Matrix,Vector

out=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(out/'cymba-wired-assembly.blend'))
scene=bpy.context.scene
products=[o for c in bpy.data.collections if c.name.startswith(('01','02','03','04')) for o in c.objects]
assert len(products)==29, len(products)
assert len([o for o in products if o.type=='CURVE'])==5
assert len([o for o in products if o.type=='FONT'])==1
for image in bpy.data.images:
    if image.source=='FILE' and image.name not in {'Render Result','Viewer Node'}:
        assert image.packed_file or image.packed_files, image.name
for obj in products:
    assert all(math.isfinite(v) for row in obj.matrix_world for v in row), obj.name
camera=next(o for o in scene.objects if o.name=='Camera · three-quarter')
camera.location=(-20.125,-75,85)
camera.rotation_euler=(Vector((-20.125,-32.875,3))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.ortho_scale=77;scene.camera=camera
scene.render.resolution_x=1500;scene.render.resolution_y=550
scene.render.filepath=str(out/'cymba-controller-detail.png')
bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
original={o:o.matrix_world.copy() for o in products}
for obj in products:
    obj.select_set(True)
    obj.matrix_world=Matrix.Scale(.001,4)@original[obj]
bpy.ops.export_scene.gltf(filepath=str(out/'cymba-wired-assembly.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
report={'blend_reopened_successfully':True,'product_objects':len(products),'editable_cable_curves':5,'all_file_images_packed':True,'glb_units':'metres','blend_unit':'millimetres'}
(out/'validation.json').write_text(json.dumps(report,indent=2))
print('VERIFIED',json.dumps(report),flush=True)

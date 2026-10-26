import bpy,json
from pathlib import Path
from mathutils import Matrix,Vector
out=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(out/'cymba-wired-assembly.blend'))
scene=bpy.context.scene
products=[o for c in bpy.data.collections if c.name.startswith(('01','02','03','04')) for o in c.objects]
buds=[o for o in products if o.name.startswith('Earbud ·')]
assert len(buds)==2 and all(o.get('orientation_revision')==2 for o in buds)
for ob in buds:
    assert min((ob.matrix_world@v.co).z for v in ob.data.vertices)>.64
assert len(products)==29
assert len([o for o in products if o.type=='CURVE'])==5
scene.render.resolution_x=1500;scene.render.resolution_y=1371;scene.cycles.samples=48
for camera,filename in [('Camera · reference layout','cymba-assembly-preview.png'),('Camera · three-quarter','cymba-assembly-perspective.png')]:
    scene.camera=bpy.data.objects[camera]
    scene.render.filepath=str(out/filename)
    bpy.ops.render.render(write_still=True)
scene.camera=bpy.data.objects['Camera · reference layout']
scene.camera.data.ortho_scale=100;scene.camera.location=(0,14,120)
scene.camera.rotation_euler=(Vector((0,52,6))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=1300;scene.render.resolution_y=710
scene.render.filepath=str(out/'cymba-earbuds-corrected.png')
bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
for ob in products:
    ob.select_set(True)
    ob.matrix_world=Matrix.Scale(.001,4)@ob.matrix_world
bpy.ops.export_scene.gltf(filepath=str(out/'cymba-wired-assembly.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
info=json.loads((out/'assembly-info.json').read_text())
info.update({'orientation_revision':2,'source_presentation_tilt_degrees':20,'earbud_body_height_assumed_mm':24.4066})
(out/'assembly-info.json').write_text(json.dumps(info,indent=2))
print('VERIFIED: corrected pose, floor clearance, editable wires, and updated export.',flush=True)

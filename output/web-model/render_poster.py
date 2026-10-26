import bpy, json
from pathlib import Path
root=Path('/Users/suvangoel/VNS-earbuds-site')
out=root/'output/web-model'
bpy.ops.wm.open_mainfile(filepath=str(root/'output/meshy-earbud-blender/cymba-wired-assembly.blend'))
scene=bpy.context.scene
assert scene.get('product_layout_revision')==4
for collection in bpy.data.collections:
    if collection.name.startswith('90'):
        for ob in collection.objects:
            if ob.type=='MESH':ob.hide_render=True
scene.camera=bpy.data.objects['Camera · reference layout']
scene.render.film_transparent=True
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
scene.render.resolution_x=1600;scene.render.resolution_y=900
scene.render.resolution_percentage=100
scene.cycles.samples=64;scene.cycles.use_denoising=True
scene.render.filepath=str(out/'poster-transparent.png')
bpy.ops.render.render(write_still=True)
(out/'poster-camera.json').write_text(json.dumps({'camera_location_mm':list(scene.camera.location),'camera_rotation':list(scene.camera.rotation_euler),'ortho_scale_mm':scene.camera.data.ortho_scale,'resolution':[1600,900]},indent=2))
print('TRANSPARENT_POSTER_COMPLETE',flush=True)

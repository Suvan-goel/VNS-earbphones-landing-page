"""Render the captured live scene as a clean 4K product still."""
import bpy,json,time
from pathlib import Path
out=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(out/'cymba-render-source.blend'))
scene=bpy.context.scene
scene.camera=bpy.data.objects['Camera · reference layout']
scene.render.engine='CYCLES'
scene.render.resolution_x=3840
scene.render.resolution_y=2160
scene.render.resolution_percentage=100
scene.render.pixel_aspect_x=1
scene.render.pixel_aspect_y=1
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGB'
scene.render.image_settings.color_depth='8'
scene.render.image_settings.compression=30
scene.render.use_border=False
scene.render.film_transparent=False
scene.cycles.samples=256
scene.cycles.use_adaptive_sampling=True
scene.cycles.adaptive_threshold=.01
scene.cycles.adaptive_min_samples=32
scene.cycles.use_denoising=True
scene.cycles.denoiser='OPENIMAGEDENOISE'
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='METAL'
    prefs.get_devices()
    gpu_devices=[d for d in prefs.devices if d.type=='METAL']
    if gpu_devices:
        for d in prefs.devices:d.use=d.type=='METAL'
        scene.cycles.device='GPU'
except Exception as exc:
    print('Using available render device:',exc,flush=True)
scene.render.filepath=str(out/'cymba-product-render-4k.png')
print('Rendering 3840 x 2160, Cycles, adaptive 256 samples, device '+scene.cycles.device,flush=True)
start=time.time()
bpy.ops.render.render(write_still=True)
report={'image':scene.render.filepath,'resolution':[3840,2160],'aspect_ratio':'16:9',
        'engine':'Cycles','maximum_samples':256,'adaptive_threshold':.01,'denoising':True,
        'camera':scene.camera.name,'render_seconds':round(time.time()-start,1),
        'source_scene':'cymba-render-source.blend','model_modified':False}
(out/'render-4k-info.json').write_text(json.dumps(report,indent=2))
print('4K RENDER COMPLETE',flush=True)

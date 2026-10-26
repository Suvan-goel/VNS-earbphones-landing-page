"""Build an independent, visually equivalent web copy; never saves the source."""
import bpy, json, sys, hashlib, time
from pathlib import Path
from mathutils import Matrix, Vector

root=Path('/Users/suvangoel/VNS-earbuds-site')
src=root/'output/meshy-earbud-blender'
out=root/'output/web-model'
dest=root/'public/models/cymba-wired-assembly-web.glb'
out.mkdir(parents=True,exist_ok=True);dest.parent.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(src/'source'))
from product_layout import products
source_files=[src/'cymba-wired-assembly.blend',src/'cymba-wired-assembly.glb']
hashes={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in source_files}
bpy.ops.wm.open_mainfile(filepath=str(source_files[0]))
scene=bpy.context.scene
assert scene.get('product_layout_revision')==4
obs=products();assert len(obs)==29

def stats():
    deps=bpy.context.evaluated_depsgraph_get();result=[];all_points=[]
    for ob in obs:
        ev=ob.evaluated_get(deps);mesh=ev.to_mesh();mesh.calc_loop_triangles()
        points=[ob.matrix_world@v.co for v in mesh.vertices];all_points.extend(points)
        result.append({'name':ob.name,'vertices':len(mesh.vertices),'triangles':len(mesh.loop_triangles)})
        ev.to_mesh_clear()
    return {'objects':result,'triangles':sum(r['triangles'] for r in result),
        'bounds_mm':{'min':[min(p[i] for p in all_points) for i in range(3)],'max':[max(p[i] for p in all_points) for i in range(3)]}}

def render(name):
    scene.camera=bpy.data.objects['Camera · reference layout']
    scene.render.resolution_x=1280;scene.render.resolution_y=720
    scene.render.resolution_percentage=100;scene.cycles.samples=32
    scene.cycles.use_denoising=True
    scene.render.filepath=str(out/name)
    bpy.ops.render.render(write_still=True)

before=stats()
render('source-preview.png')
changes=[]
for ob in obs:
    if ob.type=='CURVE' and 'editable wire' in ob.name:
        old=(ob.data.resolution_u,ob.data.render_resolution_u,ob.data.bevel_resolution)
        # Keep enough longitudinal samples for the long approach/exit curves;
        # reduce excess radial samples while preserving a smooth silhouette.
        ob.data.resolution_u=24
        ob.data.render_resolution_u=ob.data.resolution_u
        ob.data.bevel_resolution=2
        changes.append({'name':ob.name,'curve_before':old,'curve_after':[ob.data.resolution_u,ob.data.render_resolution_u,ob.data.bevel_resolution]})

# Convert evaluated meshes so simplification follows the accepted smooth shape,
# including every original modifier and the lettering outlines.
bpy.ops.object.select_all(action='DESELECT')
for ob in obs:ob.select_set(True)
bpy.context.view_layer.objects.active=obs[0]
bpy.ops.object.convert(target='MESH')
obs=products();assert len(obs)==29 and all(o.type=='MESH' for o in obs)
for ob in obs:
    ratio=.25 if ob.name.startswith('Earbud ·') else .01 if ob.name=='Y-junction · seamless rubber housing' else None
    if ratio is None:continue
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True)
    bpy.context.view_layer.objects.active=ob
    mod=ob.modifiers.new('Web display simplification','DECIMATE')
    mod.decimate_type='COLLAPSE';mod.ratio=ratio;mod.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    changes.append({'name':ob.name,'decimate_ratio':ratio})

textures=[]
for im in bpy.data.images:
    if not im.name.startswith('Image_'):continue
    old=list(im.size)
    if max(old)>2048:
        factor=2048/max(old);im.scale(round(old[0]*factor),round(old[1]*factor))
    textures.append({'name':im.name,'source_size':old,'web_size':list(im.size)})
bpy.context.view_layer.update()
after=stats()
render('optimized-preview.png')
for key in ['min','max']:
    assert max(abs(a-b) for a,b in zip(before['bounds_mm'][key],after['bounds_mm'][key]))<.1
bpy.ops.object.select_all(action='DESELECT')
for ob in obs:
    ob.select_set(True)
    ob.matrix_world=Matrix.Scale(.001,4)@ob.matrix_world
bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,
    export_apply=True,export_yup=True,export_image_format='JPEG',export_image_quality=80,
    export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,
    export_draco_position_quantization=16,export_draco_normal_quantization=12,
    export_draco_texcoord_quantization=14,export_unused_images=False)
assert all(hashlib.sha256(p.read_bytes()).hexdigest()==hashes[str(p)] for p in source_files)
report={'source_layout_revision':4,'source_files_unchanged':True,'source_sha256':hashes,
    'before':before,'after':after,'changes':changes,'textures':textures,
    'export_path':str(dest),'size_bytes':dest.stat().st_size,'requires_draco':True}
(out/'web-model-report.json').write_text(json.dumps(report,indent=2))
print('WEB_MODEL_COMPLETE='+json.dumps({'size_bytes':report['size_bytes'],'triangles_before':before['triangles'],'triangles_after':after['triangles'],'bounds_mm':after['bounds_mm']}),flush=True)

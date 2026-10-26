"""Project traced core paths into editable, tapered filaments and export."""
import bpy,bmesh,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path('/Users/suvangoel/VNS-earbuds-site');OUT=ROOT/'output/neural-mannequin'
DEST=ROOT/'public/models/cymba-neural-mannequin-premium.glb'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'cymba-neural-mannequin-premium.blend'))
scene=bpy.context.scene;head=bpy.data.objects['Cymba_Marble_Mannequin']
# Rebuild from the preserved sculpture on every export, avoiding accumulated smoothing.
marble=head.data.materials[0]
with bpy.data.libraries.load(str(OUT/'cymba-neural-mannequin.blend'),link=False) as (available,loaded):
    loaded.objects=['Cymba_Marble_Mannequin']
template=loaded.objects[0]
head.data=template.data.copy();head.data.materials.clear();head.data.materials.append(marble)
bpy.data.objects.remove(template,do_unlink=True)
for obj in scene.objects:obj.select_set(False)
head.select_set(True);bpy.context.view_layer.objects.active=head
polish=head.modifiers.new('Polish legacy scalp relief','SMOOTH')
polish.vertex_group='Scalp surface refinement';polish.factor=.60;polish.iterations=24
bpy.ops.object.modifier_apply(modifier=polish.name)
for obj in list(scene.objects):
    if obj.name.startswith('Traced '):bpy.data.objects.remove(obj,do_unlink=True)
mat=head.data.materials[0];bs=mat.node_tree.nodes.get('Principled BSDF')
for link in list(mat.node_tree.links):
    if link.to_node==bs and link.to_socket==bs.inputs['Emission Color']:mat.node_tree.links.remove(link)
bs.inputs['Emission Color'].default_value=(0,0,0,1);bs.inputs['Emission Strength'].default_value=0
bm=bmesh.new();bm.from_mesh(head.data);bvh=BVHTree.FromBMesh(bm);bm.free()
for obj in scene.objects:
    if obj.type=='CURVE':
        for spline in obj.data.splines:
            for point in spline.points:
                hit,normal,_,_=bvh.find_nearest(Vector(point.co[:3]))
                if hit is not None:point.co=(*(hit+normal*.003),1)
nerve=bpy.data.materials['Purple neural fibres']
projection=json.loads((OUT/'trace-projection.json').read_text())
traces=json.loads((OUT/'traced-fibre-paths.json').read_text())

def create(name,coords,radii):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.resolution_u=1
    data.bevel_depth=1;data.bevel_resolution=2
    line=data.splines.new('POLY');line.points.add(len(coords)-1)
    for p,co,r in zip(line.points,coords,radii):p.co=(*co,1);p.radius=r
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);data.materials.append(nerve)

for side in ['-1','1']:
    p=projection[side];centre=Vector(p['centre']);right=Vector(p['right']);up=Vector(p['up']);direction=Vector(p['direction'])
    def surface(pixel):
        x,y=pixel
        point=centre+right*((x+.5)/p['size']-.5)*p['scale']+up*(.5-(y+.5)/p['size'])*p['scale']
        hit,normal,_,_=bvh.ray_cast(point-direction*4,direction)
        return hit+normal*.007 if hit is not None else None
    for i,path in enumerate(traces[side]['paths']):
        coords=[];radii=[]
        for pixel,radius in zip(path['pixels'],path['radius']):
            co=surface(pixel)
            if co is not None:coords.append(co);radii.append(radius)
        if len(coords)>1:create('Traced cranial filament '+side+' '+str(i),coords,radii)
    root=surface(traces[side]['rootPixel'])
    if root is not None:
        start=Vector((int(side)*1.15,-.04,.05));coords=[];radii=[]
        for i in range(33):
            t=i/32
            point=start.lerp(root,t)
            hit,normal,_,_=bvh.find_nearest(point)
            coords.append(hit+normal*.010);radii.append(.007)
        create('Traced auricular connection '+side,coords,radii)

curves=[o for o in scene.objects if o.type=='CURVE']
for obj in scene.objects:obj.select_set(False)
copies=[]
for obj in curves:
    copy=obj.copy();copy.data=obj.data.copy();scene.collection.objects.link(copy)
    bpy.context.view_layer.objects.active=copy;copy.select_set(True);bpy.ops.object.convert(target='MESH')
    copies.append(bpy.context.object);bpy.context.object.select_set(False)
for obj in copies:obj.select_set(True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join()
joined=bpy.context.object;joined.name='Purple_Surface_Nerve_Fibres';head.select_set(True)
head['web_revision']='premium-traced-filaments-v3'
bpy.ops.export_scene.gltf(filepath=str(DEST),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,
  export_image_format='JPEG',export_image_quality=92,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,
  export_draco_position_quantization=16,export_draco_normal_quantization=12,export_draco_texcoord_quantization=14)
triangles=0
for obj in [head,joined]:obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
bpy.data.objects.remove(joined,do_unlink=True)
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'cymba-neural-mannequin-premium.blend'))
report={'webModel':str(DEST),'bytes':DEST.stat().st_size,'editableCurves':len(curves),'triangles':triangles,'originalPreserved':True,
  'buildSteps':['premium_fibres.py (Blender)','trace_fibre_masks.py (Blender)','vectorize_fibres.py (Python with OpenCV/SciPy)','build_traced_fibres.py (Blender)']}
(OUT/'premium-fibres-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)

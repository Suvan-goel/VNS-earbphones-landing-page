"""Prepare attributed scan as a clean local-space sculptural bust for the website."""
import bpy, bmesh, math, json
from mathutils import Vector
from pathlib import Path
root=Path('/Users/suvangoel/VNS-earbuds-site');base=root/'output/mannequin-source'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(base/'LeePerrySmith.glb'))
head=next(o for o in bpy.data.objects if o.type=='MESH')
for o in list(bpy.data.objects):
 if o!=head:bpy.data.objects.remove(o,do_unlink=True)
bpy.context.view_layer.objects.active=head;head.select_set(True)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
# Blender Y = negative glTF Z; Blender Z = glTF Y.
for v in head.data.vertices:
 x,y,z=v.co
 v.co=(x*.625,(y+.2)*.72,(z-1.28)*.72+.05)
bm=bmesh.new();bm.from_mesh(head.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001);bm.to_mesh(head.data);bm.free()
sub=head.modifiers.new('Sculpture smoothing','SUBSURF');sub.levels=1;sub.render_levels=1
bpy.ops.object.modifier_apply(modifier=sub.name)
# Trim the broad shoulder scan into a deliberate bust base.
bm=bmesh.new();bm.from_mesh(head.data)
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.00001,plane_co=(0,0,-2.3),plane_no=(0,0,1),clear_inner=True,clear_outer=False)
bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(head.data);bm.free()
# A gradual taper below the jaw keeps the bottom compact, without altering the face.
for v in head.data.vertices:
 t=max(0,min(1,(-v.co.z-1.1)/1.2));t=t*t*(3-2*t)
 v.co.x*=1-.16*t
for p in head.data.polygons:p.use_smooth=p.center.z>-2.29
head.data.update();head.name='Cymba sculpted mannequin';head.data.name='Attributed human scan — sculpted bust'
head['source']='Infinite, 3D Head Scan by Lee Perry-Smith / triplegangers.com';head['license']='CC BY 3.0';head['modifications']='Smoothed, cropped, tapered and normalized for Cymba visualization.'
head.data.materials.clear();mat=bpy.data.materials.new('Ivory stone');mat.use_nodes=True
bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.72,.67,.58,1);bs.inputs['Roughness'].default_value=.43
head.data.materials.append(mat)
for layer in list(head.data.uv_layers):head.data.uv_layers.remove(layer)
head.data.calc_loop_triangles()
coords=[Vector((v.co.x,v.co.z,-v.co.y)) for v in head.data.vertices]
report={'bounds':{'min':[min(v[i] for v in coords) for i in range(3)],'max':[max(v[i] for v in coords) for i in range(3)]},'triangles':len(head.data.loop_triangles),'earCanalsApprox':[[-1.03,.05,0],[1.03,.05,0]],'sourceToGltf':{'scale':[.625,.72,.72],'translation':[0,-.8716,-.144]},'license':'CC BY 3.0','attribution':'Infinite, 3D Head Scan by Lee Perry-Smith, based on work at triplegangers.com. Smoothed, cropped, tapered and normalized.'}
dest=root/'public/models/cymba-sculpted-head.glb'
bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_texcoords=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_draco_position_quantization=16,export_draco_normal_quantization=12)
report['sizeBytes']=dest.stat().st_size;(base/'prepared-head-report.json').write_text(json.dumps(report,indent=2))
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('World');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.9,.9,.9,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
for name,loc,power,size in [('Key',(-4,-6,6),550,4),('Fill',(4,-5,3),240,3),('Rim',(2,4,6),600,3)]:
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
c=bpy.data.cameras.new('Camera');co=bpy.data.objects.new('Camera',c);scene.collection.objects.link(co);scene.camera=co;c.type='ORTHO';c.ortho_scale=5.25
for name,loc in [('front',(0,-20,-.12)),('side',(20,0,-.12)),('threequarter',(13,-20,-.12))]:
 co.location=loc;co.rotation_euler=(Vector((0,0,-.12))-co.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(base/f'prepared-{name}.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(base/'cymba-sculpted-head.blend'))
print('PREPARED_HEAD_COMPLETE='+json.dumps(report))

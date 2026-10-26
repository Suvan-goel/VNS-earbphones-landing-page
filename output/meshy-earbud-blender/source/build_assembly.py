"""Build the editable CYMBA concept assembly from the supplied textured GLB.

Run in Blender. All new geometry uses millimetres; dimensions are visual
estimates from the reference image, not measured hardware dimensions.
"""
import bpy, bmesh, math, json, sys
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

HERE=Path(__file__).resolve().parent
OUT=HERE.parent
ROOT=OUT.parent.parent
sys.path.insert(0,str(HERE))
from controller import build_controller
from cables import build_cables
from earbud_orientation import correct_existing_scene

def collection(name):
    c=bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c

def move_collection(obj,target):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    target.objects.link(obj)

def material(name,color,roughness=.5):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=roughness
    return m

def make_earbuds():
    target=collection('01 · Supplied earbuds')
    # Preserve the original in earbud-source.blend, trimming only assembly copies.
    with bpy.data.libraries.load(str(OUT/'earbud-source.blend'),link=False) as (src,dst):
        dst.objects=list(src.objects)
    source=next(o for o in dst.objects if o and o.type=='MESH')
    target.objects.link(source)
    source.name='Earbud · L · supplied textured mesh'
    source.data=source.data.copy()
    bm=bmesh.new();bm.from_mesh(source.data)
    cut_z=-.40
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
                         dist=.000001,plane_co=(0,0,cut_z),plane_no=(0,0,1))
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.z<cut_z-.000001],context='VERTS')
    rim=[e for e in bm.edges if e.is_boundary and all(abs(v.co.z-cut_z)<.00001 for v in e.verts)]
    if rim: bmesh.ops.holes_fill(bm,edges=rim,sides=0)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(source.data);bm.free()
    # Rotation presents the external face, with the ear tip pointing inward.
    transform=Matrix.Rotation(math.radians(-90),4,'X')@Matrix.Rotation(math.radians(55),4,'Z')
    scale=19.0
    pivot=Vector((-.114,-.164,cut_z))
    for v in source.data.vertices: v.co=(transform@(v.co-pivot))*scale
    root_z=1.1-min(v.co.z for v in source.data.vertices)
    source.location=((425-656)*.125,(600-240)*.125,root_z)
    source['source_file']='Meshy_AI_Smart_Earbud_1025112407_image-to-3d-texture.glb'
    source['modification']='Cable stump trimmed for continuous replacement wire; shell and source textures preserved.'
    source['assumed_scale']='19 millimetres per source model unit'
    source['side']='Left'
    right=source.copy();right.data=source.data.copy();target.objects.link(right)
    right.name='Earbud · R · mirrored supplied textured mesh'
    for v in right.data.vertices: v.co.x*=-1
    bm=bmesh.new();bm.from_mesh(right.data)
    bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(right.data);bm.free()
    right.location=((885-656)*.125,(600-240)*.125,root_z)
    right['side']='Right'
    # Avoid smoothing over deliberately separated source edges.
    for ob in (source,right):
        for face in ob.data.polygons: face.use_smooth=True
    return {'objects':[source,right],'root_z':root_z,'assumed_body_height_mm':(0.949558-cut_z)*scale}

def setup_studio():
    scene=bpy.context.scene
    studio=collection('90 · Studio · excluded from model export')
    bpy.ops.mesh.primitive_plane_add(size=600,location=(0,0,-.12))
    floor=bpy.context.object;floor.name='Studio · warm ivory surface';move_collection(floor,studio)
    mat=material('Studio · warm ivory',(0.82,.72,.60),.77)
    floor.data.materials.append(mat)
    nt=mat.node_tree
    tex=nt.nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=4.5
    tex.inputs['Detail'].default_value=2
    bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.018
    nt.links.new(tex.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],nt.nodes['Principled BSDF'].inputs['Normal'])
    scene.world=bpy.data.worlds.new('Studio · soft ambient')
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.72,.76,.82,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
    for name,position,power,size,color in [
        ('Key softbox',(-70,70,150),490000,110,(1,.92,.82)),
        ('Fill softbox',(100,-10,125),260000,95,(.84,.91,1)),
        ('Top rim',(0,100,65),230000,70,(1,.90,.76)),
    ]:
        light=bpy.data.lights.new(name,'AREA');light.energy=power;light.shape='DISK';light.size=size;light.color=color
        obj=bpy.data.objects.new('Studio · '+name,light);studio.objects.link(obj);obj.location=position
        obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('Reference layout camera');cam=bpy.data.objects.new('Camera · reference layout',data);studio.objects.link(cam)
    cam.location=(0,0,310);cam.rotation_euler=(0,0,0)
    data.type='ORTHO';data.ortho_scale=169
    data.lens=50;scene.camera=cam
    oblique_data=bpy.data.cameras.new('Three-quarter camera');oblique=bpy.data.objects.new('Camera · three-quarter',oblique_data);studio.objects.link(oblique)
    oblique.location=(15,-123,270)
    oblique.rotation_euler=(Vector((0,0,2))-oblique.location).to_track_quat('-Z','Y').to_euler()
    oblique_data.type='ORTHO';oblique_data.ortho_scale=175
    return studio,cam,oblique

def add_reference():
    reference=collection('99 · Reference image · hidden')
    path=ROOT/'3D-model-reference-images'/'3d575fef-e083-4147-ba8f-965358e7a938.png'
    image=bpy.data.images.load(str(path),check_existing=True);image.pack()
    empty=bpy.data.objects.new('Reference · supplied product layout',None);reference.objects.link(empty)
    empty.empty_display_type='IMAGE';empty.data=image;empty.empty_display_size=164
    empty.color[3]=.5;empty.location=(0,0,-1);empty.hide_render=True
    reference.hide_viewport=True;reference.hide_render=True

def main():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for col in list(bpy.data.collections):
        if col.users==0 or not col.objects: bpy.data.collections.remove(col)
    scene=bpy.context.scene
    scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=.001;scene.unit_settings.length_unit='MILLIMETERS'
    earbuds=make_earbuds();controller=build_controller();cables=build_cables()
    # Use the reviewed, flatter pose and seat wires inside the rubber necks.
    correct_existing_scene()
    earbuds['root_z']=earbuds['objects'][0].location.z
    earbuds['assumed_body_height_mm']=(.949558+.335)*19
    studio,camera,oblique=setup_studio();add_reference()
    scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
    scene.cycles.max_bounces=8
    scene.render.resolution_x=1500;scene.render.resolution_y=1371;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.filepath=str(OUT/'cymba-assembly-preview.png')
    text=bpy.data.texts.new('READ ME · CYMBA assembly')
    text.write('CYMBA editable visual concept\n\nSupplied earbud duplicated and mirrored, keeping its textured shell. Only the existing cable stump is trimmed. Wires are editable Bezier curves; controller, button, trim and connector parts are separate objects.\n\nScale is estimated from the reference image: controller 55 x 13.5 mm, earbud shell about 25.6 mm high. These are visual assumptions, not measured dimensions. Scene unit is millimetres.\n\nCollections 01–04 contain the product. Collection 90 is the studio. Collection 99 contains the packed reference image and is hidden. The GLB export contains product geometry only.\n')
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.region_3d.view_rotation=Quaternion((1,0,0,0))
                area.spaces.active.region_3d.view_distance=190
                area.spaces.active.region_3d.view_location=(0,0,0)
                area.spaces.active.clip_end=2000
                area.spaces.active.shading.type='MATERIAL'
    bpy.ops.object.select_all(action='DESELECT')
    for ob in controller['objects']: ob.select_set(True)
    bpy.context.view_layer.objects.active=controller['objects'][0]
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'cymba-wired-assembly.blend'))
    print('ASSEMBLY',json.dumps({'earbud_root_z':earbuds['root_z'],'objects':len(scene.objects)}),flush=True)
    bpy.ops.render.render(write_still=True)
    scene.camera=oblique
    scene.render.filepath=str(OUT/'cymba-assembly-perspective.png')
    bpy.ops.render.render(write_still=True)
    original_location=oblique.location.copy()
    original_rotation=oblique.rotation_euler.copy()
    oblique.location=(-20.125,-75,85)
    oblique.rotation_euler=(Vector((-20.125,-32.875,3))-oblique.location).to_track_quat('-Z','Y').to_euler()
    oblique.data.ortho_scale=77
    scene.render.resolution_x=1500;scene.render.resolution_y=550
    scene.render.filepath=str(OUT/'cymba-controller-detail.png')
    bpy.ops.render.render(write_still=True)
    oblique.location=original_location;oblique.rotation_euler=original_rotation;oblique.data.ortho_scale=175
    scene.render.resolution_x=1500;scene.render.resolution_y=1371
    scene.camera=camera
    scene.render.filepath=str(OUT/'cymba-assembly-preview.png')
    bpy.ops.object.select_all(action='DESELECT')
    products=[]
    for col in bpy.data.collections:
        if col.name.startswith(('01','02','03','04')):
            products.extend(o for o in col.objects if o.type in {'MESH','CURVE','FONT'})
    for obj in products: obj.select_set(True)
    # glTF defines metres and does not apply Blender's display unit scale.
    # Convert only during export; the editable scene remains in millimetres.
    original_matrices={obj:obj.matrix_world.copy() for obj in products}
    try:
        for obj in products: obj.matrix_world=Matrix.Scale(.001,4)@original_matrices[obj]
        bpy.ops.export_scene.gltf(filepath=str(OUT/'cymba-wired-assembly.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
    finally:
        for obj in products: obj.matrix_world=original_matrices[obj]
    manifest={'source_glb':'Meshy_AI_Smart_Earbud_1025112407_image-to-3d-texture.glb','reference_image':'3d575fef-e083-4147-ba8f-965358e7a938.png','scale_basis':'Reference proportions; no physical dimensions supplied','controller_assumed_mm':[55,13.5,6.41],'earbud_body_height_assumed_mm':earbuds['assumed_body_height_mm'],'product_objects':len(products),'wires_remain_editable_curves_in_blend':True}
    (OUT/'assembly-info.json').write_text(json.dumps(manifest,indent=2))
    print('DONE',flush=True)

if __name__=='__main__': main()

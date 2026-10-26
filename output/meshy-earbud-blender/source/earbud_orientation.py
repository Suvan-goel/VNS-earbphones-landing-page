"""Natural paired-earbud pose and continuous cable entry helpers."""
import bpy,bmesh,math
from mathutils import Matrix,Vector

CUT_Y=1.235  # Retain the rubber sleeve; remove the short generated cable stub.

def natural_pose():
    return Matrix.Rotation(math.radians(-90),4,'X')@Matrix.Rotation(math.radians(20),4,'Z')

def trim_stump(obj):
    mesh=obj.data
    rubber=bpy.data.materials.get('Cable · soft black moulded rubber')
    if rubber and rubber.name not in mesh.materials: mesh.materials.append(rubber)
    index=list(mesh.materials).index(rubber) if rubber else 0
    bm=bmesh.new();bm.from_mesh(mesh)
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=(0,CUT_Y,0),plane_no=(0,1,0))
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.y<CUT_Y-.000001],context='VERTS')
    rim=[e for e in bm.edges if e.is_boundary and all(abs(v.co.y-CUT_Y)<.00001 for v in e.verts)]
    if rim:
        result=bmesh.ops.holes_fill(bm,edges=rim,sides=0)
        for face in result['faces']: face.material_index=index
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(mesh);bm.free();mesh.update()

def connect_wire(obj,wire,right=False):
    bpy.context.view_layer.update()
    rim=[v.co for v in obj.data.vertices if abs(v.co.y-CUT_Y)<.0001]
    center=Vector([(min(v[i] for v in rim)+max(v[i] for v in rim))/2 for i in range(3)])
    center=obj.matrix_world@center
    direction=(natural_pose().to_3x3()@Vector((.45,-.13,-1))).normalized()
    if right: direction.x*=-1
    points=wire.data.splines[0].bezier_points
    inverse=wire.matrix_world.inverted()
    start=center-direction*.72
    points[0].co=inverse@start
    points[0].handle_left_type='FREE';points[0].handle_right_type='FREE'
    points[0].handle_left=inverse@(start-direction*.9)
    points[0].handle_right=inverse@(start+direction*1.3)
    points[0].radius=2.4
    points[1].co=inverse@(center+direction*2.3)
    points[1].handle_left_type='AUTO';points[1].handle_right_type='AUTO'
    points[1].radius=1.05
    return {'neck_center_mm':list(center),'wire_start_mm':list(start),'neck_clearance_mm':.65}

def correct_existing_scene():
    old=Matrix.Rotation(math.radians(-90),4,'X')@Matrix.Rotation(math.radians(55),4,'Z')
    delta=natural_pose()@old.inverted()
    mirror=Matrix.Diagonal((-1,1,1,1))
    report={}
    for side,name in [('L','Left'),('R','Right')]:
        obj=bpy.data.objects['Earbud · '+side+' · '+('supplied textured mesh' if side=='L' else 'mirrored supplied textured mesh')]
        if obj.get('orientation_revision')!=2:
            trim_stump(obj)
            rotation=delta if side=='L' else mirror@delta@mirror
            obj.rotation_mode='QUATERNION';obj.rotation_quaternion=rotation.to_quaternion()
            obj.location.z=.65-min((rotation@v.co).z for v in obj.data.vertices)
            obj['orientation_revision']=2
            obj['orientation_note']='Inward nozzle; 20 degree presentation tilt; original fin axis upright.'
        wire=bpy.data.objects[name+' earbud · editable wire']
        report[side]=connect_wire(obj,wire,side=='R')
    return report

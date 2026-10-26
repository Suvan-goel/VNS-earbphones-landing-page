"""Irregular dendritic clusters, connected with curved axons on the clean marble."""
import bpy, bmesh, json, math, random
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=Path('/Users/suvangoel/VNS-earbuds-site')
OUT=ROOT/'output/neural-mannequin'
DEST=ROOT/'public/models/cymba-neural-mannequin-organic.glb'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'cymba-neural-mannequin-growing.blend'))
scene=bpy.context.scene;head=bpy.data.objects['Cymba_Marble_Mannequin']
random.seed(713)
neck=[]
for obj in list(scene.objects):
    if obj.type=='CURVE':
        if obj.name.startswith(('Continuous cervical','Brainstem surface')):
            neck.append((obj.name,[Vector(p.co[:3]) for p in obj.data.splines[0].points]))
        bpy.data.objects.remove(obj,do_unlink=True)
    elif obj.type=='MESH' and obj!=head:bpy.data.objects.remove(obj,do_unlink=True)
bm=bmesh.new();bm.from_mesh(head.data);bvh=BVHTree.FromBMesh(bm);bm.free()
def nearest(co):
    hit,normal,_,_=bvh.find_nearest(Vector(co))
    return hit+normal*.008,normal

centre=Vector((0,.05,.25))
def scalp(phi,theta):
    direction=Vector((math.cos(theta)*math.cos(phi),math.cos(theta)*math.sin(phi),math.sin(theta)*1.20)).normalized()
    hit,normal,_,_=bvh.ray_cast(centre+direction*4,-direction)
    if hit is None:raise RuntimeError('Missing scalp surface')
    return hit+normal*.008

paths=[]
def add_path(name,points,radius,start=0,tip=.12):
    points=[Vector(p) for p in points]
    # Arc length is inherited at every junction, so child fibres cannot appear
    # before the growing parent reaches their attachment point.
    distance=[start]
    for a,b in zip(points,points[1:]):distance.append(distance[-1]+(b-a).length)
    path={'name':name,'points':points,'distance':distance,'radius':radius,'tip':tip}
    paths.append(path);return path

def smooth_path(control):
    result=[]
    for i in range(len(control)-1):
        p0=control[max(0,i-1)];p1=control[i];p2=control[i+1];p3=control[min(len(control)-1,i+2)]
        steps=max(2,int((p2-p1).length/.018))
        for j in range(steps):
            t=j/steps
            co=.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)
            result.append(nearest(co)[0])
    result.append(nearest(control[-1])[0]);return result


# Small, asymmetric arbors leave open marble between active regions. Their
# axes turn locally rather than radiating in long spokes from a single ear.
def inside(p):
    front=max(0,min(1,(-p.y-.2)/.8))
    return p.z > .16+front*(.30+.08*math.sin(p.x*5))

def fibre(root,direction,length,bend):
    points=[root];phase=random.random()*math.tau
    for i in range(1,19):
        _,normal=nearest(points[-1]);tangent=direction-normal*direction.dot(normal)
        if tangent.length<1e-6:break
        tangent.normalize()
        direction=(tangent+normal.cross(tangent)*(bend/18+.055*math.sin(i*.72+phase))).normalized()
        co=nearest(points[-1]+direction*length/18)[0]
        if not inside(co):break
        points.append(co)
    return points

def arbor(origin,direction,length,radius,start,depth,energy):
    points=fibre(origin,direction,length,random.uniform(-.85,.85))
    if len(points)<5:return
    branch=add_path('Dendritic arbor %04d'%len(paths),points,radius,start,.36 if depth else .07)
    branch['energy']=energy
    if not depth:return
    # Unequal forks, at unequal distances, with different turning angles.
    for fraction,sign in [(random.uniform(.48,.76),random.choice([-1,1])),(1.,random.choice([-1,1]))]:
        i=min(len(points)-1,int((len(points)-1)*fraction));p=points[i]
        tangent=(points[i]-points[max(0,i-2)]).normalized();_,normal=nearest(p)
        angle=random.uniform(.38,1.05)*sign
        direction=tangent*math.cos(angle)+normal.cross(tangent)*math.sin(angle)
        arbor(p,direction,length*random.uniform(.53,.80),radius*.68,branch['distance'][i],depth-1,random.uniform(.3,.85))

clusters=[];connections=[]
# Deliberately offset centres; neither hemisphere mirrors the other.
layout=[(0.03,.28,-1),(-.42,.63,0),(-1.03,.86,1),(.15,1.16,1),(.71,.73,3),(1.24,.31,4),(1.48,.90,4)]
for side in [1,-1]:
    phi0=0 if side>0 else math.pi
    ear=nearest(Vector((side*1.1475,-.04,.05)))[0]
    base=len(clusters)
    for number,(phi,theta,parent) in enumerate(layout):
        phi+=random.uniform(-.12,.12);theta+=random.uniform(-.08,.08)
        actualphi=phi if side>0 else math.pi-phi
        point=scalp(actualphi,theta)
        if parent<0:origin=ear;start=0
        else:origin=clusters[base+parent]['point'];start=clusters[base+parent]['distance']
        delta=point-origin;_,normal=nearest(origin.lerp(point,.5));across=normal.cross(delta).normalized()
        controls=[origin,nearest(origin.lerp(point,.32)+across*random.uniform(.08,.20))[0],nearest(origin.lerp(point,.69)-across*random.uniform(.03,.12))[0],point]
        path=add_path('Connecting axon %s %s'%(side,number),smooth_path(controls),random.uniform(.006,.0085),start,.60)
        path['energy']=random.uniform(.65,.95)
        clusters.append({'point':point,'distance':path['distance'][-1]})
        connections.append(path)
        _,normal=nearest(point)
        direction=Vector((random.uniform(-1,1),random.uniform(-1,1),random.uniform(-1,1)))
        direction=(direction-normal*direction.dot(normal)).normalized()
        across=normal.cross(direction)
        for arm in range(random.choice([4,5])):
            angle=arm*math.tau/4.6+random.uniform(-.4,.4)
            ray=direction*math.cos(angle)+across*math.sin(angle)
            arbor(point,ray,random.uniform(.24,.44),random.uniform(.0048,.007),path['distance'][-1],3,random.uniform(.6,1))
        # Branches emerge at different points on the longer axon, never in rows.
        for fraction in [random.uniform(.25,.40),random.uniform(.56,.76)]:
            j=int((len(path['points'])-1)*fraction);p=path['points'][j]
            tangent=(path['points'][j+1]-path['points'][j-1]).normalized();_,n=nearest(p)
            ray=(tangent*.4+n.cross(tangent)*random.choice([-1,1])*.9).normalized()
            arbor(p,ray,random.uniform(.20,.36),.0042,path['distance'][j],2,.65)

# A continuous, subtly branching connection descends the back of the neck.
for name,points in neck:
    if points[0].z<points[-1].z:points.reverse()
    candidates=[(p,d) for path in connections for p,d in zip(path['points'],path['distance'])]
    root,distance=min(candidates,key=lambda entry:(entry[0]-points[0]).length)
    join=[nearest(root.lerp(points[0],i/24))[0] for i in range(25)]
    path=add_path(name,join+[nearest(p)[0] for p in points[1:]],.0055,distance,.25);path['energy']=.55

nerve=bpy.data.materials['Purple neural fibres']
bs=nerve.node_tree.nodes.get('Principled BSDF')
bs.inputs['Base Color'].default_value=(.035,.006,.11,1)
bs.inputs['Emission Color'].default_value=(.11,.012,1,1)
bs.inputs['Emission Strength'].default_value=3
bs.inputs['Roughness'].default_value=.38

# One draw call for the complete neural network. The u coordinate stores
# normalised distance from the ear; v stores local fibre energy.
max_distance=max(p['distance'][-1] for p in paths)
positions=[];uvs=[];faces=[]
sides=6
for path in paths:
    points=path['points'];n=len(points);base=len(positions)
    for i,point in enumerate(points):
        tangent=(points[min(i+1,n-1)]-points[max(0,i-1)]).normalized()
        _,normal=nearest(point)
        across=tangent.cross(normal).normalized()
        normal=across.cross(tangent).normalized()
        radius=path['radius']*(1-(1-path['tip'])*(i/(n-1))**1.30)
        radius=max(.00055,radius)
        for ring in range(sides+1):
            angle=ring/sides*math.tau
            positions.append(point+across*(math.cos(angle)*radius)+normal*(math.sin(angle)*radius*.78))
            uvs.append((.018+path['distance'][i]/max_distance*.94,path.get('energy',.65)))
        if i<n-1:
            for ring in range(sides):
                a=base+i*(sides+1)+ring;b=a+sides+1
                faces.append((a,b,b+1,a+1))
    # Editable centre lines stay in Blender but are excluded from the web export.
    data=bpy.data.curves.new(path['name'],'CURVE');data.dimensions='3D'
    spline=data.splines.new('POLY');spline.points.add(n-1)
    for p,co in zip(spline.points,points):p.co=(*co,1)
    obj=bpy.data.objects.new(path['name'],data);scene.collection.objects.link(obj)
    obj.hide_render=True;obj.hide_set(True)

data=bpy.data.meshes.new('Continuous neural fibre mesh');data.from_pydata(positions,[],faces);data.update()
uv=data.uv_layers.new(name='Neural growth distance')
loop_indices=np.empty(len(data.loops),dtype=np.int32);data.loops.foreach_get('vertex_index',loop_indices)
uv.data.foreach_set('uv',np.asarray(uvs,dtype=np.float32)[loop_indices].ravel())
for face in data.polygons:face.use_smooth=True
network=bpy.data.objects.new('Purple_Surface_Nerve_Fibres',data);scene.collection.objects.link(network);data.materials.append(nerve)
network['growth']='UV.x is continuous growth distance; UV.y controls local fibre energy'
head['web_revision']='organic-neural-clusters-v2'
head['visualization']='Schematic artistic projection, not anatomically exact or measured activity'
for obj in scene.objects:obj.select_set(False)
head.select_set(True);network.select_set(True);bpy.context.view_layer.objects.active=head
bpy.ops.export_scene.gltf(filepath=str(DEST),export_format='GLB',use_selection=True,export_apply=True,
    export_yup=True,export_extras=True,export_texcoords=True,export_image_format='AUTO',
    export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,
    export_draco_position_quantization=16,export_draco_normal_quantization=12,export_draco_texcoord_quantization=16)
triangles=0
for obj in [head,network]:obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'cymba-neural-mannequin-organic.blend'))
report={'webModel':str(DEST),'bytes':DEST.stat().st_size,'paths':len(paths),'triangles':triangles,'clusters':len(clusters),'maxPathLength':max_distance,'growthRange':[.018,.958],'sourcePreserved':True}
(OUT/'organic-network-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)

"""Continuous, path-parameterised cranial fibres over a clean marble sculpture."""
import bpy, bmesh, json, math, random
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

ROOT=Path('/Users/suvangoel/VNS-earbuds-site')
OUT=ROOT/'output/neural-mannequin'
DEST=ROOT/'public/models/cymba-neural-mannequin-growing.glb'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'cymba-neural-mannequin-marble.blend'))
scene=bpy.context.scene;head=bpy.data.objects['Cymba_Marble_Mannequin']
random.seed(126)
neck=[]
for obj in list(scene.objects):
    if obj.type=='CURVE':
        if obj.name.startswith(('Continuous cervical','Brainstem surface')):
            neck.append((obj.name,[Vector(p.co[:3]) for p in obj.data.splines[0].points]))
        bpy.data.objects.remove(obj,do_unlink=True)

def ss(a,b,x):
    t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)

# Alternating smoothing passes remove the old carved nerves without shrinking
# the skull. A feathered mask protects the ears, face and neck.
mesh=head.data
coords=np.empty(len(mesh.vertices)*3,dtype=np.float64);mesh.vertices.foreach_get('co',coords)
coords=coords.reshape(-1,3);original=coords.copy()
edges=np.empty(len(mesh.edges)*2,dtype=np.int32);mesh.edges.foreach_get('vertices',edges)
edges=edges.reshape(-1,2)
src=np.concatenate([edges[:,0],edges[:,1]]);dst=np.concatenate([edges[:,1],edges[:,0]])
degree=np.bincount(src,minlength=len(coords));degree=np.maximum(degree,1)[:,None]
front=1-ss(-.85,-.20,coords[:,1])
central=1-ss(.55,1.12,np.abs(coords[:,0]))
boundary=.22+.12*front*central
weight=ss(boundary,boundary+.20,coords[:,2])[:,None]
for iteration in range(140):
    for factor in [.50,-.53]:
        average=np.column_stack([np.bincount(src,weights=coords[dst,axis],minlength=len(coords)) for axis in range(3)])/degree
        coords+=factor*weight*(average-coords)
mesh.vertices.foreach_set('co',coords.ravel());mesh.update()
for face in mesh.polygons:face.use_smooth=True
bm=bmesh.new();bm.from_mesh(mesh);bvh=BVHTree.FromBMesh(bm);bm.free()

# Low-pass the radial scalp envelope as well: the old relief contains broad
# carved trunks that ordinary surface smoothing intentionally preserves.
# Only the cranial mask is replaced; facial landmarks retain their vertices.
radial_centre=np.array([0,.05,.25])
rows,cols=80,160
radii=np.zeros((rows,cols))
for row in range(rows):
    theta=row/(rows-1)*math.pi/2
    for col in range(cols):
        phi=col/cols*math.tau
        direction=Vector((math.cos(theta)*math.cos(phi),math.cos(theta)*math.sin(phi),math.sin(theta)))
        hit,_,_,_=bvh.ray_cast(Vector(radial_centre)+direction*4,-direction)
        radii[row,col]=(hit-Vector(radial_centre)).length
frequency=np.fft.rfftfreq(cols)*cols
radii=np.fft.irfft(np.fft.rfft(radii,axis=1)*np.exp(-.5*(frequency*.18)**2),n=cols,axis=1)
kernel=np.exp(-.5*(np.arange(-15,16)/5.0)**2);kernel/=kernel.sum()
padded=np.pad(radii,((15,15),(0,0)),mode='edge')
radii=sum(padded[i:i+rows]*value for i,value in enumerate(kernel))
relative=coords-radial_centre
length=np.linalg.norm(relative,axis=1)
phi=np.mod(np.arctan2(relative[:,1],relative[:,0]),math.tau)/math.tau*cols
theta=np.clip(np.arcsin(relative[:,2]/length),0,math.pi/2)/(math.pi/2)*(rows-1)
x0=np.floor(phi).astype(int)%cols;y0=np.minimum(np.floor(theta).astype(int),rows-2)
fx=phi-np.floor(phi);fy=theta-y0
target=(radii[y0,x0]*(1-fx)+radii[y0,(x0+1)%cols]*fx)*(1-fy)+(radii[y0+1,x0]*(1-fx)+radii[y0+1,(x0+1)%cols]*fx)*fy
coords+=(relative/length[:,None])*((target-length)[:,None]*weight)
mesh.vertices.foreach_set('co',coords.ravel());mesh.update()
if mesh.has_custom_normals:
    mesh.normals_split_custom_set([(0,0,0)]*len(mesh.loops))
    mesh.update()
print('Clean scalp maximum displacement:',float(np.linalg.norm(coords-original,axis=1).max()),flush=True)
bm=bmesh.new();bm.from_mesh(mesh);bvh=BVHTree.FromBMesh(bm);bm.free()

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

attachment_points=[];unreached=0
for side in [-1,1]:
    phi0=math.pi if side<0 else 0
    ear=Vector((side*1.1475,-.04,.05))
    start=scalp(phi0,.06)
    connector=add_path('Auricular root %s'%side,[nearest(ear.lerp(start,i/24))[0] for i in range(25)],.010,0,1)
    # Space colonisation distributes an organic arbor across the entire scalp.
    # Independent samples avoid row-like patterns in the terminal branches.
    attractors=[]
    for sample in range(1200):
        phi=phi0-math.pi/2+random.random()*math.pi
        minimum=.20 if math.sin(phi)<0 else -.05
        height=math.sin(minimum)+random.random()*(.998-math.sin(minimum))
        attractors.append(scalp(phi,math.asin(height)))
    nodes=[start];parents=[-1];children=[[]]
    for iteration in range(240):
        tree=KDTree(len(nodes))
        for i,co in enumerate(nodes):tree.insert(co,i)
        tree.balance();influence={};remaining=[]
        for target in attractors:
            co,index,distance=tree.find(target)
            if distance<.040:continue
            remaining.append(target)
            if distance<(.38 if iteration<160 else .70):
                influence.setdefault(index,Vector()).__iadd__((target-co).normalized())
        attractors=remaining
        if not attractors:break
        count=0
        for parent,direction in influence.items():
            origin=nodes[parent];_,normal=nearest(origin)
            direction-=normal*direction.dot(normal)
            if direction.length<.0001:continue
            direction.normalize()
            co=nearest(origin+direction*.032)[0]
            if tree.find(co)[2]<.016:continue
            index=len(nodes);nodes.append(co);parents.append(parent);children.append([]);children[parent].append(index);count+=1
        if count==0:break
    unreached+=len(attractors)
    print('Hemisphere',side,'nodes',len(nodes),'remaining targets',len(attractors),flush=True)
    leaves=[1]*len(nodes)
    for i in reversed(range(len(nodes))):
        if children[i]:leaves[i]=sum(leaves[j] for j in children[i])
    radii=[min(.011,.0022*value**.32) for value in leaves]
    def emit_branch(parent,child,start_distance):
        chain=[parent,child]
        while len(children[chain[-1]])==1:chain.append(children[chain[-1]][0])
        end=chain[-1]
        radius=radii[child]
        tip=.18 if not children[end] else min(1,radii[end]/radius)
        path=add_path('Organic neural arbor %s %s'%(side,child),smooth_path([nodes[i] for i in chain]),radius,start_distance,tip)
        for co,distance in zip(path['points'],path['distance']):attachment_points.append((co,distance))
        for next_child in children[end]:emit_branch(end,next_child,path['distance'][-1])
    for child in children[0]:emit_branch(0,child,connector['distance'][-1])

# Longer, tapering collateral arbors make the finest detail legible at site
# scale, rather than leaving every terminal as a short capillary-like stub.
def collateral(start,direction,length,bend):
    points=[start]
    for i in range(1,25):
        _,normal=nearest(points[-1])
        tangent=(direction-normal*direction.dot(normal)).normalized()
        direction=(tangent+normal.cross(tangent)*(bend/24+.025*math.sin(i*.45))).normalized()
        co=nearest(points[-1]+direction*(length/24))[0]
        if co.z<(.55 if co.y<-.3 else .18):break
        points.append(co)
    return points

candidates=[p for p in paths if len(p['points'])>7 and p['distance'][-1]-p['distance'][0]>.13 and p['radius']>.0026]
random.shuffle(candidates)
for number,parent in enumerate(candidates[:150]):
    i=int((len(parent['points'])-1)*random.uniform(.35,.70))
    root=parent['points'][i];tangent=(parent['points'][i+1]-parent['points'][i-1]).normalized()
    _,normal=nearest(root);sign=random.choice([-1,1])
    direction=(tangent*.55+normal.cross(tangent)*sign*.83).normalized()
    points=collateral(root,direction,random.uniform(.16,.28),sign*.55)
    if len(points)<8:continue
    branch=add_path('Fine collateral %s'%number,points,random.uniform(.0028,.0037),parent['distance'][i],.12)
    for fraction in [.46,.72]:
        j=int((len(points)-1)*fraction);root=points[j]
        tangent=(points[j+1]-points[j-1]).normalized();_,normal=nearest(root)
        direction=(tangent*.55-normal.cross(tangent)*sign*.83).normalized()
        twig=collateral(root,direction,random.uniform(.07,.13),-sign*.5)
        if len(twig)>6:add_path('Terminal dendrite %s %.2f'%(number,fraction),twig,.0021,branch['distance'][j],.15)

# Join each retained cervical route to the nearest connected cranial fibre.
tree=KDTree(len(attachment_points))
for i,(co,_) in enumerate(attachment_points):tree.insert(co,i)
tree.balance()
for name,points in neck:
    if points[0].z<points[-1].z:points.reverse()
    points=[nearest(p)[0] for p in points]
    co,index,_=tree.find(points[0])
    join=[nearest(co.lerp(points[0],i/24))[0] for i in range(25)]
    add_path(name,join+points[1:],.0055,attachment_points[index][1],.40)

nerve=bpy.data.materials['Purple neural fibres']
bs=nerve.node_tree.nodes.get('Principled BSDF')
bs.inputs['Base Color'].default_value=(.035,.006,.11,1)
bs.inputs['Emission Color'].default_value=(.11,.012,1,1)
bs.inputs['Emission Strength'].default_value=3
bs.inputs['Roughness'].default_value=.38

# One draw call for the complete neural network. The u coordinate stores
# normalised distance from the ear; v follows the fibre circumference.
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
            uvs.append((.018+path['distance'][i]/max_distance*.94,ring/sides))
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
network['growth']='UV.x is normalised arc length from an auricular root, continuous through every branch junction'
head['web_revision']='continuous-cranial-network-v1'
head['visualization']='Schematic artistic projection, not anatomically exact or measured activity'
for obj in scene.objects:obj.select_set(False)
head.select_set(True);network.select_set(True);bpy.context.view_layer.objects.active=head
bpy.ops.export_scene.gltf(filepath=str(DEST),export_format='GLB',use_selection=True,export_apply=True,
    export_yup=True,export_extras=True,export_texcoords=True,export_image_format='AUTO',
    export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,
    export_draco_position_quantization=16,export_draco_normal_quantization=12,export_draco_texcoord_quantization=16)
triangles=0
for obj in [head,network]:obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'cymba-neural-mannequin-growing.blend'))
report={'webModel':str(DEST),'bytes':DEST.stat().st_size,'paths':len(paths),'triangles':triangles,
        'scalpTargets':2400,'unreachedTargets':unreached,
        'maxPathLength':max_distance,'growthRange':[.018,.958],'coverage':['temples','frontal scalp','crown','occipital scalp','cervical routes'],
        'maxScalpDisplacement':float(np.linalg.norm(coords-original,axis=1).max()),'sourcePreserved':True}
(OUT/'growing-network-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)

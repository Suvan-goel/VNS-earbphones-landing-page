"""Rebuild the supplied earbud's manufactured surfaces around measured source anchors.

Run with Blender --background --python scripts/build-premium-earbuds.py.
The supplied wing is retained; circular parts, shell, tip and sleeve are rebuilt.
No painted illumination or colour-based runtime material masks are required.
"""
import bpy, bmesh, math, json, hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source-assets/earbuds"
OUTPUT = ROOT / "output/earbud-polish-2026-10-31"
OUTPUT.mkdir(parents=True, exist_ok=True)
FRAME = json.loads((SOURCE / "construction-frame.json").read_text())
PARTS = json.loads((SOURCE / "part-frames.json").read_text())
ORIGIN, AXIS, UP, CROSS = (np.array(FRAME[k]) for k in ["origin", "axis", "up", "cross"])
SLEEVE_END = np.array([0.02178, -0.45850, 0.10645])
SLEEVE_AXIS = np.array([0.55, -0.83, 0.06]); SLEEVE_AXIS /= np.linalg.norm(SLEEVE_AXIS)

def srgb(hex_value):
    v = np.array([int(hex_value[i:i+2], 16) / 255 for i in (0, 2, 4)])
    return tuple(np.where(v <= .04045, v / 12.92, ((v + .055) / 1.055) ** 2)) + (1.,)

def material(name, color, roughness, metallic=0, **inputs):
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = srgb(color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    for key, value in inputs.items(): bsdf.inputs[key].default_value = value
    return mat

def mesh(name, positions, faces, mat, parent, role):
    # Construction coordinates match the browser; Blender is Z-up.
    coords = [(float(p[0]), float(-p[2]), float(p[1])) for p in positions]
    data = bpy.data.meshes.new(name); data.from_pydata(coords, [], faces); data.update()
    bm = bmesh.new(); bm.from_mesh(data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.000005)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(data); bm.free()
    obj = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(obj)
    obj.parent = parent; obj.data.materials.append(mat); obj["cymbaPart"] = role
    for face in data.polygons: face.use_smooth = True
    return obj

def smooth_profile(points, steps=5):
    """Centripetal-free cubic interpolation with clamped endpoints for short profiles."""
    points = np.array(points, dtype=float); result = []
    for i in range(len(points)-1):
        a, b, c, d = points[max(0,i-1)], points[i], points[i+1], points[min(len(points)-1,i+2)]
        for j in range(steps):
            t = j / steps
            result.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
    result.append(points[-1]); return result

def revolve(name, profile, mat, parent, role, segments, origin=ORIGIN, axis=AXIS, up=UP, cross=CROSS, oval=1, steps=5):
    rings = smooth_profile(profile, steps); positions = []; faces = []
    for distance, radius in rings:
        for j in range(segments):
            angle=2*math.pi*j/segments
            positions.append(origin + axis*distance + max(0,radius)*(up*math.cos(angle)*oval+cross*math.sin(angle)))
    for i in range(len(rings)-1):
        for j in range(segments):
            a=i*segments+j; b=i*segments+(j+1)%segments
            faces.append((a,b,b+segments,a+segments))
    return mesh(name, positions, faces, mat, parent, role)

def contact(name, key, mat, parent, segments, dimensions=None):
    frame=PARTS[key]; origin=np.array(frame["centre"]); basis=np.array(frame["basis"])
    normal=basis[:,0]; up=basis[:,1]; cross=np.cross(normal,up)
    # Contacts face away from the interior of the housing.
    centre_on_axis=ORIGIN+AXIS*np.dot(origin-ORIGIN,AXIS)
    if np.dot(normal,origin-centre_on_axis)<0: normal=-normal; cross=-cross
    if key != "wing_contact":
        origin, normal = housing_surface(origin, .008)
        up=np.array([0.,1.,0.]);up-=normal*np.dot(up,normal);up/=np.linalg.norm(up)
        cross=np.cross(normal,up)
    else:
        origin += normal*.004
    a,b = dimensions or ((.052,.065) if key=="upper_contact" else (.050,.055))
    return revolve(name,[(-.007,0),(-.007,a*.92),(-.004,a),(.002,a),(.006,a*.94),(.007,0)],mat,parent,"contact",segments,origin,normal,up,cross,b/a,3)

HOUSING_PROFILE=[(.065,.221),(.09,.236),(.14,.258),(.23,.269),(.32,.267),(.40,.246),(.47,.209),(.515,.169),(.528,.154)]

def housing_surface(point, offset=0):
    samples=np.array(smooth_profile(HOUSING_PROFILE,20))
    s=float(np.dot(point-ORIGIN,AXIS));r=float(np.interp(s,samples[:,0],samples[:,1]))
    slope=float((np.interp(s+.003,samples[:,0],samples[:,1])-np.interp(s-.003,samples[:,0],samples[:,1]))/.006)
    radial=point-(ORIGIN+AXIS*s);radial/=np.linalg.norm(radial)
    # Match the housing's slightly compressed vertical section.
    actual_r=r/math.sqrt((np.dot(radial,UP)/.97)**2+np.dot(radial,CROSS)**2)
    normal=radial-AXIS*slope;normal/=np.linalg.norm(normal)
    return ORIGIN+AXIS*s+radial*actual_r+normal*offset,normal

def build(mobile=False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE / "cymba-earbuds-source.glb"))
    original=next(o for o in bpy.data.objects if o.type=="MESH" and " L " in o.name)
    world=Matrix.Rotation(math.pi/2,4,'X')@original.matrix_world
    coords=[world@v.co for v in original.data.vertices]
    lo=Vector(tuple(min(p[i] for p in coords) for i in range(3))); hi=Vector(tuple(max(p[i] for p in coords) for i in range(3)))
    centre=(lo+hi)/2; scale=1/(hi.z-lo.z)
    source=np.array([[(p.x-centre.x)*scale,(p.z-centre.z)*scale,-(p.y-centre.y)*scale] for p in coords])
    # Preserve the original wing contour above its junction with the housing.
    wing_faces=[tuple(f.vertices) for f in original.data.polygons if min(source[i,1] for i in f.vertices)>.14]
    for obj in list(bpy.data.objects): bpy.data.objects.remove(obj,do_unlink=True)
    bronze=material("Cymba · satin graphite bronze","5b4b36",.32,1)
    gold=material("Cymba · satin champagne","baa37e",.27,1)
    cap=material("Cymba · graphite faceplate","161a1c",.31,.08,**{"Coat Weight":.18,"Coat Roughness":.25})
    rubber=material("Cymba · moulded elastomer","191c1e",.58)
    seam=material("Cymba · recessed joints","0e1112",.64)
    tip=material("Cymba · smoke silicone","a2aaa5",.49,**{"IOR":1.41})
    glass=material("Cymba · optical window","182b28",.16,**{"IOR":1.46,"Coat Weight":.3,"Coat Roughness":.12})
    left=bpy.data.objects.new("Earbud_L",None); bpy.context.collection.objects.link(left)
    left["cymbaEarbudVersion"]=2; left["cymbaSide"]="L"
    left["cableOutlet"]=(SLEEVE_END+SLEEVE_AXIS*.014).tolist(); left["cableAxis"]=SLEEVE_AXIS.tolist()
    seg=48 if mobile else 96; steps=2 if mobile else 3
    # The profile follows measured sections of the source housing, with continuous curvature.
    revolve("Housing",HOUSING_PROFILE+[(.528,0)],bronze,left,"housing",seg,oval=.97,steps=steps)
    # Even bezel width and a lightly domed inset cap replace the wavy source rim.
    revolve("Faceplate bezel",[(.011,.177),(.011,.184),(.018,.196),(.038,.210),(.072,.229),(.084,.232),(.092,.229),(.094,.222)],gold,left,"trim",seg,steps=steps)
    revolve("Inset faceplate",[(-.049,0),(-.047,.065),(-.038,.125),(-.020,.167),(-.004,.182),(.008,.183),(.014,.179)],cap,left,"faceplate",seg,steps=steps)
    revolve("Bezel gasket",[(.009,.177),(.010,.181),(.015,.183),(.019,.182)],seam,left,"joint",seg,steps=2)
    # A narrow, stable parting line follows the source's shell division.
    revolve("Shell parting line",[(.269,.2691),(.271,.2695),(.274,.2695),(.276,.2691)],seam,left,"joint",seg,oval=.97,steps=2)
    revolve("Nozzle collar",[(.509,.148),(.520,.156),(.535,.156),(.545,.147),(.546,.133)],gold,left,"trim",seg,steps=steps)
    revolve("Nozzle",[(.529,.135),(.55,.143),(.60,.144),(.65,.129),(.74,.101),(.855,.100),(.858,.087),(.74,.086),(.54,.09)],rubber,left,"nozzle",seg,steps=steps)
    # Closed silicone volume with a rounded lip and an actual inner bore.
    revolve("Silicone tip",[(.658,.127),(.660,.165),(.675,.190),(.710,.207),(.756,.210),(.810,.198),(.860,.174),(.891,.143),(.899,.117),(.892,.104),(.880,.102),(.826,.107),(.761,.117),(.703,.126),(.658,.127)],tip,left,"silicone",seg,steps=steps)
    # Retained wing, welded across atlas seams and gently relaxed without changing its outline.
    wing=mesh("Retention wing",source,wing_faces,rubber,left,"elastomer")
    bm=bmesh.new();bm.from_mesh(wing.data)
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00065)
    bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(wing.data);bm.free()
    bpy.context.view_layer.objects.active=wing; wing.select_set(True)
    smooth=wing.modifiers.new("Moulded surface","SMOOTH"); smooth.factor=.35; smooth.iterations=5
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    decimate=wing.modifiers.new("Delivery topology","DECIMATE"); decimate.ratio=.4 if mobile else .75
    bpy.ops.object.modifier_apply(modifier=decimate.name); wing.select_set(False)
    contact("Upper stimulation contact","upper_contact",gold,left,40 if mobile else 64)
    contact("Lower stimulation contact","lower_contact",gold,left,40 if mobile else 64)
    contact("Wing contact","wing_contact",gold,left,40 if mobile else 64,(.051,.113))
    # The existing central sensor sits between the two stimulation contacts.
    sensor_origin,sensor_normal=housing_surface(np.array([.017,-.009,.229]),.007)
    sensor_up=np.array([0.,1.,0.]);sensor_up-=sensor_normal*np.dot(sensor_up,sensor_normal);sensor_up/=np.linalg.norm(sensor_up)
    sensor_cross=np.cross(sensor_normal,sensor_up)
    # Rounded rectangular window: smooth superellipse, with an inset glass face.
    for name,mat,extent,depth,role in [("Sensor surround",rubber,(.050,.055),.001,"sensor-frame"),("Optical sensor",glass,(.041,.045),.005,"sensor")]:
        positions=[];faces=[];count=40 if mobile else 64
        for height,shrink in [(-.011,.90),(0.,1.),(.004,.94)]:
            for j in range(count):
                t=2*math.pi*j/count;c=math.cos(t);s=math.sin(t)
                positions.append(sensor_origin+sensor_normal*(depth+height)+sensor_up*(math.copysign(abs(c)**.5,c)*extent[1]*shrink)+sensor_cross*(math.copysign(abs(s)**.5,s)*extent[0]*shrink))
        for row in range(2):
            for j in range(count):faces.append((row*count+j,row*count+(j+1)%count,(row+1)*count+(j+1)%count,(row+1)*count+j))
        faces.append(tuple(range(2*count,3*count)))
        mesh(name,positions,faces,mat,left,role)
    # Smooth sleeve with an integral rolled outlet; the bend starts at its anchor.
    sleeve_up=np.array([-SLEEVE_AXIS[1],SLEEVE_AXIS[0],0]);sleeve_up/=np.linalg.norm(sleeve_up)
    sleeve_cross=np.cross(SLEEVE_AXIS,sleeve_up)
    revolve("Cable strain relief",[(-.23,.122),(-.205,.124),(-.16,.114),(-.08,.087),(-.012,.074),(0,.073),(.012,.061),(.018,.039),(.012,.036),(-.01,.036)],rubber,left,"elastomer",seg//2,SLEEVE_END,SLEEVE_AXIS,sleeve_up,sleeve_cross,.90,steps)
    # Mirror the completed master around the original sagittal plane.
    right=bpy.data.objects.new("Earbud_R",None);bpy.context.collection.objects.link(right)
    right["cymbaEarbudVersion"]=2;right["cymbaSide"]="R"
    right["cableOutlet"]=[-left["cableOutlet"][0],left["cableOutlet"][1],left["cableOutlet"][2]]
    right["cableAxis"]=[-SLEEVE_AXIS[0],SLEEVE_AXIS[1],SLEEVE_AXIS[2]]
    for obj in list(left.children):
        copy=obj.copy();copy.data=obj.data.copy();bpy.context.collection.objects.link(copy);copy.parent=right
        bm=bmesh.new();bm.from_mesh(copy.data)
        for v in bm.verts:v.co.x=-v.co.x
        bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(copy.data);bm.free()
    # Save the editable master before adding diagnostic studio objects.
    if not mobile:bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/"cymba-earbuds-premium.blend"))
    # One draw per real material family, preserving separate silicone transmission.
    for parent in [left,right]:
        families={}
        for obj in list(parent.children): families.setdefault(obj.data.materials[0].name,[]).append(obj)
        for objects in families.values():
            bpy.ops.object.select_all(action='DESELECT')
            for obj in objects:obj.select_set(True)
            active=objects[0];bpy.context.view_layer.objects.active=active
            bpy.ops.object.join();active.name=parent.name+"_"+active["cymbaPart"]
    dest=ROOT/"public/models"/("cymba-earbuds-premium-mobile.glb" if mobile else "cymba-earbuds-premium.glb")
    bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',export_yup=True,export_extras=True,export_apply=True,
        export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,
        export_draco_position_quantization=18,export_draco_normal_quantization=14,export_draco_texcoord_quantization=16)
    triangles=sum(len(o.data.polygons) if all(len(p.vertices)==3 for p in o.data.polygons) else sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.data.objects if o.type=='MESH')
    return {"file":str(dest.relative_to(ROOT)),"bytes":dest.stat().st_size,"sha256":hashlib.sha256(dest.read_bytes()).hexdigest(),"triangles":triangles,"meshes":len(left.children)+len(right.children),"materials":7}

reports=[build(False),build(True)]
(OUTPUT/"model-build-report.json").write_text(json.dumps(reports,indent=2))
print("EARBUD_BUILD="+json.dumps(reports))

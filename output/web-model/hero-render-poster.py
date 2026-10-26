import bpy, bmesh, json, math, hashlib
# Blender previews are for modelling review. Export the website's loading
# poster from /dev/hero-poster so it shares the live renderer and lighting.
from pathlib import Path
from mathutils import Vector, Matrix, Euler

root=Path('/Users/suvangoel/VNS-earbuds-site')
out=root/'output/web-model'
asset=json.loads((out/'hero-asset-report.json').read_text())
source_paths=[root/'output/meshy-earbud-blender/cymba-wired-assembly.blend',root/'public/models/cymba-earbuds-hero.glb']
source_hashes={str(path):hashlib.sha256(path.read_bytes()).hexdigest() for path in source_paths}
bpy.ops.wm.open_mainfile(filepath=str(root/'output/meshy-earbud-blender/cymba-wired-assembly.blend'))
scene=bpy.context.scene
for ob in scene.objects:
    ob.hide_render=ob.type not in {'LIGHT','CAMERA'}
for world in bpy.data.worlds:
    if world.use_nodes:
        world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.35

specs=[('L','Left',(-.60,.04,0)),('R','Right',(.60,.78,-.05))]

for side,label,hero_pos in specs:
    entry=next(e for e in asset['entries'] if ' · '+side+' · ' in e['name'])
    bud=bpy.data.objects[entry['name']]
    wire=bpy.data.objects[label+' earbud · editable wire']
    center=Vector(entry['frontCenterMetres'])*1000
    height=entry['frontSizeMetres'][1]*1000
    wire_start=wire.matrix_world@wire.data.splines[0].bezier_points[0].co
    wire_next=wire.matrix_world@wire.data.splines[0].bezier_points[1].co
    start=(wire_start-center)/height
    tangent=(wire_next-wire_start).normalized()
    entry['cableStartNormalized']=list(start)
    entry['cableDirectionFront']=list(tangent)
    entry['heroPosition']=list(hero_pos)
    entry['heroScale']=.79
    sign=-1 if side=='L' else 1
    rotation=Euler((-.06,sign*-.30,sign*.09),'XYZ').to_matrix().to_4x4()
    # Work only on a render-session mesh copy; leave the source blend and GLB unchanged.
    bud.data=bud.data.copy()
    # Match the live smooth finish without changing the original colour maps.
    for slot in bud.material_slots:
        if not slot.material:continue
        slot.material=slot.material.copy()
        for node in slot.material.node_tree.nodes:
            if node.type=='BSDF_PRINCIPLED':
                for link in list(node.inputs['Normal'].links):slot.material.node_tree.links.remove(link)
    normalization=Matrix.Scale(1/height,4)@Matrix.Translation(-center)@bud.matrix_world
    bud.data.transform(normalization)
    sleeve_sign=1 if side=='L' else -1
    sleeve_end=Vector((sleeve_sign*.02178,-.45850,.10645))
    sleeve_axis=Vector((sleeve_sign*.55,-.83,.06)).normalized()
    bm=bmesh.new();bm.from_mesh(bud.data)
    lower=[v for v in bm.verts if v.co.y<-.30]
    lower_edges=[e for e in bm.edges if all(v.co.y<-.30 for v in e.verts)]
    lower_faces=[f for f in bm.faces if all(v.co.y<-.30 for v in f.verts)]
    bmesh.ops.bisect_plane(bm,geom=lower+lower_edges+lower_faces,dist=1e-7,
        plane_co=sleeve_end,plane_no=sleeve_axis,clear_inner=False,clear_outer=True)
    bm.to_mesh(bud.data);bm.free();bud.data.update()
    hero_transform=Matrix.Translation(Vector(hero_pos))@rotation@Matrix.Scale(.79,4)
    bud.matrix_world=hero_transform
    bud.hide_render=False
    # Flush rolled rim on the measured, slanted sleeve end.
    profile=[[-.007,.015],[0,0],[.005,.03],[.010,.10],[.015,.24],[.018,.52],[.018,.84],[.014,1],[.004,1]]
    contour=[(sleeve_sign*u,v) for u,v in json.loads((root/'src/components/three/earbudSleeveRim.json').read_text())['samples']]
    contour.sort(key=lambda p:math.atan2(p[1],p[0]))
    def bezier(points,t):
        a,b,c,d=points;u=1-t
        return a*(u*u*u)+b*(3*u*u*t)+c*(3*u*t*t)+d*(t*t*t)
    rows,sides=len(profile)-1,len(contour);vertices=[];faces=[]
    outlet=sleeve_end+sleeve_axis*.014;exit_axis=sleeve_axis
    normal=Vector((-sleeve_axis.y,sleeve_axis.x,0)).normalized()
    binormal=sleeve_axis.cross(normal).normalized()
    for row,(distance,blend) in enumerate(profile):
        centre=sleeve_end+sleeve_axis*distance
        for col in range(sides):
            u,v=contour[col];outer_radius=math.hypot(u,v)
            ratio=(outer_radius*(1-blend)+.0363*blend)/outer_radius
            vertices.append(tuple(centre+normal*(u*ratio)+binormal*(v*ratio)))
            if row<rows:
                a=row*sides+col;b=a+sides;c=row*sides+(col+1)%sides;d=c+sides
                faces.extend([(a,c,b),(c,d,b)])
    sleeve_mesh=bpy.data.meshes.new('Hero '+label+' smooth sleeve')
    sleeve_mesh.from_pydata(vertices,[],faces);sleeve_mesh.update()
    for polygon in sleeve_mesh.polygons:polygon.use_smooth=True
    sleeve=bpy.data.objects.new(sleeve_mesh.name,sleeve_mesh);scene.collection.objects.link(sleeve)
    sleeve.matrix_world=hero_transform
    sleeve_material=bpy.data.materials.new('Hero '+label+' moulded rubber');sleeve_material.use_nodes=True
    principled=sleeve_material.node_tree.nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value=(.009134,.01033,.01161,1)
    principled.inputs['Roughness'].default_value=.48;principled.inputs['Metallic'].default_value=.02
    sleeve_mesh.materials.append(sleeve_material)
    normalized_start=outlet-exit_axis*.006
    start=hero_transform@normalized_start
    tangent=rotation.to_3x3()@exit_axis
    hero_scale=.79
    horizontal=Vector((tangent.x,0,tangent.z))
    angle=math.atan2(horizontal.length,-tangent.y)
    bend_radius=.24*hero_scale
    settled=start+horizontal.normalized()*(bend_radius*(1-math.cos(angle)))+Vector((0,-bend_radius*math.sin(angle),0))
    handle=4/3*math.tan(angle/4)*bend_radius
    end=settled+Vector((0,-2.08,0))
    bend=[start,start+tangent*handle,settled+Vector((0,handle,0)),settled]
    bend_length=sum((bezier(bend,i/1024)-bezier(bend,(i-1)/1024)).length for i in range(1,1025))
    total_length=bend_length+2.08
    entry['presentationConnection']={
      'trimRegionBelowNormalizedY':-.30,'sleeveEndNormalized':list(sleeve_end),'trimOutwardNormal':list(sleeve_axis),
      'outletNormalized':list(outlet),'outletDirectionNormalized':list(exit_axis),
      'roundedRimProfile':profile,'rimContourSource':'src/components/three/earbudSleeveRim.json','innerRadiusNormalized':.0363,'bendRadiusNormalized':.24,
      'cableStartNormalized':list(normalized_start),'cableDirectionNormalized':list(exit_axis),
      'cableRadiusNormalized':.036,'sleeveRadiusProfile':profile,'sceneOnly':True,
      'heroBendControlPoints':[list(point) for point in bend],'heroCableLength':total_length,
      'originalGeometryAndTextureBytesUnchanged':True,
    }
    data=bpy.data.curves.new('Hero '+label+' trailing cable','CURVE')
    data.dimensions='3D';data.resolution_u=48;data.bevel_depth=.036*.79;data.bevel_resolution=6
    spline=data.splines.new('BEZIER');spline.bezier_points.add(2)
    for p,co in zip(spline.bezier_points,[start,settled,end]):
        p.co=co;p.handle_left_type='FREE';p.handle_right_type='FREE'
    first,middle,last=spline.bezier_points
    first.handle_left=start-tangent*handle;first.handle_right=bend[1]
    middle.handle_left=bend[2];middle.handle_right=settled+Vector((0,-.5,0))
    last.handle_left=end+Vector((0,.5,0));last.handle_right=end+Vector((0,-.1,0))
    ob=bpy.data.objects.new(data.name,data);scene.collection.objects.link(ob)
    material=bpy.data.materials.new('Hero '+label+' cable fade');material.use_nodes=True
    nodes=material.node_tree.nodes;links=material.node_tree.links;nodes.clear()
    output=nodes.new('ShaderNodeOutputMaterial');mix=nodes.new('ShaderNodeMixShader')
    transparent=nodes.new('ShaderNodeBsdfTransparent');rubber=nodes.new('ShaderNodeBsdfPrincipled')
    rubber.inputs['Base Color'].default_value=(.009134,.01033,.01161,1);rubber.inputs['Roughness'].default_value=.37;rubber.inputs['Metallic'].default_value=.1
    geo=nodes.new('ShaderNodeNewGeometry');separate=nodes.new('ShaderNodeSeparateXYZ');ramp=nodes.new('ShaderNodeMapRange')
    ramp.clamp=True;ramp.interpolation_type='SMOOTHSTEP';ramp.inputs['From Min'].default_value=settled.y+bend_length-.98*total_length;ramp.inputs['From Max'].default_value=settled.y+bend_length-.42*total_length
    ramp.inputs['To Min'].default_value=0;ramp.inputs['To Max'].default_value=1
    links.new(geo.outputs['Position'],separate.inputs[0]);links.new(separate.outputs['Y'],ramp.inputs['Value'])
    links.new(ramp.outputs['Result'],mix.inputs[0]);links.new(transparent.outputs[0],mix.inputs[1]);links.new(rubber.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],output.inputs[0])
    data.materials.append(material)

# Lighting moves into the normalized scene; the source file remains untouched.
for ob in list(scene.objects):
    if ob.type=='LIGHT':ob.hide_render=True
def area(name,location,power,size,color):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=location
    ob.rotation_euler=(Vector((0,0,0))-ob.location).to_track_quat('-Z','Y').to_euler()
area('Hero broad key',(-3,4,6),650,5,(1,.91,.81))
area('Hero soft fill',(4,1,4),400,4,(.81,.9,1))
area('Hero bronze rim',(1,3,-2),500,3,(1,.77,.52))
cam=bpy.data.objects['Camera · reference layout'];cam.data.type='PERSP';cam.location=(0,-.2,4.7/(2*math.tan(math.radians(14))))
cam.rotation_euler=(0,0,0);cam.data.sensor_fit='VERTICAL'
cam.data.lens=cam.data.sensor_height/(2*math.tan(math.radians(28)/2))
cam.data.shift_x=0;cam.data.shift_y=0
cam.data.clip_start=.01;cam.data.clip_end=100
scene.camera=cam;scene.render.film_transparent=True
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=1200;scene.render.resolution_y=1344;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.render.filepath=str(out/'hero-poster-transparent.png')
scene.render.use_border=False
scene.render.use_crop_to_border=False
scene.render.pixel_aspect_x=1;scene.render.pixel_aspect_y=1
asset['blenderPreview']={'path':str(out/'hero-poster-transparent.png'),'resolution':[1200,1344],'cameraPosition':list(cam.location),'cameraVerticalFovDegrees':28,'transparent':True}
asset['presentationConnection']={'sceneOnlyTrimAndSleeve':True,'originalSourceFilesUnchanged':True,'sourceSHA256':source_hashes}
asset['activeHeroModel']='/models/cymba-earbuds-hero.glb'
asset['presentationFinish']={'originalColourAndReflectivityMaps':True,'scratchNormalMapEnabled':False,'sourceTextureBytesUnchanged':True}
(out/'hero-asset-report.json').write_text(json.dumps(asset,indent=2))
print('HERO_PRESENTATION_CONNECTIONS='+json.dumps([{'name':e['name'],**e['presentationConnection']} for e in asset['entries']]),flush=True)
bpy.ops.render.render(write_still=True)
assert all(hashlib.sha256(Path(path).read_bytes()).hexdigest()==value for path,value in source_hashes.items()),'A source asset changed during rendering.'
print('SOURCE_ASSETS_UNCHANGED=True',flush=True)

# Optional enlarged, orthographic inspection of the actual textured join.
import sys
if '--closeups' in sys.argv:
    for ob in scene.objects:
        if ob.type=='MESH' and ('Right' in ob.name or ' · R · ' in ob.name):ob.hide_render=True
        if ob.type=='CURVE' and 'Right' in ob.name:ob.hide_render=True
    left_entry=asset['entries'][0]
    left_rot=Euler((-.06,.30,-.09),'XYZ').to_matrix().to_4x4()
    left_transform=Matrix.Translation(Vector((-.60,.04,0)))@left_rot@Matrix.Scale(.79,4)
    focus=left_transform@Vector((.025,-.46,.106))
    cam.data.type='ORTHO';cam.data.ortho_scale=.46
    scene.render.resolution_x=800;scene.render.resolution_y=800
    for label,direction in [('front',(0,0,2)),('side',(2,0,.25)),('under',(.7,-1.2,1.3))]:
        cam.location=focus+Vector(direction)
        cam.rotation_euler=(focus-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(out/f'seated-connection-{label}.png')
        bpy.ops.render.render(write_still=True)

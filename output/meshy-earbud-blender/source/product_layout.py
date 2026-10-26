"""Reposition accepted components and reshape only the four editable cables."""
import bpy, math, hashlib, array
from mathutils import Vector, Matrix

WIRE_NAMES = ['Left earbud · editable wire', 'Right earbud · editable wire',
              'Junction to controller · editable wire',
              'Controller to USB-C · continuous coiled lead']

def products():
    return [o for c in bpy.data.collections if c.name.startswith(('01','02','03','04')) for o in c.objects]

def fingerprint(obj):
    h=hashlib.sha256()
    if obj.type=='MESH':
        for seq, attr, n, typ in [(obj.data.vertices,'co',3,'f'),(obj.data.loops,'vertex_index',1,'i'),(obj.data.polygons,'material_index',1,'i')]:
            values=array.array(typ,[0])*(len(seq)*n);seq.foreach_get(attr,values);h.update(values.tobytes())
        for layer in obj.data.uv_layers:
            values=array.array('f',[0])*(len(layer.data)*2);layer.data.foreach_get('uv',values);h.update(values.tobytes())
    elif obj.type=='FONT':
        h.update(repr((obj.data.body,obj.data.size,obj.data.extrude,obj.data.offset)).encode())
    elif obj.type=='CURVE':
        for sp in obj.data.splines:
            for p in sp.bezier_points:
                h.update(repr((tuple(p.co),tuple(p.handle_left),tuple(p.handle_right),p.radius)).encode())
    h.update(repr([m.name for m in obj.data.materials]).encode())
    return h.hexdigest()

def center_xy(obj):
    bb=[obj.matrix_world@Vector(c) for c in obj.bound_box]
    return Vector(((min(v.x for v in bb)+max(v.x for v in bb))/2,
                   (min(v.y for v in bb)+max(v.y for v in bb))/2,0))

def shift(obj,delta):
    obj.matrix_world=Matrix.Translation(delta)@obj.matrix_world

def world_points(obj):
    return [obj.matrix_world@p.co for p in obj.data.splines[0].bezier_points]

def reroute(obj,points,radii=None):
    inv=obj.matrix_world.inverted()
    obj.data.splines.clear()
    sp=obj.data.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
    for i,(p,pos) in enumerate(zip(sp.bezier_points,points)):
        p.co=inv@Vector(pos);p.handle_left_type='AUTO';p.handle_right_type='AUTO'
        p.radius=radii[i] if radii else 1
    return sp.bezier_points

def tangent(obj,p,direction,before,after):
    inv=obj.matrix_world.inverted();co=obj.matrix_world@p.co;d=Vector(direction).normalized()
    p.handle_left_type='FREE';p.handle_right_type='FREE'
    p.handle_left=inv@(co-d*before);p.handle_right=inv@(co+d*after)

def apply_layout():
    scene=bpy.context.scene
    if scene.get('product_layout_revision')==1:
        return {'already_applied':True}
    obs=products();rigid=[o for o in obs if o.name not in WIRE_NAMES]
    before={o.name:fingerprint(o) for o in rigid}
    rotations={o.name:o.matrix_world.to_3x3().copy() for o in rigid}
    widths={n:bpy.data.objects[n].data.bevel_depth for n in WIRE_NAMES}
    ctrl=[o for o in obs if o.name.startswith('Controller ·')]
    ctrl_delta=Vector((0,-29,0))-center_xy(bpy.data.objects['Controller · lower housing'])
    trunk=bpy.data.objects[WIRE_NAMES[2]];lead=bpy.data.objects[WIRE_NAMES[3]]
    trunk_old=world_points(trunk);lead_old=world_points(lead)
    for o in ctrl: shift(o,ctrl_delta)
    y_delta=Vector((.25,0,0))
    for o in obs:
        if o.name.startswith('Y-junction ·'): shift(o,y_delta)
    for side,sign,name in [('L',-1,'Left'),('R',1,'Right')]:
        bud=next(o for o in obs if o.name.startswith('Earbud · '+side))
        delta=Vector((sign*27,51,bud.matrix_world.translation.z))-bud.matrix_world.translation
        wire=bpy.data.objects[name+' earbud · editable wire']
        old=world_points(wire);oldbp=wire.data.splines[0].bezier_points
        neck_handles=[wire.matrix_world@oldbp[0].handle_left+delta,wire.matrix_world@oldbp[0].handle_right+delta]
        shift(bud,delta)
        points=[old[0]+delta,old[1]+delta,(sign*28,43,6.2),(sign*34.5,33,1.4),
                (sign*36,23,1.05),(sign*29,14,1.05),(sign*15.5,10,1.45),
                (sign*7,6.5,3.05),old[-1]+y_delta]
        bp=reroute(wire,points,[2.4,1.05,1,1,1,1,1,1,1])
        bp[0].handle_left_type='FREE';bp[0].handle_right_type='FREE'
        bp[0].handle_left=wire.matrix_world.inverted()@neck_handles[0]
        bp[0].handle_right=wire.matrix_world.inverted()@neck_handles[1]
        tangent(wire,bp[-1],(-sign*.52,-.85,0),2,1)
    trunk_points=[trunk_old[0]+y_delta,(0,-9,2.05),(-8,-13,1.15),(-27,-15,1.05),
                  (-41,-19,1.05),(-44,-24,1.15),(-40,-28,1.7),trunk_old[-1]+ctrl_delta]
    bp=reroute(trunk,trunk_points)
    tangent(trunk,bp[0],(0,-1,-.12),.7,1.5)
    tangent(trunk,bp[-1],(1,0,0),3,1)
    usb=[o for o in obs if o.name.startswith('USB-C ·')]
    body=bpy.data.objects['USB-C · black connector body']
    usb_delta=Vector((-5,-73,0))-center_xy(body)
    for o in usb: shift(o,usb_delta)
    # A loose three-pass oval keeps each cable turn individually readable.
    cx,cy=32,-55
    coil=[lead_old[0]+ctrl_delta,(45,-28,2.3),(54,-35,1.3),(55,-45,1.1),(54,-55,1.1)]
    for i in range(1,85):
        t=i/84;angle=-2*math.pi*2.20*t
        rx=22-5.1*t;ry=15-5.1*t
        z=1.1+2.6*max(0,(t-.88)/.12)**2
        coil.append((cx+rx*math.cos(angle),cy+ry*math.sin(angle),z))
    coil.extend([(21,-71,3.7),(11,-73,3.7),lead_old[-1]+usb_delta])
    bp=reroute(lead,coil)
    tangent(lead,bp[0],(1,.14,0),1,3)
    tangent(lead,bp[-4],(-1,-.2,0),.65,4.5)
    tangent(lead,bp[-1],(-1,0,0),2,1)
    # The existing keeper fits over the three passes at the right-hand tangent.
    keeper=bpy.data.objects['Cable keeper · soft wrap band']
    shift(keeper,Vector((51.7,-55,0))-center_xy(keeper))
    bpy.context.view_layer.update()
    assert {o.name:fingerprint(o) for o in rigid}==before, 'Component geometry changed'
    for o in rigid:
        assert all(abs(o.matrix_world.to_3x3()[i][j]-rotations[o.name][i][j])<1e-6 for i in range(3) for j in range(3)),o.name
    assert all(bpy.data.objects[n].data.bevel_depth==v for n,v in widths.items())
    assert len(obs)==29
    scene['product_layout_revision']=1
    scene['product_layout_note']='Centered controller, balanced buds, smooth branch loops, compact oval USB lead. All accepted component geometry and orientations preserved.'
    cam=bpy.data.objects['Camera · reference layout'];cam.location=(4,-1,310);cam.rotation_euler=(0,0,0);cam.data.ortho_scale=175
    scene.camera=cam;scene.render.resolution_x=1400;scene.render.resolution_y=1750;scene.render.resolution_percentage=100
    return {'layout_revision':1,'unchanged_component_count':len(rigid),'unchanged_geometry_and_materials':True,
            'unchanged_component_rotations_and_scales':True,'unchanged_wire_diameters':True,
            'controller_center_mm':[0,-29],'earbud_origins_xy_mm':[[-27,51],[27,51]],
            'coil_center_mm':[cx,cy],'component_fingerprints':before}

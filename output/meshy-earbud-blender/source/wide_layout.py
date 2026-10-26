"""Landscape 16:9 product arrangement, preserving the accepted components."""
import bpy,math
from mathutils import Vector,Matrix
from product_layout import products,fingerprint,center_xy,shift,world_points,reroute,tangent,WIRE_NAMES

def apply_wide_layout():
    scene=bpy.context.scene
    if scene.get('product_layout_revision')==2:
        return {'already_applied':True}
    obs=products();rigid=[o for o in obs if o.name not in WIRE_NAMES]
    before={o.name:fingerprint(o) for o in rigid}
    matrices={o.name:o.matrix_world.copy() for o in rigid}
    widths={n:bpy.data.objects[n].data.bevel_depth for n in WIRE_NAMES}
    original_lengths={n:bpy.data.objects[n].data.splines[0].calc_length(resolution=64) for n in WIRE_NAMES}
    trunk=bpy.data.objects[WIRE_NAMES[2]];lead=bpy.data.objects[WIRE_NAMES[3]]
    trunk_old=world_points(trunk);lead_old=world_points(lead)
    old_ctrl=center_xy(bpy.data.objects['Controller · lower housing'])
    ctrl_center=Vector((16,11,0))
    ctrl_transform=Matrix.Translation(ctrl_center)@Matrix.Rotation(math.pi/2,4,'Z')@Matrix.Translation(-old_ctrl)
    for o in obs:
        if o.name.startswith('Controller ·'): o.matrix_world=ctrl_transform@o.matrix_world
    # Preserve the original Y housing and the exact existing cable-to-housing overlaps.
    y_delta=Vector((-46,-25,0))
    for o in obs:
        if o.name.startswith('Y-junction ·'): shift(o,y_delta)
    for side,sign,name in [('L',-1,'Left'),('R',1,'Right')]:
        bud=next(o for o in obs if o.name.startswith('Earbud · '+side))
        delta=Vector((-46+sign*22,28,bud.matrix_world.translation.z))-bud.matrix_world.translation
        wire=bpy.data.objects[name+' earbud · editable wire']
        old=world_points(wire);oldbp=wire.data.splines[0].bezier_points
        neck_handles=[wire.matrix_world@oldbp[0].handle_left+delta,wire.matrix_world@oldbp[0].handle_right+delta]
        shift(bud,delta)
        points=[old[0]+delta,old[1]+delta,(-46+sign*23,20,6.2),
                (-46+sign*30,8,1.4),(-46+sign*34,-4,1.05),
                (-46+sign*29,-14,1.05),(-46+sign*16,-18.5,1.45),
                (-46+sign*7,-20,3.05),old[-1]+y_delta]
        bp=reroute(wire,points,[2.4,1.05,1,1,1,1,1,1,1])
        bp[0].handle_left_type='FREE';bp[0].handle_right_type='FREE'
        bp[0].handle_left=wire.matrix_world.inverted()@neck_handles[0]
        bp[0].handle_right=wire.matrix_world.inverted()@neck_handles[1]
        tangent(wire,bp[-1],(-sign*.52,-.85,0),2,1)
    points=[trunk_old[0]+y_delta,(-46,-35,2.05),(-39,-42,1.1),
            (-20,-44,1.05),(2,-41,1.05),(13,-34,1.55),ctrl_transform@trunk_old[-1]]
    bp=reroute(trunk,points)
    tangent(trunk,bp[0],(0,-1,-.12),.7,1.5)
    tangent(trunk,bp[-1],(0,1,0),4,1)
    body=bpy.data.objects['USB-C · black connector body']
    usb_delta=Vector((40,-40,0))-center_xy(body)
    for o in obs:
        if o.name.startswith('USB-C ·'): shift(o,usb_delta)
    cx,cy=64,-6
    points=[ctrl_transform@lead_old[0],(15,50,2.3),(24,56,1.2),
            (43,54,1.1),(67,40,1.1),(85,20,1.1),(88,-6,1.1)]
    for i in range(1,85):
        t=i/84;angle=-2*math.pi*2.2*t
        rx=24-5.1*t;ry=20-5.1*t
        z=1.1+2.6*max(0,(t-.88)/.12)**2
        points.append((cx+rx*math.cos(angle),cy+ry*math.sin(angle),z))
    points.append(lead_old[-1]+usb_delta)
    bp=reroute(lead,points)
    tangent(lead,bp[0],(-.14,1,0),1,3)
    tangent(lead,bp[-2],(-1,-.25,0),.65,8.0)
    tangent(lead,bp[-1],(-1,0,0),8.5,1)
    keeper=bpy.data.objects['Cable keeper · soft wrap band']
    shift(keeper,Vector((85.7,-6,0))-center_xy(keeper))
    bpy.context.view_layer.update()
    assert {o.name:fingerprint(o) for o in rigid}==before,'Component geometry changed'
    for o in rigid:
        expected=(ctrl_transform@matrices[o.name]).to_3x3() if o.name.startswith('Controller ·') else matrices[o.name].to_3x3()
        assert all(abs(o.matrix_world.to_3x3()[i][j]-expected[i][j])<1e-5 for i in range(3) for j in range(3)),o.name
    assert all(bpy.data.objects[n].data.bevel_depth==v for n,v in widths.items())
    assert len(obs)==29
    cam=bpy.data.objects['Camera · reference layout']
    cam.location=(3,6,310);cam.rotation_euler=(0,0,0);cam.data.ortho_scale=208
    scene.camera=cam;scene.render.resolution_x=1920;scene.render.resolution_y=1080;scene.render.resolution_percentage=100
    scene.render.pixel_aspect_x=1;scene.render.pixel_aspect_y=1
    perspective=bpy.data.objects['Camera · three-quarter']
    perspective.location=(3,-88,310)
    perspective.rotation_euler=(Vector((3,6,3))-perspective.location).to_track_quat('-Z','Y').to_euler()
    perspective.data.ortho_scale=208
    scene['product_layout_revision']=2
    scene['product_layout_note']='16:9 landscape: paired earbuds left, vertical controller beside them, smooth cables to Y and USB coil right.'
    return {'layout_revision':2,'render_resolution':[1920,1080],'aspect_ratio':'16:9',
            'unchanged_component_count':len(rigid),'unchanged_geometry_and_materials':True,
            'unchanged_earbud_rotations_and_all_scales':True,'controller_rotation_delta_degrees':90,
            'unchanged_wire_diameters':True,'controller_center_mm':[16,11],
            'earbud_origins_xy_mm':[[-68,28],[-24,28]],'coil_center_mm':[cx,cy],
            'cable_lengths_before_mm':original_lengths,
            'cable_lengths_after_mm':{n:bpy.data.objects[n].data.splines[0].calc_length(resolution=64) for n in WIRE_NAMES},
            'component_fingerprints':before}

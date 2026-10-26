"""Refine only the long middle cable and reposition its existing keeper."""
import bpy, math
from mathutils import Vector, Matrix
from product_layout import products, fingerprint, center_xy, shift, world_points, reroute, tangent, WIRE_NAMES

def apply_refinement():
    scene=bpy.context.scene
    if scene.get('product_layout_revision')==4: return {'already_applied':True}
    assert scene.get('product_layout_revision')==3
    obs=products();trunk=bpy.data.objects[WIRE_NAMES[2]]
    unchanged=[o for o in obs if o!=trunk]
    before={o.name:fingerprint(o) for o in unchanged}
    matrices={o.name:o.matrix_world.copy() for o in unchanged}
    old=world_points(trunk);diameter=2*trunk.data.bevel_depth
    old_length=trunk.data.splines[0].calc_length(resolution=64)
    # Lift the ellipse into the middle of the arrangement. Analytic tangents
    # keep the two passes even instead of letting automatic handles flatten it.
    cx,cy=34,4
    points=[old[0],(-34,-42,1.1),(-9,-40,1.1),(15,-29,1.1),(cx,cy-29,1.1)]
    start=len(points)-1;steps=96
    for i in range(1,steps+1):
        t=i/steps;a=-math.pi/2+4*math.pi*t
        rx=23-4.8*t;ry=29-4.8*t
        lift=max(0,(t-.91)/.09)
        z=1.1+2.3*(3*lift*lift-2*lift*lift*lift)
        points.append((cx+rx*math.cos(a),cy+ry*math.sin(a),z))
    end=len(points)-1
    points.extend([(52,-24,3.4),(75,-37,1.1),old[-1]])
    bp=reroute(trunk,points)
    tangent(trunk,bp[0],(0,-1,-.1),.8,7.0)
    tangent(trunk,bp[1],(1,0,0),9,9)
    tangent(trunk,bp[2],(1,.22,0),8,8)
    tangent(trunk,bp[3],(1,.38,0),7,7)
    for j in range(steps+1):
        t=j/steps;a=-math.pi/2+4*math.pi*t
        rx=23-4.8*t;ry=29-4.8*t
        v=Vector((-4.8*math.cos(a)-rx*4*math.pi*math.sin(a),
                  -4.8*math.sin(a)+ry*4*math.pi*math.cos(a),0))
        if .91<t<1:
            u=(t-.91)/.09;v.z=2.3*(6*u-6*u*u)/.09
        h=v.length/(3*steps)
        tangent(trunk,bp[start+j],v,h,h)
    tangent(trunk,bp[start],(1,0,0),7,1.0)
    tangent(trunk,bp[end],(1,0,0),.8,5.5)
    tangent(trunk,bp[end+1],(1,-.45,0),6,7)
    tangent(trunk,bp[end+2],(1,0,0),10,11)
    tangent(trunk,bp[-1],(0,1,0),10,1)
    keeper=bpy.data.objects['Cable keeper · soft wrap band']
    keeper_center=Vector((cx+21.5/math.sqrt(2),cy-27.5/math.sqrt(2),0))
    keeper_angle=math.atan2(27.5,21.5)
    keeper.matrix_world=(Matrix.Translation(keeper_center)
                         @Matrix.Rotation(keeper_angle-math.pi/2,4,'Z')
                         @Matrix.Translation(-center_xy(keeper))@keeper.matrix_world)
    bpy.context.view_layer.update()
    assert {o.name:fingerprint(o) for o in unchanged}==before
    for o in unchanged:
        if o!=keeper:
            assert all(abs(o.matrix_world[i][j]-matrices[o.name][i][j])<1e-6 for i in range(4) for j in range(4)),o.name
    assert trunk.data.bevel_depth*2==diameter
    assert (world_points(trunk)[0]-old[0]).length<1e-6
    assert (world_points(trunk)[-1]-old[-1]).length<1e-6
    new_length=trunk.data.splines[0].calc_length(resolution=64)
    assert new_length>400
    scene['product_layout_revision']=4
    scene['product_layout_note']='Refined vertical oval coil with evenly spaced passes and smooth balanced cable tails; short USB lead unchanged.'
    trunk['cable_role']='Long Y-to-module cable, refined oval presentation coil'
    return {'layout_revision':4,'unchanged_components_and_materials':True,
            'only_middle_cable_and_keeper_placement_changed':True,
            'short_usb_lead_unchanged':True,'unchanged_wire_diameter':True,
            'unchanged_connector_attachment_points':True,
            'middle_cable_length_before_mm':old_length,'middle_cable_length_after_mm':new_length,
            'coil_center_mm':[cx,cy],'component_fingerprints':before}

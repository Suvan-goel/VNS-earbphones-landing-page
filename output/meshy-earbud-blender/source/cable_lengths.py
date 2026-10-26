"""Long Y-to-module cable and short USB tail; preserve accepted components."""
import bpy, math
from mathutils import Vector
from product_layout import products, fingerprint, center_xy, shift, world_points, reroute, tangent, WIRE_NAMES

def apply_cable_lengths():
    scene=bpy.context.scene
    if scene.get('product_layout_revision')==3:
        return {'already_applied':True}
    assert scene.get('product_layout_revision')==2
    obs=products()
    unchanged=[o for o in obs if o.name not in WIRE_NAMES[2:]]
    before={o.name:fingerprint(o) for o in unchanged}
    matrices={o.name:o.matrix_world.copy() for o in unchanged}
    widths={n:bpy.data.objects[n].data.bevel_depth for n in WIRE_NAMES}
    lengths_before={n:bpy.data.objects[n].data.splines[0].calc_length(resolution=64) for n in WIRE_NAMES}
    trunk=bpy.data.objects[WIRE_NAMES[2]];lead=bpy.data.objects[WIRE_NAMES[3]]
    old_trunk=world_points(trunk);old_lead=world_points(lead)
    ctrl_delta=Vector((100,11,0))-center_xy(bpy.data.objects['Controller · lower housing'])
    usb_delta=Vector((72,48,0))-center_xy(bpy.data.objects['USB-C · black connector body'])
    for o in obs:
        if o.name.startswith('Controller ·'): shift(o,ctrl_delta)
        elif o.name.startswith('USB-C ·'): shift(o,usb_delta)

    # The extra cable forms a two-turn oval between the earbuds and module.
    cx,cy=34,-6
    points=[old_trunk[0],(-45,-35,2.0),(-38,-43,1.1),(-16,-45,1.1),(8,-35,1.1),(34,-27,1.1)]
    coil_start=len(points)-1
    for i in range(1,81):
        t=i/80;angle=-math.pi/2+4*math.pi*t
        rx=25-5*t;ry=21-5*t
        lift=max(0,(t-.90)/.10)
        z=1.1+2.6*(3*lift*lift-2*lift*lift*lift)
        points.append((cx+rx*math.cos(angle),cy+ry*math.sin(angle),z))
    coil_end=len(points)-1
    points.extend([(49,-24,3.7),(66,-35,2.8),(87,-34,1.5),(97,-29,2.3),old_trunk[-1]+ctrl_delta])
    bp=reroute(trunk,points)
    tangent(trunk,bp[0],(0,-1,-.12),.7,2)
    tangent(trunk,bp[coil_start],(1,0,0),8,1.30)
    tangent(trunk,bp[coil_end],(1,0,0),1.05,5)
    tangent(trunk,bp[-1],(0,1,0),3.5,1)
    trunk['cable_role']='Long cable from Y connector to signal module, arranged in a two-turn coil'

    # Preserve the exact socket overlaps while bringing the USB plug close.
    bp=reroute(lead,[old_lead[0]+ctrl_delta,(95,54,3.5),old_lead[-1]+usb_delta])
    tangent(lead,bp[0],(-.14,1,0),1,6)
    tangent(lead,bp[1],(-1,.05,0),5,5)
    tangent(lead,bp[-1],(-1,0,0),5,1)
    lead['cable_role']='Short lead from signal module to USB-C connector'
    keeper=bpy.data.objects['Cable keeper · soft wrap band']
    shift(keeper,Vector((57.125,-6,0))-center_xy(keeper))

    bpy.context.view_layer.update()
    assert {o.name:fingerprint(o) for o in unchanged}==before,'Accepted component geometry changed'
    for o in unchanged:
        assert all(abs(o.matrix_world.to_3x3()[i][j]-matrices[o.name].to_3x3()[i][j])<1e-6 for i in range(3) for j in range(3)),o.name
        if not o.name.startswith(('Controller ·','USB-C ·','Cable keeper ·')):
            assert (o.matrix_world.translation-matrices[o.name].translation).length<1e-5,o.name
    assert all(bpy.data.objects[n].data.bevel_depth==v for n,v in widths.items())
    assert len(obs)==29
    lengths_after={n:bpy.data.objects[n].data.splines[0].calc_length(resolution=64) for n in WIRE_NAMES}
    assert lengths_after[WIRE_NAMES[2]]>4*lengths_before[WIRE_NAMES[2]]
    assert lengths_after[WIRE_NAMES[3]]<.15*lengths_before[WIRE_NAMES[3]]
    # Exact end positions keep all four moved cable connections embedded.
    assert (world_points(trunk)[0]-old_trunk[0]).length<1e-5
    assert (world_points(trunk)[-1]-old_trunk[-1]-ctrl_delta).length<1e-4
    assert (world_points(lead)[0]-old_lead[0]-ctrl_delta).length<1e-4
    assert (world_points(lead)[-1]-old_lead[-1]-usb_delta).length<1e-4
    cam=bpy.data.objects['Camera · reference layout']
    cam.location=(13.5,5,310);cam.rotation_euler=(0,0,0);cam.data.ortho_scale=224
    perspective=bpy.data.objects['Camera · three-quarter']
    perspective.location=(13.5,-89,310)
    perspective.rotation_euler=(Vector((13.5,5,3))-perspective.location).to_track_quat('-Z','Y').to_euler()
    perspective.data.ortho_scale=224
    scene.camera=cam
    scene.render.resolution_x=1920;scene.render.resolution_y=1080;scene.render.resolution_percentage=100
    scene['product_layout_revision']=3
    scene['product_layout_note']='Long coiled Y-to-module wire, short USB lead, vertical module beside earbuds in 16:9 landscape.'
    return {'layout_revision':3,'render_resolution':[1920,1080],'aspect_ratio':'16:9',
            'unchanged_geometry_and_materials':True,'unchanged_component_rotations_and_scales':True,
            'unchanged_earbuds_branch_wires_and_y_connector':True,'unchanged_wire_diameters':True,
            'exact_socket_overlap_preserved':True,'controller_center_mm':[100,11],
            'usb_body_center_mm':[72,48],'coil_center_mm':[cx,cy],
            'cable_lengths_before_mm':lengths_before,'cable_lengths_after_mm':lengths_after,
            'component_fingerprints':before}

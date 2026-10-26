"""Editable cable routing, a fused Y-junction, and the USB-C termination.

All dimensions are millimetres. The layout follows the supplied 1312 x 1199
reference, mapped into the XY plane; positive Z is above the presentation floor.
Call build_cables() from a Blender Python script.
"""

import math
import bpy
from mathutils import Vector


SCALE = 0.125


def point(px, py, z):
    return ((px - 656.0) * SCALE, (600.0 - py) * SCALE, z)


def collection(name):
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    return col


def put_in(obj, col):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    col.objects.link(obj)


def material(name, color, metal=0.0, roughness=0.4, cable=False):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    tree = mat.node_tree
    tree.nodes.clear()
    out = tree.nodes.new('ShaderNodeOutputMaterial')
    bs = tree.nodes.new('ShaderNodeBsdfPrincipled')
    bs.inputs['Base Color'].default_value = (*color, 1.0)
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Roughness'].default_value = roughness
    tree.links.new(bs.outputs['BSDF'], out.inputs['Surface'])
    if cable:
        # Very fine irregular relief gives the black jacket a woven surface
        # without adding thousands of strands or making the silhouette noisy.
        tex = tree.nodes.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value = 28.0
        tex.inputs['Detail'].default_value = 2.5
        tex.inputs['Roughness'].default_value = 0.65
        coords = tree.nodes.new('ShaderNodeTexCoord')
        tree.links.new(coords.outputs['Object'], tex.inputs['Vector'])
        bump = tree.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = 0.16
        bump.inputs['Distance'].default_value = 0.025
        tree.links.new(tex.outputs['Fac'], bump.inputs['Height'])
        tree.links.new(bump.outputs['Normal'], bs.inputs['Normal'])
    return mat


def cable_curve(name, points, radius, mat, col, radii=None, resolution=32):
    """Points are already in world space. AUTO handles stay editable in Blender."""
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = resolution
    data.render_resolution_u = resolution
    data.bevel_depth = radius
    data.bevel_resolution = 5
    data.resolution_u = resolution
    data.use_fill_caps = True
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for index, (bp, pos) in enumerate(zip(spline.bezier_points, points)):
        bp.co = pos
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'
        bp.radius = radii[index] if radii else 1.0
    obj = bpy.data.objects.new(name, data)
    col.objects.link(obj)
    data.materials.append(mat)
    return obj


def rounded_box(name, location, dimensions, bevel, mat, col):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    put_in(obj, col)
    obj.data.materials.append(mat)
    bev = obj.modifiers.new('Soft moulded edges', 'BEVEL')
    bev.width = bevel
    bev.segments = 6
    normal = obj.modifiers.new('Face normals', 'WEIGHTED_NORMAL')
    normal.keep_sharp = True
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def rounded_outline(width, height, radius, count=12):
    radius = min(radius, width / 2 - 0.001, height / 2 - 0.001)
    points = []
    for cy, cz, start in (
        (width / 2 - radius, height / 2 - radius, 0),
        (-width / 2 + radius, height / 2 - radius, 90),
        (-width / 2 + radius, -height / 2 + radius, 180),
        (width / 2 - radius, -height / 2 + radius, 270),
    ):
        for i in range(count):
            a = math.radians(start + i * 90 / count)
            points.append((cy + radius * math.cos(a),
                           cz + radius * math.sin(a)))
    return points


def hollow_sleeve(name, location, length, width, height, radius, thickness,
                  mat, col, axis='X'):
    """A true hollow rounded rectangle with wall thickness and open ends."""
    outer = rounded_outline(width, height, radius)
    inner = rounded_outline(width - 2 * thickness, height - 2 * thickness,
                            max(0.03, radius - thickness))
    n = len(outer)
    verts = []
    for x, outline in ((-length / 2, outer), (length / 2, outer),
                       (-length / 2, inner), (length / 2, inner)):
        for y, z in outline:
            verts.append((x, y, z))
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces.extend(((i, j, n + j, n + i),
                      (2 * n + j, 2 * n + i, 3 * n + i, 3 * n + j),
                      (j, i, 2 * n + i, 2 * n + j),
                      (n + i, n + j, 3 * n + j, 3 * n + i)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    col.objects.link(obj)
    obj.location = location
    if axis == 'Y':
        obj.rotation_euler.z = math.pi / 2
    mesh.materials.append(mat)
    bevel = obj.modifiers.new('Fine edge highlights', 'BEVEL')
    bevel.width = min(thickness * 0.25, 0.065)
    bevel.segments = 3
    bevel.limit_method = 'ANGLE'
    normals = obj.modifiers.new('Balanced normals', 'WEIGHTED_NORMAL')
    normals.keep_sharp = True
    for poly in mesh.polygons:
        poly.use_smooth = True
    return obj


def cylinder_between(name, a, b, radius, mat, col):
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=radius,
                                       depth=(b-a).length,
                                       location=(a+b)/2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    put_in(obj, col)
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new('Rolled collar edges', 'BEVEL')
    bevel.width = 0.12
    bevel.segments = 3
    obj.modifiers.new('Collar normals', 'WEIGHTED_NORMAL')
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def fused_junction(col, rubber, bronze):
    # All branch profiles intentionally overlap, then fuse into one soft shell.
    paths = [
        ([(625, 574, 4.15), (638, 601, 4.0), (653, 622, 3.5),
          (654, 639, 2.8)], [1.45, 1.9, 2.0, 1.6]),
        ([(683, 574, 4.15), (670, 601, 4.0), (655, 622, 3.5),
          (654, 639, 2.8)], [1.45, 1.9, 2.0, 1.6]),
    ]
    branches = []
    for i, (points, radii) in enumerate(paths):
        obj = cable_curve('Junction shell branch ' + str(i + 1),
                          [point(*p) for p in points], 1.0, rubber, col, radii)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.ops.object.convert(target='MESH')
        branches.append(bpy.context.object)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in branches:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = branches[0]
    bpy.ops.object.join()
    shell = bpy.context.object
    shell.name = 'Y-junction · seamless rubber housing'
    remesh = shell.modifiers.new('Union of both fork branches', 'REMESH')
    remesh.mode = 'VOXEL'
    remesh.voxel_size = 0.10
    remesh.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth = shell.modifiers.new('Moulded junction smoothing', 'SMOOTH')
    smooth.factor = 0.6
    smooth.iterations = 4
    subdivision = shell.modifiers.new('Continuous soft fork surface', 'SUBSURF')
    subdivision.levels = 2
    subdivision.render_levels = 2
    for poly in shell.data.polygons:
        poly.use_smooth = True
    shell['description'] = 'Continuous Y-shaped rubber housing; both branch wires terminate inside the shell.'
    collar = cylinder_between('Y-junction · bronze exit collar',
                             point(654, 638.5, 2.80), point(654, 644, 2.62),
                             1.64, bronze, col)
    return shell, collar


def build_cables():
    wires = collection('02 · Wires and junction')
    usb = collection('04 · USB-C lead')
    jacket = material('Cable · graphite fine woven jacket', (0.004, 0.005, 0.006),
                      roughness=0.40, cable=True)
    rubber = material('Cable · soft black moulded rubber', (0.003, 0.004, 0.005),
                      roughness=0.43)
    for mat in (jacket, rubber):
        next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Specular IOR Level'].default_value = 0.24
    bronze = material('Cable · warm satin bronze', (0.34, 0.205, 0.115),
                      metal=0.88, roughness=0.29)
    nickel = material('USB-C · brushed nickel', (0.56, 0.59, 0.61),
                      metal=0.92, roughness=0.25)
    dark = material('USB-C · dark socket interior', (0.006, 0.008, 0.009),
                    roughness=0.55)
    gold = material('USB-C · recessed contacts', (0.47, 0.30, 0.08),
                    metal=0.85, roughness=0.3)

    left_px = [(425, 238, 4.2), (422, 266, 3.7), (410, 300, 2.7),
               (310, 355, 1.35), (248, 418, 1.0), (271, 474, 1.0),
               (430, 493, 1.0), (552, 512, 1.5), (625, 578, 4.15)]
    right_px = [(885, 238, 4.2), (888, 266, 3.7), (900, 300, 2.7),
                (1000, 355, 1.35), (1063, 418, 1.0), (1040, 474, 1.0),
                (880, 493, 1.0), (758, 512, 1.5), (683, 578, 4.15)]
    left = cable_curve('Left earbud · editable wire', [point(*p) for p in left_px],
                       0.62, jacket, wires, [1.5] + [1.0] * (len(left_px)-1))
    right = cable_curve('Right earbud · editable wire', [point(*p) for p in right_px],
                        0.62, jacket, wires, [1.5] + [1.0] * (len(right_px)-1))
    shell, collar = fused_junction(wires, rubber, bronze)

    main_px = [(654, 641, 2.7), (648, 668, 2.2), (630, 688, 1.6),
               (515, 714, 1.1), (337, 705, 1.1), (210, 721, 1.1),
               (133, 760, 1.1), (98, 804, 1.1), (107, 837, 1.2),
               (157, 859, 2.0), (230, 863, 3.4)]
    main = cable_curve('Junction to controller · editable wire',
                       [point(*p) for p in main_px], 0.85, jacket, wires)

    # A continuous spiral gives genuine nested cable loops. The final tail
    # rises naturally over the lower-left loop before reaching the USB plug.
    coil_points = [point(754, 853, 3.4), point(835, 846, 2.4),
                   point(945, 819, 1.35)]
    turns = 2.52
    segments = 65
    for i in range(segments + 1):
        t = i / segments
        angle = -math.pi / 2 + 2 * math.pi * turns * t
        rx = 184 - 35 * t
        ry = 147 - 29 * t
        px = 1063 + rx * math.cos(angle)
        py = 958 + ry * math.sin(angle)
        z = 1.18 + 0.10 * math.sin(angle * 2)
        # Raise just the exit segment to clear the preceding outer turns.
        if t > 0.88:
            ramp = (t - 0.88) / 0.12
            z += 2.25 * (ramp * ramp * (3 - 2 * ramp))
        coil_points.append(point(px, py, z))
    coil_points.extend([point(982, 1077, 3.7), point(916, 1070, 3.7),
                        point(842, 1064, 3.7)])
    lead = cable_curve('Controller to USB-C · continuous coiled lead',
                       coil_points, 0.85, jacket, usb, resolution=16)
    lead['description'] = 'One continuous editable Bezier cable: controller, 2.52 nested turns, and USB-C strain relief.'
    keeper = hollow_sleeve('Cable keeper · soft wrap band', point(1230, 945, 1.7),
                           4.9, 6.4, 3.4, 1.15, 0.42, rubber, usb, axis='Y')

    body = rounded_box('USB-C · black connector body', point(760, 1064.5, 3.7),
                       (12.9, 7.75, 5.4), 0.65, rubber, usb)
    band = rounded_box('USB-C · bronze end trim', point(807.5, 1064.5, 3.7),
                       (0.92, 7.68, 5.32), 0.30, bronze, usb)
    relief = cable_curve('USB-C · tapered strain relief',
                         [point(810, 1064.5, 3.7), point(820, 1064.5, 3.7),
                          point(839, 1064.3, 3.7), point(845, 1064, 3.7)],
                         1.0, rubber, usb, [2.35, 1.85, 1.08, 0.88])
    # The shell is actually open at the left-facing tip. Its metal rim,
    # recessed polymer tongue, and small contacts remain visible in closeups.
    plug = hollow_sleeve('USB-C · open metal plug shell', point(691, 1064.5, 3.7),
                         5.25, 6.55, 2.35, 1.0, 0.19, nickel, usb)
    back = rounded_box('USB-C · recessed dark cavity', point(703.5, 1064.5, 3.7),
                       (0.35, 6.14, 1.94), 0.18, dark, usb)
    tongue = rounded_box('USB-C · internal polymer tongue', point(690.5, 1064.5, 3.7),
                         (4.35, 4.9, 0.42), 0.17, dark, usb)
    contacts = []
    for i in range(8):
        for direction in (-1, 1):
            contact = rounded_box('USB-C · contact %02d %s' % (i + 1, 'top' if direction > 0 else 'bottom'),
                                  point(689.5, 1051.9 + i * 3.6, 3.7 + direction * 0.225),
                                  (2.65, 0.25, 0.035), 0.015, gold, usb)
            contacts.append(contact)
    # Join the contact inserts into one modest mesh while retaining the
    # editable housing, shell, and cable as their own named objects.
    bpy.ops.object.select_all(action='DESELECT')
    for obj in contacts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = contacts[0]
    bpy.ops.object.join()
    contacts_obj = bpy.context.object
    contacts_obj.name = 'USB-C · recessed gold contact array'
    bpy.ops.object.select_all(action='DESELECT')
    return {'left_wire': left, 'right_wire': right, 'junction': shell,
            'junction_collar': collar, 'main_wire': main, 'usb_lead': lead,
            'cable_keeper': keeper, 'usb_body': body, 'usb_band': band,
            'usb_relief': relief, 'usb_shell': plug, 'usb_cavity': back,
            'usb_tongue': tongue, 'usb_contacts': contacts_obj,
            'collections': [wires, usb]}


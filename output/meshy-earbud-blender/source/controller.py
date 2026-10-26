"""Editable CYMBA inline controller. Geometry uses millimetres, facing +Z.

The housing, trim, face, button, indicator, marking, and strain reliefs are
independent objects. No camera, light, or scene/export settings are changed.
"""

import math
import os

import bpy
from mathutils import Vector


def _ctrl_material(name, color, metallic=0.0, roughness=0.35):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*color, 1)
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return material


def _ctrl_outline(width, height, radius, steps=18):
    radius = min(radius, height / 2, width / 2)
    points = []
    for cx, cy, start in (
        (width / 2 - radius, height / 2 - radius, 0),
        (-width / 2 + radius, height / 2 - radius, 90),
        (-width / 2 + radius, -height / 2 + radius, 180),
        (width / 2 - radius, -height / 2 + radius, 270),
    ):
        for step in range(steps + 1):
            angle = math.radians(start + 90 * step / steps)
            points.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
    return points


def _ctrl_loft(name, profiles, center, material, collection):
    # Each profile is (z, width, height, corner_radius).
    vertices = []
    for z, width, height, radius in profiles:
        vertices.extend((x, y, z) for x, y in _ctrl_outline(width, height, radius))
    count = len(_ctrl_outline(*profiles[0][1:]))
    faces = [tuple(reversed(range(count)))]
    for ring in range(len(profiles) - 1):
        a, b = ring * count, (ring + 1) * count
        for index in range(count):
            following = (index + 1) % count
            faces.append((a + index, a + following, b + following, b + index))
    faces.append(tuple(range((len(profiles) - 1) * count, len(profiles) * count)))
    mesh = bpy.data.meshes.new(name + " · mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.location = (center[0], center[1], 0)
    mesh.materials.append(material)
    for polygon in mesh.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    return obj


def _ctrl_relief(name, start, end, material, collection):
    # start is the embedded housing end; end exactly matches the cable anchor.
    start, end = Vector(start), Vector(end)
    axis = (end - start).normalized()
    side = axis.cross(Vector((0, 0, 1))).normalized()
    up = axis.cross(side).normalized()
    samples = [(0.0, 2.75), (0.1, 2.72), (0.23, 2.48), (0.52, 1.78),
               (0.77, 1.42), (0.92, 1.34), (1.0, 1.31)]
    vertices, faces = [], []
    segments = 64
    for t, radius in samples:
        center = start.lerp(end, t)
        for j in range(segments):
            angle = 2 * math.pi * j / segments
            vertex = center + radius * (math.cos(angle) * side + math.sin(angle) * up)
            vertices.append(tuple(vertex - start))
    faces.append(tuple(reversed(range(segments))))
    for ring in range(len(samples) - 1):
        for j in range(segments):
            k = (j + 1) % segments
            a, b = ring * segments, (ring + 1) * segments
            faces.append((a + j, a + k, b + k, b + j))
    faces.append(tuple(range((len(samples) - 1) * segments, len(samples) * segments)))
    mesh = bpy.data.meshes.new(name + " · mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.location = start
    mesh.materials.append(material)
    for polygon in mesh.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    bevel = obj.modifiers.new("Soft moulded edges", "BEVEL")
    bevel.width = 0.07
    bevel.segments = 3
    bevel.limit_method = "ANGLE"
    return obj


def _ctrl_text(collection, material, position):
    curve = bpy.data.curves.new("CYMBA · editable marking", "FONT")
    curve.body = "CYMBA"
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.size = 3.60
    curve.offset = -0.025
    curve.space_character = 1.25
    curve.extrude = 0.006
    curve.bevel_depth = 0.0
    curve.resolution_u = 12
    for font_path in ("/System/Library/Fonts/HelveticaNeue.ttc", "/System/Library/Fonts/SFNS.ttf"):
        if os.path.exists(font_path):
            try:
                curve.font = bpy.data.fonts.load(font_path, check_existing=True)
                break
            except RuntimeError:
                pass
    obj = bpy.data.objects.new("Controller · CYMBA laser marking", curve)
    collection.objects.link(obj)
    obj.location = position
    curve.materials.append(material)
    return obj


def build_controller():
    """Create the reference controller and return objects plus wire anchors."""
    collection = bpy.data.collections.get("03 · Controller")
    if collection is None:
        collection = bpy.data.collections.new("03 · Controller")
        bpy.context.scene.collection.children.link(collection)
    center = (-20.125, -32.875)
    shell = _ctrl_material("Controller · graphite shell", (0.005, 0.006, 0.007), 0.12, 0.34)
    face = _ctrl_material("Controller · soft black face", (0.003, 0.004, 0.005), 0.05, 0.46)
    seam = _ctrl_material("Controller · recess black", (0.003, 0.004, 0.004), 0.0, 0.44)
    bronze = _ctrl_material("Controller · brushed warm bronze", (0.35, 0.205, 0.115), 0.88, 0.27)
    rubber = _ctrl_material("Controller · black elastomer", (0.005, 0.006, 0.007), 0.0, 0.46)
    marking = _ctrl_material("Controller · quiet silver marking", (0.18, 0.20, 0.19), 0.15, 0.5)
    for mat in (shell, face, rubber):
        mat.node_tree.nodes.get("Principled BSDF").inputs['Specular IOR Level'].default_value = 0.24
    led = _ctrl_material("Controller · soft white indicator", (0.92, 0.98, 1.0), 0.0, 0.24)
    led_shader = led.node_tree.nodes.get("Principled BSDF")
    if "Emission Color" in led_shader.inputs:
        led_shader.inputs["Emission Color"].default_value = (0.86, 0.96, 1.0, 1)
        led_shader.inputs["Emission Strength"].default_value = 2.0
    objects = []

    objects.append(_ctrl_loft("Controller · lower housing", [
        (0.25, 51.0, 9.5, 4.7), (0.36, 52.1, 10.8, 5.3),
        (0.72, 53.65, 12.25, 6.05), (1.35, 54.6, 13.15, 6.45),
        (1.8, 54.85, 13.4, 6.58), (2.05, 54.9, 13.4, 6.58),
    ], center, shell, collection))
    objects.append(_ctrl_loft("Controller · case seam", [
        (2.04, 54.91, 13.42, 6.59), (2.19, 54.91, 13.42, 6.59),
    ], center, seam, collection))
    objects.append(_ctrl_loft("Controller · upper housing", [
        (2.18, 54.9, 13.4, 6.58), (2.48, 55.0, 13.5, 6.63),
        (4.65, 55.0, 13.5, 6.63), (5.25, 54.75, 13.25, 6.5),
        (5.65, 54.1, 12.7, 6.23), (5.78, 53.65, 12.3, 6.05),
    ], center, shell, collection))
    objects.append(_ctrl_loft("Controller · bronze perimeter bezel", [
        (5.57, 53.85, 12.65, 6.18), (5.88, 53.6, 12.4, 6.05),
        (6.10, 53.20, 12.0, 5.85), (6.16, 52.95, 11.75, 5.73),
    ], center, bronze, collection))
    objects.append(_ctrl_loft("Controller · face seal", [
        (6.06, 51.55, 10.4, 5.05), (6.18, 51.62, 10.47, 5.08),
    ], center, seam, collection))
    objects.append(_ctrl_loft("Controller · inset face", [
        (6.13, 51.45, 10.32, 5.02), (6.25, 51.30, 10.17, 4.95),
        (6.31, 50.94, 9.81, 4.77),
    ], center, face, collection))

    button_center = (-9.9375, -32.125)
    objects.append(_ctrl_loft("Controller · button recess", [
        (6.305, 11.1, 4.12, 2.02), (6.335, 11.1, 4.12, 2.02),
    ], button_center, seam, collection))
    objects.append(_ctrl_loft("Controller · multifunction button", [
        (6.32, 10.65, 3.67, 1.8), (6.43, 10.60, 3.62, 1.77),
        (6.62, 10.28, 3.30, 1.61), (6.66, 10.06, 3.08, 1.5),
    ], button_center, rubber, collection))
    indicator_center = (-20.5, -32.125)
    objects.append(_ctrl_loft("Controller · indicator socket", [
        (6.305, 1.0, 1.0, 0.495), (6.33, 0.9, 0.9, 0.445),
    ], indicator_center, seam, collection))
    objects.append(_ctrl_loft("Controller · white status indicator", [
        (6.32, 0.65, 0.65, 0.322), (6.38, 0.61, 0.61, 0.302),
    ], indicator_center, led, collection))
    objects.append(_ctrl_text(collection, marking, (-30.9, -32.125, 6.325)))

    left_anchor = (-53.5, -32.875, 3.4)
    right_anchor = (12.5, -31.625, 3.4)
    objects.append(_ctrl_relief("Controller · input strain relief", (-45.8, -32.875, 3.4), left_anchor, rubber, collection))
    objects.append(_ctrl_relief("Controller · output strain relief", (5.7, -32.875, 3.4), right_anchor, rubber, collection))
    for obj in objects:
        obj["component"] = "CYMBA inline controller"
        obj["design_units"] = "millimetres"
    return {
        "objects": objects,
        "collection": collection,
        "center": (*center, 3.4),
        "left_cable_anchor": left_anchor,
        "right_cable_anchor": right_anchor,
        "housing_dimensions_mm": (55.0, 13.5, 6.41),
        "top_z": 6.66,
    }


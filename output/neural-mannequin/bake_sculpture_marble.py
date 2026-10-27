"""Bake flowing Carrara marble onto the immutable live sculpture's UV0.

Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python output/neural-mannequin/bake_sculpture_marble.py

The source GLB and existing textures stay unchanged. Blender bakes continuous
3D procedural colour and roughness, so the mineral pattern follows the head
and neck across UV seams. A system Python with Pillow encodes the colour map
once into sRGB JPEG and the roughness into linear grayscale PNG. Set
SCULPTURE_IMAGE_PYTHON to override the external Python executable if needed.
"""

from array import array
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

import bpy
import numpy as np
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "public/models/cymba-neural-mannequin-organic-detailed.glb"
COLOR_DEST = ROOT / "public/models/cymba-sculpture-marble-color.jpg"
ROUGH_DEST = ROOT / "public/models/cymba-sculpture-marble-roughness.png"
REPORT = ROOT / "output/neural-mannequin/sculpture-marble-report.json"
IMAGE_PYTHON = os.environ.get("SCULPTURE_IMAGE_PYTHON", shutil.which("python3"))
assert IMAGE_PYTHON, "A system Python with Pillow is needed to encode images"


def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def geometry_signature(mesh):
    digest = hashlib.sha256()
    positions = array("f", [0.0]) * (len(mesh.vertices) * 3)
    mesh.vertices.foreach_get("co", positions)
    digest.update(positions.tobytes())
    indices = array("I", [0]) * len(mesh.loops)
    mesh.loops.foreach_get("vertex_index", indices)
    digest.update(indices.tobytes())
    uv = array("f", [0.0]) * (len(mesh.uv_layers.active.data) * 2)
    mesh.uv_layers.active.data.foreach_get("uv", uv)
    digest.update(uv.tobytes())
    return digest.hexdigest(), hashlib.sha256(uv.tobytes()).hexdigest()


source_hash = file_hash(SOURCE)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
head = next(obj for obj in bpy.context.scene.objects
            if obj.type == "MESH" and obj.name == "Cymba_Marble_Mannequin")
assert len(head.data.uv_layers) == 1
removed = [obj.name for obj in bpy.context.scene.objects if obj != head]
for obj in list(bpy.context.scene.objects):
    if obj != head:
        bpy.data.objects.remove(obj, do_unlink=True)
bpy.context.view_layer.objects.active = head
head.select_set(True)
geometry_hash, uv_hash = geometry_signature(head.data)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 4
scene.render.bake.use_clear = True
scene.render.bake.use_selected_to_active = False

material = bpy.data.materials.new("Sculpted Carrara marble — continuous mineral strata")
material.use_nodes = True
nodes, links = material.node_tree.nodes, material.node_tree.links
nodes.clear()
output = nodes.new("ShaderNodeOutputMaterial")
emission = nodes.new("ShaderNodeEmission")
links.new(emission.outputs[0], output.inputs["Surface"])
coord = nodes.new("ShaderNodeTexCoord")
mapping = nodes.new("ShaderNodeMapping")
mapping.inputs["Location"].default_value = (0.27, -0.18, 0.11)
mapping.inputs["Rotation"].default_value = (0.16, -0.46, 0.31)
mapping.inputs["Scale"].default_value = (1.30, 1.15, 1.10)
links.new(coord.outputs["Generated"], mapping.inputs["Vector"])


def noise(vector, scale, detail=3, roughness=0.58):
    node = nodes.new("ShaderNodeTexNoise")
    node.inputs["Scale"].default_value = scale
    node.inputs["Detail"].default_value = detail
    node.inputs["Roughness"].default_value = roughness
    links.new(vector, node.inputs["Vector"])
    return node


def ramp(socket, stops):
    node = nodes.new("ShaderNodeValToRGB")
    node.color_ramp.interpolation = "EASE"
    for entry in list(node.color_ramp.elements)[1:]:
        node.color_ramp.elements.remove(entry)
    for index, (position, color) in enumerate(stops):
        entry = node.color_ramp.elements[0] if index == 0 else node.color_ramp.elements.new(position)
        entry.position = position
        entry.color = (*color, 1)
    links.new(socket, node.inputs[0])
    return node.outputs[0]


def mix(a, b, strength, mode="MIX"):
    node = nodes.new("ShaderNodeMixRGB")
    node.blend_type = mode
    node.inputs[0].default_value = strength
    links.new(a, node.inputs[1])
    links.new(b, node.inputs[2])
    return node.outputs[0]


# Low-frequency domain warping gives continuous strata irregular thickness
# and branches. It avoids Voronoi cells, cracked patterns and gritty speckles.
flow = noise(mapping.outputs["Vector"], 3.4, 3.2, 0.61)
center = nodes.new("ShaderNodeVectorMath")
center.operation = "SUBTRACT"
center.inputs[1].default_value = (0.5, 0.5, 0.5)
links.new(flow.outputs["Color"], center.inputs[0])
strength = nodes.new("ShaderNodeVectorMath")
strength.operation = "SCALE"
strength.inputs["Scale"].default_value = 0.19
links.new(center.outputs[0], strength.inputs[0])
warp = nodes.new("ShaderNodeVectorMath")
warp.operation = "ADD"
links.new(mapping.outputs["Vector"], warp.inputs[0])
links.new(strength.outputs[0], warp.inputs[1])

def math_node(operation, a, b):
    node = nodes.new("ShaderNodeMath")
    node.operation = operation
    for index, value in enumerate((a, b)):
        if isinstance(value, (float, int)):
            node.inputs[index].default_value = value
        else:
            links.new(value, node.inputs[index])
    return node.outputs[0]


# Work in the imported head's world coordinates, whose Z axis is vertical.
# Two to three slanted strata cross the full height of the sculpture. Their
# straight geological drift is gently bent by a continuous low-frequency
# field. Using distance to each stratum gives narrow mineral cores and broad
# soft wisps without a repeated sine wave's equally thick dark troughs.
geometry = nodes.new("ShaderNodeNewGeometry")
drift = nodes.new("ShaderNodeVectorMath")
drift.operation = "DOT_PRODUCT"
drift.inputs[1].default_value = (0.38, 0.14, 0.48)
links.new(geometry.outputs["Position"], drift.inputs[0])
mineral_flow = noise(geometry.outputs["Position"], 1.1, 2.8, 0.56)
distortion = math_node("MULTIPLY", mineral_flow.outputs["Fac"], 0.30)
strata_field = math_node("ADD", drift.outputs["Value"], distortion)
strata_field = math_node("ADD", strata_field, 0.21)
strata_phase = math_node("FRACT", strata_field, 0)
strata_distance = math_node("ABSOLUTE", math_node("SUBTRACT", strata_phase, 0.5), 0)

cloud = noise(warp.outputs[0], 4.2, 2.0, 0.52)
white_stone = ramp(cloud.outputs["Fac"], [
    (0.20, (0.69, 0.72, 0.74)),
    (0.52, (0.84, 0.85, 0.84)),
    (0.80, (0.91, 0.90, 0.87)),
])
mineral_bands = ramp(strata_distance, [
    (0.000, (0.37, 0.41, 0.45)),
    (0.007, (0.55, 0.59, 0.63)),
    (0.026, (0.76, 0.80, 0.84)),
    (0.075, (0.93, 0.95, 0.97)),
    (0.155, (1.00, 1.00, 1.00)),
])
# Vary the prominence along the main bands. This creates occasional stronger
# mineral streaks within broad soft ribbons, rather than equally dark lines.
band_strength = ramp(flow.outputs["Fac"], [
    (0.23, (0.20, 0.20, 0.20)),
    (0.58, (0.70, 0.70, 0.70)),
    (0.79, (1.00, 1.00, 1.00)),
])
variable_bands = nodes.new("ShaderNodeMixRGB")
variable_bands.inputs[1].default_value = (1, 1, 1, 1)
links.new(band_strength, variable_bands.inputs[0])
links.new(mineral_bands, variable_bands.inputs[2])
marble = mix(white_stone, variable_bands.outputs[0], 1, "MULTIPLY")

# Fainter secondary strata share the broad geological flow, enriching the
# stone without turning it into a noisy or all-over crack pattern.
secondary_field = math_node("MULTIPLY", strata_field, 2.05)
secondary_field = math_node("ADD", secondary_field, math_node("MULTIPLY", flow.outputs["Fac"], 0.40))
secondary_phase = math_node("FRACT", secondary_field, 0)
secondary_distance = math_node("ABSOLUTE", math_node("SUBTRACT", secondary_phase, 0.5), 0)
fine_bands = ramp(secondary_distance, [
    (0.000, (0.53, 0.58, 0.64)),
    (0.006, (0.74, 0.78, 0.82)),
    (0.034, (1.00, 1.00, 1.00)),
])
marble = mix(marble, fine_bands, 0.21, "MULTIPLY")

finish_variation = noise(warp.outputs[0], 12.0, 2.1, 0.45)
roughness = ramp(finish_variation.outputs["Fac"], [
    (0.15, (0.28, 0.28, 0.28)),
    (0.85, (0.39, 0.39, 0.39)),
])
mineral_roughness = ramp(strata_distance, [
    (0.007, (0.42, 0.42, 0.42)),
    (0.10, (0.30, 0.30, 0.30)),
])
roughness = mix(roughness, mineral_roughness, 0.24)

head.data.materials.clear()
head.data.materials.append(material)
for polygon in head.data.polygons:
    polygon.material_index = 0


def bake(socket, size, destination, color):
    links.new(socket, emission.inputs["Color"])
    scene.render.bake.margin = 24 if color else 16
    image = bpy.data.images.new(
        destination.stem + " linear bake", width=size, height=size,
        alpha=False, float_buffer=True,
    )
    image.colorspace_settings.name = "Non-Color"
    target = nodes.new("ShaderNodeTexImage")
    target.image = image
    nodes.active = target
    print("Baking " + destination.name, flush=True)
    bpy.ops.object.bake(type="EMIT")
    pixels = np.empty(size * size * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    rgb = np.clip(pixels.reshape(size, size, 4)[:, :, :3], 0, 1)
    if color:
        rgb = np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * rgb ** (1 / 2.4) - 0.055)
        data = np.rint(np.flipud(rgb) * 255).astype(np.uint8)
        mode, fmt, options = "RGB", "JPEG", {"quality": 94, "subsampling": 0, "optimize": True}
    else:
        data = np.rint(np.flipud(rgb[:, :, 0]) * 255).astype(np.uint8)
        mode, fmt, options = "L", "PNG", {"optimize": True}
    # Pillow's scanlines start at the image top; Blender's pixel buffer starts
    # at the bottom. Flip once here to match glTF images with flipY=false.
    encoder = """from PIL import Image
import json, sys
mode, size, dest, fmt, options = sys.argv[1:]
image = Image.frombytes(mode, (int(size), int(size)), sys.stdin.buffer.read())
image.save(dest, format=fmt, **json.loads(options))
"""
    with tempfile.TemporaryDirectory(prefix="cymba-marble-") as temporary:
        staged = Path(temporary) / destination.name
        subprocess.run([IMAGE_PYTHON, "-c", encoder, mode, str(size), str(staged), fmt, json.dumps(options)],
                       input=data.tobytes(), check=True)
        shutil.copyfile(staged, destination)
    nodes.remove(target)
    bpy.data.images.remove(image)
    return {
        "path": str(destination.relative_to(ROOT)),
        "sha256": file_hash(destination),
        "bytes": destination.stat().st_size,
        "resolution": [size, size],
        "colorSpace": "sRGB" if color else "Non-Color / THREE.NoColorSpace",
        "flipY": False,
        "uvChannel": 0,
        "encoding": "JPEG quality94, 4:4:4, one linear-to-sRGB transform" if color else "PNG grayscale, linear scalar, no gamma transform",
    }


color_report = bake(marble, 2048, COLOR_DEST, True)
roughness_report = bake(roughness, 1024, ROUGH_DEST, False)
after_geometry, after_uv = geometry_signature(head.data)
assert after_geometry == geometry_hash
assert after_uv == uv_hash
assert file_hash(SOURCE) == source_hash
head.data.calc_loop_triangles()
report = {
    "source": str(SOURCE.relative_to(ROOT)),
    "sourceSha256": source_hash,
    "colorTexture": color_report,
    "roughnessTexture": roughness_report,
    "geometryAndUvSha256": geometry_hash,
    "uvSha256": uv_hash,
    "headVertices": len(head.data.vertices),
    "headTriangles": len(head.data.loop_triangles),
    "geometryAndUvsUnchanged": after_geometry == geometry_hash,
    "originalGlbUnchanged": file_hash(SOURCE) == source_hash,
    "excludedObjects": removed,
    "style": "White/cool ivory Carrara marble; flowing warped mineral strata, irregular grey ribbons, sparse stronger accents, soft cloudy bands; no cell cracks or gritty speckles.",
    "roughnessRange": [0.28, 0.42],
    "notes": "Continuous 3D procedural material baked directly on the live head UV0. No geometry export, UV edit, or source-material edit. No neural fibres in either texture. Previous AO is retained unchanged.",
}
REPORT.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2), flush=True)

# A temporary physical-material preview is useful for checking pattern scale
# before the root task integrates the baked maps in the live scene.
surface = nodes.new("ShaderNodeBsdfPrincipled")
links.new(marble, surface.inputs["Base Color"])
links.new(roughness, surface.inputs["Roughness"])
surface.inputs["IOR"].default_value = 1.49
links.new(surface.outputs[0], output.inputs["Surface"])
scene.cycles.samples = 24
scene.render.resolution_x = 620
scene.render.resolution_y = 760
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new("Marble inspection studio")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.73, 0.75, 0.78, 1)
scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.30
for name, location, energy, size in [
    ("Key", (-4, -6, 6), 500, 4),
    ("Fill", (4, -4, 2), 110, 5),
    ("Rim", (3, 3, 5), 300, 3),
]:
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.size = energy, size
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector((0, 0, 0)) - obj.location).to_track_quat("-Z", "Y").to_euler()
data = bpy.data.cameras.new("Marble preview")
camera = bpy.data.objects.new("Marble preview", data)
scene.collection.objects.link(camera)
scene.camera = camera
data.type, data.ortho_scale = "ORTHO", 5.2
camera.location = (5, -15, 1)
camera.rotation_euler = (Vector((0, 0, -0.18)) - camera.location).to_track_quat("-Z", "Y").to_euler()
scene.view_settings.view_transform = "AgX"
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(Path(tempfile.gettempdir()) / "cymba-sculpture-marble-preview.png")
bpy.ops.render.render(write_still=True)
print("Inspection preview: " + scene.render.filepath, flush=True)

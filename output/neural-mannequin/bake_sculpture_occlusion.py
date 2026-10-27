"""Bake neutral cavity occlusion against the exact live sculpture UVs.

Run with Blender in background mode:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python output/neural-mannequin/bake_sculpture_occlusion.py

Only the new AO texture and this script's report are written. The source GLB,
its geometry, its UVs, and the editable authoring files are never exported.
The neural fibres are removed from the temporary bake scene so they cannot
leave dark lines on the otherwise unlit sculpture.
"""

from array import array
import hashlib
import json
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "public/models/cymba-neural-mannequin-organic-detailed.glb"
DESTINATION = ROOT / "public/models/cymba-sculpture-ao.png"
REPORT = ROOT / "output/neural-mannequin/sculpture-occlusion-report.json"
SIZE = 1024
DISTANCE = 0.28
AO_SAMPLES = 64
BAKE_SAMPLES = 16


def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def geometry_signature(mesh):
    """Include every position, triangle loop, and original UV coordinate."""
    h = hashlib.sha256()
    positions = array("f", [0.0]) * (len(mesh.vertices) * 3)
    mesh.vertices.foreach_get("co", positions)
    h.update(positions.tobytes())
    indices = array("I", [0]) * len(mesh.loops)
    mesh.loops.foreach_get("vertex_index", indices)
    h.update(indices.tobytes())
    uv = array("f", [0.0]) * (len(mesh.uv_layers.active.data) * 2)
    mesh.uv_layers.active.data.foreach_get("uv", uv)
    h.update(uv.tobytes())
    return h.hexdigest(), hashlib.sha256(uv.tobytes()).hexdigest()


source_hash = file_hash(SOURCE)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
heads = [obj for obj in bpy.context.scene.objects
         if obj.type == "MESH" and obj.name == "Cymba_Marble_Mannequin"]
assert len(heads) == 1, "Expected exactly one live sculpture mesh"
head = heads[0]
assert len(head.data.uv_layers) == 1, "Expected the original glTF UV0 atlas"

# Only the head contributes to the occlusion field. In particular, do not
# bake fibres, earbud meshes, a floor, lights, or any authoring-scene objects.
removed = [obj.name for obj in bpy.context.scene.objects if obj != head]
for obj in list(bpy.context.scene.objects):
    if obj != head:
        bpy.data.objects.remove(obj, do_unlink=True)
bpy.context.view_layer.objects.active = head
head.select_set(True)
original_geometry, original_uv = geometry_signature(head.data)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = BAKE_SAMPLES
scene.render.bake.margin = 16
scene.render.bake.use_clear = True
scene.render.bake.use_selected_to_active = False

material = bpy.data.materials.new("Sculpture geometry-only cavity occlusion")
material.use_nodes = True
nodes, links = material.node_tree.nodes, material.node_tree.links
nodes.clear()
output = nodes.new("ShaderNodeOutputMaterial")
emission = nodes.new("ShaderNodeEmission")
ao = nodes.new("ShaderNodeAmbientOcclusion")
ao.inputs["Distance"].default_value = DISTANCE
ao.inputs["Color"].default_value = (1, 1, 1, 1)
ao.samples = AO_SAMPLES
ao.only_local = True
links.new(ao.outputs["AO"], emission.inputs["Color"])
links.new(emission.outputs[0], output.inputs["Surface"])
head.data.materials.clear()
head.data.materials.append(material)
for polygon in head.data.polygons:
    polygon.material_index = 0

image = bpy.data.images.new(
    "Cymba sculpture cavity AO (live UV0)", width=SIZE, height=SIZE,
    alpha=False, float_buffer=False,
)
image.colorspace_settings.name = "Non-Color"
image.generated_color = (1, 1, 1, 1)
target = nodes.new("ShaderNodeTexImage")
target.image = image
nodes.active = target
print("Baking short-range sculpture AO from live geometry and UV0", flush=True)
bpy.ops.object.bake(type="EMIT")

# Blender saves this non-colour texture without a display/view transform.
# AO is a linear scalar; Three.js should use NoColorSpace and flipY=false.
image.filepath_raw = str(DESTINATION)
image.file_format = "PNG"
image.save()

after_geometry, after_uv = geometry_signature(head.data)
assert original_geometry == after_geometry, "Geometry changed during bake"
assert original_uv == after_uv, "UVs changed during bake"
assert source_hash == file_hash(SOURCE), "The source file must stay unchanged"
head.data.calc_loop_triangles()
report = {
    "source": str(SOURCE.relative_to(ROOT)),
    "sourceSha256": source_hash,
    "texture": str(DESTINATION.relative_to(ROOT)),
    "textureSha256": file_hash(DESTINATION),
    "bytes": DESTINATION.stat().st_size,
    "resolution": [SIZE, SIZE],
    "channels": "RGB, equal linear grayscale values",
    "colorSpace": "Non-Color / THREE.NoColorSpace",
    "flipY": False,
    "uvChannel": 0,
    "aoDistance": DISTANCE,
    "aoSamples": AO_SAMPLES,
    "cyclesSamples": BAKE_SAMPLES,
    "marginPixels": scene.render.bake.margin,
    "headVertices": len(head.data.vertices),
    "headTriangles": len(head.data.loop_triangles),
    "geometryAndUvSha256": original_geometry,
    "uvSha256": original_uv,
    "geometryAndUvsUnchanged": original_geometry == after_geometry,
    "originalGlbUnchanged": source_hash == file_hash(SOURCE),
    "excludedObjects": removed,
    "notes": "Head-only short-range cavity AO. No fibre or earbud shadows. Baked directly from the active Draco GLB with its original UV0. No source or authoring asset was written.",
}
REPORT.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2), flush=True)

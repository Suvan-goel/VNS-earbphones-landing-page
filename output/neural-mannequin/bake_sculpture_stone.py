"""Bake downloaded, vein-free fine stone relief on the live sculpture UV0.

Run with Blender --background --python output/neural-mannequin/bake_sculpture_stone.py
Requires system Python + Pillow + NumPy for reading the source's 16-bit maps.
Only new normal/roughness maps and a report are saved. No albedo is created.
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
TEXTURE_SOURCE = ROOT / "assets/sculpture-surface/marble_01"
HEIGHT_SOURCE = TEXTURE_SOURCE / "marble_01_disp_2k.png"
ROUGH_SOURCE = TEXTURE_SOURCE / "marble_01_rough_2k.png"
NORMAL_DEST = ROOT / "public/models/cymba-sculpture-stone-normal.png"
ROUGH_DEST = ROOT / "public/models/cymba-sculpture-stone-roughness.png"
REPORT = ROOT / "output/neural-mannequin/sculpture-stone-report.json"
IMAGE_PYTHON = os.environ.get("SCULPTURE_IMAGE_PYTHON", shutil.which("python3"))
CROP = [160, 60, 490, 390]
REPEAT_DENSITY = 0.60
BUMP_DISTANCE = 0.014
BUMP_STRENGTH = 0.75


def sha(path):
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


# The downloaded marble floor has tile seams. Use only an interior square,
# remove broad tile slope, and mirror its real fine relief into a seamless
# repeat. There are no synthetic noise functions or veins in this material.
prepare_source = r"""from PIL import Image
import numpy as np
import json, sys
height_path, rough_path, directory, crop_json = sys.argv[1:]
crop = tuple(json.loads(crop_json))

def blur(image, sigma):
    radius = int(np.ceil(sigma * 3))
    x = np.arange(-radius, radius + 1)
    kernel = np.exp(-(x*x)/(2*sigma*sigma)); kernel /= kernel.sum()
    padded = np.pad(image, ((0,0),(radius,radius)), mode='reflect')
    horizontal = np.apply_along_axis(lambda row: np.convolve(row,kernel,mode='valid'),1,padded)
    padded = np.pad(horizontal, ((radius,radius),(0,0)), mode='reflect')
    return np.apply_along_axis(lambda col: np.convolve(col,kernel,mode='valid'),0,padded)

def crop_map(path):
    return np.asarray(Image.open(path).crop(crop),dtype=np.float64)/65535

def seamless(image):
    horizontal = np.concatenate([image,np.fliplr(image)],axis=1)
    return np.concatenate([horizontal,np.flipud(horizontal)],axis=0)

height = crop_map(height_path)
height_detail = height - blur(height,9)
height_std = float(height_detail.std())
assert height_std > 0.0001, 'Downloaded crop contains no usable height detail'
height_detail = blur(height_detail,0.55)
height_detail = np.clip(0.5+height_detail*(0.07/height_detail.std()),0.28,0.72)
rough = crop_map(rough_path)
rough_detail = rough-blur(rough,12)
rough_std = float(rough_detail.std())
assert rough_std > 0.0001, 'Downloaded crop contains no usable roughness detail'
rough_detail = np.clip(0.52+rough_detail*(0.02/rough_std),0.46,0.58)
np.save(directory+'/height.npy',seamless(height_detail).astype(np.float32))
np.save(directory+'/roughness.npy',seamless(rough_detail).astype(np.float32))
print(json.dumps({'cropHeightDetailStd':height_std,'cropRoughnessDetailStd':rough_std,
 'heightOutputStd':float(height_detail.std()),'roughnessOutputStd':float(rough_detail.std())}))
"""

source_hashes = {str(p.relative_to(ROOT)): sha(p) for p in (SOURCE, HEIGHT_SOURCE, ROUGH_SOURCE)}
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

with tempfile.TemporaryDirectory(prefix="cymba-stone-source-") as temporary:
    result = subprocess.run([IMAGE_PYTHON,"-c",prepare_source,str(HEIGHT_SOURCE),str(ROUGH_SOURCE),temporary,json.dumps(CROP)],
                            check=True,capture_output=True,text=True)
    source_stats = json.loads(result.stdout)
    prepared = {}
    for name in ("height", "roughness"):
        values = np.load(Path(temporary) / (name + ".npy"))
        size = values.shape[0]
        image = bpy.data.images.new("Downloaded stone " + name, width=size, height=size, alpha=False, float_buffer=True)
        image.colorspace_settings.name = "Non-Color"
        rgba = np.ones((size,size,4),dtype=np.float32)
        rgba[:,:,:3] = np.flipud(values)[:,:,None]
        image.pixels.foreach_set(rgba.ravel())
        image.update()
        prepared[name] = image

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 8
scene.render.bake.use_clear = True
scene.render.bake.use_selected_to_active = False
scene.render.bake.normal_space = "TANGENT"
scene.render.bake.normal_r, scene.render.bake.normal_g, scene.render.bake.normal_b = "POS_X", "POS_Y", "POS_Z"
material = bpy.data.materials.new("Downloaded fine white stone surface — no albedo pattern")
material.use_nodes = True
nodes, links = material.node_tree.nodes, material.node_tree.links
nodes.clear()
output = nodes.new("ShaderNodeOutputMaterial")
surface = nodes.new("ShaderNodeBsdfPrincipled")
surface.inputs["Base Color"].default_value = (0.82, 0.81, 0.79, 1)
surface.inputs["IOR"].default_value = 1.49
links.new(surface.outputs[0],output.inputs["Surface"])
coordinate = nodes.new("ShaderNodeNewGeometry")
mapping = nodes.new("ShaderNodeMapping")
mapping.inputs["Scale"].default_value = (REPEAT_DENSITY,)*3
mapping.inputs["Rotation"].default_value = (0.11,0.27,0.18)
links.new(coordinate.outputs["Position"],mapping.inputs["Vector"])
maps = {}
for name,image in prepared.items():
    node = nodes.new("ShaderNodeTexImage")
    node.image = image
    node.projection = "BOX"
    node.projection_blend = 0.35
    node.extension = "REPEAT"
    node.interpolation = "Linear"
    links.new(mapping.outputs["Vector"],node.inputs["Vector"])
    maps[name] = node
bump = nodes.new("ShaderNodeBump")
bump.inputs["Distance"].default_value = BUMP_DISTANCE
bump.inputs["Strength"].default_value = BUMP_STRENGTH
links.new(maps["height"].outputs["Color"],bump.inputs["Height"])
links.new(bump.outputs["Normal"],surface.inputs["Normal"])
links.new(maps["roughness"].outputs["Color"],surface.inputs["Roughness"])
head.data.materials.clear()
head.data.materials.append(material)
for polygon in head.data.polygons:
    polygon.material_index = 0


def bake(size,destination,kind):
    scene.render.bake.margin = 24 if size == 2048 else 16
    image = bpy.data.images.new(destination.stem+" linear bake",width=size,height=size,alpha=False,float_buffer=True)
    image.colorspace_settings.name = "Non-Color"
    target = nodes.new("ShaderNodeTexImage"); target.image = image; nodes.active = target
    print("Baking " + destination.name,flush=True)
    bpy.ops.object.bake(type=kind)
    pixels = np.empty(size*size*4,dtype=np.float32)
    image.pixels.foreach_get(pixels)
    rgb = np.clip(pixels.reshape(size,size,4)[:,:,:3],0,1)
    if kind == "NORMAL":
        data = np.rint(np.flipud(rgb)*255).astype(np.uint8); mode = "RGB"
    else:
        data = np.rint(np.flipud(rgb[:,:,0])*255).astype(np.uint8); mode = "L"
    encoder = "from PIL import Image\nimport sys\nmode,size,dest=sys.argv[1:]\nImage.frombytes(mode,(int(size),int(size)),sys.stdin.buffer.read()).save(dest,format='PNG',optimize=True)"
    with tempfile.TemporaryDirectory(prefix="cymba-stone-encode-") as temporary:
        staged = Path(temporary)/destination.name
        subprocess.run([IMAGE_PYTHON,"-c",encoder,mode,str(size),str(staged)],input=data.tobytes(),check=True)
        shutil.copyfile(staged,destination)
    nodes.remove(target);bpy.data.images.remove(image)
    return {"path":str(destination.relative_to(ROOT)),"sha256":sha(destination),"bytes":destination.stat().st_size,
            "resolution":[size,size],"colorSpace":"THREE.NoColorSpace","flipY":False,"uvChannel":0,
            "bakeType":kind}


normal_report = bake(2048,NORMAL_DEST,"NORMAL")
emission = nodes.new("ShaderNodeEmission")
links.new(maps["roughness"].outputs["Color"],emission.inputs["Color"])
links.new(emission.outputs[0],output.inputs["Surface"])
rough_report = bake(1024,ROUGH_DEST,"EMIT")
assert geometry_signature(head.data) == (geometry_hash,uv_hash)
for path,digest in source_hashes.items():
    assert sha(ROOT/path) == digest
head.data.calc_loop_triangles()
report = {
    "source":str(SOURCE.relative_to(ROOT)),"sourceSha256":source_hashes[str(SOURCE.relative_to(ROOT))],
    "downloadedSource":"Poly Haven marble_01 (CC0), downloaded displacement and roughness maps",
    "sourceFiles":source_hashes,"sourceUrl":"https://polyhaven.com/a/marble_01",
    "cropPixels":CROP,"cropAvoidsTileEdges":True,"sourceStatistics":source_stats,
    "processing":"Interior crop; remove broad height slope; retain real fine grain; mirror-repeat crop to avoid seams. Height normalized to0.07std and softly filtered. No synthetic procedural noise, no albedo map, no painted veins.",
    "projection":"World-space box projection, blend0.35, rotated consistently, baked back to originalUV0",
    "repeatDensityPerSceneUnit":REPEAT_DENSITY,"bumpDistance":BUMP_DISTANCE,"bumpStrength":BUMP_STRENGTH,
    "normalTexture":normal_report,"roughnessTexture":rough_report,"roughnessRange":[0.46,0.58],
    "headVertices":len(head.data.vertices),"headTriangles":len(head.data.loop_triangles),
    "geometryAndUvSha256":geometry_hash,"uvSha256":uv_hash,"geometryAndUvsUnchanged":True,
    "originalGlbUnchanged":True,"sourceTextureFilesUnchanged":True,"excludedObjects":removed,
    "notes":"Tangent-space OpenGL normal. Only surface shading changes; no displacement is applied to geometry. No fibres or earbud shadows baked. Existing AO remains untouched.",
}
REPORT.write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report,indent=2),flush=True)

# Temporary quality check uses the actual exported maps on the original UV0,
# at the site's initial normal strength. This also catches image orientation
# mistakes that a preview of the source box-projection material would miss.
preview_normal = nodes.new("ShaderNodeTexImage")
preview_normal.image = bpy.data.images.load(str(NORMAL_DEST))
preview_normal.image.colorspace_settings.name = "Non-Color"
preview_decode = nodes.new("ShaderNodeNormalMap")
preview_decode.inputs["Strength"].default_value = 0.4
preview_decode.uv_map = head.data.uv_layers.active.name
links.new(preview_normal.outputs["Color"], preview_decode.inputs["Color"])
links.new(preview_decode.outputs["Normal"], surface.inputs["Normal"])
preview_roughness = nodes.new("ShaderNodeTexImage")
preview_roughness.image = bpy.data.images.load(str(ROUGH_DEST))
preview_roughness.image.colorspace_settings.name = "Non-Color"
links.new(preview_roughness.outputs["Color"], surface.inputs["Roughness"])
links.new(surface.outputs[0],output.inputs["Surface"])
scene.cycles.samples = 24
scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage = 620,760,100
scene.world = bpy.data.worlds.new("Stone inspection studio");scene.world.use_nodes=True
scene.world.node_tree.nodes["Background"].inputs[0].default_value=(0.73,0.75,0.78,1)
scene.world.node_tree.nodes["Background"].inputs[1].default_value=0.30
for name,location,energy,size in [("Key",(-4,-6,6),500,4),("Fill",(4,-4,2),110,5),("Rim",(3,3,5),300,3)]:
    data=bpy.data.lights.new(name,"AREA");data.energy,data.size=energy,size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=location
    obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat("-Z","Y").to_euler()
data=bpy.data.cameras.new("Stone preview");camera=bpy.data.objects.new("Stone preview",data)
scene.collection.objects.link(camera);scene.camera=camera;data.type,data.ortho_scale="ORTHO",5.2
camera.location=(5,-15,1);camera.rotation_euler=(Vector((0,0,-0.18))-camera.location).to_track_quat("-Z","Y").to_euler()
scene.view_settings.view_transform="AgX";scene.render.image_settings.file_format="PNG"
scene.render.filepath=str(Path(tempfile.gettempdir())/"cymba-sculpture-stone-preview.png")
bpy.ops.render.render(write_still=True)
print("Inspection preview: "+scene.render.filepath,flush=True)

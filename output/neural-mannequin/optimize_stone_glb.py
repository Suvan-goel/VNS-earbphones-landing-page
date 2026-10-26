"""Compress baked maps for the web without recompressing geometry or changing UVs."""
import io, json, struct, hashlib, sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
bright_marble = '--bright-marble' in sys.argv
growing_network = '--growing-network' in sys.argv
organic_network = '--organic-network' in sys.argv
asset = 'organic' if organic_network else 'growing' if growing_network else 'marble' if bright_marble else 'stone'
path = root / ('public/models/cymba-neural-mannequin-' + asset + '.glb')
data = path.read_bytes()
json_size = struct.unpack_from('<I', data, 12)[0]
document = json.loads(data[20:20+json_size])
binary_start = 20+json_size+8
binary = data[binary_start:]
images = {image['bufferView']: image for image in document.get('images', [])}
normal_textures = {m['normalTexture']['index'] for m in document['materials'] if 'normalTexture' in m}
normal_images = {document['textures'][index]['source'] for index in normal_textures}
normal_views = {document['images'][index]['bufferView'] for index in normal_images}
new_binary = bytearray()
for index, view in enumerate(document['bufferViews']):
    chunk = binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
    if index in images:
        image = Image.open(io.BytesIO(chunk)).convert('RGB')
        output = io.BytesIO()
        if index in normal_views:
            image.thumbnail((1024,1024),Image.Resampling.LANCZOS)
            image.save(output,format='PNG',optimize=True)
            images[index]['mimeType']='image/png'
        else:
            image.save(output,format='JPEG',quality=90,optimize=True)
            images[index]['mimeType']='image/jpeg'
        chunk = output.getvalue()
    view['byteOffset']=len(new_binary);view['byteLength']=len(chunk)
    new_binary.extend(chunk)
    new_binary.extend(b'\0' * (-len(new_binary)%4))
document['buffers'][0]['byteLength']=len(new_binary)
encoded=json.dumps(document,separators=(',',':')).encode()
encoded+=b' '*(-len(encoded)%4)
total=12+8+len(encoded)+8+len(new_binary)
path.write_bytes(struct.pack('<III',0x46546C67,2,total)+struct.pack('<II',len(encoded),0x4E4F534A)+encoded+
                 struct.pack('<II',len(new_binary),0x004E4942)+new_binary)
report={'bytesBefore':len(data),'bytes':total,'meshes':len(document['meshes']),'materials':len(document['materials']),
        'images':len(document['images']),'normalMapped':bool(normal_views),
        'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
(root/'output/neural-mannequin'/(asset+'-asset-validation.json')).write_text(json.dumps(report,indent=2))
build_report = root/'output/neural-mannequin'/('organic-network-report.json' if organic_network else 'growing-network-report.json' if growing_network else 'bright-marble-report.json' if bright_marble else 'dramatic-stone-report.json')
if build_report.exists():
    build = json.loads(build_report.read_text())
    build['bytes'] = total
    suffix = ' --organic-network' if organic_network else ' --growing-network' if growing_network else ' --bright-marble' if bright_marble else ''
    build['buildSteps'] = ['build_organic_network.py (Blender)' if organic_network else 'build_growing_network.py (Blender)' if growing_network else 'dramatic_stone_fibres.py' + suffix + ' (Blender)', 'optimize_stone_glb.py' + suffix + ' (Python)']
    build_report.write_text(json.dumps(build,indent=2))
print(json.dumps(report,indent=2))

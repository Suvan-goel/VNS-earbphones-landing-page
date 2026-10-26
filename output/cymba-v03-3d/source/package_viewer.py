"""Create a single-file offline review with all libraries and model embedded."""
from pathlib import Path
import re,json,base64,hashlib
out=Path(__file__).resolve().parent.parent
encode=lambda b:'data:text/javascript;base64,'+base64.b64encode(b).decode()
imports={}
for key,file in [('three','three.module.js'),('OrbitControls','OrbitControls.js'),('BufferGeometryUtils','BufferGeometryUtils.js'),('GLTFLoader','GLTFLoader.js')]:
 text=(out/'vendor'/file).read_text().replace("'./BufferGeometryUtils.js'","'BufferGeometryUtils'")
 imports[key]=encode(text.encode())
model_bytes=(out/'assembly.glb').read_bytes()
model_revision=hashlib.sha256(model_bytes).hexdigest()[:12]
viewer_path=out/'viewer.js'
viewer_source=re.sub(r"'\./assembly\.glb(?:\?[^']*)?'",lambda m:"'./assembly.glb?revision="+model_revision+"'",viewer_path.read_text())
if viewer_source!=viewer_path.read_text():viewer_path.write_text(viewer_source)
viewer_revision=hashlib.sha256(viewer_source.encode()).hexdigest()[:12]
index_path=out/'index.html'
html=re.sub(r'src="\./viewer\.js(?:\?[^"]*)?"','src="./viewer.js?revision='+viewer_revision+'"',index_path.read_text())
if html!=index_path.read_text():index_path.write_text(html)
# The served viewer uses only same-origin modules and a same-origin GLB. This
# self-contained variant uses embedded data URLs for both; permit those URLs
# in its copied policy without weakening the original index.html policy.
def offline_policy(match):
 policy=match.group(2)
 for directive in ('script-src','connect-src'):
  pattern=rf'(?<![\w-]){directive}\s+([^;]+)'
  def allow_data(source):
   values=source.group(1).split()
   if 'data:' not in values:
    values.append('data:')
   return directive+' '+' '.join(values)
  policy=re.sub(pattern,allow_data,policy)
 return match.group(1)+policy+match.group(3)
html=re.sub(r'(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)("\s*/?>)',offline_policy,html)
html=re.sub(r'<script type="importmap">.*?</script>','<script type="importmap">'+json.dumps({'imports':imports})+'</script>',html,flags=re.S)
js=viewer_source.replace("'./vendor/OrbitControls.js'","'OrbitControls'").replace("'./vendor/GLTFLoader.js'","'GLTFLoader'")
url='data:model/gltf-binary;base64,'+base64.b64encode(model_bytes).decode()
js=re.sub(r"'\./assembly\.glb(?:\?[^']*)?'",lambda m:json.dumps(url),js)
html=re.sub(r'<script type="module" src="./viewer.js(?:\?[^"]*)?".*?</script>',lambda m:'<script type="module">'+js+'</script>',html,flags=re.S)
(out/'model-review.html').write_text(html)
print('Offline viewer:',len(html),'bytes')

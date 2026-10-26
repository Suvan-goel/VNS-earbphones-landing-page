import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(root/'earbud-source.blend'))
o=next(o for o in bpy.context.scene.objects if o.type=='MESH')
for z in [-.5,-.45,-.4,-.35,-.3,-.25,-.2]:
    vs=[v.co for v in o.data.vertices if abs(v.co.z-z)<.012]
    print('SLICE',z,len(vs),json.dumps({'mean':[sum(v[i] for v in vs)/len(vs) for i in range(3)],'min':[min(v[i] for v in vs) for i in range(3)],'max':[max(v[i] for v in vs) for i in range(3)]}) if vs else '')

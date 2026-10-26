import bpy, json, sys
from pathlib import Path
root=Path('/Users/suvangoel/VNS-earbuds-site')
src=root/'output/meshy-earbud-blender'
sys.path.insert(0,str(src/'source'))
from product_layout import products
bpy.ops.wm.open_mainfile(filepath=str(src/'cymba-wired-assembly.blend'))
deps=bpy.context.evaluated_depsgraph_get()
stats=[]
for ob in products():
    ev=ob.evaluated_get(deps); mesh=ev.to_mesh(); mesh.calc_loop_triangles()
    stats.append({'name':ob.name,'type':ob.type,'vertices':len(mesh.vertices),'triangles':len(mesh.loop_triangles),'modifiers':[(m.type,m.name) for m in ob.modifiers]})
    ev.to_mesh_clear()
props=[(p.identifier,p.description,str(p.default) if hasattr(p,'default') else '') for p in bpy.ops.export_scene.gltf.get_rna_type().properties if any(x in p.identifier for x in ['draco','image','texture'])]
print('SOURCE_STATS='+json.dumps({'layout_revision':bpy.context.scene.get('product_layout_revision'),'objects':stats,'images':[{'name':i.name,'size':list(i.size),'channels':i.channels,'source':i.source} for i in bpy.data.images],'export_properties':props},indent=2),flush=True)

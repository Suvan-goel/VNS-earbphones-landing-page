"""Measure both seated cable curves against the sculpture surface."""
import bpy,math,json
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
bpy.ops.wm.open_mainfile(filepath='/Users/suvangoel/VNS-earbuds-site/output/neural-mannequin/cymba-neural-mannequin-growing.blend')
head=bpy.data.objects['Cymba_Marble_Mannequin'];mesh=head.data
bvh=BVHTree.FromPolygons([v.co for v in mesh.vertices],[p.vertices for p in mesh.polygons])
def web(p):return Vector((p[0],-p[2],p[1]))
def check(p):
 q,n,_,d=bvh.find_nearest(web(p));return {'point':p,'closest':[q.x,q.z,-q.y],'normal':[n.x,n.z,-n.y],'signed':(web(p)-q).dot(n),'distance':d}
axis=Vector((.55,-.83,.06)).normalized()
results=[]
for side in [1,-1]:
 angle=side*(math.pi-.72);c=math.cos(angle);s=math.sin(angle)
 local=Vector((side*.02178,-.45850,.10645))+Vector((side*axis.x,axis.y,axis.z))*.008
 socket=Vector((side*1.165+.36*(c*local.x+s*local.z),-.06+.36*local.y,.04+.36*(-s*local.x+c*local.z)))
 tangent=Vector((c*side*axis.x+s*axis.z,axis.y,-s*side*axis.x+c*axis.z))
 end=socket+Vector((side*.06,-.34,.055));a=socket;b=a+tangent*.035;c=end+Vector((0,.14,0));d=end
 samples=[]
 for i in range(101):
  t=i/100;p=a*(1-t)**3+b*3*(1-t)**2*t+c*3*(1-t)*t*t+d*t**3
  samples.append(check(list(p)))
 for i in range(101):samples.append(check(list(end+Vector((0,-2.08*i/100,0)))))
 minimum=min(samples,key=lambda s:s['signed'])
 results.append({'side':side,'radius':.036*.36,'minimumSignedClearance':minimum['signed'],'minimumSurfaceGap':minimum['signed']-.036*.36,'point':minimum['point']})
print('CABLE_CLEARANCE',json.dumps(results))
open('/Users/suvangoel/VNS-earbuds-site/output/neural-mannequin/cable-clearance.json','w').write(json.dumps(results,indent=2))

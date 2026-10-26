"""Millimetre solid geometry helpers for concept CAD. Run with FreeCAD Python."""
import sys, math
sys.path.append('/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part
V=App.Vector
PARTS=[]
MATERIALS={
 'shell': {'color':[0.12,0.14,0.15], 'metallic':0.25,'roughness':0.43},
 'face': {'color':[0.075,0.083,0.09], 'metallic':0.48,'roughness':0.38},
 'silicone': {'color':[0.075,0.085,0.095], 'metallic':0,'roughness':0.75},
 'stim': {'color':[0.145,0.16,0.16], 'metallic':0.06,'roughness':0.66},
 'stim_return': {'color':[0.63,0.58,0.48], 'metallic':0.7,'roughness':0.4},
 'tip': {'color':[0.49,0.51,0.52], 'metallic':0,'roughness':0.62},
 'eeg': {'color':[0.19,0.21,0.21], 'metallic':0.08,'roughness':0.6},
 'gold': {'color':[0.62,0.58,0.49], 'metallic':0.84,'roughness':0.3},
 'steel': {'color':[0.58,0.65,0.69], 'metallic':0.85,'roughness':0.26},
 'pcb': {'color':[0.06,0.26,0.23], 'metallic':0.12,'roughness':0.55},
 'chip': {'color':[0.065,0.075,0.082], 'metallic':0.1,'roughness':0.55},
 'battery': {'color':[0.38,0.43,0.47], 'metallic':0.72,'roughness':0.35},
 'glass': {'color':[0.06,0.25,0.21], 'metallic':0.4,'roughness':0.16},
 'green': {'color':[0.17,0.65,0.39], 'metallic':0.1,'roughness':0.3},
 'copper': {'color':[0.67,0.32,0.13], 'metallic':0.7,'roughness':0.3},
 'red': {'color':[0.55,0.15,0.12], 'metallic':0.05,'roughness':0.6},
 'blue': {'color':[0.14,0.30,0.50], 'metallic':0.05,'roughness':0.6},
}
def add(name, shape, mat='shell', group='System', role='', explode=(0,0,0), source='Assumed geometry', notes='', visible=True):
 p={'name':name,'shape':shape,'material':mat,'group':group,'role':role or name,'explode':list(explode),'source':source,'notes':notes,'visible':visible}
 PARTS.append(p); print('Part:',name,flush=True); return p

def moved(shape, xyz):
 s=shape.copy(); s.translate(V(*xyz)); return s

def ellipse(rx,ry,z=0,x=0,y=0):
 e=Part.Ellipse(V(0,0,0),max(rx,ry),min(rx,ry))
 wire=Part.Wire([e.toShape()])
 if rx<ry: wire.rotate(V(),V(0,0,1),90)
 wire.translate(V(x,y,z)); return wire

def oval(rx,ry,height,xyz=(0,0,0)):
 return moved(Part.Face(ellipse(rx,ry)).extrude(V(0,0,height)),xyz)

def rounded_box(w,h,d,r=1,xyz=(0,0,0)):
 # Vertical rounded rectangle extruded along z.
 r=min(r,w/2-.001,h/2-.001)
 b=Part.makeBox(w,h,d,V(-w/2,-h/2,0))
 vertical=[e for e in b.Edges if abs(e.Vertexes[-1].Point.z-e.Vertexes[0].Point.z)>d*.99]
 b=b.makeFillet(r,vertical)
 return moved(b,xyz)

def ellipsoid(rx,ry,rz,xyz=(0,0,0)):
 s=Part.makeSphere(1)
 m=App.Matrix(); m.A11=rx; m.A22=ry; m.A33=rz
 return moved(s.transformGeometry(m),xyz)

def cylinder(r,h,xyz=(0,0,0),axis=(0,0,1)):
 return Part.makeCylinder(r,h,V(*xyz),V(*axis))

def tube(points,r):
 curve=Part.BSplineCurve(); curve.interpolate([V(*p) for p in points])
 edge=curve.toShape(); path=Part.Wire([edge]); t=curve.tangent(curve.FirstParameter)[0]
 profile=Part.Wire([Part.makeCircle(r,V(*points[0]),t)])
 return path.makePipeShell([profile],True,False), edge.Length

def spline_wire(points):
 c=Part.BSplineCurve(); c.interpolate([V(*p) for p in points],PeriodicFlag=True)
 return Part.Wire([c.toShape()])

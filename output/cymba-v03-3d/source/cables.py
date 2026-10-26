from common import *

def curve(points,axial_ends=False):
 c=Part.BSplineCurve()
 c.interpolate([V(*p) for p in points])
 if axial_ends:
  # Align only the two endpoint derivative poles. The interior remains C2;
  # interpolation-wide tangent constraints can create C1 spans that fail sweep.
  start,end=c.getPole(1),c.getPole(c.NbPoles)
  start_span=(c.getPole(2)-start).Length
  end_span=(c.getPole(c.NbPoles-1)-end).Length
  c.setPole(2,start+V(0,-start_span,0))
  c.setPole(c.NbPoles-1,end+V(0,end_span,0))
 return c

def route_tube(points,radius,axial_ends=False):
 c=curve(points,axial_ends);edge=c.toShape();path=Part.Wire([edge])
 profile=Part.Wire([Part.makeCircle(radius,V(*points[0]),c.tangent(c.FirstParameter)[0])])
 # Frenet framing closes the circular sweep robustly through the trunk's
 # inflections; rotating a circular section does not change its envelope.
 return path.makePipeShell([profile],True,axial_ends),edge.Length

def braid_metadata(part,points,radius,axial_ends=False):
 edge=curve(points,axial_ends).toShape()
 part['cableCenterlineMm']=[[p.x,p.y,p.z] for p in edge.discretize(Number=int(edge.Length*2)+1)]
 part['cableRadiusMm']=radius

def build_cables(hub_exit=(65,-107.9046875,6.16)):
 metrics={}
 for side,sgn in [('L',-1),('R',1)]:
  def pts(bow): return [(sgn*31,-19,0),(sgn*(31+bow),-47,-1),(sgn*(25+bow),-91,-1),(sgn*12,-123,0),(sgn*2,-136,0)]
  low,high=0,70
  for _ in range(30):
   mid=(low+high)/2
   if curve(pts(mid)).length()>150:high=mid
   else:low=mid
  points=pts((low+high)/2);s,l=route_tube(points,1.05)
  p=add(side+' | 150 mm branch cable',s,'silicone','Cable','About 12 conductors in three separated shield groups',source='Spec p.4: about 150 mm each branch',notes='Actual modeled exposed centerline length '+str(round(l,5))+' mm. Termination depths excluded. Braided appearance is a finish assumption.')
  braid_metadata(p,points,1.05)
  metrics[side+'BranchCenterlineMm']=l
 # Molded Y with two branch sockets, main cable socket.
 body=rounded_box(8,15,5,2,(0,-140,-2.5))
 for x in [-2,2]: body=body.cut(cylinder(1.05,6,(x,-131,0),(0,-1,0)))
 body=body.cut(cylinder(1.5,5,(0,-149,0),(0,1,0)))
 add('Shielded Y-split body',body,'face','Cable','Separately routed L/R bundle join',source='Spec p.3-4; 8 × 15 × 5 mm enclosure assumed')
 # Four planar spiral turns, not shortened display geometry; 5.5 mm turn spacing.
 def coilpts(r):
  points=[(0,-147.5,0),(-12,-157,7),(-r,-176,8),(-r,-210,8)]
  # Start at left of coil and end at left after four turns.
  for i in range(193):
   t=i/192;ang=math.pi+8*math.pi*t;rad=r+22*t
   points.append((rad*math.cos(ang),-222+rad*math.sin(ang),0))
  # Follow the final coil tangent downward, sweep outside the outer turn,
  # then return upward. A direct upward exit would fold the tube onto itself.
  points += [(-r-30,-242,0),(-r-42,-232,0),(-r-40,-190,0),(-r-18,-155,1),(10,-102,6),(43,hub_exit[1]+25,hub_exit[2]),(65,hub_exit[1]+17,hub_exit[2]),(65,hub_exit[1]+7,hub_exit[2]),tuple(hub_exit)]
  return points
 low,high=12,40
 for _ in range(26):
  mid=(low+high)/2
  if curve(coilpts(mid),True).length()>1000: high=mid
  else: low=mid
 points=coilpts((low+high)/2);s,l=route_tube(points,1.5,True)
 p=add('1000 mm shielded trunk cable',s,'silicone','Cable','L and R branches retained as separate shielded groups',source='Spec p.4: about 1 m from Y to hub',notes='Actual modeled exposed centerline '+str(round(l,5))+' mm; 3 mm OD is provisional, coil is presentation routing, not a prescribed installed shape.')
 braid_metadata(p,points,1.5,True)
 metrics['trunkCenterlineMm']=l
 return metrics

def build_cable_section():
 # A separate enlarged inspection specimen, actual geometry 1:1, branch OD 2.1 mm.
 cx,cy=105,-230
 group='Cable section'
 def put(name,s,mat,role):add('Cable section | '+name,moved(s,(cx,cy,0)),mat,group,role,source='Spec p.4; wire diameters and shielding geometry illustrative')
 outer=cylinder(1.05,18).cut(cylinder(.88,19,(0,0,-.5)))
 # Half of jacket removed to reveal separation.
 outer=outer.cut(Part.makeBox(5,5,13,V(0,-2.5,5)))
 put('Insulating jacket cutaway',outer,'silicone','2.1 mm OD assumed; specimen at actual scale')
 centers=[(-.43,.30),(.43,.30),(0,-.43)]
 for k,((x,y),count,rr) in enumerate(zip(centers,[2,4,6],[.29,.32,.36])):
  shield=cylinder(rr,16,(x,y,0)).cut(cylinder(rr-.035,17,(x,y,-.5)))
  shield=shield.cut(Part.makeBox(5,5,10,V(x,-2.5,7)))
  put(['Stimulation foil shield','Driven EEG shield','Sensor audio group shield'][k],shield,'steel',['Isolated stimulation twisted pair','Two signals + reference + DRL','Digital bus, speaker pair, power and ground'][k])
  for j in range(count):
   a=2*math.pi*j/count;wx=x+rr*.53*math.cos(a);wy=y+rr*.53*math.sin(a)
   rwire=.09 if k==0 else .075
   if k==0:
    # One full turn per 4 mm.
    points=[(x+.13*math.cos(2*math.pi*t/40+a),y+.13*math.sin(2*math.pi*t/40+a),t*.1) for t in range(151)]
    conductor,_=tube(points,rwire*.5);insulator,_=tube(points,rwire)
    insulator=insulator.cut(conductor)
   else:
    conductor=cylinder(rwire*.5,17,(wx,wy,0));insulator=cylinder(rwire,17,(wx,wy,0)).cut(conductor)
   put('Conductor '+str(k+1)+'.'+str(j+1),conductor,'copper','Illustrative branch conductor; no final pin assignment')
   put('Wire insulation '+str(k+1)+'.'+str(j+1),insulator,['red','blue','green'][k],'Low-noise dielectric concept')

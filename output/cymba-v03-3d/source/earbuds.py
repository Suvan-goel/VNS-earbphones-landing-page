from common import *
from functools import lru_cache
from pathlib import Path

BODY_PROFILES=[(-7.7,10.7,13.3),(-7.25,11.35,13.95),(-6.6,11.7,14.3),(-5.8,11.8,14.4),(-2,11.3,13.5),(1.5,10.7,12.5),(4.5,10.25,11.8),(6,10,11.5)]

def body_envelope():
    return Part.makeLoft([ellipse(rx,ry,z) for z,rx,ry in BODY_PROFILES],True,False)

def curved_edge(points):
    c=Part.BSplineCurve(); c.interpolate([V(x,0,z) for x,z in points]);return c.toShape()

@lru_cache(maxsize=8)
def tip_geometry(radius=7.2):
    s=radius/6.2
    outer=[(3.25,2.9),(4.05*s,3.45),(5.55*s,4.5),(radius,5.75),(5.95*s,7.0),(5.0*s,8.25),(3.6*s,9.35),(2.45,9.8)]
    inner=[(2.1,9.8),(2.1,9.35),(3.6*s-.6,9.0),(5.0*s-.7,8.15),(5.95*s-.7,6.95),(radius-.7,5.75),(5.55*s-.65,4.55),(3.25,4.1)]
    oe=curved_edge(outer);ie=curved_edge(inner)
    lip=Part.Arc(V(2.45,0,9.8),V(2.275,0,9.98),V(2.1,0,9.8)).toShape()
    base=Part.makeLine(V(3.25,0,4.1),V(3.25,0,2.9))
    solid=Part.Face(Part.Wire([oe,lip,ie,base])).revolve(V(),V(0,0,1),360)
    # Parameter bisection uses the existing interpolated curve (not a new interpolation).
    # Z is strictly increasing in this meridian over the selected contact interval.
    curve=oe.Curve
    def at_z(z):
        lo,hi=oe.FirstParameter,oe.LastParameter
        for _ in range(60):
            mid=(lo+hi)/2
            if curve.value(mid).z<z:lo=mid
            else:hi=mid
        return (lo+hi)/2
    edge=curve.toShape(at_z(5.15),at_z(8.20))
    m=App.Matrix();m.A11=.94;m.A22=.94;m.A33=1
    inner_edge=edge.transformGeometry(m)
    low,high=edge.Vertexes[0].Point,edge.Vertexes[-1].Point
    low_i,high_i=inner_edge.Vertexes[0].Point,inner_edge.Vertexes[-1].Point
    inner_edge.reverse()
    panel_profile=Part.Face(Part.Wire([edge,Part.makeLine(high,high_i),inner_edge,Part.makeLine(low_i,low)]))
    # A partial revolution creates exactly the old radial wedge, without a Boolean common.
    pad=panel_profile.revolve(V(),V(0,0,1),38)
    pads=[]
    for start in [71,251]:
        p=pad.copy();p.rotate(V(),V(0,0,1),start)
        solid=solid.cut(p);pads.append(p)
    return solid,pads

@lru_cache(maxsize=8)
def _fin_geometry_with_area(scale=1):
    # A tapered horn follows the reference's deep inner curl. Oval sections are
    # normal to the centerline, giving a rounded section rather than a flat leaf.
    stations=[(-8,8,3.6,2.7),(-10.2,12.5,3.5,2.9),(-10.4,17,3.2,2.9),
              (-8.8,21,2.8,2.7),(-6,23.6,2.3,2.2),(-3.8,24.5,1.5,1.4),
              (-2.6,24.6,.08,.08)]
    sections=[]
    for i,(x,y,width,depth) in enumerate(stations):
        a=stations[max(0,i-1)];b=stations[min(len(stations)-1,i+1)]
        angle=math.degrees(math.atan2(-(b[0]-a[0]),b[1]-a[1]))
        section=ellipse(width*scale,depth*scale)
        section.rotate(V(),V(1,0,0),90)
        section.rotate(V(),V(0,0,1),angle)
        section.translate(V(-8+(x+8)*scale,8+(y-8)*scale,0))
        sections.append(section)
    horn=Part.makeLoft(sections,True,False)
    # Extract the +Z tissue-facing skin directly from the horn. Its outer face
    # therefore shares the exact curvature; the black contact is flush, not a disc.
    skin=horn.cut(moved(horn,(0,0,-.4)))
    outer_surface=Part.makeCompound(horn.Faces)
    target_area=math.pi*24
    low,high=.7*scale,2.35*scale
    for _ in range(15):
        cutoff=(low+high)/2
        mask=oval(7*scale,7.4*scale,10,(-8-.2*scale,8+11.8*scale,cutoff))
        pad=skin.common(mask)
        # Measure only the exposed curved CAD face, excluding backing and edges.
        contact_area=outer_surface.common(pad).Area
        if abs(contact_area-target_area)<.003:break
        if contact_area>target_area:low=cutoff
        else:high=cutoff
    fin=horn.cut(pad).cut(body_envelope())
    return fin,pad,contact_area

def fin_geometry(scale=1):
    fin,pad,_=_fin_geometry_with_area(scale)
    return fin.copy(),pad.copy()

def fin_contact_area(scale=1):
    return _fin_geometry_with_area(scale)[2]

def build_bud(side):
    group='Left earbud' if side=='L' else 'Right earbud'
    shift=-31 if side=='L' else 31
    mirror=side=='R'
    def place(s):
        if mirror:
            s=s.mirror(V(),V(1,0,0))
        return moved(s,(shift,0,0))
    def put(name,s,mat='shell',role='',ex=(0,0,0),source='Spec p.3-5; dimensions provisional',notes=''):
        if mirror: ex=(-ex[0],ex[1],ex[2])
        return add(side+' | '+name,place(s),mat,group,role or name,ex,source,notes)
    def nozzle(s):
        s=s.copy();s.rotate(V(),V(0,1,0),-15);s.translate(V(4.8,-4,5.6));return s
    def driver_mount(s):
        # The external nozzle turns inward from the existing acoustic chamber;
        # retain the internal driver axis to preserve its existing package seat.
        s=s.copy();s.rotate(V(),V(0,1,0),15);s.translate(V(4.8,-4,5.6));return s
    outer=body_envelope()
    inner=Part.makeLoft([ellipse(rx,ry,z) for z,rx,ry in [(-5.6,6.5,8.5),(-4.8,9,11.6),(-2,10.2,12.4),(1.5,9.6,11.4),(4.8,9.1,10.5)]],True,False)
    shell=outer.cut(inner)
    upper=shell.common(Part.makeBox(60,70,30,V(-30,-30,-6.0))).cut(oval(10.7,13.2,1.1,(0,0,-6.1)))
    lower=shell.common(Part.makeBox(60,70,30,V(-30,-30,-36.1)))
    # Functional pockets through the inner cap.
    ret_ry=100/(math.pi*5.0)
    pockets=[oval(5.13,ret_ry+.13,3,(-4.0,-3.5,4.5)),oval(1.75,3.55,3,(4.4,6.5,4.5)),rounded_box(5.6,4.8,3,1,(-4.3,6.2,4.5)),oval(1.65,2.25,3,(8,1.4,4.5)),nozzle(cylinder(3.4,6,(0,0,-1)))]
    for p in pockets: upper=upper.cut(p)
    # Cable outlet through shell bottom and mounting boss.
    upper=upper.cut(cylinder(1.25,10,(0,-20,0),(0,1,0)))
    put('Inner housing shell',upper,'shell','Hollow contact-side housing; recessed independent contacts',(0,0,12),notes='Approximate 1.2 mm nominal wall. Fit and wall thickness are unvalidated assumptions.')
    # Plain crowned insert and a true front bezel reproduce the locked site design.
    crown=ellipsoid(9.95,12.55,.42,(0,0,-7.65)).common(Part.makeBox(40,40,4,V(-20,-20,-11.65)))
    faceplate=crown.fuse(oval(9.95,12.55,.6,(0,0,-7.65)))
    rim=Part.makeLoft([ellipse(10.77,13.37,-7.8),ellipse(10.95,13.55,-7.62),ellipse(11.36,13.96,-7.05)],True,False)
    rim=rim.cut(oval(10.01,12.61,1.2,(0,0,-7.95)))
    lower=lower.cut(faceplate).cut(rim)
    put('Outer faceplate',faceplate,'face','Plain satin-black crowned oval insert',(0,0,-16),source='Locked site imagery; provisional geometry')
    put('Faceplate carrier',lower,'face','Stepped support behind the removable faceplate',(0,0,-14))
    put('Champagne faceplate bezel',rim,'gold','Visible chamfered metal bezel around the faceplate',(0,0,-16),source='Locked site imagery; provisional geometry')
    gasket=oval(11.65,14.25,.1,(0,0,-6.1)).cut(oval(11.05,13.65,1,(0,0,-6.4)))
    put('Housing perimeter gasket',gasket,'silicone','Concept sealing element',(0,0,-5),notes='Represents IP57 design target only; no ingress validation.')
    # Inner cap contact inserts flush at z=6.
    for name,rx,ry,xy,mat,role in [
      ('Stimulation return',5.0,ret_ry,(-4.0,-3.5),'stim_return','Cavum conchae return; independent from EEG reference; 100 mm² planar face'),
      ('EEG concha reference',1.6,3.4,(4.4,6.5),'eeg','Dry conductive polymer EEG reference on concha'),
      ('DRL contact' if side=='R' else 'Reserved DRL contact',1.5,2.1,(8,1.4),'eeg','Shared driven ground at right tragus' if side=='R' else 'Inactive mirrored DRL pad to preserve identical hardware; assumption')]:
        x,y=xy
        carrier=oval(rx+.14,ry+.14,1.2,(x,y,4.8)).cut(oval(rx,ry,1.5,(x,y,4.7)))
        put(name+' insulator',carrier,'silicone',ex=(0,0,14))
        p=put(name,oval(rx,ry,.7,(x,y,5.3)),mat,role,(0,0,16))
        p['contactAreaMm2']=math.pi*rx*ry
        put(name+' spring termination',cylinder(.5,2,(x,y,3.3)),'gold','Representative independent electrode termination',(0,0,4))
    # Sensor window and discrete optical compartments; two emitters + receiver.
    frame=rounded_box(5.5,4.7,1.2,.9,(-4.3,6.2,4.8))
    openings=[]
    for x,y,r in [(-5.6,6.2,.64),(-3.2,5.35,.58),(-3.2,7,.65)]:
        hole=cylinder(r,2,(x,y,4.6)); frame=frame.cut(hole)
        put('PPG window '+str(len(openings)+1),cylinder(r,.32,(x,y,5.68)),'glass','Flush optical window',(0,0,17));openings.append((x,y,r))
    put('PPG opaque optical baffle',frame,'silicone','Optical separation of emitters and photodiode',(0,0,14))
    for name,(x,y,r),mat in zip(['Photodiode','Infrared LED 256 Hz','Green fallback LED'],openings,['chip','chip','green']):
        put('PPG '+name,cylinder(r*.8,.6,(x,y,4.2)),mat,'Representative '+name+' package',(0,0,7))
    # Removable fin has active electrode at its cymba-facing surface.
    fin,pad=fin_geometry()
    put('Medium silicone cymba fin',fin,'silicone','Interchangeable M retention fin',(0,14,0))
    ap=put('Cymba active stimulation electrode',pad,'stim','Flush curved conductive-silicone contact on horn; approximately 75.4 mm² exposed area',(0,17,6),notes='Specified range 50–100 mm²; actual curved surface area is measured from CAD. Contact pressure and anatomical coverage are unvalidated.')
    ap['contactAreaMm2']=fin_contact_area()
    for x in [-8.5,-6.3]: put('Fin connector contact '+str(x),cylinder(.55,1.5,(x,11,-1)),'gold','Assumed concealed removable fin electrical interface',(0,8,0))
    # Nozzle, central bore, retention ridge, tip and two isolated sectors.
    noz=cylinder(3.15,8.5,(0,0,-.4)).cut(cylinder(2.05,10,(0,0,-1)))
    put('Acoustic nozzle',nozzle(noz),'shell','Angled 15-degree hollow sound path',(4,0,15),notes='Angle, diameter and insertion depth provisional.')
    put('Tip retention bead',nozzle(cylinder(3.4,.6,(0,0,6.6)).cut(cylinder(3.05,1,(0,0,6.4)))),'silicone',ex=(4,0,15))
    tip,pads=tip_geometry()
    put('Medium removable silicone tip',nozzle(moved(tip,(0,0,3.1))),'tip','M size thin-wall smoke-grey bell tip with open acoustic bore',(9,0,30))
    for i,pad in enumerate(pads):
        put('EEG canal signal '+str(i+1),nozzle(moved(pad,(0,0,3.1))),'eeg','Independent dry conductive-polymer sector on tip',(9,0,30),notes='Two curved 38° sectors; 142° insulating gaps. Connector and routing geometry provisional.')
    # Acoustic mesh represented by crossed narrow wires, actual bore remains visible.
    wires=[]
    for d in [-1.5,-1,-.5,0,.5,1,1.5]:
        half=math.sqrt(1.95**2-d*d)
        wires.append(cylinder(.035,2*half,(-half,d,12.9),(1,0,0)))
        wires.append(cylinder(.035,2*half,(d,-half,12.9),(0,1,0)))
    put('Acoustic outlet mesh',nozzle(Part.makeCompound(wires)),'steel','Representative acoustic debris screen',(9,0,30))
    # 8.8 mm driver seats behind the angled nozzle.
    driver=cylinder(4.4,2.2,(0,0,-4)).cut(cylinder(3.75,1.1,(0,0,-2.8)))
    put('8.8 mm speaker basket',driver_mount(driver),'steel','Representative standard dynamic driver; diameter assumed',(0,0,-3),notes='Internal driver retains its package axis; the reversed external nozzle opens into the shared acoustic chamber. Acoustic response unvalidated.')
    put('Speaker diaphragm',driver_mount(cylinder(3.7,.08,(0,0,-2.7))),'face','Hub-driven audio diaphragm',(0,0,2))
    put('Speaker magnetic motor',driver_mount(cylinder(2.7,1.2,(0,0,-5.2))),'chip','Representative audio driver motor',(0,0,-5))
    # Local sensor board only; main electronics remain in hub.
    pcb=rounded_box(15,20,.7,2,(-1,1,-.9))
    pcb=pcb.cut(driver_mount(cylinder(4.65,10,(0,0,-9)))).common(inner)
    put('Sensor PCB',pcb,'pcb','Local PPG and IMU board; no main processor or EEG amplifier',(0,0,-8))
    put('6-axis IMU',rounded_box(2.7,2.7,.9,.2,(4,7,-.2)),'chip','100 Hz IMU; representative package',(0,0,-8))
    put('PPG sensor carrier',rounded_box(5.4,4.5,.7,.4,(-4.3,6.2,3.5)),'pcb','Optical sensor daughterboard',(0,0,5))
    for j in range(7):
        put('Sensor passive '+str(j+1),rounded_box(.8,1.2,.4,.1,(-6+(j%4)*2,2+(j//4)*2,-.2)),'chip','Representative passive component',(0,0,-8))
    for j in range(12):
        put('Cable termination '+str(j+1),rounded_box(.5,1.6,.15,.1,(-5.5+j,-7.8,-.18)),'gold','12-conductor ear branch termination',(0,0,-8))
    # Cable boot, individually molded strain-relief grooves.
    boot=Part.makeCone(2.2,1.15,7.5,V(0,-11.5,0),V(0,-1,0)).cut(cylinder(1.0,9,(0,-11,0),(0,-1,0)))
    put('Cable strain relief',boot,'silicone','Cable movement restraint',(0,-4,0))
    for yy in [-15.3,-16.6,-17.9]:
        rr=2.2-(abs(yy)-11.5)/7.5*1.05
        ring=Part.makeTorus(rr,.045,V(0,yy,0),V(0,1,0))
        put('Strain relief groove '+str(yy),ring,'face','Molded cable relief detail',(0,-4,0))
    # Internal electrode harness represents separate paths, not a wiring schematic.
    for i,xy in enumerate([(-4.0,-3.5),(4.4,6.5),(8,1.4)]):
        x,y=xy
        # Bring the return/reference service loops inside the tapered rear wall.
        # These remain illustrative routes, not validated flex or wire harnesses.
        route_x=-5.8 if i<2 else -7
        route=[(x,y,3.3),(x,y,2.6+i*.2),(route_x,2-i,2.1+i*.2),(-6,-7,1.2+i*.3)]
        if i==1:
            # A separate upper routing corridor keeps the reference lead clear
            # of the shared DRL lead, with a distinct termination approach.
            route=[(4.4,6.5,3.3),(4.4,6.5,2.8),(3.8,5.8,2.7),(0,3,3.1),
                   (-3.8,0,3.0),(-5,-3.5,2.7),(-5,-7,2.2)]
        wire,_=tube(route,.17)
        put('Electrode lead '+str(i+1),wire,'copper','Illustrative independent contact lead',(0,0,-3),notes='Provisional interior service-loop routing; wire bend radii and assembly process unvalidated.')
    # Cut actual seats for inserted seal, boot and optical carrier.
    registered={p['name'].split(' | ',1)[1]:p for p in PARTS if p['group']==group}
    housing=registered['Inner housing shell']
    for key in ['Housing perimeter gasket','Cable strain relief','PPG sensor carrier','Stimulation return insulator']:
        housing['shape']=housing['shape'].cut(registered[key]['shape'])
    # Local driver seat retains the outside silhouette while clearing the basket.
    # The envelope gives 0.1 mm radial and axial clearance around the assumed driver.
    driver_seat=place(driver_mount(cylinder(4.5,2.4,(0,0,-4.1))))
    housing['shape']=housing['shape'].cut(driver_seat)
    housing['notes']+=' Local driver pocket assumes 0.1 mm radial/axial assembly clearance; retention and remaining wall thickness are unvalidated.'
    return {'side':side,'bodyEnvelopeMm':[23.6,28.8,14.1],'activeAreaMm2':fin_contact_area(),'returnAreaMm2':100,'tipAngleDegrees':-15,'cableExit':[shift,-19,0]}

def build_fit_kit():
    for i,(label,diam) in enumerate([('XS',12),('S',13.2),('M',14.4),('L',15.6),('XL',16.8)]):
        s,pads=tip_geometry(diam/2); xyz=(-105+i*20,-180,0)
        add('Fit kit | '+label+' tip',moved(s,xyz),'tip','Fit kit',label+' interchangeable tip; provisional '+str(diam)+' mm diameter',source='Spec p.1: five tip sizes; dimensions assumed')
        for j,p in enumerate(pads): add('Fit kit | '+label+' EEG '+str(j+1),moved(p,xyz),'eeg','Fit kit','Two separate conductive polymer sectors')
    for i,(label,scale) in enumerate([('S',.94),('M',1),('L',1.10)]):
        s,p=fin_geometry(scale);xyz=(-100+i*30,-240,0)
        add('Fit kit | '+label+' fin',moved(s,xyz),'silicone','Fit kit','Interchangeable fin; provisional geometry',source='Spec p.1: three fin sizes')
        a=add('Fit kit | '+label+' cymba electrode',moved(p,xyz),'stim','Fit kit','Approximately 75.4 mm² measured curved contact for each fin size');a['contactAreaMm2']=fin_contact_area(scale)

"""Replace only portable circular cable meshes; preserve the underlying CAD.

The three stored centreline/radius pairs define capped parallel-transport tube
meshes. Every other GLB buffer view is copied byte-for-byte, while replacement
views supersede the old cable data so the output binary remains compact.
This helper uses only Python's standard library and is safe to rerun.
"""
from pathlib import Path
import copy
import hashlib
import json
import math
import struct
import sys

SIDES = 32


def add(a, b): return tuple(x + y for x, y in zip(a, b))
def sub(a, b): return tuple(x - y for x, y in zip(a, b))
def mul(a, k): return tuple(x * k for x in a)
def dot(a, b): return sum(x * y for x, y in zip(a, b))
def cross(a, b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def length(a): return math.sqrt(dot(a, a))
def unit(a):
    size = length(a)
    if size < 1e-12: raise ValueError('Degenerate cable direction')
    return mul(a, 1/size)


def cable_mesh(points, radius, axial=False):
    points = [tuple(float(x) for x in point) for point in points]
    if len(points) < 3 or radius <= 0:
        raise ValueError('Invalid cable centreline or radius')
    steps = [length(sub(b, a)) for a, b in zip(points, points[1:])]
    if min(steps) < 1e-8 or max(steps) > .51:
        raise ValueError('Cable centreline sampling must be nonzero and at most 0.51 mm')
    tangents = [unit(sub(mul(points[1], 4), add(mul(points[0], 3), points[2])))]
    tangents += [unit(sub(points[i+1], points[i-1])) for i in range(1, len(points)-1)]
    tangents += [unit(add(sub(mul(points[-1], 3), mul(points[-2], 4)), points[-3]))]
    if axial:
        tangents[0] = tangents[-1] = (0., -1., 0.)
    first_axis = min(((1.,0.,0.), (0.,1.,0.), (0.,0.,1.)), key=lambda v: abs(dot(v,tangents[0])))
    normal = unit(cross(tangents[0], first_axis))
    normals, positions, indices = [], [], []
    for i, (point, tangent) in enumerate(zip(points, tangents)):
        if i:
            axis = cross(tangents[i-1], tangent)
            sine = length(axis)
            cosine = max(-1., min(1., dot(tangents[i-1], tangent)))
            if sine > 1e-12:
                axis = mul(axis, 1/sine)
                normal = add(add(mul(normal, cosine), mul(cross(axis, normal), sine)),
                             mul(axis, dot(axis, normal)*(1-cosine)))
            elif cosine < 0:
                raise ValueError('Cable has a reversed adjacent tangent')
            normal = unit(sub(normal, mul(tangent, dot(normal, tangent))))
        binormal = unit(cross(tangent, normal))
        for j in range(SIDES):
            theta = 2*math.pi*j/SIDES
            radial = add(mul(normal, math.cos(theta)), mul(binormal, math.sin(theta)))
            positions.append(mul(add(point, mul(radial, radius)), .001))
            normals.append(radial)
        if i:
            previous = (i-1)*SIDES
            current = i*SIDES
            for j in range(SIDES):
                k = (j+1)%SIDES
                indices.extend((previous+j, previous+k, current+j,
                                previous+k, current+k, current+j))
    # Separate cap vertices preserve the intentional sharp edge and cap normals.
    for end in (0, len(points)-1):
        cap_normal = mul(tangents[end], -1 if end == 0 else 1)
        center = len(positions)
        positions.append(mul(points[end], .001)); normals.append(cap_normal)
        ring = len(positions)
        for j in range(SIDES):
            positions.append(positions[end*SIDES+j]); normals.append(cap_normal)
        for j in range(SIDES):
            k = (j+1)%SIDES
            indices.extend((center, ring+k, ring+j) if end == 0 else (center, ring+j, ring+k))
    if not all(math.isfinite(x) for p in positions+normals for x in p):
        raise ValueError('Nonfinite cable vertex data')
    if min(indices) < 0 or max(indices) >= len(positions):
        raise ValueError('Cable mesh index out of range')
    for a,b,c in zip(indices[0::3],indices[1::3],indices[2::3]):
        if length(cross(sub(positions[b],positions[a]),sub(positions[c],positions[a]))) < 1e-15:
            raise ValueError('Degenerate cable triangle')
    curvatures = []
    for a,b,c in zip(points,points[1:],points[2:]):
        ab,bc,ac = sub(b,a),sub(c,b),sub(c,a)
        curvatures.append(2*length(cross(ab,bc))/(length(ab)*length(bc)*length(ac)))
    max_curvature = max(curvatures)
    radial_sag = radius*(1-math.cos(math.pi/SIDES))
    chord_sag = max(steps)**2*max_curvature/8
    estimated_error = radial_sag+chord_sag
    if estimated_error >= .03:
        raise ValueError('Cable display approximation exceeds 0.03 mm estimate')
    stats = {'samples':len(points), 'vertices':len(positions), 'triangles':len(indices)//3,
             'radius_mm':radius, 'radial_segments':SIDES,
             'max_centerline_step_mm':max(steps), 'radial_polygon_sag_mm':radial_sag,
             'sampled_chord_sag_estimate_mm':chord_sag,
             'combined_display_error_estimate_mm':estimated_error,
             'trunk_axial_end_tangents':axial, 'closed_end_caps':True}
    return positions,normals,indices,stats


def load_glb(path):
    data=path.read_bytes()
    magic,version,total=struct.unpack_from('<III',data,0)
    if (magic,version,total)!=(0x46546c67,2,len(data)):raise ValueError('Invalid GLB header')
    length_json,kind=struct.unpack_from('<II',data,12)
    if kind!=0x4e4f534a:raise ValueError('Missing JSON chunk')
    document=json.loads(data[20:20+length_json])
    offset=20+length_json
    length_binary,kind=struct.unpack_from('<II',data,offset)
    if kind!=0x004e4942:raise ValueError('Missing binary chunk')
    return document,data[offset+8:offset+8+length_binary]


def exact_route_check(document):
    """Extra numerical check during FreeCAD builds; never regenerate tube CAD."""
    import cables
    from common import V
    curves=[]
    original_route,original_add=cables.route_tube,cables.add
    def capture_curve(points,radius,axial_ends=False):
        curve=cables.curve(points,axial_ends);curves.append(curve)
        return None,curve.length()
    # Capture only mathematical routes. No surrogate solid validity is claimed,
    # and no document or geometry registry receives these temporary records.
    cables.route_tube=capture_curve;cables.add=lambda *args,**kwargs:{}
    try:cables.build_cables()
    finally:cables.route_tube=original_route;cables.add=original_add
    nodes=[n for n in document['nodes'] if 'cableCenterlineMm' in n.get('extras',{})]
    if len(nodes)!=len(curves):raise ValueError('Exact cable route count changed')
    results=[]
    for node,curve in zip(nodes,curves):
        extras=node['extras'];points=extras['cableCenterlineMm'];radius=extras['cableRadiusMm']
        _,normals,_,info=cable_mesh(points,radius,'trunk' in node['name'].lower())
        parameters=[curve.parameter(V(*point)) for point in points]
        point_error=max((curve.value(u)-V(*point)).Length for u,point in zip(parameters,points))
        frame_error=chord_error=0.
        for i,u in enumerate(parameters):
            actual=tuple(curve.tangent(u)[0]);estimated=cross(normals[i*SIDES],normals[i*SIDES+SIDES//4])
            angle=math.atan2(length(cross(actual,estimated)),dot(actual,estimated))
            frame_error=max(frame_error,2*radius*math.sin(angle/2))
        for i,(u,v) in enumerate(zip(parameters,parameters[1:])):
            a,b=points[i],points[i+1];ab=sub(b,a);squared=dot(ab,ab)
            for j in range(1,16):
                point=tuple(curve.value(u+(v-u)*j/16))
                station=max(0.,min(1.,dot(sub(point,a),ab)/squared))
                chord_error=max(chord_error,length(sub(point,add(a,mul(ab,station)))))
        estimate=point_error+frame_error+chord_error+info['radial_polygon_sag_mm']+.00003
        if estimate>=.03:raise ValueError('Exact-route sampled display check exceeds 0.03 mm')
        results.append({'name':node['name'],'max_sample_to_exact_curve_error_mm':point_error,
                        'max_exact_curve_chord_error_mm':chord_error,
                        'conservative_frame_orientation_error_mm':frame_error,
                        'radial_polygon_sag_mm':info['radial_polygon_sag_mm'],
                        'float32_position_allowance_mm':.00003,
                        'combined_sampled_display_error_estimate_mm':estimate,
                        'exact_curve_interior_checks_per_segment':15})
    return results


def refine(outdir):
    out=Path(outdir);path=out/'assembly.glb'
    document,binary=load_glb(path)
    before=copy.deepcopy(document)
    replacements={};stats=[];changed_accessors=set()
    for node in document['nodes']:
        extras=node.get('extras',{})
        if extras.get('group')!='Cable' or 'cableCenterlineMm' not in extras:continue
        mesh=document['meshes'][node['mesh']]
        if len(mesh['primitives'])!=1:raise ValueError('Unexpected multi-primitive cable mesh')
        primitive=mesh['primitives'][0]
        positions,normals,indices,info=cable_mesh(extras['cableCenterlineMm'],extras['cableRadiusMm'],
                                               axial='trunk' in node['name'].lower())
        info['name']=node['name'];stats.append(info)
        for accessor_id,values,component,kind in (
            (primitive['attributes']['POSITION'],positions,5126,'VEC3'),
            (primitive['attributes']['NORMAL'],normals,5126,'VEC3'),
            (primitive['indices'],indices,5125,'SCALAR')):
            accessor=document['accessors'][accessor_id]
            view_id=accessor['bufferView']
            if accessor.get('byteOffset',0) or document['bufferViews'][view_id].get('byteStride'):
                raise ValueError('Interleaved cable accessors are unsupported')
            flattened=[x for value in values for x in value] if kind=='VEC3' else values
            raw=struct.pack('<'+('f' if component==5126 else 'I')*len(flattened),*flattened)
            replacements[view_id]=raw;changed_accessors.add(accessor_id)
            accessor.update(componentType=component,type=kind,count=len(values))
            accessor.pop('min',None);accessor.pop('max',None)
            if accessor_id==primitive['attributes']['POSITION']:
                packed=struct.unpack('<'+'f'*len(flattened),raw)
                accessor['min']=[min(packed[k::3]) for k in range(3)]
                accessor['max']=[max(packed[k::3]) for k in range(3)]
    if len(stats)!=3 or len(replacements)!=9:raise ValueError('Expected exactly three cable meshes')
    # All existing indices into accessors/views remain stable. Their binary ranges
    # are replaced in place logically, then packed without old cable payloads.
    compact=bytearray();preserved_views=0
    for i,view in enumerate(document['bufferViews']):
        old=before['bufferViews'][i]
        if old.get('buffer',0)!=0:raise ValueError('Expected a single embedded buffer')
        original=binary[old.get('byteOffset',0):old.get('byteOffset',0)+old['byteLength']]
        raw=replacements.get(i,original)
        while len(compact)%4:compact.append(0)
        view.update(buffer=0,byteOffset=len(compact),byteLength=len(raw))
        compact.extend(raw)
        if i not in replacements:
            if bytes(compact[view['byteOffset']:view['byteOffset']+view['byteLength']])!=original:
                raise ValueError('Unrelated vertex/index buffer changed')
            preserved_views+=1
    for i,accessor in enumerate(document['accessors']):
        if i not in changed_accessors and accessor!=before['accessors'][i]:
            raise ValueError('Unrelated accessor changed')
    for key in document:
        if key not in {'buffers','bufferViews','accessors'} and document[key]!=before[key]:
            raise ValueError('Scene metadata or materials changed: '+key)
    document['buffers']=[{'byteLength':len(compact)}]
    encoded=json.dumps(document,separators=(',',':')).encode()
    encoded+=b' '*((-len(encoded))%4)
    compact+=b'\0'*((-len(compact))%4)
    payload=struct.pack('<III',0x46546c67,2,12+8+len(encoded)+8+len(compact))
    payload+=struct.pack('<II',len(encoded),0x4e4f534a)+encoded
    payload+=struct.pack('<II',len(compact),0x004e4942)+compact
    temporary=path.with_suffix('.glb.tmp');temporary.write_bytes(payload);temporary.replace(path)
    triangles=sum(document['accessors'][p['indices']]['count']//3
                  for m in document['meshes'] for p in m['primitives'])
    for filename in ('model-manifest.json','validation.json'):
        target=out/filename;content=json.loads(target.read_text());content['triangleCount']=triangles
        target.write_text(json.dumps(content,indent=2))
    report={'cable_meshes':stats,'total_triangle_count':triangles,
            'unchanged_buffer_views_verified_byte_for_byte':preserved_views,
            'replaced_buffer_views':len(replacements),'binary_bytes':len(compact),
            'glb_bytes':len(payload),'glb_sha256':hashlib.sha256(payload).hexdigest(),
            'cad_geometry_unchanged':True,'all_scene_metadata_materials_unchanged':True}
    if 'FreeCAD' in sys.modules:
        report['exact_curve_comparison']=exact_route_check(document)
    (out/'CABLE-MESH-VALIDATION.txt').write_text(
        'PORTABLE CABLE DISPLAY MESH VALIDATION\n\n'
        'Only the three GLB cable meshes are replaced. Editable CAD and STEP\n'
        'geometry, actual routes, radii, metadata and materials remain unchanged.\n'
        'Circular cross-sections have the same continuous swept envelope under\n'
        'parallel transport and Frenet framing. This display approximation uses\n'
        'stored centreline samples and 32 radial segments, with closed end caps.\n'
        'Trunk endpoint frames are explicitly axial. Every index, coordinate and\n'
        'triangle was checked for range, finiteness and nondegenerate area.\n'
        'Unrelated vertex/index ranges are copied and verified byte-for-byte.\n\n'
        'The reported error estimate sums radial polygon sag and centreline chord\n'
        'sag using curvature estimated from adjacent stored centreline samples;\n'
        'it is a display-quality estimate, not a production tolerance guarantee.\n\n'
        +json.dumps(report,indent=2)+'\n')
    print('Refined three portable cable meshes:',triangles,'total triangles;',len(payload),'bytes',flush=True)
    return report


if __name__=='__main__':
    refine(Path(__file__).resolve().parent.parent)

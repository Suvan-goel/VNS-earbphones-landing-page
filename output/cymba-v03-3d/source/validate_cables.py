"""Validate actual swept cable solids and densely sampled presentation routes.

Run with FreeCAD Python. Writes CABLE-VALIDATION.txt beside the model. No dummy
geometry is substituted: the wrapper calls the original tube generator and
records the same interpolated centreline for independent distance checks.
"""
from pathlib import Path
import contextlib
import hashlib
import io
import itertools
import json
import math
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common
import cables

ROOT = Path(__file__).resolve().parent.parent
SAMPLE_TARGET_MM = .18
GRID_MM = 10.0
HUB_EXIT = (65.0, -107.9046875, 6.16)


def in_y_join(point):
    """Only the explicitly allocated molded Y's internal connection region."""
    return -4 <= point.x <= 4 and -147.5 <= point.y <= -132.5 and -2.5 <= point.z <= 2.5


def cell(point):
    return tuple(math.floor(value / GRID_MM) for value in (point.x, point.y, point.z))


def neighbors(key):
    for offsets in itertools.product((-1, 0, 1), repeat=3):
        yield tuple(a + b for a, b in zip(key, offsets))


def nearest(trace_a, trace_b, same=False):
    """Find every potentially closer sample pair within a 10 mm search radius.

    A self check excludes adjacent stations no more than four tube radii apart
    along the centreline. Larger folds and neighboring coil turns remain in the
    check. Cross-route comparisons exclude only pairs BOTH inside the Y join.
    """
    grid = {}
    best = (GRID_MM, None, None)
    exclusion = 4 * trace_a['radius'] if same else 0
    for i, point in enumerate(trace_a['points']):
        grid.setdefault(cell(point), []).append(i)
    for j, point in enumerate(trace_b['points']):
        for key in neighbors(cell(point)):
            for i in grid.get(key, []):
                if same and (i >= j or trace_b['s'][j] - trace_a['s'][i] <= exclusion):
                    continue
                other = trace_a['points'][i]
                if not same and in_y_join(point) and in_y_join(other):
                    continue
                distance = (point - other).Length
                if distance < best[0]:
                    best = distance, i, j
    distance, i, j = best
    radius_sum = trace_a['radius'] + trace_b['radius']
    # Conservative allowance: subtract a full interval from each route. The
    # nearest sample is normally within half an interval, so this is deliberately
    # looser than the usual interpolation-distance bound.
    allowance = trace_a['max_step'] + trace_b['max_step']
    result = {
        'route_a': trace_a['name'], 'route_b': trace_b['name'],
        'local_self_arc_exclusion_mm': exclusion,
        'radius_sum_mm': radius_sum,
        'sampling_allowance_mm': allowance,
        'sampled_minimum_center_distance_mm': distance if i is not None else None,
        'sampled_surface_clearance_mm': distance - radius_sum if i is not None else None,
        'conservative_surface_clearance_lower_bound_mm': distance - radius_sum - allowance,
        'search_radius_mm': GRID_MM,
    }
    if i is not None:
        result['arc_stations_mm'] = [trace_a['s'][i], trace_b['s'][j]]
        result['points_mm'] = [list(trace_a['points'][i]), list(trace_b['points'][j])]
    return result


def main():
    traces = []
    original_tube = cables.route_tube

    def capture_real_tube(points, radius, axial_ends=False):
        shape, length = original_tube(points, radius, axial_ends)
        curve = cables.curve(points, axial_ends)
        edge = curve.toShape()
        samples = edge.discretize(Number=math.ceil(edge.Length / SAMPLE_TARGET_MM) + 1)
        stations = [0.0]
        for a, b in zip(samples, samples[1:]):
            stations.append(stations[-1] + (b - a).Length)
        knots = curve.getKnots()
        max_curvature = 0.0
        for a, b in zip(knots, knots[1:]):
            for k in range(17):
                max_curvature = max(max_curvature, abs(curve.curvature(a + (b - a) * k / 16)))
        traces.append({
            'name': ('left_branch', 'right_branch', 'trunk')[len(traces)],
            'radius': radius, 'points': samples, 's': stations, 'edge': edge,
            'max_step': max(b - a for a, b in zip(stations, stations[1:])),
            'length': length,
            'sampled_minimum_bend_radius': 1 / max_curvature if max_curvature else None,
        })
        return shape, length

    common.PARTS.clear()
    cables.route_tube = capture_real_tube
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            metrics = cables.build_cables()
    finally:
        cables.route_tube = original_tube

    solids = [{'name': p['name'], 'valid': p['shape'].isValid(),
               'solids': len(p['shape'].Solids), 'volume_mm3': p['shape'].Volume}
              for p in common.PARTS]
    failures = [p['name'] for p in solids if not p['valid'] or p['solids'] < 1]
    route_summary = []
    for trace in traces:
        route_summary.append({
            'name': trace['name'], 'centerline_length_mm': trace['length'],
            'radius_mm': trace['radius'], 'sample_count': len(trace['points']),
            'maximum_sample_interval_mm': trace['max_step'],
            'sampled_minimum_bend_radius_mm': trace['sampled_minimum_bend_radius'],
            'curvature_samples_per_knot_span': 17,
        })
        if trace['max_step'] > .2 + 1e-8:
            failures.append('Sampling interval exceeds 0.2 mm: ' + trace['name'])
        if trace['sampled_minimum_bend_radius'] <= trace['radius']:
            failures.append('Local bend radius at or below tube radius: ' + trace['name'])

    checks = [nearest(trace, trace, same=True) for trace in traces]
    checks += [nearest(traces[a], traces[b]) for a, b in [(0, 1), (0, 2), (1, 2)]]
    for check in checks:
        if check['conservative_surface_clearance_lower_bound_mm'] <= 0:
            failures.append('Insufficient sampled clearance: ' + check['route_a'] + '/' + check['route_b'])

    trunk = traces[-1]['edge']
    end = trunk.valueAt(trunk.LastParameter)
    tangent = trunk.tangentAt(trunk.LastParameter)
    endpoint_error = (end - common.V(*HUB_EXIT)).Length
    approach_angle = math.degrees(tangent.getAngle(common.V(0, -1, 0)))
    if endpoint_error > 1e-6:
        failures.append('Cable endpoint does not match hub exit')
    if approach_angle > .01:
        failures.append('Cable endpoint tangent is not axial to the hub boot')
    result = {
        'source_sha256': hashlib.sha256((ROOT / 'source/cables.py').read_bytes()).hexdigest(),
        'centerline_metrics': metrics, 'real_swept_solid_validity': solids,
        'routes': route_summary, 'distance_checks': checks,
        'hub_interface': {'required_exit_mm': list(HUB_EXIT), 'actual_exit_mm': list(end),
                          'endpoint_error_mm': endpoint_error,
                          'incoming_tangent': list(tangent),
                          'incoming_tangent_angle_to_minus_y_degrees': approach_angle,
                          'trunk_radius_mm': traces[-1]['radius'],
                          'hub_boot_exit_radius_mm': 1.65},
        'failures': failures,
    }
    text = '''CABLE GEOMETRY AND PRESENTATION-ROUTE VALIDATION
Units: millimetres. Actual swept CAD cable solids are generated and checked;
no surrogate or dummy shapes are used for any solid-validity statement.

Scope: both 150 mm branch routes, the approximately 1000 mm trunk route and
the molded Y body. Branch radius 1.05 mm; trunk radius 1.50 mm. The separate
cutaway inspection specimen is outside this route audit.

Distance checks use centreline samples spaced at most 0.2 mm. For each check,
the radius sum and a conservative full sampling interval from BOTH routes
are subtracted. Positive lower bounds support separation within this sampled
presentation route. Self checks exclude neighboring arc stations within four
tube radii; sampled local curvature is checked separately. Cross-route checks
exclude only pairs with BOTH centres within the intended molded Y connection
region. A 10 mm spatial grid finds all pairs below that centre-distance radius;
absence of such a pair is reported as a lower bound, never a fabricated minimum.

This checks the current displayed route and CAD validity, not conductor routing,
shielding performance, bend-fatigue limits, braid manufacture, assembly motion
or the occupied anatomical space. The molded Y's local termination interfaces
are conceptual. Endpoint/tangent values are reported independently below.

'''+json.dumps(result, indent=2)+'\n'
    (ROOT / 'CABLE-VALIDATION.txt').write_text(text)
    print(text)
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())

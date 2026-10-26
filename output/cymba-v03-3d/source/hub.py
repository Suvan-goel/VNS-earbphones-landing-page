"""Clippable hub: mechanically coherent, explicitly provisional concept geometry.

All units are mm.  The specification defines architecture, not package dimensions,
capacity, connector pinout, PCB layout or an isolation standard.  These solids
represent those functions, without claiming an engineered circuit or enclosure.
"""
from common import App, Part, V, add, moved, rounded_box, cylinder

ORIGIN = (65.0, -160.0, 0.0)
REPACK_SCALE = (25.0 / 34.0, 77.0 / 64.0, 12.0 / 15.0)
# One affine packaging map preserves every clearance in the provisional
# component allocation. USB-C and the circular cable boot are documented
# exceptions; neither standardized receptacle nor round cable is flattened.
USB_ANCHOR = V(0, -32, 5.1)
REPACKED_PARTS = []
ASSUMED = 'Provisional mechanical allocation; dimensions are absent from v0.3'
ARCH = 'Specification v0.3, p.3: hub architecture and collar/belt clip'
CONTROLS = 'Specification v0.3, p.4: physical stop, one status light and haptic feedback'
CABLE = 'Specification v0.3, p.4: keyed magnetic breakaway; about 12 conductors per ear'
ELECTRONIC = ('Representative component envelope only, not a selected or sourced package; '
              'no routing, electrical isolation, safety performance or capacity is established.')


def _ybox(w, h, depth, radius=0.8, xyz=(0, 0, 0)):
    """A rounded X/Z rectangle, extruded from its Y origin toward +Y."""
    shape = rounded_box(w, h, depth, radius)
    shape.rotate(V(0, 0, 0), V(1, 0, 0), -90)
    shape.translate(V(*xyz))
    return shape


def _record(name, shape, material='shell', role='', explode=(0, 0, 0),
            source=ASSUMED, notes='', group='Hub'):
    sx, sy, sz = REPACK_SCALE
    matrix = App.Matrix()
    matrix.A11, matrix.A22, matrix.A33 = sx, sy, sz
    allocation = 'Affine provisional packaging map: X × %.9f, Y × %.9f, Z × %.9f.' % (sx, sy, sz)
    if name.startswith('USB_C_'):
        # Retain all USB-C dimensions/contact pitch, and only move the port.
        final = moved(shape, (0, USB_ANCHOR.y * (sy - 1) + .2, USB_ANCHOR.z * (sz - 1)))
        allocation = 'USB-C dimensions and contact pitch retained; translated to the revised port centre.'
    elif name == 'Breakaway_strain_relief':
        matrix.A11 = matrix.A33 = 1
        matrix.A34 = 7.7 * (sz - 1)
        final = shape.transformGeometry(matrix)
        allocation = 'Boot length × %.9f; circular 2.5 mm root and 1.65 mm exit radii retained.' % sy
    else:
        final = shape.transformGeometry(matrix)
    # Spline control hulls can grossly overestimate ordinary BoundBox after
    # affine conversion. Ask the CAD kernel for actual surface extrema.
    bounds = final.optimalBoundingBox(False)
    final_notes = allocation + ' Final allocated object envelope: %.6f × %.6f × %.6f mm (X/Y/Z).' % (
        bounds.XLength, bounds.YLength, bounds.ZLength)
    if notes:
        final_notes += ' Construction-reference notes (quoted dimensions precede this reallocation): ' + notes
    obj = add('Hub_' + name, moved(final, ORIGIN), material, group, role,
              tuple(e * s for e, s in zip(explode, REPACK_SCALE)), source, final_notes)
    obj['allocationEnvelopeMm'] = [bounds.XLength, bounds.YLength, bounds.ZLength]
    REPACKED_PARTS.append((name, final, shape))
    return obj


def _usb_construction_aperture(shape):
    """Precompensate the cutout so the final port retains its standard size."""
    sx, sy, sz = REPACK_SCALE
    matrix = App.Matrix()
    matrix.A11, matrix.A22, matrix.A33 = 1 / sx, 1 / sy, 1 / sz
    matrix.A14 = USB_ANCHOR.x * (1 - 1 / sx)
    matrix.A24 = USB_ANCHOR.y * (1 - 1 / sy)
    matrix.A34 = USB_ANCHOR.z * (1 - 1 / sz)
    return shape.transformGeometry(matrix)


def _chip(name, w, h, d, x, y, z=9.3, material='chip', role='', source=ARCH):
    _record(name, rounded_box(w, h, d, min(0.35, w / 8), (x, y, z)),
            material, role or name.replace('_', ' '), (0, 0, 25), source,
            ELECTRONIC, 'Hub electronics')


def _screw(x, y, z, shaft_len, head_r=1.18, head_h=0.57, shaft_r=0.64):
    shaft = cylinder(shaft_r, shaft_len, (x, y, z))
    head = cylinder(head_r, head_h, (x, y, z + shaft_len))
    slot_z = z + shaft_len + head_h - 0.18
    slots = Part.makeBox(head_r * 1.5, 0.22, 0.25,
                         V(x - head_r * .75, y - .11, slot_z))
    slots = slots.fuse(Part.makeBox(.22, head_r * 1.5, .25,
                                  V(x - .11, y - head_r * .75, slot_z)))
    return shaft.fuse(head).cut(slots)


def _roll_edge(shape, z, radius):
    """Roll a complete horizontal perimeter before shell cavities are cut."""
    perimeter = [e for e in shape.Edges
                 if abs(e.BoundBox.ZMin - z) < 1e-6
                 and abs(e.BoundBox.ZMax - z) < 1e-6]
    return shape.makeFillet(radius, perimeter)


def _rear_screw(x, y):
    """Rear-access flush screw; the front face has no fastener openings."""
    shaft = cylinder(.64, 12.65, (x, y, .55))
    head = cylinder(1.18, .55, (x, y, 0))
    slot = Part.makeBox(1.6, .22, .18, V(x - .8, y - .11, -.01))
    return shaft.fuse(head).cut(slot)


def build_hub():
    """Register hub parts; return dimensions and the cable interface in world mm."""
    REPACKED_PARTS.clear()
    # Two genuine thin-wall shells.  The seam is at 10.8--11.0 mm, with a
    # compressed gasket; the top has a 1.3 mm roof and the base a 1.3 mm floor.
    chassis = _roll_edge(rounded_box(34, 64, 10.8, 5.6), 0, 1.15)
    chassis = chassis.cut(rounded_box(31.2, 61.2, 10.0, 4.2, (0, 0, 1.3)))
    lid = _roll_edge(rounded_box(34, 64, 4.0, 5.6, (0, 0, 11.0)), 15, 1.30)
    lid = lid.cut(rounded_box(31.2, 61.2, 2.9, 4.2, (0, 0, 10.8)))

    usb_aperture = _usb_construction_aperture(_ybox(9.6, 3.7, 3.5, 1.35, (0, -32.3, 5.1)))
    conn_aperture = _ybox(26.35, 7.35, 4.2, 1.6, (0, 29.1, 7.7))
    chassis = chassis.cut(usb_aperture).cut(conn_aperture)
    lid = lid.cut(conn_aperture)
    lid = lid.cut(cylinder(5.35, 1.8, (0, -14, 13.5)))
    lid = lid.cut(cylinder(1.35, 1.8, (0, -2, 13.5)))

    mounting = [(x, y) for x in (-12.3, 12.3) for y in (-26.4, 26.4)]
    for i, (x, y) in enumerate(mounting):
        boss = cylinder(1.55, 9.5, (x, y, 1.3))
        boss = boss.cut(cylinder(.70, 11.0, (x, y, -.1)))
        chassis = chassis.fuse(boss)
        chassis = chassis.cut(cylinder(.73, 11.0, (x, y, -.1)))
        chassis = chassis.cut(cylinder(1.25, .57, (x, y, -.01)))
        receiver = cylinder(1.55, 2.9, (x, y, 10.8))
        receiver = receiver.cut(cylinder(.70, 2.55, (x, y, 10.7)))
        lid = lid.fuse(receiver)
        _record('Lid_screw_%02d' % (i + 1), _rear_screw(x, y),
                'face', 'Flush rear-access enclosure fastener', (0, 0, -20),
                notes='Fastens into blind front-lid bosses from rear; no visible face screws. '
                'Illustrative micro screw and boss; thread form not modeled.')
    # Clip screws pass only through the floor, outside the battery envelope.
    for x in (-4.4, 4.4):
        chassis = chassis.cut(cylinder(.75, 1.6, (x, 13, -.1)))
    _record('Lower_chassis', chassis.removeSplitter(), 'shell',
            'Hollow rear chassis with screw bosses and port openings', source=ARCH,
            notes='34 × 64 mm plan; 1.3 mm floor, 1.4 mm nominal side walls; '
            '1.15 mm rolled lower perimeter. ' + ASSUMED)
    _record('Front_lid', lid.removeSplitter(), 'face',
            'Continuous rolled front lid, single stop and light apertures',
            (0, 0, 60), ARCH, '1.3 mm roof and top perimeter roll; total nominal '
            'enclosure depth 15 mm. Blind bosses preserve an uninterrupted face. ' + ASSUMED)

    seal = rounded_box(33.2, 63.2, .2, 5.2, (0, 0, 10.8))
    seal = seal.cut(rounded_box(31.6, 61.6, .4, 4.4, (0, 0, 10.7)))
    seal = seal.cut(conn_aperture)
    _record('Perimeter_seal', seal, 'silicone', 'Compressed enclosure perimeter gasket',
            (0, 0, 40), notes='Concept seal geometry only; ingress protection is not demonstrated.')
    rim = rounded_box(34, 64, .16, 5.6, (0, 0, 10.82))
    rim = rim.cut(rounded_box(33.2, 63.2, .3, 5.2, (0, 0, 10.75)))
    rim = rim.cut(conn_aperture)
    _record('Fine_perimeter_trim', rim, 'face', 'Fine dark enclosure seam trim',
            (0, 0, 40), notes='0.16 mm visible trim; cosmetic insert around the perimeter seal.')

    # Battery occupies the rear layer.  USB-C fits below it in Y; electronics sit
    # above it in Z, with real clearance rather than occupying the same volume.
    _record('Battery_foam', rounded_box(23, 32, .4, 1.2, (0, -7.5, 1.4)),
            'silicone', 'Battery cushioning and retention pad', (0, 0, 12))
    _record('Battery_cell_envelope', rounded_box(23, 34, 4.4, 1.2, (0, -7.5, 1.8)),
            'battery', 'Rechargeable battery reserved volume', (0, 0, 12), ARCH,
            '23 × 34 × 4.4 mm allocation; no capacity or chemistry specified. ' + ELECTRONIC,
            'Hub electronics')
    _record('Battery_wrapper_panel', rounded_box(19, 26, .035, .8, (0, -7.5, 6.2)),
            'face', 'Battery insulating wrapper identification panel', (0, 0, 12),
            notes=ELECTRONIC, group='Hub electronics')
    for x in (-12.2, 12.2):
        _record('Battery_guide_' + ('L' if x < 0 else 'R'),
                rounded_box(.8, 34, 5.1, .25, (x, -7.5, 1.3)),
                'shell', 'Battery lateral locating rail')
    for side, x in [('negative', -3.4), ('positive', 3.4)]:
        _record('Battery_tab_' + side,
                Part.makeBox(2.6, 1.7, .15, V(x - 1.3, 9.5, 3.8)),
                'copper', 'Representative battery terminal tab', (0, 0, 12), ARCH,
                ELECTRONIC, 'Hub electronics')

    # Two physically separate board domains.  The 3.3 mm slot is a visible
    # allocation; it is deliberately NOT described as certified creepage.
    pcb = rounded_box(28, 50, .8, 2.2, (0, -3, 8.5))
    pcb = pcb.cut(Part.makeBox(16, 22, 1.2, V(-1, 2, 8.3)))
    for x in (-12.3, 12.3):
        pcb = pcb.cut(cylinder(1.68, 1.1, (x, -26.4, 8.4)))
    _record('Main_sensor_PCB', pcb, 'pcb', 'Main logic and EEG board with isolation cutout',
            (0, 0, 25), ARCH, '0.8 mm provisional board; electronics and routing representative.',
            'Hub electronics')
    _record('Stimulation_PCB', rounded_box(11.4, 16, .8, .7, (8, 13.3, 8.5)),
            'pcb', 'Separate isolated stimulation domain allocation', (0, 0, 25), ARCH,
            '3.3 mm minimum lateral board gap to main board. This is a packaging allocation, '
            'not a verified electrical clearance or isolated circuit.', 'Hub electronics')
    for name, x, y in [('Sensor', -12, 18), ('Stim', 11, 18)]:
        _record(name + '_board_standoff', cylinder(1.0, 7.2, (x, y, 1.3)),
                'shell', 'Internal board support post')

    _chip('EEG_analog_front_end', 5.5, 5.5, 1.1, -7.8, 12,
          role='EEG analog front end allocation, canal and concha channels')
    _chip('Shared_clock', 3.2, 2.5, .8, -7.8, 6.8,
          role='Shared timing reference allocation',
          source='Specification v0.3, p.5: stimulation and EEG run from one clock')
    _chip('DRL_driver', 3.2, 2.4, .7, -7.8, 17.1,
          role='Shared driven-right-leg amplifier allocation',
          source='Specification v0.3, p.4: one DRL shared by both ears through hub')
    shield = rounded_box(10.6, 17, 3.1, .65, (-7.8, 12, 9.3))
    shield = shield.cut(rounded_box(9.8, 16.2, 3.0, .3, (-7.8, 12, 9.1)))
    _record('EEG_shield_can', shield, 'steel', 'Representative analog shield cover',
            (0, 0, 34), ARCH, 'Optional packaging interpretation to distinguish the low-noise '
            'EEG region; shield dimensions and electrical design are not specified.', 'Hub electronics')
    _chip('Main_processor', 7, 7, 1.3, -6.5, -3, role='Main processor allocation')
    _chip('Radio_reserve', 6, 7, 1.1, 8, -7, role='Radio reserved package volume')
    _chip('Power_management', 4, 4, 1.0, -7.5, -14, role='Power management allocation')
    _chip('USB_controller', 3.5, 3.5, .85, 7.5, -25, role='USB interface controller allocation')
    _chip('Hub_6_axis_IMU', 3, 3, .9, 7.5, -19.5, role='Hub six-axis IMU, 100 Hz requirement',
          source='Specification v0.3, p.5: 6-axis hub IMU at 100 Hz')
    _chip('Audio_driver', 4.5, 3.8, .9, 8, -.5, role='Bilateral audio driver allocation',
          source='Specification v0.3, p.5: both speakers driven from the hub')
    _chip('Stim_pulse_control', 5.3, 4.5, 1.1, 8, 17.0,
          role='Stimulation pulse generator allocation, selectable ear')
    _chip('Stim_isolated_power', 7, 5.4, 2.5, 8, 9.5,
          role='Isolated power conversion reserved volume', material='blue')
    # A small bridge crosses the board allocation gap, depicting isolation
    # coupling only.  Its body is above the board; no copper routes are invented.
    _chip('Isolation_coupler_allocation', 5.2, 3.0, 1.2, 1, 4.0,
          role='Isolation coupling component reserved envelope')
    _record('Antenna_keepout', rounded_box(10, 5, .10, .4, (-6.5, -22.5, 9.3)),
            'silicone', 'Radio antenna reserve', (0, 0, 25), ARCH,
            'Radio is mentioned in architecture; USB-C is the specified app connection. '
            'This is a reserved footprint, not an antenna design.', 'Hub electronics')
    # Gold meander serves as a legible representative antenna, not a tuned trace.
    antenna = Part.makeBox(.25, 3.5, .055, V(-10.5, -24.6, 9.4))
    for i in range(4):
        x = -10.5 + i * 1.8
        antenna = antenna.fuse(Part.makeBox(1.8, .25, .055,
                                         V(x, -21.35 if i % 2 == 0 else -24.6, 9.4)))
        antenna = antenna.fuse(Part.makeBox(.25, 3.5, .055, V(x + 1.8, -24.6, 9.4)))
    _record('Representative_antenna_trace', antenna, 'gold', 'Untuned illustrative antenna trace',
            (0, 0, 25), ARCH, ELECTRONIC, 'Hub electronics')

    # Stop actuator connects the only external button to a switch allocation.
    _chip('Stop_switch', 5, 5, 1.7, 0, -14, role='Physical stop switch allocation', source=CONTROLS)
    _record('Stop_actuator', cylinder(1.15, 2.7, (0, -14, 11.0)),
            'silicone', 'Stop-button mechanical plunger', (0, 0, 60), CONTROLS,
            'Mechanical representation only; app-independent stop circuitry remains to be engineered.')
    _record('Stop_diaphragm', cylinder(5.25, .35, (0, -14, 13.7)),
            'silicone', 'Stop-button sealing diaphragm', (0, 0, 60), CONTROLS)
    grommet = cylinder(5.32, .93, (0, -14, 14.05)).cut(cylinder(4.82, 1.1, (0, -14, 14.0)))
    _record('Stop_button_grommet', grommet, 'silicone', 'Button perimeter grommet',
            (0, 0, 60), CONTROLS)
    stop = _roll_edge(cylinder(4.80, .88, (0, -14, 14.05)), 14.93, .18)
    dish = Part.makeSphere(34.7, V(0, -14, 49.4))
    stop = stop.cut(dish)
    symbol_pocket = rounded_box(2.5, 2.5, .6, .30, (0, -14, 14.65))
    stop = stop.cut(symbol_pocket)
    _record('Physical_stop_button', stop, 'silicone',
            'Single recessed concave immediate-stop control', (0, 0, 60), CONTROLS,
            '9.6 mm button diameter; softly dished matte surface, edge 0.07 mm below '
            'front face and centre 0.3 mm below it; dimensions provisional.')
    symbol = rounded_box(2.5, 2.5, .6, .30, (0, -14, 14.65))
    symbol = symbol.cut(Part.makeSphere(34.7, V(0, -14, 49.435)))
    _record('Stop_symbol', symbol, 'shell', 'Subtle inset tactile stop-square marking',
            (0, 0, 60), CONTROLS,
            'Inset marking follows the concave actuator surface with 0.035 mm tactile relief.')
    _chip('Status_LED', 2, 2, .65, 0, -2, material='green',
          role='Single multistate status LED allocation', source=CONTROLS)
    _record('Status_light_pipe', cylinder(1.25, 5.02, (0, -2, 9.95)),
            'glass', 'One flush status-light lens and light pipe', (0, 0, 60), CONTROLS,
            'Green shown as illustrative active/sham state; idle and fault states also required.')

    # Haptic motor in the free upper rear bay.
    _record('Haptic_mount', cylinder(4.7, .35, (0, 25, 1.3)),
            'silicone', 'Haptic motor cushioning pad', (0, 0, 12), CONTROLS)
    _record('Haptic_actuator', cylinder(4.35, 3.0, (0, 25, 1.65)),
            'steel', 'Gentle start/end haptic actuator allocation', (0, 0, 12), CONTROLS,
            ELECTRONIC, 'Hub electronics')
    _record('Haptic_cap', cylinder(3.7, .08, (0, 25, 4.65)),
            'face', 'Haptic actuator rear cap', (0, 0, 12), CONTROLS,
            ELECTRONIC, 'Hub electronics')

    # Recessed USB-C receptacle; the tongue and two rows of contacts remain
    # geometrically distinct from its metal shell.
    usb_shell = _ybox(9.2, 3.2, 6.7, 1.25, (0, -32.15, 5.1))
    usb_shell = usb_shell.cut(_ybox(8.5, 2.5, 6.2, .95, (0, -32.3, 5.1)))
    _record('USB_C_receptacle_shell', usb_shell, 'steel', 'USB-C host connection receptacle',
            (0, -15, 0), ARCH, 'Illustrative receptacle geometry; no manufacturer footprint selected.')
    usb_gasket = _ybox(9.55, 3.65, 1.15, 1.32, (0, -32, 5.1))
    usb_gasket = usb_gasket.cut(_ybox(9.23, 3.23, 1.3, 1.26, (0, -32.1, 5.1)))
    _record('USB_C_port_gasket', usb_gasket, 'silicone', 'USB-C receptacle perimeter seal',
            (0, -15, 0), notes='Provisional sealing allocation; no ingress protection certification.')
    _record('USB_C_tongue', _ybox(6.8, .65, 5.80, .20, (0, -31.9, 5.1)),
            'chip', 'USB-C insulated tongue', (0, -15, 0), ARCH,
            '24 illustrative contact surfaces; exact USB implementation is unspecified.')
    for row, z in [('upper', 5.425), ('lower', 4.725)]:
        for i in range(12):
            x = (i - 5.5) * .5
            _record('USB_C_%s_contact_%02d' % (row, i + 1),
                    Part.makeBox(.24, 2.2, .05, V(x - .12, -31.6, z)),
                    'gold', 'USB-C contact', (0, -15, 0), ARCH,
                    'Contact geometry illustrative, not a routing or pinout definition.', 'Hub contacts')

    # 24 breakaway contacts: 2 rows, 12 per ear group, plus retention magnets.
    # There is no claim that the connector pinout or retention force is resolved.
    receiver = _ybox(26, 7, 2.65, 1.4, (0, 29.6, 7.7))
    receiver = receiver.cut(_ybox(24, 5.1, .65, .9, (0, 31.8, 7.7)))
    plug = _roll_edge(rounded_box(25, 6.4, 4.8, 1.35), 4.8, .6)
    plug = _roll_edge(plug, 0, .3)
    plug.rotate(V(), V(1, 0, 0), -90)
    plug.translate(V(0, 32.5, 7.7))
    key = Part.makeBox(1.6, 1.1, 1.1, V(-10.9, 32.1, 9.75))
    receiver = receiver.fuse(key)
    plug = plug.cut(Part.makeBox(1.8, 1.4, 1.3, V(-11.0, 32.4, 9.65)))
    for i, x in enumerate((-11.2, 11.2)):
        receiver = receiver.cut(cylinder(.95, 2.0, (x, 30.3, 7.7), (0, 1, 0)))
        plug = plug.cut(cylinder(.95, 1.8, (x, 32.4, 7.7), (0, 1, 0)))
        _record('Breakaway_receiver_magnet_%d' % (i + 1),
                cylinder(.90, 1.85, (x, 30.3, 7.7), (0, 1, 0)),
                'steel', 'Receiver retention magnet', (0, 16, 0), CABLE,
                'Illustrative magnet envelope; pull force and release behavior are unvalidated.', 'Hub connector')
        _record('Breakaway_plug_magnet_%d' % (i + 1),
                cylinder(.90, 1.70, (x, 32.5, 7.7), (0, 1, 0)),
                'steel', 'Cable-plug retention magnet', (0, 34, 0), CABLE,
                'Illustrative magnet envelope; polarity and retention strength require engineering.', 'Hub connector')
    for ear, xs in [('L', [-8.4, -6.9, -5.4, -3.9, -2.4, -.9]),
                    ('R', [.9, 2.4, 3.9, 5.4, 6.9, 8.4])]:
        for row, z in enumerate((6.85, 8.55)):
            for column, x in enumerate(xs):
                number = row * 6 + column + 1
                plug = plug.cut(cylinder(.39, .85, (x, 32.45, z), (0, 1, 0)))
                _record('Breakaway_%s_pad_%02d' % (ear, number),
                        cylinder(.38, .38, (x, 31.8, z), (0, 1, 0)),
                        'gold', '%s-ear breakaway receiver contact %02d' % (ear, number),
                        (0, 16, 0), CABLE,
                        '24 positions chosen to preserve approximately 12 lines per ear; no pin assignment specified.',
                        'Hub contacts')
                _record('Breakaway_%s_pin_%02d' % (ear, number),
                        cylinder(.34, 1.12, (x, 32.18, z), (0, 1, 0)),
                        'gold', '%s-ear spring contact %02d' % (ear, number),
                        (0, 34, 0), CABLE,
                        'Representative spring-contact envelope; travel and force unspecified.', 'Hub contacts')
    _record('Breakaway_receiver', receiver, 'face',
            'Recessed magnetic receiver with asymmetric physical key',
            (0, 16, 0), CABLE, '26 × 7 mm face; one offset key prevents reversed mating. ' + ASSUMED,
            'Hub connector')
    _record('Breakaway_cable_plug', plug, 'shell', 'Mated 24-contact keyed breakaway plug',
            (0, 34, 0), CABLE, '25 × 6.4 × 4.8 mm provisional plug body.', 'Hub connector')
    neck = Part.makeCone(2.5, 1.65, 6.0, V(0, 37.3, 7.7), V(0, 1, 0))
    for y in (38.7, 40.2, 41.7):
        groove = cylinder(3, .4, (0, y, 7.7), (0, 1, 0))
        groove = groove.cut(cylinder(1.8, .6, (0, y - .1, 7.7), (0, 1, 0)))
        neck = neck.cut(groove)
    _record('Breakaway_strain_relief', neck, 'silicone', 'Flexible cable exit with relief grooves',
            (0, 34, 0), CABLE, 'Round 1.65 mm exit supports the provisional 3.0 mm diameter trunk; '
            'final centreline is recorded in connector_cable_exit_mm.',
            'Hub connector')

    # Rear spring clip: true open air gap, return bend and lifted release tip.
    # The assembled clip is a single solid, fastened through the chassis floor.
    spine = rounded_box(13, 36.4, 1.15, 2.2, (0, 0, -5.0))
    bend = cylinder(2.5, 13, (-6.5, 17, -2.5), (1, 0, 0))
    bend = bend.cut(cylinder(1.35, 13.2, (-6.6, 17, -2.5), (1, 0, 0)))
    bend = bend.common(Part.makeBox(14, 4, 6, V(-7, 16.8, -5.5)))
    foot = rounded_box(13, 8.4, 1.15, 1.2, (0, 13, -1.15))
    profile = [(-17.0, -5.0), (-22.0, -3.6), (-21.6, -2.5), (-16.8, -3.85)]
    wire = Part.makePolygon([V(-6.5, y, z) for y, z in profile] + [V(-6.5, *profile[0])])
    tip = Part.Face(Part.Wire(wire.Edges)).extrude(V(13, 0, 0))
    clip = spine.fuse(bend).fuse(foot).fuse(tip).removeSplitter()
    for x in (-4.4, 4.4):
        clip = clip.cut(cylinder(.75, 1.6, (x, 13, -1.3)))
    for i, y in enumerate((-13, -9, -5)):
        grip = Part.makeBox(8, .45, .18, V(-4, y, -5.05))
        clip = clip.cut(grip)
    _record('Rear_spring_clip', clip, 'shell', 'Collar/belt spring clip with open jaw and release lip',
            (0, 0, -25), ARCH,
            '13 mm wide, approximately 42 mm long; 3.85 mm free jaw gap. Material, spring force '
            'and flex life require development. Rear extent 5 mm beyond shell.')
    for i, x in enumerate((-4.4, 4.4)):
        # The head sits on the exterior of the clip; its shaft runs upward
        # through the clip and the chassis floor.
        screw = cylinder(.64, 2.45, (x, 13, -1.15)).fuse(cylinder(1.12, .29, (x, 13, -1.44)))
        screw = screw.cut(Part.makeBox(1.6, .22, .18, V(x - .8, 12.89, -1.46)))
        _record('Clip_fastener_%d' % (i + 1), screw, 'steel', 'Rear clip fastener',
                (0, 0, -25), notes='Illustrative fastener; threads not modeled.')

    sx, sy, sz = REPACK_SCALE
    return {
        'origin_mm': list(ORIGIN),
        'nominal_shell_mm': {'width_x': 25, 'height_y': 77, 'depth_z': 12},
        'packaging_scale_from_previous_provisional_layout': list(REPACK_SCALE),
        'shell_wall_mm_xy': [1.4 * sx, 1.4 * sy],
        'floor_roof_mm': 1.3 * sz,
        'rear_clip_extension_mm': 5 * sz,
        'button_extension_mm': -.07 * sz,
        'button_oval_mm_xy': [9.6 * sx, 9.6 * sy],
        'top_edge_roll_semiaxes_mm_xyz': [1.3 * sx, 1.3 * sy, 1.3 * sz],
        'bottom_edge_roll_semiaxes_mm_xyz': [1.15 * sx, 1.15 * sy, 1.15 * sz],
        'front_finish': 'Plain slender rolled lid; no wordmark; single oval concave stop and small status lens',
        'battery_envelope_mm': [23 * sx, 34 * sy, 4.4 * sz],
        'main_pcb_envelope_mm': [28 * sx, 50 * sy, .8 * sz],
        'stimulation_pcb_envelope_mm': [11.4 * sx, 16 * sy, .8 * sz],
        'usb_shell_envelope_mm_xyz': [9.2, 6.7, 3.2],
        'usb_geometry_status': 'Dimensions and contact pitch preserved; port relocated to the revised shell',
        'connector_positions': 24,
        'connector_pinout_status': 'Unspecified; 12 representative positions allocated per ear',
        'connector_cable_exit_mm': [65, ORIGIN[1] + 43.3 * sy, 7.7 * sz],
        'connector_cable_exit_direction': [0, 1, 0],
        'connector_neck_end_radius_mm': 1.65,
        'connector_neck_root_radius_mm': 2.5,
        'connector_neck_length_mm': 6 * sy,
        'provisional_trunk_diameter_mm': 3.0,
        'minimum_board_domain_gap_mm': 3.3 * sx,
        'dimension_status': ASSUMED,
        'electronics_status': ELECTRONIC,
    }


if __name__ == '__main__':
    from common import PARTS
    metrics = build_hub()
    invalid = [(p['name'], p['shape'].isValid(), len(p['shape'].Solids), p['shape'].Volume)
               for p in PARTS if not p['shape'].isValid() or not p['shape'].Solids]
    print(metrics)
    print('Registered hub parts:', len(PARTS))
    print('Invalid or non-solid parts:', invalid)
    if invalid:
        raise RuntimeError('Hub geometry validation failed')

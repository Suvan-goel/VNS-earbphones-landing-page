"""Preserve exact saved solids while adding native CAD colours and visibility.

Load the saved document in the headless core before starting the optional GUI
module. Opening a headless-generated document after GUI startup can block on an
unattended modal dialog. Creating a fresh view-enabled document from its saved
shapes avoids that path; no geometry is regenerated or altered.
"""
import sys
import os
import json
from pathlib import Path

os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')
sys.path.append('/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
from common import MATERIALS

out = Path(__file__).resolve().parent.parent
manifest = json.loads((out / 'model-manifest.json').read_text())
print('Reading exact saved geometry in the CAD core', flush=True)
source = App.openDocument(str(out / 'editable.FCStd'))
print('Read', len(source.Objects), 'source objects', flush=True)

import FreeCADGui as Gui
Gui.showMainWindow()
import Import

doc = App.newDocument('CYMBA_v03_Premium')
doc.Label = 'CYMBA v0.3 — refined concept assembly'
doc.Comment = 'Refined concept geometry; dimensions and engineering allocations remain provisional.'
groups = {}
objects = []
hidden_groups = {'Fit kit', 'Cable section'}
for p in manifest['parts']:
    original = source.getObject(p['objectName'])
    if original is None or not original.Shape.isValid():
        raise RuntimeError('Missing or invalid saved shape: ' + p['objectName'])
    group = p['group']
    if group not in groups:
        g = doc.addObject('App::DocumentObjectGroup', 'Group' + str(len(groups)))
        g.Label = group
        groups[group] = g
    obj = doc.addObject('Part::Feature', p['objectName'])
    obj.Label = original.Label
    # Share the saved immutable topology without rebuilding its geometry.
    obj.Shape = original.Shape
    groups[group].addObject(obj)
    for prop in ('Role', 'Source', 'Assumptions', 'Finish'):
        obj.addProperty('App::PropertyString', prop, 'Specification')
        setattr(obj, prop, getattr(original, prop))
    obj.addProperty('App::PropertyVector', 'ExplodeOffset', 'Specification')
    obj.ExplodeOffset = original.ExplodeOffset
    if 'ContactFaceArea' in original.PropertiesList:
        obj.addProperty('App::PropertyArea', 'ContactFaceArea', 'Specification')
        obj.ContactFaceArea = original.ContactFaceArea
    obj.ViewObject.ShapeColor = tuple(MATERIALS[p['material']]['color'])
    obj.ViewObject.LineColor = (.08, .08, .09)
    obj.ViewObject.DisplayMode = 'Shaded'
    obj.ViewObject.Deviation = .05
    obj.ViewObject.AngularDeflection = 12
    obj.ViewObject.Visibility = group not in hidden_groups
    # FreeCAD may normalize a placement quaternion on assignment, producing
    # roundoff at approximately 1e-15. Partner identity confirms the underlying
    # topology is literally unchanged; the matrices verify the same position.
    before = original.Shape.Placement.toMatrix().A
    after = obj.Shape.Placement.toMatrix().A
    placement_error = max(abs(a - b) for a, b in zip(before, after))
    if (not obj.Shape.isValid() or not obj.Shape.isPartner(original.Shape)
            or placement_error > 1e-12):
        raise RuntimeError('Transferred geometry differs: ' + obj.Name)
    objects.append(obj)
    if len(objects) % 50 == 0:
        print('Styled and validated', len(objects), 'objects', flush=True)

for label, group in groups.items():
    group.ViewObject.Visibility = label not in hidden_groups
doc.recompute()
styled = out / 'editable-styled.FCStd'
doc.saveAs(str(styled))
print('Saved coloured native document:', len(objects), 'unchanged shapes', flush=True)

for side in ('L', 'R'):
    earbud = [obj for obj, part in zip(objects, manifest['parts'])
              if part['group'] == ('Left earbud' if side == 'L' else 'Right earbud')]
    Import.export(earbud, str(out / ('earbud-' + side + '.step')))
    print('Saved', side, 'earbud STEP with', len(earbud), 'objects', flush=True)

# Replace only after every copy and both exports succeed. Assembly and fit-kit
# STEP files already contain the final geometry and remain untouched.
os.replace(styled, out / 'editable.FCStd')
print('Finished native styling and individual earbud exports', flush=True)

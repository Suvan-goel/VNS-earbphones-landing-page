const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readModel(suffix = '') {
  const bytes = fs.readFileSync(path.join(__dirname, '../public/models/cymba-earbuds-premium' + suffix + '.glb'));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  return { bytes, json: JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12))) };
}
const desktop = readModel(), mobile = readModel('-mobile');
for (const [name, model, budget] of [['desktop', desktop, 400000], ['mobile', mobile, 200000]]) {
  test(`${name}: complete material-separated assemblies stay within the download budget`, () => {
    assert.ok(model.bytes.length < budget);
    assert.equal(model.json.images?.length || 0, 0, 'No baked lighting atlas');
    for (const side of ['L', 'R']) {
      const assembly = model.json.nodes.find(n => n.name === `Earbud_${side}`);
      assert.equal(assembly.extras.cymbaEarbudVersion, 2);
      assert.equal(assembly.children.length, 7);
      const axis = assembly.extras.cableAxis;
      assert.ok(Math.abs(Math.hypot(...axis) - 1) < 1e-6);
      assert.ok(axis[1] < -0.5, 'Cable outlet points down from its sleeve');
      assert.ok(assembly.extras.cableOutlet.every(Number.isFinite));
      const roles = assembly.children.map(i => model.json.nodes[i].extras.cymbaPart);
      assert.ok(roles.includes('silicone'), 'Desktop transmission can identify the tip');
    }
    for (const accessor of model.json.accessors) {
      if (accessor.min) assert.ok(accessor.min.every(Number.isFinite));
      if (accessor.max) assert.ok(accessor.max.every(Number.isFinite));
    }
  });
}
test('desktop and mobile retain identical fitting frames and mirrored cable attachments', () => {
  for (const side of ['L', 'R']) {
    const a = desktop.json.nodes.find(n => n.name === `Earbud_${side}`);
    const b = mobile.json.nodes.find(n => n.name === `Earbud_${side}`);
    assert.deepEqual(a.extras, b.extras);
    for (const key of ['translation', 'rotation', 'scale', 'matrix']) assert.deepEqual(a[key], b[key]);
  }
  const left = desktop.json.nodes.find(n => n.name === 'Earbud_L').extras;
  const right = desktop.json.nodes.find(n => n.name === 'Earbud_R').extras;
  for (const key of ['cableOutlet', 'cableAxis']) {
    assert.deepEqual(right[key], [-left[key][0], left[key][1], left[key][2]]);
  }
  assert.deepEqual(desktop.json.materials, mobile.json.materials);
});

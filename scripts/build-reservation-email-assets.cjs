const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const source = fs.existsSync(path.join(root, 'src/assets')) ? path.join(root, 'src') : root;
(async () => {
  // This is the current homepage's hero poster, also used before its 3D model loads.
  const product = await sharp(path.join(root, 'public/models/cymba-earbuds-hero-poster.webp')).trim().resize({ height: 600, withoutEnlargement: true }).png({ palette: true, quality: 90 }).toBuffer();
  const mark = await sharp(path.join(source, 'assets/brand/cymba-flow-mark-charcoal.png')).trim().resize({ height: 72, withoutEnlargement: true }).png({ palette: true }).toBuffer();
  const output = { product: product.toString('base64'), mark: mark.toString('base64') };
  fs.writeFileSync(path.join(source, 'lib/reservation-email-assets.ts'), '// Generated from existing cymba artwork by scripts/build-reservation-email-assets.cjs.\n// Inline CID attachments work without public image hosting or tracking requests.\nexport const reservationEmailAssets = ' + JSON.stringify(output) + ' as const;\n');
  console.log(JSON.stringify({productBytes:product.length,markBytes:mark.length}));
})();

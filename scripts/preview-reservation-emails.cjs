const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = fs.existsSync(path.join(root, 'src/lib')) ? path.join(root, 'src') : root;
const output = path.join(root, 'output', 'reservation-email-previews');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  function req(name) {
    if (name.startsWith('.') || name.startsWith('@/')) return load((name.startsWith('@/') ? path.join(source, name.slice(2)) : path.resolve(path.dirname(file), name)) + '.ts');
    return require(name);
  }
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { Buffer, Date, Intl })(req, module, module.exports);
  return module.exports;
}
const { reservationEmail } = load(path.join(source, 'lib/reservation-email-template.ts'));
const { CURRENT_TERMS_VERSION } = load(path.join(source, 'content/terms/version.ts'));
const kinds = ['paid', 'processing', 'failed', 'partially_refunded', 'refunded', 'refund_review'];
fs.mkdirSync(output, { recursive: true });
for (const currency of ['gbp','usd']) for (const kind of kinds) {
  const amount = currency === 'gbp' ? 3500 : 5000;
  const email = reservationEmail({ id: 'preview', reservation_id: 'preview', kind, created_at: '2026-10-30T12:00:00Z', snapshot: {
    id: 'example-reservation', email: 'customer@example.com', status: kind, livemode: false,
    amount, currency, amount_refunded: kind === 'refunded' ? amount : kind === 'partially_refunded' ? 1000 : 0,
    founder_number: ['processing','failed'].includes(kind) ? null : 16,
    founder_position: 3, terms_version: CURRENT_TERMS_VERSION, terms_accepted_at: '2026-10-30T11:59:00Z', paid_at: '2026-10-30T12:00:00Z',
  } });
  let previewHtml = email.html;
  for (const attachment of email.attachments ?? []) {
    if (!attachment.content_id) continue;
    fs.writeFileSync(path.join(output, attachment.filename), Buffer.from(attachment.content, 'base64'));
    previewHtml = previewHtml.replaceAll(`cid:${attachment.content_id}`, attachment.filename);
  }
  fs.writeFileSync(path.join(output, `${kind}-${currency}.html`), previewHtml);
  fs.writeFileSync(path.join(output, `${kind}-${currency}.txt`), `Subject: ${email.subject}\n\n${email.text}`);
  const confirmation = email.attachments?.find(file => file.filename.endsWith('.txt'));
  if (confirmation) fs.writeFileSync(path.join(output, `confirmation-attachment-${currency}.txt`), Buffer.from(confirmation.content, 'base64'));
}
const labels = ['Reservation confirmed','Payment processing','Payment unsuccessful','Partial refund','Full refund','Refund needs attention'];
fs.writeFileSync(path.join(output,'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>cymba email previews</title><style>*{box-sizing:border-box}body{margin:0;font:14px -apple-system,BlinkMacSystemFont,Arial,sans-serif;background:#ededf0;color:#1d1d1f}header{padding:24px;display:flex;gap:20px;align-items:center;flex-wrap:wrap;background:#fff;border-bottom:1px solid #ddd}h1{font-size:20px;margin:0}select,button{font:inherit;padding:10px 12px;border-radius:24px;border:1px solid #ccc;background:white}iframe{display:block;border:0;width:100%;max-width:760px;height:calc(100vh - 120px);min-height:700px;margin:20px auto;background:white}p{margin:0;font-size:12px;color:#666}@media(max-width:500px){header{padding:16px;gap:12px}iframe{margin:0}}</style><header><h1>cymba · customer emails</h1><select id="kind" aria-label="Email type">${kinds.map((k,i)=>`<option value="${k}">${labels[i]}</option>`).join('')}</select><select id="currency" aria-label="Currency"><option value="gbp">GBP · £35</option><option value="usd">USD · $50</option></select><button id="size">Phone preview</button><p>Design preview · synthetic DEMO reference · no email sent</p></header><iframe title="Email preview" src="paid-gbp.html"></iframe><script>const frame=document.querySelector('iframe');const kind=document.querySelector('#kind');const currency=document.querySelector('#currency');function update(){frame.src=kind.value+'-'+currency.value+'.html'}kind.onchange=currency.onchange=update;document.querySelector('#size').onclick=e=>{const phone=frame.style.maxWidth!=='390px';frame.style.maxWidth=phone?'390px':'760px';e.target.textContent=phone?'Desktop preview':'Phone preview'};</script></html>`);
console.log(output);

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createHash } = require("node:crypto");
const test = require("node:test");
const ts = require("typescript");
const { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } = require("pdf-lib");

const ROOT = path.resolve(__dirname, "..");
const SESSION = "cs_live_private_confirmation";
const HANDLE = createHash("sha256").update(`receipt:${SESSION}`).digest("hex");
const COOKIE = `cymba-reservation-receipt-${HANDLE}`;
const VERSION = "2026-10-29-launch-q3";
const base = {
  id: "private-reservation-id", email: "private@example.com", stripe_session_id: SESSION,
  stripe_payment_intent: "pi_private", stripe_customer: "cus_private", status: "paid", livemode: true,
  amount: 3500, currency: "gbp", amount_refunded: 0, founder_number: 12,
  paid_at: "2026-10-29T12:34:56Z", terms_accepted_at: "2026-10-29T12:33:00Z", terms_version: VERSION,
};

function application(options = {}) {
  const calls = { lookups: [] };
  const cache = new Map();
  const jar = options.jar ?? { [COOKIE]: SESSION };
  const context = vm.createContext({ URL, Response, Date, Intl, Uint8Array, ArrayBuffer, process: { env: {} } });
  function load(relative) {
    const filename = path.isAbsolute(relative) ? relative : path.join(ROOT, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const localRequire = (name) => {
      if (name === "server-only") return {};
      if (name === "next/headers") return { cookies: async () => ({ get: (key) => jar[key] ? { value: jar[key] } : undefined }) };
      if (name === "@/lib/storage") return { lookupReservation: async (session) => {
        calls.lookups.push(session);
        return options.lookup ?? { status: "found", reservation: { ...base, ...options.row } };
      } };
      if (name === "@/lib/stripe") return { PREVIEW_SESSION_PREFIX: "cs_preview_", previewMode: () => false };
      if (name === "@/components/LegalPage") return { LegalPage: function LegalPage() {} };
      if (name.startsWith("@/") || name.startsWith(".")) {
        const file = name.startsWith("@/") ? path.join(ROOT, "src", name.slice(2)) : path.resolve(path.dirname(filename), name);
        return load([".ts", ".tsx"].map((extension) => file + extension).find(fs.existsSync));
      }
      return require(name);
    };
    // pdf-lib validates native arrays by realm; execute its renderer beside the library.
    const evaluate = filename.endsWith("reservation-confirmation-pdf.ts")
      ? new Function("require", "module", "exports", source)
      : vm.runInContext(`(function(require,module,exports){${source}\n})`, context, { filename });
    evaluate(localRequire, module, module.exports);
    return module.exports;
  }
  return {
    calls, load,
    text: () => load("src/lib/reservation-confirmation.ts").reservationConfirmationText({ ...base, ...options.row }),
    request: (query = `receipt=${HANDLE}`) => load("src/app/reserve/complete/confirmation/route.ts").GET(new Request(`https://trycymba.com/reserve/complete/confirmation?${query}`)),
  };
}

async function readPdf(response) {
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
  const pdf = await PDFDocument.load(bytes);
  const texts = [];
  for (const page of pdf.getPages()) {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray
      ? Array.from({ length: contents.size() }, (_, i) => contents.lookup(i, PDFRawStream))
      : [contents];
    const lines = streams.flatMap((stream) => {
      const operators = Buffer.from(decodePDFRawStream(stream).decode()).toString();
      return Array.from(operators.matchAll(/<([0-9A-F]+)>\s*Tj/g), (match) => Buffer.from(match[1], "hex").toString("latin1").replace(/[\x80-\x9f]/g, (char) => ({
        128: "€", 130: "‚", 131: "ƒ", 132: "„", 133: "…", 134: "†", 135: "‡", 136: "ˆ", 137: "‰", 138: "Š", 139: "‹", 140: "Œ", 142: "Ž",
        145: "‘", 146: "’", 147: "“", 148: "”", 149: "•", 150: "–", 151: "—", 152: "˜", 153: "™", 154: "š", 155: "›", 156: "œ", 158: "ž", 159: "Ÿ",
      }[char.charCodeAt(0)] ?? char)));
    });
    texts.push(lines.join(" "));
  }
  return { text: texts.join(" ").replace(/\s+/g, " "), pages: pdf.getPageCount(), cover: texts[0] };
}

function descendants(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap((child) => descendants(child, predicate));
  if (!tree || !tree.props) return [];
  return [...(predicate(tree) ? [tree] : []), ...descendants(tree.props.children, predicate)];
}

test("confirmation requires the matching receipt cookie and rejects ambiguous or private query inputs", async () => {
  for (const query of ["", "receipt=wrong", `receipt=${HANDLE}&receipt=${HANDLE}`, `receipt=${HANDLE}&session_id=${SESSION}`, `receipt=${HANDLE}&email=private@example.com`, `receipt=${HANDLE}&format=other`, `receipt=${HANDLE}&format=terms&format=terms`]) {
    const app = application();
    const response = await app.request(query);
    assert.equal(response.status, 404);
    assert.equal(app.calls.lookups.length, 0);
    assert.match(response.headers.get("cache-control"), /no-store/);
  }
  for (const jar of [{}, { [COOKIE]: "cs_live_someone_else" }, { [COOKIE]: "malformed" }]) {
    const app = application({ jar });
    assert.equal((await app.request()).status, 404);
    assert.equal((await app.request(`receipt=${HANDLE}&format=terms`)).status, 404);
    assert.equal(app.calls.lookups.length, 0);
  }
});

test("paid confirmation downloads a one-page receipt and separate recorded terms without private identifiers", async () => {
  const app = application();
  const response = await app.request();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("content-disposition"), 'attachment; filename="cymba-reservation-confirmation.pdf"');
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const pdf = await readPdf(response);
  assert.equal(pdf.pages, 1);
  const terms = await app.request(`receipt=${HANDLE}&format=terms`);
  assert.equal(terms.status, 200);
  assert.equal(terms.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(terms.headers.get("content-disposition"), 'attachment; filename="cymba-recorded-terms.txt"');
  assert.match(terms.headers.get("cache-control"), /private.*no-store/);
  const text = await terms.text();
  assert.ok(pdf.text.includes("Reservation confirmed"));
  assert.ok(pdf.text.includes("DEPOSIT RECORDED £35.00"));
  assert.ok(pdf.text.includes(`Recorded terms: ${VERSION}`));
  assert.ok(pdf.text.includes("Terms accepted: 29 Oct 2026, 12:33 UTC"));
  assert.ok(!pdf.text.includes("TERMS FOR YOUR RECORDED VERSION"));
  assert.doesNotMatch(pdf.text, /SAMPLE|TEST|NOT A LIVE RESERVATION/);
  for (const privateValue of [SESSION, base.email, base.id, base.stripe_payment_intent, base.stripe_customer]) assert.ok(!pdf.text.includes(privateValue));
  assert.match(text, /Reservation number: #012/);
  assert.match(text, /Original deposit: GBP\s35\.00/);
  assert.match(text, /2026-10-29T12:34:56\.000Z/);
  assert.match(text, /£50 off the launch recommended retail price, 3 months/);
  assert.match(text, /Neither expiry of free months nor product activation alone authorises/);
  assert.match(text, /£400 in the UK, including applicable VAT/);
  assert.match(text, /£15 a month in the UK, including applicable VAT/);
  assert.match(text, /within 7 working days after receiving your cancellation request/);
  assert.match(text, /sooner where the law requires/);
  assert.match(text, /If expected shipping moves beyond Q3 2027/);
  assert.match(text, /Unless you agree to continue by that deadline, we will cancel/);
  assert.match(text, /stays earned even if the referred friend later cancels/);
  assert.match(text, /no cap on earned referral months and they do not expire/);
  const { currentTerms } = app.load("src/content/terms/current.ts");
  const { termsDocumentText } = app.load("src/content/terms/types.ts");
  assert.ok(text.includes(termsDocumentText(currentTerms)));
  for (const privateValue of [SESSION, base.email, base.id, base.stripe_payment_intent, base.stripe_customer]) assert.ok(!text.includes(privateValue));
});

test("historical confirmations never replace earlier benefits or terms with current promises", async () => {
  const app = application({ row: { terms_version: "2026-10-28" } });
  const text = app.text();
  assert.match(text, /TERMS FOR YOUR RECORDED VERSION/);
  assert.match(text, /This version did not promise the later launch-price discount/);
  assert.match(text, /and you can switch between the two/);
  assert.doesNotMatch(text, /2026-10-29-legal-update|Neither expiry of free months|including applicable VAT|within 7 working days/);
  const ambiguous = application({ row: { terms_version: "2026-10-28-founders-referrals" } }).text();
  assert.match(ambiguous, /VERSION AMBIGUITY/);
  assert.match(ambiguous, /and you can switch between the two/);
  assert.match(ambiguous, /selected automatically by location/);
  assert.doesNotMatch(ambiguous, /Neither expiry of free months|including applicable VAT|within 7 working days/);
  const unknown = application({ row: { terms_version: "unsupported-old-version" } }).text();
  assert.match(unknown, /HISTORICAL TERMS UNAVAILABLE/);
  assert.doesNotMatch(unknown, /TERMS FOR YOUR RECORDED VERSION|2026-10-29-legal-update|3 months of software/);
});

test("archived legal text remains identical to the verified source snapshots", () => {
  // These are immutable legal evidence, not snapshots to update when copy changes.
  // New wording must receive a new version and must leave these documents intact.
  const snapshots = {
    "2026-10-29-contact-email": "9a94d51031a411fae7d963249a7841e5ab7798333062e2b6d0240e649b52a965",
    "2026-10-29-legal-update": "7a5b17b074fa8707dbcc0ea13e35b7f78f0cf154dd58af52817ba903310b7336",
    "2026-10-25-founders-edition": "bf5dc57a3b32bf99e360bbc358f27f1b0971233d0f41d849a2a0ab6c49348c21",
    "2026-10-25-initial": "7200d31e191bb589379eab15f6af95dc74d8497df158f0ea0f35bb9d0941edb7",
    "2026-10-25-visuals-update": "f4f77957d647e025b869e102db9eab325d371293c7cfd50f5dd1c28c4a6f2c54",
    "2026-10-28-founders-referrals-initial": "30d5b9af20859b39282bf2047e34345cad215672a550c8453fab3a1d68874cf1",
    "2026-10-28-founders-referrals": "b5b8201b3205fc5675e8e15bfdae535f50d29d947dcae6da4f9371d5bbfb6607",
    "2026-10-28": "de4c283f821ecf80465c4c522ac72b0550c00914190506e656d4da105e51b480",
  };
  const app = application();
  for (const [file, expected] of Object.entries(snapshots)) {
    const { document } = app.load(`src/content/terms/archive/${file}.ts`);
    assert.equal(createHash("sha256").update(JSON.stringify(document)).digest("hex"), expected, file);
  }
});

test("later reservation numbers and refund states do not invent Founder promotion or active benefits", async () => {
  for (const row of [
    { founder_number: 51 }, { status: "refunded", amount_refunded: 3500 },
    { status: "partially_refunded", amount_refunded: 1000 }, { status: "refund_review" },
  ]) {
    const response = await application({ row }).request();
    assert.equal(response.status, 200);
    const summary = application({ row }).text().split("TERMS FOR YOUR RECORDED VERSION")[0];
    assert.doesNotMatch(summary, /qualifies for|within the first 50:/);
    assert.match(summary, /confirmed separately|no longer active|need confirmation/);
  }
});

test("unconfirmed, missing, unavailable and malformed payments never yield a confirmation attachment", async () => {
  for (const [options, status] of [
    ...["pending", "processing", "expired", "failed"].map((state) => [{ row: { status: state } }, 409]),
    [{ lookup: { status: "not_found" } }, 404], [{ lookup: { status: "unavailable" } }, 503],
    [{ row: { amount: -1 } }, 503], [{ row: { amount_refunded: 4000 } }, 503], [{ row: { currency: "malformed" } }, 503],
  ]) {
    const response = await application(options).request();
    assert.equal(response.status, status);
    assert.equal(response.headers.get("content-disposition"), null);
    assert.match(response.headers.get("cache-control"), /no-store/);
    const terms = await application(options).request(`receipt=${HANDLE}&format=terms`);
    assert.equal(terms.status, status);
    assert.equal(terms.headers.get("content-disposition"), null);
  }
});

test("Terms page and reservation configuration use the same versioned contract with preserved anchors", () => {
  const app = application();
  const { currentTerms } = app.load("src/content/terms/current.ts");
  const { reservation } = app.load("src/config/reservation.ts");
  assert.equal(reservation.termsVersion, currentTerms.version);
  const page = app.load("src/app/terms/page.tsx").default();
  const headings = descendants(page, (node) => node.type === "h2").map((node) => node.props.id);
  assert.equal(headings.length, new Set(headings).size);
  for (const anchor of ["pricing", "reservations", "founding-offer", "referrals", "refunds", "cancellation-form"]) assert.ok(headings.includes(anchor));
  assert.deepEqual(Array.from(page.props.sections, (section) => section.id), headings);
});


test("all confirmation versions display the current support email without changing archived terms or benefits", async () => {
  for (const version of [VERSION, "2026-10-29-contact-email", "2026-10-29-legal-update", "2026-10-28-founders-referrals", "2026-10-28", "2026-10-25", "unknown-version"]) {
    const app = application({ row: { terms_version: version } });
    const text = app.text();
    assert.match(text, /support@trycymba\.com/);
    assert.doesNotMatch(text, /[a-z0-9._+-]+@muraband\.com/i);
    assert.ok(text.includes(`Recorded terms version: ${version}`));
    const { termsArchive } = app.load("src/content/terms/history.ts");
    const { termsDocumentText } = app.load("src/content/terms/types.ts");
    for (const document of termsArchive(version).documents) {
      const original = termsDocumentText(document);
      assert.ok(text.includes(original.replaceAll("support@muraband.com", "support@trycymba.com")));
      if (original.includes("support@muraband.com")) assert.match(text, /Contact-address update:/);
    }
    if (version === VERSION || version === "2026-10-29-contact-email" || version === "2026-10-29-legal-update") {
      assert.match(text, /£50 off the launch recommended retail price, 3 months/);
    }
  }
});

test("archived contact update changes only the address and version from the previous terms", () => {
  const app = application();
  const { document } = app.load("src/content/terms/archive/2026-10-29-legal-update.ts");
  const { document: contactTerms } = app.load("src/content/terms/archive/2026-10-29-contact-email.ts");
  const expected = JSON.stringify(document)
    .replaceAll("support@muraband.com", "support@trycymba.com")
    .replaceAll("2026-10-29-legal-update", "2026-10-29-contact-email");
  assert.equal(JSON.stringify(contactTerms), expected);
});

test("Q3 launch terms update the dates while existing reservations retain their accepted terms and benefits", async () => {
  const app = application({ row: { terms_version: "2026-10-29-contact-email" } });
  const { currentTerms } = app.load("src/content/terms/current.ts");
  const { document } = app.load("src/content/terms/archive/2026-10-29-contact-email.ts");
  const expected = JSON.stringify(document)
    .replaceAll("Q4 2027", "Q3 2027")
    .replaceAll("2026-10-29-contact-email", VERSION);
  assert.equal(JSON.stringify(currentTerms), expected);
  const text = app.text();
  assert.match(text, /We plan to launch cymba in Q4 2027/);
  assert.match(text, /If expected shipping moves beyond Q4 2027/);
  assert.match(text, /£50 off the launch recommended retail price, 3 months/);
  assert.doesNotMatch(text, /Q3 2027/);
});

test('Founder benefits use recorded payment position independently of public reference', async () => {
  for (const [founder_number, founder_position, eligible] of [[16, 3, true], [63, 50, true], [64, 51, false]]) {
    const text = application({ row: { founder_number, founder_position } }).text();
    const summary = text.split('TERMS FOR YOUR RECORDED VERSION')[0];
    assert.ok(summary.includes(`Reservation number: #${String(founder_number).padStart(3, '0')}`));
    assert.equal(summary.includes('within the first 50:'), eligible);
  }
});


test("all PDF variants remain one page with accurate benefits and refunds; historical terms stay separate", async () => {
  for (const row of [
    { currency: "usd", amount: 5000 },
    { founder_number: 64, founder_position: 51 },
    { terms_version: "2026-10-28" },
    { terms_version: "2026-10-28-founders-referrals" },
    { terms_version: "unsupported-old-version" },
    { status: "refunded", amount_refunded: 3500 },
    { status: "partially_refunded", amount_refunded: 1000, currency: "usd" },
    { status: "refund_review" },
    { livemode: false },
  ]) {
    const app = application({ row });
    const response = await app.request();
    assert.equal(response.status, 200);
    const pdf = await readPdf(response);
    assert.equal(pdf.pages, 1);
    assert.doesNotMatch(pdf.text, /Saved record & terms|ARCHIVED WORDING|TERMS FOR YOUR RECORDED VERSION/);
    const normalize = (value) => value.replace(/Saved on: [^ ]+ \(UTC\)/, "Saved on: [time]");
    const terms = await app.request(`receipt=${HANDLE}&format=terms`);
    assert.equal(terms.status, 200);
    const record = await terms.text();
    assert.equal(normalize(record), normalize(app.text()));
    if (row.status === "refunded") {
      assert.match(pdf.cover, /Reservation refunded/);
      assert.match(pdf.cover, /£0\.00/);
      assert.doesNotMatch(pdf.cover, /Reservation confirmed/);
    }
    if (row.status === "partially_refunded") assert.match(pdf.cover, /US\$25\.00/);
    if (row.livemode === false) assert.match(pdf.cover, /SAMPLE \/ TEST - NOT A LIVE RESERVATION/);
    if (row.terms_version === "unsupported-old-version") {
      assert.match(pdf.text, /does not reliably identify your Founder benefits/);
      assert.match(record, /HISTORICAL TERMS UNAVAILABLE/);
    }
    if (row.terms_version === "2026-10-28") assert.doesNotMatch(pdf.text, /£50 off|3 months of software/);
    if (row.terms_version === "2026-10-28-founders-referrals") assert.match(record, /VERSION AMBIGUITY/);
    if (row.founder_position === 51) assert.match(pdf.text, /outside the first 50/);
  }
});

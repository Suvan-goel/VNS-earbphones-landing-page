const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const ROOT = path.resolve(__dirname, "..");
const SESSION = "cs_live_private_checkout_receipt";
const handle = (session) => createHash("sha256").update(`receipt:${session}`).digest("hex");
const cookieName = (session) => `cymba-reservation-receipt-${handle(session)}`;
const HANDLE = handle(SESSION);
const RECEIPT_URL = `/reserve/complete?receipt=${HANDLE}`;
const row = (changes = {}) => ({
  id: "23f44412-32e8-4e1d-a06f-b615f9ff1491", email: "private@example.com", stripe_session_id: SESSION,
  status: "paid", livemode: true, amount: 5000, currency: "usd", amount_refunded: 0, founder_number: 1,
  ...changes,
});
const clone = (value) => JSON.parse(JSON.stringify(value));

// Exercise the real receipt route and page without Stripe, storage, or a browser network.
function app(options = {}) {
  const calls = { lookups: [], effects: [], purchases: [], cookieReads: 0 };
  const cookieJar = options.cookies ?? (options.cookie === undefined ? {} : { [cookieName(options.cookie)]: options.cookie });
  const cache = new Map();
  const context = vm.createContext({ URL, URLSearchParams, process: { env: { NODE_ENV: options.production ? "production" : "test" } } });
  function load(relative) {
    const filename = path.isAbsolute(relative) ? relative : path.join(ROOT, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = (specifier) => {
      if (specifier === "server-only") return {};
      if (specifier.endsWith(".css")) return {};
      if (specifier === "next/headers") return { cookies: async () => {
        calls.cookieReads++;
        return { get: (name) => cookieJar[name] === undefined ? undefined : { value: cookieJar[name] } };
      } };
      if (specifier === "next/navigation") return { redirect: (location) => { throw Object.assign(new Error("redirect"), { location }); } };
      if (specifier === "@/lib/storage") return { lookupReservation: async (session) => {
        calls.lookups.push(session);
        return typeof options.lookup === "function" ? options.lookup(session) : options.lookup ?? { status: "found", reservation: row(options.row) };
      } };
      if (specifier === "@/lib/stripe") return {
        PREVIEW_SESSION_PREFIX: "cs_preview_", previewMode: () => Boolean(options.preview),
        localReservationTestMode: () => Boolean(options.localTest),
      };
      if (specifier === "@/components/ReservationShell") return { ReservationShell: function ReservationShell() {} };
      if (specifier === "@/components/ReservationStatusRefresh") return { ReservationStatusRefresh: function ReservationStatusRefresh() {} };
      if (specifier === "@/lib/meta-pixel") return { trackMetaPurchase: (event) => calls.purchases.push(clone(event)) };
      if (specifier === "react") return { ...require("react"), useEffect: (effect) => calls.effects.push(effect) };
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const base = specifier.startsWith("@/") ? path.join(ROOT, "src", specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
        return load([".ts", ".tsx"].map((extension) => base + extension).find(fs.existsSync));
      }
      return require(specifier);
    };
    vm.runInContext(`(function(require,module,exports){${source}\n})`, context, { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  return {
    calls,
    helper: () => load("src/lib/reservation-receipt.ts"),
    route: () => load("src/app/api/reserve/receipt/route.ts").GET,
    page: (params = {}) => load("src/app/reserve/complete/page.tsx").default({ searchParams: Promise.resolve(params) }),
    conversion: (props) => load("src/components/ReservationConversion.tsx").ReservationConversion(props),
  };
}

function elements(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap((node) => elements(node, predicate));
  if (!tree || typeof tree !== "object" || !tree.props) return [];
  if (tree.type?.name === "ReservationStatusView") return elements(tree.type(tree.props), predicate);
  return [...(predicate(tree) ? [tree] : []), ...elements(tree.props.children, predicate)];
}

test("receipt exchange redirects to a clean URL with a bounded 30-day, server-only cookie", async () => {
  for (const production of [false, true]) {
    const instance = app({ production });
    const response = await instance.route()(new Request(`https://trycymba.com/api/reserve/receipt?session_id=${SESSION}&email=private%40example.com`));
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), RECEIPT_URL);
    assert.doesNotMatch(response.headers.get("location"), /cs_|session_id|email|private/);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.match(response.headers.get("cache-control"), /no-store/);
    const cookie = response.cookies.get(cookieName(SESSION));
    assert.equal(cookie.value, SESSION);
    assert.equal(cookie.path, "/reserve/complete");
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, "lax");
    assert.equal(cookie.secure, production);
    assert.equal(cookie.maxAge, 30 * 24 * 60 * 60);
    assert.equal(await response.text(), "");
    assert.equal(instance.calls.lookups.length, 0);
  }
});

test("malformed and ambiguous credentials cannot select a receipt or disturb another reservation", async () => {
  for (const query of ["", "paid=true", "session_id=", "session_id=not-a-session", "session_id=cs_", "session_id=cs_%0Aprivate", "session_id=cs_%3Cscript%3E", `session_id=cs_${"a".repeat(256)}`, `session_id=${SESSION}&session_id=cs_live_other`]) {
    const instance = app();
    const response = await instance.route()(new Request(`https://trycymba.com/api/reserve/receipt?${query}`));
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/reserve/complete");
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(instance.calls.lookups.length, 0);
  }
});

test("old completion links exchange their credential before rendering or reading payment status", async () => {
  const instance = app();
  await assert.rejects(instance.page({ session_id: SESSION, paid: "true", email: "private@example.com" }), (error) => {
    assert.equal(error.location, `/api/reserve/receipt?session_id=${SESSION}`);
    return true;
  });
  await assert.rejects(instance.page({ session_id: [SESSION, "cs_live_other"] }), (error) => {
    assert.equal(error.location, `/api/reserve/receipt?session_id=${SESSION}&session_id=cs_live_other`);
    return true;
  });
  await assert.rejects(instance.page({ paid: "true", client_secret: "private", email: "private@example.com" }), { location: "/reserve/complete" });
  await assert.rejects(instance.page({ receipt: HANDLE, client_secret: "private", email: "private@example.com" }), { location: RECEIPT_URL });
  assert.equal(instance.calls.cookieReads, 0);
  assert.equal(instance.calls.lookups.length, 0);
});

test("only a recorded live payment exposes a minimal, hashed purchase payload", async () => {
  const instance = app({ cookie: SESSION, row: { amount: 7500, currency: "gbp" } });
  const tree = await instance.page({ receipt: HANDLE });
  const purchases = elements(tree, (node) => node.type?.name === "ReservationConversion");
  assert.equal(purchases.length, 1);
  assert.deepEqual(clone(purchases[0].props), {
    eventId: createHash("sha256").update(`reservation:${row().id}`).digest("hex"), value: 75, currency: "GBP",
  });
  assert.equal(JSON.stringify(purchases[0].props).includes(row().id), false);
  assert.equal(JSON.stringify(purchases[0].props).includes(SESSION), false);
  assert.equal(JSON.stringify(purchases[0].props).includes(row().email), false);
  assert.deepEqual(instance.calls.lookups, [SESSION]);
});

test("pending, failed, refunded, demo, sandbox and malformed records never count as purchases", async () => {
  const cases = [
    ...["pending", "processing", "failed", "expired", "refunded", "partially_refunded", "refund_review"].map((status) => ({ row: { status } })),
    { row: { livemode: false } }, { row: { livemode: null } }, { row: { amount_refunded: 100 } },
    { row: { amount: 0 } }, { row: { amount: 0.5 } }, { localTest: true },
    { cookie: "cs_preview_example", preview: true },
    { lookup: { status: "not_found" } }, { lookup: { status: "unavailable" } },
  ];
  for (const options of cases) {
    const instance = app({ cookie: SESSION, ...options });
    const tree = await instance.page({ receipt: handle(options.cookie ?? SESSION) });
    assert.equal(elements(tree, (node) => node.type?.name === "ReservationConversion").length, 0, JSON.stringify(options));
  }
});

test("a live paid confirmation has production copy and separate protected PDF and terms links", async () => {
  const instance = app({ production: true, cookie: SESSION });
  const tree = await instance.page({ receipt: HANDLE });
  const rendered = elements(tree, (node) => typeof node.type === "string");
  const text = rendered.flatMap((node) => [node.props.children].flat(Infinity).filter((child) => typeof child === "string")).join(" ");
  assert.match(text, /Your place is reserved/);
  assert.doesNotMatch(text, /Demo result|Demo deposit|Stripe test reservation|Test emails|Local preview|sample reservation/);
  const links = rendered.filter((node) => node.type === "a").map((node) => node.props.href);
  assert.ok(links.includes(`/reserve/complete/confirmation?receipt=${HANDLE}`));
  assert.ok(links.includes(`/reserve/complete/confirmation?receipt=${HANDLE}&format=terms`));
  assert.ok(links.every((href) => !href.includes(SESSION) && !href.includes("session_id")));
});

test("receipt validation prevents storage reads for missing, malformed and disabled demo credentials", async () => {
  for (const cookie of [undefined, "", "untrusted", `cs_${"a".repeat(256)}`, "cs_preview_example"]) {
    const instance = app({ cookie });
    const tree = await instance.page({ receipt: handle(cookie ?? SESSION) });
    assert.equal(instance.calls.lookups.length, 0);
    assert.equal(elements(tree, (node) => node.type?.name === "ReservationConversion").length, 0);
  }
});

test("status refreshes preserve the opaque receipt handle without exposing checkout credentials", async () => {
  for (const status of ["pending", "processing"]) {
    const instance = app({ cookie: SESSION, row: { status } });
    const tree = await instance.page({ receipt: HANDLE });
    const refresh = elements(tree, (node) => node.type?.name === "ReservationStatusRefresh");
    assert.equal(refresh.length, 1);
    assert.deepEqual(clone(refresh[0].props), {});
    assert.equal(refresh[0].key, HANDLE);
    const links = elements(tree, (node) => node.type === "a").map((node) => node.props.href);
    assert.ok(links.includes(RECEIPT_URL));
    assert.ok(links.every((href) => !href.includes(SESSION) && !href.includes("session_id")));
  }
});

test("two reservation tabs keep their own receipt through later refreshes", async () => {
  const secondSession = "cs_live_second_private_receipt";
  const records = {
    [SESSION]: row({ status: "processing" }),
    [secondSession]: row({ id: "33f44412-32e8-4e1d-a06f-b615f9ff1491", stripe_session_id: secondSession, amount: 7500 }),
  };
  const cookies = {};
  const instance = app({ cookies, lookup: (session) => ({ status: "found", reservation: records[session] }) });
  for (const session of [SESSION, secondSession]) {
    const response = await instance.route()(new Request(`https://trycymba.com/api/reserve/receipt?session_id=${session}`));
    const cookie = response.cookies.get(cookieName(session));
    cookies[cookie.name] = cookie.value;
  }
  assert.equal(Object.keys(cookies).length, 2);
  const firstPending = await instance.page({ receipt: HANDLE });
  assert.equal(elements(firstPending, (node) => node.type?.name === "ReservationConversion").length, 0);
  const secondPaid = await instance.page({ receipt: handle(secondSession) });
  const secondPurchase = elements(secondPaid, (node) => node.type?.name === "ReservationConversion")[0].props;
  assert.equal(secondPurchase.value, 75);
  records[SESSION].status = "paid";
  const firstPaid = await instance.page({ receipt: HANDLE });
  const firstPurchase = elements(firstPaid, (node) => node.type?.name === "ReservationConversion")[0].props;
  assert.equal(firstPurchase.value, 50);
  assert.notEqual(firstPurchase.eventId, secondPurchase.eventId);
  assert.deepEqual(instance.calls.lookups, [SESSION, secondSession, SESSION]);
});

test("missing, malformed, duplicate or tampered receipt handles never select a stored reservation", async () => {
  const instance = app({ cookie: SESSION });
  for (const receipt of ["", "cs_private", "g".repeat(64), "a".repeat(63), [HANDLE, HANDLE]]) {
    await assert.rejects(instance.page({ receipt }), { location: "/reserve/complete" });
  }
  for (const params of [{}, { receipt: "a".repeat(64) }]) {
    const tree = await instance.page(params);
    assert.equal(elements(tree, (node) => node.type?.name === "ReservationConversion").length, 0);
    const explanation = elements(tree, (node) => node.type === "p").map((node) => node.props.children).find((value) => typeof value === "string" && value.includes("saved receipt"));
    assert.match(explanation, /expired.*different browser.*browser where you paid.*checkout email address.*payment reference or Stripe receipt/);
  }
  assert.equal(instance.calls.lookups.length, 0);
  const tampered = app({ cookies: { [`cymba-reservation-receipt-${HANDLE}`]: "cs_live_other_receipt" } });
  const tree = await tampered.page({ receipt: HANDLE });
  assert.equal(elements(tree, (node) => node.type?.name === "ReservationConversion").length, 0);
  assert.equal(tampered.calls.lookups.length, 0);
});

test("client confirmation tracker forwards only its server-provided purchase fields after mounting", () => {
  const instance = app();
  const payload = { eventId: "a".repeat(64), value: 50, currency: "USD" };
  assert.equal(instance.conversion(payload), null);
  assert.equal(instance.calls.purchases.length, 0);
  assert.equal(instance.calls.effects.length, 1);
  instance.calls.effects[0]();
  assert.deepEqual(instance.calls.purchases, [payload]);
});

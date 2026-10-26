const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const Stripe = require("stripe");

const ROOT = path.resolve(__dirname, "..");
const secret = "whsec_reservation_tests_only";
const stripeVerifier = new Stripe("sk_test_reservation_tests_only");
const env = {
  RESERVATIONS_ENABLED: "true", STRIPE_SECRET_KEY: "rk_test_reservation_tests_only", STRIPE_WEBHOOK_SECRET: secret,
  SUPABASE_URL: "https://test.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_tests_only",
};
const reservationId = "23f44412-32e8-4e1d-a06f-b615f9ff1491";
const attemptId = "39ba9645-6135-42f3-92a1-66c6c2f29b8e";
const flow = "cymba_reservation_v1";
const clone = (value) => JSON.parse(JSON.stringify(value));
const metadata = () => ({ flow, reservation_id: reservationId, attempt_id: attemptId, terms_version: "2026-10-25" });
const row = (overrides = {}) => ({
  id: reservationId, attempt_id: attemptId, created_at: new Date().toISOString(), email: "person@example.com", variant: "learn",
  stripe_session_id: "cs_test_reservation", stripe_payment_intent: null, stripe_customer: null, checkout_expires_at: null,
  amount: 5000, currency: "usd", amount_refunded: 0, status: "pending", founder_number: null, paid_at: null, refunded_at: null,
  terms_version: "2026-10-25", terms_accepted_at: new Date().toISOString(), livemode: false, ...overrides,
});
const payment = (overrides = {}) => ({
  id: "pi_reservation", object: "payment_intent", amount: 5000, amount_received: 5000, currency: "usd", livemode: false,
  status: "succeeded", metadata: metadata(), customer: "cus_reservation", ...overrides,
});
const session = (overrides = {}) => ({
  id: "cs_test_reservation", object: "checkout.session", mode: "payment", status: "complete", payment_status: "paid",
  amount_total: 5000, currency: "usd", livemode: false, client_reference_id: reservationId, metadata: metadata(),
  payment_intent: payment(), customer: "cus_reservation", expires_at: Math.floor(Date.now() / 1000) + 86400,
  url: "https://checkout.stripe.com/test_checkout", ...overrides,
});
const event = (type = "checkout.session.completed", object = session(), overrides = {}) => ({
  id: "evt_reservation", object: "event", type, created: Math.floor(Date.now() / 1000), livemode: false, data: { object }, ...overrides,
});
const request = (body) => new Request("http://localhost/api/reserve", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const submission = (overrides = {}) => ({
  email: "person@example.com", variant: "learn", attemptId, termsAccepted: true, termsVersion: "2026-10-25",
  startedAt: Date.now() - 5000, company: "", ...overrides,
});
function webhookRequest(value, raw = JSON.stringify(value), signingSecret = secret) {
  const header = stripeVerifier.webhooks.generateTestHeaderString({ payload: raw, secret: signingSecret });
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": header }, body: raw,
  });
}

// Real routes + storage + Stripe signature verification. Network interfaces are replaced;
// no account, API key, customer data, or local .env file is read.
function backend(options = {}) {
  const calls = { create: [], retrieve: [], refunds: [], db: [], rpc: [], logs: [] };
  const rows = (options.rows ?? []).map(clone);
  const sessions = new Map();
  let rpcResult = options.rpcResult ?? "applied";
  const currentSession = options.session ?? session();
  const stripe = {
    webhooks: {
      ...stripeVerifier.webhooks,
      constructEvent: (payload, header, key) => stripeVerifier.webhooks.constructEvent(payload, header, key, undefined, options.webCrypto ? Stripe.createSubtleCryptoProvider() : undefined),
      constructEventAsync: (payload, header, key) => stripeVerifier.webhooks.constructEventAsync(payload, header, key, undefined, options.webCrypto ? Stripe.createSubtleCryptoProvider() : undefined),
    },
    checkout: { sessions: {
      create: async (params, opts) => {
        calls.create.push(clone({ params, opts }));
        if (options.createError) throw new Error("Customer person@example.com rk_test_private");
        if (!sessions.has(opts.idempotencyKey)) sessions.set(opts.idempotencyKey, session({
          metadata: params.metadata, client_reference_id: params.client_reference_id, status: "open", payment_status: "unpaid", payment_intent: null,
          expires_at: params.expires_at,
        }));
        return clone(sessions.get(opts.idempotencyKey));
      },
      retrieve: async (id, params) => {
        calls.retrieve.push({ id, params });
        if (options.retrieveError) throw new Error("Stripe unavailable");
        return clone(options.session ?? [...sessions.values()].find((s) => s.id === id) ?? currentSession);
      },
    } },
    paymentIntents: { retrieve: async () => clone(options.payment ?? payment()) },
    refunds: { list: (params) => {
      calls.refunds.push(params);
      return { async *[Symbol.asyncIterator]() { for (const r of options.refunds ?? []) yield clone(r); } };
    } },
  };
  function StripeMock() { return stripe; }
  const fetch = async (url, init = {}) => {
    calls.db.push({ url, init });
    if (options.dbError) throw new Error("Database unavailable");
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : null;
    if (u.pathname.endsWith("/rpc/apply_reservation_event")) {
      calls.rpc.push(body);
      if (options.rpcHttpFailure) return new Response(null, { status: 503 });
      return Response.json(rpcResult);
    }
    assert.ok(u.pathname.endsWith("/reservations"), `Unexpected table: ${url}`);
    if (init.method === "POST") {
      if (options.insertError) return new Response(null, { status: 503 });
      const existing = rows.find((r) => r.attempt_id === body.attempt_id);
      if (existing) return Response.json([], { status: 201 });
      rows.push(body);
      return Response.json([body], { status: 201 });
    }
    const matches = rows.filter((r) => ["id", "attempt_id", "stripe_session_id"].every((key) => {
      const predicate = u.searchParams.get(key);
      return !predicate || (predicate === "is.null" ? r[key] === null : predicate === `eq.${r[key]}`);
    }));
    if (init.method === "PATCH") {
      if (options.attachError) return new Response(null, { status: 503 });
      for (const r of matches) Object.assign(r, body);
    }
    return Response.json(matches);
  };
  const cache = new Map();
  const context = vm.createContext({
    process: { env: { NODE_ENV: "test", ...env, ...options.env }, cwd: () => options.cwd ?? ROOT },
    fetch, Request, Response, Headers, AbortSignal, TextDecoder, Uint8Array, FormData, URL,
    console: { error: (...args) => calls.logs.push(args) },
  });
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    const localRequire = (specifier) => {
      if (specifier === "server-only") return {};
      if (specifier === "stripe") return StripeMock;
      if (specifier.startsWith("@/")) return load(path.resolve(ROOT, "src", `${specifier.slice(2)}.ts`));
      if (specifier.startsWith(".")) return load(path.resolve(path.dirname(filename), `${specifier}.ts`));
      return require(specifier);
    };
    vm.runInContext(`(function(require, module, exports) {${source}\n})`, context, { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  return {
    route: (name) => load(path.resolve(ROOT, `src/app/api/${name}/route.ts`)).POST,
    storage: () => load(path.resolve(ROOT, "src/lib/storage.ts")),
    stripe: () => load(path.resolve(ROOT, "src/lib/stripe.ts")),
    calls, rows, setRpcResult: (value) => { rpcResult = value; },
  };
}

test("real checkout is closed unless explicit activation, webhook and durable storage are configured", async () => {
  for (const missing of ["RESERVATIONS_ENABLED", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SUPABASE_URL", "SUPABASE_SECRET_KEY"]) {
    const app = backend({ env: { [missing]: "" } });
    assert.equal(app.stripe().reservationsOpen(), false, missing);
    assert.equal((await app.route("reserve")(request(submission()))).status, 503);
    assert.equal(app.calls.db.length, 0);
    assert.equal(app.calls.create.length, 0);
  }
  assert.equal(backend({ env: { WAITLIST_STORAGE: "file" } }).stripe().reservationsOpen(), false);
  assert.equal(backend({ env: { NODE_ENV: "production", WAITLIST_STORAGE: "file", SUPABASE_URL: "", SUPABASE_SECRET_KEY: "", RESERVATIONS_PREVIEW: "true" } }).stripe().reservationsOpen(), false);
});

test("consent, current terms and attempt UUID are required before a payment attempt", async () => {
  for (const [input, status] of [
    [{ termsAccepted: false }, 422], [{ termsAccepted: "true" }, 422], [{ termsVersion: "old" }, 409],
    [{ attemptId: "not-a-uuid" }, 422], [{ email: "invalid" }, 422], [{ startedAt: Date.now() }, 400],
  ]) {
    const app = backend();
    assert.equal((await app.route("reserve")(request(submission(input)))).status, status);
    assert.equal(app.calls.db.length, 0);
    assert.equal(app.calls.create.length, 0);
  }
});

test("checkout stores consent first and derives the exact price server-side without marketing signup", async () => {
  const app = backend();
  const response = await app.route("reserve")(request(submission({ amount: 1, currency: "gbp" })));
  assert.equal(response.status, 200);
  const created = app.calls.create[0];
  assert.equal(created.params.line_items[0].price_data.unit_amount, 5000);
  assert.equal(created.params.line_items[0].price_data.currency, "usd");
  assert.equal(created.params.payment_method_types, undefined);
  assert.equal(created.params.adaptive_pricing.enabled, false);
  assert.equal(created.opts.idempotencyKey, `reservation:${attemptId}`);
  assert.equal(created.params.metadata.reservation_id, app.rows[0].id);
  assert.equal(created.params.payment_intent_data.metadata.attempt_id, attemptId);
  assert.equal(app.rows[0].terms_version, "2026-10-25");
  assert.ok(app.rows[0].terms_accepted_at);
  assert.equal(app.rows[0].stripe_session_id, "cs_test_reservation");
  assert.equal(app.calls.db.some((c) => /waitlist/.test(c.url)), false);
  assert.equal(JSON.stringify(await response.json()).includes("person@example.com"), false);
  const unavailable = backend({ insertError: true });
  assert.equal((await unavailable.route("reserve")(request(submission()))).status, 503);
  assert.equal(unavailable.calls.create.length, 0);
});

test("network retry reuses the durable session and concurrent retries send identical Stripe parameters", async () => {
  const app = backend();
  const post = app.route("reserve");
  assert.equal((await post(request(submission()))).status, 200);
  assert.equal((await post(request(submission()))).status, 200);
  assert.equal(app.calls.create.length, 1);
  assert.equal(app.rows.length, 1);
  const concurrent = backend();
  const results = await Promise.all([1, 2].map(() => concurrent.route("reserve")(request(submission()))));
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(concurrent.rows.length, 1);
  for (const call of concurrent.calls.create) assert.deepEqual(call, concurrent.calls.create[0]);
});

test("attempts cannot change buyer and expired/failed attempts require an explicit fresh attempt", async () => {
  const conflict = backend({ rows: [row()] });
  const res = await conflict.route("reserve")(request(submission({ email: "someone-else@example.com" })));
  assert.equal(res.status, 409);
  assert.equal((await res.json()).resetAttempt, true);
  for (const status of ["expired", "failed"]) {
    const app = backend({ rows: [row({ status })] });
    const response = await app.route("reserve")(request(submission()));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).resetAttempt, true);
    assert.equal(app.calls.create.length, 0);
  }
  const old = backend({ rows: [row({ stripe_session_id: null, created_at: new Date(Date.now() - 25 * 3600000).toISOString() })] });
  assert.equal((await old.route("reserve")(request(submission()))).status, 409);
  assert.equal(old.calls.create.length, 0);
});

test("paid, processing and refunded retries show their existing confirmation without a new charge", async () => {
  for (const status of ["paid", "processing", "partially_refunded", "refunded", "refund_review"]) {
    const app = backend({ rows: [row({ status })] });
    const result = await (await app.route("reserve")(request(submission()))).json();
    assert.match(result.url, /\/reserve\/complete\?session_id=cs_test_reservation$/);
    assert.equal(app.calls.create.length, 0);
  }
});

test("failed session attachment keeps the retry recoverable and Stripe errors do not leak personal data", async () => {
  const app = backend({ attachError: true });
  assert.equal((await app.route("reserve")(request(submission()))).status, 503);
  assert.equal((await app.route("reserve")(request(submission()))).status, 503);
  assert.deepEqual(app.calls.create[0], app.calls.create[1]);
  const failed = backend({ createError: true });
  const result = await failed.route("reserve")(request(submission()));
  assert.equal(result.status, 502);
  assert.equal(JSON.stringify(failed.calls.logs).includes("person@example.com"), false);
  assert.equal(JSON.stringify(failed.calls.logs).includes("rk_test"), false);
});

test("webhooks verify the original signed body and reject tampering and mode mismatch before storage", async () => {
  const app = backend({ rows: [row()] });
  const post = app.route("stripe/webhook");
  assert.equal((await post(request(event()))).status, 400);
  assert.equal((await post(webhookRequest(event(), JSON.stringify(event()), "wrong_secret"))).status, 400);
  const live = event("checkout.session.completed", session(), { livemode: true });
  assert.equal((await post(webhookRequest(live))).status, 400);
  assert.equal(app.calls.db.length, 0);
  const spaced = JSON.stringify(event(), null, 2);
  assert.equal((await post(webhookRequest(event(), spaced))).status, 200);
  assert.equal(app.calls.rpc.length, 1);
});

test("webhooks verify signatures with the hosted Web Crypto provider", async () => {
  const app = backend({ webCrypto: true, rows: [row()] });
  const post = app.route("stripe/webhook");
  assert.equal((await post(webhookRequest(event()))).status, 200);
  assert.equal(app.calls.rpc.length, 1);
  const signedBody = JSON.stringify(event());
  assert.equal((await post(webhookRequest(event(), signedBody, "whsec_wrong_key"))).status, 400);
  assert.equal(app.calls.rpc.length, 1);
});

test("webhooks keep processing after checkout is disabled and retry storage failures or missing attempts", async () => {
  for (const options of [{ dbError: true }, { rows: [] }, { rows: [row()], rpcHttpFailure: true }, { rows: [row()], rpcResult: "not_found" }]) {
    const app = backend(options);
    assert.equal((await app.route("stripe/webhook")(webhookRequest(event()))).status, 500);
  }
  const app = backend({ rows: [row()], env: { RESERVATIONS_ENABLED: "false" }, rpcResult: "unavailable" });
  const post = app.route("stripe/webhook");
  assert.equal((await post(webhookRequest(event()))).status, 500);
  app.setRpcResult("applied");
  assert.equal((await post(webhookRequest(event()))).status, 200);
  app.setRpcResult("duplicate");
  assert.equal((await post(webhookRequest(event()))).status, 200);
});

test("flow, amount, currency, reference and terms mismatches never reach the payment transaction", async () => {
  for (const changed of [
    { amount_total: 1 }, { currency: "gbp" }, { client_reference_id: "someone-else" },
    { metadata: { ...metadata(), terms_version: "old" } },
    { payment_intent: payment({ amount_received: 1 }) },
    { payment_intent: payment({ metadata: { ...metadata(), flow: "unrelated" } }) },
  ]) {
    const app = backend({ rows: [row()], session: session(changed) });
    assert.equal((await app.route("stripe/webhook")(webhookRequest(event()))).status, 500);
    assert.equal(app.calls.rpc.length, 0);
  }
  const unrelated = backend();
  const ignored = event("checkout.session.completed", session({ metadata: { flow: "another-product" } }));
  assert.equal((await unrelated.route("stripe/webhook")(webhookRequest(ignored))).status, 200);
  assert.equal(unrelated.calls.retrieve.length, 0);
});

test("delayed payments record processing, terminal failure, expiration and later success distinctly", async () => {
  for (const [type, changes, expected] of [
    ["checkout.session.completed", { payment_status: "unpaid", payment_intent: payment({ status: "processing", amount_received: 0 }) }, "processing"],
    ["checkout.session.async_payment_failed", { payment_status: "unpaid", payment_intent: payment({ status: "requires_payment_method", amount_received: 0 }) }, "failed"],
    ["checkout.session.expired", { status: "expired", payment_status: "unpaid", payment_intent: null }, "expired"],
    ["checkout.session.async_payment_succeeded", {}, "paid"],
    // A late failure notification cannot override the currently settled Stripe payment.
    ["checkout.session.async_payment_failed", {}, "paid"],
  ]) {
    const app = backend({ rows: [row()], session: session(changes) });
    assert.equal((await app.route("stripe/webhook")(webhookRequest(event(type)))).status, 200);
    assert.equal(app.calls.rpc[0].p_status, expected);
  }
});

test("refunds arriving before checkout completion identify the attempt and count only successful refunds", async () => {
  const refunds = [
    { id: "re_1", payment_intent: "pi_reservation", amount: 1200, currency: "usd", status: "succeeded" },
    { id: "re_2", payment_intent: "pi_reservation", amount: 1800, currency: "usd", status: "pending" },
    { id: "re_3", payment_intent: "pi_reservation", amount: 2000, currency: "usd", status: "pending" },
  ];
  const app = backend({ rows: [row({ stripe_session_id: null })], refunds });
  const value = event("charge.refunded", { id: "ch_reservation", payment_intent: "pi_reservation" });
  assert.equal((await app.route("stripe/webhook")(webhookRequest(value))).status, 200);
  assert.equal(app.calls.rpc[0].p_reservation_id, reservationId);
  assert.equal(app.calls.rpc[0].p_session_id, null);
  assert.equal(app.calls.rpc[0].p_amount_refunded, 1200);
  assert.equal(app.calls.rpc[0].p_status, "partially_refunded");
  refunds[1].status = "succeeded";
  refunds[2].status = "succeeded";
  const full = backend({ rows: [row()], refunds });
  assert.equal((await full.route("stripe/webhook")(webhookRequest(event("refund.updated", refunds[1])))).status, 200);
  assert.equal(full.calls.rpc[0].p_status, "refunded");
  assert.equal(full.calls.rpc[0].p_amount_refunded, 5000);
  const laterPayment = backend({ rows: [row()], refunds });
  await laterPayment.route("stripe/webhook")(webhookRequest(event()));
  assert.equal(laterPayment.calls.rpc[0].p_status, "refunded");
});

test("completion storage distinguishes not found from unavailable and never mutates state", async () => {
  for (const [options, expected] of [[{ rows: [row()] }, "found"], [{ rows: [] }, "not_found"], [{ dbError: true }, "unavailable"]]) {
    const app = backend(options);
    const result = await app.storage().lookupReservation("cs_test_reservation");
    assert.equal(result.status, expected);
    assert.ok(app.calls.db.every((c) => !c.init.method));
  }
});

test("local preview cannot reach production storage or rewrite the reservation email", async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "cymba-reservation-test-"));
  try {
    const app = backend({ cwd, env: { WAITLIST_STORAGE: "file", RESERVATIONS_PREVIEW: "true", RESERVATIONS_ENABLED: "false" } });
    const response = await app.route("reserve")(request(submission()));
    assert.equal(response.status, 200);
    const previewUrl = (await response.json()).url;
    assert.match(previewUrl, /^\/reserve\/preview\?/);
    const sessionId = new URL(previewUrl, "http://localhost").searchParams.get("session_id");
    const form = new FormData();
    form.set("session_id", sessionId); form.set("action", "pay"); form.set("email", "attacker@example.com");
    const fakePay = await app.route("reserve/preview")(new Request("http://localhost/api/reserve/preview", {
      method: "POST", body: form, headers: { Host: "127.0.0.1:3010", Origin: "http://127.0.0.1:3010" },
    }));
    assert.equal(fakePay.status, 303);
    assert.equal(fakePay.headers.get("location"), `/reserve/complete?session_id=${sessionId}`);
    const crossOrigin = await app.route("reserve/preview")(new Request("http://localhost/api/reserve/preview", {
      method: "POST", body: form, headers: { Host: "127.0.0.1:3010", Origin: "http://example.com" },
    }));
    assert.equal(crossOrigin.status, 403);
    const opaqueSameOrigin = await app.route("reserve/preview")(new Request("http://localhost/api/reserve/preview", {
      method: "POST", body: form, headers: { Host: "localhost", Origin: "null", "Sec-Fetch-Site": "same-origin" },
    }));
    assert.equal(opaqueSameOrigin.status, 303);
    const opaqueCrossOrigin = await app.route("reserve/preview")(new Request("http://localhost/api/reserve/preview", {
      method: "POST", body: form, headers: { Host: "localhost", Origin: "null", "Sec-Fetch-Site": "cross-site" },
    }));
    assert.equal(opaqueCrossOrigin.status, 403);
    const found = await app.storage().lookupReservation(sessionId);
    assert.equal(found.reservation.email, "person@example.com");
    assert.equal(found.reservation.status, "paid");
    assert.equal(found.reservation.founder_number, 1);
    assert.equal(app.calls.db.length, 0);
    assert.equal(app.calls.create.length, 0);
    const production = backend({ env: { NODE_ENV: "production", RESERVATIONS_PREVIEW: "true", WAITLIST_STORAGE: "file" } });
    assert.equal((await production.route("reserve/preview")(new Request("http://localhost/api/reserve/preview", { method: "POST", body: form }))).status, 404);
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test("failed or returned refunds enter manual review even after an earlier success", async () => {
  for (const [refundStatus, eventType] of [["failed", "refund.failed"], ["requires_action", "refund.updated"], ["canceled", "refund.updated"]]) {
    const refund = { id: "re_returned", payment_intent: "pi_reservation", amount: 5000, currency: "usd", status: refundStatus };
    const app = backend({ rows: [row({ status: "refunded", amount_refunded: 5000 })], refunds: [refund] });
    assert.equal((await app.route("stripe/webhook")(webhookRequest(event(eventType, refund)))).status, 200);
    assert.equal(app.calls.rpc[0].p_status, "refund_review");
    assert.equal(app.calls.rpc[0].p_amount_refunded, 0);
  }
});

// Exercise real PostgreSQL transactions without a server or production access.
test("Postgres migration and atomic payment transactions", async (t) => {
  const { PGlite } = require(process.env.RESERVATION_TEST_PGLITE_PATH || "@electric-sql/pglite");
  const db = new PGlite();
  const migration = fs.readFileSync(path.join(ROOT, "supabase/migrations/20261025_paid_reservations.sql"), "utf8");
  const rpcSql = "select public.apply_reservation_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) as result";
  const rpc = async (overrides = {}) => {
    const p = {
      event: "evt_sql_paid", type: "checkout.session.completed", id: reservationId, attempt: attemptId,
      terms: "2026-10-25", session: "cs_sql_reservation", pi: "pi_sql_reservation", customer: "cus_sql",
      status: "paid", amount: 5000, currency: "usd", refunded: 0, live: false, at: new Date().toISOString(), ...overrides,
    };
    return (await db.query(rpcSql, [p.event, p.type, p.id, p.attempt, p.terms, p.session, p.pi, p.customer, p.status, p.amount, p.currency, p.refunded, p.live, p.at])).rows[0].result;
  };
  const insert = async (id = reservationId, attempt = attemptId) => db.query(
    "insert into public.reservations (id,attempt_id,email,amount,currency,terms_version,terms_accepted_at,livemode) values ($1,$2,'test@example.com',5000,'usd','2026-10-25',now(),false)", [id, attempt]);
  const saved = async (id = reservationId) => (await db.query("select * from public.reservations where id=$1", [id])).rows[0];
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await t.test("standalone migration creates a fresh schema and can be reapplied", async () => {
      await db.exec(migration);
      await db.exec(migration);
      await insert();
      assert.equal((await saved()).status, "pending");
    });
    await t.test("mismatched payment evidence leaves no event receipt or state change", async () => {
      for (const wrong of [{ amount: 1 }, { currency: "gbp" }, { attempt: "d0b41fde-20f7-419b-a85b-26a417451aa7" }, { terms: "old" }, { live: true }, { refunded: 5001 }]) {
        assert.equal(await rpc({ event: "evt_mismatch", ...wrong }), "mismatch");
      }
      assert.equal((await saved()).status, "pending");
      assert.equal((await db.query("select count(*)::integer as n from public.reservation_webhook_events")).rows[0].n, 0);
    });
    await t.test("confirmation and retries allocate exactly one founder number", async () => {
      assert.equal(await rpc(), "applied");
      assert.equal(await rpc(), "duplicate");
      assert.equal((await saved()).status, "paid");
      assert.equal((await saved()).founder_number, 1);
      assert.equal(await rpc({ event: "evt_expired_late", status: "expired" }), "applied");
      assert.equal((await saved()).status, "paid");
    });
    await t.test("partial and full refunds survive late paid events; failed refunds remain in review", async () => {
      await rpc({ event: "evt_partial", type: "charge.refunded", status: "partially_refunded", refunded: 1200 });
      await rpc({ event: "evt_paid_late", status: "paid" });
      assert.equal((await saved()).status, "partially_refunded");
      assert.equal((await saved()).amount_refunded, 1200);
      await rpc({ event: "evt_full", type: "refund.updated", status: "refunded", refunded: 5000 });
      await rpc({ event: "evt_partial_late", status: "partially_refunded", refunded: 1200 });
      assert.equal((await saved()).status, "refunded");
      await rpc({ event: "evt_failed_refund", type: "refund.failed", status: "refund_review", refunded: 0 });
      await rpc({ event: "evt_paid_after_refund_failure", status: "paid" });
      await rpc({ event: "evt_old_refund_success", status: "refunded", refunded: 5000 });
      const value = await saved();
      assert.equal(value.status, "refund_review");
      assert.equal(value.amount_refunded, 5000);
      assert.equal(value.founder_number, 1);
    });
    await t.test("async states cannot regress and settled evidence can recover a failed attempt", async () => {
      const id = "30000000-0000-4000-8000-000000000002";
      await insert(id, id);
      const target = { id, attempt: id, session: "cs_async", pi: "pi_async" };
      await rpc({ ...target, event: "evt_processing", status: "processing" });
      await rpc({ ...target, event: "evt_failure", status: "failed" });
      await rpc({ ...target, event: "evt_processing_late", status: "processing" });
      assert.equal((await saved(id)).status, "failed");
      await rpc({ ...target, event: "evt_async_paid", status: "paid" });
      await rpc({ ...target, event: "evt_failure_late", status: "failed" });
      assert.equal((await saved(id)).status, "paid");
      assert.equal((await saved(id)).founder_number, 2);
    });
    await t.test("refund-before-completion is recorded and a later event binds the session safely", async () => {
      const id = "30000000-0000-4000-8000-000000000003";
      await insert(id, id);
      const target = { id, attempt: id, pi: "pi_early_refund" };
      await rpc({ ...target, event: "evt_refund_first", session: null, status: "refunded", refunded: 5000 });
      await rpc({ ...target, event: "evt_completed_after_refund", session: "cs_early_refund", status: "paid" });
      const value = await saved(id);
      assert.equal(value.status, "refunded");
      assert.equal(value.amount_refunded, 5000);
      assert.equal(value.stripe_session_id, "cs_early_refund");
      assert.equal(value.founder_number, null);
    });
    await t.test("parallel confirmations have unique numbers and failed transactions do not acknowledge events", async () => {
      const ids = Array.from({ length: 12 }, (_, n) => `40000000-0000-4000-8000-${String(n + 1).padStart(12, "0")}`);
      for (const id of ids) await insert(id, id);
      await Promise.all(ids.map((id) => rpc({ id, attempt: id, pi: `pi_${id}`, session: `cs_${id}`, event: `evt_${id}` })));
      const numbered = (await db.query("select founder_number from public.reservations where founder_number is not null")).rows.map((r) => r.founder_number);
      assert.equal(new Set(numbered).size, numbered.length);
      const id = "50000000-0000-4000-8000-000000000001";
      await insert(id, id);
      await assert.rejects(rpc({ id, attempt: id, session: "cs_failure", event: "evt_atomic_failure" }), /duplicate key/);
      assert.equal((await saved(id)).status, "pending");
      assert.equal((await db.query("select count(*)::integer as n from public.reservation_webhook_events where event_id='evt_atomic_failure'")).rows[0].n, 0);
      assert.equal(await rpc({ id, attempt: id, pi: "pi_recovery", session: "cs_failure", event: "evt_atomic_failure" }), "applied");
    });
    await t.test("public roles cannot read reservation data or invoke the transaction", async () => {
      await db.exec("set role anon");
      await assert.rejects(db.query("select * from public.reservations"), /permission denied/);
      await assert.rejects(rpc(), /permission denied/);
      await db.exec("reset role; set role service_role");
      assert.equal(await rpc(), "duplicate");
      await db.exec("reset role");
    });
    await t.test("upgrade preserves legacy records and advances sequence beyond existing numbers", async () => {
      const legacy = new PGlite();
      try {
        await legacy.exec("create role anon; create role authenticated; create role service_role bypassrls;");
        const schema = fs.readFileSync(path.join(ROOT, "supabase/schema.sql"), "utf8");
        const base = schema.slice(schema.indexOf("create table if not exists public.reservations ("), schema.indexOf("-- Grants are checked before RLS."));
        await legacy.exec(base);
        await legacy.query("insert into public.reservations (id,email,stripe_session_id,amount,currency,status,founder_number) values ($1,'legacy@example.com','cs_legacy',5000,'usd','paid',99)", [reservationId]);
        await legacy.exec(migration);
        await legacy.exec(migration);
        const old = (await legacy.query("select * from public.reservations")).rows[0];
        assert.equal(old.attempt_id, reservationId);
        assert.equal(old.terms_accepted_at, null);
        assert.equal(old.livemode, null);
        assert.equal(old.founder_number, 99);
        assert.equal(Number((await legacy.query("select nextval('public.reservation_founder_number_seq') as n")).rows[0].n), 100);
      } finally { await legacy.close(); }
    });
  } finally { await db.close(); }
});

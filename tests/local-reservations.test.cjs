const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { randomUUID } = require("node:crypto");
const test = require("node:test");
const ts = require("typescript");
const Stripe = require("stripe");

const ROOT = path.resolve(__dirname, "..");
const secret = "whsec_local_reservations_test_only";
const verifier = new Stripe("sk_test_local_reservations_test_only");

// Real storage, migration, Checkout route, and signed webhook route. Only Stripe's
// network reads are replaced. Tests never load .env or send data off this computer.
function application(cwd, overrides = {}) {
  const env = {
    NODE_ENV: "test", RESERVATIONS_LOCAL_TEST: "true", RESERVATIONS_ENABLED: "true",
    RESERVATIONS_PREVIEW: "true", STRIPE_SECRET_KEY: "rkcs_test_local_reservations_only",
    STRIPE_WEBHOOK_SECRET: secret,
    // Deliberately configured: explicit local mode must still never use these.
    SUPABASE_URL: "https://must-not-contact.example.com", SUPABASE_SECRET_KEY: "sb_secret_tests_only",
    ...overrides,
  };
  const calls = { remote: 0, creates: 0, logs: [] };
  const sessions = new Map();
  const payments = new Map();
  const refunds = new Map();
  const stripe = {
    webhooks: verifier.webhooks,
    checkout: { sessions: {
      create: async (params, options) => {
        calls.creates++;
        const id = `cs_test_${params.metadata.reservation_id}`;
        if (!sessions.has(id)) sessions.set(id, {
          id, object: "checkout.session", mode: "payment", status: "open", payment_status: "unpaid",
          livemode: false, amount_total: 5000, currency: "usd", client_reference_id: params.client_reference_id,
          metadata: params.metadata, payment_intent: null, customer: "cus_local_test", expires_at: params.expires_at,
          ui_mode: params.ui_mode ?? "hosted_page", return_url: params.return_url,
          client_secret: params.ui_mode === "elements" ? `${id}_secret_synthetic` : null,
          url: params.ui_mode === "elements" ? null : `https://checkout.stripe.com/${id}`, idempotencyKey: options.idempotencyKey,
        });
        return structuredClone(sessions.get(id));
      },
      retrieve: async (id) => structuredClone(sessions.get(id)),
    } },
    paymentIntents: { retrieve: async (id) => structuredClone(payments.get(id)) },
    refunds: { list: ({ payment_intent }) => ({ async *[Symbol.asyncIterator]() {
      for (const refund of refunds.get(payment_intent) ?? []) yield structuredClone(refund);
    } }) },
  };
  function StripeMock() { return stripe; }
  const context = vm.createContext({
    process: {
      env, cwd: () => cwd, pid: process.pid,
      once: process.once.bind(process), removeListener: process.removeListener.bind(process),
    },
    fetch: async () => { calls.remote++; throw new Error("Remote database access forbidden by test"); },
    Request, Response, Headers, AbortSignal, TextDecoder, Uint8Array, FormData, URL,
    console: { error: (...args) => calls.logs.push(args) },
  });
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    const localRequire = (name) => {
      if (name === "server-only") return {};
      if (name === "stripe") return StripeMock;
      if (name.startsWith("@/")) return load(path.join(ROOT, "src", `${name.slice(2)}.ts`));
      if (name.startsWith(".")) return load(path.resolve(path.dirname(filename), `${name}.ts`));
      return require(name);
    };
    vm.runInContext(`(function(require,module,exports){${source}\n})`, context, { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  return {
    env, calls, sessions, payments, refunds,
    storage: () => load(path.join(ROOT, "src/lib/storage.ts")),
    stripe: () => load(path.join(ROOT, "src/lib/stripe.ts")),
    local: () => load(path.join(ROOT, "src/lib/local-reservations.ts")),
    route: (name) => load(path.join(ROOT, `src/app/api/${name}/route.ts`)).POST,
    reload: () => cache.clear(),
  };
}

function temporarySite() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "cymba-local-payment-"));
  const migrations = path.join(cwd, "supabase/migrations");
  fs.mkdirSync(migrations, { recursive: true });
  fs.copyFileSync(path.join(ROOT, "supabase/migrations/20261025_paid_reservations.sql"), path.join(migrations, "20261025_paid_reservations.sql"));
  return cwd;
}
const input = (changes = {}) => ({
  attemptId: randomUUID(), email: "local-test@example.com", variant: "learn", termsAccepted: true,
  termsVersion: "2026-10-25", company: "", startedAt: Date.now() - 5000, ...changes,
});
const request = (body) => new Request("http://localhost:3010/api/reserve", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
function webhook(type, object, options = {}) {
  const body = JSON.stringify({ id: options.id ?? `evt_${randomUUID()}`, object: "event", type,
    created: Math.floor(Date.now() / 1000), livemode: options.live ?? false, data: { object } });
  return new Request("http://localhost:3010/api/stripe/webhook", {
    method: "POST", body,
    headers: { "stripe-signature": verifier.webhooks.generateTestHeaderString({ payload: body, secret: options.secret ?? secret }) },
  });
}
function settle(app, sessionId) {
  const session = app.sessions.get(sessionId);
  const pi = { id: `pi_${session.metadata.reservation_id}`, object: "payment_intent", metadata: session.metadata,
    amount: 5000, amount_received: 5000, currency: "usd", livemode: false, customer: "cus_local_test", status: "succeeded" };
  app.payments.set(pi.id, pi);
  Object.assign(session, { payment_status: "paid", status: "complete", payment_intent: pi });
  return pi;
}

test("local test mode rejects live/malformed keys and production without falling through to Supabase or preview", async () => {
  for (const changes of [
    { STRIPE_SECRET_KEY: "sk_live_fake" }, { STRIPE_SECRET_KEY: "rk_live_fake" },
    { STRIPE_SECRET_KEY: "rkcs_live_fake" }, { STRIPE_SECRET_KEY: "invalid" }, { STRIPE_SECRET_KEY: "" },
    { NODE_ENV: "production" }, { STRIPE_WEBHOOK_SECRET: "" }, { RESERVATIONS_ENABLED: "false" },
  ]) {
    const app = application(ROOT, changes);
    assert.equal(app.stripe().previewMode(), false);
    assert.equal(app.stripe().reservationsOpen(), false);
    assert.equal((await app.route("reserve")(request(input()))).status, 503);
    assert.equal(await app.storage().updatePreviewReservation("cs_preview_fake", "pay"), false);
    assert.equal(app.calls.remote, 0);
    assert.equal(app.calls.creates, 0);
    if (changes.NODE_ENV === "production" || /live|invalid/.test(changes.STRIPE_SECRET_KEY ?? "")) {
      assert.equal(app.stripe().stripe(), null);
      assert.equal((await app.storage().lookupReservation("cs_test_missing")).status, "unavailable");
      assert.equal((await app.route("stripe/webhook")(webhook("checkout.session.completed", {}))).status, 503);
    }
  }
  for (const prefix of ["sk_test_", "rk_test_", "rkcs_test_"]) {
    const app = application(ROOT, { STRIPE_SECRET_KEY: `${prefix}synthetic` });
    assert.equal(app.stripe().reservationsOpen(), true);
    assert.ok(app.stripe().stripe());
    app.env.STRIPE_SECRET_KEY = "sk_live_synthetic";
    assert.equal(app.stripe().stripe(), null, "cached client cannot bypass the guard");
  }
});

test("local Elements checkout keeps its secret ephemeral and only signed webhooks record payment and refunds", async () => {
  const cwd = temporarySite();
  const app = application(cwd, { STRIPE_PUBLISHABLE_KEY: "pk_test_synthetic" });
  const body = input();
  try {
    assert.equal(app.stripe().inlineCheckoutEnabled(), true);
    assert.equal(app.stripe().stripePublishableKey(), "pk_test_synthetic");
    const response = await app.route("reserve")(request(body));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.match(result.sessionId, /^cs_test_/);
    assert.equal(result.clientSecret, `${result.sessionId}_secret_synthetic`);
    assert.equal(result.url, undefined);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const cs = app.sessions.get(result.sessionId);
    assert.equal(cs.ui_mode, "elements");
    assert.equal(cs.return_url, "http://127.0.0.1:3015/reserve/complete?session_id={CHECKOUT_SESSION_ID}");
    let saved = (await app.storage().lookupReservation(result.sessionId)).reservation;
    assert.equal(saved.status, "pending");
    assert.equal(saved.amount, 5000);
    assert.equal(saved.currency, "usd");
    assert.ok(saved.terms_accepted_at);
    assert.equal(JSON.stringify(saved).includes(result.clientSecret), false);
    assert.deepEqual(await (await app.route("reserve")(request(body))).json(), result);
    assert.equal(app.calls.creates, 1);

    const pi = settle(app, result.sessionId);
    const completed = await (await app.route("reserve")(request(body))).json();
    assert.match(completed.url, /^\/reserve\/complete\?/);
    assert.equal(completed.clientSecret, undefined);
    assert.equal((await app.storage().lookupReservation(result.sessionId)).reservation.status, "pending");
    assert.equal((await app.route("stripe/webhook")(webhook("checkout.session.completed", cs, { secret: "wrong" }))).status, 400);
    assert.equal((await app.storage().lookupReservation(result.sessionId)).reservation.status, "pending");
    assert.equal((await app.route("stripe/webhook")(webhook("checkout.session.completed", cs))).status, 200);
    saved = (await app.storage().lookupReservation(result.sessionId)).reservation;
    assert.equal(saved.status, "paid");
    assert.equal(saved.founder_number, 1);
    const refund = { id: "re_elements_test", payment_intent: pi.id, amount: 5000, currency: "usd", status: "succeeded" };
    app.refunds.set(pi.id, [refund]);
    assert.equal((await app.route("stripe/webhook")(webhook("refund.updated", refund))).status, 200);
    assert.equal((await app.storage().lookupReservation(result.sessionId)).reservation.status, "refunded");
    assert.equal(JSON.stringify(app.calls.logs).includes(result.clientSecret), false);
    assert.equal(app.calls.remote, 0);
  } finally {
    await app.local().closeLocalReservationDatabase();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("real local PostgreSQL records Checkout, signed webhook payments, refunds, and restart persistence", async (t) => {
  const cwd = temporarySite();
  const app = application(cwd);
  const body = input();
  let sessionId;
  let saved;
  let pi;
  try {
    await t.test("Checkout persists consent before leaving the site and retries reuse one attempt", async () => {
      const response = await app.route("reserve")(request(body));
      assert.equal(response.status, 200);
      const result = await response.json();
      sessionId = result.url.split("/").pop();
      assert.match(sessionId, /^cs_test_/);
      const retry = await app.route("reserve")(request(body));
      assert.equal(retry.status, 200);
      assert.equal((await retry.json()).url, result.url);
      assert.equal(app.calls.creates, 1);
      saved = (await app.storage().lookupReservation(sessionId)).reservation;
      assert.equal(saved.status, "pending");
      assert.equal(saved.attempt_id, body.attemptId);
      assert.equal(saved.terms_version, "2026-10-25");
      assert.equal(typeof saved.terms_accepted_at, "string");
      assert.equal(saved.livemode, false);
      assert.equal(fs.existsSync(path.join(cwd, ".data/reservations-test-db/PG_VERSION")), true);
      assert.equal(await app.storage().attachReservationSession(saved.id, "cs_live_forbidden", 1), false);
      assert.equal(await app.storage().updatePreviewReservation(sessionId, "pay"), false);
    });
    await t.test("invalid signatures and live events cannot change the pending reservation", async () => {
      pi = settle(app, sessionId);
      const cs = app.sessions.get(sessionId);
      assert.equal((await app.route("stripe/webhook")(webhook("checkout.session.completed", cs, { secret: "wrong" }))).status, 400);
      assert.equal((await app.route("stripe/webhook")(webhook("checkout.session.completed", cs, { live: true }))).status, 400);
      assert.equal((await app.storage().lookupReservation(sessionId)).reservation.status, "pending");
    });
    await t.test("verified payment and duplicate notifications allocate exactly one founder number", async () => {
      const cs = app.sessions.get(sessionId);
      for (let n = 0; n < 2; n++) {
        assert.equal((await app.route("stripe/webhook")(webhook("checkout.session.completed", cs, { id: "evt_local_payment" }))).status, 200);
      }
      const value = (await app.storage().lookupReservation(sessionId)).reservation;
      assert.equal(value.status, "paid");
      assert.equal(value.founder_number, 1);
      assert.equal(value.stripe_payment_intent, pi.id);
      assert.equal(typeof value.paid_at, "string");
    });
    await t.test("partial/full refunds and failed refunds survive delayed payment notifications", async () => {
      const refund = { id: "re_local", payment_intent: pi.id, amount: 1500, currency: "usd", status: "succeeded" };
      app.refunds.set(pi.id, [refund]);
      assert.equal((await app.route("stripe/webhook")(webhook("refund.updated", refund))).status, 200);
      assert.equal((await app.storage().lookupReservation(sessionId)).reservation.status, "partially_refunded");
      refund.amount = 5000;
      assert.equal((await app.route("stripe/webhook")(webhook("refund.updated", refund))).status, 200);
      assert.equal((await app.storage().lookupReservation(sessionId)).reservation.status, "refunded");
      refund.status = "failed";
      assert.equal((await app.route("stripe/webhook")(webhook("refund.failed", refund))).status, 200);
      app.refunds.set(pi.id, []);
      assert.equal((await app.route("stripe/webhook")(webhook("checkout.session.completed", app.sessions.get(sessionId)))).status, 200);
      const value = (await app.storage().lookupReservation(sessionId)).reservation;
      assert.equal(value.status, "refund_review");
      assert.equal(value.amount_refunded, 5000);
      assert.equal(value.founder_number, 1);
    });
    await t.test("HMR shares the open database, another owner is refused, and restart preserves state", async () => {
      app.reload();
      assert.equal((await app.storage().lookupReservation(sessionId)).reservation.status, "refund_review");
      const other = application(cwd);
      assert.equal((await other.storage().lookupReservation(sessionId)).status, "unavailable");
      await app.local().closeLocalReservationDatabase();
      assert.equal(fs.existsSync(path.join(cwd, ".data/reservations-test-db.lock")), false);
      const reopened = (await app.storage().lookupReservation(sessionId)).reservation;
      assert.equal(reopened.status, "refund_review");
      assert.equal(reopened.founder_number, 1);
      const event = { eventId: "evt_local_payment", eventType: "checkout.session.completed", reservationId: reopened.id,
        attemptId: reopened.attempt_id, termsVersion: reopened.terms_version, sessionId, paymentIntent: pi.id,
        customer: pi.customer, status: "paid", amount: 5000, currency: "usd", amountRefunded: 0,
        livemode: false, occurredAt: new Date().toISOString() };
      assert.equal(await app.storage().applyReservationEvent(event), "duplicate", "event receipts survive restart");
      assert.equal(await app.storage().applyReservationEvent({ ...event, eventId: "evt_live_forbidden", livemode: true }), "mismatch");
    });
    await t.test("concurrent confirmations stay unique and failed transactions remain retryable", async () => {
      const attempts = await Promise.all(Array.from({ length: 8 }, () => app.storage().createReservation({
        attemptId: randomUUID(), email: "parallel-local@example.com", variant: "learn", attribution: {},
        amount: 5000, currency: "usd", termsVersion: "2026-10-25", livemode: false,
      })));
      assert.ok(attempts.every((attempt) => attempt.status === "ready"));
      const events = attempts.map(({ reservation }) => ({
        eventId: `evt_parallel_${reservation.id}`, eventType: "checkout.session.completed", reservationId: reservation.id,
        attemptId: reservation.attempt_id, termsVersion: reservation.terms_version, sessionId: `cs_test_${reservation.id}`,
        paymentIntent: `pi_${reservation.id}`, customer: null, status: "paid", amount: 5000, currency: "usd",
        amountRefunded: 0, livemode: false, occurredAt: new Date().toISOString(),
      }));
      const results = await Promise.all(events.map((event) => app.storage().applyReservationEvent(event)));
      assert.ok(results.every((result) => result === "applied"));
      const numbers = await Promise.all(events.map(async (event) => (await app.storage().lookupReservation(event.sessionId)).reservation.founder_number));
      assert.equal(new Set(numbers).size, numbers.length);
      assert.ok(numbers.every((number) => number > 1));
      const failedAttempt = await app.storage().createReservation({
        attemptId: randomUUID(), email: "retry-local@example.com", variant: "learn", attribution: {},
        amount: 5000, currency: "usd", termsVersion: "2026-10-25", livemode: false,
      });
      const target = failedAttempt.reservation;
      const failedEvent = { ...events[0], eventId: "evt_transaction_failure", reservationId: target.id,
        attemptId: target.attempt_id, sessionId: `cs_test_${target.id}` };
      // A duplicate PaymentIntent violates the real database constraint after the
      // RPC attempts its receipt insert. Both operations must roll back together.
      assert.equal(await app.storage().applyReservationEvent(failedEvent), "unavailable");
      assert.equal((await app.storage().lookupReservationById(target.id)).reservation.status, "pending");
      assert.equal(await app.storage().applyReservationEvent({ ...failedEvent, paymentIntent: `pi_${target.id}` }), "applied");
      assert.equal((await app.storage().lookupReservationById(target.id)).reservation.status, "paid");
    });
    await t.test("free waitlist also remains local despite configured Supabase credentials", async () => {
      const result = await app.storage().createSignup({ email: "free-local@example.com", researchOptIn: false, variant: "learn", attribution: {} });
      assert.equal(result.status, "created");
      assert.ok(fs.existsSync(path.join(cwd, ".data/waitlist.json")));
      assert.equal(app.calls.remote, 0);
    });
  } finally {
    await app.local().closeLocalReservationDatabase();
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

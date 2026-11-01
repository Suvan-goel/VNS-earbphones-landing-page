const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const { PGlite } = require("@electric-sql/pglite");
const ROOT = path.resolve(__dirname, "..");
const SOURCE = fs.existsSync(path.join(ROOT, "src/lib")) ? path.join(ROOT, "src") : ROOT;
const id = "23f44412-32e8-4e1d-a06f-b615f9ff1491";
const jobId = "41ba9645-6135-42f3-92a1-66c6c2f29b8e";
const providerId = "51ba9645-6135-42f3-92a1-66c6c2f29b8e";
const token = "61ba9645-6135-42f3-92a1-66c6c2f29b8e";
const row = (extra = {}) => ({
  id, attempt_id: id, email: "customer@example.com", status: "paid", livemode: true,
  amount: 3500, currency: "gbp", amount_refunded: 0, founder_number: 12,
  terms_version: "2026-10-29-contact-email", paid_at: "2026-10-29T12:00:00Z", terms_accepted_at: "2026-10-29T11:59:00Z",
  stripe_session_id: "cs_private", stripe_payment_intent: "pi_private", stripe_customer: "cus_private", ...extra,
});
const job = (kind = "paid", extra = {}) => ({ id: jobId, reservation_id: id, kind,
  snapshot: row({ status: kind, ...extra }), created_at: "2026-10-29T12:00:00Z" });
const env = { NODE_ENV: "production", RESERVATION_EMAILS_ENABLED: "true", RESEND_API_KEY: "re_test_private",
  RESERVATION_EMAIL_FROM: "cymba <reservations@trycymba.com>", SUPABASE_URL: "https://test.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test" };
function app(options = {}) {
  const cache = new Map();
  const logs = [];
  const ctx = vm.createContext({ URL, Response, Buffer, Date, Intl, AbortSignal, TextDecoder, process: { env: { ...env, ...options.env } },
    fetch: options.fetch ?? (() => { throw new Error("Unexpected network request"); }), console: { error: (...args) => logs.push(args) } });
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    function req(name) {
      if (name === "server-only") return {};
      if (name === "./stripe") return { RESERVATION_FLOW: "cymba_reservation_v1", stripe: () => options.stripe ?? null };
      if (name.startsWith(".") || name.startsWith("@/")) return load((name.startsWith("@/") ? path.join(SOURCE, name.slice(2)) : path.resolve(path.dirname(filename), name)) + ".ts");
      return require(name);
    }
    vm.runInContext(`(function(require,module,exports){${code}\n})`, ctx, { filename })(req, module, module.exports);
    return module.exports;
  }
  return { logs, template: load(path.join(SOURCE, "lib/reservation-email-template.ts")).reservationEmail,
    deliver: load(path.join(SOURCE, "lib/reservation-email-delivery.ts")).deliverReservationEmails,
    due: load(path.join(SOURCE, "lib/reservation-email-delivery.ts")).deliverDueReservationEmails,
    verify: load(path.join(SOURCE, "lib/reservation-email-events.ts")).verifyEmailEvent,
    record: load(path.join(SOURCE, "lib/reservation-email-events.ts")).recordEmailEvent,
    webhook: () => load(path.join(SOURCE, "app/api/resend/webhook/route.ts")).POST,
    run: () => load(path.join(SOURCE, "app/api/internal/reservation-emails/run/route.ts")).POST };
}

test("all six messages use recorded currency, safe HTML, and clear transaction-specific wording", () => {
  const a = app();
  for (const kind of ["paid", "processing", "failed", "partially_refunded", "refunded", "refund_review"]) {
    const amount_refunded = kind === "refunded" ? 3500 : kind === "partially_refunded" ? 1000 : 0;
    const email = a.template(job(kind, { amount_refunded }));
    assert.match(email.text, /GBP\s35\.00/);
    assert.match(email.text, /support@trycymba.com/);
    assert.match(email.html, /<html lang="en"/);
    for (const secret of ["cs_private", "pi_private", "cus_private", "session_id=", "receipt="]) assert.ok(!email.html.includes(secret));
    if (kind === "refunded") assert.match(email.text, /no longer active/);
    if (kind === "refund_review") assert.doesNotMatch(email.text, /Total refunded|Deposit remaining/);
    if (kind === "partially_refunded") assert.match(email.text, /GBP\s25\.00/);
  }
  const us = a.template(job("paid", { currency: "usd", amount: 5000 }));
  assert.match(us.text, /USD\s50\.00/);
  assert.match(us.text, /US\$50 off/);
  const historic = a.template(job("paid", { terms_version: "unknown-archive" }));
  assert.doesNotMatch(historic.text, /3 months|£50 off/);
  const earlier = a.template(job("paid", { terms_version: "2026-10-28" }));
  assert.match(earlier.text, /Founders Buds/);
  assert.doesNotMatch(earlier.text, /£50 off|free software months/);
  assert.match(a.template(job("paid", { founder_number: 63, founder_position: 50 })).text, /Founding 50: £50 off/);
  assert.doesNotMatch(a.template(job("paid", { founder_number: 64, founder_position: 51 })).text, /£50 off|free software months/);
  const attachment = Buffer.from(us.attachments[0].content, "base64").toString("utf8");
  assert.match(attachment, /TERMS FOR YOUR RECORDED VERSION/);
  assert.match(attachment, /2026-10-29T12:00:00.000Z/);
  assert.equal(us.html, a.template(job("paid", { currency: "usd", amount: 5000 })).html);
  assert.ok(a.template(job("failed", { founder_number: null, id: '<script>alert("x")</script>' })).html.includes("&lt;script&gt;"));
});

test("disabled, local, preview and test events never send; incomplete enabled settings fail visibly", async () => {
  for (const override of [{ RESERVATION_EMAILS_ENABLED: "false" }, { NODE_ENV: "development" }, { RESERVATIONS_LOCAL_TEST: "true" }, { RESERVATIONS_PREVIEW: "true" }]) {
    await app({ env: override }).deliver(id, true);
  }
  await app().deliver(id, false);
  for (const override of [{ RESEND_API_KEY: "" }, { RESERVATION_EMAIL_FROM: "onboarding@resend.dev" }, { RESERVATION_EMAIL_FROM: "a@trycymba.com\nBcc: x@example.com" }, { SUPABASE_SECRET_KEY: "" }]) {
    await assert.rejects(app({ env: override }).deliver(id, true), /configuration/);
  }
});

test("live mail cannot be grouped with preview references and every event has a stable distinct header", () => {
  const a = app();
  const live = a.template(job("paid", { founder_number: 16 }));
  const preview = a.template(job("paid", { founder_number: 16, livemode: false }));
  assert.equal(live.subject, "cymba reservation #016 — confirmed");
  assert.doesNotMatch(live.subject + live.text + live.html, /\[TEST\]|Design preview|DEMO-/);
  assert.match(preview.subject, /^Design preview only:/);
  assert.doesNotMatch(preview.subject + preview.html, /#016/);
  assert.notEqual(live.headers["X-Entity-Ref-ID"], preview.headers["X-Entity-Ref-ID"]);
  assert.equal(live.headers["X-Entity-Ref-ID"], a.template(job()).headers["X-Entity-Ref-ID"]);
  assert.notEqual(live.headers["X-Entity-Ref-ID"], a.template({ ...job(), id: providerId }).headers["X-Entity-Ref-ID"]);
});

test("frozen preview or redirected payloads never reach the provider", async () => {
  for (const change of [{ subject: "[TEST] receipt" }, { to: ["other@example.com"] }, { text: "TEST EMAIL — example only" }]) {
    let sent = false;
    const a = app({ fetch: async (url, init) => {
      if (url.includes("reservation_email_outbox?")) return Response.json([job()]);
      if (url.endsWith("claim_reservation_email")) {
        const body = JSON.parse(init.body);
        return Response.json({ state: "sending", lease_token: body.p_token, payload: { ...body.p_payload, ...change } });
      }
      sent = true; throw new Error("Unexpected provider send");
    } });
    await assert.rejects(a.deliver(id, true), /Invalid production email payload/);
    assert.equal(sent, false);
  }
});

test("Resend signature verification rejects tampering, stale timestamps and wrong secrets", async () => {
  const a = app();
  // Official Svix test vector, independent of our signing implementation.
  const headers = new Headers({ "svix-id": "msg_loFOjxBNrRLzqYUf", "svix-timestamp": "1731705121", "svix-signature": "v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=" });
  const body = '{"event_type":"ping","data":{"success":true}}';
  const secret = "whsec_plJ3nmyCDGBKInavdOK15jsl";
  assert.equal(a.verify(body, headers, secret, 1731705121000).data.success, true);
  for (const [text, key, now] of [[body + " ", secret, 1731705121000], [body, secret, 1731705500000], [body, "whsec_ZGlmZmVyZW50", 1731705121000]]) {
    assert.throws(() => a.verify(text, headers, key, now), /signature/);
  }
  headers.set("svix-signature", "v1,invalid v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=");
  assert.equal(a.verify(body, headers, secret, 1731705121000).data.success, true);
});

test("delivery callbacks require a signature, store minimal data and retry storage failures", async () => {
  const secret = "whsec_" + Buffer.from("test-webhook-signing-secret-123456").toString("base64");
  const stamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ type: "email.delivered", created_at: new Date().toISOString(), data: { email_id: providerId, to: ["customer@example.com"], subject: "Private subject" } });
  const headers = { "svix-id": "msg_test", "svix-timestamp": stamp, "svix-signature": "v1," + require("node:crypto").createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update("msg_test." + stamp + "." + body).digest("base64") };
  for (const scenario of ["valid", "unsigned", "storage-failure", "too-large"]) {
    let calls = 0;
    const a = app({ env: { RESEND_WEBHOOK_SECRET: secret }, fetch: async (url, init) => {
      calls++;
      assert.ok(url.endsWith("/rpc/record_reservation_email_event"));
      assert.equal(init.redirect, "manual");
      assert.doesNotMatch(init.body, /customer@example|Private subject/);
      return scenario === "storage-failure" ? new Response("down", { status: 503 }) : Response.json(true);
    } });
    const result = await a.webhook()(new Request("https://trycymba.com/api/resend/webhook", { method: "POST", headers: scenario === "unsigned" ? {} : headers, body: scenario === "too-large" ? "x".repeat(65537) : body }));
    assert.equal(result.status, scenario === "valid" ? 200 : scenario === "storage-failure" ? 500 : 400);
    assert.equal(calls, ["valid", "storage-failure"].includes(scenario) ? 1 : 0);
  }
});

test("delivery evidence survives callback-before-ack and out-of-order delivery events", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    for (const file of ["20261025_paid_reservations.sql", "20261029_reservation_emails.sql", "20261030_email_delivery_events.sql", "20261030_email_delivery_events.sql"]) await db.exec(fs.readFileSync(path.join(ROOT, "supabase/migrations", file), "utf8"));
    await db.query("insert into reservations(id,attempt_id,email,amount,currency,terms_version,terms_accepted_at,livemode) values ($1,$1,'customer@example.com',3500,'gbp','v1',now(),true)", [id]);
    await db.query("update reservations set status='paid' where id=$1", [id]);
    const record = (eid, kind) => db.query("select record_reservation_email_event($1,$2,$3,now())", [eid, providerId, kind]);
    await record("delivered", "email.delivered");
    await record("delivered", "email.delivered");
    await record("sent-late", "email.sent");
    await db.query("update reservation_email_outbox set state='sent',provider_id=$1,sent_at=now()", [providerId]);
    let health = (await db.query("select delivery_status,needs_attention from reservation_email_health")).rows[0];
    assert.deepEqual(health, { delivery_status: "email.delivered", needs_attention: false });
    assert.equal((await db.query("select count(*)::int n from reservation_email_events")).rows[0].n, 2);
    await record("complaint", "email.complained");
    health = (await db.query("select delivery_status,needs_attention from reservation_email_health")).rows[0];
    assert.deepEqual(health, { delivery_status: "email.complained", needs_attention: true });
    assert.equal((await db.query("select has_table_privilege('anon','reservation_email_health','SELECT') allowed")).rows[0].allowed, false);
  } finally { await db.close(); }
});

test("delivery freezes payload, uses stable provider deduplication, and retries uncertain sends", async () => {
  let queue = [job()];
  let frozen;
  let accepted = false;
  let failCommit = true;
  const bodies = [], keys = [];
  const a = app({ fetch: async (url, init) => {
    const body = init.body && JSON.parse(init.body);
    if (url.includes("reservation_email_outbox?")) return Response.json(queue);
    if (url.endsWith("claim_reservation_email")) {
      frozen ??= body.p_payload;
      return Response.json({ state: "sending", lease_token: body.p_token, payload: frozen });
    }
    if (url === "https://api.resend.com/emails") {
      bodies.push(init.body); keys.push(init.headers["Idempotency-Key"]); accepted = true;
      assert.equal(init.redirect, "manual");
      assert.equal(body.reply_to, "support@trycymba.com");
      assert.deepEqual(body.to, ["customer@example.com"]);
      return Response.json({ id: providerId });
    }
    if (url.endsWith("finish_reservation_email")) {
      if (failCommit) return new Response("unavailable", { status: 503 });
      queue = []; return Response.json(true);
    }
    throw new Error("Unexpected request");
  } });
  await assert.rejects(a.deliver(id, true), /storage unavailable/);
  assert.equal(accepted, true);
  failCommit = false;
  await a.deliver(id, true);
  await a.deliver(id, true);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  assert.deepEqual(keys, [`reservation/${jobId}`, `reservation/${jobId}`]);
});

test("provider failures, contention and malformed acknowledgements cannot mark a message sent", async () => {
  for (const scenario of ["outage", "invalid", "lease", "review", "unsafe-email"]) {
    let finished = false, sent = false;
    const a = app({ fetch: async (url, init) => {
      if (url.includes("reservation_email_outbox?")) return Response.json([job("paid", scenario === "unsafe-email" ? { email: "x@example.com,y@example.com" } : {})]);
      if (url.endsWith("claim_reservation_email")) return Response.json(scenario === "lease" ? null : scenario === "review" ? { state: "needs_review" } : { state: "sending", lease_token: JSON.parse(init.body).p_token, payload: JSON.parse(init.body).p_payload });
      if (url === "https://api.resend.com/emails") { sent = true; return scenario === "outage" ? new Response("secret provider body", { status: 429 }) : Response.json({ ok: true }); }
      finished = true; return Response.json(true);
    } });
    if (scenario === "review") { await a.deliver(id, true); assert.equal(sent, false); }
    else await assert.rejects(a.deliver(id, true));
    assert.equal(finished, false);
    assert.ok(!JSON.stringify(a.logs).includes("customer@example.com"));
  }
});

test("real database outbox is atomic, private, ordered, deduplicated and leased", async t => {
  const db = new PGlite();
  const sql = name => fs.readFileSync(path.join(ROOT, "supabase/migrations", name), "utf8");
  const savedJobs = async () => (await db.query("select * from reservation_email_outbox order by created_at,id")).rows;
  const rpc = async (event, status, refunded = 0, live = true) => (await db.query(
    "select apply_reservation_event($1,'checkout.session.completed',$2,$2,'2026-10-29-contact-email','cs_private','pi_private',null,$3,3500,'gbp',$4,$5,now()) as result",
    [event, id, status, refunded, live])).rows[0].result;
  const claim = async (jid, payload = { text: "original" }, tok = token) => (await db.query("select claim_reservation_email($1,$2,$3) as result", [jid, JSON.stringify(payload), tok])).rows[0].result;
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await db.exec(sql("20261025_paid_reservations.sql"));
    await db.exec(sql("20261029_reservation_emails.sql"));
    await db.exec(sql("20261029_reservation_emails.sql"));
    await db.exec(sql("20261030_processing_email_delay.sql"));
    await db.exec(sql("20261030_processing_email_delay.sql"));
    await db.exec(sql("20261030_email_production_reliability.sql"));
    await db.query("insert into reservations(id,attempt_id,email,amount,currency,terms_version,terms_accepted_at,livemode) values ($1,$1,'customer@example.com',3500,'gbp','2026-10-29-contact-email',now(),true)", [id]);
    await t.test("mismatched payment and sandbox evidence cannot enqueue", async () => {
      assert.equal(await rpc("evt_wrong", "paid", 0, false), "mismatch");
      assert.equal((await savedJobs()).length, 0);
    });
    await t.test("processing superseded by confirmed payment; event retry creates no extra message", async () => {
      assert.equal(await rpc("evt_processing", "processing"), "applied");
      const processingId = (await savedJobs()).find(r => r.kind === "processing").id;
      assert.equal((await claim(processingId)).state, "deferred");
      assert.equal((await savedJobs()).find(r => r.id === processingId).first_attempt_at, null);
      assert.equal(await rpc("evt_paid", "paid"), "applied");
      assert.equal(await rpc("evt_paid", "paid"), "duplicate");
      assert.equal(await rpc("evt_paid_again", "paid"), "applied");
      const rows = await savedJobs();
      assert.equal(rows.length, 2);
      assert.equal(rows.find(r => r.kind === "processing").state, "superseded");
      assert.equal(rows.find(r => r.kind === "paid").snapshot.founder_number, 1);
      assert.equal(await claim(processingId), null);
    });
    await t.test("one worker claims; first payload survives retry and stale lease cannot finish", async () => {
      const jid = (await savedJobs()).find(r => r.kind === "paid").id;
      assert.equal((await claim(jid)).state, "sending");
      assert.equal(await claim(jid), null);
      await db.query("update reservation_email_outbox set lease_until=now()-interval '1 minute' where id=$1", [jid]);
      const replacement = "71ba9645-6135-42f3-92a1-66c6c2f29b8e";
      const reclaimed = await claim(jid, { text: "changed template" }, replacement);
      assert.deepEqual(reclaimed.payload, { text: "original" });
      assert.equal((await db.query("select finish_reservation_email($1,$2,$3) as ok", [jid, token, providerId])).rows[0].ok, false);
      assert.equal((await db.query("select finish_reservation_email($1,$2,$3) as ok", [jid, replacement, providerId])).rows[0].ok, true);
      assert.equal(await claim(jid), null);
    });
    await t.test("refund totals supersede stale notices, payment event cannot re-confirm", async () => {
      await rpc("evt_partial", "partially_refunded", 1000);
      await rpc("evt_partial_duplicate", "partially_refunded", 1000);
      await rpc("evt_full", "refunded", 3500);
      await rpc("evt_late_paid", "paid");
      const rows = await savedJobs();
      assert.equal(rows.filter(r => r.notification_key === "refund:1000").length, 1);
      assert.equal(rows.find(r => r.notification_key === "refund:1000").state, "superseded");
      assert.equal(rows.find(r => r.notification_key === "refund:3500").state, "pending");
      assert.equal(rows.filter(r => r.kind === "paid").length, 1);
    });
    await t.test("uncertain acceptance older than 23h is held for review, never blindly resent", async () => {
      const jid = (await savedJobs()).find(r => r.kind === "refunded").id;
      await claim(jid);
      await db.query("update reservation_email_outbox set first_attempt_at=now()-interval '24 hours',lease_until=now()-interval '1 minute' where id=$1", [jid]);
      assert.equal((await claim(jid)).state, "needs_review");
      assert.equal((await savedJobs()).find(r => r.id === jid).state, "needs_review");
    });
    await t.test("failed refund notice remains pending when later refund totals change", async () => {
      await rpc("evt_review", "refund_review", 0);
      await rpc("evt_review_again", "refund_review", 3500);
      const rows = (await savedJobs()).filter(r => r.kind === "refund_review");
      assert.equal(rows.length, 1); assert.equal(rows[0].state, "pending");
    });
    await t.test("queue and RPCs are inaccessible to public roles", async () => {
      const checks = await db.query("select has_table_privilege('anon','reservation_email_outbox','SELECT') as a, has_table_privilege('authenticated','reservation_email_outbox','SELECT') as b, has_function_privilege('anon','claim_reservation_email(uuid,jsonb,uuid)','EXECUTE') as c");
      assert.deepEqual(checks.rows[0], { a: false, b: false, c: false });
    });
  } finally { await db.close(); }
});

test('email images travel inline, every CID resolves, and HTML stays below inbox clipping size', () => {
  const a = app();
  for (const kind of ['paid','processing','failed','partially_refunded','refunded','refund_review']) {
    const email = a.template(job(kind));
    const ids = [...email.html.matchAll(/src="cid:([^"]+)"/g)].map(match => match[1]);
    assert.ok(ids.length > 0);
    for (const id of ids) {
      const asset = email.attachments.find(item => item.content_id === id);
      assert.ok(asset, `missing inline asset ${id}`);
      assert.equal(Buffer.from(asset.content, 'base64').subarray(1,4).toString(), 'PNG');
    }
    assert.ok(Buffer.byteLength(email.html) < 50000);
    assert.doesNotMatch(email.html, /<img[^>]+src="https?:/);
    assert.ok(Buffer.byteLength(JSON.stringify(email)) < 200000);
  }
});


test("processing waits two minutes, rechecks Stripe, and suppresses paid/failed or uncertain results", async () => {
  for (const scenario of ["early", "pending", "already-paid", "already-failed", "lookup-failure", "mismatch", "confirmation-race"]) {
    const snapshot = row({ status: "processing", stripe_session_id: "cs_private" });
    const queued = { ...job("processing"), snapshot,
      created_at: new Date(Date.now() - (scenario === "early" ? 90_000 : 121_000)).toISOString() };
    let sends = 0, reads = 0, claims = 0, suppressions = 0;
    const metadata = { flow: "cymba_reservation_v1", reservation_id: id, attempt_id: id, terms_version: snapshot.terms_version };
    const stripe = { checkout: { sessions: { retrieve: async () => {
      reads++;
      if (scenario === "lookup-failure") throw new Error("Stripe unavailable");
      return { id: "cs_private", metadata, mode: "payment", client_reference_id: id,
        amount_total: scenario === "mismatch" ? 1 : 3500, currency: "gbp", livemode: true,
        status: "complete", payment_status: scenario === "already-paid" ? "paid" : "unpaid",
        payment_intent: { id: "pi_private", metadata, amount: 3500, currency: "gbp", livemode: true,
          status: scenario === "already-paid" ? "succeeded" : scenario === "already-failed" ? "requires_payment_method" : "processing" } };
    } } } };
    const a = app({ stripe, fetch: async (url, init) => {
      if (url.includes("reservation_email_outbox?")) return Response.json([queued]);
      if (url.endsWith("suppress_reservation_processing_email")) { suppressions++; return Response.json(true); }
      if (url.endsWith("claim_reservation_email")) {
        claims++;
        return Response.json(scenario === "confirmation-race" ? { state: "superseded" }
          : { state: "sending", lease_token: JSON.parse(init.body).p_token, payload: JSON.parse(init.body).p_payload });
      }
      if (url === "https://api.resend.com/emails") { sends++; return Response.json({ id: providerId }); }
      if (url.endsWith("finish_reservation_email")) return Response.json(true);
      throw new Error("Unexpected request");
    } });
    if (["lookup-failure", "mismatch"].includes(scenario)) await assert.rejects(a.deliver(id, true));
    else await a.deliver(id, true);
    assert.equal(sends, scenario === "pending" ? 1 : 0, scenario);
    assert.equal(reads, scenario === "early" ? 0 : 1, scenario);
    assert.equal(claims, ["pending", "confirmation-race"].includes(scenario) ? 1 : 0, scenario);
    assert.equal(suppressions, ["already-paid", "already-failed"].includes(scenario) ? 1 : 0, scenario);
  }
});

test("background runner finds due work without another webhook and isolates per-reservation failures", async () => {
  const other = "33f44412-32e8-4e1d-a06f-b615f9ff1491";
  let deliveredSecond = false;
  const a = app({ fetch: async (url) => {
    if (url.includes("select=reservation_id")) {
      assert.match(url, /kind.neq.processing/);
      assert.match(url, /created_at.lte\./);
      assert.match(url, /lease_until/);
      return Response.json([{ reservation_id: id }, { reservation_id: id }, { reservation_id: other }]);
    }
    if (url.includes(`reservation_id=eq.${id}`)) throw new Error("Temporary failure");
    if (url.includes(`reservation_id=eq.${other}`)) { deliveredSecond = true; return Response.json([]); }
    throw new Error("Unexpected request");
  } });
  assert.deepEqual(JSON.parse(JSON.stringify(await a.due())), { checked: 2, failed: 1 });
  assert.equal(deliveredSecond, true);
});

test("scheduled endpoint requires a fresh signature and never accepts bearer credentials or caller recipients", async () => {
  const secret = "a".repeat(64);
  const stamp = String(Math.floor(Date.now() / 1000));
  const signed = timestamp => ({ "x-cymba-timestamp": timestamp, "x-cymba-signature": require("node:crypto").createHmac("sha256", secret).update(`reservation-emails:${timestamp}`).digest("hex") });
  const cases = [
    [{}, false],
    [{ authorization: `Bearer ${secret}` }, false],
    [{ ...signed(stamp), "x-cymba-signature": "b".repeat(64) }, false],
    [signed(String(Number(stamp) - 61)), false],
    [signed(String(Number(stamp) + 31)), false],
    [signed(stamp), true],
  ];
  for (const [headers, valid] of cases) {
    let reads = 0;
    const a = app({ env: { RESERVATION_EMAIL_CRON_SECRET: secret }, fetch: async () => { reads++; return Response.json([]); } });
    const response = await a.run()(new Request("https://trycymba.com/api/internal/reservation-emails/run", {
      method: "POST", headers, body: JSON.stringify({ recipient: "untrusted@example.com" }),
    }));
    assert.equal(response.status, valid ? 200 : 404);
    assert.equal(reads, valid ? 1 : 0);
    assert.doesNotMatch(await response.text(), /customer|untrusted|reservation_id|secret/);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(await app({ env: { RESERVATION_EMAILS_ENABLED: "false" } }).due())), { checked: 0, failed: 0 });
});

test("database prevents a stale processing retry after confirmation, even if its first attempt was uncertain", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    for (const file of ["20261025_paid_reservations.sql", "20261029_reservation_emails.sql", "20261030_processing_email_delay.sql", "20261030_email_production_reliability.sql"]) {
      await db.exec(fs.readFileSync(path.join(ROOT, "supabase/migrations", file), "utf8"));
    }
    await db.query("insert into reservations(id,attempt_id,email,amount,currency,terms_version,terms_accepted_at,livemode) values ($1,$1,'customer@example.com',3500,'gbp','2026-10-29-contact-email',now(),true)", [id]);
    await db.query("update reservations set status='processing' where id=$1", [id]);
    const jid = (await db.query("select id from reservation_email_outbox")).rows[0].id;
    await db.query("update reservation_email_outbox set created_at=now()-interval '3 minutes' where id=$1", [jid]);
    const claim = () => db.query("select claim_reservation_email($1,'{}'::jsonb,$2) as result", [jid, token]);
    assert.equal((await claim()).rows[0].result.state, "sending");
    await db.query("update reservations set status='paid' where id=$1", [id]);
    await db.query("update reservation_email_outbox set lease_until=now()-interval '1 minute' where id=$1", [jid]);
    assert.equal((await claim()).rows[0].result.state, "needs_review");
    assert.equal((await db.query("select attempts from reservation_email_outbox where id=$1", [jid])).rows[0].attempts, 1);
    assert.equal((await db.query("select has_function_privilege('anon','suppress_reservation_processing_email(uuid)','EXECUTE') as allowed")).rows[0].allowed, false);
    const paidId = (await db.query("select id from reservation_email_outbox where kind='paid'")).rows[0].id;
    assert.equal((await db.query("select suppress_reservation_processing_email($1) as suppressed", [paidId])).rows[0].suppressed, false);
  } finally { await db.close(); }
});

test("uncertain confirmation, failure and partial-refund sends cannot retry after a newer state", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    for (const file of ["20261025_paid_reservations.sql", "20261029_reservation_emails.sql", "20261030_email_production_reliability.sql"]) await db.exec(fs.readFileSync(path.join(ROOT, "supabase/migrations", file), "utf8"));
    for (const [i, prior, next, oldRefund, newRefund] of [[1,"paid","refunded",0,3500], [2,"failed","paid",0,0], [3,"partially_refunded","partially_refunded",1000,2000]]) {
      const rid = "30000000-0000-4000-8000-00000000000" + i;
      await db.query("insert into reservations(id,attempt_id,email,amount,currency,terms_version,terms_accepted_at,livemode) values ($1,$1,'customer@example.com',3500,'gbp','v1',now(),true)", [rid]);
      await db.query("update reservations set status=$2,amount_refunded=$3 where id=$1", [rid,prior,oldRefund]);
      const jid = (await db.query("select id from reservation_email_outbox where reservation_id=$1", [rid])).rows[0].id;
      await db.query("select claim_reservation_email($1,'{}'::jsonb,$2)", [jid, token]);
      await db.query("update reservations set status=$2,amount_refunded=$3 where id=$1", [rid,next,newRefund]);
      await db.query("update reservation_email_outbox set lease_until=now()-interval '1 minute' where id=$1", [jid]);
      const result = (await db.query("select claim_reservation_email($1,'{}'::jsonb,$2) result", [jid, token])).rows[0].result;
      assert.equal(result.state, "needs_review", prior);
      assert.equal((await db.query("select attempts from reservation_email_outbox where id=$1", [jid])).rows[0].attempts, 1);
    }
  } finally { await db.close(); }
});

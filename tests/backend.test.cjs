const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

// Compile the real route modules in memory. Every test gets isolated env,
// rate-limit state and fetch; this never reads credentials or contacts Supabase.
function backend(env = {}, fetch = async () => { throw new Error("Unexpected fetch"); }, cwd = process.cwd()) {
  const cache = new Map();
  const logs = [];
  const context = vm.createContext({
    process: { env: { NODE_ENV: "test", ...env }, cwd: () => cwd },
    fetch, Request, Response, Headers, URL, AbortSignal, TextDecoder, Uint8Array,
    console: { error: (...args) => logs.push(args) },
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
      if (specifier.startsWith("@/")) return load(path.resolve(__dirname, "../src", `${specifier.slice(2)}.ts`));
      if (specifier.startsWith(".")) return load(path.resolve(path.dirname(filename), `${specifier}.ts`));
      return require(specifier);
    };
    vm.runInContext(`(function(require, module, exports) {${source}\n})`, context, { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  return {
    route: (name) => load(path.resolve(__dirname, `../src/app/api/${name}/route.ts`)).POST,
    parser: () => load(path.resolve(__dirname, "../src/lib/request-json.ts")).readJsonObject,
    storage: () => load(path.resolve(__dirname, "../src/lib/storage.ts")),
    logs,
  };
}

const config = { SUPABASE_URL: "https://test.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test_only" };
const analyticsToken = () => `${Date.now()}.${"a".repeat(64)}`;
const eventsBody = (events, extra = {}) => ({ token: analyticsToken(),
  consent: { choice: "granted", version: "analytics-2026-10-29-v2", recordedAt: Date.now() - 10 }, events, ...extra });
const signup = () => ({ email: "  Person@Example.com  ", startedAt: Date.now() - 5000, company: "" });
const request = (body, headers = {}) => new Request("http://localhost/api/test", {
  method: "POST", body: typeof body === "string" ? body : JSON.stringify(body),
  headers: { "Content-Type": "application/json", ...headers },
});

test("all endpoints reject malformed or non-object JSON without throwing", async () => {
  for (const endpoint of ["waitlist", "survey", "events"]) {
    for (const body of ["null", "[]", "42", '"hello"', "{"]) {
      assert.equal((await backend().route(endpoint)(request(body))).status, 400, `${endpoint}: ${body}`);
    }
  }
  for (const events of [null, [null], [false], [[]]]) {
    assert.equal((await backend().route("events")(request({ events }))).status, 400);
  }
});

test("request parsing limits actual bytes as well as declared size", async () => {
  const parse = backend().parser();
  assert.equal((await parse(request({ email: "x" }, { "Content-Length": "20000" }))).response.status, 413);
  assert.equal((await parse(request({ email: "é".repeat(9000) }, { "Content-Length": "1" }))).response.status, 413);
  assert.equal((await parse(request({}, { "Content-Type": "text/plain" }))).response.status, 415);
  assert.deepEqual(JSON.parse(JSON.stringify((await parse(request({ ok: true }))).body)), { ok: true });
});

test("signup normalizes email, keeps secrets server-side, and uses bounded Supabase requests", async () => {
  let sent;
  const app = backend(config, async (url, init) => {
    sent = { url, ...init };
    return new Response(null, { status: 201 });
  });
  const response = await app.route("waitlist")(request({ ...signup(), researchOptIn: true }));
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.status, "created");
  assert.match(result.surveyToken, /^[0-9a-f-]{36}$/);
  assert.equal(JSON.parse(sent.body).email, "person@example.com");
  assert.equal(JSON.parse(sent.body).research_opt_in, true);
  assert.equal(sent.headers.apikey, config.SUPABASE_SECRET_KEY);
  assert.equal(sent.headers.Authorization, undefined);
  assert.ok(sent.signal instanceof AbortSignal);
  assert.equal(sent.cache, "no-store");
  assert.equal(JSON.stringify(result).includes("sb_secret"), false);
});

test("legacy service-role keys work and modern secret keys take priority", async () => {
  for (const modern of [false, true]) {
    let headers;
    const env = { SUPABASE_URL: config.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: "legacy.test.jwt" };
    if (modern) env.SUPABASE_SECRET_KEY = config.SUPABASE_SECRET_KEY;
    const app = backend(env, async (_url, init) => {
      headers = init.headers;
      return new Response(null, { status: 201 });
    });
    assert.equal((await app.route("waitlist")(request(signup()))).status, 201);
    assert.equal(headers.apikey, modern ? config.SUPABASE_SECRET_KEY : "legacy.test.jwt");
    assert.equal(headers.Authorization, modern ? undefined : "Bearer legacy.test.jwt");
  }
});

test("production or partial configuration never returns demo success", async () => {
  for (const env of [{ NODE_ENV: "production" }, { SUPABASE_URL: config.SUPABASE_URL }, { SUPABASE_SECRET_KEY: "sb_secret_test" }]) {
    const app = backend(env);
    const response = await app.route("waitlist")(request(signup()));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).status, "error");
    assert.equal((await app.route("events")(request(eventsBody([{ name: "page_view" }])))).status, 503);
  }
  assert.equal((await (await backend().route("waitlist")(request(signup()))).json()).status, "demo");
});

test("invalid email and bot submissions fail before storage", async () => {
  for (const [body, expected] of [
    [{ ...signup(), email: "not-an-email" }, 422],
    [{ ...signup(), company: "bot" }, 400],
    [{ ...signup(), startedAt: Date.now() }, 400],
    [{ ...signup(), startedAt: "-Infinity" }, 400],
  ]) {
    assert.equal((await backend(config).route("waitlist")(request(body))).status, expected);
  }
});

test("only the email unique constraint produces a duplicate response", async () => {
  for (const [code, constraint, expected] of [
    ["23505", "waitlist_email_key", 200],
    ["23505", "waitlist_survey_token_key", 502],
    ["23503", "waitlist_email_key", 502],
  ]) {
    const app = backend(config, async () => Response.json({
      code, message: `duplicate key value violates unique constraint "${constraint}"`,
      details: "Key (email)=(private@example.com) already exists.",
    }, { status: 409 }));
    const response = await app.route("waitlist")(request(signup()));
    assert.equal(response.status, expected);
    assert.equal((await response.json()).status, expected === 200 ? "duplicate" : "error");
    assert.equal(JSON.stringify(app.logs).includes("private@example.com"), false);
  }
});

test("upstream failures return a retryable error without logging private details", async () => {
  const app = backend(config, async () => {
    throw new Error("Aborted request containing private@example.com and sb_secret_test_only");
  });
  const response = await app.route("waitlist")(request(signup()));
  assert.equal(response.status, 502);
  assert.equal((await response.json()).status, "error");
  assert.equal(JSON.stringify(app.logs).includes("private@example.com"), false);
  assert.equal(JSON.stringify(app.logs).includes("sb_secret"), false);
});

test("survey token is validated and a successful save is one-time", async () => {
  let calls = 0;
  const app = backend(config, async (url, init) => {
    assert.match(url, /&select=id$/);
    assert.equal(JSON.parse(init.body).survey_token, null);
    return Response.json(calls++ === 0 ? [{ id: "test" }] : []);
  });
  const answers = { concern: "Comfort" };
  assert.equal((await app.route("survey")(request({ token: "-".repeat(36), answers }))).status, 400);
  assert.equal(calls, 0);
  const body = { token: "9a4b2f30-82bb-43db-a30a-8fc3c0d078ed", answers };
  assert.equal((await app.route("survey")(request(body))).status, 200);
  assert.equal((await app.route("survey")(request(body))).status, 409);
});

test("events are persisted only after validation and failures stay explicit", async () => {
  const events = [{ name: "page_view", sessionId: "test", props: { location: "hero" } }];
  const success = backend(config, async (url, init) => {
    assert.match(url, /rpc\/ingest_consented_analytics$/);
    const body = JSON.parse(init.body);
    assert.equal(body.p_events[0].name, "page_view");
    assert.match(body.p_session_hash, /^[a-f0-9]{64}$/);
    assert.equal(body.p_events[0].session_id, body.p_session_hash);
    assert.equal(body.p_events[0].props.consent_version, "analytics-2026-10-29-v2");
    assert.equal(body.token, undefined);
    return Response.json("stored");
  });
  assert.deepEqual(await (await success.route("events")(request(eventsBody(events)))).json(), { stored: true, count: 1 });
  const failed = backend(config, async () => new Response(null, { status: 503 }));
  const response = await failed.route("events")(request(eventsBody(events)));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { stored: false, count: 0 });
});

test("existing reservation funnel events are stored while unknown event names are excluded", async () => {
  let saved;
  const app = backend(config, async (_url, init) => {
    saved = JSON.parse(init.body).p_events;
    return Response.json("stored");
  });
  const names = ["reserve_click", "reserve_checkout_started", "reserve_error"];
  const response = await app.route("events")(request(eventsBody(
    [...names, "not_an_allowed_event"].map((name) => ({ name, sessionId: "test", props: { location: "reserve_page" } })),
  )));
  assert.equal(response.status, 200);
  assert.deepEqual(saved.map(({ name }) => name), names);
  assert.equal((await response.json()).count, 3);
});

test("the existing per-process limiter stops repeated signup attempts", async () => {
  const post = backend().route("waitlist");
  for (let i = 0; i < 8; i++) assert.equal((await post(request(signup()))).status, 200);
  assert.equal((await post(request(signup()))).status, 429);
});


test("signup ignores campaign attribution even if an obsolete client supplies it", async () => {
  let saved;
  const app = backend(config, async (_url, init) => { saved = JSON.parse(init.body); return new Response(null, { status: 201 }); });
  await app.route("waitlist")(request({ ...signup(), attribution: { utm_source: "ad", utm_campaign: "personal", referrer: "example.com", landing_path: "/" } }));
  for (const key of ["utm_source", "utm_campaign", "referrer", "landing_path"]) assert.equal(saved[key], null);
});

test("analytics requests need a fresh consent record and a cryptographic capability", async () => {
  for (const extra of [{ token: undefined }, { token: "weak-old-sid" }, { token: "a".repeat(64) },
    { token: `${Date.now() - 25 * 3600_000}.${"a".repeat(64)}` },
    { consent: { choice: "granted", version: "old", recordedAt: Date.now() } },
    { consent: { choice: "denied", version: "analytics-2026-10-29-v2", recordedAt: Date.now() } }]) {
    const response = await backend(config).route("events")(request(eventsBody([{ name: "page_view" }], extra)));
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
});

test("withdrawal authenticates the original capability, never a stored hash or legacy identifier", async () => {
  for (const token of [undefined, "weak-old-sid", "a".repeat(64), `${Date.now() + 120_000}.${"a".repeat(64)}`]) {
    assert.equal((await backend(config).route("events/withdraw")(request({ token }))).status, 401);
  }
  const original = `${Date.now() - 25 * 3600_000}.${"b".repeat(64)}`;
  const expected = require("node:crypto").createHash("sha256").update(`cymba-analytics-v2:${original}`).digest("hex");
  const app = backend(config, async (url, init) => {
    assert.match(url, /rpc\/withdraw_analytics_session$/);
    assert.deepEqual(JSON.parse(init.body), { p_session_hash: expected });
    assert.equal(init.body.includes(original), false);
    return Response.json(true);
  });
  const response = await app.route("events/withdraw")(request({ token: original }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { erased: true });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("cross-origin requests, oversized withdrawal bodies and upstream failure never claim deletion", async () => {
  for (const endpoint of ["events", "events/withdraw"]) {
    for (const headers of [{ Origin: "https://attacker.example" }, { "Sec-Fetch-Site": "cross-site" }]) {
      assert.equal((await backend(config).route(endpoint)(request(eventsBody([{ name: "page_view" }]), headers))).status, 403);
    }
  }
  assert.equal((await backend(config).route("events/withdraw")(request({ token: "x".repeat(2000) }))).status, 413);
  const missing = backend(config, async () => new Response(null, { status: 404 }));
  assert.deepEqual(await (await missing.route("events/withdraw")(request({ token: analyticsToken() }))).json(), { erased: false });
  assert.equal((await missing.route("events")(request(eventsBody([{ name: "page_view" }])))).status, 502);
  const replay = backend(config, async () => Response.json("withdrawn"));
  assert.equal((await replay.route("events")(request(eventsBody([{ name: "page_view" }])))).status, 409);
});

test("development file operations serialize ingestion and withdrawal without restoring deleted events", async () => {
  const directory = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "cymba-analytics-test-"));
  const app = backend({ WAITLIST_STORAGE: "file" }, undefined, directory);
  const hash = "a".repeat(64);
  const event = { name: "page_view", session_id: hash, variant: null, path: "/", props: {}, attribution: {} };
  try {
    const storage = app.storage();
    const results = await Promise.all([
      storage.storeConsentedEvents(hash, [event]), storage.withdrawAnalyticsSession(hash), storage.storeConsentedEvents(hash, [event]),
    ]);
    assert.deepEqual(results, ["stored", true, "withdrawn"]);
    const rows = JSON.parse(fs.readFileSync(path.join(directory, ".data/events.json"), "utf8"));
    assert.deepEqual(rows.map(({ name }) => name), ["analytics_withdrawn"]);
    assert.equal(await storage.withdrawAnalyticsSession(hash), true);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

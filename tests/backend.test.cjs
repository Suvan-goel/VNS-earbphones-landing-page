const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

// Compile the real route modules in memory. Every test gets isolated env,
// rate-limit state and fetch; this never reads credentials or contacts Supabase.
function backend(env = {}, fetch = async () => { throw new Error("Unexpected fetch"); }) {
  const cache = new Map();
  const logs = [];
  const context = vm.createContext({
    process: { env: { NODE_ENV: "test", ...env }, cwd: () => process.cwd() },
    fetch, Request, Response, Headers, AbortSignal, TextDecoder, Uint8Array,
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
    logs,
  };
}

const config = { SUPABASE_URL: "https://test.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test_only" };
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
    assert.equal((await app.route("events")(request({ events: [{ name: "page_view" }] }))).status, 503);
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
  const success = backend(config, async (_url, init) => {
    assert.equal(JSON.parse(init.body)[0].name, "page_view");
    return new Response(null, { status: 201 });
  });
  assert.deepEqual(await (await success.route("events")(request({ events }))).json(), { stored: true, count: 1 });
  const failed = backend(config, async () => new Response(null, { status: 503 }));
  const response = await failed.route("events")(request({ events }));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { stored: false, count: 0 });
});

test("the existing per-process limiter stops repeated signup attempts", async () => {
  const post = backend().route("waitlist");
  for (let i = 0; i < 8; i++) assert.equal((await post(request(signup()))).status, 200);
  assert.equal((await post(request(signup()))).status, 429);
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const { webcrypto } = require("node:crypto");

const site = "https://trycymba.com";
const providerId = "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794";
const config = { NEXT_PUBLIC_SITE_URL: site, RESEND_API_KEY: "re_offline_test_only", CONTACT_EMAIL_FROM: "cymba <contact@trycymba.com>" };
const submission = () => ({ name: "  Ada  ", email: "  Person@Example.com  ", message: "  Hello cymba.\nA question about my reservation.  ", company: "", elapsedMs: 5000, submissionId: "9a4b2f30-82bb-43db-a30a-8fc3c0d078ed" });
function request(body = submission(), headers = {}, url = `${site}/api/contact`) {
  const values = new Headers({ "Content-Type": "application/json", Origin: site, "Sec-Fetch-Site": "same-origin" });
  for (const [key, value] of Object.entries(headers)) value === null ? values.delete(key) : values.set(key, value);
  return new Request(url, { method: "POST", headers: values, body: typeof body === "string" ? body : JSON.stringify(body) });
}

// Each instance compiles the actual route with isolated env, limiter and fetch.
// No real environment variables, credentials, provider or network are accessed.
function backend(env = config, send = async () => Response.json({ id: providerId })) {
  const calls = [];
  const timeouts = [];
  const logs = [];
  const cache = new Map();
  const context = vm.createContext({
    process: { env: { NODE_ENV: "production", ...env } },
    fetch: async (url, init) => {
      // Cloudflare Workers rejects "error" before issuing the outbound request.
      if (init.redirect !== undefined && !["manual", "follow"].includes(init.redirect)) throw new TypeError("Unsupported redirect mode");
      calls.push({ url, ...init });
      return send(url, init);
    },
    Request, Response, Headers, URL, TextDecoder, TextEncoder, Uint8Array, crypto: webcrypto,
    AbortSignal: { timeout: (ms) => { timeouts.push(ms); return AbortSignal.timeout(ms); } },
    console: Object.fromEntries(["log", "warn", "error", "info"].map((method) => [method, (...args) => logs.push(args)])),
  });
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const localRequire = (specifier) => {
      if (specifier.startsWith("@/")) return load(path.resolve(__dirname, "../src", `${specifier.slice(2)}.ts`));
      if (specifier.startsWith(".")) return load(path.resolve(path.dirname(filename), `${specifier}.ts`));
      return require(specifier);
    };
    vm.runInContext(`(function(require, module, exports) {${source}\n})`, context, { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  return { post: load(path.resolve(__dirname, "../src/app/api/contact/route.ts")).POST, calls, logs, timeouts };
}

test("contact sends only to support with a fixed subject, plain text and visitor reply-to", async () => {
  const app = backend();
  const response = await app.post(request({ ...submission(), to: "attacker@example.com", from: "attacker@example.com", subject: "Ignore me", html: "<script>bad</script>" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "sent" });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(app.calls.length, 1);
  const sent = app.calls[0];
  assert.equal(sent.url, "https://api.resend.com/emails");
  assert.equal(sent.method, "POST");
  assert.equal(sent.headers.Authorization, `Bearer ${config.RESEND_API_KEY}`);
  assert.equal(sent.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(sent.body), {
    from: config.CONTACT_EMAIL_FROM, to: ["support@trycymba.com"], subject: "New cymba contact message",
    reply_to: "person@example.com", text: "Name: Ada\nEmail: person@example.com\n\nHello cymba.\nA question about my reservation.",
  });
  assert.equal(sent.cache, "no-store");
  assert.equal(sent.redirect, "manual");
  assert.ok(sent.signal instanceof AbortSignal);
  assert.deepEqual(app.timeouts, [12000]);
  assert.deepEqual(app.logs, []);
});

test("the real contact form measures fill duration independently of browser and server wall clocks", async () => {
  const filename = path.resolve(__dirname, "../src/components/ContactForm.tsx");
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const skew of [-86_400_000, 86_400_000]) {
    let wallClock = Date.now() + skew;
    let monotonicClock = 10_000;
    const app = backend();
    const posted = [];
    const context = vm.createContext({
      Date: { now: () => wallClock }, performance: { now: () => monotonicClock },
      crypto: { randomUUID: () => submission().submissionId }, AbortController,
      FormData: class { get() { return ""; } },
      window: { setTimeout: () => 1, clearTimeout: () => {} },
      fetch: async (_url, init) => {
        const body = JSON.parse(init.body);
        posted.push(body);
        return app.post(request(body));
      },
    });
    let stateIndex = 0;
    const module = { exports: {} };
    const localRequire = (specifier) => {
      if (specifier === "react") return {
        useId: () => "test-contact", useRef: (initial) => ({ current: initial }), useEffect: (effect) => effect(),
        useState: (initial) => [stateIndex++ === 0 ? { name: "Ada", email: "person@example.com", message: "Hello" } : initial, () => {}],
      };
      if (specifier === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (specifier === "@/config/site") return { site: { contactEmail: "support@trycymba.com" } };
      if (specifier.endsWith(".css")) return { default: {} };
      throw new Error(`Unexpected form dependency: ${specifier}`);
    };
    vm.runInContext(`(function(require, module, exports) {${source}\n})`, context, { filename })(localRequire, module, module.exports);
    const form = module.exports.ContactForm();
    monotonicClock += 5000;
    wallClock -= 172_800_000; // Simulate a clock correction while the form is open.
    await form.props.onSubmit({ preventDefault() {}, currentTarget: {} });
    assert.equal(posted.length, 1);
    assert.equal(posted[0].elapsedMs, 5000);
    assert.equal(posted[0].startedAt, undefined);
    assert.equal(app.calls.length, 1, "server accepts legitimate elapsed time despite wall-clock skew");
  }
});

test("missing delivery configuration never pretends a message was sent", async () => {
  for (const env of [{}, { ...config, RESEND_API_KEY: "" }, { ...config, CONTACT_EMAIL_FROM: "" },
    { ...config, CONTACT_EMAIL_FROM: "invalid" }, { ...config, RESEND_API_KEY: "re_key\r\ninjected" },
    { ...config, CONTACT_EMAIL_FROM: "Name <contact@trycymba.com>\r\nBcc: bad@example.com" }]) {
    const app = backend({ NEXT_PUBLIC_SITE_URL: site, ...env });
    const response = await app.post(request());
    assert.equal(response.status, 503);
    assert.equal((await response.json()).status, "error");
    assert.equal(app.calls.length, 0);
  }
});

test("origin checks reject missing, cross-site, sibling-site and host-spoofed submissions", async () => {
  for (const headers of [{ Origin: null }, { Origin: "null" }, { Origin: "https://attacker.example" },
    { Origin: "https://www.trycymba.com", "Sec-Fetch-Site": "same-site" },
    { Origin: `${site}/path` }, { Origin: site, "Sec-Fetch-Site": "cross-site" },
    { Origin: "https://attacker.example", Host: "attacker.example", "X-Forwarded-Host": "attacker.example" }]) {
    const app = backend();
    assert.equal((await app.post(request(submission(), headers, "https://attacker.example/api/contact"))).status, 403);
    assert.equal(app.calls.length, 0);
  }
  for (const configured of ["", "invalid", "https://user:pass@trycymba.com", "javascript:alert(1)"]) {
    assert.equal((await backend({ ...config, NEXT_PUBLIC_SITE_URL: configured }).post(request())).status, 403);
  }
});

test("development permits only matching localhost origins and production never does", async () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    const origin = `http://${host}:3033`;
    assert.equal((await backend({ ...config, NODE_ENV: "development" }).post(request(submission(), { Origin: origin }, `${origin}/api/contact`))).status, 200);
    assert.equal((await backend().post(request(submission(), { Origin: origin }, `${origin}/api/contact`))).status, 403);
  }
  assert.equal((await backend({ ...config, NODE_ENV: "development" }).post(request(submission(), { Origin: "http://localhost:9999" }, "http://localhost:3033/api/contact"))).status, 403);
});

test("contact validates required fields, field limits, submission IDs, bots and fill timing before delivery", async () => {
  for (const [extra, expected] of [
    [{ email: "invalid" }, 422], [{ email: "a,b@example.com" }, 422], [{ email: "a".repeat(250) + "@example.com" }, 422],
    [{ email: "ada@example.com\r\nBcc: attacker@example.com" }, 422], [{ name: "a".repeat(101) }, 422], [{ name: 4 }, 422],
    [{ message: " " }, 422], [{ message: "a".repeat(5001) }, 422], [{ message: null }, 422],
    [{ company: "bot" }, 400], [{ company: {} }, 400], [{ elapsedMs: 1199 }, 400], [{ elapsedMs: "5000" }, 400],
    [{ elapsedMs: -5000 }, 400], [{ elapsedMs: 0 }, 400], [{ elapsedMs: undefined }, 400], [{ elapsedMs: null }, 400],
    [{ submissionId: "-".repeat(36) }, 400], [{ submissionId: undefined }, 400],
  ]) {
    const app = backend();
    assert.equal((await app.post(request({ ...submission(), ...extra }))).status, expected, JSON.stringify(extra));
    assert.equal(app.calls.length, 0);
  }
  const optionalName = backend();
  assert.equal((await optionalName.post(request({ ...submission(), name: undefined }))).status, 200);
  assert.match(JSON.parse(optionalName.calls[0].body).text, /^Name: Not provided/);
  assert.equal((await backend().post(request({ ...submission(), elapsedMs: 1200 }))).status, 200);
  const nonFinite = backend();
  assert.equal((await nonFinite.post(request(JSON.stringify(submission()).replace('"elapsedMs":5000', '"elapsedMs":1e309')))).status, 400);
  assert.equal(nonFinite.calls.length, 0);
});

test("24 KB body bound supports maximum Unicode messages and rejects oversized or malformed bodies", async () => {
  const app = backend();
  assert.equal((await app.post(request({ ...submission(), name: "名".repeat(100), message: "文".repeat(5000) }))).status, 200);
  for (const [body, headers, status] of [
    [{ ...submission(), ignored: "文".repeat(9000) }, {}, 413],
    [submission(), { "Content-Length": "25000" }, 413],
    [submission(), { "Content-Type": "text/plain" }, 415],
    ["null", {}, 400], ["[]", {}, 400], ["{", {}, 400],
  ]) {
    const invalid = backend();
    const response = await invalid.post(request(body, headers));
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(invalid.calls.length, 0);
  }
});

test("contact limits attempts using Cloudflare address ahead of visitor-supplied forwarded addresses", async () => {
  const app = backend();
  for (let attempt = 0; attempt < 5; attempt++) {
    assert.equal((await app.post(request(submission(), { "CF-Connecting-IP": "192.0.2.1", "X-Forwarded-For": `192.0.2.${attempt + 10}` }))).status, 200);
  }
  const limited = await app.post(request(submission(), { "CF-Connecting-IP": "192.0.2.1", "X-Forwarded-For": "198.51.100.1" }));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "600");
  assert.equal(app.calls.length, 5);
  assert.equal((await app.post(request(submission(), { "CF-Connecting-IP": "192.0.2.2" }))).status, 200);
});

test("timeouts return an honest failure and an unchanged retry keeps its private idempotency key", async () => {
  let attempt = 0;
  const app = backend(config, async () => { if (attempt++ === 0) throw new Error("timeout private@example.com re_secret"); return Response.json({ id: providerId }); });
  const body = submission();
  assert.equal((await app.post(request(body))).status, 502);
  assert.equal(app.calls.length, 1, "no automatic retry");
  assert.equal((await app.post(request({ ...body, elapsedMs: body.elapsedMs + 1000 }))).status, 200);
  const key = app.calls[0].headers["Idempotency-Key"];
  assert.match(key, /^contact\/[a-f0-9]{64}$/);
  assert.equal(app.calls[1].headers["Idempotency-Key"], key);
  assert.equal(key.includes(body.email.trim().toLowerCase()), false);
  assert.equal((await app.post(request({ ...body, message: "Edited message" }))).status, 200);
  assert.notEqual(app.calls[2].headers["Idempotency-Key"], key);
  assert.equal((await app.post(request({ ...body, submissionId: "8a4b2f30-82bb-43db-a30a-8fc3c0d078ed" }))).status, 200);
  assert.notEqual(app.calls[3].headers["Idempotency-Key"], key);
  assert.deepEqual(app.logs, []);
});

test("provider refusals and malformed success responses cannot report success or leak details", async () => {
  for (const [upstream, expected] of [[400, 502], [401, 503], [403, 503], [409, 502], [429, 429], [500, 503]]) {
    const app = backend(config, async () => Response.json({ message: "private@example.com re_secret private message" }, { status: upstream }));
    const response = await app.post(request());
    assert.equal(response.status, expected);
    assert.equal((await response.json()).status, "error");
    assert.deepEqual(app.logs, []);
  }
  for (const result of [null, [], {}, { id: "" }, { id: 4 }, { id: "not-a-provider-id" }]) {
    const app = backend(config, async () => Response.json(result));
    assert.equal((await app.post(request())).status, 502);
  }
  assert.equal((await backend(config, async () => new Response("<html>error</html>")).post(request())).status, 502);
});

test("provider redirects fail without following another host or reporting success", async () => {
  for (const status of [301, 302, 303, 307, 308]) {
    const app = backend(config, async (_url, init) => {
      assert.equal(init.redirect, "manual");
      return new Response(null, { status, headers: { Location: "https://unexpected.example/emails" } });
    });
    const response = await app.post(request());
    assert.equal(response.status, 502);
    assert.equal((await response.json()).status, "error");
    assert.equal(app.calls.length, 1);
    assert.equal(app.calls[0].url, "https://api.resend.com/emails");
    assert.deepEqual(app.logs, []);
  }
});

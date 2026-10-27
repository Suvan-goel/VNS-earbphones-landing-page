const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const PIXEL_ID = "123456789012345";
const CONSENT_KEY = "cymba-marketing-consent-v1";
const created = () => ({ status: "created", surveyToken: "private-survey-token", email: "private@example.com" });

// Exercise the real module with a delayed, locally simulated Meta SDK. No
// script is fetched, no request is sent, and each test gets a fresh document.
function pixel({ id = PIXEL_ID, leadEnabled, purchaseEnabled, origin = "https://trycymba.com", pathname = "/", search = "", stored = {}, storageUnavailable = false } = {}) {
  const scripts = [];
  const timers = new Map();
  let now = 0;
  let timerId = 0;
  const setTimer = (callback, delay) => {
    const id = ++timerId;
    timers.set(id, { callback, at: now + delay });
    return id;
  };
  const clearTimer = (id) => timers.delete(id);
  const advance = (duration) => {
    const end = now + duration;
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [id, timer] = next;
      now = timer.at;
      timers.delete(id);
      timer.callback();
    }
    now = end;
  };
  const calls = [];
  const values = new Map(Object.entries(stored));
  const listeners = new Map();
  const cookies = new Map([["_fbp", "test-fbp"], ["_fbc", "test-fbc"], ["essential", "keep"]]);
  const cookieWrites = [];
  const storage = {
    getItem(key) { if (storageUnavailable) throw new Error("Storage blocked"); return values.get(key) ?? null; },
    setItem(key, value) { if (storageUnavailable) throw new Error("Storage blocked"); values.set(key, String(value)); },
    removeItem(key) { if (storageUnavailable) throw new Error("Storage blocked"); values.delete(key); },
  };
  const append = (script) => { scripts.push(script); return script; };
  const document = {
    head: { appendChild: append, append },
    body: { appendChild: append, append },
    documentElement: { appendChild: append, append },
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      setAttribute(name, value) { this[name] = value; },
      addEventListener(name, listener) { this[`on${name}`] = listener; },
      remove() { this.removed = true; },
    }),
    getElementById: (id) => scripts.find((script) => script.id === id && !script.removed) ?? null,
    getElementsByTagName: () => [{ parentNode: { insertBefore: append } }],
    querySelector: () => null,
  };
  Object.defineProperty(document, "cookie", {
    get: () => [...cookies].map(([name, value]) => `${name}=${value}`).join("; "),
    set(value) {
      cookieWrites.push(value);
      const [pair, ...attributes] = value.split(";");
      const equals = pair.indexOf("=");
      const name = pair.slice(0, equals).trim();
      const content = pair.slice(equals + 1);
      const expired = attributes.some((attribute) => {
        const [key, ...parts] = attribute.trim().split("=");
        return (key.toLowerCase() === "max-age" && Number(parts.join("=")) <= 0)
          || (key.toLowerCase() === "expires" && Date.parse(parts.join("=")) < Date.now());
      });
      if (expired) cookies.delete(name);
      else cookies.set(name, content);
    },
  });
  const location = new URL(pathname, origin);
  location.search = search;
  const window = {
    document,
    localStorage: storage,
    location,
    addEventListener(name, listener) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
    },
    removeEventListener(name, listener) { listeners.get(name)?.delete(listener); },
    dispatchEvent(event) { for (const listener of listeners.get(event.type) ?? []) listener(event); return true; },
  };
  const context = vm.createContext({
    process: { env: { NODE_ENV: "test", NEXT_PUBLIC_META_PIXEL_ID: id === null ? undefined : id, NEXT_PUBLIC_META_LEAD_TRACKING_ENABLED: leadEnabled, NEXT_PUBLIC_META_PURCHASE_TRACKING_ENABLED: purchaseEnabled } },
    window, document, localStorage: storage, Event, CustomEvent, URL, URLSearchParams, setTimeout: setTimer, clearTimeout: clearTimer,
    console: { error() {}, warn() {} },
  });
  const filename = path.resolve(__dirname, "../src/lib/meta-pixel.ts");
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInContext(`(function(require, module, exports) {${source}\n})`, context, { filename })((name) => {
    if (name === "client-only") return {};
    throw new Error(`Unexpected import: ${name}`);
  }, module, module.exports);
  const queue = () => Array.from(window.fbq?.queue ?? [], (args) => Array.from(args));
  return {
    api: module.exports, window, scripts, calls, values, cookies, cookieWrites, advance,
    pendingCalls: queue,
    load(script = scripts.at(-1)) {
      assert.ok(script, "Expected an injected script to load");
      const receive = (...args) => calls.push(Array.from(args));
      if (window.fbq) {
        for (const args of queue()) receive(...args);
        window.fbq.queue = [];
        window.fbq.callMethod = receive;
      } else {
        window.fbq = receive;
      }
      script.onload?.({ type: "load" });
    },
    fail(script = scripts.at(-1)) {
      assert.ok(script, "Expected an injected script to fail");
      script.onerror?.({ type: "error" });
    },
  };
}

const events = (app, name) => app.calls.filter((args) => args[0] === "trackSingle" && (!name || args[2] === name));
const assertNoQueuedEvents = (app) => assert.equal(
  app.pendingCalls().some((args) => ["init", "track", "trackSingle"].includes(args[0])), false,
);

test("only a numeric configured Pixel ID enables tracking", () => {
  for (const id of [null, "", " ", "undefined", "abc", "123-456", "123.456"]) {
    const app = pixel({ id, leadEnabled: "true" });
    assert.equal(app.api.isMetaPixelConfigured(), false, `Unexpected valid ID: ${JSON.stringify(id)}`);
    app.api.setMarketingConsent("granted");
    app.api.trackMetaPageView();
    app.api.trackMetaLead(201, created());
    assert.equal(app.scripts.length, 0);
    assertNoQueuedEvents(app);
  }
  assert.equal(pixel().api.isMetaPixelConfigured(), true);
});

test("marketing consent is separate from legacy analytics consent", () => {
  const app = pixel({ stored: { "analytics-consent": "granted" }, leadEnabled: "true" });
  assert.equal(app.api.MARKETING_CONSENT_KEY, CONSENT_KEY);
  assert.notEqual(app.api.getMarketingConsent(), "granted");
  app.api.trackMetaPageView();
  app.api.trackMetaLead(201, created());
  assert.equal(app.scripts.length, 0);
  app.api.setMarketingConsent("granted");
  assert.equal(app.api.getMarketingConsent(), "granted");
  assert.equal(app.values.get("analytics-consent"), "granted");
  assert.equal(app.values.has(CONSENT_KEY), true);
});

test("grant alone never injects the SDK, and denial never allows tracking", () => {
  const app = pixel({ leadEnabled: "true" });
  app.api.setMarketingConsent("granted");
  assert.equal(app.scripts.length, 0);
  app.api.setMarketingConsent("denied");
  app.api.trackMetaPageView();
  app.api.trackMetaLead(201, created());
  assert.equal(app.api.getMarketingConsent(), "denied");
  assert.equal(app.scripts.length, 0);
  assertNoQueuedEvents(app);
});

test("consent subscribers observe changes and can unsubscribe", () => {
  const app = pixel();
  const seen = [];
  const unsubscribe = app.api.subscribeMarketingConsent(() => seen.push(app.api.getMarketingConsent()));
  app.api.setMarketingConsent("granted");
  app.api.setMarketingConsent("denied");
  assert.deepEqual(seen, ["granted", "denied"]);
  unsubscribe();
  app.api.setMarketingConsent("granted");
  assert.deepEqual(seen, ["granted", "denied"]);
});

test("blocked browser storage still supports explicit session consent", () => {
  const app = pixel({ storageUnavailable: true, leadEnabled: "true" });
  assert.notEqual(app.api.getMarketingConsent(), "granted");
  assert.doesNotThrow(() => app.api.setMarketingConsent("granted"));
  assert.equal(app.api.getMarketingConsent(), "granted");
  app.api.trackMetaPageView();
  app.load();
  assert.equal(events(app, "PageView").length, 1);
  assert.doesNotThrow(() => app.api.setMarketingConsent("denied"));
  assert.equal(app.api.getMarketingConsent(), "denied");
  app.api.trackMetaLead(201, created());
  assert.equal(events(app, "Lead").length, 0);
});

test("the SDK loads once, with configuration and events deferred until load", () => {
  const app = pixel();
  app.api.setMarketingConsent("granted");
  app.api.trackMetaPageView();
  app.api.trackMetaPageView();
  assert.equal(app.scripts.length, 1);
  assert.equal(app.scripts[0].async, true);
  assert.equal(app.window.fbq.disablePushState, true, "Disable SDK-generated SPA page events before loading");
  assert.match(app.scripts[0].src, /^https:\/\/connect\.facebook\.net\//);
  assertNoQueuedEvents(app);
  app.load();
  const configIndex = app.calls.findIndex((args) => args[0] === "set" && args[1] === "autoConfig" && args[2] === false);
  const initIndex = app.calls.findIndex((args) => args[0] === "init");
  assert.ok(configIndex >= 0 && configIndex < initIndex, "Disable automatic configuration before initialization");
  assert.deepEqual(app.calls[initIndex], ["init", PIXEL_ID]);
  assert.deepEqual(events(app), [["trackSingle", PIXEL_ID, "PageView"]]);
  app.api.trackMetaPageView();
  assert.equal(events(app, "PageView").length, 1);
});

test("tracking is restricted to explicit public funnel paths", () => {
  for (const pathname of ["/privacy", "/terms", "/thank-you"]) {
    const app = pixel({ pathname, leadEnabled: "true" });
    app.api.setMarketingConsent("granted");
    app.api.trackMetaPageView();
    app.api.trackMetaLead(201, created());
    assert.equal(app.scripts.length, 0, pathname);
  }
  const app = pixel({ leadEnabled: "true" });
  app.api.setMarketingConsent("granted");
  app.api.trackMetaPageView();
  app.load();
  app.window.location.pathname = "/privacy";
  app.api.trackMetaLead(201, created());
  assert.equal(events(app, "Lead").length, 0);
});

test("consent and configuration never enable tracking on a disallowed origin", () => {
  for (const origin of [
    "http://trycymba.com",
    "http://localhost:3000",
    "https://cymba-preview.chatgpt.site",
    "https://unrelated.example",
    "https://trycymba.com:8443",
  ]) {
    for (const name of ["PageView", "Lead"]) {
      const app = pixel({ origin, leadEnabled: "true" });
      assert.equal(app.api.isMetaPixelConfigured(), true);
      assert.equal(app.api.isMetaLeadTrackingEnabled(), true);
      app.api.setMarketingConsent("granted");
      if (name === "PageView") app.api.trackMetaPageView();
      else app.api.trackMetaLead(201, created());
      assert.equal(app.scripts.length, 0, `${name} must not load the SDK on ${origin}`);
      assert.equal(app.calls.length, 0);
      assertNoQueuedEvents(app);
    }
  }
});

test("query parameters cannot authorize an otherwise disallowed origin", () => {
  const app = pixel({
    origin: "https://cymba-preview.chatgpt.site",
    search: "?origin=https%3A%2F%2Ftrycymba.com&allowTracking=true&utm_source=test",
    leadEnabled: "true",
  });
  app.api.setMarketingConsent("granted");
  app.api.trackMetaPageView();
  app.api.trackMetaLead(201, created());
  assert.equal(app.window.location.origin, "https://cymba-preview.chatgpt.site");
  assert.equal(app.scripts.length, 0);
  assertNoQueuedEvents(app);
});

test("the canonical origin permits consented events with ordinary or origin-like query parameters", () => {
  const app = pixel({
    search: "?utm_source=test&utm_campaign=preview&origin=https%3A%2F%2Funrelated.example",
    leadEnabled: "true",
  });
  app.api.setMarketingConsent("granted");
  app.api.trackMetaPageView();
  app.api.trackMetaLead(201, created());
  assert.equal(app.window.location.origin, "https://trycymba.com");
  assert.equal(app.scripts.length, 1);
  assertNoQueuedEvents(app);
  app.load();
  assert.deepEqual(events(app), [["trackSingle", PIXEL_ID, "PageView"], ["trackSingle", PIXEL_ID, "Lead"]]);
});

test("only a confirmed newly created signup produces a Lead, once per response object", () => {
  const app = pixel({ leadEnabled: "true" });
  app.api.setMarketingConsent("granted");
  app.api.trackMetaPageView();
  app.load();
  for (const [status, result] of [
    [200, created()],
    [500, created()],
    [201, { status: "duplicate", surveyToken: "private-survey-token" }],
    [201, { status: "demo", surveyToken: "private-survey-token" }],
    [201, { status: "error", surveyToken: "private-survey-token" }],
    [201, { status: "created" }],
    [201, { status: "created", surveyToken: "" }],
    [201, { status: "created", surveyToken: " " }],
    [201, { status: "created", surveyToken: 123 }],
  ]) app.api.trackMetaLead(status, result);
  assert.equal(events(app, "Lead").length, 0);
  const result = created();
  app.api.trackMetaLead(201, result);
  app.api.trackMetaLead(201, result);
  assert.deepEqual(events(app, "Lead"), [["trackSingle", PIXEL_ID, "Lead"]]);
  assert.equal(JSON.stringify(app.calls).includes(result.surveyToken), false);
  assert.equal(JSON.stringify(app.calls).includes(result.email), false);
});

test("a lead completed without consent is never replayed after consent", () => {
  const app = pixel({ leadEnabled: "true" });
  const result = created();
  app.api.trackMetaLead(201, result);
  app.api.setMarketingConsent("granted");
  app.api.trackMetaPageView();
  app.load();
  app.api.trackMetaLead(201, result);
  assert.equal(events(app, "Lead").length, 0);
  app.api.trackMetaLead(201, created());
  assert.equal(events(app, "Lead").length, 1);
});

test("a consented lead may wait for SDK load and is emitted without form data", () => {
  const app = pixel({ leadEnabled: "true" });
  const result = created();
  app.api.setMarketingConsent("granted");
  app.api.trackMetaLead(201, result);
  app.api.trackMetaLead(201, result);
  assert.equal(app.scripts.length, 1);
  assertNoQueuedEvents(app);
  app.load();
  assert.deepEqual(events(app, "Lead"), [["trackSingle", PIXEL_ID, "Lead"]]);
  assert.equal(JSON.stringify(app.calls).includes("private"), false);
});

test("withdrawal before SDK load discards queued events permanently", () => {
  const app = pixel({ leadEnabled: "true" });
  const result = created();
  app.api.setMarketingConsent("granted");
  app.api.trackMetaPageView();
  app.api.trackMetaLead(201, result);
  app.api.setMarketingConsent("denied");
  app.load();
  assert.equal(events(app).length, 0);
  assert.equal(app.calls.some((args) => args[0] === "init"), false);
  app.api.setMarketingConsent("granted");
  assert.equal(events(app).length, 0, "Grant must not replay discarded events");
  app.api.trackMetaLead(201, result);
  assert.equal(events(app, "Lead").length, 0);
});

test("withdrawal followed by a new grant before SDK load does not resurrect events", () => {
  const app = pixel({ leadEnabled: "true" });
  const result = created();
  app.api.setMarketingConsent("granted");
  app.api.trackMetaPageView();
  app.api.trackMetaLead(201, result);
  app.api.setMarketingConsent("denied");
  app.api.setMarketingConsent("granted");
  app.load();
  assert.equal(events(app).length, 0);
  app.api.trackMetaLead(201, result);
  assert.equal(events(app, "Lead").length, 0);
});

test("withdrawal after load revokes consent, removes advertising cookies, and blocks events", () => {
  const app = pixel({ leadEnabled: "true" });
  app.api.setMarketingConsent("granted");
  app.api.trackMetaPageView();
  app.load();
  app.api.setMarketingConsent("denied");
  assert.ok(app.calls.some((args) => args[0] === "consent" && args[1] === "revoke"));
  assert.equal(app.cookies.has("_fbp"), false);
  assert.equal(app.cookies.has("_fbc"), false);
  assert.equal(app.cookies.get("essential"), "keep");
  app.api.trackMetaPageView();
  app.api.trackMetaLead(201, created());
  assert.equal(events(app, "PageView").length, 1);
  assert.equal(events(app, "Lead").length, 0);
  app.api.setMarketingConsent("granted");
  app.api.trackMetaPageView();
  assert.equal(events(app, "PageView").length, 1, "A new grant does not count the same document twice");
});

test("re-accepting consent resumes the SDK on an already measured page without another PageView", () => {
  const app = pixel();
  app.api.setMarketingConsent("granted");
  app.api.trackMetaPageView();
  app.load();
  app.api.setMarketingConsent("denied");
  assert.deepEqual(app.calls.at(-1), ["consent", "revoke"]);

  // Match MarketingConsent's effect after a changed preference.
  app.api.setMarketingConsent("granted");
  app.api.trackMetaPageView();
  assert.deepEqual(app.calls.at(-1), ["consent", "grant"]);
  assert.equal(events(app, "PageView").length, 1);
  assert.equal(app.scripts.length, 1);

  // A grant made on the privacy page must resume only when returning to an
  // eligible page, including one already measured in this document.
  app.api.setMarketingConsent("denied");
  app.window.location.pathname = "/privacy";
  const deniedCalls = app.calls.length;
  app.api.setMarketingConsent("granted");
  app.api.trackMetaPageView();
  assert.equal(app.calls.length, deniedCalls);
  app.window.location.pathname = "/";
  app.api.trackMetaPageView();
  assert.deepEqual(app.calls.at(-1), ["consent", "grant"]);
  assert.equal(events(app, "PageView").length, 1);
  assert.equal(app.calls.filter((args) => args[0] === "init").length, 1);
});

test("an SDK load failure never throws into successful signup handling", () => {
  const app = pixel({ leadEnabled: "true" });
  app.api.setMarketingConsent("granted");
  const result = created();
  assert.doesNotThrow(() => app.api.trackMetaLead(201, result));
  assert.doesNotThrow(() => app.fail());
  assert.doesNotThrow(() => app.api.trackMetaLead(201, result));
  assert.equal(events(app).length, 0);
  assertNoQueuedEvents(app);
});

test("navigating away while the SDK loads discards homepage events", () => {
  const app = pixel({ leadEnabled: "true" });
  app.api.setMarketingConsent("granted");
  app.api.trackMetaPageView();
  app.api.trackMetaLead(201, created());
  app.window.location.pathname = "/privacy";
  app.load();
  assert.equal(events(app).length, 0);
});

test("changing to a disallowed origin during SDK loading discards pending events", () => {
  const app = pixel({ leadEnabled: "true" });
  const result = created();
  app.api.setMarketingConsent("granted");
  app.api.trackMetaPageView();
  app.api.trackMetaLead(201, result);
  assert.equal(app.scripts.length, 1);
  app.window.location.href = "https://cymba-preview.chatgpt.site/?origin=https%3A%2F%2Ftrycymba.com";
  app.load();
  assert.equal(events(app).length, 0);
  assert.equal(app.calls.some((args) => args[0] === "init"), false);
  app.window.location.href = "https://trycymba.com/";
  app.api.trackMetaLead(201, result);
  assert.equal(events(app).length, 0, "Returning to the allowed origin cannot replay the discarded Lead");
  app.api.trackMetaPageView();
  assert.deepEqual(events(app), [["trackSingle", PIXEL_ID, "PageView"]]);
});

test("Lead tracking requires its separate explicit enable flag; PageView does not", () => {
  for (const leadEnabled of [undefined, "", "false", "1", "TRUE"]) {
    const app = pixel({ leadEnabled });
    assert.equal(app.api.isMetaLeadTrackingEnabled(), false);
    app.api.setMarketingConsent("granted");
    app.api.trackMetaLead(201, created());
    assert.equal(app.scripts.length, 0, "Disabled Lead tracking must not load the SDK");
    app.api.trackMetaPageView();
    app.load();
    app.api.trackMetaLead(201, created());
    assert.deepEqual(events(app), [["trackSingle", PIXEL_ID, "PageView"]]);
  }
  assert.equal(pixel({ leadEnabled: "true" }).api.isMetaLeadTrackingEnabled(), true);
});


const purchase = (changes = {}) => ({ eventId: "a".repeat(64), value: 50, currency: "USD", ...changes });
const purchaseOptions = { pathname: "/reserve/complete", purchaseEnabled: "true" };

test("canonical and www production hosts allow each explicit funnel page once per document", () => {
  for (const origin of ["https://trycymba.com", "https://www.trycymba.com"]) {
    const app = pixel({ origin });
    app.api.setMarketingConsent("granted");
    app.api.trackMetaPageView();
    app.load();
    for (const pathname of ["/reserve", "/reserve/complete", "/reserve", "/"]) {
      app.window.location.pathname = pathname;
      app.api.trackMetaPageView();
      app.api.trackMetaPageView();
    }
    assert.equal(app.scripts.length, 1);
    assert.equal(events(app, "PageView").length, 3);
  }
});

test("private receipt, survey and form query fields never reach the SDK", () => {
  for (const search of ["?session_id=cs_live_secret", "?client_secret=cs_secret", "?token=private", "?surveyToken=private", "?email=private%40example.com"]) {
    const app = pixel({ ...purchaseOptions, search, leadEnabled: "true" });
    app.api.setMarketingConsent("granted");
    app.api.trackMetaPageView();
    app.api.trackMetaLead(201, created());
    app.api.trackMetaPurchase(purchase());
    assert.equal(app.scripts.length, 0, search);
    assert.equal(app.calls.length, 0);
  }
});

test("pending events cannot acquire the URL of another page while the SDK loads", () => {
  const app = pixel({ leadEnabled: "true" });
  app.api.setMarketingConsent("granted");
  app.api.trackMetaPageView();
  app.api.trackMetaLead(201, created());
  app.window.location.pathname = "/reserve";
  app.api.trackMetaPageView();
  app.load();
  assert.deepEqual(events(app), [["trackSingle", PIXEL_ID, "PageView"]]);
  app.api.trackMetaLead(201, created());
  assert.equal(events(app, "Lead").length, 0, "Leads are observed only by the homepage signup form");
});

test("signup navigation waits briefly after dispatch but never more than 800 ms for the SDK", async () => {
  const loaded = pixel({ leadEnabled: "true" });
  loaded.api.setMarketingConsent("granted");
  let finished = false;
  const waiting = loaded.api.trackMetaLead(201, created()).then(() => { finished = true; });
  loaded.advance(100);
  loaded.load();
  assert.equal(events(loaded, "Lead").length, 1);
  loaded.advance(149);
  await Promise.resolve();
  assert.equal(finished, false);
  loaded.advance(1);
  await waiting;
  assert.equal(finished, true);

  const blocked = pixel({ leadEnabled: "true" });
  blocked.api.setMarketingConsent("granted");
  let timedOut = false;
  const timeout = blocked.api.trackMetaLead(201, created()).then(() => { timedOut = true; });
  blocked.advance(799);
  await Promise.resolve();
  assert.equal(timedOut, false);
  blocked.advance(1);
  await timeout;
  assert.equal(timedOut, true);
  blocked.load();
  assert.equal(events(blocked, "Lead").length, 0, "Timed-out events cannot be sent later with a different navigation context");
});

test("revocation and SDK failure release signup navigation immediately", async () => {
  for (const end of ["revoke", "fail"]) {
    const app = pixel({ leadEnabled: "true" });
    app.api.setMarketingConsent("granted");
    const waiting = app.api.trackMetaLead(201, created());
    if (end === "revoke") app.api.setMarketingConsent("denied");
    else app.fail();
    await waiting;
    assert.equal(events(app).length, 0);
  }
});

test("Purchase has its own explicit flag and is restricted to clean production completion pages", () => {
  for (const options of [
    { purchaseEnabled: undefined }, { purchaseEnabled: "false" }, { purchaseEnabled: "1" },
    { pathname: "/" }, { pathname: "/reserve" }, { pathname: "/reserve/preview" },
    { origin: "http://localhost:3015" }, { origin: "https://cymba-preview.chatgpt.site" },
  ]) {
    const app = pixel({ ...purchaseOptions, ...options });
    app.api.setMarketingConsent("granted");
    app.api.trackMetaPurchase(purchase());
    assert.equal(app.scripts.length, 0, JSON.stringify(options));
  }
  assert.equal(pixel(purchaseOptions).api.isMetaPurchaseTrackingEnabled(), true);
});

test("Purchase sends only the deposit value, currency and opaque hash event ID", () => {
  const app = pixel(purchaseOptions);
  app.api.setMarketingConsent("granted");
  const input = purchase({ email: "private@example.com", sessionId: "cs_live_private", surveyToken: "private-token" });
  app.api.trackMetaPurchase(input);
  app.api.trackMetaPurchase({ ...input });
  assert.equal(app.scripts.length, 1);
  app.load();
  assert.deepEqual(JSON.parse(JSON.stringify(events(app, "Purchase"))), [
    ["trackSingle", PIXEL_ID, "Purchase", { value: 50, currency: "USD" }, { eventID: "a".repeat(64) }],
  ]);
  assert.equal(JSON.stringify(app.calls).includes("private"), false);
  assert.equal(JSON.stringify([...app.values]).includes("private"), false);
  app.api.trackMetaPurchase({ ...input });
  assert.equal(events(app, "Purchase").length, 1);
});

test("Purchase rejects invalid IDs, prices, currencies and unauthorised form identity", () => {
  for (const input of [
    null, {}, purchase({ eventId: "cs_live_private" }), purchase({ eventId: "private@example.com" }),
    purchase({ eventId: "123e4567-e89b-42d3-a456-426614174000" }), purchase({ value: 0 }),
    purchase({ value: -1 }), purchase({ value: Infinity }), purchase({ value: NaN }),
    purchase({ value: "50" }), purchase({ currency: "usd" }), purchase({ currency: "US" }),
  ]) {
    const app = pixel(purchaseOptions);
    app.api.setMarketingConsent("granted");
    app.api.trackMetaPurchase(input);
    assert.equal(app.scripts.length, 0, JSON.stringify(input));
  }
});

test("a confirmed Purchase is not counted again after a refresh", () => {
  const app = pixel(purchaseOptions);
  app.api.setMarketingConsent("granted");
  app.api.trackMetaPurchase(purchase());
  app.load();
  const refreshed = pixel({ ...purchaseOptions, stored: Object.fromEntries(app.values) });
  refreshed.api.trackMetaPurchase(purchase());
  assert.equal(refreshed.scripts.length, 0);
  refreshed.api.trackMetaPageView();
  refreshed.load();
  assert.equal(events(refreshed, "Purchase").length, 0);
  refreshed.api.trackMetaPurchase(purchase({ eventId: "b".repeat(64) }));
  assert.equal(events(refreshed, "Purchase").length, 1, "A different confirmed reservation is eligible");
});

test("Purchase observed without consent cannot replay when consent is later granted", () => {
  const app = pixel(purchaseOptions);
  app.api.trackMetaPurchase(purchase());
  app.api.setMarketingConsent("granted");
  app.api.trackMetaPurchase(purchase());
  assert.equal(app.scripts.length, 0);
  app.api.trackMetaPurchase(purchase({ eventId: "b".repeat(64) }));
  app.load();
  assert.equal(events(app, "Purchase").length, 1);
});

test("withdrawing consent during loading permanently drops the pending Purchase", () => {
  const app = pixel(purchaseOptions);
  app.api.setMarketingConsent("granted");
  app.api.trackMetaPurchase(purchase());
  app.api.setMarketingConsent("denied");
  app.api.setMarketingConsent("granted");
  app.load();
  app.api.trackMetaPurchase(purchase());
  assert.equal(events(app, "Purchase").length, 0);
  assert.equal(app.calls.some((args) => args[0] === "init"), true, "Page remains eligible, but the revoked event is gone");
  assert.equal([...app.values.keys()].some((key) => key.startsWith("cymba-meta-purchases")), false);
});

test("Purchase tracking works without storage and never breaks the reservation page", () => {
  const app = pixel({ ...purchaseOptions, storageUnavailable: true });
  app.api.setMarketingConsent("granted");
  assert.doesNotThrow(() => app.api.trackMetaPurchase(purchase()));
  app.load();
  app.api.trackMetaPurchase(purchase());
  assert.equal(events(app, "Purchase").length, 1);
});

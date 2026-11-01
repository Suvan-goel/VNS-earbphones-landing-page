const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const { webcrypto } = require("node:crypto");

const CONSENT_KEY = "analytics-consent";
const SESSION_KEY = "cymba-analytics-session-v2";
const ERASURE_PREFIX = "cymba-analytics-withdrawal-v2:";
const version = "analytics-2026-10-29-v2";
const record = (choice, extras = {}) => JSON.stringify({ choice, version, recordedAt: Date.now() - 10, ...extras });
const token = () => `${Date.now()}.${"a".repeat(64)}`;

// Real modules, isolated browser storage and mocked transport only.
function analytics({ stored = {}, sessionStored = {}, storageUnavailable = false, beaconResult = true, eraseResult = true, cryptoUnavailable = false } = {}) {
  const values = new Map(Object.entries(stored));
  const sessionValues = new Map(Object.entries(sessionStored));
  const listeners = new Map();
  const timers = new Map();
  const beacons = [];
  const requests = [];
  let timerId = 0;
  let deletionSucceeds = eraseResult;
  const storage = (map) => ({
    get length() { return map.size; }, key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  });
  const window = {
    location: new URL("https://trycymba.com/?utm_source=facebook&utm_campaign=website-launch"),
    crypto: cryptoUnavailable ? undefined : webcrypto,
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
    },
    removeEventListener: (name, callback) => listeners.get(name)?.delete(callback),
    dispatch(event) { for (const callback of listeners.get(event.type) ?? []) callback(event); },
  };
  for (const [name, map] of [["localStorage", values], ["sessionStorage", sessionValues]]) {
    Object.defineProperty(window, name, { get() {
      if (storageUnavailable) throw new Error("Storage blocked");
      return storage(map);
    } });
  }
  const context = vm.createContext({
    window, document: { referrer: "https://www.facebook.com/ad-path?private=value" },
    navigator: { sendBeacon(url, body) {
      beacons.push({ url, body });
      if (beaconResult === "throw") throw new Error("Beacon unavailable");
      return beaconResult;
    } },
    fetch: async (url, options) => {
      requests.push({ url, ...options });
      if (url.endsWith("/withdraw")) {
        if (deletionSucceeds === "throw") throw new Error("Offline");
        return { ok: deletionSucceeds, json: async () => ({ erased: deletionSucceeds }) };
      }
      return { ok: true, json: async () => ({ stored: true }) };
    },
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
    URL, Blob, Uint8Array, AbortSignal,
  });
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    vm.runInContext(`(function(require, module, exports) {${source}\n})`, context, { filename })(
      (name) => load(path.resolve(path.dirname(filename), `${name}.ts`)), module, module.exports);
    return module.exports;
  }
  const api = load(path.resolve(__dirname, "../src/lib/analytics.ts"));
  return {
    api, values, sessionValues, window, beacons, requests,
    setEraseResult(value) { deletionSucceeds = value; },
    tick(delay = 800) {
      const pending = [...timers].filter(([, timer]) => timer.delay === delay);
      for (const [id, { callback }] of pending) { timers.delete(id); callback(); }
    },
    async settle() { for (let n = 0; n < 10; n++) await Promise.resolve(); },
    async batches() { return Promise.all(beacons.map(async ({ body }) => JSON.parse(await body.text()))); },
    async events() { return (await this.batches()).flatMap(({ events }) => events); },
  };
}

test("no attribution storage/access or retroactive events before consent, including legacy grants", async () => {
  for (const stored of [{}, { [CONSENT_KEY]: "granted" }, { "cymba-marketing-consent-v1": "granted" }]) {
    const app = analytics({ stored, sessionStored: { "first-touch": '{"utm_source":"old"}' } });
    assert.equal(app.api.getConsent(), null);
    assert.deepEqual(JSON.parse(JSON.stringify(app.api.getAttribution())), {});
    assert.equal(app.sessionValues.has("first-touch"), false);
    app.api.track("waitlist_submit_attempt"); app.tick();
    app.api.setConsent("granted"); app.tick();
    assert.equal(app.beacons.length, 0);
    app.api.track("page_view"); app.tick();
    const [batch] = await app.batches();
    assert.equal(batch.events[0].attribution.utm_source, "facebook");
    assert.equal(batch.events[0].attribution.referrer, "www.facebook.com");
    assert.match(batch.token, /^\d{13}\.[a-f0-9]{64}$/);
    assert.equal(app.sessionValues.get(SESSION_KEY), batch.token);
    assert.equal(batch.consent.version, version);
    assert.equal(typeof batch.consent.recordedAt, "number");
    assert.equal(batch.events[0].sessionId, undefined);
  }
});

test("versioned consent refreshes unknown/expired grants but preserves refusals", () => {
  for (const value of ["denied", record("denied", { version: "old" })]) {
    assert.equal(analytics({ stored: { [CONSENT_KEY]: value } }).api.getConsent(), "denied");
  }
  for (const value of [record("granted", { version: "old" }), record("granted", { recordedAt: 1 }), "garbage"]) {
    assert.equal(analytics({ stored: { [CONSENT_KEY]: value } }).api.getConsent(), null);
  }
  assert.equal(analytics({ stored: { [CONSENT_KEY]: record("granted") } }).api.getConsent(), "granted");
});

test("withdrawal clears attribution and unsent events immediately, then erases only the secret-bound session", async () => {
  const app = analytics();
  app.api.setConsent("granted"); app.api.track("page_view"); app.tick();
  const [batch] = await app.batches();
  app.api.track("cta_click");
  const statuses = [];
  app.api.subscribeAnalyticsWithdrawal(() => statuses.push(app.api.getAnalyticsWithdrawalStatus()));
  app.api.setConsent("denied");
  assert.equal(app.api.getAnalyticsWithdrawalStatus(), "pending");
  assert.equal(app.sessionValues.has(SESSION_KEY), false);
  assert.equal(app.sessionValues.has("first-touch"), false);
  assert.equal(app.values.get(`${ERASURE_PREFIX}${batch.token}`), "pending");
  app.tick(); app.window.dispatch({ type: "pagehide" });
  app.api.track("waitlist_signup_success");
  await app.settle();
  assert.equal((await app.events()).length, 1);
  assert.equal(app.api.getAnalyticsWithdrawalStatus(), "complete");
  assert.equal(app.values.has(`${ERASURE_PREFIX}${batch.token}`), false);
  assert.equal(JSON.parse(app.requests[0].body).token, batch.token);
  assert.equal(app.requests[0].url, "/api/events/withdraw");
  assert.deepEqual(statuses, ["pending", "complete"]);
});

test("failed withdrawal remains pending and retries after navigation or reconnection", async () => {
  const oldToken = token();
  const app = analytics({ stored: { [CONSENT_KEY]: record("denied"), [`${ERASURE_PREFIX}${oldToken}`]: "pending" }, eraseResult: "throw" });
  await app.settle();
  assert.equal(app.api.getAnalyticsWithdrawalStatus(), "pending");
  assert.equal(app.values.has(`${ERASURE_PREFIX}${oldToken}`), true);
  app.setEraseResult(true);
  app.window.dispatch({ type: "online" });
  await app.settle();
  assert.equal(app.api.getAnalyticsWithdrawalStatus(), "complete");
  assert.equal(app.values.has(`${ERASURE_PREFIX}${oldToken}`), false);
});

test("legacy identifiers are never sent to unauthenticated deletion or falsely reported erased", async () => {
  const app = analytics({ sessionStored: { sid: "old-weak-session", "first-touch": "{}" } });
  assert.equal(app.api.getAnalyticsWithdrawalStatus(), "unavailable");
  assert.equal(app.sessionValues.has("sid"), false);
  assert.equal(app.values.get("cymba-analytics-legacy-reference-v1"), "old-weak-session");
  assert.equal(app.requests.length, 0);
  app.api.setConsent("granted"); app.api.track("page_view"); app.tick();
  app.api.setConsent("denied"); await app.settle();
  assert.equal(app.api.getAnalyticsWithdrawalStatus(), "unavailable");
});

test("cross-tab refusal withdraws this tab's own session and ignores advertising changes", async () => {
  const app = analytics();
  const choices = [];
  const unsubscribe = app.api.subscribeConsent(() => choices.push(app.api.getConsent()));
  app.api.setConsent("granted"); app.api.track("page_view"); app.tick();
  app.window.dispatch({ type: "storage", key: "cymba-marketing-consent-v1", newValue: "denied" });
  app.window.dispatch({ type: "storage", key: CONSENT_KEY, newValue: record("denied") });
  assert.equal(app.api.getConsent(), "denied");
  assert.equal(app.api.getAnalyticsWithdrawalStatus(), "pending");
  await app.settle();
  assert.deepEqual(choices, ["granted", "denied"]);
  unsubscribe();
});

test("blocked storage honors consent and reports retry durability honestly on failure", async () => {
  const app = analytics({ storageUnavailable: true, eraseResult: false });
  app.api.setConsent("granted"); app.api.track("page_view"); app.tick();
  app.api.track("waitlist_signup_success"); app.tick();
  const batches = await app.batches();
  assert.equal(batches.length, 2);
  assert.equal(batches[0].token, batches[1].token);
  app.api.setConsent("denied"); await app.settle();
  assert.equal(app.api.getAnalyticsWithdrawalStatus(), "unavailable");
  app.setEraseResult(true); await app.api.retryAnalyticsWithdrawal();
  assert.equal(app.api.getAnalyticsWithdrawalStatus(), "complete");
});

test("no insecure fallback identity is used without browser cryptography", () => {
  const app = analytics({ cryptoUnavailable: true });
  app.api.setConsent("granted"); app.api.track("page_view"); app.tick();
  assert.equal(app.beacons.length, 0);
});

test("unavailable beacons use keepalive fetch; consented batches respect server limit", async () => {
  for (const beaconResult of [false, "throw"]) {
    const app = analytics({ beaconResult });
    app.api.setConsent("granted"); app.api.track("waitlist_signup_success");
    app.window.dispatch({ type: "pagehide" });
    assert.equal(app.requests.length, 1);
    assert.equal(app.requests[0].keepalive, true);
    assert.match(JSON.parse(app.requests[0].body).token, /^\d{13}\.[a-f0-9]{64}$/);
  }
  const app = analytics(); app.api.setConsent("granted");
  for (let n = 0; n < 50; n++) app.api.track("section_view", { section: n });
  app.tick();
  assert.deepEqual((await app.batches()).map(({ events }) => events.length), [25, 25]);
});

function mountTracker(api) {
  let cleanup;
  const filename = path.resolve(__dirname, "../src/components/Tracker.tsx");
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const dependencies = { react: { useEffect: (effect) => { cleanup = effect(); } }, "@/lib/analytics": api };
  const module = { exports: {} };
  const context = vm.createContext({ document: { addEventListener() {}, removeEventListener() {} } });
  vm.runInContext(`(function(require, module, exports) {${source}\n})`, context, { filename })((name) => dependencies[name], module, module.exports);
  module.exports.Tracker({ variant: "focus" });
  return cleanup;
}

test("the current visit is measured once after grant; withdrawal never replays queued visits", async () => {
  const app = analytics(); const cleanup = mountTracker(app.api);
  app.api.setConsent("granted"); app.api.setConsent("denied"); app.tick();
  assert.equal(app.beacons.length, 0);
  app.api.setConsent("granted"); app.tick();
  assert.deepEqual((await app.events()).map(({ name }) => name), ["page_view"]);
  app.api.setConsent("granted"); app.tick();
  assert.deepEqual((await app.events()).map(({ name }) => name), ["page_view"]);
  cleanup();
});

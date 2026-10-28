const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const ROOT = path.resolve(__dirname, "..");

// The pricing config and market detection run without Next: next/headers is replaced by the test's own header lookup.
function load(entry, requestHeaders = {}) {
  const cache = new Map();
  const context = vm.createContext({ process: { env: { NODE_ENV: "test" } }, Intl, console });
  const get = (name) => requestHeaders[name.toLowerCase()] ?? null;
  function loadFile(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    const localRequire = (specifier) => {
      if (specifier === "next/headers") return { headers: async () => ({ get }) };
      if (specifier.startsWith("@/")) return loadFile(path.resolve(ROOT, "src", `${specifier.slice(2)}.ts`));
      if (specifier.startsWith(".")) return loadFile(path.resolve(path.dirname(filename), `${specifier}.ts`));
      return require(specifier);
    };
    vm.runInContext(`(function(require, module, exports) {${source}\n})`, context, { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  return loadFile(path.resolve(ROOT, entry));
}

const pricing = load("src/config/pricing.ts");
const marketLib = (headers) => load("src/lib/market.ts", headers);

test("launch prices are fixed per market and formatted in the local style", () => {
  assert.equal(pricing.launch.window, "Q4 2027");
  assert.deepEqual([pricing.markets.uk.retail, pricing.markets.uk.subscription, pricing.markets.uk.deposit], [40000, 1500, 3500]);
  assert.deepEqual([pricing.markets.us.retail, pricing.markets.us.subscription, pricing.markets.us.deposit], [44900, 1500, 5000]);
  assert.equal(pricing.markets.uk.currency, "gbp");
  assert.equal(pricing.markets.us.currency, "usd");
  assert.equal(pricing.formatPrice("uk", "retail"), "£400");
  assert.equal(pricing.formatPrice("us", "retail"), "$449");
  assert.equal(pricing.formatPrice("uk", "subscription"), "£15");
  assert.equal(pricing.formatPrice("us", "subscription"), "$15");
  assert.equal(pricing.formatPrice("uk", "deposit"), "£35");
  assert.equal(pricing.formatPrice("us", "deposit"), "$50");
  assert.equal(pricing.formatPrice("uk", "balance"), "£365");
  assert.equal(pricing.formatPrice("us", "balance"), "$399");
  assert.equal(pricing.formatAmount("us", 4999), "$49.99");
  assert.equal(pricing.formatPrice("us", "deposit", { explicit: true }), "US$50");
  assert.equal(pricing.formatBothMarkets("retail"), "£400 (UK) or US$449 (US)");
  assert.equal(pricing.formatBothMarkets("subscription", " a month"), "£15 a month (UK) or US$15 a month (US)");
  assert.equal(pricing.formatCompactMarkets("deposit"), "£35 / US$50");
  assert.equal(pricing.defaultMarket, "us");
});

test("only the two markets are accepted and countries map to them", () => {
  for (const value of ["uk", "us"]) assert.equal(pricing.isMarket(value), true, value);
  for (const value of ["UK", "gb", "eu", "", null, undefined, 0, {}, "__proto__", "constructor", "toString"]) {
    assert.equal(pricing.isMarket(value), false, String(value));
  }
  assert.equal(pricing.marketForCountry("GB"), "uk");
  assert.equal(pricing.marketForCountry("gb"), "uk");
  assert.equal(pricing.marketForCountry(" JE "), "uk");
  assert.equal(pricing.marketForCountry("US"), "us");
  assert.equal(pricing.marketForCountry("PR"), "us");
  for (const value of ["DE", "FR", "IE", "CA", "AU", "XX", "T1", "", null, undefined]) {
    assert.equal(pricing.marketForCountry(value), null, String(value));
  }
});

test("a saved choice wins over geolocation, which wins over the dollar default", async () => {
  const cases = [
    [{}, { market: "us", source: "default", country: null }],
    [{ "cf-ipcountry": "GB" }, { market: "uk", source: "geo", country: "GB" }],
    [{ "cf-ipcountry": "US" }, { market: "us", source: "geo", country: "US" }],
    [{ "cf-ipcountry": "DE" }, { market: "us", source: "default", country: "DE" }],
    [{ "cf-ipcountry": "XX" }, { market: "us", source: "default", country: null }],
    [{ "cf-ipcountry": "T1" }, { market: "us", source: "default", country: null }],
    [{ "x-vercel-ip-country": "gb" }, { market: "uk", source: "geo", country: "GB" }],
    [{ "cloudfront-viewer-country": "GB" }, { market: "uk", source: "geo", country: "GB" }],
    [{ "cf-ipcountry": "GB", cookie: "cymba_market=us" }, { market: "us", source: "cookie", country: "GB" }],
    [{ "cf-ipcountry": "US", cookie: "other=1; cymba_market=uk; more=2" }, { market: "uk", source: "cookie", country: "US" }],
    [{ "cf-ipcountry": "US", cookie: "cymba_market=eu" }, { market: "us", source: "geo", country: "US" }],
    [{ cookie: "cymba_market=__proto__" }, { market: "us", source: "default", country: null }],
    [{ "cf-ipcountry": "GB", cookie: "cymba_market=" }, { market: "uk", source: "geo", country: "GB" }],
  ];
  for (const [headers, expected] of cases) {
    const lib = marketLib(headers);
    // Results come from the vm realm, so they are copied before the prototype-aware comparison.
    assert.deepEqual({ ...lib.resolveMarket((name) => headers[name.toLowerCase()] ?? null) }, expected, JSON.stringify(headers));
    assert.deepEqual({ ...await lib.detectMarket() }, expected, JSON.stringify(headers));
  }
});

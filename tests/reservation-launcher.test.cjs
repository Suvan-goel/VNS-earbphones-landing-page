const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const account = "acct_launcherSynthetic";
const testKey = "rkcs_test_launcher_synthetic_only";
const testPublishableKey = "pk_test_launcher_synthetic_only";
const future = () => new Date(Date.now() + 86400000).toISOString();
const manifest = (changes = {}) => ({ account_id: account, sandbox_expires_at: future(), ...changes });
const toml = (key = testKey, quote = "'", accountId = account, publishableKey = testPublishableKey) =>
  `[default]\naccount_id = ${quote}${accountId}${quote}\ntest_mode_api_key = ${quote}${key}${quote}\ntest_mode_pub_key = ${quote}${publishableKey}${quote}\n`;

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cymba-launcher-test-"));
  await fs.mkdir(path.join(root, "scripts"));
  await fs.mkdir(path.join(root, ".data/stripe-local"), { recursive: true });
  for (const file of ["reservation-local-config.mjs", "reservations-local.mjs"]) {
    await fs.copyFile(path.join(ROOT, "scripts", file), path.join(root, "scripts", file));
  }
  const configFile = path.join(root, ".data/stripe-local/config.toml");
  const manifestFile = path.join(root, ".data/stripe-local/manifest.json");
  const config = await import(pathToFileURL(path.join(root, "scripts/reservation-local-config.mjs")).href);
  return {
    root, configFile, config,
    write: async (source = toml(), value = manifest()) => {
      await fs.writeFile(configFile, source, { mode: 0o644 });
      await fs.writeFile(manifestFile, JSON.stringify(value));
    },
    close: () => fs.rm(root, { recursive: true, force: true }),
  };
}

test("launcher reads Stripe's quoted default profile and requires the manifest account", async () => {
  const f = await fixture();
  try {
    for (const quote of ["'", '"']) {
      await f.write(toml(testKey, quote));
      const value = await f.config.localConfig();
      assert.equal(value.accountId, account);
      assert.equal(value.key, testKey);
      assert.equal(value.publishableKey, testPublishableKey);
      assert.ok(Date.parse(value.expiresAt) > Date.now());
      assert.equal((await fs.stat(f.configFile)).mode & 0o777, 0o600);
    }
    await f.write(`${toml()}\n[personal]\naccount_id='acct_other'\ntest_mode_api_key='sk_live_other_synthetic'\ntest_mode_pub_key='pk_live_other_synthetic'\n`);
    const selected = await f.config.localConfig();
    assert.equal(selected.key, testKey, "unrelated personal profile is ignored");
    assert.equal(selected.publishableKey, testPublishableKey, "publishable key stays with the selected sandbox profile");
    await f.write(toml(testKey, "'", "acct_wrong"));
    await assert.rejects(f.config.localConfig(), /account does not match/);
    await f.write(toml().replace("[default]", "[personal]"));
    await assert.rejects(f.config.localConfig(), /account does not match/, "no fallback to another profile");
  } finally { await f.close(); }
});

test("launcher rejects live keys and invalid or expired temporary sandboxes", async () => {
  const f = await fixture();
  try {
    for (const key of ["sk_live_synthetic", "rk_live_synthetic", "rkcs_live_synthetic", "invalid", ""]) {
      await f.write(toml(key));
      await assert.rejects(f.config.localConfig(), /test key/);
    }
    for (const expiry of [null, "", "invalid", "2001-01-01"]) {
      await f.write(toml(), manifest({ sandbox_expires_at: expiry }));
      await assert.rejects(f.config.localConfig(), /expired|expiry|expiration/i);
    }
  } finally { await f.close(); }
});

test("launcher requires a test publishable key in the selected sandbox profile", async () => {
  const f = await fixture();
  try {
    for (const key of ["pk_live_synthetic", "sk_test_synthetic", "invalid", ""]) {
      await f.write(toml(testKey, "'", account, key));
      await assert.rejects(f.config.localConfig(), /test publishable key/);
    }
    await f.write(toml().replace(/^test_mode_pub_key.*\n/m, "")
      + "\n[personal]\ntest_mode_pub_key='pk_test_other_synthetic'\n");
    await assert.rejects(f.config.localConfig(), /test publishable key/, "another profile cannot fill a missing sandbox key");
  } finally { await f.close(); }
});

test("only explicitly claimed sandboxes with permanent test keys may have null expiry", async () => {
  const f = await fixture();
  try {
    for (const key of ["sk_test_permanent_synthetic", "rk_test_permanent_synthetic"]) {
      await f.write(toml(key), manifest({ claimed: true, sandbox_expires_at: null }));
      const value = await f.config.localConfig();
      assert.equal(value.key, key);
      assert.equal(value.expiresAt, null);
    }
    for (const changes of [
      { claimed: false, sandbox_expires_at: null }, { claimed: "true", sandbox_expires_at: null },
      { claimed: true, sandbox_expires_at: undefined },
    ]) {
      await f.write(toml("rk_test_permanent_synthetic"), manifest(changes));
      await assert.rejects(f.config.localConfig());
    }
    await f.write(toml(), manifest({ claimed: true, sandbox_expires_at: null }));
    await assert.rejects(f.config.localConfig(), /permanent|claim|expir/i, "temporary claimable credentials cannot disable expiry");
  } finally { await f.close(); }
});

test("launcher replaces inherited production settings and redacts supported credentials", async () => {
  const f = await fixture();
  try {
    const originalEnv = process.env;
    let isolated;
    try {
      // Substitute the entire environment to avoid reading any machine credentials.
      process.env = {
        NODE_ENV: "production", SUPABASE_URL: "https://production.example.com",
        SUPABASE_SECRET_KEY: "synthetic_database_secret", SUPABASE_SERVICE_ROLE_KEY: "synthetic_legacy_secret",
        STRIPE_API_KEY: "sk_live_synthetic_old", STRIPE_SECRET_KEY: "rk_live_synthetic_old", STRIPE_PUBLISHABLE_KEY: "pk_live_synthetic_old",
        STRIPE_WEBHOOK_SECRET: "whsec_synthetic_old", RESERVATIONS_PREVIEW: "true",
        NEXT_PUBLIC_SITE_URL: "https://production.example.com", NEXT_PUBLIC_META_PIXEL_ID: "12345",
        NEXT_PUBLIC_META_LEAD_TRACKING_ENABLED: "true", NEXT_PUBLIC_ANALYTICS_ENDPOINT: "https://analytics.example.com",
      };
      isolated = f.config.isolatedEnv(testKey, testPublishableKey);
    } finally { process.env = originalEnv; }
    assert.equal(isolated.NODE_ENV, "development");
    assert.equal(isolated.RESERVATIONS_LOCAL_TEST, "true");
    assert.equal(isolated.RESERVATIONS_ENABLED, "true");
    assert.equal(isolated.RESERVATIONS_PREVIEW, "false");
    assert.equal(isolated.WAITLIST_STORAGE, "file");
    for (const key of ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_META_PIXEL_ID"]) {
      assert.equal(isolated[key], "", key);
    }
    assert.equal(isolated.STRIPE_API_KEY, testKey);
    assert.equal(isolated.STRIPE_SECRET_KEY, testKey);
    assert.equal(isolated.STRIPE_PUBLISHABLE_KEY, testPublishableKey);
    assert.equal(isolated.NEXT_PUBLIC_SITE_URL, "http://127.0.0.1:3015");
    assert.equal(isolated.NEXT_PUBLIC_META_LEAD_TRACKING_ENABLED, "false");
    assert.equal(isolated.NEXT_PUBLIC_ANALYTICS_ENDPOINT, "none");
    assert.equal(isolated.NEXT_TELEMETRY_DISABLED, "1");
    const credentials = ["sk_test_synthetic", "rk_test_synthetic", "rkcs_test_synthetic", "pk_test_synthetic",
      "sk_live_synthetic", "rk_live_synthetic", "pk_live_synthetic", "whsec_synthetic"];
    const output = f.config.redact(`Normal output ${credentials.join(" ")} acct_safe`);
    for (const credential of credentials) assert.equal(output.includes(credential), false);
    assert.match(output, /Normal output/);
    assert.match(output, /acct_safe/);
  } finally { await f.close(); }
});

// Exercise the real launcher's lifecycle with simulated OS boundaries. No real
// processes are spawned, no ports are opened, and no actual config is consulted.
async function launcherHarness(root, options = {}) {
  const children = [];
  const signals = [];
  const logs = [];
  const timers = [];
  const handlers = new Map();
  const syntheticProcess = {
    env: {}, platform: "darwin", execPath: "/synthetic/node", exitCode: undefined,
    once: (event, fn) => handlers.set(event, fn),
    kill: (pid, signal) => signals.push({ pid, signal }),
    exit: () => { throw new Error("Synthetic process exited"); },
  };
  const source = (await fs.readFile(path.join(root, "scripts/reservations-local.mjs"), "utf8"))
    .replace(/^import .*;\r?\n/gm, "");
  const running = vm.runInNewContext(`(async () => {${source}\n})()`, {
    root, configPath: path.join(root, ".data/stripe-local/config.toml"), localOrigin: "http://127.0.0.1:3015",
    webhookEvents: ["checkout.session.completed"], path,
    process: syntheticProcess,
    localConfig: () => options.configPromise ?? Promise.resolve({ accountId: account, key: testKey, publishableKey: testPublishableKey, expiresAt: future() }),
    isolatedEnv: (key, publishableKey) => ({ RESERVATIONS_LOCAL_TEST: "true", STRIPE_SECRET_KEY: key, STRIPE_PUBLISHABLE_KEY: publishableKey }),
    redact: (value) => String(value).replace(/\b(?:rkcs_test_|whsec_)[A-Za-z0-9_]+/g, "[hidden]"),
    readFile: async () => { throw Object.assign(new Error("No database lock"), { code: "ENOENT" }); },
    unlink: async () => { throw new Error("No lock should be removed"); },
    net: { createServer: () => {
      let onError;
      return {
        once(event, handler) { if (event === "error") onError = handler; },
        listen(port, host, ready) {
          if (options.bindError) onError(Object.assign(new Error("Synthetic bind failure"), { code: options.bindError }));
          else ready();
        },
        close(done) { done(); },
      };
    } },
    spawn: (command, args, options) => {
      const child = new EventEmitter();
      Object.assign(child, { pid: 9000 + children.length, command, args, options, stdout: new PassThrough(), stderr: new PassThrough() });
      children.push(child);
      return child;
    },
    setTimeout: (run, delay) => { const timer = { run, delay, active: true }; timers.push(timer); return timer; },
    clearTimeout: (timer) => { if (timer) timer.active = false; },
    console: { log: (value) => logs.push(value), error: (value) => logs.push(value) },
  });
  return { running, children, signals, logs, timers, handlers, process: syntheticProcess };
}

test("launcher buffers split signing secrets and stops surviving child groups after parent exit", async () => {
  const f = await fixture();
  try {
    const h = await launcherHarness(f.root);
    await h.running;
    assert.equal(h.children.length, 1);
    const listener = h.children[0];
    assert.equal(listener.command, "stripe");
    listener.stdout.write("Ready, signing secret whsec_split_");
    assert.equal(h.children.length, 1, "incomplete line cannot start Next");
    listener.stdout.write("synthetic\n");
    assert.equal(h.children.length, 2);
    const app = h.children[1];
    assert.equal(app.options.env.STRIPE_WEBHOOK_SECRET, "whsec_split_synthetic");
    assert.equal(app.options.env.STRIPE_SECRET_KEY, testKey);
    assert.equal(app.options.env.STRIPE_PUBLISHABLE_KEY, testPublishableKey);
    assert.equal(h.logs.some((line) => line.includes("whsec_")), false);
    assert.equal(h.timers.find((timer) => timer.delay === 30000).active, false);
    app.stderr.write("Failure with rkcs_test_split_");
    app.stderr.write("synthetic\n");
    assert.equal(h.logs.some((line) => line.includes("rkcs_test_")), false);
    app.emit("exit", 1);
    assert.equal(h.process.exitCode, 1);
    for (const child of h.children) assert.ok(h.signals.some((item) => item.pid === -child.pid && item.signal === "SIGTERM"));
    h.timers.find((timer) => timer.delay === 5000).run();
    for (const child of h.children) assert.ok(h.signals.some((item) => item.pid === -child.pid && item.signal === "SIGKILL"));
  } finally { await f.close(); }
});

test("cancelling startup while configuration is pending never spawns a service", async () => {
  const f = await fixture();
  let resolveConfig;
  const configPromise = new Promise((resolve) => { resolveConfig = resolve; });
  try {
    const h = await launcherHarness(f.root, { configPromise });
    h.handlers.get("SIGINT")();
    resolveConfig({ accountId: account, key: testKey, publishableKey: testPublishableKey, expiresAt: future() });
    await h.running;
    assert.equal(h.children.length, 0);
    assert.equal(h.signals.length, 0);
  } finally { await f.close(); }
});

test("launcher distinguishes an occupied port from denied local network access", async () => {
  const f = await fixture();
  try {
    for (const code of ["EADDRINUSE", "EPERM", "EACCES", "EADDRNOTAVAIL"]) {
      const h = await launcherHarness(f.root, { bindError: code });
      await h.running;
      assert.equal(h.children.length, 0);
      assert.equal(h.process.exitCode, 1);
      const output = h.logs.join("\n");
      if (code === "EADDRINUSE") assert.match(output, /already in use/);
      else {
        assert.doesNotMatch(output, /already in use/);
        assert.match(output, code === "EPERM" || code === "EACCES" ? /Permission.*denied/ : /Could not check.*EADDRNOTAVAIL/);
      }
    }
  } finally { await f.close(); }
});

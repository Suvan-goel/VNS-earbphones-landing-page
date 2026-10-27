import { readFile, chmod } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const configPath = path.join(root, ".data/stripe-local/config.toml");
export const localOrigin = "http://127.0.0.1:3015";
export const webhookEvents = [
  "checkout.session.completed", "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed", "checkout.session.expired",
  "charge.refunded", "refund.created", "refund.updated", "refund.failed",
];
export function redact(text) {
  return String(text).replace(/\b(?:[srp]k|rkcs)_(?:test|live)_[A-Za-z0-9_]+/g, "[Stripe key hidden]")
    .replace(/\bwhsec_[A-Za-z0-9_]+/g, "[webhook secret hidden]");
}
export async function localConfig() {
  let source, manifest;
  try {
    [source, manifest] = await Promise.all([
      readFile(configPath, "utf8"),
      readFile(path.join(root, ".data/stripe-local/manifest.json"), "utf8").then(JSON.parse),
    ]);
  } catch {
    throw new Error("The local Stripe sandbox is not configured. See README → Local reservation checkout.");
  }
  // Never fall back to a personal CLI profile.
  const profile = {};
  let active = false;
  for (const line of source.split(/\r?\n/)) {
    const section = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (section) { active = section[1] === "default"; continue; }
    const entry = active && line.match(/^\s*([a-z_]+)\s*=\s*(".*"|'[^']*')\s*$/);
    if (entry) profile[entry[1]] = entry[2].startsWith("'") ? entry[2].slice(1, -1) : JSON.parse(entry[2]);
  }
  if (!/^acct_[A-Za-z0-9]+$/.test(manifest.account_id ?? "") || profile.account_id !== manifest.account_id) {
    throw new Error("The sandbox account does not match the local manifest. Refusing to use another Stripe account.");
  }
  if (!/^(?:[sr]k|rkcs)_test_[A-Za-z0-9_]+$/.test(profile.test_mode_api_key ?? "")) {
    throw new Error("Local checkout requires a Stripe test key. Live keys are never accepted.");
  }
  if (!/^pk_test_[A-Za-z0-9_]+$/.test(profile.test_mode_pub_key ?? "")) {
    throw new Error("Local checkout requires a test publishable key from the same sandbox profile. Live keys are never accepted.");
  }
  const permanent = manifest.claimed === true && manifest.sandbox_expires_at === null
    && /^[sr]k_test_/.test(profile.test_mode_api_key);
  const expiresAt = Date.parse(manifest.sandbox_expires_at);
  if (!permanent && (!Number.isFinite(expiresAt) || expiresAt <= Date.now())) {
    throw new Error("The temporary sandbox has expired. Claim or replace it before starting local checkout; see README.");
  }
  await chmod(configPath, 0o600);
  return { accountId: manifest.account_id, expiresAt: manifest.sandbox_expires_at,
    claimUrl: manifest.sandbox_claim_url, key: profile.test_mode_api_key, publishableKey: profile.test_mode_pub_key };
}
export function isolatedEnv(key, publishableKey) {
  return {
    ...process.env, NODE_ENV: "development",
    RESERVATIONS_LOCAL_TEST: "true", RESERVATIONS_ENABLED: "true", RESERVATIONS_PREVIEW: "false",
    WAITLIST_STORAGE: "file",
    SUPABASE_URL: "", SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "",
    STRIPE_API_KEY: key, STRIPE_SECRET_KEY: key, STRIPE_PUBLISHABLE_KEY: publishableKey, STRIPE_WEBHOOK_SECRET: "",
    NEXT_PUBLIC_SITE_URL: localOrigin,
    NEXT_PUBLIC_META_PIXEL_ID: "", NEXT_PUBLIC_META_LEAD_TRACKING_ENABLED: "false",
    NEXT_PUBLIC_ANALYTICS_ENDPOINT: "none", NEXT_TELEMETRY_DISABLED: "1",
  };
}

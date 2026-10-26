import { spawn } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { root, configPath, localOrigin, webhookEvents, localConfig, isolatedEnv, redact } from "./reservation-local-config.mjs";

let app, stopping = false, startupTimer;
const children = new Set();
function signal(child, signalName) {
  if (!child?.pid) return;
  try { process.kill(process.platform === "win32" ? child.pid : -child.pid, signalName); }
  catch (error) { if (error.code !== "ESRCH") console.error("Could not stop a local child process."); }
}
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  clearTimeout(startupTimer);
  process.exitCode = code;
  for (const child of children) signal(child, "SIGTERM");
  // Keep group IDs until cleanup, including descendants whose parent has exited.
  setTimeout(() => { for (const child of children) signal(child, "SIGKILL"); children.clear(); }, 5000);
}
function childProcess(command, args, env) {
  if (stopping) throw new Error("Local checkout startup was cancelled.");
  const child = spawn(command, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" });
  children.add(child);
  child.on("error", (error) => { console.error(redact(error.message)); stop(1); });
  child.on("exit", (code) => {
    if (!stopping) { console.error(`A local service stopped (${code ?? "signal"}). Stopping checkout.`); stop(1); }
  });
  return child;
}
// Whole lines prevent split secrets from reaching the terminal.
function lines(stream, callback) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.search(/[\r\n]/)) !== -1) {
      const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
      if (line) callback(line.replace(/\x1b\[[0-9;]*m/g, ""));
    }
  });
  stream.on("end", () => { if (buffer) callback(buffer); });
}
async function checkLocalResources() {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => reject(new Error("Port 3015 is already in use. Stop the previous local reservation server first.")));
    probe.listen(3015, "127.0.0.1", () => probe.close(resolve));
  });
  const lockPath = path.join(root, ".data/reservations-test-db.lock");
  let lock;
  try { lock = JSON.parse(await readFile(lockPath, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return; throw new Error("Cannot verify the local database lock. Inspect it before restarting."); }
  if (!Number.isSafeInteger(lock.pid) || lock.pid <= 0) throw new Error("Invalid database owner lock; refusing to open the database.");
  try { process.kill(lock.pid, 0); }
  catch (error) {
    if (error.code === "ESRCH") { await unlink(lockPath); return; }
    throw new Error("Cannot verify whether the local database owner has stopped.");
  }
  throw new Error("The local reservation database is still open in another process. Stop that process first.");
}
process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());
try {
  if (process.env.NODE_ENV === "production") throw new Error("This launcher only runs local development checkout.");
  const config = await localConfig();
  await checkLocalResources();
  if (stopping) process.exit(process.exitCode ?? 0);
  const env = isolatedEnv(config.key);
  console.log(`cymba local checkout · Stripe sandbox ${config.accountId}`);
  console.log(`Test payments only. Local database. ${config.expiresAt ? `Temporary sandbox expires ${config.expiresAt}.` : "Claimed sandbox."}`);
  console.log("Connecting Stripe webhook forwarding…");
  const listener = childProcess("stripe", ["--config", configPath, "--project-name", "default", "--color", "off",
    "listen", "--events", webhookEvents.join(","), "--events-from", "@self", "--forward-to", `${localOrigin}/api/stripe/webhook`, "--latest", "--skip-update"], env);
  startupTimer = setTimeout(() => { console.error("Stripe forwarding did not become ready. Check your connection and sandbox access."); stop(1); }, 30000);
  const stripeLine = (line) => {
    const secret = line.match(/\bwhsec_[A-Za-z0-9_]+/);
    if (secret && !app && !stopping) {
      clearTimeout(startupTimer);
      console.log("Signed webhook forwarding is ready.");
      app = childProcess(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3015"], { ...env, STRIPE_WEBHOOK_SECRET: secret[0] });
      lines(app.stdout, (text) => console.log(redact(text)));
      lines(app.stderr, (text) => console.error(redact(text)));
      console.log(`Open ${localOrigin}/reserve · Ctrl+C stops both local services.`);
    }
    if (!secret) console.log(`[Stripe] ${redact(line)}`);
  };
  lines(listener.stdout, stripeLine);
  lines(listener.stderr, stripeLine);
} catch (error) {
  console.error(redact(error.message));
  stop(1);
}

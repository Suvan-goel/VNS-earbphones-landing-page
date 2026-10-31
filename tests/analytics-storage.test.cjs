const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// Execute the exact migration against real local PostgreSQL. No credentials,
// customer records or production network access are involved.
test("atomic analytics migration preserves withdrawal across retries and transaction failures", async (t) => {
  const { PGlite } = require("@electric-sql/pglite");
  const db = new PGlite();
  const migration = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20261029_analytics_withdrawal.sql"), "utf8");
  const hash = "a".repeat(64);
  const other = "b".repeat(64);
  const event = { name: "page_view", variant: "learn", path: "/", props: { consent_version: "analytics-2026-10-29-v2" }, attribution: { utm_source: "example" } };
  const ingest = async (session = hash, events = [event]) => (await db.query(
    "select public.ingest_consented_analytics($1,$2) as result", [session, JSON.stringify(events)])).rows[0].result;
  const withdraw = async (session = hash) => (await db.query(
    "select public.withdraw_analytics_session($1) as result", [session])).rows[0].result;
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await db.exec(migration);
    await db.exec(migration);
    await t.test("only the service role can execute the mutation functions", async () => {
      for (const role of ["anon", "authenticated", "service_role"]) {
        const expected = role === "service_role";
        for (const fn of ["public.ingest_consented_analytics(text,jsonb)", "public.withdraw_analytics_session(text)"]) {
          assert.equal((await db.query("select has_function_privilege($1,$2,'EXECUTE') as allowed", [role, fn])).rows[0].allowed, expected);
        }
      }
    });
    await t.test("ingestion before withdrawal is erased; ingestion after withdrawal is refused", async () => {
      assert.equal(await ingest(), "stored");
      assert.equal(await ingest(other), "stored");
      assert.equal(await withdraw(), true);
      assert.equal(await ingest(), "withdrawn");
      assert.equal(await withdraw(), true);
      const rows = (await db.query("select name,session_id,props,attribution,path,variant from public.events order by id")).rows;
      assert.equal(rows.length, 2);
      const marker = rows.find((row) => row.session_id === hash);
      assert.equal(marker.name, "analytics_withdrawn");
      assert.deepEqual(marker.props, {});
      assert.deepEqual(marker.attribution, {});
      assert.equal(marker.path, null);
      assert.equal(marker.variant, null);
      assert.equal(rows.find((row) => row.session_id === other).name, "page_view");
    });
    await t.test("a failed delete rolls back its marker and never reports success", async () => {
      await db.exec(`create function public.fail_test_delete() returns trigger language plpgsql as $$ begin raise exception 'simulated storage failure'; end; $$;
        create trigger fail_delete before delete on public.events for each row execute function public.fail_test_delete();`);
      await assert.rejects(withdraw(other), /simulated storage failure/);
      assert.equal((await db.query("select count(*)::integer as n from public.events where session_id=$1 and name='analytics_withdrawn'", [other])).rows[0].n, 0);
      assert.equal((await db.query("select count(*)::integer as n from public.events where session_id=$1 and name='page_view'", [other])).rows[0].n, 1);
      await db.exec("drop trigger fail_delete on public.events; drop function public.fail_test_delete();");
      assert.equal(await withdraw(other), true);
    });
    await t.test("queued inserts cannot resurrect a withdrawn session and malformed batches create nothing", async () => {
      const third = "c".repeat(64);
      assert.deepEqual(await Promise.all([ingest(third), withdraw(third), ingest(third)]), ["stored", true, "withdrawn"]);
      assert.equal((await db.query("select count(*)::integer as n from public.events where session_id=$1 and name<>'analytics_withdrawn'", [third])).rows[0].n, 0);
      for (const events of [null, {}, [], [{ name: "analytics_withdrawn" }], Array(26).fill(event)]) {
        assert.equal(await ingest("d".repeat(64), events), "invalid");
      }
      assert.equal(await ingest("legacy-id"), "invalid");
      assert.equal(await withdraw("legacy-id"), false);
    });
    await t.test("only the final locked implementation is present in the baseline schema", async () => {
      const baseline = fs.readFileSync(path.resolve(__dirname, "../supabase/schema.sql"), "utf8");
      assert.ok(baseline.includes(migration));
    });
  } finally { await db.close(); }
});

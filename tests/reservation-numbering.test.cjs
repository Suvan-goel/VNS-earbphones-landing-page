const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const test = require('node:test');
const sql = name => fs.readFileSync(path.join(__dirname, '../supabase/migrations', name), 'utf8');

test('new public references start at 16 without reducing Founder eligibility or rewriting existing references', async () => {
  const db = new PGlite();
  const create = async () => {
    const id = randomUUID();
    await db.query("insert into reservations(id,attempt_id,email,amount,currency,terms_version,livemode) values ($1,$1,'example@example.com',3500,'gbp','2026-10-29-launch-q3',true)", [id]);
    return id;
  };
  const pay = async (id, event = `evt_${id}`) => (await db.query("select apply_reservation_event($1,'checkout.session.completed',$2,$2,'2026-10-29-launch-q3',$3,$4,null,'paid',3500,'gbp',0,true,now()) as result", [event, id, `cs_${id}`, `pi_${id}`])).rows[0].result;
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await db.exec(sql('20261025_paid_reservations.sql'));
    await db.exec(sql('20261029_reservation_emails.sql'));
    const old = [await create(), await create()];
    for (const id of old) await pay(id);
    const before = Number((await db.query('select count(*) as n from reservation_email_outbox')).rows[0].n);
    await db.exec(sql('20261030_reservation_numbers.sql'));
    await db.exec(sql('20261030_reservation_numbers.sql'));
    const sequence = (await db.query('select last_value,is_called from reservation_founder_number_seq')).rows[0];
    assert.equal(Number(sequence.last_value), 16);
    assert.equal(sequence.is_called, false, 'migration must not consume #016');
    assert.equal(Number((await db.query('select count(*) as n from reservation_email_outbox')).rows[0].n), before, 'migration sends no notices');
    const preserved = (await db.query('select founder_number,founder_position from reservations where founder_number is not null order by founder_number')).rows;
    assert.deepEqual(preserved, [{ founder_number: 1, founder_position: 1 }, { founder_number: 2, founder_position: 2 }]);
    const ids = await Promise.all(Array.from({ length: 48 }, create));
    assert.ok((await Promise.all(ids.map(id => pay(id)))).every(value => value === 'applied'));
    assert.equal(await pay(ids[0]), 'duplicate');
    await db.exec(sql('20261030_reservation_numbers.sql'));
    const records = (await db.query('select founder_number,founder_position from reservations where founder_number >=16 order by founder_number')).rows;
    assert.equal(records.length, 48);
    assert.deepEqual(records[0], { founder_number: 16, founder_position: 3 });
    assert.deepEqual(records.at(-1), { founder_number: 63, founder_position: 50 });
    const last = await create(); await pay(last);
    assert.deepEqual((await db.query('select founder_number,founder_position from reservations where id=$1', [last])).rows[0], { founder_number: 64, founder_position: 51 });
    const snapshot = (await db.query("select snapshot from reservation_email_outbox where reservation_id=$1 and kind='paid'", [ids[0]])).rows[0].snapshot;
    assert.equal(snapshot.founder_number, 16);
    assert.equal(snapshot.founder_position, 3, 'outbox captures eligibility before rendering');
  } finally { await db.close(); }
});

test('an empty installation allocates reference 16 and Founder position 1', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await db.exec(sql('20261025_paid_reservations.sql'));
    await db.exec(sql('20261030_reservation_numbers.sql'));
    const row = (await db.query("insert into reservations(email,attempt_id,amount,currency,founder_number,status) values ('example@example.com',gen_random_uuid(),3500,'gbp',nextval('reservation_founder_number_seq'),'paid') returning founder_number,founder_position")).rows[0];
    assert.deepEqual(row, { founder_number: 16, founder_position: 1 });
  } finally { await db.close(); }
});

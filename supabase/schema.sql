-- Waitlist + demand-validation schema for Supabase (Postgres).
-- Run in the Supabase SQL editor. The site writes with a server secret key
-- from server routes only; RLS is enabled with no public policies, so the
-- anon key cannot read or write these tables.

create extension if not exists pgcrypto;

create table if not exists public.waitlist (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  email                text not null,
  research_opt_in      boolean not null default false,
  variant              text,
  utm_source           text,
  utm_medium           text,
  utm_campaign         text,
  utm_term             text,
  utm_content          text,
  referrer             text,
  landing_path         text,
  survey_token         uuid unique,
  survey_interest      text,
  survey_intent        text,
  survey_price         text,
  survey_role          text,
  survey_concern       text,
  survey_completed_at  timestamptz
);

create unique index if not exists waitlist_email_key on public.waitlist (lower(email));
alter table public.waitlist enable row level security;

create table if not exists public.events (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  name         text not null,
  session_id   text,
  variant      text,
  path         text,
  props        jsonb not null default '{}'::jsonb,
  attribution  jsonb not null default '{}'::jsonb
);

create index if not exists events_name_created_idx on public.events (name, created_at desc);
alter table public.events enable row level security;

-- One row per Stripe Checkout session for the reservation deposit.
create table if not exists public.reservations (
  id                     uuid primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),
  email                  text not null,
  variant                text,
  stripe_session_id      text not null unique,
  stripe_payment_intent  text,
  stripe_customer        text,
  amount                 integer not null,
  currency               text not null,
  status                 text not null default 'pending' check (status in ('pending', 'paid', 'refunded', 'expired')),
  founder_number         integer unique,
  paid_at                timestamptz,
  refunded_at            timestamptz,
  utm_source             text,
  utm_medium             text,
  utm_campaign           text,
  utm_term               text,
  utm_content            text,
  referrer               text,
  landing_path           text
);

create index if not exists reservations_status_created_idx on public.reservations (status, created_at desc);
alter table public.reservations enable row level security;

-- Grants are checked before RLS. Only the trusted server may access signup
-- data; the browser never needs a publishable or service-role key.
revoke all on public.waitlist, public.events, public.reservations from public, anon, authenticated;
grant select, insert, update, delete on public.waitlist, public.events, public.reservations to service_role;
revoke all on sequence public.events_id_seq from public, anon, authenticated;
grant usage, select on sequence public.events_id_seq to service_role;

-- Handy views for reading results -----------------------------------------

create or replace view public.funnel_by_variant with (security_invoker = true) as
select
  variant,
  count(*) filter (where name = 'page_view')                as visits,
  count(*) filter (where name = 'cta_click')                as cta_clicks,
  count(*) filter (where name = 'waitlist_submit_attempt')  as submit_attempts,
  count(*) filter (where name = 'waitlist_signup_success')  as signups,
  count(*) filter (where name = 'survey_completed')         as surveys
from public.events
group by variant;

create or replace view public.survey_summary with (security_invoker = true) as
select variant, survey_interest, survey_intent, survey_price, survey_role, count(*) as n
from public.waitlist
where survey_completed_at is not null
group by 1, 2, 3, 4, 5
order by n desc;

create or replace view public.signups_by_source with (security_invoker = true) as
select coalesce(utm_source, '(direct)') as source, utm_medium, utm_campaign, variant, count(*) as signups
from public.waitlist
group by 1, 2, 3, 4
order by signups desc;

-- Views are for the dashboard / service role only.
revoke all on public.funnel_by_variant, public.survey_summary, public.signups_by_source from public, anon, authenticated;
grant select on public.funnel_by_variant, public.survey_summary, public.signups_by_source to service_role;

-- Paid reservation hardening (also available as an upgrade migration).
-- Apply once before enabling reservations. Safe to re-run with reservations disabled.
-- Uses server-only RPCs so a webhook's state change and event receipt commit together.
begin;

-- Existing installations may only contain the free waitlist tables.
create table if not exists public.reservations (
  id                     uuid primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),
  email                  text not null,
  variant                text,
  stripe_session_id      text not null unique,
  stripe_payment_intent  text,
  stripe_customer        text,
  amount                 integer not null,
  currency               text not null,
  status                 text not null default 'pending' check (status in ('pending', 'paid', 'refunded', 'expired')),
  founder_number         integer unique,
  paid_at                timestamptz,
  refunded_at            timestamptz,
  utm_source             text,
  utm_medium             text,
  utm_campaign           text,
  utm_term               text,
  utm_content            text,
  referrer               text,
  landing_path           text
);

create index if not exists reservations_status_created_idx on public.reservations (status, created_at desc);
alter table public.reservations enable row level security;
revoke all on public.reservations from public, anon, authenticated;
grant select, insert, update, delete on public.reservations to service_role;

lock table public.reservations in access exclusive mode;

alter table public.reservations alter column stripe_session_id drop not null;
alter table public.reservations add column if not exists attempt_id uuid;
alter table public.reservations add column if not exists checkout_expires_at timestamptz;
alter table public.reservations add column if not exists terms_version text;
alter table public.reservations add column if not exists terms_accepted_at timestamptz;
alter table public.reservations add column if not exists livemode boolean;
alter table public.reservations add column if not exists amount_refunded integer not null default 0;
-- Give old records an identity, without inventing historical consent or Stripe mode.
update public.reservations set attempt_id = id where attempt_id is null;
alter table public.reservations alter column attempt_id set not null;
create unique index if not exists reservations_attempt_id_key on public.reservations (attempt_id);
create unique index if not exists reservations_payment_intent_key on public.reservations (stripe_payment_intent) where stripe_payment_intent is not null;
alter table public.reservations drop constraint if exists reservations_status_check;
alter table public.reservations add constraint reservations_status_check
  check (status in ('pending', 'processing', 'paid', 'partially_refunded', 'refunded', 'refund_review', 'expired', 'failed'));
alter table public.reservations drop constraint if exists reservations_amounts_check;
alter table public.reservations add constraint reservations_amounts_check
  check (amount > 0 and amount_refunded >= 0 and amount_refunded <= amount);

create sequence if not exists public.reservation_founder_number_seq;
select setval('public.reservation_founder_number_seq',
  greatest(coalesce((select max(founder_number) from public.reservations), 0),
    (select last_value from public.reservation_founder_number_seq)),
  (select is_called from public.reservation_founder_number_seq)
    or exists (select 1 from public.reservations where founder_number is not null));

create table if not exists public.reservation_webhook_events (
  event_id text primary key,
  reservation_id uuid not null references public.reservations(id),
  event_type text not null,
  processed_at timestamptz not null default now()
);
alter table public.reservation_webhook_events enable row level security;
revoke all on public.reservation_webhook_events from public, anon, authenticated;
grant select, insert on public.reservation_webhook_events to service_role;
revoke all on sequence public.reservation_founder_number_seq from public, anon, authenticated;
grant usage, select on sequence public.reservation_founder_number_seq to service_role;

create or replace function public.apply_reservation_event(
  p_event_id text, p_event_type text, p_reservation_id uuid, p_attempt_id uuid,
  p_terms_version text, p_session_id text, p_payment_intent text, p_customer text,
  p_status text, p_amount integer, p_currency text, p_amount_refunded integer,
  p_livemode boolean, p_occurred_at timestamptz
) returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare
  saved public.reservations%rowtype;
  inserted_event text;
  next_status text;
  refunded integer;
  founder integer;
begin
  select * into saved from public.reservations where id = p_reservation_id for update;
  if not found then return 'not_found'; end if;
  if saved.attempt_id is distinct from p_attempt_id
    or saved.terms_version is distinct from p_terms_version
    or saved.livemode is distinct from p_livemode
    or saved.amount is distinct from p_amount
    or saved.currency is distinct from p_currency
    or p_amount_refunded is null or p_amount_refunded < 0 or p_amount_refunded > saved.amount
    or p_status is null or p_status not in ('pending', 'processing', 'paid', 'partially_refunded', 'refunded', 'refund_review', 'expired', 'failed')
    or p_event_id is null or p_event_id = '' or p_event_type is null or p_occurred_at is null
    or (saved.stripe_session_id is not null and p_session_id is not null and saved.stripe_session_id <> p_session_id)
    or (saved.stripe_payment_intent is not null and p_payment_intent is not null and saved.stripe_payment_intent <> p_payment_intent)
    or (p_status in ('paid', 'partially_refunded', 'refunded', 'refund_review') and nullif(p_payment_intent, '') is null)
    then return 'mismatch';
  end if;

  insert into public.reservation_webhook_events (event_id, reservation_id, event_type)
    values (p_event_id, p_reservation_id, p_event_type)
    on conflict (event_id) do nothing returning event_id into inserted_event;
  if inserted_event is null then return 'duplicate'; end if;

  -- Keep historical refund totals. A failed/reversed refund requires manual review;
  -- delayed ordinary payment/refund events cannot clear that review.
  refunded := greatest(saved.amount_refunded, p_amount_refunded);
  next_status := saved.status;
  if saved.status = 'refund_review' or p_status = 'refund_review' then next_status := 'refund_review';
  elsif refunded >= saved.amount then next_status := 'refunded';
  elsif refunded > 0 then next_status := 'partially_refunded';
  elsif saved.status in ('paid', 'partially_refunded', 'refunded') then next_status := saved.status;
  elsif p_status = 'paid' then next_status := 'paid';
  elsif p_status = 'failed' and saved.status in ('pending', 'processing') then next_status := 'failed';
  elsif p_status = 'expired' and saved.status = 'pending' then next_status := 'expired';
  elsif p_status = 'processing' and saved.status = 'pending' then next_status := 'processing';
  end if;
  founder := saved.founder_number;
  if founder is null and next_status in ('paid', 'partially_refunded') then
    founder := nextval('public.reservation_founder_number_seq');
  end if;
  update public.reservations set
    stripe_session_id = coalesce(saved.stripe_session_id, p_session_id),
    stripe_payment_intent = coalesce(saved.stripe_payment_intent, p_payment_intent),
    stripe_customer = coalesce(saved.stripe_customer, p_customer),
    status = next_status,
    amount_refunded = refunded,
    founder_number = founder,
    paid_at = case when next_status in ('paid', 'partially_refunded', 'refunded', 'refund_review')
      then coalesce(saved.paid_at, p_occurred_at) else saved.paid_at end,
    refunded_at = case when next_status = 'refunded'
      then coalesce(saved.refunded_at, p_occurred_at) else saved.refunded_at end
    where id = saved.id;
  return 'applied';
end;
$$;
revoke all on function public.apply_reservation_event(text,text,uuid,uuid,text,text,text,text,text,integer,text,integer,boolean,timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_reservation_event(text,text,uuid,uuid,text,text,text,text,text,integer,text,integer,boolean,timestamptz)
  to service_role;
commit;

-- Optional analytics withdrawal (also available as an upgrade migration).
-- Atomic optional-analytics ingestion and withdrawal. No existing rows are
-- changed by applying this migration. Execute only with the server service role.
begin;

create table if not exists public.events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null,
  session_id text,
  variant text,
  path text,
  props jsonb not null default '{}'::jsonb,
  attribution jsonb not null default '{}'::jsonb
);
create index if not exists events_session_idx on public.events (session_id);
alter table public.events enable row level security;
revoke all on public.events from public, anon, authenticated;
grant select, insert, update, delete on public.events to service_role;
revoke all on sequence public.events_id_seq from public, anon, authenticated;
grant usage, select on sequence public.events_id_seq to service_role;

create or replace function public.ingest_consented_analytics(p_session_hash text, p_events jsonb)
returns text
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_session_hash is null or p_session_hash !~ '^[a-f0-9]{64}$'
    or p_events is null or jsonb_typeof(p_events) <> 'array' then return 'invalid'; end if;
  if jsonb_array_length(p_events) < 1 or jsonb_array_length(p_events) > 25 then return 'invalid'; end if;
  if exists (select 1 from jsonb_array_elements(p_events) as item
    where jsonb_typeof(item) <> 'object' or item->>'name' is null
      or item->>'name' not in ('page_view','cta_click','waitlist_submit_attempt','waitlist_signup_success',
        'waitlist_signup_duplicate','waitlist_signup_error','survey_completed','survey_skipped','faq_open',
        'section_view','reserve_click','reserve_checkout_started','reserve_error')) then return 'invalid'; end if;

  -- The same transaction lock is used by withdrawal, including when a network
  -- response is lost. A delayed write can never commit after confirmed erasure.
  perform pg_advisory_xact_lock(hashtextextended('cymba-analytics:' || p_session_hash, 0));
  if exists (select 1 from public.events where session_id = p_session_hash and name = 'analytics_withdrawn')
    then return 'withdrawn'; end if;
  insert into public.events (name,session_id,variant,path,props,attribution)
    select item->>'name',p_session_hash,left(item->>'variant',40),left(item->>'path',200),
      case when jsonb_typeof(item->'props') = 'object' then item->'props' else '{}'::jsonb end,
      case when jsonb_typeof(item->'attribution') = 'object' then item->'attribution' else '{}'::jsonb end
    from jsonb_array_elements(p_events) as item;
  return 'stored';
end;
$$;
revoke all on function public.ingest_consented_analytics(text,jsonb) from public, anon, authenticated;
grant execute on function public.ingest_consented_analytics(text,jsonb) to service_role;

create or replace function public.withdraw_analytics_session(p_session_hash text)
returns boolean
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_session_hash is null or p_session_hash !~ '^[a-f0-9]{64}$' then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('cymba-analytics:' || p_session_hash, 0));
  if not exists (select 1 from public.events where session_id = p_session_hash and name = 'analytics_withdrawn') then
    insert into public.events (name,session_id) values ('analytics_withdrawn',p_session_hash);
  end if;
  delete from public.events where session_id = p_session_hash and name <> 'analytics_withdrawn';
  return true;
end;
$$;
revoke all on function public.withdraw_analytics_session(text) from public, anon, authenticated;
grant execute on function public.withdraw_analytics_session(text) to service_role;

commit;

-- Transactional messages commit with reservation state. No historical backfill.
begin;

create table if not exists public.reservation_email_outbox (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id),
  notification_key text not null,
  kind text not null check (kind in ('paid','processing','failed','partially_refunded','refunded','refund_review')),
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  state text not null default 'pending' check (state in ('pending','sending','sent','superseded','needs_review')),
  payload jsonb,
  first_attempt_at timestamptz,
  lease_until timestamptz,
  lease_token uuid,
  attempts integer not null default 0,
  provider_id text,
  sent_at timestamptz,
  unique (reservation_id, notification_key)
);
create index if not exists reservation_email_pending_idx on public.reservation_email_outbox (reservation_id, created_at)
  where state in ('pending','sending');
alter table public.reservation_email_outbox enable row level security;
revoke all on public.reservation_email_outbox from public, anon, authenticated;
grant select, insert, update on public.reservation_email_outbox to service_role;

create or replace function public.queue_reservation_email() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare notification text;
begin
  -- Sandbox and preview records must never send to customers.
  if new.livemode is distinct from true then return new; end if;
  if new.status not in ('paid','processing','failed','partially_refunded','refunded','refund_review') then return new; end if;
  if old.status = new.status and old.amount_refunded = new.amount_refunded then return new; end if;
  notification := case when new.status in ('partially_refunded','refunded')
    then 'refund:' || new.amount_refunded::text else new.status end;
  if exists (select 1 from public.reservation_email_outbox where reservation_id = new.id
    and notification_key = notification) then return new; end if;

  -- An unattempted processing/confirmation notice must not follow a newer refund.
  -- Once delivery was attempted it is retained for provider reconciliation.
  update public.reservation_email_outbox set state = 'superseded'
    where reservation_id = new.id and state = 'pending' and first_attempt_at is null;
  insert into public.reservation_email_outbox (reservation_id, notification_key, kind, snapshot)
    values (new.id, notification, new.status, to_jsonb(new))
    on conflict (reservation_id, notification_key) do nothing;
  return new;
end;
$$;
revoke all on function public.queue_reservation_email() from public, anon, authenticated;
drop trigger if exists reservation_email_after_update on public.reservations;
create trigger reservation_email_after_update after update on public.reservations
  for each row execute function public.queue_reservation_email();

-- Lock the reservation to serialize concurrent workers for the same customer.
-- Freeze the exact payload on the first attempt, including sender and attachments.
create or replace function public.claim_reservation_email(p_id uuid, p_payload jsonb, p_token uuid)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare job public.reservation_email_outbox%rowtype; reservation uuid;
begin
  select reservation_id into reservation from public.reservation_email_outbox where id = p_id;
  if reservation is null then return null; end if;
  perform 1 from public.reservations where id = reservation for update;
  select * into job from public.reservation_email_outbox where id = p_id for update;
  if job.state not in ('pending','sending') then return null; end if;
  if exists (select 1 from public.reservation_email_outbox where reservation_id = reservation
    and state = 'sending' and lease_until > now()) then return null; end if;
  -- Resend's deduplication lasts 24h. Stop before expiry if acceptance is uncertain.
  if job.first_attempt_at is not null and job.first_attempt_at < now() - interval '23 hours' then
    update public.reservation_email_outbox set state = 'needs_review', lease_until = null where id = p_id;
    return jsonb_build_object('state','needs_review');
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or p_token is null then return null; end if;
  update public.reservation_email_outbox set
    payload = coalesce(payload, p_payload), state = 'sending', lease_token = p_token,
    first_attempt_at = coalesce(first_attempt_at, now()), lease_until = now() + interval '2 minutes',
    attempts = attempts + 1 where id = p_id returning * into job;
  return to_jsonb(job);
end;
$$;

create or replace function public.finish_reservation_email(p_id uuid, p_token uuid, p_provider_id text)
returns boolean language plpgsql set search_path = public, pg_temp as $$
begin
  if nullif(p_provider_id, '') is null then return false; end if;
  update public.reservation_email_outbox set state = 'sent', provider_id = p_provider_id,
    sent_at = now(), lease_until = null
    where id = p_id and state = 'sending' and lease_token = p_token;
  return found;
end;
$$;
revoke all on function public.claim_reservation_email(uuid,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.finish_reservation_email(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.claim_reservation_email(uuid,jsonb,uuid) to service_role;
grant execute on function public.finish_reservation_email(uuid,uuid,text) to service_role;
commit;

-- Reservation reference numbering and independent Founder eligibility (2026-10-30).
-- Public references start at 16; qualifying Founder order remains independent.
-- Apply with the matching reservationBenefitSummary deployment.
begin;
lock table public.reservations in access exclusive mode;
alter table public.reservations add column if not exists founder_position integer;
-- Preserve historical qualification and references, including any historical gaps.
update public.reservations set founder_position = founder_number
  where founder_position is null and founder_number is not null;
create unique index if not exists reservations_founder_position_key on public.reservations(founder_position)
  where founder_position is not null;
create sequence if not exists public.reservation_founder_position_seq;

do $$
declare next_reference bigint; next_position bigint;
begin
  select greatest(16, (select coalesce(max(founder_number),0)+1 from public.reservations),
    last_value + case when is_called then 1 else 0 end)
    into next_reference from public.reservation_founder_number_seq;
  select greatest((select coalesce(max(founder_position),0)+1 from public.reservations),
    last_value + case when is_called then 1 else 0 end)
    into next_position from public.reservation_founder_position_seq;
  -- RESTART is transactional; replaying the migration never rewinds either counter.
  execute format('alter sequence public.reservation_founder_number_seq restart with %s', next_reference);
  execute format('alter sequence public.reservation_founder_position_seq restart with %s', next_position);
end;
$$;
revoke all on sequence public.reservation_founder_position_seq from public, anon, authenticated;
grant usage, select on sequence public.reservation_founder_position_seq to service_role;

create or replace function public.assign_reservation_founder_position() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.founder_number is not null and new.founder_position is null then
    new.founder_position := nextval('public.reservation_founder_position_seq');
  end if;
  return new;
end;
$$;
revoke all on function public.assign_reservation_founder_position() from public, anon, authenticated;
grant execute on function public.assign_reservation_founder_position() to service_role;
drop trigger if exists reservation_assign_founder_position on public.reservations;
create trigger reservation_assign_founder_position before insert or update on public.reservations
  for each row execute function public.assign_reservation_founder_position();
commit;

-- Two-minute processing grace period; enforce timing and status under the row lock.
-- The application rechecks Stripe immediately before claiming a due processing email.
begin;
create or replace function public.claim_reservation_email(p_id uuid, p_payload jsonb, p_token uuid)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare job public.reservation_email_outbox%rowtype; reservation uuid; current_status text;
begin
  select reservation_id into reservation from public.reservation_email_outbox where id = p_id;
  if reservation is null then return null; end if;
  select status into current_status from public.reservations where id = reservation for update;
  select * into job from public.reservation_email_outbox where id = p_id for update;
  if job.state not in ('pending','sending') then return null; end if;
  if exists (select 1 from public.reservation_email_outbox where reservation_id = reservation
    and state = 'sending' and lease_until > now()) then return null; end if;
  if job.kind = 'processing' then
    if current_status <> 'processing' then
      update public.reservation_email_outbox set
        state = case when first_attempt_at is null then 'superseded' else 'needs_review' end,
        lease_until = null
        where id = p_id returning * into job;
      return jsonb_build_object('state', job.state);
    end if;
    if job.created_at > now() - interval '2 minutes' then
      return jsonb_build_object('state', 'deferred');
    end if;
  end if;
  -- Resend's deduplication lasts 24h. Stop before expiry if acceptance is uncertain.
  if job.first_attempt_at is not null and job.first_attempt_at < now() - interval '23 hours' then
    update public.reservation_email_outbox set state = 'needs_review', lease_until = null where id = p_id;
    return jsonb_build_object('state','needs_review');
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or p_token is null then return null; end if;
  update public.reservation_email_outbox set
    payload = coalesce(payload, p_payload), state = 'sending', lease_token = p_token,
    first_attempt_at = coalesce(first_attempt_at, now()), lease_until = now() + interval '2 minutes',
    attempts = attempts + 1 where id = p_id returning * into job;
  return to_jsonb(job);
end;
$$;


create or replace function public.suppress_reservation_processing_email(p_id uuid)
returns boolean language plpgsql set search_path = public, pg_temp as $$
declare job public.reservation_email_outbox%rowtype; reservation uuid;
begin
  select reservation_id into reservation from public.reservation_email_outbox where id = p_id;
  if reservation is null then return false; end if;
  perform 1 from public.reservations where id = reservation for update;
  select * into job from public.reservation_email_outbox where id = p_id for update;
  if job.kind <> 'processing' then return false; end if;
  if job.state not in ('pending','sending') then return true; end if;
  if job.state = 'sending' and job.lease_until > now() then return false; end if;
  -- Uncertain earlier acceptance needs reconciliation, never a stale retry.
  update public.reservation_email_outbox set
    state = case when first_attempt_at is null then 'superseded' else 'needs_review' end,
    lease_until = null where id = p_id;
  return true;
end;
$$;
revoke all on function public.suppress_reservation_processing_email(uuid) from public, anon, authenticated;
grant execute on function public.suppress_reservation_processing_email(uuid) to service_role;
create index if not exists reservation_processing_email_due_idx
  on public.reservation_email_outbox(created_at, id)
  where kind = 'processing' and state in ('pending','sending');
commit;


-- 20261030_email_production_reliability.sql
-- Prevent outdated confirmations/failures/refund notices after a newer state.
begin;
create or replace function public.claim_reservation_email(p_id uuid, p_payload jsonb, p_token uuid)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare job public.reservation_email_outbox%rowtype; reservation uuid; current_status text; current_refunded integer;
begin
  select reservation_id into reservation from public.reservation_email_outbox where id = p_id;
  if reservation is null then return null; end if;
  select status, amount_refunded into current_status, current_refunded from public.reservations where id = reservation for update;
  select * into job from public.reservation_email_outbox where id = p_id for update;
  if job.state not in ('pending','sending') then return null; end if;
  if exists (select 1 from public.reservation_email_outbox where reservation_id = reservation
    and state = 'sending' and lease_until > now()) then return null; end if;
  if current_status <> job.kind or (job.kind in ('partially_refunded','refunded')
    and current_refunded is distinct from (job.snapshot->>'amount_refunded')::integer) then
      update public.reservation_email_outbox set
        state = case when first_attempt_at is null then 'superseded' else 'needs_review' end,
        lease_until = null
        where id = p_id returning * into job;
      return jsonb_build_object('state', job.state);
  end if;
  if job.kind = 'processing' then
    if job.created_at > now() - interval '2 minutes' then
      return jsonb_build_object('state', 'deferred');
    end if;
  end if;
  -- Resend's deduplication lasts 24h. Stop before expiry if acceptance is uncertain.
  if job.first_attempt_at is not null and job.first_attempt_at < now() - interval '23 hours' then
    update public.reservation_email_outbox set state = 'needs_review', lease_until = null where id = p_id;
    return jsonb_build_object('state','needs_review');
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or p_token is null then return null; end if;
  update public.reservation_email_outbox set
    payload = coalesce(payload, p_payload), state = 'sending', lease_token = p_token,
    first_attempt_at = coalesce(first_attempt_at, now()), lease_until = now() + interval '2 minutes',
    attempts = attempts + 1 where id = p_id returning * into job;
  return to_jsonb(job);
end;
$$;
commit;


-- 20261030_email_delivery_events.sql
-- Provider acceptance and mailbox delivery are different outcomes.
-- Store only event/provider references, never recipient, body or raw headers.
begin;
create table if not exists public.reservation_email_events (
  event_id text primary key check (length(event_id) between 1 and 256),
  provider_id uuid not null,
  event_type text not null check (event_type in ('email.sent','email.delivered','email.delivery_delayed','email.bounced','email.complained','email.failed','email.suppressed')),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now()
);
create index if not exists reservation_email_events_provider_idx on public.reservation_email_events(provider_id, occurred_at desc);
alter table public.reservation_email_events enable row level security;
revoke all on public.reservation_email_events from public, anon, authenticated;
grant select, insert on public.reservation_email_events to service_role;

create or replace function public.record_reservation_email_event(p_event_id text, p_provider_id uuid, p_event_type text, p_occurred_at timestamptz)
returns boolean language plpgsql set search_path = public, pg_temp as $$
begin
  insert into public.reservation_email_events(event_id, provider_id, event_type, occurred_at)
    values(p_event_id, p_provider_id, p_event_type, p_occurred_at) on conflict (event_id) do nothing;
  return true;
end;
$$;
revoke all on function public.record_reservation_email_event(text,uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.record_reservation_email_event(text,uuid,text,timestamptz) to service_role;

create or replace view public.reservation_email_health with (security_invoker = true) as
select q.id, q.reservation_id, q.kind, q.state, q.created_at, q.sent_at, q.attempts, q.provider_id,
  e.event_type as delivery_status, e.occurred_at as delivery_status_at,
  (q.state = 'needs_review'
    or (q.state in ('pending','sending') and q.created_at < now() - interval '5 minutes')
    or coalesce(e.event_type in ('email.bounced','email.complained','email.failed','email.suppressed'), false)
    or (q.state = 'sent' and coalesce(e.event_type,'email.sent') <> 'email.delivered'
      and q.sent_at < now() - interval '15 minutes')) as needs_attention
from public.reservation_email_outbox q
left join lateral (
  select event_type, occurred_at from public.reservation_email_events
  where provider_id::text = q.provider_id
  order by case
    when event_type in ('email.bounced','email.complained','email.failed','email.suppressed') then 4
    when event_type = 'email.delivered' then 3
    when event_type = 'email.delivery_delayed' then 2 else 1 end desc, occurred_at desc, event_id desc limit 1
) e on true;
revoke all on public.reservation_email_health from public, anon, authenticated;
grant select on public.reservation_email_health to service_role;
commit;

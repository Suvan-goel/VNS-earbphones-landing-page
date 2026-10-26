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

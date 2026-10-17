-- Waitlist + demand-validation schema for Supabase (Postgres).
-- Run in the Supabase SQL editor. The site writes with the service-role key
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
revoke all on public.funnel_by_variant, public.survey_summary, public.signups_by_source from anon, authenticated;

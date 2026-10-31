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

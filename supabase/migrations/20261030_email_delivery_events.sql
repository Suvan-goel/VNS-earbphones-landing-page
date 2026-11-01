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

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

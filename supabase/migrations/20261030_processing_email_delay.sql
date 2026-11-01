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

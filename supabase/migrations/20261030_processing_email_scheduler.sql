-- Supabase production scheduler. Core queue timing is separately testable in Postgres.
-- The secret stays in Vault; only a 60-second HMAC signature enters pg_net's queue.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'reservation_email_cron_secret') then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'reservation_email_cron_secret',
      'Dedicated HMAC signing secret for the CYMBA delayed reservation email runner');
  end if;
end;
$$;

create or replace function public.dispatch_due_processing_emails(p_force boolean default false)
returns bigint language plpgsql set search_path = public, pg_temp as $$
declare token text; stamp text; signature text;
begin
  -- Avoid network requests when there is no due work. p_force is for an owner smoke check.
  if not p_force and not exists (
    select 1 from public.reservation_email_outbox
    where kind = 'processing' and state in ('pending','sending')
      and created_at <= now() - interval '2 minutes'
      and (lease_until is null or lease_until < now())
  ) then return null; end if;
  select decrypted_secret into token from vault.decrypted_secrets
    where name = 'reservation_email_cron_secret';
  if token is null then raise exception 'Delayed email runner not configured'; end if;
  stamp := floor(extract(epoch from clock_timestamp()))::bigint::text;
  signature := encode(extensions.hmac('reservation-emails:' || stamp, token, 'sha256'), 'hex');
  return net.http_post(
    url := 'https://trycymba.com/api/internal/reservation-emails/run',
    headers := jsonb_build_object('Content-Type','application/json','X-Cymba-Timestamp',stamp,'X-Cymba-Signature',signature),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
end;
$$;
revoke all on function public.dispatch_due_processing_emails(boolean) from public, anon, authenticated, service_role;

-- Named schedules are updated on replay rather than duplicated.
select cron.schedule('cymba-processing-email-delay', '* * * * *',
  'select public.dispatch_due_processing_emails();');
commit;

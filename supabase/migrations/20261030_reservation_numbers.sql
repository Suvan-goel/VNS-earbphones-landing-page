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

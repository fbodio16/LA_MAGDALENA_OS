-- LA MAGDALENA OS 7.1.0
-- Consolidación segura del registro de cortes de alfalfa.
-- Es idempotente: puede ejecutarse más de una vez.

begin;

alter table public.alfalfa_cuts
  add column if not exists campaign text,
  add column if not exists cut_number integer,
  add column if not exists hectares numeric,
  add column if not exists average_bale_kg numeric,
  add column if not exists humidity numeric,
  add column if not exists quality text,
  add column if not exists batch_code text,
  add column if not exists storage_location text,
  add column if not exists operational_status text default 'En stock',
  add column if not exists updated_at timestamptz not null default now();

create index if not exists alfalfa_cuts_company_date_idx
  on public.alfalfa_cuts(company_id, cut_date desc);
create index if not exists alfalfa_cuts_lot_date_idx
  on public.alfalfa_cuts(lot_id, cut_date desc);
create unique index if not exists alfalfa_cuts_batch_code_uidx
  on public.alfalfa_cuts(company_id, batch_code)
  where batch_code is not null and batch_code <> '';

create or replace function public.lmos_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lmos_alfalfa_cuts_updated_at on public.alfalfa_cuts;
create trigger lmos_alfalfa_cuts_updated_at
before update on public.alfalfa_cuts
for each row execute function public.lmos_set_updated_at();

-- Validaciones no destructivas para nuevas cargas.
do $$
begin
  if not exists (select 1 from pg_constraint where conname='alfalfa_cuts_nonnegative_values') then
    alter table public.alfalfa_cuts add constraint alfalfa_cuts_nonnegative_values
      check (bales >= 0 and rolls >= 0 and total_kg >= 0 and (hectares is null or hectares > 0)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='alfalfa_cuts_humidity_range') then
    alter table public.alfalfa_cuts add constraint alfalfa_cuts_humidity_range
      check (humidity is null or (humidity >= 0 and humidity <= 100)) not valid;
  end if;
end $$;

commit;

select
  to_regclass('public.alfalfa_cuts') as production_table,
  count(*) as existing_cuts,
  count(*) filter (where lot_id is null) as cuts_without_lot
from public.alfalfa_cuts;

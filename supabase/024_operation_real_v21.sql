-- LA MAGDALENA OS 21.0.0
-- Puesta en Marcha de Operación Real
-- Ejecutar después de 023_field_capture_daily_tasks_v20_6.sql

begin;

create table if not exists public.company_operational_profiles (
  company_id uuid primary key references public.companies(id) on delete cascade,
  establishment_name text,
  locality text,
  province text default 'Córdoba',
  country text default 'Argentina',
  productive_area_ha numeric(12,2),
  alfalfa_area_ha numeric(12,2),
  wheat_area_ha numeric(12,2),
  expected_lots integer,
  expected_cuts_per_year numeric(6,2),
  expected_bales_per_ha_cut numeric(8,2),
  standard_bale_weight_kg numeric(8,2),
  irrigation_system text,
  weather_station_name text,
  primary_drone text,
  spraying_drone text,
  operation_started_at date default current_date,
  onboarding_status text not null default 'in_progress'
    check (onboarding_status in ('not_started','in_progress','ready','operational')),
  notes text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_operational_profiles enable row level security;

drop policy if exists company_operational_profiles_select on public.company_operational_profiles;
drop policy if exists company_operational_profiles_insert on public.company_operational_profiles;
drop policy if exists company_operational_profiles_update on public.company_operational_profiles;
drop policy if exists company_operational_profiles_delete on public.company_operational_profiles;

create policy company_operational_profiles_select
on public.company_operational_profiles
for select to authenticated
using (public.is_company_member(company_id));

create policy company_operational_profiles_insert
on public.company_operational_profiles
for insert to authenticated
with check (public.is_company_admin(company_id));

create policy company_operational_profiles_update
on public.company_operational_profiles
for update to authenticated
using (public.is_company_admin(company_id))
with check (public.is_company_admin(company_id));

create policy company_operational_profiles_delete
on public.company_operational_profiles
for delete to authenticated
using (public.is_company_admin(company_id));

insert into public.company_operational_profiles(
  company_id, establishment_name, locality, province, productive_area_ha,
  alfalfa_area_ha, wheat_area_ha, expected_lots, expected_cuts_per_year,
  expected_bales_per_ha_cut, standard_bale_weight_kg, irrigation_system,
  primary_drone, spraying_drone, onboarding_status
)
select
  c.id, c.name, 'Santiago Temple', 'Córdoba', 148,
  88, 60, 13, 10,
  6, 500, 'Riego por goteo',
  'DJI Mavic 3 Multispectral', 'DJI Agras T100', 'in_progress'
from public.companies c
where lower(c.name) like '%magdalena%'
on conflict (company_id) do nothing;

create or replace view public.operation_readiness_v21
with (security_invoker = true)
as
select
  c.id as company_id,
  c.name as company_name,
  p.onboarding_status,
  coalesce(p.expected_lots,0) as expected_lots,
  count(distinct l.id) as configured_lots,
  coalesce(sum(distinct l.area_ha),0) as configured_area_ha,
  count(distinct ie.id) as irrigation_records,
  count(distinct ac.id) as cut_records,
  count(distinct pa.id) as precision_records,
  count(distinct cl.id) as clients,
  count(distinct fo.id) as field_observations,
  count(distinct dt.id) filter (where dt.status in ('pendiente','en_curso')) as active_tasks
from public.companies c
left join public.company_operational_profiles p on p.company_id=c.id
left join public.lots l on l.company_id=c.id
left join public.irrigation_events ie on ie.company_id=c.id
left join public.alfalfa_cuts ac on ac.company_id=c.id
left join public.precision_analyses pa on pa.company_id=c.id
left join public.clients cl on cl.company_id=c.id
left join public.field_observations fo on fo.company_id=c.id
left join public.daily_field_tasks dt on dt.company_id=c.id
group by c.id,c.name,p.onboarding_status,p.expected_lots;

grant select on public.operation_readiness_v21 to authenticated;

commit;

select
  'Operación Real 21.0 instalada' as result,
  to_regclass('public.company_operational_profiles') is not null as profile_ready,
  to_regclass('public.operation_readiness_v21') is not null as readiness_ready;
-- LA MAGDALENA OS 24.0.0
-- Campañas, Rotaciones y Economía por Cultivo
-- Ejecutar después de 026_command_center_multicrop_v23.sql

begin;

create table if not exists public.crop_economic_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  season_id uuid references public.crop_seasons(id) on delete cascade,
  crop_id uuid not null references public.crop_catalog(id) on delete cascade,
  planned_area_ha numeric(12,2) not null default 0,
  expected_yield numeric(14,2),
  yield_unit text,
  expected_price numeric(14,2),
  direct_cost_per_ha numeric(14,2) not null default 0,
  indirect_cost_per_ha numeric(14,2) not null default 0,
  irrigation_cost_per_ha numeric(14,2) not null default 0,
  harvest_cost_per_ha numeric(14,2) not null default 0,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, season_id, crop_id)
);

create table if not exists public.crop_rotation_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  predecessor_crop_id uuid references public.crop_catalog(id) on delete cascade,
  successor_crop_id uuid references public.crop_catalog(id) on delete cascade,
  suitability_score numeric(5,2) not null default 50 check (suitability_score between 0 and 100),
  minimum_gap_years integer not null default 0,
  max_consecutive_years integer,
  rationale text,
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, predecessor_crop_id, successor_crop_id)
);

create table if not exists public.rotation_plan_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  crop_id uuid not null references public.crop_catalog(id) on delete restrict,
  season_id uuid references public.crop_seasons(id) on delete set null,
  plan_year integer not null check (plan_year between 2020 and 2100),
  position_order integer not null default 1,
  area_ha numeric(12,2),
  status text not null default 'planned'
    check (status in ('planned','confirmed','active','completed','cancelled')),
  expected_margin numeric(14,2),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, lot_id, plan_year)
);

create index if not exists idx_crop_economic_plans_company_season
  on public.crop_economic_plans(company_id, season_id);

create index if not exists idx_rotation_plan_entries_lot_year
  on public.rotation_plan_entries(company_id, lot_id, plan_year);

alter table public.crop_economic_plans enable row level security;
alter table public.crop_rotation_rules enable row level security;
alter table public.rotation_plan_entries enable row level security;

drop policy if exists crop_economic_plans_select on public.crop_economic_plans;
drop policy if exists crop_economic_plans_write on public.crop_economic_plans;
create policy crop_economic_plans_select on public.crop_economic_plans
for select to authenticated using (public.is_company_member(company_id));
create policy crop_economic_plans_write on public.crop_economic_plans
for all to authenticated
using (public.can_operate_company(company_id))
with check (public.can_operate_company(company_id));

drop policy if exists crop_rotation_rules_select on public.crop_rotation_rules;
drop policy if exists crop_rotation_rules_write on public.crop_rotation_rules;
create policy crop_rotation_rules_select on public.crop_rotation_rules
for select to authenticated using (public.is_company_member(company_id));
create policy crop_rotation_rules_write on public.crop_rotation_rules
for all to authenticated
using (public.can_operate_company(company_id))
with check (public.can_operate_company(company_id));

drop policy if exists rotation_plan_entries_select on public.rotation_plan_entries;
drop policy if exists rotation_plan_entries_write on public.rotation_plan_entries;
create policy rotation_plan_entries_select on public.rotation_plan_entries
for select to authenticated using (public.is_company_member(company_id));
create policy rotation_plan_entries_write on public.rotation_plan_entries
for all to authenticated
using (public.can_operate_company(company_id))
with check (public.can_operate_company(company_id));

-- Reglas iniciales orientativas y editables.
insert into public.crop_rotation_rules(
  company_id, predecessor_crop_id, successor_crop_id,
  suitability_score, minimum_gap_years, max_consecutive_years, rationale
)
select
  c.id,
  p.id,
  s.id,
  x.score,
  x.gap_years,
  x.max_years,
  x.rationale
from public.companies c
join public.crop_catalog p on p.company_id=c.id
join public.crop_catalog s on s.company_id=c.id
join (values
  ('Trigo','Soja',90,0,2,'Buena secuencia para diversificar fechas y aprovechar rastrojo.'),
  ('Trigo','Maíz',78,0,2,'Secuencia posible con adecuada reposición de nutrientes.'),
  ('Soja','Maíz',88,0,2,'Aporta diversidad y mejora el uso de nutrientes.'),
  ('Maíz','Soja',88,0,2,'Rotación clásica para alternar gramínea y leguminosa.'),
  ('Alfalfa','Trigo',82,0,1,'Aprovecha la estructura y el aporte residual de nitrógeno.'),
  ('Alfalfa','Maíz',85,0,2,'Buena respuesta potencial por fertilidad residual.'),
  ('Trigo','Vicia',92,0,1,'Cultivo de servicio para cobertura y aporte de nitrógeno.'),
  ('Vicia','Maíz',94,0,2,'Antecesor favorable para maíz bajo manejo adecuado.')
) as x(predecessor,successor,score,gap_years,max_years,rationale)
  on p.name=x.predecessor and s.name=x.successor
where lower(c.name) like '%magdalena%'
on conflict(company_id,predecessor_crop_id,successor_crop_id) do nothing;

create or replace view public.crop_economics_dashboard_v24
with (security_invoker = true)
as
select
  ep.company_id,
  ep.season_id,
  ep.crop_id,
  cc.name as crop_name,
  ep.planned_area_ha,
  ep.expected_yield,
  ep.yield_unit,
  ep.expected_price,
  round(ep.planned_area_ha * coalesce(ep.expected_yield,0) * coalesce(ep.expected_price,0),2) as expected_revenue,
  round(ep.planned_area_ha * (
    coalesce(ep.direct_cost_per_ha,0) +
    coalesce(ep.indirect_cost_per_ha,0) +
    coalesce(ep.irrigation_cost_per_ha,0) +
    coalesce(ep.harvest_cost_per_ha,0)
  ),2) as expected_cost,
  round(
    ep.planned_area_ha * coalesce(ep.expected_yield,0) * coalesce(ep.expected_price,0)
    - ep.planned_area_ha * (
      coalesce(ep.direct_cost_per_ha,0) +
      coalesce(ep.indirect_cost_per_ha,0) +
      coalesce(ep.irrigation_cost_per_ha,0) +
      coalesce(ep.harvest_cost_per_ha,0)
    ),2
  ) as expected_margin
from public.crop_economic_plans ep
join public.crop_catalog cc on cc.id=ep.crop_id;

grant select on public.crop_economics_dashboard_v24 to authenticated;

commit;

select
  'Campañas, Rotaciones y Economía 24.0 instalada' as result,
  to_regclass('public.crop_economic_plans') is not null as economics_ready,
  to_regclass('public.crop_rotation_rules') is not null as rotation_rules_ready,
  to_regclass('public.rotation_plan_entries') is not null as rotation_plan_ready;
-- LA MAGDALENA OS 23.0.0
-- Centro de Comando Agronómico + Gestión Multicultivo
-- Ejecutar después de 025_agronomic_assistant_v22.sql

begin;

create table if not exists public.crop_catalog (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  scientific_name text,
  crop_group text not null default 'otro',
  cycle_type text not null default 'annual'
    check (cycle_type in ('annual','perennial','biennial')),
  default_cycle_days integer,
  default_water_requirement_mm numeric(10,2),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, name)
);

create table if not exists public.crop_seasons (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date,
  status text not null default 'planned'
    check (status in ('planned','active','closed','archived')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, name)
);

create table if not exists public.lot_crop_cycles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  crop_id uuid not null references public.crop_catalog(id) on delete restrict,
  season_id uuid references public.crop_seasons(id) on delete set null,
  variety text,
  planting_date date,
  emergence_date date,
  expected_harvest_date date,
  actual_harvest_date date,
  area_ha numeric(12,2),
  production_target numeric(14,2),
  production_unit text,
  irrigation_strategy text,
  status text not null default 'planned'
    check (status in ('planned','active','harvested','closed','cancelled')),
  predecessor_crop text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lot_crop_cycles_company_lot
  on public.lot_crop_cycles(company_id, lot_id, status);

alter table public.crop_catalog enable row level security;
alter table public.crop_seasons enable row level security;
alter table public.lot_crop_cycles enable row level security;

create policy crop_catalog_select on public.crop_catalog
for select to authenticated using (public.is_company_member(company_id));
create policy crop_catalog_write on public.crop_catalog
for all to authenticated
using (public.can_operate_company(company_id))
with check (public.can_operate_company(company_id));

create policy crop_seasons_select on public.crop_seasons
for select to authenticated using (public.is_company_member(company_id));
create policy crop_seasons_write on public.crop_seasons
for all to authenticated
using (public.can_operate_company(company_id))
with check (public.can_operate_company(company_id));

create policy lot_crop_cycles_select on public.lot_crop_cycles
for select to authenticated using (public.is_company_member(company_id));
create policy lot_crop_cycles_write on public.lot_crop_cycles
for all to authenticated
using (public.can_operate_company(company_id))
with check (public.can_operate_company(company_id));

-- Catálogo inicial adaptable para próximos años.
insert into public.crop_catalog(company_id,name,scientific_name,crop_group,cycle_type,default_cycle_days)
select c.id,x.name,x.scientific_name,x.crop_group,x.cycle_type,x.days
from public.companies c
cross join (values
  ('Alfalfa','Medicago sativa','forrajero','perennial',1460),
  ('Trigo','Triticum aestivum','cereal','annual',210),
  ('Maíz','Zea mays','cereal','annual',160),
  ('Soja','Glycine max','oleaginosa','annual',150),
  ('Girasol','Helianthus annuus','oleaginosa','annual',140),
  ('Sorgo','Sorghum bicolor','cereal','annual',135),
  ('Avena','Avena sativa','forrajero','annual',150),
  ('Cebada','Hordeum vulgare','cereal','annual',180),
  ('Centeno','Secale cereale','cereal','annual',170),
  ('Vicia','Vicia villosa','cultivo_servicio','annual',150),
  ('Pastura consociada',null,'forrajero','perennial',1095),
  ('Maní','Arachis hypogaea','oleaginosa','annual',155)
) as x(name,scientific_name,crop_group,cycle_type,days)
where lower(c.name) like '%magdalena%'
on conflict(company_id,name) do nothing;

create or replace view public.multi_crop_command_dashboard_v23
with (security_invoker = true)
as
select
  c.id as company_id,
  count(distinct cc.id) filter (where cc.active) as available_crops,
  count(distinct cs.id) filter (where cs.status='active') as active_seasons,
  count(distinct lcc.id) filter (where lcc.status='active') as active_crop_cycles,
  count(distinct lcc.crop_id) filter (where lcc.status='active') as active_crop_types,
  coalesce(sum(lcc.area_ha) filter (where lcc.status='active'),0) as active_area_ha
from public.companies c
left join public.crop_catalog cc on cc.company_id=c.id
left join public.crop_seasons cs on cs.company_id=c.id
left join public.lot_crop_cycles lcc on lcc.company_id=c.id
group by c.id;

grant select on public.multi_crop_command_dashboard_v23 to authenticated;

commit;

select
  'Centro de Comando Multicultivo 23.0 instalado' as result,
  to_regclass('public.crop_catalog') is not null as crop_catalog_ready,
  to_regclass('public.crop_seasons') is not null as seasons_ready,
  to_regclass('public.lot_crop_cycles') is not null as crop_cycles_ready;
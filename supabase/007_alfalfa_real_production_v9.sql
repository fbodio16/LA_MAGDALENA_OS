-- LA MAGDALENA OS 9.0.0 · Producción Real de Alfalfa
-- Migración segura e idempotente. No elimina registros existentes.

begin;

alter table if exists public.alfalfa_cuts
  add column if not exists campaign text,
  add column if not exists cut_number integer,
  add column if not exists hectares numeric,
  add column if not exists average_bale_kg numeric,
  add column if not exists humidity_pct numeric,
  add column if not exists protein_pct numeric,
  add column if not exists adf_pct numeric,
  add column if not exists ndf_pct numeric,
  add column if not exists operator_name text,
  add column if not exists equipment_name text,
  add column if not exists contractor_name text,
  add column if not exists batch_code text,
  add column if not exists storage_location text,
  add column if not exists operational_status text default 'En stock',
  add column if not exists total_cost numeric default 0,
  add column if not exists total_revenue numeric default 0,
  add column if not exists updated_at timestamptz default now();

alter table if exists public.alfalfa_cuts
  drop constraint if exists alfalfa_cuts_nonnegative_v9;
alter table if exists public.alfalfa_cuts
  add constraint alfalfa_cuts_nonnegative_v9 check (
    coalesce(bales,0) >= 0
    and coalesce(total_kg,0) >= 0
    and coalesce(hectares,0) >= 0
    and coalesce(average_bale_kg,0) >= 0
    and coalesce(total_cost,0) >= 0
    and coalesce(total_revenue,0) >= 0
  ) not valid;

create index if not exists alfalfa_cuts_company_date_v9_idx
  on public.alfalfa_cuts(company_id, cut_date desc);
create index if not exists alfalfa_cuts_lot_campaign_v9_idx
  on public.alfalfa_cuts(lot_id, campaign, cut_number);
create unique index if not exists alfalfa_cuts_batch_code_v9_uidx
  on public.alfalfa_cuts(company_id, batch_code)
  where batch_code is not null and btrim(batch_code) <> '';

create table if not exists public.alfalfa_stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  cut_id uuid not null references public.alfalfa_cuts(id) on delete cascade,
  movement_date date not null default current_date,
  movement_type text not null check (movement_type in ('Ingreso','Salida')),
  reason text,
  quantity integer not null check (quantity > 0),
  customer_id uuid null,
  customer_name text,
  unit_price numeric default 0 check (unit_price >= 0),
  ton_price numeric default 0 check (ton_price >= 0),
  payment_status text default 'Pendiente',
  due_date date,
  storage_location text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists alfalfa_stock_movements_company_date_idx
  on public.alfalfa_stock_movements(company_id, movement_date desc);
create index if not exists alfalfa_stock_movements_cut_idx
  on public.alfalfa_stock_movements(cut_id);

create or replace view public.alfalfa_production_summary_v9 as
select
  c.company_id,
  c.lot_id,
  coalesce(c.campaign, extract(year from c.cut_date)::text) as campaign,
  count(*) as cuts_count,
  coalesce(sum(c.bales),0) as rolls_produced,
  coalesce(sum(c.total_kg),0) as total_kg,
  coalesce(sum(c.hectares),0) as hectares_recorded,
  coalesce(sum(c.total_cost),0) as total_cost,
  coalesce(sum(c.total_revenue),0) as total_revenue,
  case when coalesce(sum(c.bales),0) > 0 then sum(c.total_cost) / sum(c.bales) else 0 end as cost_per_roll,
  case when coalesce(sum(c.total_kg),0) > 0 then sum(c.total_cost) / (sum(c.total_kg)/1000.0) else 0 end as cost_per_ton,
  case when coalesce(sum(c.hectares),0) > 0 then sum(c.bales) / sum(c.hectares) else 0 end as rolls_per_hectare
from public.alfalfa_cuts c
group by c.company_id, c.lot_id, coalesce(c.campaign, extract(year from c.cut_date)::text);

commit;

select
  to_regclass('public.alfalfa_cuts') as production_table,
  to_regclass('public.alfalfa_stock_movements') as stock_movements_table,
  to_regclass('public.alfalfa_production_summary_v9') as summary_view,
  count(*) as existing_cuts,
  count(*) filter (where lot_id is null) as cuts_without_lot,
  count(*) filter (where coalesce(bales,0) < 0 or coalesce(total_kg,0) < 0) as invalid_quantities
from public.alfalfa_cuts;

-- LA MAGDALENA OS 10.0.0 · Gestión completa de cortes
-- Migración segura e idempotente. Los datos operativos adicionales se guardan
-- en la metadata LMOS_CUT de alfalfa_cuts.notes para mantener compatibilidad.

begin;

create index if not exists alfalfa_cuts_company_lot_date_v10_idx
  on public.alfalfa_cuts (company_id, lot_id, cut_date desc);

create index if not exists alfalfa_cuts_company_date_v10_idx
  on public.alfalfa_cuts (company_id, cut_date desc);

create or replace view public.alfalfa_cut_efficiency_v10 as
select
  company_id,
  lot_id,
  date_trunc('year', cut_date::timestamp)::date as campaign_year,
  count(*) as registered_cuts,
  coalesce(sum(bales),0) as total_bales,
  coalesce(sum(total_kg),0) as total_kg,
  case when coalesce(sum(bales),0) > 0 then coalesce(sum(total_kg),0) / sum(bales) else 0 end as average_bale_weight_kg
from public.alfalfa_cuts
group by company_id, lot_id, date_trunc('year', cut_date::timestamp)::date;

commit;

select
  to_regclass('public.alfalfa_cuts') as production_table,
  to_regclass('public.alfalfa_cut_efficiency_v10') as efficiency_view,
  count(*) as existing_cuts
from public.alfalfa_cuts;

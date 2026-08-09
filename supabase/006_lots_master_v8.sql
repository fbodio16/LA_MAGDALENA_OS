-- LA MAGDALENA OS 8.0.0 · Gestión Integral de Lotes
-- Migración segura e idempotente. No elimina datos.

begin;

alter table if exists public.lots
  add column if not exists campaign text,
  add column if not exists management_zone text,
  add column if not exists soil_type text,
  add column if not exists irrigation_type text,
  add column if not exists manager_name text;

create index if not exists lots_company_campaign_idx
  on public.lots(company_id, campaign);

create index if not exists lots_company_crop_status_idx
  on public.lots(company_id, crop, status);

commit;

select
  to_regclass('public.lots') as lots_table,
  count(*) as existing_lots,
  count(*) filter (where hectares <= 0) as invalid_surface,
  count(*) filter (where name is null or btrim(name) = '') as unnamed_lots
from public.lots;

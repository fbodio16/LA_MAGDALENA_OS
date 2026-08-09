begin;

create or replace view public.system_health_v17_2 as
select
  c.id as company_id,
  c.name as company_name,
  to_regclass('public.lots') is not null as lots_ready,
  to_regclass('public.alfalfa_cuts') is not null as production_ready,
  to_regclass('public.sales_orders') is not null as sales_ready,
  to_regclass('public.transport_trips') is not null as transport_ready,
  to_regclass('public.audit_logs') is not null as audit_ready,
  to_regclass('public.operational_validation_runs') is not null as validation_ready,
  (select count(*) from public.lots l where l.company_id=c.id) as lots_count,
  (select count(*) from public.alfalfa_cuts ac where ac.company_id=c.id) as cuts_count,
  now() as checked_at
from public.companies c;

commit;

select to_regclass('public.system_health_v17_2') as health_view,
       count(*) as companies_checked
from public.system_health_v17_2;

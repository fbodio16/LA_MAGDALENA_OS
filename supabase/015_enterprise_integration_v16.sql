-- LA MAGDALENA OS 16.0.0 · Integración Operativa Enterprise
-- Diagnóstico consolidado de preparación por empresa. Idempotente y no destructivo.

begin;

create or replace view public.enterprise_readiness_v16 as
select
  c.id as company_id,
  c.name as company_name,
  (select count(*) from public.lots l where l.company_id=c.id) as lots_count,
  (select count(*) from public.campaigns ca where ca.company_id=c.id) as campaigns_count,
  (select count(*) from public.alfalfa_cuts ac where ac.company_id=c.id) as cuts_count,
  (select coalesce(sum(ac.bales),0) from public.alfalfa_cuts ac where ac.company_id=c.id) as rolls_produced,
  (select count(*) from public.clients cl where cl.company_id=c.id) as clients_count,
  (select count(*) from public.sales_orders so where so.company_id=c.id and so.status<>'Anulada') as sales_count,
  (select coalesce(sum(so.total_amount-so.paid_amount),0) from public.sales_orders so where so.company_id=c.id and so.status<>'Anulada') as receivables,
  (select count(*) from public.transport_trips tt where tt.company_id=c.id) as trips_count,
  (select count(*) from public.equipment e where e.company_id=c.id) as equipment_count,
  (select count(*) from public.personnel p where p.company_id=c.id) as personnel_count,
  (select count(*) from public.work_tasks wt where wt.company_id=c.id and wt.status not in ('Completada','Cancelada')) as open_tasks,
  (select count(*) from public.inventory_items ii where ii.company_id=c.id and ii.current_stock<=ii.minimum_stock) as low_stock_items,
  round((
    (case when exists(select 1 from public.lots l where l.company_id=c.id) then 1 else 0 end)+
    (case when exists(select 1 from public.campaigns ca where ca.company_id=c.id) then 1 else 0 end)+
    (case when exists(select 1 from public.clients cl where cl.company_id=c.id) then 1 else 0 end)+
    (case when exists(select 1 from public.equipment e where e.company_id=c.id) then 1 else 0 end)+
    (case when exists(select 1 from public.personnel p where p.company_id=c.id) then 1 else 0 end)
  )::numeric/5*100,0) as master_data_readiness_pct
from public.companies c;

commit;

select
  to_regclass('public.enterprise_readiness_v16') as readiness_view,
  count(*) as companies_evaluated
from public.enterprise_readiness_v16;

begin;

create table if not exists public.decision_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  cut_alert_days integer not null default 32 check (cut_alert_days > 0),
  irrigation_alert_days integer not null default 7 check (irrigation_alert_days > 0),
  ndvi_alert_threshold numeric(4,3) not null default 0.55 check (ndvi_alert_threshold between 0 and 1),
  collection_alert_days integer not null default 7 check (collection_alert_days >= 0),
  target_margin_percent numeric(7,2) not null default 20,
  updated_at timestamptz not null default now()
);

alter table public.decision_settings enable row level security;

drop policy if exists decision_settings_company_access on public.decision_settings;
create policy decision_settings_company_access on public.decision_settings
for all using (
  exists (
    select 1 from public.company_members cm
    where cm.company_id = decision_settings.company_id
      and cm.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.company_members cm
    where cm.company_id = decision_settings.company_id
      and cm.user_id = auth.uid()
  )
);

create or replace view public.decision_center_summary_v14 as
select
  c.id as company_id,
  count(distinct l.id) as lots,
  count(distinct ac.id) as cuts,
  coalesce(sum(ac.bales),0) as produced_bales,
  coalesce(sum(ac.total_kg),0) as produced_kg,
  coalesce(sum(so.total_amount),0) as sales_amount,
  coalesce(sum(so.paid_amount),0) as collected_amount
from public.companies c
left join public.lots l on l.company_id=c.id
left join public.alfalfa_cuts ac on ac.company_id=c.id
left join public.sales_orders so on so.company_id=c.id and so.status <> 'Anulada'
group by c.id;

commit;

select
  to_regclass('public.decision_settings') as settings_table,
  to_regclass('public.decision_center_summary_v14') as summary_view,
  count(*) as configured_companies
from public.decision_settings;

-- LA MAGDALENA OS 22.0.0
-- Asistente Agronómico Inteligente
-- Ejecutar después de 024_operation_real_v21.sql

begin;

create table if not exists public.agronomic_intelligence_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lot_id uuid references public.lots(id) on delete cascade,
  snapshot_date date not null default current_date,
  score numeric(6,2) not null default 0 check (score between 0 and 1000),
  hydric_score numeric(6,2) check (hydric_score between 0 and 100),
  vigor_score numeric(6,2) check (vigor_score between 0 and 100),
  management_score numeric(6,2) check (management_score between 0 and 100),
  data_quality_score numeric(6,2) check (data_quality_score between 0 and 100),
  risk_score numeric(6,2) check (risk_score between 0 and 100),
  alerts jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  confidence numeric(5,2) check (confidence between 0 and 100),
  model_version text not null default 'rules-v1',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, lot_id, snapshot_date)
);

create index if not exists idx_agronomic_snapshots_company_date
  on public.agronomic_intelligence_snapshots(company_id, snapshot_date desc);

alter table public.agronomic_intelligence_snapshots enable row level security;

drop policy if exists agronomic_snapshots_select on public.agronomic_intelligence_snapshots;
drop policy if exists agronomic_snapshots_insert on public.agronomic_intelligence_snapshots;
drop policy if exists agronomic_snapshots_update on public.agronomic_intelligence_snapshots;
drop policy if exists agronomic_snapshots_delete on public.agronomic_intelligence_snapshots;

create policy agronomic_snapshots_select
on public.agronomic_intelligence_snapshots
for select to authenticated
using (public.is_company_member(company_id));

create policy agronomic_snapshots_insert
on public.agronomic_intelligence_snapshots
for insert to authenticated
with check (public.can_operate_company(company_id));

create policy agronomic_snapshots_update
on public.agronomic_intelligence_snapshots
for update to authenticated
using (public.can_operate_company(company_id))
with check (public.can_operate_company(company_id));

create policy agronomic_snapshots_delete
on public.agronomic_intelligence_snapshots
for delete to authenticated
using (public.is_company_admin(company_id));

create or replace view public.agronomic_intelligence_dashboard_v22
with (security_invoker = true)
as
select
  c.id as company_id,
  current_date as dashboard_date,
  count(distinct l.id) as total_lots,
  count(distinct r.id) filter (
    where r.status='activa' and r.priority in ('alta','critica')
  ) as priority_recommendations,
  count(distinct t.id) filter (
    where t.status in ('pendiente','en_curso') and t.priority in ('alta','critica')
  ) as priority_tasks,
  count(distinct o.id) filter (
    where o.status in ('abierta','en_revision') and o.severity in ('alta','critica')
  ) as critical_observations,
  round(avg(s.score),0) as average_agro_score,
  round(avg(s.confidence),0) as average_confidence,
  max(s.snapshot_date) as last_snapshot_date
from public.companies c
left join public.lots l on l.company_id=c.id
left join public.field_recommendations r on r.company_id=c.id
left join public.daily_field_tasks t on t.company_id=c.id
left join public.field_observations o on o.company_id=c.id
left join public.agronomic_intelligence_snapshots s
  on s.company_id=c.id and s.snapshot_date=current_date
group by c.id;

grant select on public.agronomic_intelligence_dashboard_v22 to authenticated;

commit;

select
  'Asistente Agronómico 22.0 instalado' as result,
  to_regclass('public.agronomic_intelligence_snapshots') is not null as snapshots_ready,
  to_regclass('public.agronomic_intelligence_dashboard_v22') is not null as dashboard_ready;
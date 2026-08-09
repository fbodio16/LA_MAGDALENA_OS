begin;
create table if not exists public.integration_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  rule_key text not null,
  name text not null,
  enabled boolean not null default true,
  threshold numeric default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, rule_key)
);
create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  event_type text not null,
  source_table text,
  source_id uuid,
  status text not null default 'Procesado',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists integration_events_company_created_idx on public.integration_events(company_id,created_at desc);
alter table public.integration_rules enable row level security;
alter table public.integration_events enable row level security;
drop policy if exists integration_rules_company_access on public.integration_rules;
create policy integration_rules_company_access on public.integration_rules for all using (exists(select 1 from public.company_members cm where cm.company_id=integration_rules.company_id and cm.user_id=auth.uid())) with check (exists(select 1 from public.company_members cm where cm.company_id=integration_rules.company_id and cm.user_id=auth.uid()));
drop policy if exists integration_events_company_access on public.integration_events;
create policy integration_events_company_access on public.integration_events for all using (exists(select 1 from public.company_members cm where cm.company_id=integration_events.company_id and cm.user_id=auth.uid())) with check (exists(select 1 from public.company_members cm where cm.company_id=integration_events.company_id and cm.user_id=auth.uid()));
insert into public.integration_rules(company_id,rule_key,name,threshold)
select id,'collection_overdue','Alertar cobranzas vencidas',0 from public.companies
on conflict(company_id,rule_key) do nothing;
insert into public.integration_rules(company_id,rule_key,name,threshold)
select id,'inventory_minimum','Alertar inventario mínimo',0 from public.companies
on conflict(company_id,rule_key) do nothing;
commit;
select to_regclass('public.integration_rules') as rules_table,
       to_regclass('public.integration_events') as events_table,
       count(*) as configured_rules
from public.integration_rules;

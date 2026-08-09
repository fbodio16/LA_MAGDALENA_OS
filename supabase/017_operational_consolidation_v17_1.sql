begin;
create table if not exists public.operational_validation_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  readiness_pct numeric not null default 0 check (readiness_pct between 0 and 100),
  status text not null default 'Pendiente',
  checks_json jsonb not null default '[]'::jsonb,
  validated_by uuid null,
  created_at timestamptz not null default now()
);
create index if not exists operational_validation_company_created_idx on public.operational_validation_runs(company_id,created_at desc);
alter table public.operational_validation_runs enable row level security;
drop policy if exists operational_validation_company_access on public.operational_validation_runs;
create policy operational_validation_company_access on public.operational_validation_runs for all using (
  exists(select 1 from public.company_members cm where cm.company_id=operational_validation_runs.company_id and cm.user_id=auth.uid())
) with check (
  exists(select 1 from public.company_members cm where cm.company_id=operational_validation_runs.company_id and cm.user_id=auth.uid())
);
commit;
select to_regclass('public.operational_validation_runs') as validation_table,count(*) as existing_validations from public.operational_validation_runs;

-- LA MAGDALENA OS 17.0.0 · Agricultura de Precisión
-- Observaciones de campo y análisis de laboratorio vinculados a lotes.

begin;

create table if not exists public.precision_observations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  observation_date date not null default current_date,
  water_stress text,
  growth_stage text,
  canopy_cover numeric default 0 check (canopy_cover between 0 and 100),
  notes text,
  latitude numeric,
  longitude numeric,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lab_analyses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lot_id uuid references public.lots(id) on delete set null,
  sample_date date not null default current_date,
  analysis_type text not null,
  laboratory text,
  main_result text,
  results_json jsonb not null default '{}'::jsonb,
  attachment_path text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists precision_observations_company_lot_date_idx on public.precision_observations(company_id,lot_id,observation_date desc);
create index if not exists lab_analyses_company_lot_date_idx on public.lab_analyses(company_id,lot_id,sample_date desc);

alter table public.precision_observations enable row level security;
alter table public.lab_analyses enable row level security;

do $$
declare t text;
begin
  foreach t in array array['precision_observations','lab_analyses'] loop
    execute format('drop policy if exists company_access on public.%I',t);
    execute format($p$create policy company_access on public.%I for all using (
      exists(select 1 from public.company_members cm where cm.company_id=%I.company_id and cm.user_id=auth.uid())
      or exists(select 1 from public.companies c where c.id=%I.company_id and c.created_by=auth.uid())
    ) with check (
      exists(select 1 from public.company_members cm where cm.company_id=%I.company_id and cm.user_id=auth.uid())
      or exists(select 1 from public.companies c where c.id=%I.company_id and c.created_by=auth.uid())
    )$p$,t,t,t,t,t);
  end loop;
end $$;

commit;

select
  to_regclass('public.precision_observations') as observations_table,
  to_regclass('public.lab_analyses') as laboratory_table,
  (select count(*) from public.precision_observations) as existing_observations,
  (select count(*) from public.lab_analyses) as existing_lab_analyses;

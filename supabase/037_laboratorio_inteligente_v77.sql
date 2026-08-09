-- LA MAGDALENA OS v77.0.0 · Laboratorio Inteligente
create table if not exists public.lot_nutrition_goals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  target_t_ha numeric(12,3) not null check (target_t_ha >= 0),
  crop text,
  target_basis text not null default 't/ha',
  notes text,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, lot_id)
);
create index if not exists lot_nutrition_goals_company_idx on public.lot_nutrition_goals(company_id);
alter table public.lot_nutrition_goals enable row level security;
drop policy if exists company_access on public.lot_nutrition_goals;
create policy company_access on public.lot_nutrition_goals for all using (
  exists(select 1 from public.company_members cm where cm.company_id=lot_nutrition_goals.company_id and cm.user_id=auth.uid())
  or exists(select 1 from public.companies c where c.id=lot_nutrition_goals.company_id and c.created_by=auth.uid())
) with check (
  exists(select 1 from public.company_members cm where cm.company_id=lot_nutrition_goals.company_id and cm.user_id=auth.uid())
  or exists(select 1 from public.companies c where c.id=lot_nutrition_goals.company_id and c.created_by=auth.uid())
);

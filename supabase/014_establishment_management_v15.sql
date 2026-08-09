begin;
create extension if not exists pgcrypto;

create table if not exists public.work_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lot_id uuid references public.lots(id) on delete set null,
  personnel_id uuid references public.personnel(id) on delete set null,
  title text not null,
  category text default 'General',
  due_date date not null default current_date,
  priority text default 'Media',
  status text default 'Pendiente',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  category text default 'Otro',
  unit text default 'unidad',
  current_stock numeric default 0 check (current_stock >= 0),
  minimum_stock numeric default 0 check (minimum_stock >= 0),
  unit_cost numeric default 0 check (unit_cost >= 0),
  location text,
  supplier text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists work_tasks_company_due_idx on public.work_tasks(company_id,due_date,status);
create index if not exists inventory_items_company_name_idx on public.inventory_items(company_id,name);

alter table public.work_tasks enable row level security;
alter table public.inventory_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['work_tasks','inventory_items'] loop
    execute format('drop policy if exists %I on public.%I',t||'_select',t);
    execute format('drop policy if exists %I on public.%I',t||'_insert',t);
    execute format('drop policy if exists %I on public.%I',t||'_update',t);
    execute format('drop policy if exists %I on public.%I',t||'_delete',t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_company_member(company_id))',t||'_select',t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_operate_company(company_id))',t||'_insert',t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_operate_company(company_id)) with check (public.can_operate_company(company_id))',t||'_update',t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_company_admin(company_id))',t||'_delete',t);
  end loop;
end $$;
commit;

select to_regclass('public.work_tasks') as tasks_table,
       to_regclass('public.inventory_items') as inventory_table,
       (select count(*) from public.work_tasks) as existing_tasks,
       (select count(*) from public.inventory_items) as existing_inventory_items;

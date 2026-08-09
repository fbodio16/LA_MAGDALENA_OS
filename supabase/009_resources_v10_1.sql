begin;
create extension if not exists pgcrypto;

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, category text default 'Otro', brand text, model text, serial_number text,
  current_hours numeric default 0 check (current_hours >= 0), next_service_hours numeric default 0 check (next_service_hours >= 0),
  status text default 'Activo', notes text, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.fuel_entries (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  equipment_id uuid references public.equipment(id) on delete set null, entry_date date not null default current_date,
  liters numeric not null check (liters > 0), price_per_liter numeric default 0 check (price_per_liter >= 0), total_cost numeric default 0 check (total_cost >= 0),
  hour_meter numeric default 0 check (hour_meter >= 0), supplier text, notes text, created_at timestamptz default now()
);
create table if not exists public.maintenance_entries (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  equipment_id uuid references public.equipment(id) on delete set null, service_date date not null default current_date,
  service_type text default 'Preventivo', description text not null, cost numeric default 0 check (cost >= 0), hour_meter numeric default 0 check (hour_meter >= 0),
  next_service_date date, next_service_hours numeric default 0 check (next_service_hours >= 0), provider text, created_at timestamptz default now()
);
create table if not exists public.personnel (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null, role text default 'Operario', phone text, hourly_rate numeric default 0 check (hourly_rate >= 0), status text default 'Activo', notes text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.labor_entries (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  personnel_id uuid references public.personnel(id) on delete set null, lot_id uuid references public.lots(id) on delete set null,
  work_date date not null default current_date, activity text not null, hours numeric not null check (hours > 0), hourly_rate numeric default 0 check (hourly_rate >= 0), total_cost numeric default 0 check (total_cost >= 0), notes text, created_at timestamptz default now()
);

create index if not exists equipment_company_idx on public.equipment(company_id);
create index if not exists fuel_company_date_idx on public.fuel_entries(company_id,entry_date desc);
create index if not exists maintenance_company_date_idx on public.maintenance_entries(company_id,service_date desc);
create index if not exists personnel_company_idx on public.personnel(company_id);
create index if not exists labor_company_date_idx on public.labor_entries(company_id,work_date desc);

alter table public.equipment enable row level security;
alter table public.fuel_entries enable row level security;
alter table public.maintenance_entries enable row level security;
alter table public.personnel enable row level security;
alter table public.labor_entries enable row level security;

do $$
declare t text;
begin
  foreach t in array array['equipment','fuel_entries','maintenance_entries','personnel','labor_entries'] loop
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

select to_regclass('public.equipment') as equipment_table,
       to_regclass('public.fuel_entries') as fuel_table,
       to_regclass('public.maintenance_entries') as maintenance_table,
       to_regclass('public.personnel') as personnel_table,
       to_regclass('public.labor_entries') as labor_table;

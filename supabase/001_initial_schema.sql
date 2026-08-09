-- LA MAGDALENA OS — instalación limpia y consistente
-- ADVERTENCIA: elimina únicamente las tablas/funciones de LA MAGDALENA OS.
-- No elimina usuarios de Authentication.

begin;

create extension if not exists pgcrypto;

-- Eliminar objetos previos que provocaban conflictos entre versiones.
drop function if exists public.is_company_admin(uuid) cascade;
drop function if exists public.is_company_member(uuid) cascade;
drop function if exists public.sync_lot_area() cascade;

drop table if exists public.company_modules cascade;
drop table if exists public.precision_orders cascade;
drop table if exists public.precision_analyses cascade;
drop table if exists public.lot_geometries cascade;
drop table if exists public.financial_movements cascade;
drop table if exists public.transport_trips cascade;
drop table if exists public.alfalfa_cuts cascade;
drop table if exists public.irrigation_events cascade;
drop table if exists public.clients cascade;
drop table if exists public.lots cascade;
drop table if exists public.farm_irrigation_events cascade;
drop table if exists public.farm_lots cascade;
drop table if exists public.economic_movements cascade;
drop table if exists public.inventory_items cascade;
drop table if exists public.company_members cascade;
drop table if exists public.companies cascade;

drop type if exists public.company_role cascade;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  location text,
  latitude numeric,
  longitude numeric,
  owner_user_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  plan text not null default 'Business',
  status text not null default 'Activa',
  monthly_price numeric not null default 0,
  onboarding_status text not null default 'Activo',
  subscription_expires_at date,
  created_at timestamptz not null default now()
);

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'Operario' check (role in ('Administrador','Superadministrador','Operario','Cliente','Asesor')),
  created_at timestamptz not null default now(),
  unique(company_id,user_id)
);

create table public.company_modules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  module_key text not null,
  enabled boolean not null default true,
  unique(company_id,module_key)
);

create table public.lots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  crop text,
  hectares numeric not null default 0,
  area_ha numeric not null default 0,
  variety text,
  status text not null default 'Activo',
  sowing_date date,
  last_cut date,
  last_irrigation date,
  ndvi numeric,
  soil_moisture numeric,
  next_task text,
  notes text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(company_id,name)
);

create or replace function public.sync_lot_area()
returns trigger language plpgsql as $$
begin
  if new.area_ha is distinct from old.area_ha and new.area_ha is not null then
    new.hectares := new.area_ha;
  elsif new.hectares is distinct from old.hectares and new.hectares is not null then
    new.area_ha := new.hectares;
  elsif tg_op = 'INSERT' then
    new.hectares := coalesce(nullif(new.hectares,0), new.area_ha, 0);
    new.area_ha := coalesce(nullif(new.area_ha,0), new.hectares, 0);
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger lots_sync_area before insert or update on public.lots
for each row execute function public.sync_lot_area();

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  phone text,
  location text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.irrigation_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lot_id uuid references public.lots(id) on delete cascade,
  event_date date not null default current_date,
  irrigation_date date,
  event_type text not null default 'Riego',
  millimeters numeric,
  hours numeric,
  notes text,
  created_at timestamptz not null default now()
);

create table public.alfalfa_cuts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lot_id uuid references public.lots(id) on delete set null,
  cut_date date not null default current_date,
  bales integer not null default 0,
  rolls integer not null default 0,
  total_kg numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table public.transport_trips (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  trip_date date not null default current_date,
  client text,
  destination text,
  kilometers numeric not null default 0,
  tons numeric not null default 0,
  income numeric not null default 0,
  cost numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table public.financial_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  movement_date date not null default current_date,
  concept text not null,
  income numeric not null default 0,
  cost numeric not null default 0,
  lot_id uuid references public.lots(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table public.lot_geometries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lot_id uuid not null unique references public.lots(id) on delete cascade,
  geojson jsonb not null,
  center_lat numeric,
  center_lng numeric,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.precision_analyses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lot_id uuid references public.lots(id) on delete cascade,
  flight_date date not null default current_date,
  hectares numeric not null default 0,
  ndvi_avg numeric,
  ndvi_min numeric,
  ndvi_max numeric,
  ndre_avg numeric,
  ndre_min numeric,
  ndre_max numeric,
  low_vigor_pct numeric,
  zones_count integer,
  source_file_path text,
  map_file_path text,
  zones_json jsonb,
  observations text,
  recommendation text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.precision_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lot_id uuid references public.lots(id) on delete set null,
  lot_name text,
  order_date date not null default current_date,
  application_type text,
  hectares numeric not null default 0,
  product text,
  dose numeric,
  dose_unit text,
  estimated_product numeric,
  estimated_batteries integer,
  estimated_minutes integer,
  status text not null default 'Planificada',
  notes text,
  created_at timestamptz not null default now()
);

create or replace function public.is_company_member(target_company uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.company_members cm
    where cm.company_id=target_company and cm.user_id=auth.uid()
  );
$$;

create or replace function public.is_company_admin(target_company uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.company_members cm
    where cm.company_id=target_company and cm.user_id=auth.uid()
      and cm.role in ('Administrador','Superadministrador')
  );
$$;

-- RLS
alter table public.companies enable row level security;
alter table public.company_members enable row level security;

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select using (
  owner_user_id=auth.uid() or created_by=auth.uid() or public.is_company_member(id)
);
create policy companies_insert on public.companies for insert with check (
  created_by=auth.uid() or owner_user_id=auth.uid()
);
create policy companies_update on public.companies for update using (
  owner_user_id=auth.uid() or public.is_company_admin(id)
) with check (owner_user_id=auth.uid() or public.is_company_admin(id));

create policy members_select on public.company_members for select using (
  user_id=auth.uid() or public.is_company_member(company_id)
);
create policy members_manage on public.company_members for all using (
  public.is_company_admin(company_id)
) with check (public.is_company_admin(company_id));

-- Política estándar por empresa.
do $$
declare t text;
begin
  foreach t in array array[
    'company_modules','lots','clients','irrigation_events','alfalfa_cuts',
    'transport_trips','financial_movements','lot_geometries',
    'precision_analyses','precision_orders'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy %I on public.%I for select using (public.is_company_member(company_id))',t||'_select',t);
    execute format('create policy %I on public.%I for insert with check (public.is_company_member(company_id))',t||'_insert',t);
    execute format('create policy %I on public.%I for update using (public.is_company_member(company_id)) with check (public.is_company_member(company_id))',t||'_update',t);
    execute format('create policy %I on public.%I for delete using (public.is_company_admin(company_id))',t||'_delete',t);
  end loop;
end $$;

-- Bucket para archivos NDVI.
insert into storage.buckets (id,name,public)
values ('precision-files','precision-files',false)
on conflict (id) do update set public=false;

drop policy if exists precision_files_select on storage.objects;
drop policy if exists precision_files_insert on storage.objects;
drop policy if exists precision_files_update on storage.objects;
drop policy if exists precision_files_delete on storage.objects;
create policy precision_files_select on storage.objects for select to authenticated
using (bucket_id='precision-files');
create policy precision_files_insert on storage.objects for insert to authenticated
with check (bucket_id='precision-files');
create policy precision_files_update on storage.objects for update to authenticated
using (bucket_id='precision-files') with check (bucket_id='precision-files');
create policy precision_files_delete on storage.objects for delete to authenticated
using (bucket_id='precision-files');

-- Empresa y membresía del usuario ya creado en Authentication.
do $$
declare u uuid; c uuid;
begin
  select id into u from auth.users where lower(email)=lower('francolucianobodio@gmail.com') limit 1;
  if u is null then
    raise exception 'Primero creá o confirmá el usuario francolucianobodio@gmail.com en Authentication > Users';
  end if;

  insert into public.companies(name,legal_name,location,latitude,longitude,owner_user_id,created_by,plan,status)
  values('La Magdalena','La Magdalena','Santiago Temple, Córdoba',-31.332065,-63.311986,u,u,'Business','Activa')
  returning id into c;

  insert into public.company_members(company_id,user_id,email,full_name,role)
  values(c,u,'francolucianobodio@gmail.com','Franco Luciano Bodio','Administrador');

  insert into public.company_modules(company_id,module_key,enabled)
  select c,x,true from unnest(array['dashboard','production','map','irrigation','flights','orders','lots','clients','transport','admin','ai','portal']) x;

  insert into public.lots(company_id,name,crop,hectares,area_ha,status,next_task)
  values
    (c,'Lote 1','Alfalfa',11.23,11.23,'Activo','Completar ficha'),
    (c,'Lote 2','Alfalfa',11.84,11.84,'Activo','Completar ficha'),
    (c,'Lote 3','Alfalfa',11.93,11.93,'Activo','Completar ficha'),
    (c,'Lote 4','Alfalfa',12.00,12.00,'Activo','Completar ficha'),
    (c,'Lote 5','Alfalfa',11.05,11.05,'Activo','Completar ficha'),
    (c,'Lote 6','Alfalfa',11.06,11.06,'Activo','Completar ficha'),
    (c,'Lote 7','Alfalfa',11.93,11.93,'Activo','Completar ficha'),
    (c,'Lote 8','Alfalfa',11.06,11.06,'Activo','Completar ficha'),
    (c,'Lote 9','Alfalfa',11.50,11.50,'Activo','Completar ficha'),
    (c,'Lote 10','Alfalfa',11.25,11.25,'Activo','Completar ficha'),
    (c,'Lote 11','Alfalfa',11.30,11.30,'Activo','Completar ficha'),
    (c,'Lote 12','Trigo',11.10,11.10,'Activo','Completar ficha'),
    (c,'Lote 13','Trigo',8.95,8.95,'Activo','Completar ficha');
end $$;

commit;

select
  to_regclass('public.companies') is not null
  and to_regclass('public.company_members') is not null
  and to_regclass('public.lots') is not null
  and to_regclass('public.irrigation_events') is not null
  and exists(select 1 from public.companies where name='La Magdalena') as ok,
  'LA MAGDALENA OS: base definitiva preparada' as mensaje;

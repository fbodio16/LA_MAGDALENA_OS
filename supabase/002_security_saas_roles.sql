-- LA MAGDALENA OS 3.1.0 — Seguridad SaaS y roles
-- Migración no destructiva: no elimina datos existentes.

begin;

-- 1) Roles admitidos
alter table public.company_members
  drop constraint if exists company_members_role_check;

alter table public.company_members
  add constraint company_members_role_check
  check (role in ('Superadministrador','Administrador','Encargado','Operario','Asesor','Cliente'));

-- 2) Funciones de autorización centralizadas
create or replace function public.company_role(target_company uuid)
returns text
language sql
stable
security definer
set search_path=public
as $$
  select cm.role
  from public.company_members cm
  where cm.company_id=target_company
    and cm.user_id=auth.uid()
  limit 1;
$$;

create or replace function public.is_company_member(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.company_members cm
    where cm.company_id=target_company and cm.user_id=auth.uid()
  );
$$;

create or replace function public.is_company_admin(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(public.company_role(target_company) in ('Administrador','Superadministrador'),false);
$$;

create or replace function public.can_operate_company(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(public.company_role(target_company) in ('Superadministrador','Administrador','Encargado','Operario'),false);
$$;

create or replace function public.can_manage_finance(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(public.company_role(target_company) in ('Superadministrador','Administrador','Encargado'),false);
$$;

-- 3) Companies y miembros
alter table public.companies enable row level security;
alter table public.company_members enable row level security;

drop policy if exists companies_select on public.companies;
drop policy if exists companies_insert on public.companies;
drop policy if exists companies_update on public.companies;
drop policy if exists companies_delete on public.companies;

create policy companies_select on public.companies
for select to authenticated
using (owner_user_id=auth.uid() or created_by=auth.uid() or public.is_company_member(id));

create policy companies_insert on public.companies
for insert to authenticated
with check (created_by=auth.uid() or owner_user_id=auth.uid());

create policy companies_update on public.companies
for update to authenticated
using (owner_user_id=auth.uid() or public.is_company_admin(id))
with check (owner_user_id=auth.uid() or public.is_company_admin(id));

create policy companies_delete on public.companies
for delete to authenticated
using (owner_user_id=auth.uid() or public.company_role(id)='Superadministrador');

drop policy if exists members_select on public.company_members;
drop policy if exists members_manage on public.company_members;
drop policy if exists members_insert on public.company_members;
drop policy if exists members_update on public.company_members;
drop policy if exists members_delete on public.company_members;

create policy members_select on public.company_members
for select to authenticated
using (user_id=auth.uid() or public.is_company_admin(company_id));

create policy members_insert on public.company_members
for insert to authenticated
with check (public.is_company_admin(company_id));

create policy members_update on public.company_members
for update to authenticated
using (public.is_company_admin(company_id))
with check (public.is_company_admin(company_id));

create policy members_delete on public.company_members
for delete to authenticated
using (public.is_company_admin(company_id) and user_id<>auth.uid());

-- 4) Políticas por tipo de información
-- Lectura: todos los miembros. Escritura operativa: Administrador/Encargado/Operario.
do $$
declare t text;
begin
  foreach t in array array[
    'lots','clients','irrigation_events','alfalfa_cuts','transport_trips',
    'lot_geometries','precision_analyses','precision_orders'
  ] loop
    execute format('alter table public.%I enable row level security',t);
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

-- Finanzas: solo Administrador, Superadministrador y Encargado pueden escribir.
alter table public.financial_movements enable row level security;
drop policy if exists financial_movements_select on public.financial_movements;
drop policy if exists financial_movements_insert on public.financial_movements;
drop policy if exists financial_movements_update on public.financial_movements;
drop policy if exists financial_movements_delete on public.financial_movements;
create policy financial_movements_select on public.financial_movements
for select to authenticated using (public.is_company_member(company_id));
create policy financial_movements_insert on public.financial_movements
for insert to authenticated with check (public.can_manage_finance(company_id));
create policy financial_movements_update on public.financial_movements
for update to authenticated using (public.can_manage_finance(company_id))
with check (public.can_manage_finance(company_id));
create policy financial_movements_delete on public.financial_movements
for delete to authenticated using (public.is_company_admin(company_id));

-- Módulos y configuración: solo administración.
alter table public.company_modules enable row level security;
drop policy if exists company_modules_select on public.company_modules;
drop policy if exists company_modules_insert on public.company_modules;
drop policy if exists company_modules_update on public.company_modules;
drop policy if exists company_modules_delete on public.company_modules;
create policy company_modules_select on public.company_modules
for select to authenticated using (public.is_company_member(company_id));
create policy company_modules_insert on public.company_modules
for insert to authenticated with check (public.is_company_admin(company_id));
create policy company_modules_update on public.company_modules
for update to authenticated using (public.is_company_admin(company_id))
with check (public.is_company_admin(company_id));
create policy company_modules_delete on public.company_modules
for delete to authenticated using (public.is_company_admin(company_id));

-- 5) Storage privado separado por empresa.
-- La ruta de cada archivo debe comenzar con company_id/, como ya hace la app.
drop policy if exists precision_files_select on storage.objects;
drop policy if exists precision_files_insert on storage.objects;
drop policy if exists precision_files_update on storage.objects;
drop policy if exists precision_files_delete on storage.objects;

create policy precision_files_select on storage.objects
for select to authenticated
using (
  bucket_id='precision-files'
  and public.is_company_member(((storage.foldername(name))[1])::uuid)
);

create policy precision_files_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='precision-files'
  and public.can_operate_company(((storage.foldername(name))[1])::uuid)
);

create policy precision_files_update on storage.objects
for update to authenticated
using (
  bucket_id='precision-files'
  and public.can_operate_company(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id='precision-files'
  and public.can_operate_company(((storage.foldername(name))[1])::uuid)
);

create policy precision_files_delete on storage.objects
for delete to authenticated
using (
  bucket_id='precision-files'
  and public.is_company_admin(((storage.foldername(name))[1])::uuid)
);

commit;

select 'LA MAGDALENA OS 3.1.0: roles y RLS aplicados' as resultado;

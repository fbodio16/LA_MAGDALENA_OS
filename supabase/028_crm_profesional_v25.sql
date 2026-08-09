-- LA MAGDALENA OS v25.0.0 — CRM Profesional
begin;

alter table public.clients add column if not exists trade_name text;
alter table public.clients add column if not exists cuit text;
alter table public.clients add column if not exists vat_condition text;
alter table public.clients add column if not exists email text;
alter table public.clients add column if not exists whatsapp text;
alter table public.clients add column if not exists address text;
alter table public.clients add column if not exists city text;
alter table public.clients add column if not exists province text;
alter table public.clients add column if not exists country text default 'Argentina';
alter table public.clients add column if not exists payment_terms text;
alter table public.clients add column if not exists credit_limit numeric(14,2) default 0;
alter table public.clients add column if not exists current_balance numeric(14,2) default 0;
alter table public.clients add column if not exists status text default 'Activo';
alter table public.clients add column if not exists latitude double precision;
alter table public.clients add column if not exists longitude double precision;
alter table public.clients add column if not exists updated_at timestamptz default now();

create unique index if not exists clients_company_cuit_uq on public.clients(company_id,cuit)
where cuit is not null and btrim(cuit)<>'';

create table if not exists public.crm_contacts(
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 client_id uuid not null references public.clients(id) on delete cascade, full_name text not null, role text,
 email text, phone text, whatsapp text, is_primary boolean not null default false, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.crm_establishments(
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 client_id uuid not null references public.clients(id) on delete cascade, name text not null, address text, city text,
 province text, total_hectares numeric(12,2) default 0, irrigation_type text, latitude double precision,
 longitude double precision, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.crm_opportunities(
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 client_id uuid not null references public.clients(id) on delete cascade, title text not null, service_type text,
 estimated_amount numeric(14,2) default 0, probability integer default 50 check(probability between 0 and 100),
 stage text not null default 'Nueva', expected_date date, assigned_to uuid, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.crm_activities(
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 client_id uuid not null references public.clients(id) on delete cascade,
 opportunity_id uuid references public.crm_opportunities(id) on delete set null,
 activity_type text not null default 'Nota', subject text not null, detail text, due_at timestamptz,
 completed_at timestamptz, created_by uuid default auth.uid(), created_at timestamptz not null default now()
);


create or replace function public.crm_v25_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;

drop trigger if exists clients_crm_v25_updated_at on public.clients;
create trigger clients_crm_v25_updated_at before update on public.clients
for each row execute function public.crm_v25_set_updated_at();

drop trigger if exists crm_contacts_updated_at on public.crm_contacts;
create trigger crm_contacts_updated_at before update on public.crm_contacts
for each row execute function public.crm_v25_set_updated_at();

drop trigger if exists crm_establishments_updated_at on public.crm_establishments;
create trigger crm_establishments_updated_at before update on public.crm_establishments
for each row execute function public.crm_v25_set_updated_at();

drop trigger if exists crm_opportunities_updated_at on public.crm_opportunities;
create trigger crm_opportunities_updated_at before update on public.crm_opportunities
for each row execute function public.crm_v25_set_updated_at();

create index if not exists crm_contacts_client_idx on public.crm_contacts(client_id);
create index if not exists crm_establishments_client_idx on public.crm_establishments(client_id);
create index if not exists crm_opportunities_client_idx on public.crm_opportunities(client_id);
create index if not exists crm_activities_client_idx on public.crm_activities(client_id);

alter table public.crm_contacts enable row level security;
alter table public.crm_establishments enable row level security;
alter table public.crm_opportunities enable row level security;
alter table public.crm_activities enable row level security;

do $$ declare t text; begin
 foreach t in array array['crm_contacts','crm_establishments','crm_opportunities','crm_activities'] loop
  execute format('drop policy if exists %I on public.%I',t||'_select',t);
  execute format('drop policy if exists %I on public.%I',t||'_insert',t);
  execute format('drop policy if exists %I on public.%I',t||'_update',t);
  execute format('drop policy if exists %I on public.%I',t||'_delete',t);
  execute format('create policy %I on public.%I for select to authenticated using(public.is_company_member(company_id))',t||'_select',t);
  execute format('create policy %I on public.%I for insert to authenticated with check(public.can_operate_company(company_id))',t||'_insert',t);
  execute format('create policy %I on public.%I for update to authenticated using(public.can_operate_company(company_id)) with check(public.can_operate_company(company_id))',t||'_update',t);
  execute format('create policy %I on public.%I for delete to authenticated using(public.is_company_admin(company_id))',t||'_delete',t);
 end loop;
end $$;
commit;
select 'CRM Profesional v25 instalado' resultado;

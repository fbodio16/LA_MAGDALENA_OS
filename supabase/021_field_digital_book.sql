-- LA MAGDALENA OS — Sprint 1
-- 021_field_digital_book.sql
-- Libro Digital del Lote: eventos, documentos, recomendaciones y vista consolidada.
-- Migración no destructiva.

begin;

create extension if not exists pgcrypto;

create table if not exists public.field_timeline_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  campaign_id uuid null,
  event_type text not null check (event_type in (
    'siembra','fertilizacion','riego','lluvia','corte','cosecha',
    'aplicacion','vuelo_mavic','imagen_satelital','analisis_suelo',
    'humedad_gravimetrica','produccion','costo','documento',
    'recomendacion','observacion','otro'
  )),
  event_date timestamptz not null default now(),
  title text not null,
  description text,
  source_table text,
  source_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_field_timeline_company_lot_date
  on public.field_timeline_events(company_id, lot_id, event_date desc);

create index if not exists idx_field_timeline_source
  on public.field_timeline_events(source_table, source_id);

create table if not exists public.field_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  campaign_id uuid null,
  category text not null default 'otro',
  title text not null,
  description text,
  storage_bucket text not null default 'precision-files',
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  captured_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_field_documents_company_lot
  on public.field_documents(company_id, lot_id, created_at desc);

create table if not exists public.field_recommendations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  campaign_id uuid null,
  recommendation_type text not null check (recommendation_type in (
    'riego','corte','fertilizacion','inspeccion','sanidad',
    'vuelo_mavic','muestreo_gravimetrico','comercial','otro'
  )),
  priority text not null default 'media' check (priority in ('baja','media','alta','critica')),
  title text not null,
  recommendation text not null,
  rationale jsonb not null default '[]'::jsonb,
  confidence numeric(5,2) check (confidence between 0 and 100),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  status text not null default 'activa' check (status in (
    'activa','aceptada','descartada','ejecutada','vencida'
  )),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_field_recommendations_active
  on public.field_recommendations(company_id, lot_id, status, priority, created_at desc);

-- RLS
alter table public.field_timeline_events enable row level security;
alter table public.field_documents enable row level security;
alter table public.field_recommendations enable row level security;

drop policy if exists field_timeline_select on public.field_timeline_events;
drop policy if exists field_timeline_insert on public.field_timeline_events;
drop policy if exists field_timeline_update on public.field_timeline_events;
drop policy if exists field_timeline_delete on public.field_timeline_events;

create policy field_timeline_select on public.field_timeline_events
for select to authenticated
using (public.is_company_member(company_id));

create policy field_timeline_insert on public.field_timeline_events
for insert to authenticated
with check (public.can_operate_company(company_id));

create policy field_timeline_update on public.field_timeline_events
for update to authenticated
using (public.can_operate_company(company_id))
with check (public.can_operate_company(company_id));

create policy field_timeline_delete on public.field_timeline_events
for delete to authenticated
using (public.is_company_admin(company_id));

drop policy if exists field_documents_select on public.field_documents;
drop policy if exists field_documents_insert on public.field_documents;
drop policy if exists field_documents_update on public.field_documents;
drop policy if exists field_documents_delete on public.field_documents;

create policy field_documents_select on public.field_documents
for select to authenticated
using (public.is_company_member(company_id));

create policy field_documents_insert on public.field_documents
for insert to authenticated
with check (public.can_operate_company(company_id));

create policy field_documents_update on public.field_documents
for update to authenticated
using (public.can_operate_company(company_id))
with check (public.can_operate_company(company_id));

create policy field_documents_delete on public.field_documents
for delete to authenticated
using (public.is_company_admin(company_id));

drop policy if exists field_recommendations_select on public.field_recommendations;
drop policy if exists field_recommendations_insert on public.field_recommendations;
drop policy if exists field_recommendations_update on public.field_recommendations;
drop policy if exists field_recommendations_delete on public.field_recommendations;

create policy field_recommendations_select on public.field_recommendations
for select to authenticated
using (public.is_company_member(company_id));

create policy field_recommendations_insert on public.field_recommendations
for insert to authenticated
with check (public.can_operate_company(company_id));

create policy field_recommendations_update on public.field_recommendations
for update to authenticated
using (public.can_operate_company(company_id))
with check (public.can_operate_company(company_id));

create policy field_recommendations_delete on public.field_recommendations
for delete to authenticated
using (public.is_company_admin(company_id));

-- Vista base del libro digital. Se apoya en la tabla public.lots existente.
create or replace view public.field_digital_book_summary
with (security_invoker = true)
as
select
  l.id as lot_id,
  l.company_id,
  l.name as lot_name,
  l.area_ha,
  count(distinct e.id) as timeline_events,
  count(distinct d.id) as documents,
  count(distinct r.id) filter (where r.status='activa') as active_recommendations,
  max(e.event_date) as last_event_at,
  max(d.created_at) as last_document_at,
  max(r.created_at) filter (where r.status='activa') as last_recommendation_at
from public.lots l
left join public.field_timeline_events e on e.lot_id=l.id and e.company_id=l.company_id
left join public.field_documents d on d.lot_id=l.id and d.company_id=l.company_id
left join public.field_recommendations r on r.lot_id=l.id and r.company_id=l.company_id
group by l.id, l.company_id, l.name, l.area_ha;

grant select on public.field_digital_book_summary to authenticated;

commit;

select
  'Sprint 1 instalado: Libro Digital del Lote' as result,
  to_regclass('public.field_timeline_events') is not null as timeline_ready,
  to_regclass('public.field_documents') is not null as documents_ready,
  to_regclass('public.field_recommendations') is not null as recommendations_ready;
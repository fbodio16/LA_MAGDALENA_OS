-- LA MAGDALENA OS 20.6.0
-- Carga de Campo y Tareas Diarias
-- Ejecutar después de 022_operational_automation_v20_5.sql

begin;

create table if not exists public.field_observations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  observation_date timestamptz not null default now(),
  observation_type text not null default 'general' check (observation_type in (
    'general','riego','cultivo','plaga','enfermedad','malezas',
    'suelo','corte','maquinaria','seguridad','otro'
  )),
  title text not null,
  description text,
  severity text not null default 'informativa' check (severity in (
    'informativa','baja','media','alta','critica'
  )),
  latitude numeric(10,7),
  longitude numeric(10,7),
  accuracy_m numeric(10,2),
  photo_path text,
  status text not null default 'abierta' check (status in (
    'abierta','en_revision','resuelta','descartada'
  )),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_field_observations_company_lot_date
  on public.field_observations(company_id, lot_id, observation_date desc);

create index if not exists idx_field_observations_status
  on public.field_observations(company_id, status, severity);

create table if not exists public.daily_field_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lot_id uuid references public.lots(id) on delete set null,
  task_date date not null default current_date,
  due_time time,
  task_type text not null default 'general' check (task_type in (
    'general','riego','corte','vuelo','muestreo','recorrida',
    'aplicacion','mantenimiento','transporte','administracion','otro'
  )),
  title text not null,
  description text,
  priority text not null default 'media' check (priority in (
    'baja','media','alta','critica'
  )),
  status text not null default 'pendiente' check (status in (
    'pendiente','en_curso','completada','cancelada'
  )),
  assigned_to uuid,
  source_table text,
  source_id uuid,
  completed_at timestamptz,
  completed_by uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_daily_field_tasks_company_date
  on public.daily_field_tasks(company_id, task_date, status, priority);

create unique index if not exists uq_daily_field_tasks_source
  on public.daily_field_tasks(source_table, source_id)
  where source_table is not null and source_id is not null;

alter table public.field_observations enable row level security;
alter table public.daily_field_tasks enable row level security;

drop policy if exists field_observations_select on public.field_observations;
drop policy if exists field_observations_insert on public.field_observations;
drop policy if exists field_observations_update on public.field_observations;
drop policy if exists field_observations_delete on public.field_observations;

create policy field_observations_select on public.field_observations
for select to authenticated using (public.is_company_member(company_id));

create policy field_observations_insert on public.field_observations
for insert to authenticated with check (public.can_operate_company(company_id));

create policy field_observations_update on public.field_observations
for update to authenticated
using (public.can_operate_company(company_id))
with check (public.can_operate_company(company_id));

create policy field_observations_delete on public.field_observations
for delete to authenticated using (public.is_company_admin(company_id));

drop policy if exists daily_field_tasks_select on public.daily_field_tasks;
drop policy if exists daily_field_tasks_insert on public.daily_field_tasks;
drop policy if exists daily_field_tasks_update on public.daily_field_tasks;
drop policy if exists daily_field_tasks_delete on public.daily_field_tasks;

create policy daily_field_tasks_select on public.daily_field_tasks
for select to authenticated using (public.is_company_member(company_id));

create policy daily_field_tasks_insert on public.daily_field_tasks
for insert to authenticated with check (public.can_operate_company(company_id));

create policy daily_field_tasks_update on public.daily_field_tasks
for update to authenticated
using (public.can_operate_company(company_id))
with check (public.can_operate_company(company_id));

create policy daily_field_tasks_delete on public.daily_field_tasks
for delete to authenticated using (public.is_company_admin(company_id));

-- Cada observación aparece automáticamente en la línea de tiempo del lote.
create or replace function public.upsert_timeline_from_field_observation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.field_timeline_events(
    company_id, lot_id, event_type, event_date, title, description,
    source_table, source_id, metadata
  )
  values(
    new.company_id,
    new.lot_id,
    'observacion',
    new.observation_date,
    new.title,
    new.description,
    'field_observations',
    new.id,
    jsonb_build_object(
      'observation_type', new.observation_type,
      'severity', new.severity,
      'status', new.status,
      'latitude', new.latitude,
      'longitude', new.longitude,
      'photo_path', new.photo_path,
      'automated', true
    )
  )
  on conflict (source_table, source_id)
  where source_table is not null and source_id is not null
  do update set
    event_date = excluded.event_date,
    title = excluded.title,
    description = excluded.description,
    metadata = excluded.metadata,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_timeline_field_observation on public.field_observations;
create trigger trg_timeline_field_observation
after insert or update on public.field_observations
for each row execute function public.upsert_timeline_from_field_observation();

-- Recomendaciones activas prioritarias se convierten en tareas diarias.
create or replace function public.sync_task_from_field_recommendation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'activa' and new.priority in ('alta','critica') then
    insert into public.daily_field_tasks(
      company_id, lot_id, task_date, task_type, title, description,
      priority, status, source_table, source_id
    )
    values(
      new.company_id,
      new.lot_id,
      current_date,
      case new.recommendation_type
        when 'riego' then 'riego'
        when 'corte' then 'corte'
        when 'vuelo_mavic' then 'vuelo'
        when 'muestreo_gravimetrico' then 'muestreo'
        when 'inspeccion' then 'recorrida'
        else 'general'
      end,
      new.title,
      new.recommendation,
      new.priority,
      'pendiente',
      'field_recommendations',
      new.id
    )
    on conflict (source_table, source_id)
    where source_table is not null and source_id is not null
    do update set
      task_date = excluded.task_date,
      title = excluded.title,
      description = excluded.description,
      priority = excluded.priority,
      updated_at = now();
  elsif new.status <> 'activa' then
    update public.daily_field_tasks
      set status = case when new.status = 'ejecutada' then 'completada' else 'cancelada' end,
          completed_at = case when new.status = 'ejecutada' then now() else completed_at end,
          updated_at = now()
    where source_table='field_recommendations' and source_id=new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_task_field_recommendation on public.field_recommendations;
create trigger trg_task_field_recommendation
after insert or update on public.field_recommendations
for each row execute function public.sync_task_from_field_recommendation();

create or replace view public.field_daily_dashboard_v20_6
with (security_invoker = true)
as
select
  c.id as company_id,
  current_date as dashboard_date,
  count(t.id) filter (where t.status='pendiente') as pending_tasks,
  count(t.id) filter (where t.status='en_curso') as in_progress_tasks,
  count(t.id) filter (where t.status='completada') as completed_tasks,
  count(t.id) filter (where t.priority in ('alta','critica') and t.status in ('pendiente','en_curso')) as priority_tasks,
  (select count(*) from public.field_observations o
    where o.company_id=c.id and o.observation_date::date=current_date) as observations_today
from public.companies c
left join public.daily_field_tasks t
  on t.company_id=c.id and t.task_date=current_date
group by c.id;

grant select on public.field_daily_dashboard_v20_6 to authenticated;

commit;

select
  'Carga de Campo y Tareas Diarias instalada' as result,
  to_regclass('public.field_observations') is not null as observations_ready,
  to_regclass('public.daily_field_tasks') is not null as tasks_ready,
  to_regclass('public.field_daily_dashboard_v20_6') is not null as dashboard_ready;
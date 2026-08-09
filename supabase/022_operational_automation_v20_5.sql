-- LA MAGDALENA OS 20.5.0
-- Automatización operativa del Gemelo Digital
-- Ejecutar después de 021_field_digital_book.sql

begin;

-- Evita duplicados cuando un registro operativo se vuelve a editar.
create unique index if not exists uq_field_timeline_source
on public.field_timeline_events(source_table, source_id)
where source_table is not null and source_id is not null;

create or replace function public.upsert_field_timeline_from_irrigation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lot_id is null then return new; end if;

  insert into public.field_timeline_events(
    company_id, lot_id, event_type, event_date, title, description,
    source_table, source_id, metadata
  )
  values(
    new.company_id,
    new.lot_id,
    'riego',
    coalesce(new.irrigation_date, new.event_date, current_date)::timestamptz,
    'Riego' || case when coalesce(new.millimeters,0) > 0
      then ' · ' || new.millimeters || ' mm' else '' end,
    coalesce(new.notes, 'Registro automático desde Riegos'),
    'irrigation_events',
    new.id,
    jsonb_build_object(
      'millimeters', new.millimeters,
      'hours', new.hours,
      'event_type', new.event_type,
      'automated', true
    )
  )
  on conflict (source_table, source_id) where source_table is not null and source_id is not null
  do update set
    company_id = excluded.company_id,
    lot_id = excluded.lot_id,
    event_date = excluded.event_date,
    title = excluded.title,
    description = excluded.description,
    metadata = excluded.metadata,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.upsert_field_timeline_from_cut()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lot_id is null then return new; end if;

  insert into public.field_timeline_events(
    company_id, lot_id, event_type, event_date, title, description,
    source_table, source_id, metadata
  )
  values(
    new.company_id,
    new.lot_id,
    'corte',
    new.cut_date::timestamptz,
    'Corte de alfalfa',
    coalesce(new.notes, 'Producción: ' || coalesce(nullif(new.rolls,0), new.bales, 0) || ' rollos'),
    'alfalfa_cuts',
    new.id,
    jsonb_build_object(
      'bales', new.bales,
      'rolls', new.rolls,
      'total_kg', new.total_kg,
      'automated', true
    )
  )
  on conflict (source_table, source_id) where source_table is not null and source_id is not null
  do update set
    company_id = excluded.company_id,
    lot_id = excluded.lot_id,
    event_date = excluded.event_date,
    title = excluded.title,
    description = excluded.description,
    metadata = excluded.metadata,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.upsert_field_timeline_from_precision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lot_id is null then return new; end if;

  insert into public.field_timeline_events(
    company_id, lot_id, event_type, event_date, title, description,
    source_table, source_id, metadata
  )
  values(
    new.company_id,
    new.lot_id,
    'vuelo_mavic',
    new.flight_date::timestamptz,
    'Vuelo y análisis multiespectral',
    coalesce(new.observations,
      case when new.ndvi_avg is not null
        then 'NDVI promedio: ' || round(new.ndvi_avg,3)
        else 'Registro automático desde Agricultura de Precisión'
      end
    ),
    'precision_analyses',
    new.id,
    jsonb_build_object(
      'ndvi_avg', new.ndvi_avg,
      'ndre_avg', new.ndre_avg,
      'low_vigor_pct', new.low_vigor_pct,
      'hectares', new.hectares,
      'automated', true
    )
  )
  on conflict (source_table, source_id) where source_table is not null and source_id is not null
  do update set
    company_id = excluded.company_id,
    lot_id = excluded.lot_id,
    event_date = excluded.event_date,
    title = excluded.title,
    description = excluded.description,
    metadata = excluded.metadata,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.upsert_field_timeline_from_gravimetric()
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
    'humedad_gravimetrica',
    new.sample_date::timestamptz,
    'Muestra gravimétrica',
    coalesce(new.notes,
      'Humedad gravimétrica: ' || round(new.gravimetric_moisture_pct,2) || '%'
    ),
    'gravimetric_samples',
    new.id,
    jsonb_build_object(
      'sample_point', new.sample_point,
      'depth_from_cm', new.depth_from_cm,
      'depth_to_cm', new.depth_to_cm,
      'gravimetric_moisture_pct', new.gravimetric_moisture_pct,
      'volumetric_moisture_pct', new.volumetric_moisture_pct,
      'model_error_pct', new.model_error_pct,
      'automated', true
    )
  )
  on conflict (source_table, source_id) where source_table is not null and source_id is not null
  do update set
    company_id = excluded.company_id,
    lot_id = excluded.lot_id,
    event_date = excluded.event_date,
    title = excluded.title,
    description = excluded.description,
    metadata = excluded.metadata,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_timeline_irrigation on public.irrigation_events;
create trigger trg_timeline_irrigation
after insert or update on public.irrigation_events
for each row execute function public.upsert_field_timeline_from_irrigation();

drop trigger if exists trg_timeline_cut on public.alfalfa_cuts;
create trigger trg_timeline_cut
after insert or update on public.alfalfa_cuts
for each row execute function public.upsert_field_timeline_from_cut();

drop trigger if exists trg_timeline_precision on public.precision_analyses;
create trigger trg_timeline_precision
after insert or update on public.precision_analyses
for each row execute function public.upsert_field_timeline_from_precision();

drop trigger if exists trg_timeline_gravimetric on public.gravimetric_samples;
create trigger trg_timeline_gravimetric
after insert or update on public.gravimetric_samples
for each row execute function public.upsert_field_timeline_from_gravimetric();

-- Carga inicial de registros históricos ya existentes.
insert into public.field_timeline_events(
  company_id, lot_id, event_type, event_date, title, description,
  source_table, source_id, metadata
)
select
  i.company_id, i.lot_id, 'riego',
  coalesce(i.irrigation_date, i.event_date)::timestamptz,
  'Riego' || case when coalesce(i.millimeters,0)>0 then ' · '||i.millimeters||' mm' else '' end,
  coalesce(i.notes,'Registro automático desde Riegos'),
  'irrigation_events', i.id,
  jsonb_build_object('millimeters',i.millimeters,'hours',i.hours,'automated',true)
from public.irrigation_events i
where i.lot_id is not null
on conflict (source_table, source_id) where source_table is not null and source_id is not null do nothing;

insert into public.field_timeline_events(
  company_id, lot_id, event_type, event_date, title, description,
  source_table, source_id, metadata
)
select
  c.company_id, c.lot_id, 'corte', c.cut_date::timestamptz,
  'Corte de alfalfa',
  coalesce(c.notes,'Producción: '||coalesce(nullif(c.rolls,0),c.bales,0)||' rollos'),
  'alfalfa_cuts', c.id,
  jsonb_build_object('bales',c.bales,'rolls',c.rolls,'total_kg',c.total_kg,'automated',true)
from public.alfalfa_cuts c
where c.lot_id is not null
on conflict (source_table, source_id) where source_table is not null and source_id is not null do nothing;

insert into public.field_timeline_events(
  company_id, lot_id, event_type, event_date, title, description,
  source_table, source_id, metadata
)
select
  p.company_id, p.lot_id, 'vuelo_mavic', p.flight_date::timestamptz,
  'Vuelo y análisis multiespectral',
  coalesce(p.observations,
    case when p.ndvi_avg is not null then 'NDVI promedio: '||round(p.ndvi_avg,3)
    else 'Registro automático desde Agricultura de Precisión' end),
  'precision_analyses', p.id,
  jsonb_build_object('ndvi_avg',p.ndvi_avg,'ndre_avg',p.ndre_avg,'low_vigor_pct',p.low_vigor_pct,'automated',true)
from public.precision_analyses p
where p.lot_id is not null
on conflict (source_table, source_id) where source_table is not null and source_id is not null do nothing;

insert into public.field_timeline_events(
  company_id, lot_id, event_type, event_date, title, description,
  source_table, source_id, metadata
)
select
  g.company_id, g.lot_id, 'humedad_gravimetrica', g.sample_date::timestamptz,
  'Muestra gravimétrica',
  coalesce(g.notes,'Humedad gravimétrica: '||round(g.gravimetric_moisture_pct,2)||'%'),
  'gravimetric_samples', g.id,
  jsonb_build_object('sample_point',g.sample_point,'gravimetric_moisture_pct',g.gravimetric_moisture_pct,'automated',true)
from public.gravimetric_samples g
on conflict (source_table, source_id) where source_table is not null and source_id is not null do nothing;

create or replace view public.field_automation_status_v20_5
with (security_invoker = true)
as
select
  l.company_id,
  l.id as lot_id,
  l.name as lot_name,
  count(e.id) filter (where e.metadata->>'automated'='true') as automated_events,
  count(e.id) as total_timeline_events,
  max(e.event_date) as last_timeline_activity
from public.lots l
left join public.field_timeline_events e
  on e.company_id=l.company_id and e.lot_id=l.id
group by l.company_id,l.id,l.name;

grant select on public.field_automation_status_v20_5 to authenticated;

commit;

select
  'Automatización operativa instalada' as result,
  (select count(*) from public.field_timeline_events where metadata->>'automated'='true') as automated_events,
  to_regclass('public.field_automation_status_v20_5') is not null as status_view_ready;
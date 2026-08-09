-- LA MAGDALENA OS 36.3.0
-- Campos adicionales para dejar listo el módulo de carga real de riego.

alter table public.hydric_profiles
  add column if not exists soil_texture text,
  add column if not exists bulk_density_default numeric(8,4),
  add column if not exists valve_name text,
  add column if not exists irrigated_area_ha numeric(10,3),
  add column if not exists flow_m3_h numeric(12,3),
  add column if not exists profile_notes text;

comment on column public.hydric_profiles.bulk_density_default is 'Densidad aparente predeterminada del lote en g/cm3.';
comment on column public.hydric_profiles.application_rate_mm_h is 'Precipitación real del sistema de riego en mm/h.';
comment on column public.hydric_profiles.flow_m3_h is 'Caudal total del sector o válvula en m3/h.';

create or replace view public.hydric_data_readiness_v36_3
with (security_invoker = true) as
select
  l.company_id,
  l.id as lot_id,
  l.name as lot_name,
  hp.id is not null as profile_created,
  hp.field_capacity_pct is not null and hp.wilting_point_pct is not null and hp.root_depth_cm is not null as soil_ready,
  hp.application_rate_mm_h is not null and hp.irrigation_efficiency_pct is not null as irrigation_ready,
  exists(select 1 from public.gravimetric_samples gs where gs.lot_id=l.id) as has_initial_sample,
  (select max(gs.sample_date) from public.gravimetric_samples gs where gs.lot_id=l.id) as last_sample_date,
  (select max(ie.event_date) from public.irrigation_events ie where ie.lot_id=l.id) as last_irrigation_date
from public.lots l
left join public.hydric_profiles hp on hp.company_id=l.company_id and hp.lot_id=l.id;

grant select on public.hydric_data_readiness_v36_3 to authenticated;

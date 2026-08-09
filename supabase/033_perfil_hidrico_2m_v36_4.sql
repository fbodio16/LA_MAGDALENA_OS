-- LA MAGDALENA OS 36.4.0
-- Configuración definitiva inicial para La Magdalena:
-- suelo franco limoso, muestras 0–30 y 30–60 cm, perfil 0–200 cm y 320 mm de capacidad máxima.

alter table public.hydric_profiles
  add column if not exists profile_depth_cm numeric(8,2) default 200,
  add column if not exists profile_capacity_mm numeric(10,2) default 320,
  add column if not exists deep_reserve_pct numeric(6,2) default 75;

alter table public.gravimetric_samples
  add column if not exists layer_code text,
  add column if not exists water_layer_mm numeric(10,3);

comment on column public.hydric_profiles.profile_capacity_mm is 'Capacidad máxima de almacenamiento de agua del perfil completo, en mm.';
comment on column public.hydric_profiles.deep_reserve_pct is 'Estimación inicial de ocupación de la reserva profunda no muestreada (60 cm hasta profundidad total).';
comment on column public.gravimetric_samples.layer_code is 'Capa normalizada: 0_30 o 30_60.';
comment on column public.gravimetric_samples.water_layer_mm is 'Agua calculada para la capa mediante humedad gravimétrica, densidad aparente y espesor.';

create index if not exists gravimetric_samples_lot_layer_date_idx
  on public.gravimetric_samples(lot_id, layer_code, sample_date desc);

create or replace view public.hydric_latest_layers_v36_4
with (security_invoker = true) as
select distinct on (gs.company_id, gs.lot_id, gs.layer_code)
  gs.*
from public.gravimetric_samples gs
where gs.layer_code in ('0_30','30_60')
order by gs.company_id, gs.lot_id, gs.layer_code, gs.sample_date desc, gs.created_at desc;

grant select on public.hydric_latest_layers_v36_4 to authenticated;

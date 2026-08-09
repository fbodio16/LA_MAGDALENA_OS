-- LA MAGDALENA OS 19.0.0
-- Inteligencia hídrica, estación meteorológica propia y calibración gravimétrica

create extension if not exists pgcrypto;

create table if not exists public.hydric_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  field_capacity_pct numeric(7,3),
  wilting_point_pct numeric(7,3),
  root_depth_cm numeric(8,2) default 60,
  refill_trigger_pct numeric(7,2) default 45,
  irrigation_efficiency_pct numeric(7,2) default 90,
  rain_efficiency_pct numeric(7,2) default 80,
  application_rate_mm_h numeric(9,3) default 4.5,
  crop_coefficient numeric(7,3) default 1.05,
  max_application_mm numeric(9,2) default 45,
  model_correction_mm numeric(9,3) default 0,
  calibration_error_mm numeric(9,3),
  calibration_count integer not null default 0,
  last_calibrated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, lot_id)
);

create table if not exists public.weather_station_observations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  station_code text,
  observed_at timestamptz not null,
  rain_mm numeric(9,3) default 0,
  et0_mm numeric(9,3),
  temperature_avg_c numeric(8,3),
  temperature_min_c numeric(8,3),
  temperature_max_c numeric(8,3),
  relative_humidity_pct numeric(7,3),
  wind_speed_kmh numeric(9,3),
  solar_radiation_mj_m2 numeric(10,3),
  atmospheric_pressure_hpa numeric(10,3),
  source_reference text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.gravimetric_samples (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  sample_date date not null,
  sample_point text,
  depth_from_cm numeric(8,2) default 0,
  depth_to_cm numeric(8,2) default 40,
  wet_mass_g numeric(12,3),
  dry_mass_g numeric(12,3),
  gravimetric_moisture_pct numeric(9,4) not null,
  bulk_density_g_cm3 numeric(8,4),
  volumetric_moisture_pct numeric(9,4),
  available_water_pct numeric(9,3),
  model_estimated_moisture_pct numeric(9,4),
  model_error_pct numeric(9,4),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.hydric_daily_balances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  balance_date date not null,
  et0_mm numeric(9,3) default 0,
  kc numeric(7,3) default 1,
  etc_mm numeric(9,3) default 0,
  rain_mm numeric(9,3) default 0,
  effective_rain_mm numeric(9,3) default 0,
  irrigation_mm numeric(9,3) default 0,
  estimated_depletion_mm numeric(10,3) default 0,
  recommended_application_mm numeric(10,3) default 0,
  recommended_hours numeric(10,3) default 0,
  confidence_pct numeric(7,2),
  status text default 'correcto',
  weather_source text,
  satellite_index numeric(9,4),
  drone_index numeric(9,4),
  reasons jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, lot_id, balance_date)
);

create index if not exists idx_weather_station_company_date on public.weather_station_observations(company_id, observed_at desc);
create index if not exists idx_gravimetric_company_lot_date on public.gravimetric_samples(company_id, lot_id, sample_date desc);
create index if not exists idx_hydric_balance_company_lot_date on public.hydric_daily_balances(company_id, lot_id, balance_date desc);

alter table public.hydric_profiles enable row level security;
alter table public.weather_station_observations enable row level security;
alter table public.gravimetric_samples enable row level security;
alter table public.hydric_daily_balances enable row level security;

-- Reutiliza la función de pertenencia creada por las migraciones anteriores.
do $$
declare t text;
begin
  foreach t in array array['hydric_profiles','weather_station_observations','gravimetric_samples','hydric_daily_balances'] loop
    execute format('drop policy if exists %I on public.%I', t || '_member_access', t);
    execute format($p$
      create policy %I on public.%I
      for all to authenticated
      using (public.is_company_member(company_id))
      with check (public.is_company_member(company_id))
    $p$, t || '_member_access', t);
  end loop;
end $$;

grant select, insert, update, delete on public.hydric_profiles to authenticated;
grant select, insert, update, delete on public.weather_station_observations to authenticated;
grant select, insert, update, delete on public.gravimetric_samples to authenticated;
grant select, insert, update, delete on public.hydric_daily_balances to authenticated;

create or replace view public.hydric_readiness_v19 as
select
  c.id as company_id,
  c.name as company_name,
  (select count(*) from public.hydric_profiles hp where hp.company_id=c.id) as configured_lots,
  (select count(*) from public.weather_station_observations w where w.company_id=c.id) as station_observations,
  (select count(*) from public.gravimetric_samples g where g.company_id=c.id) as gravimetric_samples,
  (select count(*) from public.hydric_daily_balances b where b.company_id=c.id) as calculated_balances
from public.companies c;

grant select on public.hydric_readiness_v19 to authenticated;

select * from public.hydric_readiness_v19 order by company_name;
-- LA MAGDALENA OS 36.2.0
-- Integración segura con Ecowitt para Inteligencia Hídrica

create extension if not exists pgcrypto;

create table if not exists public.ecowitt_integrations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  station_name text not null default 'La Magdalena',
  device_mac text not null,
  application_key text not null,
  api_key text not null,
  enabled boolean not null default true,
  sync_interval_minutes integer not null default 15 check (sync_interval_minutes between 5 and 1440),
  history_days integer not null default 7 check (history_days between 1 and 90),
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  last_payload jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id)
);

alter table public.ecowitt_integrations enable row level security;

drop policy if exists ecowitt_integrations_member_write on public.ecowitt_integrations;
create policy ecowitt_integrations_member_write on public.ecowitt_integrations
for insert to authenticated
with check (public.is_company_member(company_id));

drop policy if exists ecowitt_integrations_member_update on public.ecowitt_integrations;
create policy ecowitt_integrations_member_update on public.ecowitt_integrations
for update to authenticated
using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

-- Las claves no se exponen al navegador. La Edge Function usa service_role.
revoke all on public.ecowitt_integrations from anon, authenticated;
grant insert, update on public.ecowitt_integrations to authenticated;

create or replace view public.ecowitt_integrations_public
with (security_invoker = true) as
select
  id, company_id, station_name, device_mac, enabled,
  sync_interval_minutes, history_days,
  last_sync_at, last_success_at, last_error,
  created_at, updated_at,
  right(device_mac, 5) as mac_suffix,
  true as credentials_configured
from public.ecowitt_integrations;

grant select on public.ecowitt_integrations_public to authenticated;

create unique index if not exists idx_weather_station_ecowitt_unique
on public.weather_station_observations(company_id, station_code, observed_at)
where station_code is not null;

comment on table public.ecowitt_integrations is 'Credenciales Ecowitt; lectura reservada a Edge Functions con service_role.';
comment on view public.ecowitt_integrations_public is 'Estado de integración sin exponer application_key ni api_key.';
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
-- LA MAGDALENA OS 36.6.0
-- Activación final para comenzar la carga real de perfiles, muestras 0–30/30–60 y riegos.

alter table public.hydric_profiles
  alter column profile_depth_cm set default 200,
  alter column profile_capacity_mm set default 320,
  alter column deep_reserve_pct set default 75,
  alter column soil_texture set default 'Franco limoso';

update public.hydric_profiles
set profile_depth_cm = coalesce(profile_depth_cm, 200),
    profile_capacity_mm = coalesce(profile_capacity_mm, 320),
    deep_reserve_pct = coalesce(deep_reserve_pct, 75),
    soil_texture = coalesce(nullif(trim(soil_texture), ''), 'Franco limoso'),
    updated_at = now()
where profile_depth_cm is null
   or profile_capacity_mm is null
   or deep_reserve_pct is null
   or soil_texture is null
   or trim(soil_texture) = '';

-- Normaliza automáticamente las dos capas utilizadas en La Magdalena.
update public.gravimetric_samples
set layer_code = case
  when depth_from_cm = 0 and depth_to_cm = 30 then '0_30'
  when depth_from_cm = 30 and depth_to_cm = 60 then '30_60'
  else layer_code
end
where layer_code is null;

-- Calcula los porcentajes derivados cuando se dispone de masas y densidad.
update public.gravimetric_samples
set gravimetric_moisture_pct = case
      when dry_mass_g > 0 and wet_mass_g >= dry_mass_g
      then ((wet_mass_g - dry_mass_g) / dry_mass_g) * 100
      else gravimetric_moisture_pct
    end,
    volumetric_moisture_pct = case
      when coalesce(bulk_density_g_cm3, 0) > 0
      then gravimetric_moisture_pct * bulk_density_g_cm3
      else volumetric_moisture_pct
    end,
    water_layer_mm = case
      when coalesce(bulk_density_g_cm3, 0) > 0 and depth_to_cm > depth_from_cm
      then (gravimetric_moisture_pct / 100.0) * bulk_density_g_cm3 * (depth_to_cm - depth_from_cm) * 10
      else water_layer_mm
    end;

create or replace view public.hydric_load_status_v36_6
with (security_invoker = true) as
select
  l.company_id,
  l.id as lot_id,
  l.name as lot_name,
  coalesce(l.crop, 'Sin cultivo') as crop,
  hp.id is not null as profile_created,
  coalesce(hp.soil_texture, 'Franco limoso') as soil_texture,
  coalesce(hp.profile_depth_cm, 200) as profile_depth_cm,
  coalesce(hp.profile_capacity_mm, 320) as profile_capacity_mm,
  hp.bulk_density_default is not null as has_bulk_density,
  exists (
    select 1 from public.gravimetric_samples gs
    where gs.company_id=l.company_id and gs.lot_id=l.id
      and gs.depth_from_cm=0 and gs.depth_to_cm=30
  ) as has_sample_0_30,
  exists (
    select 1 from public.gravimetric_samples gs
    where gs.company_id=l.company_id and gs.lot_id=l.id
      and gs.depth_from_cm=30 and gs.depth_to_cm=60
  ) as has_sample_30_60,
  exists (
    select 1 from public.irrigation_events ie
    where ie.company_id=l.company_id and ie.lot_id=l.id
  ) as has_irrigation,
  (select max(gs.sample_date) from public.gravimetric_samples gs where gs.company_id=l.company_id and gs.lot_id=l.id) as last_sample_date,
  (select max(ie.event_date) from public.irrigation_events ie where ie.company_id=l.company_id and ie.lot_id=l.id) as last_irrigation_date
from public.lots l
left join public.hydric_profiles hp
  on hp.company_id=l.company_id and hp.lot_id=l.id;

grant select on public.hydric_load_status_v36_6 to authenticated;

select * from public.hydric_load_status_v36_6 order by lot_name;

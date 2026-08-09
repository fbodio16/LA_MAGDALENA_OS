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

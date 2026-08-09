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

begin;

create table if not exists public.satellite_radar_observations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  source text not null default 'Sentinel-1 GRD',
  observed_from timestamptz not null,
  observed_to timestamptz not null,
  vv_mean numeric,
  vh_mean numeric,
  vh_vv_ratio numeric,
  radar_vegetation_index numeric,
  sample_count integer,
  no_data_count integer,
  acquisition_mode text default 'IW',
  polarization text default 'DV',
  orbit_direction text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(lot_id, observed_from, observed_to, source)
);

create index if not exists satellite_radar_company_lot_date_idx
  on public.satellite_radar_observations(company_id, lot_id, observed_to desc);

alter table public.satellite_radar_observations enable row level security;

drop policy if exists satellite_radar_select_company on public.satellite_radar_observations;
create policy satellite_radar_select_company on public.satellite_radar_observations
for select to authenticated using (
  exists (
    select 1 from public.company_members cm
    where cm.company_id = satellite_radar_observations.company_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists satellite_radar_write_company on public.satellite_radar_observations;
create policy satellite_radar_write_company on public.satellite_radar_observations
for all to authenticated using (
  exists (
    select 1 from public.company_members cm
    where cm.company_id = satellite_radar_observations.company_id
      and cm.user_id = auth.uid()
      and lower(coalesce(cm.role,'')) in ('superadministrador','administrador')
  )
) with check (
  exists (
    select 1 from public.company_members cm
    where cm.company_id = satellite_radar_observations.company_id
      and cm.user_id = auth.uid()
      and lower(coalesce(cm.role,'')) in ('superadministrador','administrador')
  )
);

comment on table public.satellite_radar_observations is
  'Estadísticas parcelarias de Sentinel-1 GRD. No reemplazan mediciones de suelo ni se mezclan directamente con NDVI.';

commit;

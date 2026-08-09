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

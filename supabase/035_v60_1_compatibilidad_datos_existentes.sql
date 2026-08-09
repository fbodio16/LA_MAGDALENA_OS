-- LA MAGDALENA OS v60.0.0
-- Adaptador para la base histórica confirmada el 2026-08-04.
-- Operación no destructiva: no renombra, elimina ni transforma datos existentes.

begin;

-- Índices de lectura. IF NOT EXISTS permite repetir la migración de forma segura.
create index if not exists idx_v60_valves_company_active
  on public.irrigation_valves(company_id, active);
create index if not exists idx_v60_balances_valve_date
  on public.hydric_daily_balances(valve_id, balance_date desc);
create index if not exists idx_v60_events_valve_date
  on public.irrigation_events(valve_id, event_date desc);
create index if not exists idx_v60_profiles_valve
  on public.hydric_profiles(valve_id);

-- Único contrato de lectura para el frontend v60.
-- security_invoker conserva las políticas RLS de las tablas históricas.
create or replace view public.v_irrigation_dashboard
with (security_invoker = true)
as
with valve_state as (
select
  v.id as valve_id, v.company_id, v.lot_id,
  'V-' || lpad(coalesce(v.valve_number, 0)::text, 2, '0') as valve_code,
  v.name as valve_name,
  coalesce(v.irrigated_area_ha, hp.irrigated_area_ha, 0) as area_ha,
  coalesce(v.flow_m3_h, hp.flow_m3_h, 0) as flow_m3h,
  coalesce(
    case when b.id is not null and coalesce(hp.profile_capacity_mm, 0) > 0
      then greatest(0, least(100, 100 * (hp.profile_capacity_mm - coalesce(b.estimated_depletion_mm, 0)) / hp.profile_capacity_mm)) end,
    g.available_pct
  ) as available_pct,
  coalesce(
    case when b.confidence_pct > 1 then least(1, b.confidence_pct / 100)
         when b.confidence_pct is not null then greatest(0, least(1, b.confidence_pct)) end,
    g.confidence, 0
  ) as confidence,
  coalesce(b.updated_at, g.sample_date::timestamptz) as last_reading_at,
  coalesce(b.etc_mm, s.eto_mm_day) as daily_use_mm,
  coalesce(hp.refill_trigger_pct, 40) as threshold_pct,
  hp.profile_capacity_mm,
  hp.irrigation_efficiency_pct,
  hp.max_application_mm,
  b.recommended_application_mm,
  coalesce(s.forecast_rain_mm, 0) as forecast_rain_mm
from public.irrigation_valves v
left join lateral (
  select x.*
  from public.hydric_profiles x
  where x.company_id = v.company_id
    and x.lot_id = v.lot_id
    and (x.valve_id = v.id or x.valve_id is null)
  order by (x.valve_id = v.id) desc, x.updated_at desc
  limit 1
) hp on true
left join lateral (
  select x.*
  from public.hydric_daily_balances x
  where x.company_id = v.company_id
    and x.lot_id = v.lot_id
    and (x.valve_id = v.id or x.valve_id is null)
  order by (x.valve_id = v.id) desc, x.balance_date desc, x.updated_at desc
  limit 1
) b on true
left join lateral (
  select
    z.sample_date,
    sum(coalesce(
          z.available_water_pct,
          greatest(0, least(100,
            100 * (z.gravimetric_moisture_pct - hp.wilting_point_pct)
            / nullif(hp.field_capacity_pct - hp.wilting_point_pct, 0)
          ))
        ) * greatest(coalesce(z.depth_to_cm,0)-coalesce(z.depth_from_cm,0),1))
      / nullif(sum(greatest(coalesce(z.depth_to_cm,0)-coalesce(z.depth_from_cm,0),1)),0) as available_pct,
    greatest(0, least(1, 1 - coalesce(avg(abs(z.model_error_pct)),25)/100)) as confidence
  from public.gravimetric_samples z
  where z.company_id=v.company_id and z.lot_id=v.lot_id
    and (z.valve_id=v.id or z.valve_id is null)
    and z.sample_date <= current_date
    and z.sample_date=(
      select max(z2.sample_date) from public.gravimetric_samples z2
      where z2.company_id=v.company_id and z2.lot_id=v.lot_id
        and (z2.valve_id=v.id or z2.valve_id is null)
        and z2.sample_date <= current_date
    )
  group by z.sample_date
) g on true
left join lateral (
  select x.forecast_rain_mm, x.eto_mm_day
  from public.irrigation_settings x
  where x.company_id = v.company_id
  order by x.updated_at desc
  limit 1
) s on true
where v.active = true
)
select
  valve_id, company_id, lot_id, valve_code, valve_name, area_ha, flow_m3h,
  available_pct, confidence, last_reading_at,
  case when available_pct is null or coalesce(daily_use_mm,0)<=0 or coalesce(profile_capacity_mm,0)<=0 then null
       else greatest(0, round(((available_pct-threshold_pct)/100*profile_capacity_mm)/daily_use_mm,1)) end as days_to_threshold,
  greatest(0, coalesce(recommended_application_mm,
    least(coalesce(max_application_mm,9999),
      greatest(0,(85-coalesce(available_pct,85))/100*coalesce(profile_capacity_mm,0)
        / nullif(coalesce(irrigation_efficiency_pct,82)/100,0))
  ))) as recommended_mm,
  forecast_rain_mm,
  case when available_pct is null then 0 else greatest(0,least(100,round(
    (100-available_pct)*0.65 +
    case when coalesce(daily_use_mm,0)<=0 or coalesce(profile_capacity_mm,0)<=0 then 15
         else greatest(0,50-10*greatest(0,((available_pct-threshold_pct)/100*profile_capacity_mm)/daily_use_mm)) end
  ))) end as priority_score
from valve_state;

grant select on public.v_irrigation_dashboard to authenticated;

comment on view public.v_irrigation_dashboard is
  'Contrato de lectura LA MAGDALENA OS v60; adapta las tablas hídricas históricas sin modificarlas.';

commit;

-- Verificación posterior (debe devolver una fila por válvula activa):
select valve_code, valve_name, available_pct, confidence,
       days_to_threshold, recommended_mm, forecast_rain_mm
from public.v_irrigation_dashboard
order by priority_score desc, valve_code;

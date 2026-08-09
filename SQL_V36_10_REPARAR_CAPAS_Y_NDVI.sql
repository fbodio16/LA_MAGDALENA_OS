-- LA MAGDALENA OS 36.10.0
-- Normaliza capas gravimétricas y habilita diagnóstico de asociación por lote.

alter table public.gravimetric_samples
  add column if not exists layer_code text,
  add column if not exists water_layer_mm numeric(10,3);

update public.gravimetric_samples
set layer_code = case
  when round(depth_from_cm)=0 and round(depth_to_cm)=30 then '0_30'
  when round(depth_from_cm)=30 and round(depth_to_cm)=60 then '30_60'
  else layer_code
end
where layer_code is null or btrim(layer_code)='';

create index if not exists gravimetric_samples_lot_layer_date_idx
  on public.gravimetric_samples(company_id,lot_id,layer_code,sample_date desc,created_at desc);

create or replace view public.hydric_sample_diagnostics_v36_10
with (security_invoker=true) as
select l.company_id,l.id lot_id,l.name lot_name,
 max(gs.sample_date) filter(where gs.layer_code='0_30' or (round(gs.depth_from_cm)=0 and round(gs.depth_to_cm)=30)) as sample_0_30_date,
 max(gs.sample_date) filter(where gs.layer_code='30_60' or (round(gs.depth_from_cm)=30 and round(gs.depth_to_cm)=60)) as sample_30_60_date,
 count(gs.id) as rows_total
from public.lots l
left join public.gravimetric_samples gs on gs.company_id=l.company_id and gs.lot_id=l.id
group by l.company_id,l.id,l.name;

grant select on public.hydric_sample_diagnostics_v36_10 to authenticated;

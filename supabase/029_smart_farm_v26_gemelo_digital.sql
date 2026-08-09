-- LA MAGDALENA OS v26.0.0 · Smart Farm
-- Ejecutar una sola vez en Supabase SQL Editor.
-- Carga el gemelo digital base únicamente si la empresa todavía no tiene lotes con estos nombres.

do $$
declare cid uuid;
begin
  select id into cid from public.companies where lower(name) like '%magdalena%' order by created_at limit 1;
  if cid is null then raise exception 'No se encontró la empresa La Magdalena.'; end if;

  insert into public.lots(company_id,name,crop,hectares,area_ha,status,next_task,notes)
  values
   (cid,'Lote 1','Alfalfa',7,7,'Activo','Configurar calendario de corte','Gemelo digital inicial · riego por goteo'),
   (cid,'Lote 2','Alfalfa',7,7,'Activo','Configurar calendario de corte','Gemelo digital inicial · riego por goteo'),
   (cid,'Lote 3','Alfalfa',7,7,'Activo','Configurar calendario de corte','Gemelo digital inicial · riego por goteo'),
   (cid,'Lote 4','Alfalfa',7,7,'Activo','Configurar calendario de corte','Gemelo digital inicial · riego por goteo'),
   (cid,'Lote 5','Alfalfa',7,7,'Activo','Configurar calendario de corte','Gemelo digital inicial · riego por goteo'),
   (cid,'Lote 6','Alfalfa',7,7,'Activo','Configurar calendario de corte','Gemelo digital inicial · riego por goteo'),
   (cid,'Lote 7','Alfalfa',7,7,'Activo','Configurar calendario de corte','Gemelo digital inicial · riego por goteo'),
   (cid,'Lote 8','Alfalfa',7,7,'Activo','Configurar calendario de corte','Gemelo digital inicial · riego por goteo'),
   (cid,'Lote 9','Alfalfa',8,8,'Activo','Configurar calendario de corte','Gemelo digital inicial · riego por goteo'),
   (cid,'Lote 10','Alfalfa',8,8,'Activo','Configurar calendario de corte','Gemelo digital inicial · riego por goteo'),
   (cid,'Lote 11','Trigo',20,20,'Activo','Completar campaña y fecha de siembra','Gemelo digital inicial'),
   (cid,'Lote 12','Trigo',20,20,'Activo','Completar campaña y fecha de siembra','Gemelo digital inicial'),
   (cid,'Lote 13','Trigo',20,20,'Activo','Completar campaña y fecha de siembra','Gemelo digital inicial')
  on conflict(company_id,name) do update set crop=excluded.crop,hectares=excluded.hectares,area_ha=excluded.area_ha,status='Activo';

  insert into public.equipment(company_id,name,category,brand,model,status,notes)
  select cid,x.name,x.category,x.brand,x.model,'Activo','Activo inicial Smart Farm v26'
  from (values
   ('DJI Agras T100','Drone','DJI','Agras T100'),
   ('DJI Mavic 3 Multispectral','Drone','DJI','Mavic 3 Multispectral'),
   ('Scania R450 Super','Camión','Scania','R450 Super'),
   ('Semirremolque','Transporte',null,null),
   ('Tractor principal','Tractor',null,null),
   ('Segadora','Implemento',null,null),
   ('Rastrillo hilerador','Implemento',null,null),
   ('Rotoenfardadora','Implemento',null,null)
  ) as x(name,category,brand,model)
  where not exists(select 1 from public.equipment e where e.company_id=cid and lower(e.name)=lower(x.name));
end $$;

-- Control esperado: 13 lotes, 148 ha, 88 ha de alfalfa y 60 ha de trigo.
select crop,count(*) lotes,sum(hectares) hectareas from public.lots
where company_id=(select id from public.companies where lower(name) like '%magdalena%' order by created_at limit 1)
group by crop order by crop;

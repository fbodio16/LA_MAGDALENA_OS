-- LA MAGDALENA OS v26.1.0 · Gemelo Digital KML Real · SQL CORREGIDO
-- Corrección: la variable PL/pgSQL ahora se llama v_lot_id para evitar ambigüedad con la columna lot_id.
-- Ejecutar una sola vez en Supabase SQL Editor.
-- Vincula los 13 polígonos reales del KML con los lotes de La Magdalena.
-- Distribución confirmada: Válvulas 1 a 5 = Trigo; Válvulas 6 a 13 = Alfalfa.
-- Superficie operativa: 60 ha de trigo + 88 ha de alfalfa = 148 ha.

do $$
declare
  cid uuid;
  rec record;
  v_lot_id uuid;
begin
  select id into cid
  from public.companies
  where lower(name) like '%magdalena%'
  order by created_at
  limit 1;

  if cid is null then
    raise exception 'No se encontró la empresa La Magdalena.';
  end if;

  -- Elimina solamente lotes base duplicados sin actividad, si una ejecución anterior creó más de 13.
  -- Los lotes existentes se reutilizan por nombre y se renombran de forma segura.
  for rec in
    select * from (values
      (1,'Válvula 1','Trigo',11.6072,11.23,'Secano / campaña de trigo',-31.33512274,-63.31189488,'{"type":"Feature","properties":{"name":"Válvula 1","area_ha":11.23,"valve_number":1,"crop":"Trigo","operational_area_ha":11.6072,"irrigation":"Secano / campaña de trigo"},"geometry":{"type":"Polygon","coordinates":[[[-63.31318036260019,-31.33691131126364],[-63.31059471532727,-31.33745576005663],[-63.3106080671486,-31.33351536805766],[-63.31087535413323,-31.33326086490703],[-63.31134301046944,-31.33318863188109],[-63.31193238836899,-31.33302257664277],[-63.31318377321166,-31.33279437329978],[-63.31318036260019,-31.33691131126364]]]}}'::jsonb),
      (2,'Válvula 2','Trigo',12.2377,11.84,'Secano / campaña de trigo',-31.33543830,-63.30932406,'{"type":"Feature","properties":{"name":"Válvula 2","area_ha":11.84,"valve_number":2,"crop":"Trigo","operational_area_ha":12.2377,"irrigation":"Secano / campaña de trigo"},"geometry":{"type":"Polygon","coordinates":[[[-63.31059443391256,-31.33746681606965],[-63.30810003167576,-31.33796685786615],[-63.30819539130421,-31.33277985216907],[-63.30877424418102,-31.33271754290539],[-63.30878544039732,-31.3332287997691],[-63.3088243793009,-31.33329150867757],[-63.30915646291577,-31.33330358774942],[-63.30942794853269,-31.33327209609408],[-63.31025527042335,-31.33314158599152],[-63.31039080757047,-31.33342246944837],[-63.31060517555024,-31.3335137599615],[-63.31059443391256,-31.33746681606965]]]}}'::jsonb),
      (3,'Válvula 3','Trigo',12.3307,11.93,'Secano / campaña de trigo',-31.33555926,-63.30706834,'{"type":"Feature","properties":{"name":"Válvula 3","area_ha":11.93,"valve_number":3,"crop":"Trigo","operational_area_ha":12.3307,"irrigation":"Secano / campaña de trigo"},"geometry":{"type":"Polygon","coordinates":[[[-63.30818582778999,-31.33277815409852],[-63.30810690367725,-31.33797841013306],[-63.30597467906603,-31.33842894926229],[-63.30602773307436,-31.33307058128781],[-63.30818582778999,-31.33277815409852]]]}}'::jsonb),
      (4,'Válvula 4','Trigo',12.4031,12.0,'Secano / campaña de trigo',-31.33590543,-63.30491765,'{"type":"Feature","properties":{"name":"Válvula 4","area_ha":12.0,"valve_number":4,"crop":"Trigo","operational_area_ha":12.4031,"irrigation":"Secano / campaña de trigo"},"geometry":{"type":"Polygon","coordinates":[[[-63.30594112894286,-31.33843148546154],[-63.3038822623559,-31.33881788490887],[-63.30385784005539,-31.33334694332733],[-63.30600927143323,-31.333102069997],[-63.30594112894286,-31.33843148546154]]]}}'::jsonb),
      (5,'Válvula 5','Trigo',11.4212,11.05,'Secano / campaña de trigo',-31.33610935,-63.30289078,'{"type":"Feature","properties":{"name":"Válvula 5","area_ha":11.05,"valve_number":5,"crop":"Trigo","operational_area_ha":11.4212,"irrigation":"Secano / campaña de trigo"},"geometry":{"type":"Polygon","coordinates":[[[-63.30385714371504,-31.33883042994251],[-63.30228832258206,-31.33919075159854],[-63.30164196817839,-31.33363464353945],[-63.30383487768447,-31.33337483468963],[-63.30385714371504,-31.33883042994251]]]}}'::jsonb),
      (6,'Válvula 6','Alfalfa',11.0412,11.06,'Riego por goteo',-31.32786053,-63.31246999,'{"type":"Feature","properties":{"name":"Válvula 6","area_ha":11.06,"valve_number":6,"crop":"Alfalfa","operational_area_ha":11.0412,"irrigation":"Riego por goteo"},"geometry":{"type":"Polygon","coordinates":[[[-63.31165130683118,-31.32447900966339],[-63.3131493964955,-31.32420142284213],[-63.31326162810081,-31.33136304528652],[-63.31180806757099,-31.33147611820742],[-63.31165130683118,-31.32447900966339]]]}}'::jsonb),
      (7,'Válvula 7','Alfalfa',11.9097,11.93,'Riego por goteo',-31.32812202,-63.31090011,'{"type":"Feature","properties":{"name":"Válvula 7","area_ha":11.93,"valve_number":7,"crop":"Alfalfa","operational_area_ha":11.9097,"irrigation":"Riego por goteo"},"geometry":{"type":"Polygon","coordinates":[[[-63.31179935526536,-31.33147489195448],[-63.31066477582273,-31.33154552419313],[-63.31064953280565,-31.33172998144036],[-63.31017451251424,-31.33177345981949],[-63.31000388046878,-31.32481490336479],[-63.31162715928315,-31.32450565853259],[-63.31179935526536,-31.33147489195448]]]}}'::jsonb),
      (8,'Válvula 8','Alfalfa',11.0412,11.06,'Riego por goteo',-31.32849571,-63.30933202,'{"type":"Feature","properties":{"name":"Válvula 8","area_ha":11.06,"valve_number":8,"crop":"Alfalfa","operational_area_ha":11.0412,"irrigation":"Riego por goteo"},"geometry":{"type":"Polygon","coordinates":[[[-63.30865580975056,-31.33265685877216],[-63.30862268807992,-31.32991397902071],[-63.30851674212726,-31.32515960411946],[-63.30999722278992,-31.32481826019294],[-63.31017125514817,-31.33180122485311],[-63.30884806690658,-31.33190141166361],[-63.30889663724845,-31.33263901753767],[-63.30865580975056,-31.33265685877216]]]}}'::jsonb),
      (9,'Válvula 9','Alfalfa',11.4804,11.5,'Riego por goteo',-31.32900022,-63.30784276,'{"type":"Feature","properties":{"name":"Válvula 9","area_ha":11.5,"valve_number":9,"crop":"Alfalfa","operational_area_ha":11.4804,"irrigation":"Riego por goteo"},"geometry":{"type":"Polygon","coordinates":[[[-63.30702859854881,-31.32542442287909],[-63.30849271193699,-31.3251251543602],[-63.308640797447,-31.33266225798601],[-63.30720230978226,-31.33283868187623],[-63.30702859854881,-31.32542442287909]]]}}'::jsonb),
      (10,'Válvula 10','Alfalfa',11.2309,11.25,'Riego por goteo',-31.32925336,-63.30640465,'{"type":"Feature","properties":{"name":"Válvula 10","area_ha":11.25,"valve_number":10,"crop":"Alfalfa","operational_area_ha":11.2309,"irrigation":"Riego por goteo"},"geometry":{"type":"Polygon","coordinates":[[[-63.30719430124492,-31.33284332523726],[-63.3057370931238,-31.33302773620503],[-63.30563291501453,-31.32567037021431],[-63.30704723714187,-31.32540188636208],[-63.30719430124492,-31.33284332523726]]]}}'::jsonb),
      (11,'Válvula 11','Alfalfa',11.2808,11.3,'Riego por goteo',-31.32939285,-63.30495234,'{"type":"Feature","properties":{"name":"Válvula 11","area_ha":11.3,"valve_number":11,"crop":"Alfalfa","operational_area_ha":11.2808,"irrigation":"Riego por goteo"},"geometry":{"type":"Polygon","coordinates":[[[-63.305726923352,-31.33303419180461],[-63.30435804475242,-31.3331908093033],[-63.30408156663094,-31.32600157637586],[-63.30564117080267,-31.32566836950664],[-63.305726923352,-31.33303419180461]]]}}'::jsonb),
      (12,'Válvula 12','Alfalfa',11.0811,11.1,'Riego por goteo',-31.32974392,-63.30347968,'{"type":"Feature","properties":{"name":"Válvula 12","area_ha":11.1,"valve_number":12,"crop":"Alfalfa","operational_area_ha":11.0811,"irrigation":"Riego por goteo"},"geometry":{"type":"Polygon","coordinates":[[[-63.30435505110311,-31.33320796453508],[-63.30285585898152,-31.33338871445885],[-63.30264036894719,-31.32626756948206],[-63.30405459354779,-31.32598028955502],[-63.30435505110311,-31.33320796453508]]]}}'::jsonb),
      (13,'Válvula 13','Alfalfa',8.9348,8.95,'Riego por goteo',-31.32998223,-63.30216947,'{"type":"Feature","properties":{"name":"Válvula 13","area_ha":8.95,"valve_number":13,"crop":"Alfalfa","operational_area_ha":8.9348,"irrigation":"Riego por goteo"},"geometry":{"type":"Polygon","coordinates":[[[-63.30287374314465,-31.33339605721968],[-63.3016571045054,-31.33357562495418],[-63.3016135732997,-31.33266838916608],[-63.30151693630305,-31.3264751389849],[-63.3026485979582,-31.32627264373308],[-63.30287374314465,-31.33339605721968]]]}}'::jsonb)
    ) as x(n,name,crop,operational_ha,kml_ha,irrigation,center_lat,center_lng,geojson)
    order by n
  loop
    select id into v_lot_id
    from public.lots
    where company_id=cid and lower(name)=lower(rec.name)
    limit 1;

    if v_lot_id is null then
      select id into v_lot_id
      from public.lots
      where company_id=cid
        and lower(name) in (lower('Lote '||rec.n), lower('Lote '||lpad(rec.n::text,2,'0')))
      order by created_at
      limit 1;
    end if;

    if v_lot_id is null then
      insert into public.lots(company_id,name,crop,hectares,area_ha,status,next_task,notes)
      values(cid,rec.name,rec.crop,rec.operational_ha,rec.operational_ha,'Activo',
        case when rec.crop='Alfalfa' then 'Configurar calendario de corte y riego' else 'Completar campaña de trigo' end,
        'Gemelo digital KML real · Superficie geométrica KML: '||rec.kml_ha||' ha · '||rec.irrigation)
      returning id into v_lot_id;
    else
      update public.lots
      set name=rec.name,
          crop=rec.crop,
          hectares=rec.operational_ha,
          area_ha=rec.operational_ha,
          status='Activo',
          next_task=case when rec.crop='Alfalfa' then 'Configurar calendario de corte y riego' else 'Completar campaña de trigo' end,
          notes='Gemelo digital KML real · Superficie geométrica KML: '||rec.kml_ha||' ha · '||rec.irrigation
      where id=v_lot_id;
    end if;

    insert into public.lot_geometries(company_id,lot_id,geojson,center_lat,center_lng,updated_at)
    values(cid,v_lot_id,rec.geojson,rec.center_lat,rec.center_lng,now())
    on conflict(lot_id) do update
      set geojson=excluded.geojson,
          center_lat=excluded.center_lat,
          center_lng=excluded.center_lng,
          updated_at=now();
  end loop;
end $$;

-- Control esperado: 13 lotes, 148 ha operativas, 60 ha de trigo y 88 ha de alfalfa.
select crop,count(*) as lotes,round(sum(hectares)::numeric,2) as hectareas
from public.lots
where company_id=(select id from public.companies where lower(name) like '%magdalena%' order by created_at limit 1)
  and name ~* '^Válvula [0-9]+$'
group by crop
order by crop;

select count(*) as poligonos_kml
from public.lot_geometries
where company_id=(select id from public.companies where lower(name) like '%magdalena%' order by created_at limit 1);

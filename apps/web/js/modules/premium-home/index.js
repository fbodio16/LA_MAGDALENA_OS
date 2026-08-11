export function createPremiumHomeModule({state,helpers,hydricState,openModal,setPage}){
  const syncBadge=()=>{const s=hydricState.getState?.()||{};const a=s.audit||{};const time=s.updatedAt?new Date(s.updatedAt).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):'pendiente';const quality=s.quality==='estable'?'Cálculo estable':s.stabilizedCount?`Último valor válido (${s.stabilizedCount})`:'Datos incompletos';return `<span class="v75-sync ${a.ok&&s.quality==='estable'?'ok':'warn'}">${a.ok?'✓ 13/13 sincronizadas':'⚠ revisar datos'} · ${quality} · rev ${s.revision||0} · ${time}</span>`;};
  const {esc,number,totalHa,latest,vigor,hectares,weatherText,parseCutDecision}=helpers;
  const n=v=>Number(v||0);
  const day=s=>String(s||'').slice(0,10);
  const latestByDate=(rows,keys)=>[...(rows||[])].sort((a,b)=>String(keys.map(k=>b[k]).find(Boolean)||'').localeCompare(String(keys.map(k=>a[k]).find(Boolean)||'')))[0]||null;
  const pct=row=>n(row.available_pct??row.availability_pct??row.water_available_pct??row.available_water_pct);

  function hydricSummary(lots){
    const calculated=(hydricState.getRows?.()||[]).filter(x=>lots.some(l=>String(l.id)===String(x.lot?.id)));
    const byLot=new Map(calculated.map(x=>[String(x.lot?.id||''),x]));
    const cards=lots.map(lot=>byLot.get(String(lot.id))||{lot,p:{},valve:null,st:{root:{}},ready:false,occupancy:null,status:'Datos incompletos',instruction:'Faltan datos para calcular esta válvula. Abrí el detalle para completar su configuración.'});
    const valid=cards.filter(x=>x.ready&&x.occupancy!=null);
    const avg=valid.length?valid.reduce((sum,x)=>sum+n(x.occupancy),0)/valid.length:null;
    const urgent=valid.filter(x=>String(x.status).startsWith('Regar hoy'));
    const watch=valid.filter(x=>String(x.status).startsWith('Regar en 24–48 h')||String(x.status).startsWith('Vigilar'));
    const ok=valid.filter(x=>String(x.status).startsWith('No regar'));
    const incomplete=Math.max(0,lots.length-valid.length);
    const worst=[...valid].sort((a,b)=>n(a.occupancy)-n(b.occupancy))[0]||null;
    const tone=urgent.length?'red':watch.length?'yellow':'green';
    const action=urgent.length?'REGAR AHORA':watch.length?'CONTROLAR 24–48 H':'NO REGAR';
    const risk=avg==null?null:Math.max(0,Math.min(100,Math.round(100-avg)));
    return {rows:cards,valid,avg,urgent,watch,ok,incomplete,worst,tone,action,risk};
  }

  function confidence(){
    const sources=[
      ['Suelo',(state.gravimetricSamples||[]).length>0,28],
      ['Balance',(state.hydricDailyBalances||[]).length>0,24],
      ['Satélite',(state.satelliteObservations||[]).length>0,18],
      ['Estación',(state.weatherStationObservations||[]).length>0,18],
      ['Riegos',(state.irrigations||[]).length>0,12]
    ];
    const score=sources.reduce((s,[,ok,w])=>s+(ok?w:0),0);
    return {sources,score};
  }

  function priorityValue(x){
    if(!x?.ready)return 4;
    if(String(x.status).startsWith('Regar hoy'))return 0;
    if(String(x.status).startsWith('Regar en 24–48 h'))return 1;
    if(String(x.status).startsWith('Vigilar'))return 2;
    return 3;
  }

  function economicRanking(rows){
    const cropFactor=crop=>String(crop||'').toLowerCase().includes('alfalfa')?1.2:String(crop||'').toLowerCase().includes('trigo')?1:0.9;
    return [...rows].filter(x=>x.ready).map(x=>{
      const area=n(x.p?.irrigated_area_ha)||n(x.valve?.area_ha)||n(x.lot?.hectares||x.lot?.area_ha);
      const stress=Math.max(0,100-n(x.occupancy));
      const urgency=priorityValue(x)===0?1.5:priorityValue(x)===1?1.2:1;
      const score=Math.round(area*stress*cropFactor(x.lot?.crop||x.st?.root?.crop)*urgency);
      return {...x,area,economicScore:score};
    }).sort((a,b)=>b.economicScore-a.economicScore);
  }

  function simulate(row,days,rainMm=0){
    if(!row?.ready||row.occupancy==null)return null;
    const capacity=Math.max(1,n(row.st?.capacity));
    const dailyUse=Math.max(.5,n(row.etoDay)*n(row.kc||row.baseKc||1));
    const usefulRain=Math.max(0,n(rainMm)*.8);
    const projectedWater=Math.max(0,n(row.estimatedWater)-dailyUse*days+usefulRain);
    const projectedPct=Math.max(0,Math.min(100,projectedWater/capacity*100));
    const projectedStatus=projectedPct<=35?'Regar ya':projectedPct<=50?'Regar en 24 h':projectedPct<=65?'Vigilar':'Sin riego';
    return {days,dailyUse,projectedPct,projectedStatus,projectedWater};
  }

  function lmAiText(summary,forecastRain){
    const rows=summary.valid||[];
    const ranking=economicRanking(rows);
    const first=ranking[0]||summary.worst;
    if(!first)return 'Todavía faltan datos suficientes para construir una recomendación agronómica confiable.';
    const area=n(first.p?.irrigated_area_ha)||n(first.valve?.area_ha)||n(first.lot?.hectares||first.lot?.area_ha);
    const sim=simulate(first,2,forecastRain);
    const valve=first.valve?.valve_name||first.valve?.valve_code||first.lot?.name||'el sector prioritario';
    if(priorityValue(first)===0){if(!first?.decision?.ready)return `${valve} aparece como prioridad hídrica (${number(first.occupancy,0)}%), pero la decisión todavía NO está habilitada. Antes de regar: ${(first?.decision?.blockers||['revisar datos de calibración']).join(', ')}.`;return `${valve} es la prioridad operativa habilitada. Presenta ${number(first.occupancy,0)}% de agua disponible en ${number(area,1)} ha. Con una demanda estimada de ${number(sim?.dailyUse,1)} mm/día y sólo ${number(forecastRain,1)} mm previstos, aplicar ${number(first.application,1)} mm y verificar nuevamente la humedad en 24–48 horas.`;}
    if(priorityValue(first)<=2)return `${valve} encabeza el seguimiento. Si se espera 48 horas, su disponibilidad proyectada sería cercana a ${number(sim?.projectedPct,0)}%. Revisá el pronóstico y la humedad antes de confirmar la próxima lámina.`;
    return `No hay sectores que requieran riego inmediato. El sistema recomienda mantener el seguimiento y priorizar un nuevo muestreo en el sector con menor disponibilidad antes de modificar la programación.`;
  }


  function statusTone(x){
    const priority=priorityValue(x);
    return priority===0?'red':priority<=2?'yellow':x?.ready?'green':'neutral';
  }

  function valveName(x){
    return x?.valve?.valve_name||x?.valve?.valve_code||x?.p?.valve_name||x?.p?.valve_code||x?.lot?.name||'Sector';
  }

  function cropName(x){
    return x?.lot?.crop||x?.st?.root?.crop||x?.p?.crop||'Cultivo sin definir';
  }

  function lotArea(x){
    return n(x?.p?.irrigated_area_ha)||n(x?.valve?.area_ha)||n(x?.lot?.hectares||x?.lot?.area_ha);
  }

  function satelliteValues(x){
    const s=x?.lastSatellite||latestByDate((state.satelliteObservations||[]).filter(row=>String(row.lot_id||row.field_id||'')===String(x?.lot?.id||'')),['observed_to','observed_from','observation_date','created_at'])||{};
    return {
      date:day(s.observed_to||s.observed_from||s.observation_date||s.created_at)||'Sin dato',
      ndvi:n(s.ndvi_mean??s.ndvi??x?.ndvi)||null,
      ndre:n(s.ndre_mean??s.ndre)||null,
      msavi:n(s.msavi_mean??s.msavi)||null,
      ndmi:n(s.ndmi_mean??s.ndmi??x?.ndmi)||null
    };
  }

  function layerValue(sample){
    if(!sample)return 'Sin dato';
    const moisture=sample.gravimetric_moisture_pct??sample.moisture_pct??sample.water_content_pct??sample.humidity_pct;
    return moisture==null?'Sin dato':`${number(moisture,1)}%`;
  }

  function recordsForLot(rows,lotId){
    return (rows||[]).filter(row=>String(row.lot_id||row.field_id||row.sector_id||'')===String(lotId||''));
  }

  function formatDate(value){
    const raw=day(value);
    if(!raw)return 'Sin fecha';
    const [y,m,d]=raw.split('-');
    return y&&m&&d?`${d}/${m}/${y}`:raw;
  }

  function eventDate(row){
    return row?.event_date||row?.irrigation_date||row?.sample_date||row?.observed_at||row?.observation_date||row?.observed_to||row?.observed_from||row?.created_at||'';
  }

  function dateObj(value){
    const d=value?new Date(value):null;
    return d&&!Number.isNaN(d.getTime())?d:null;
  }

  function daysBetween(a,b){
    const da=dateObj(a),db=dateObj(b);
    return da&&db?Math.max(0,(db-da)/86400000):0;
  }

  function hydricBalanceSeries(x,lotId){
    const balances=recordsForLot(state.hydricDailyBalances||[],lotId)
      .filter(r=>eventDate(r)).sort((a,b)=>String(eventDate(a)).localeCompare(String(eventDate(b))));
    const rows=balances.slice(-7).map(r=>{
      const v=r.available_pct??r.availability_pct??r.water_available_pct??r.available_water_pct??r.occupancy_pct??r.profile_pct;
      const etc=r.etc_mm??r.crop_et_mm??r.et_crop_mm??r.etc;
      const rain=r.effective_rain_mm??r.useful_rain_mm??r.rain_mm??r.precipitation_mm;
      return {date:eventDate(r),pct:v==null?null:n(v),etc:etc==null?null:n(etc),rain:rain==null?0:n(rain)};
    });
    if(rows.filter(r=>r.pct!=null).length>=2)return {kind:'real',rows};
    if(!x?.ready||x.occupancy==null)return {kind:'none',rows:[]};
    const daily=Math.max(.1,n(x.etoDay)*n(x.kc||x.baseKc||1));
    const cap=Math.max(1,n(x.st?.capacity));
    const water=Math.max(0,n(x.estimatedWater));
    const today=new Date();
    const out=[];
    for(let i=6;i>=0;i--){
      const d=new Date(today);d.setDate(today.getDate()-i);
      const backWater=Math.min(cap,water+daily*i);
      out.push({date:d.toISOString(),pct:Math.max(0,Math.min(100,backWater/cap*100)),etc:daily,rain:0});
    }
    return {kind:'estimated',rows:out};
  }

  function consumptionMetrics(x,lotId){
    const balances=recordsForLot(state.hydricDailyBalances||[],lotId).sort((a,b)=>String(eventDate(b)).localeCompare(String(eventDate(a))));
    const uses=balances.slice(0,7).map(r=>r.etc_mm??r.crop_et_mm??r.et_crop_mm??r.etc).filter(v=>v!=null&&Number.isFinite(Number(v))).map(Number);
    const current=Math.max(0,n(x.etoDay)*n(x.kc||x.baseKc||1));
    const avg7=uses.length?uses.reduce((a,b)=>a+b,0)/uses.length:current;
    const cuts=recordsForLot(state.cuts||[],lotId).sort((a,b)=>String(b.cut_date||'').localeCompare(String(a.cut_date||'')));
    const lastCut=cuts[0]?.cut_date||null;
    const days=lastCut?Math.max(0,Math.floor(daysBetween(lastCut,new Date()))):null;
    const cycle=days==null?null:avg7*days;
    return {current,avg7,cycle,days,lastCut};
  }

  function irrigationScenario(x,mm){
    if(!x?.ready||x.occupancy==null)return null;
    const cap=Math.max(1,n(x.st?.capacity));
    const currentWater=Math.max(0,n(x.estimatedWater));
    const daily=Math.max(.1,n(x.etoDay)*n(x.kc||x.baseKc||1));
    const effective=Math.max(0,n(mm)*.9);
    const newWater=Math.min(cap,currentWater+effective);
    const pct=Math.max(0,Math.min(100,newWater/cap*100));
    const triggerWater=cap*.50;
    const autonomy=Math.max(0,Math.floor((newWater-triggerWater)/daily));
    const label=pct<45?'Insuficiente':pct<65?'Justo':pct<90?'Adecuado':'Perfil alto';
    return {mm,pct,autonomy,label};
  }

  function productionSignal(x,lotId){
    const crop=String(cropName(x)||'').toLowerCase();
    if(!crop.includes('alfalfa'))return {applicable:false};
    const area=Math.max(.01,lotArea(x));
    const year=String(new Date().getFullYear());
    const cuts=recordsForLot(state.cuts||[],lotId).filter(c=>String(c.cut_date||'').startsWith(year));
    const kg=cuts.reduce((s,c)=>s+n(c.total_kg),0);
    const actual=kg>0?kg/1000/area:null;
    const goalRow=(state.nutritionGoals||[]).find(g=>String(g.lot_id)===String(lotId));
    const goal=goalRow?.target_t_ha==null?null:n(goalRow.target_t_ha);
    const water=Math.max(0,Math.min(100,n(x.occupancy)));
    const stressFactor=water>=65?1:water>=50?.97:water>=35?.90:water>=20?.80:.68;
    const potential=goal||actual;
    const protectedYield=potential==null?null:potential*stressFactor;
    const gap=potential==null?null:Math.max(0,potential-protectedYield);
    return {applicable:true,actual,goal,potential,stressFactor,protectedYield,gap,cuts:cuts.length};
  }

  function riskSignal(x,consumption){
    if(!x?.ready||x.occupancy==null)return {score:null,label:'Sin datos',tone:'neutral',why:'Faltan datos para evaluar riesgo.'};
    const water=n(x.occupancy),conf=n(x.confidence),use=n(consumption?.avg7);
    let score=Math.max(0,Math.min(100,(60-water)*1.7 + Math.max(0,80-conf)*.5 + Math.max(0,use-5)*3));
    if(String(x.status).startsWith('Regar hoy'))score=Math.max(score,82);
    else if(String(x.status).startsWith('Regar en 24'))score=Math.max(score,62);
    const label=score>=75?'Alto':score>=45?'Medio':'Bajo';
    const tone=score>=75?'red':score>=45?'yellow':'green';
    const why=`${number(water,0)}% de agua disponible · consumo ${number(use,1)} mm/día · confianza ${number(conf,0)}%`;
    return {score,label,tone,why};
  }

  function calibrationSignal(x,lotId){
    const samples=recordsForLot(state.gravimetricSamples||[],lotId);
    const balances=recordsForLot(state.hydricDailyBalances||[],lotId);
    const irrigations=recordsForLot(state.irrigations||[],lotId);
    const evidence=samples.length+balances.length+irrigations.length;
    const level=evidence>=18?'Alta':evidence>=8?'Media':'Inicial';
    const pct=Math.min(100,Math.round(35+Math.min(65,evidence*3.2)));
    return {evidence,level,pct,samples:samples.length,balances:balances.length,irrigations:irrigations.length};
  }

  function valveTwinModal(lotId){
    const x=hydricState.getValve?.(lotId)||(hydricState.getRows?.()||[]).find(row=>String(row?.lot?.id)===String(lotId));
    if(!x)return;
    const area=lotArea(x), sat=satelliteValues(x), tone=statusTone(x);
    const irrigations=recordsForLot(state.irrigations,lotId).sort((a,b)=>String(eventDate(b)).localeCompare(String(eventDate(a))));
    const samples=recordsForLot(state.gravimetricSamples,lotId).sort((a,b)=>String(eventDate(b)).localeCompare(String(eventDate(a))));
    const satellite=recordsForLot(state.satelliteObservations,lotId).sort((a,b)=>String(eventDate(b)).localeCompare(String(eventDate(a))));
    const observations=recordsForLot(state.fieldObservations||state.precisionObservations||[],lotId).sort((a,b)=>String(eventDate(b)).localeCompare(String(eventDate(a))));
    const events=[
      ...irrigations.slice(0,6).map(r=>({date:eventDate(r),icon:'💧',type:'Riego',title:`${number(r.applied_mm??r.irrigation_mm??r.water_mm??r.depth_mm,1)} mm aplicados`,detail:r.duration_hours?`${number(r.duration_hours,1)} h de duración`:r.notes||'Registro de riego'})),
      ...samples.slice(0,6).map(r=>({date:eventDate(r),icon:'🧪',type:'Muestreo',title:`Humedad ${number(r.gravimetric_moisture_pct??r.moisture_pct??r.water_content_pct,1)}%`,detail:`Profundidad ${r.depth_from_cm??0}–${r.depth_to_cm??30} cm`})),
      ...satellite.slice(0,5).map(r=>({date:eventDate(r),icon:'🛰️',type:'Satélite',title:`NDVI ${number(r.ndvi_mean??r.ndvi,3)}`,detail:`NDRE ${number(r.ndre_mean??r.ndre,3)} · NDMI ${number(r.ndmi_mean??r.ndmi,3)}`})),
      ...observations.slice(0,4).map(r=>({date:eventDate(r),icon:'📍',type:'Observación',title:r.title||r.growth_stage||'Recorrida de campo',detail:r.notes||r.observations||'Sin observaciones'}))
    ].filter(e=>e.date).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,12);
    const eventTone=e=>e.type==='Riego'?'water':e.type==='Muestreo'?'sample':e.type==='Satélite'?'satellite':'field';
    const history=events.length?events.map(e=>`<article class="v92-event ${eventTone(e)}"><i>${e.icon}</i><div><span>${esc(e.type)}</span><b>${esc(e.title)}</b><small>${esc(e.detail)}</small></div><time>${esc(formatDate(e.date))}</time></article>`).join(''):'<p class="muted">Todavía no hay eventos históricos para esta válvula.</p>';
    const forecast=[1,2,3,5,7].map(days=>{const projected=simulate(x,days,0);if(!projected)return '';const d=new Date(Date.now()+days*86400000);const label=new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short'}).format(d).replace('.','');return `<div><span>${label}</span><b>${number(projected.projectedPct,0)}%</b><small>${esc(projected.projectedStatus)}</small></div>`}).join('');
    const water=x?.occupancy==null?0:Math.max(0,Math.min(100,n(x.occupancy)));
    const volume=n(x.application)*area*10;
    const canonicalWhy=hydricState.explain?.(lotId)||{text:'Sin explicación disponible.',history:[]};
    const rawCanonicalHistory=(canonicalWhy.history||[]);
    const isLegacyNoise=h=>{
      const prev=h?.previousOccupancy==null?null:Number(h.previousOccupancy),next=h?.occupancy==null?null:Number(h.occupancy);
      const sources=(h?.sources||[]).map(v=>String(v).toLowerCase());
      const statusSame=String(h?.status||'')===String(h?.previousStatus||'');
      if(prev!=null&&next!=null&&Math.abs(next-prev)<0.5&&statusSame)return true;
      const onlySoft=sources.length&&sources.every(v=>/et|sat|recalculo|mismas fuentes|balance/.test(v));
      const resetBounce=onlySoft&&prev!=null&&next!=null&&((next===0&&prev>=15)||(prev===0&&next>=15));
      if(resetBounce)return true;
      if(prev===0&&next===0)return true;
      return false;
    };
    const hiddenLegacy=rawCanonicalHistory.filter(isLegacyNoise).length;
    const canonicalHistory=rawCanonicalHistory.filter(h=>!isLegacyNoise(h)).slice(-8).reverse();
    const eventClass=h=>{const src=(h?.sources||[]).join(' ').toLowerCase();return /muestra|riego|lluvia|observación de campo/.test(src)?'Dato observado':/satélite|multiespectral/.test(src)?'Dato remoto':'Recalculo del balance'};
    const changeRows=canonicalHistory.length?canonicalHistory.map(h=>`<article><i>↕</i><div><span>${esc(eventClass(h))}</span><b>${h.previousOccupancy==null?'Primer cálculo':`${number(h.previousOccupancy,0)}% → ${number(h.occupancy,0)}%`}</b><small>${esc(h.reasonLabel||h.reason||'Recalculo canónico')}</small></div><time>${new Date(h.at).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</time></article>`).join(''):'<p class="muted">Todavía no hay cambios canónicos útiles registrados para esta válvula.</p>';
    const balance=hydricBalanceSeries(x,lotId);
    const balanceBars=balance.rows.map(r=>`<div><span style="height:${Math.max(4,Math.min(100,n(r.pct)))}%"></span><b>${r.pct==null?'—':number(r.pct,0)+'%'}</b><small>${formatDate(r.date).slice(0,5)}</small></div>`).join('');
    const consumption=consumptionMetrics(x,lotId);
    const risk=riskSignal(x,consumption);
    const prod=productionSignal(x,lotId);
    const calibration=calibrationSignal(x,lotId);
    const hydricMeta=hydricState.getState?.()||{};
    const lastCanonical=canonicalHistory[0]||null;
    const reasonSources=(lastCanonical?.sources||x?.canonical?.reason?.sources||[]).filter(Boolean);
    const sourceSummary=reasonSources.length?reasonSources.join(' · '):'Motor hídrico canónico';
    const profile=x?.p||{};
    const fieldCapacity=profile.field_capacity_pct;
    const wiltingPoint=profile.wilting_point_pct;
    const bulkDensity=profile.bulk_density_default;
    const rootDepth=profile.root_depth_cm??x?.st?.depth;
    const profileCapacity=profile.profile_capacity_mm??x?.st?.capacity;
    const scenarioMm=[20,30,45].filter((v,i,a)=>a.indexOf(v)===i);
    if(x.application>0&&!scenarioMm.includes(Math.round(n(x.application))))scenarioMm.splice(2,0,Math.round(n(x.application)));
    const scenarios=scenarioMm.map(mm=>irrigationScenario(x,mm)).filter(Boolean);
    const scenarioCards=scenarios.map(sc=>{const scenarioVolume=sc.mm*area*10;const scenarioHours=x.application>0&&x.hours!=null?sc.mm*(n(x.hours)/n(x.application)):null;return `<article class="v91-sim-card ${sc.pct<45?'bad':sc.pct<65?'warn':'good'}"><small>APLICAR</small><b>${number(sc.mm,0)} mm</b><strong>${number(sc.pct,0)}%</strong><span>${esc(sc.label)}</span><em>${number(scenarioVolume,0)} m³${scenarioHours==null?'':` · ${number(scenarioHours,1)} h`} · ${sc.autonomy} días hasta 50%</em></article>`}).join('');
    openModal(`<section class="v75-twin ${tone}">
      <header class="v75-twin-head v92-head"><div><p class="eyebrow">RELEASE CANDIDATE · CENTRO HÍDRICO PRODUCTIVO · V92</p><h2>${esc(valveName(x))}</h2><p>${esc(cropName(x))} · ${number(area,1)} ha · ${esc(x?.valve?.valve_code||x?.p?.valve_code||'Sector')}</p><div class="v92-head-meta"><span>Actualizado <b>${hydricMeta.updatedAt?new Date(hydricMeta.updatedAt).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'pendiente'}</b></span><span>Motor <b>rev ${hydricMeta.revision||0}</b></span><span>Confianza <b>${number(x.confidence,0)}%</b></span><span>Estado <b>${hydricMeta.audit?.ok?'Sin errores':'Revisar'}</b></span></div></div><div class="v75-twin-dial" style="--water:${water}"><span><b>${x.occupancy==null?'—':number(x.occupancy,0)+'%'}</b><small>agua disponible</small><em>Óptimo 70%</em></span></div></header>
      <div class="v75-decision ${tone}"><div><small>DECISIÓN CANÓNICA</small><b>${esc(x.ready?x.status:'Datos incompletos')}</b><span>${esc(x.instruction||'Completá los datos para calcular la recomendación.')}</span></div><div><small>LÁMINA</small><b>${x.application?number(x.application,1)+' mm':'—'}</b></div><div><small>VOLUMEN</small><b>${volume?number(volume,0)+' m³':'—'}</b></div><div><small>TIEMPO</small><b>${x.hours==null?'Pendiente':number(x.hours,1)+' h'}</b></div></div>
      <section class="v75-panel v75-explanation v92-explain"><div class="panel-title"><div><p class="eyebrow">EXPLICABILIDAD · MOTOR ÚNICO</p><h3>Por qué muestra este porcentaje</h3></div><span class="pill">${x.canonical?.stabilized?'Valor protegido':'Dato canónico'}</span></div><p>${esc(canonicalWhy.text)}</p><div class="v92-explain-grid"><div><small>Fuente causal registrada</small><b>${esc(sourceSummary)}</b></div><div><small>Última variación útil</small><b>${lastCanonical?.previousOccupancy==null?'Primer cálculo':`${number(lastCanonical.previousOccupancy,0)}% → ${number(lastCanonical.occupancy,0)}%`}</b></div><div><small>Confianza actual</small><b>${number(x.confidence,0)}%</b></div></div><small class="muted">No se inventan contribuciones parciales: sólo se muestran causas registradas por el motor. Inicio, Riego e Inteligencia usan este mismo valor canónico.</small></section>
      <div class="v75-tabs">
        <section class="v75-panel"><h3>Estado técnico actual</h3><div class="v92-tech-grid"><div><small>Humedad 0–30</small><b>${esc(layerValue(x?.st?.s1))}</b></div><div><small>Humedad 30–60</small><b>${esc(layerValue(x?.st?.s2))}</b></div><div><small>Capacidad de campo</small><b>${fieldCapacity==null?'Pendiente':number(fieldCapacity,1)+'%'}</b></div><div><small>Punto de marchitez</small><b>${wiltingPoint==null?'Pendiente':number(wiltingPoint,1)+'%'}</b></div><div><small>Densidad aparente</small><b>${bulkDensity==null?'Pendiente':number(bulkDensity,2)+' g/cm³'}</b></div><div><small>Profundidad radicular</small><b>${rootDepth==null?'Pendiente':number(rootDepth,0)+' cm'}</b></div><div><small>Capacidad perfil activo</small><b>${profileCapacity==null?'—':number(profileCapacity,1)+' mm'}</b></div><div><small>Déficit</small><b>${x.deficit==null?'—':number(x.deficit,1)+' mm'}</b></div><div><small>ET₀ diaria / ETc acumulada del ciclo</small><b>${number(x.etoDay,1)} mm/día / ${number(x.etc,1)} mm</b></div><div><small>Lluvia útil</small><b>${number(x.effectiveRain,1)} mm</b></div><div><small>Confianza</small><b>${number(x.confidence,0)}%</b></div><div><small>NDVI / NDRE</small><b>${sat.ndvi==null?'—':number(sat.ndvi,3)} / ${sat.ndre==null?'—':number(sat.ndre,3)}</b></div></div></section>
        <section class="v75-panel"><h3>Predicción sin lluvia</h3><div class="v75-forecast">${forecast||'<p class="muted">Faltan datos para proyectar.</p>'}</div><p class="v75-note">La proyección utiliza el mismo motor hídrico canónico que alimenta Inicio, Riego e Inteligencia. No crea un porcentaje paralelo.</p></section>
      </div>
      <section class="v91-command-grid">
        <article class="v75-panel"><div class="panel-title"><div><p class="eyebrow">BALANCE HÍDRICO DIARIO</p><h3>Evolución de los últimos 7 días</h3></div><span class="pill">${balance.kind==='real'?'Datos registrados':balance.kind==='estimated'?'Reconstrucción estimada':'Sin datos'}</span></div><div class="v91-water-chart">${balanceBars||'<p class="muted">Faltan datos para construir la curva.</p>'}</div></article>
        <article class="v75-panel"><div class="panel-title"><div><p class="eyebrow">CONSUMO DEL CULTIVO</p><h3>Demanda hídrica</h3></div><span class="pill">ETc</span></div><div class="v91-mini-kpis"><div><small>ETc diaria estimada</small><b>${number(consumption.current,1)} mm/día</b></div><div><small>ETc promedio 7 días</small><b>${number(consumption.avg7,1)} mm/día</b></div><div><small>Desde último corte</small><b>${consumption.cycle==null?'—':number(consumption.cycle,0)+' mm'}</b></div><div><small>Días del ciclo</small><b>${consumption.days==null?'—':consumption.days}</b></div></div></article>
      </section>
      <section class="v91-command-grid">
        <article class="v75-panel"><div class="panel-title"><div><p class="eyebrow">IA DE RIESGO OPERATIVO</p><h3>Riesgo hídrico actual</h3></div><span class="v91-risk ${risk.tone}">${risk.score==null?'—':number(risk.score,0)} · ${esc(risk.label)}</span></div><p class="v91-risk-copy">${esc(risk.why)}</p><small class="muted">Índice orientativo: combina agua disponible, demanda, confianza y decisión canónica. No reemplaza el motor hídrico protegido.</small></article>
        <article class="v75-panel"><div class="panel-title"><div><p class="eyebrow">APRENDIZAJE Y CALIBRACIÓN</p><h3>Calidad del modelo por válvula</h3></div><span class="pill">${esc(calibration.level)}</span></div><div class="v91-calibration"><div><span style="width:${calibration.pct}%"></span></div><b>${calibration.pct}% de base observacional</b><small>${calibration.samples} muestreos · ${calibration.balances} balances · ${calibration.irrigations} riegos. La precisión mejora al sumar observaciones reales.</small></div></article>
      </section>
      <section class="v75-panel"><div class="panel-title"><div><p class="eyebrow">SIMULADOR DE RIEGO</p><h3>¿Qué pasa si aplico una lámina hoy?</h3></div><span class="pill">Eficiencia supuesta 90%</span></div><div class="v91-simulator">${scenarioCards||'<p class="muted">Faltan datos para simular.</p>'}</div><p class="v75-note">El resultado se calcula sobre el agua actual y la capacidad del perfil. Es una simulación; la decisión operativa sigue siendo la canónica.</p></section>
      ${prod.applicable?`<section class="v75-panel"><div class="panel-title"><div><p class="eyebrow">IMPACTO PRODUCTIVO · ALFALFA</p><h3>Agua y objetivo de producción</h3></div><span class="pill">${prod.goal?`Objetivo ${number(prod.goal,1)} t/ha`:'Objetivo productivo pendiente'}</span></div>${prod.goal||prod.actual?`<div class="v91-production"><div><small>Producción registrada año</small><b>${prod.actual==null?'Sin cortes cargados':number(prod.actual,1)+' t/ha'}</b></div><div><small>Factor hídrico actual</small><b>${number(prod.stressFactor*100,0)}%</b></div><div><small>Producción protegida estimada</small><b>${prod.protectedYield==null?'Pendiente':number(prod.protectedYield,1)+' t/ha'}</b></div><div><small>Brecha hídrica potencial</small><b>${prod.gap==null?'Pendiente':number(prod.gap,1)+' t/ha'}</b></div></div><p class="v75-note">La brecha es una señal orientativa basada en disponibilidad de agua y objetivo/producción registrada. Para convertirla en pronóstico de rendimiento se requiere calibración con cortes reales.</p>`:`<div class="v91-production v92-production-empty"><div><small>Estado</small><b>Falta objetivo de producción</b></div><div><small>Factor hídrico actual</small><b>${number(prod.stressFactor*100,0)}%</b></div></div><p class="v75-note">Definí el objetivo en t/ha y cargá los cortes reales para habilitar producción protegida, brecha hídrica y seguimiento productivo.</p>`}</section>`:''}
      <section class="v75-panel"><div class="panel-title"><div><h3>Historial integrado</h3><p class="muted">Riegos, muestreos, satélite y observaciones del mismo lote.</p></div><span class="pill">${events.length} eventos recientes</span>${syncBadge()}</div><div class="v75-timeline">${history}</div></section>
      <section class="v75-panel"><div class="panel-title"><div><h3>Historial hídrico auditado</h3><p class="muted">Sólo muestra cambios reales del porcentaje o de la decisión; conserva el historial técnico original sin borrarlo.</p></div><span class="pill">${canonicalHistory.length} cambios útiles${hiddenLegacy?` · ${hiddenLegacy} legado oculto`:''}</span></div><div class="v75-timeline">${changeRows}</div><p class="v75-note">Los eventos sin variación real y los rebotes heredados de versiones anteriores quedan fuera de esta vista. Muestras, riegos, lluvia y satélite siguen visibles en el Historial integrado.</p></section>
      <footer class="v75-actions"><button class="primary v75GoHydric">Abrir inteligencia hídrica</button><button class="secondary v75GoSatellite">Abrir imágenes satelitales</button><button class="secondary v75GoFieldBook">Abrir gemelo del lote</button></footer>
    </section>`);
    document.querySelector('.v75GoHydric')?.addEventListener('click',()=>setPage('hydric-intelligence'));
    document.querySelector('.v75GoSatellite')?.addEventListener('click',()=>setPage('satellite'));
    document.querySelector('.v75GoFieldBook')?.addEventListener('click',()=>setPage('field-book'));
  }

  function valveDetailCard(x){
    const tone=statusTone(x);
    const area=lotArea(x);
    const sat=satelliteValues(x);
    const s1=x?.st?.s1, s2=x?.st?.s2;
    const reserve=x?.st?.deepWater??x?.st?.reserve??x?.st?.deepReserve;
    const status=x?.ready?String(x.status||'Sin decisión'):'Datos incompletos';
    const application=x?.application>0?`${number(x.application,1)} mm`:(x?.refillNeed>0?`Reposición futura ${number(x.refillNeed,1)} mm`:'Sin lámina');
    const volume=x?.application>0&&area>0?`${number(x.application*area*10,0)} m³`:'—';
    const duration=x?.hours!=null?`${number(x.hours,1)} h`:'Pendiente';
    const lastIrr=x?.lastIrr;
    const lastIrrDate=day(lastIrr?.event_date||lastIrr?.irrigation_date||lastIrr?.created_at)||'Sin registro';
    const lastSample=day(x?.lastSample?.sample_date||x?.lastSample?.created_at)||'Sin dato';
    const confidence=n(x?.confidence);
    const occupancy=x?.occupancy==null?'—':`${number(x.occupancy,0)}%`;
    const occupancyNum=x?.occupancy==null?0:Math.max(0,Math.min(100,n(x.occupancy)));
    return `<article class="v642-valve-card ${tone}">
      <button class="v642-card-head premiumHydricClock" data-lot="${esc(x?.lot?.id||'')}">
        <div><small>${esc(x?.valve?.valve_code||x?.p?.valve_code||'SECTOR')}</small><h3>${esc(valveName(x))}</h3><p>${esc(cropName(x))} · ${number(area,1)} ha</p></div>
        <div class="v642-dial" style="--water:${occupancyNum}"><span><b>${occupancy}</b><small>agua</small></span></div>
      </button>
      <div class="v642-decision"><div><small>DECISIÓN</small><strong>${esc(status)}</strong></div><div><small>LÁMINA</small><b>${esc(application)}</b></div><div><small>VOLUMEN</small><b>${esc(volume)}</b></div><div><small>TIEMPO</small><b>${esc(duration)}</b></div></div>
      <div class="v642-data-grid">
        <div><small>Último riego</small><b>${esc(lastIrrDate)}</b></div><div><small>Último muestreo</small><b>${esc(lastSample)}</b></div>
        <div><small>Humedad 0–30 cm</small><b>${esc(layerValue(s1))}</b></div><div><small>Humedad 30–60 cm</small><b>${esc(layerValue(s2))}</b></div>
        <div><small>Reserva profunda</small><b>${reserve==null?'Calculada':`${number(reserve,1)} mm`}</b></div><div><small>Confianza</small><b>${confidence?`${number(confidence,0)}%`:'Sin calcular'}</b></div>
        <div><small>ET₀ diaria / ETc acumulada</small><b>${number(x?.etoDay,1)} mm/día / ${number(x?.etc,1)} mm</b></div><div><small>Lluvia útil</small><b>${number(x?.effectiveRain,1)} mm</b></div>
      </div>
      <div class="v642-satellite"><div><small>Satélite ${esc(sat.date)}</small><b>NDVI ${sat.ndvi==null?'—':number(sat.ndvi,3)}</b></div><span>NDRE ${sat.ndre==null?'—':number(sat.ndre,3)}</span><span>MSAVI ${sat.msavi==null?'—':number(sat.msavi,3)}</span><span>NDMI ${sat.ndmi==null?'—':number(sat.ndmi,3)}</span></div>
      <div class="v75-card-gate ${x?.decision?.ready?'ok':'warn'}"><b>${esc(x?.decision?.label||'VERIFICAR ANTES DE ACTUAR')}</b>${x?.decision?.blockers?.length?`<small>${esc(x.decision.blockers.join(' · '))}</small>`:''}</div><p class="v642-instruction">${esc(x?.instruction||'Cargá los datos faltantes para habilitar una recomendación calibrada.')}</p>
      <div class="v642-card-actions"><button class="primary premiumHydricClock" data-lot="${esc(x?.lot?.id||'')}">Abrir detalle completo</button><button class="secondary quickNav" data-page="satellite">Ver imágenes</button><button class="secondary quickNav" data-page="weather">Ver clima</button></div>
    </article>`;
  }

  function commandMapData(rows){
    return [...rows].sort((a,b)=>{
      const av=String(a?.valve?.valve_code||a?.p?.valve_code||a?.lot?.name||'');
      const bv=String(b?.valve?.valve_code||b?.p?.valve_code||b?.lot?.name||'');
      return av.localeCompare(bv,undefined,{numeric:true});
    }).map((x,index)=>{
      const sat=satelliteValues(x);
      const area=lotArea(x);
      const status=x?.ready?String(x.status||'Sin decisión'):'Datos incompletos';
      return {
        id:String(x?.lot?.id||''),code:String(x?.valve?.valve_code||x?.p?.valve_code||`V-${index+1}`),name:valveName(x),crop:cropName(x),area,
        occupancy:x?.occupancy==null?null:n(x.occupancy),tone:statusTone(x),status,application:n(x?.application),hours:x?.hours==null?null:n(x.hours),
        volume:n(x?.application)*area*10,confidence:n(x?.confidence),ndvi:sat.ndvi,date:sat.date,instruction:String(x?.instruction||'Faltan datos para completar la recomendación.'),
        eto:n(x?.etoDay),etc:n(x?.etc),rain:n(x?.effectiveRain),irrigation:n(x?.effectiveIrrigation),sampleDate:day(x?.lastSample?.sample_date||x?.lastSample?.created_at)||'Sin muestra',sampleAge:x?.sampleAge!=null&&x.sampleAge<999?Math.round(x.sampleAge):null,waterMode:x?.occupancySource==='balance_integrado'?'MEDIDO + BALANCE':x?.fallbackProjected?'ESTIMADO · respaldo proyectado':'ESTIMADO',waterSource:String(x?.occupancySource||'sin fuente'),decisionReady:Boolean(x?.decision?.ready),decisionLabel:String(x?.decision?.label||'VERIFICAR ANTES DE ACTUAR'),decisionBlockers:(x?.decision?.blockers||[]),decisionWarnings:(x?.decision?.warnings||[]),frozenAudit:x?.frozenAudit||{flag:false,label:'Sin evidencia de congelamiento'}
      };
    });
  }


  function auditActions(x){
    const issues=[...(x.decisionBlockers||[]),...(x.decisionWarnings||[])];
    const actions=[];
    const has=(needle)=>issues.some(v=>String(v).toLowerCase().includes(needle));
    if(has('balance preventivo')||has('balance integrado')||String(x.waterSource)!=='balance_integrado')actions.push('Completar/calibrar balance hídrico integrado');
    if(has('muestra'))actions.push('Cargar nueva muestra gravimétrica de suelo');
    if(has('et₀'))actions.push('Verificar estación meteorológica o ET₀ diaria');
    if(has('confianza baja')||has('confianza moderada')||has('confianza sin'))actions.push('Mejorar cobertura de datos para elevar la confianza a ≥80%');
    if(has('lámina exacta'))actions.push('Definir lámina de riego');
    if(has('tasa/caudal'))actions.push('Calibrar caudal/tasa real de la válvula');
    if(has('duración exacta'))actions.push('Calcular duración con lámina y caudal verificados');
    if(x.frozenAudit?.flag)actions.push('Revisar historial: posible porcentaje congelado');
    if(!actions.length&&!x.decisionReady)actions.push('Revisar fuentes faltantes antes de actuar');
    return [...new Set(actions)];
  }

  function calibrationBreakdown(x){
    const issues=[...(x.decisionBlockers||[]),...(x.decisionWarnings||[])].map(v=>String(v).toLowerCase());
    const parts=[];
    const add=(label,ok,impact,action)=>parts.push({label,ok,impact,action});
    add('Balance hídrico',x.waterSource==='balance_integrado',x.waterSource==='balance_integrado'?0:8,'Completar/calibrar balance integrado');
    add('Muestra vigente',x.sampleAge!=null&&x.sampleAge<=15,x.sampleAge!=null&&x.sampleAge<=15?0:6,'Cargar nueva muestra gravimétrica');
    add('ET₀ diaria',n(x.eto)>0,n(x.eto)>0?0:5,'Verificar estación/ET₀');
    const hasFlow=!(issues.some(v=>v.includes('tasa/caudal')));
    add('Caudal/tasa',hasFlow,hasFlow?0:5,'Calibrar caudal/tasa real');
    const hasDuration=!(issues.some(v=>v.includes('duración exacta')));
    add('Duración',hasDuration,hasDuration?0:4,'Calcular duración con lámina y caudal');
    const gap=Math.max(0,80-n(x.confidence));
    if(gap>0)parts.push({label:'Cobertura/confianza',ok:false,impact:gap,action:`Elevar confianza ${gap} punto${gap===1?'':'s'} hasta 80%`});
    return parts;
  }
  function calibrationPriority(x){
    const status=String(x.status||'').toLowerCase();
    if(status.includes('regar hoy')||x.tone==='red')return 0;
    if(status.includes('vigilar')||x.tone==='yellow')return 1;
    return 2;
  }
  function calibrationCenter(summary){
    const rows=commandMapData(summary.rows);
    const pending=rows.filter(x=>!x.decisionReady).sort((a,b)=>calibrationPriority(a)-calibrationPriority(b)||n(a.confidence)-n(b.confidence));
    const enabled=rows.filter(x=>x.decisionReady).length;
    const priority=pending[0];
    const cards=pending.map((x,i)=>{
      const parts=calibrationBreakdown(x), missing=parts.filter(p=>!p.ok), projected=Math.min(100,n(x.confidence)+missing.reduce((s,p)=>s+n(p.impact),0));
      const pr=calibrationPriority(x)===0?'URGENTE · REVISAR RIEGO':calibrationPriority(x)===1?'PRIORIDAD MEDIA · VIGILAR':'CALIBRACIÓN';
      return `<article class="v926-cal-card ${calibrationPriority(x)===0?'urgent':calibrationPriority(x)===1?'watch':''}"><div class="v926-cal-head"><div><small>#${i+1} · ${pr}</small><b>${esc(x.code)} · ${esc(x.name)}</b></div><strong>${number(x.confidence,0)}%</strong></div><div class="v926-cal-bars">${parts.map(p=>`<div class="${p.ok?'ok':'miss'}"><span>${p.ok?'✓':'!'} ${esc(p.label)}</span><em>${p.ok?'OK':`hasta +${number(p.impact,0)} pt`}</em></div>`).join('')}</div><p><b>Acción:</b> ${missing.length?esc(missing.map(p=>p.action).join(' → ')):'Sin acciones pendientes.'}</p><div class="v926-cal-foot"><span>Actual ${number(x.confidence,0)}%</span><span>Umbral 80%</span><span>Potencial tras corregir ≤ ${number(projected,0)}%</span></div></article>`;
    }).join('');
    return `<section class="v926-calibration"><div class="panel-title"><div><p class="eyebrow">CENTRO DE CALIBRACIÓN HÍDRICA · v92.2.6</p><h3>Cómo llevar las decisiones a 13/13 reales</h3><p class="muted">Descompone la confianza por fuente y prioriza primero los sectores que requieren riego. No modifica ni fuerza el motor hídrico.</p></div><span class="pill">${enabled}/13 habilitadas · ${pending.length} pendientes</span></div>${priority?`<div class="v926-priority"><b>Primero revisar ${esc(priority.code)} · ${esc(priority.name)}</b><span>${esc(priority.status)} · confianza ${number(priority.confidence,0)}% · faltan ${Math.max(0,80-n(priority.confidence))} pt para el umbral</span></div>`:''}<div class="v926-cal-grid">${cards||'<div class="v926-all-ok"><b>13/13 habilitadas</b><span>No hay calibraciones pendientes.</span></div>'}</div></section>`;
  }

  function commandCenter(summary,weather,forecastRain){
    const rows=commandMapData(summary.rows);
    const selected=rows.find(x=>x.tone==='red')||rows.find(x=>x.tone==='yellow')||rows[0]||null;
    const markers=rows.map((x,i)=>`<button class="v65-marker ${x.tone}" data-v65-index="${i}" aria-label="${esc(x.name)}"><span>${esc(x.code)}</span><b>${x.occupancy==null?'—':number(x.occupancy,0)+'%'}</b><small>${esc(x.status)}</small></button>`).join('');
    const payload=esc(JSON.stringify(rows));
    return `<section class="v65-command" data-valves='${payload}'>
      <div class="v65-command-head"><div><p class="eyebrow">CENTRO DE COMANDO HÍDRICO · ACTUALIZACIÓN EN VIVO</p><h2>Las 13 válvulas sobre el establecimiento</h2><p>Cada marcador combina suelo, riegos, lluvias, clima, balance e imagen satelital.</p></div><div class="v65-head-actions"><button class="secondary quickNav" data-page="map">Mapa geográfico</button><button class="secondary quickNav" data-page="satellite">Imágenes satelitales</button></div></div>
      <div class="v65-command-grid">
        <div class="v65-field-wrap">
          <div class="v65-weather-strip"><span>🌦 ${esc(weather)}</span><span>🌧 ${number(forecastRain,1)} mm / 7 días</span><span>🛰 Satélite integrado</span></div>
          <div class="v65-field-map"><div class="v65-field-lines"></div>${markers}</div>
          <div class="v65-legend"><span><i class="red"></i>Regar</span><span><i class="yellow"></i>Vigilar</span><span><i class="green"></i>Sin riego</span><span><i class="neutral"></i>Incompleto</span></div>
        </div>
        <aside class="v65-focus" id="v65Focus">${selected?`<p class="eyebrow">VÁLVULA SELECCIONADA</p><div class="v65-focus-title"><div><small>${esc(selected.code)}</small><h3>${esc(selected.name)}</h3><p>${esc(selected.crop)} · ${number(selected.area,1)} ha</p></div><div class="v65-focus-dial ${selected.tone}"><b>${selected.occupancy==null?'—':number(selected.occupancy,0)+'%'}</b><small>agua</small></div></div><div class="v75-decision-gate ${selected.decisionReady?'ok':'warn'}">${esc(selected.decisionLabel)}</div><div class="v65-focus-decision ${selected.tone}">${esc(selected.status)}</div><div class="v65-focus-grid"><div><small>Lámina</small><b>${selected.application?number(selected.application,1)+' mm':'—'}</b></div><div><small>Volumen</small><b>${selected.volume?number(selected.volume,0)+' m³':'—'}</b></div><div><small>Tiempo</small><b>${selected.hours==null?'Pendiente':number(selected.hours,1)+' h'}</b></div><div><small>Confianza</small><b>${selected.confidence?number(selected.confidence,0)+'%':'—'}</b></div><div><small>NDVI</small><b>${selected.ndvi==null?'—':number(selected.ndvi,3)}</b></div><div><small>Satélite</small><b>${esc(selected.date)}</b></div><div><small>Modo hídrico</small><b>${esc(selected.waterMode)}</b></div><div><small>Última muestra</small><b>${esc(selected.sampleDate)}${selected.sampleAge!=null?` · ${selected.sampleAge} d`:''}</b></div><div><small>ET₀ diaria / ETc acumulada</small><b>${number(selected.eto,1)} mm/día / ${number(selected.etc,1)} mm</b></div><div><small>Aportes desde muestra</small><b>Riego ${number(selected.irrigation,1)} · Lluvia ${number(selected.rain,1)} mm</b></div></div><p class="v65-focus-text">${esc(selected.instruction)}</p><button class="primary premiumHydricClock" data-lot="${esc(selected.id)}">Abrir detalle completo</button>`:'<p>Sin válvulas disponibles.</p>'}</aside>
      </div>
    </section>`;
  }

  function renderPage(){
    const company=state.companies.find(c=>c.id===state.companyId);
    const lots=state.lots.filter(l=>String(l.status||'Activo').toLowerCase()!=='archivado');
    const summary=hydricSummary(lots);
    const conf=confidence();
    const economic=economicRanking(summary.valid);
    const current=state.weather?.current;
    const weather=current?`${weatherText(current.weather_code)} · ${number(current.temperature_2m,1)} °C · viento ${number(current.wind_speed_10m)} km/h`:'Clima pendiente';
    const forecastRain=(state.weather?.daily?.precipitation_sum||[]).slice(0,7).reduce((s,v)=>s+n(v),0);
    const aiAdvice=lmAiText(summary,forecastRain);
    const simTarget=summary.worst||summary.valid[0]||null;
    const sim1=simulate(simTarget,1,forecastRain),sim2=simulate(simTarget,2,forecastRain),sim3=simulate(simTarget,3,forecastRain),sim5=simulate(simTarget,5,forecastRain);
    const latestStation=latestByDate(state.weatherStationObservations,['observed_at','observation_date']);
    const latestSat=latestByDate(state.satelliteObservations,['observed_from','observation_date']);
    const latestSample=latestByDate(state.gravimetricSamples,['sample_date','created_at']);
    const name=(state.membership?.full_name||state.session?.user?.user_metadata?.full_name||'Franco').split(' ')[0];
    const worstPct=summary.worst?n(summary.worst.occupancy):null;
    const worstLot=summary.worst?.lot||null;
    const explanation=summary.urgent.length
      ?`La prioridad es ${worstLot?.name||summary.worst?.valve?.valve_code||'el sector crítico'}, con ${number(worstPct,0)}% de agua disponible. La lluvia prevista es ${number(forecastRain,1)} mm en 7 días; confirmá la lámina en el detalle antes de iniciar.`
      :summary.watch.length
      ?`Hay ${summary.watch.length} sector(es) cerca del umbral. Con ${number(forecastRain,1)} mm previstos, conviene revisar nuevamente dentro de 24 horas.`
      :`Los sectores calculados permanecen por encima del umbral de riego. Continuá registrando lluvia, riego y muestreos para mantener la recomendación actualizada.`;
    const signal=(label,value,ok)=>`<div class="v62-signal ${ok?'online':'offline'}"><i></i><span>${label}</span><b>${esc(value)}</b></div>`;
    const sourceRows=conf.sources.map(([label,ok,w])=>`<div class="v62-source"><span>${label}</span><div><i style="width:${ok?w:0}%"></i></div><b>${ok?`${w}%`:'Falta'}</b></div>`).join('');

    return `<div class="premium-home v62-home">
      <section class="v62-topbar">
        <div><span class="v62-brand-dot"></span><b>${esc(company?.name||'LA MAGDALENA')}</b><small>Centro de comando hídrico</small></div>
        <div class="v62-live">${signal('Satélite',latestSat?day(latestSat.observed_from||latestSat.observation_date):'Sin dato',!!latestSat)}${signal('Estación',latestStation?day(latestStation.observed_at||latestStation.observation_date):'Respaldo',!!latestStation)}${signal('Válvulas',`${summary.valid.length}/${lots.length||13}`,summary.valid.length>0)}</div>
      </section>

      ${commandCenter(summary,weather,forecastRain)}

      ${calibrationCenter(summary)}
      <section class="v923-auditor"><div class="panel-title"><div><p class="eyebrow">AUDITOR HÍDRICO 13/13 · v92.2.6</p><h3>Qué falta en cada válvula y cómo habilitarla</h3><p class="muted">Muestra la causa exacta de cada estado provisional y la acción necesaria. No fuerza decisiones: sólo habilita cuando los datos cumplen los controles.</p></div><span class="pill">${summary.valid.filter(x=>x?.decision?.ready).length} habilitadas · ${summary.valid.filter(x=>!x?.decision?.ready).length} provisionales</span></div><div class="v923-audit-grid">${commandMapData(summary.rows).map(x=>{const issues=[...(x.decisionBlockers||[]),...(x.decisionWarnings||[])];const frozen=x.frozenAudit?.flag;const auditState=x.decisionReady?'HABILITADA':'PROVISIONAL';const actions=auditActions(x);return `<article class="v923-audit-card ${x.decisionReady?'ok':'warn'} ${frozen?'frozen':''}"><div><b>${esc(x.code)} · ${esc(x.name)}</b><span>${auditState}${frozen?' · ⚠ POSIBLE CONGELAMIENTO':''}</span></div><small class="v925-audit-line"><b>Diagnóstico:</b> ${issues.length?esc(issues.join(' · ')):'Controles operativos completos.'}</small>${actions.length?`<small class="v925-audit-action"><b>Para habilitar:</b> ${esc(actions.join(' → '))}</small>`:'<small class="v925-audit-action ok"><b>Estado:</b> lista para decisión operativa.</small>'}<div class="v925-audit-meta"><span>${esc(x.waterMode)}</span><span>Muestra: ${esc(x.sampleDate)}${x.sampleAge!=null?` · ${x.sampleAge} d`:''}</span><span>Conf. ${number(x.confidence,0)}%</span><span>ET₀ ${number(x.eto,1)} mm/d</span></div></article>`}).join('')}</div></section>
      <section class="v75-decision-strip"><div><small>MODO DECISIÓN</small><b>${summary.valid.filter(x=>x?.decision?.ready).length}/${summary.valid.length} válvulas habilitadas</b></div><p>Una recomendación sólo se considera operativa cuando tiene balance calibrado, muestra vigente, ET₀, confianza ≥80% y —si corresponde regar— lámina, caudal y duración verificables.</p></section>

      <section class="v642-valves-first">
        <div class="v642-heading"><div><p class="eyebrow">TODAS LAS VÁLVULAS · DATOS INTEGRADOS EN VIVO</p><h2>Estado individual de las ${lots.length} válvulas</h2><p>Lo primero que ves es cada válvula, con su propio reloj, decisión y detalle calculado con suelo, riegos, lluvias, clima y satélite.</p></div></div>
        <div class="v642-valve-grid">${[...summary.rows].sort((a,b)=>priorityValue(a)-priorityValue(b)||n(a.occupancy)-n(b.occupancy)).map(valveDetailCard).join('')}</div>
      </section>

      <section class="v62-three">
        <article class="v62-gauge-card"><small>AGUA DEL PERFIL</small><b>${summary.avg==null?'—':`${number(summary.avg,0)}%`}</b><p>Promedio de sectores calculados</p><div class="v62-mini-bar"><i style="width:${summary.avg||0}%"></i></div></article>
        <article class="v62-gauge-card"><small>CULTIVO / SATÉLITE</small><b>${latestSat?day(latestSat.observed_from||latestSat.observation_date):'—'}</b><p>${latestSat?'Última observación disponible':'Sin observación reciente'}</p><button class="text-link quickNav" data-page="satellite">Abrir inteligencia satelital →</button></article>
        <article class="v62-gauge-card"><small>CLIMA Y LLUVIA</small><b>${number(forecastRain,1)} mm</b><p>Pronóstico acumulado 7 días</p><button class="text-link quickNav" data-page="weather">Abrir centro meteorológico →</button></article>
      </section>

      <section class="v62-intelligence">
        <div class="panel"><div class="panel-title"><div><p class="eyebrow">EXPLICABILIDAD</p><h3>Por qué recomienda esto</h3></div><span class="pill">Confianza ${conf.score}%</span></div><p class="v62-ai-text">“${esc(aiAdvice)}”</p><div class="v62-sources">${sourceRows}</div></div>
        <div class="panel"><p class="eyebrow">CALIDAD DE DATOS</p><h3>Fuentes utilizadas</h3><div class="v62-data-list"><div><span>Último muestreo</span><b>${latestSample?day(latestSample.sample_date||latestSample.created_at):'Sin dato'}</b></div><div><span>Última estación</span><b>${latestStation?day(latestStation.observed_at||latestStation.observation_date):'Sin dato local'}</b></div><div><span>Último satélite</span><b>${latestSat?day(latestSat.observed_from||latestSat.observation_date):'Sin dato'}</b></div><div><span>Riegos cargados</span><b>${state.irrigations.length}</b></div></div></div>
      </section>

      <section class="v64-grid">
        <article class="panel v64-simulator"><div class="panel-title"><div><p class="eyebrow">SIMULADOR PREDICTIVO</p><h3>¿Qué pasa si espero?</h3></div><span class="pill">${esc(simTarget?.valve?.valve_code||simTarget?.lot?.name||'Sin sector')}</span></div>
          <div class="v64-sim-buttons"><button class="v64Sim active" data-days="1">1 día</button><button class="v64Sim" data-days="2">2 días</button><button class="v64Sim" data-days="3">3 días</button><button class="v64Sim" data-days="5">5 días</button></div>
          <div class="v64-sim-result" id="v64SimResult" data-sim='${esc(JSON.stringify({1:sim1,2:sim2,3:sim3,5:sim5}))}'>${sim1?`<b>${number(sim1.projectedPct,0)}%</b><span>Disponibilidad proyectada mañana</span><strong>${esc(sim1.projectedStatus)}</strong><small>Consumo estimado ${number(sim1.dailyUse,1)} mm/día</small>`:'<span>Faltan datos para simular.</span>'}</div>
        </article>
        <article class="panel v64-ranking"><div class="panel-title"><div><p class="eyebrow">PRIORIDAD ECONÓMICA Y OPERATIVA</p><h3>Si hoy sólo podés regar dos sectores</h3></div></div>
          <div class="v64-rank-list">${economic.slice(0,4).map((x,i)=>`<button class="premiumHydricClock" data-lot="${x.lot.id}"><span>${i+1}</span><div><b>${esc(x.valve?.valve_code||x.lot.name)}</b><small>${number(x.occupancy,0)}% disponible · ${number(x.area,1)} ha</small></div><em>${priorityValue(x)===0?'Prioridad máxima':priorityValue(x)===1?'Prioridad alta':'Seguimiento'}</em></button>`).join('')||'<p class="muted">Sin ranking disponible.</p>'}</div>
        </article>
      </section>

      <section class="panel v64-map"><div class="panel-title"><div><p class="eyebrow">MAPA HÍDRICO OPERATIVO</p><h3>Los 13 sectores en una sola vista</h3></div><button class="secondary quickNav" data-page="map">Abrir mapa geográfico</button></div>
        <div class="v64-sector-map">${summary.rows.map(x=>`<button class="premiumHydricClock ${priorityValue(x)===0?'red':priorityValue(x)<=2?'yellow':x.ready?'green':'neutral'}" data-lot="${x.lot.id}"><b>${esc(x.valve?.valve_code||x.lot.name)}</b><span>${x.occupancy==null?'—':number(x.occupancy,0)+'%'}</span><small>${esc(x.status)}</small></button>`).join('')}</div>
      </section>

      <section class="panel v64-ai"><div class="panel-title"><div><p class="eyebrow">LM AI AGRONÓMICO</p><h3>Preguntale al establecimiento</h3></div><span class="pill">Datos locales · sin alterar registros</span></div>
        <div class="v64-ai-prompts"><button class="v64Ask" data-q="today">¿Qué riego hoy?</button><button class="v64Ask" data-q="tomorrow">¿Qué hago mañana?</button><button class="v64Ask" data-q="rain">¿Qué pasa si llueve 10 mm?</button><button class="v64Ask" data-q="water">¿Cuánta agua necesito?</button></div>
        <div class="v64-ai-answer" id="v64AiAnswer">${esc(aiAdvice)}</div>
      </section>

      <section class="premium-metrics"><button class="premium-kpi quickNav" data-page="lots"><span>Superficie gestionada</span><b>${number(lots.length?totalHa():148)} ha</b><small>${lots.length||13} lotes activos</small></button><button class="premium-kpi quickNav" data-page="operations"><span>Registros de riego</span><b>${state.irrigations.length}</b><small>historial conservado</small></button><button class="premium-kpi quickNav" data-page="hydric-intelligence"><span>Muestreos de suelo</span><b>${state.gravimetricSamples.length}</b><small>base de calibración</small></button><button class="premium-kpi quickNav" data-page="satellite"><span>Observaciones satelitales</span><b>${state.satelliteObservations.length}</b><small>seguimiento integrado</small></button></section>
    </div>`;
  }
  function bind(){
    const command=document.querySelector('.v65-command');
    if(command){
      let valves=[];try{valves=JSON.parse(command.dataset.valves||'[]')}catch{}
      const focus=document.querySelector('#v65Focus');
      const paint=(x,index)=>{
        document.querySelectorAll('.v65-marker').forEach((button,i)=>button.classList.toggle('active',i===index));
        if(!focus||!x)return;
        focus.innerHTML=`<p class="eyebrow">VÁLVULA SELECCIONADA</p><div class="v65-focus-title"><div><small>${esc(x.code)}</small><h3>${esc(x.name)}</h3><p>${esc(x.crop)} · ${number(x.area,1)} ha</p></div><div class="v65-focus-dial ${x.tone}"><b>${x.occupancy==null?'—':number(x.occupancy,0)+'%'}</b><small>agua</small></div></div><div class="v75-decision-gate ${x.decisionReady?'ok':'warn'}">${esc(x.decisionLabel)}</div><div class="v65-focus-decision ${x.tone}">${esc(x.status)}</div><div class="v65-focus-grid"><div><small>Lámina</small><b>${x.application?number(x.application,1)+' mm':'—'}</b></div><div><small>Volumen</small><b>${x.volume?number(x.volume,0)+' m³':'—'}</b></div><div><small>Tiempo</small><b>${x.hours==null?'Pendiente':number(x.hours,1)+' h'}</b></div><div><small>Confianza</small><b>${x.confidence?number(x.confidence,0)+'%':'—'}</b></div><div><small>NDVI</small><b>${x.ndvi==null?'—':number(x.ndvi,3)}</b></div><div><small>Satélite</small><b>${esc(x.date)}</b></div><div><small>Modo hídrico</small><b>${esc(x.waterMode)}</b></div><div><small>Última muestra</small><b>${esc(x.sampleDate)}${x.sampleAge!=null?` · ${x.sampleAge} d`:''}</b></div><div><small>ET₀ diaria / ETc acumulada</small><b>${number(x.eto,1)} mm/día / ${number(x.etc,1)} mm</b></div><div><small>Aportes desde muestra</small><b>Riego ${number(x.irrigation,1)} · Lluvia ${number(x.rain,1)} mm</b></div></div><p class="v65-focus-text">${esc(x.instruction)}</p><button class="primary premiumHydricClock" data-lot="${esc(x.id)}">Abrir detalle completo</button>`;
        const detail=focus.querySelector('.premiumHydricClock');
        if(detail)detail.onclick=()=>{document.querySelector(`.v642-card-head[data-lot="${CSS.escape(String(x.id))}"]`)?.click()};
      };
      document.querySelectorAll('.v65-marker').forEach((button,index)=>button.onclick=()=>paint(valves[index],index));
      const initial=Math.max(0,valves.findIndex(x=>x.tone==='red'));
      if(valves[initial])paint(valves[initial],initial);
    }
    document.querySelectorAll('.premiumHydricClock').forEach(button=>button.onclick=()=>valveTwinModal(button.dataset.lot));
    document.querySelectorAll('.v64Sim').forEach(button=>button.onclick=()=>{
      document.querySelectorAll('.v64Sim').forEach(x=>x.classList.toggle('active',x===button));
      const box=document.querySelector('#v64SimResult');if(!box)return;
      let data={};try{data=JSON.parse(box.dataset.sim||'{}')}catch{}
      const value=data[button.dataset.days];
      box.innerHTML=value?`<b>${number(value.projectedPct,0)}%</b><span>Disponibilidad proyectada en ${button.dataset.days} día(s)</span><strong>${esc(value.projectedStatus)}</strong><small>Consumo estimado ${number(value.dailyUse,1)} mm/día</small>`:'<span>Faltan datos para simular.</span>';
    });
    document.querySelectorAll('.v64Ask').forEach(button=>button.onclick=()=>{
      const rows=hydricModule.getRecommendations?.()||[];
      const valid=rows.filter(x=>x.ready&&x.occupancy!=null);
      const worst=[...valid].sort((a,b)=>n(a.occupancy)-n(b.occupancy))[0];
      const rain=(state.weather?.daily?.precipitation_sum||[]).slice(0,7).reduce((s,v)=>s+n(v),0);
      const name=worst?.valve?.valve_code||worst?.lot?.name||'el sector crítico';
      const answers={
        today:worst?`${name} es la prioridad de hoy: ${number(worst.occupancy,0)}% disponible y ${number(worst.application,1)} mm de aplicación recomendada.`:'No hay una prioridad calculada.',
        tomorrow:worst?`Mañana revisá primero ${name}. Sin lluvia útil, su disponibilidad seguirá bajando aproximadamente ${number(Math.max(.5,n(worst.etoDay)*n(worst.kc||1)),1)} puntos de lámina por día.`:'Faltan datos para proyectar mañana.',
        rain:worst?`Una lluvia de 10 mm aportaría aproximadamente 8 mm útiles. En ${name} reduciría la necesidad de reposición, pero no reemplaza automáticamente el riego si el sector permanece por debajo del umbral.`:'No hay sector para evaluar.',
        water:`La necesidad inmediata estimada es ${number(valid.reduce((s,x)=>s+n(x.application)*(n(x.p?.irrigated_area_ha)||n(x.valve?.area_ha)||n(x.lot?.hectares))*10,0),0)} m³ para los sectores con lámina activa.`
      };
      const box=document.querySelector('#v64AiAnswer');if(box)box.textContent=answers[button.dataset.q]||'Consulta no disponible.';
    });
  }
  return {renderPage,bind};
}

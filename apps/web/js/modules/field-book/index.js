export function createFieldBookModule({state,supabase,escapeHtml,openModal,loadData,render,setPage}){
  const dateTime=value=>value?new Intl.DateTimeFormat('es-AR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'Sin registrar';
  const dateOnly=value=>value?new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)):'Sin registrar';
  const n=value=>Number(value||0);
  let fieldMap=null;
  const selectedLot=()=>state.lots.find(l=>l.id===state.selectedLotId)||state.lots[0]||null;
  const lotEvents=lotId=>(state.fieldTimelineEvents||[]).filter(x=>x.lot_id===lotId);
  const lotDocs=lotId=>(state.fieldDocuments||[]).filter(x=>x.lot_id===lotId).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const lotRecs=lotId=>(state.fieldRecommendations||[]).filter(x=>x.lot_id===lotId).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const cropOf=lot=>lot?.crop||lot?.current_crop||lot?.crop_name||'Cultivo sin informar';
  const hectaresOf=lot=>n(lot?.hectares||lot?.area_ha);
  const icon=t=>({siembra:'🌱',fertilizacion:'🧪',riego:'💧',lluvia:'🌧️',corte:'✂️',cosecha:'🌾',aplicacion:'🚁',vuelo_mavic:'🛰️',imagen_satelital:'🗺️',analisis_suelo:'🧫',humedad_gravimetrica:'💦',produccion:'📦',costo:'💰',documento:'📄',recomendacion:'🤖',observacion:'📝'}[t]||'•');
  const priorityClass=p=>p==='critica'?'bad':p==='alta'?'warn':p==='baja'?'ok':'';

  const daysSince=value=>value?Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/86400000)):null;
  const recencyStatus=(value,good=7,warn=21)=>{const d=daysSince(value);if(d===null)return {cls:'bad',label:'Nunca registrado'};if(d<=good)return {cls:'ok',label:d===0?'Registrado hoy':`Hace ${d} día${d===1?'':'s'}`};if(d<=warn)return {cls:'warn',label:`Hace ${d} días`};return {cls:'bad',label:`Hace ${d} días`};};
  function agroScore({hydric,lastFlight,lastIrr,lastCut,grav,active,events}){
    let hydricScore=55, vigorScore=50, manejoScore=45, datosScore=40, riesgoScore=80;
    if(hydric?.soil_water_mm!=null){const mm=n(hydric.soil_water_mm);hydricScore=Math.max(20,Math.min(100,70+(mm-50)*0.6));}
    if(lastFlight?.ndvi_avg!=null)vigorScore=Math.max(20,Math.min(100,n(lastFlight.ndvi_avg)*110));
    const irrAge=daysSince(lastIrr?.event_date||lastIrr?.irrigation_date), cutAge=daysSince(lastCut?.cut_date), gravAge=daysSince(grav?.sample_date);
    manejoScore=Math.round(([irrAge,cutAge].filter(x=>x!=null).reduce((a,d)=>a+(d<=15?95:d<=35?75:50),0)||55)/Math.max(1,[irrAge,cutAge].filter(x=>x!=null).length));
    datosScore=Math.min(100,35+(events.length*3)+(lastFlight?15:0)+(grav?15:0));
    riesgoScore=Math.max(20,100-active.filter(x=>['alta','critica'].includes(x.priority)).length*18);
    const total=Math.round((hydricScore*.28+vigorScore*.24+manejoScore*.18+datosScore*.15+riesgoScore*.15)*10);
    return {total,hydric:Math.round(hydricScore),vigor:Math.round(vigorScore),manejo:Math.round(manejoScore),datos:Math.round(datosScore),riesgo:Math.round(riesgoScore)};
  }

  const lotGeometry=lotId=>(state.geometries||[]).find(x=>x.lot_id===lotId);
  const latestBy=(rows,lotId,dateFields)=>rows.filter(x=>x.lot_id===lotId).sort((a,b)=>new Date(dateFields.map(k=>b[k]).find(Boolean)||0)-new Date(dateFields.map(k=>a[k]).find(Boolean)||0))[0];
  function unifiedTimeline(lot){
    const items=[...lotEvents(lot.id).map(e=>({...e,source:'manual'}))];
    (state.irrigations||[]).filter(x=>x.lot_id===lot.id).forEach(x=>items.push({id:`ir-${x.id}`,event_type:'riego',event_date:x.event_date||x.irrigation_date,title:`Riego ${x.depth_mm||x.mm||''}${x.depth_mm||x.mm?' mm':''}`.trim(),description:x.notes||x.observations||'Registro de riego',source:'riego'}));
    (state.cuts||[]).filter(x=>x.lot_id===lot.id).forEach(x=>items.push({id:`cut-${x.id}`,event_type:'corte',event_date:x.cut_date,title:`Corte ${x.cut_number||''}`.trim(),description:`${n(x.bales||x.rolls)} rollos registrados`,source:'producción'}));
    (state.analyses||[]).filter(x=>x.lot_id===lot.id).forEach(x=>items.push({id:`flight-${x.id}`,event_type:'vuelo_mavic',event_date:x.flight_date,title:'Vuelo y análisis multiespectral',description:x.ndvi_avg!=null?`NDVI promedio ${n(x.ndvi_avg).toFixed(2)}`:'Análisis de precisión',source:'precisión'}));
    (state.gravimetricSamples||[]).filter(x=>x.lot_id===lot.id).forEach(x=>items.push({id:`grav-${x.id}`,event_type:'humedad_gravimetrica',event_date:x.sample_date,title:'Muestra gravimétrica',description:x.moisture_percent!=null?`Humedad ${n(x.moisture_percent).toFixed(1)}%`:'Calibración hídrica',source:'hidrología'}));
    return items.sort((a,b)=>new Date(b.event_date)-new Date(a.event_date));
  }

  function agronomicDecisions({lot,hydric,lastFlight,lastIrr,lastCut,grav,rain7,active}){
    const decisions=[];
    const irrAge=daysSince(lastIrr?.event_date||lastIrr?.irrigation_date);
    const flightAge=daysSince(lastFlight?.flight_date);
    const cutAge=daysSince(lastCut?.cut_date);
    const gravAge=daysSince(grav?.sample_date);
    const water=n(hydric?.soil_water_mm);
    const ndvi=lastFlight?.ndvi_avg==null?null:n(lastFlight.ndvi_avg);

    if((hydric && water<45)||(irrAge!=null && irrAge>10 && rain7<8)){
      const confidence=hydric?Math.min(96,72+Math.max(0,45-water)):78;
      decisions.push({
        priority:'alta',icon:'💧',title:`Evaluar riego en ${lot.name}`,
        recommendation:hydric?`El balance disponible indica ${water.toFixed(0)} mm de agua en el suelo.`:`Pasaron ${irrAge} días desde el último riego y se esperan solamente ${rain7.toFixed(1)} mm.`,
        confidence,action:'Programar riego',page:'irrigation',
        reasons:[
          hydric?`Balance hídrico disponible: ${water.toFixed(0)} mm`:'Balance hídrico todavía incompleto',
          irrAge==null?'No hay riego registrado':`Último riego hace ${irrAge} días`,
          `Lluvia prevista a 7 días: ${rain7.toFixed(1)} mm`
        ]
      });
    }

    if(!lastFlight || flightAge>14){
      decisions.push({
        priority:lastFlight?'media':'alta',icon:'🛰️',title:'Programar relevamiento multiespectral',
        recommendation:lastFlight?`El último vuelo fue hace ${flightAge} días.`:'No hay un vuelo multiespectral asociado al lote.',
        confidence:lastFlight?84:90,action:'Crear misión',page:'flights',
        reasons:[
          lastFlight?`Último vuelo hace ${flightAge} días`:'Sin información NDVI reciente',
          ndvi==null?'No hay NDVI utilizable':`Último NDVI: ${ndvi.toFixed(2)}`,
          'El relevamiento mejora vigor, uniformidad y detección temprana'
        ]
      });
    }

    if(cropOf(lot).toLowerCase().includes('alfalfa') && (cutAge==null || cutAge>28)){
      decisions.push({
        priority:cutAge==null?'media':cutAge>35?'alta':'media',icon:'✂️',title:'Revisar ventana de corte',
        recommendation:cutAge==null?'Todavía no hay cortes registrados para este lote.':`Pasaron ${cutAge} días desde el último corte.`,
        confidence:cutAge==null?68:Math.min(92,65+cutAge/2),action:'Abrir producción',page:'production',
        reasons:[
          cutAge==null?'Sin historial de corte':'Edad del último corte',
          ndvi==null?'Confirmar vigor en campo':'Usar NDVI como señal complementaria',
          'Validar estado fenológico y pronóstico antes de ejecutar'
        ]
      });
    }

    if(!grav || gravAge>30){
      decisions.push({
        priority:'media',icon:'🧪',title:'Verificación gravimétrica conveniente',
        recommendation:grav?`La última muestra fue tomada hace ${gravAge} días.`:'El modelo hídrico todavía no tiene una muestra gravimétrica de control.',
        confidence:grav?76:88,action:'Registrar muestra',page:'hydric-intelligence',
        reasons:[
          grav?`Última calibración hace ${gravAge} días`:'Sin calibración gravimétrica',
          'La muestra permite corregir el balance hídrico sin instalar sensores',
          hydric?'Existe un cálculo para contrastar':'Conviene iniciar la línea base'
        ]
      });
    }

    active.filter(x=>['alta','critica'].includes(x.priority)).slice(0,2).forEach(x=>decisions.push({
      priority:x.priority,icon:'🤖',title:x.title,recommendation:x.recommendation,
      confidence:x.confidence==null?75:n(x.confidence),action:'Ver recomendación',page:null,
      reasons:Array.isArray(x.rationale)?x.rationale:['Recomendación activa registrada en el sistema']
    }));

    return decisions
      .sort((a,b)=>({critica:4,alta:3,media:2,baja:1}[b.priority]-({critica:4,alta:3,media:2,baja:1}[a.priority])))
      .slice(0,4);
  }


  function sparkline(values,{min=null,max=null}={}){
    const clean=values.map(v=>n(v)).filter(v=>Number.isFinite(v));
    if(!clean.length)return '<div class="chart-empty">Sin datos históricos suficientes</div>';
    const lo=min==null?Math.min(...clean):min, hi=max==null?Math.max(...clean):max;
    const range=Math.max(0.0001,hi-lo), w=620,h=180,p=18;
    const pts=clean.map((v,i)=>{
      const x=p+(i*(w-p*2)/Math.max(1,clean.length-1));
      const y=h-p-((v-lo)/range)*(h-p*2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg class="field-chart" viewBox="0 0 ${w} ${h}" role="img"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><line x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}" stroke="currentColor" opacity=".15"/><text x="${p}" y="15">${hi.toFixed(1)}</text><text x="${p}" y="${h-3}">${lo.toFixed(1)}</text></svg>`;
  }

  function lotSnapshot(lot){
    const events=unifiedTimeline(lot), active=lotRecs(lot.id).filter(x=>x.status==='activa');
    const lastIrr=latestBy(state.irrigations||[],lot.id,['event_date','irrigation_date']);
    const lastCut=latestBy(state.cuts||[],lot.id,['cut_date']);
    const lastFlight=latestBy(state.analyses||[],lot.id,['flight_date']);
    const hydric=latestBy(state.hydricDailyBalances||[],lot.id,['balance_date']);
    const grav=latestBy(state.gravimetricSamples||[],lot.id,['sample_date']);
    const score=agroScore({hydric,lastFlight,lastIrr,lastCut,grav,active,events});
    return {lot,events,active,lastIrr,lastCut,lastFlight,hydric,grav,score};
  }

  function simulatorModal(){
    const lot=selectedLot(), snap=lotSnapshot(lot);
    openModal(`<p class="eyebrow">SIMULADOR DE DECISIONES</p><h2>${escapeHtml(lot.name)}</h2>
      <form id="fieldBookSimulatorForm">
        <div class="form-grid">
          <label>Escenario<select name="scenario"><option value="irrigation">Aplicar riego</option><option value="delay_cut">Atrasar corte</option><option value="rain">Lluvia prevista</option><option value="flight">Realizar vuelo Mavic</option></select></label>
          <label>Magnitud<input name="amount" type="number" min="0" step="1" value="20"></label>
          <label class="wide">Observación<textarea name="notes" placeholder="Ej.: riego de 20 mm hoy"></textarea></label>
        </div>
        <button class="primary">Simular impacto</button>
      </form>
      <div id="fieldBookSimulationResult"></div>
      <p class="muted simulator-disclaimer">Estimación orientativa. No reemplaza la validación agronómica ni la observación de campo.</p>`);
    document.querySelector('#fieldBookSimulatorForm').onsubmit=e=>{
      e.preventDefault();
      const f=new FormData(e.target), scenario=f.get('scenario'), amount=n(f.get('amount'));
      let delta=0, water=0, production=0, cost=0, text='';
      if(scenario==='irrigation'){delta=Math.min(110,Math.round(amount*2.4));water=amount;production=Math.round(amount*.35);cost=Math.round(amount*hectaresOf(lot)*950);text=`Aplicar ${amount} mm podría mejorar el estado hídrico y reducir el riesgo de estrés.`}
      if(scenario==='delay_cut'){delta=-Math.min(90,Math.round(amount*7));production=Math.round(amount*.7);text=`Atrasar ${amount} días puede aumentar volumen, pero también reducir calidad y elevar el riesgo climático.`}
      if(scenario==='rain'){delta=Math.min(95,Math.round(amount*1.8));water=amount;production=Math.round(amount*.22);text=`Una lluvia de ${amount} mm aliviaría el déficit estimado, dependiendo de su efectividad e infiltración.`}
      if(scenario==='flight'){delta=45;cost=Math.round(hectaresOf(lot)*4200);text='El vuelo no modifica el cultivo directamente, pero mejora la calidad de datos y la confianza de las decisiones.'}
      const projected=Math.max(0,Math.min(1000,snap.score.total+delta));
      document.querySelector('#fieldBookSimulationResult').innerHTML=`<section class="simulation-result">
        <div><small>AGRO SCORE actual</small><b>${snap.score.total}</b></div>
        <div><small>AGRO SCORE simulado</small><b>${projected}</b><span class="${delta>=0?'positive':'negative'}">${delta>=0?'+':''}${delta}</span></div>
        <div><small>Agua incorporada</small><b>${water} mm</b></div>
        <div><small>Impacto productivo relativo</small><b>${production>=0?'+':''}${production}%</b></div>
        <div><small>Costo estimado</small><b>${cost?new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(cost):'—'}</b></div>
        <p>${escapeHtml(text)}</p>
      </section>`;
    };
  }

  function comparisonRows(){
    return (state.lots||[]).map(lot=>lotSnapshot(lot)).sort((a,b)=>b.score.total-a.score.total);
  }

  function renderPage(){
    const lot=selectedLot();
    if(!lot)return `<div class="panel"><p class="eyebrow">LIBRO DIGITAL DEL LOTE</p><h2>Primero cargá un lote</h2><p class="muted">El Libro Digital organiza la historia productiva, hídrica, documental y agronómica de cada lote.</p><button class="primary fieldBookGoLots">Ir a Lotes</button></div>`;
    if(!state.selectedLotId)state.selectedLotId=lot.id;
    const events=unifiedTimeline(lot),docs=lotDocs(lot.id),recs=lotRecs(lot.id),active=recs.filter(x=>x.status==='activa');
    const lastIrr=latestBy(state.irrigations||[],lot.id,['event_date','irrigation_date']);
    const lastCut=latestBy(state.cuts||[],lot.id,['cut_date']);
    const lastFlight=latestBy(state.analyses||[],lot.id,['flight_date']);
    const hydric=latestBy(state.hydricDailyBalances||[],lot.id,['balance_date']);
    const grav=latestBy(state.gravimetricSamples||[],lot.id,['sample_date']);
    const rain7=(state.weather?.daily?.precipitation_sum||[]).slice(0,7).reduce((s,x)=>s+n(x),0);
    const score=agroScore({hydric,lastFlight,lastIrr,lastCut,grav,active,events});
    const irrStatus=recencyStatus(lastIrr?.event_date||lastIrr?.irrigation_date,7,21),cutStatus=recencyStatus(lastCut?.cut_date,20,35),gravStatus=recencyStatus(grav?.sample_date,14,30);
    const decisions=agronomicDecisions({lot,hydric,lastFlight,lastIrr,lastCut,grav,rain7,active});
    return `<div class="field-book-page">
      <div class="field-book-hero"><div><p class="eyebrow">GEMELO DIGITAL DEL LOTE · INTELIGENCIA AGRONÓMICA</p><h2>${escapeHtml(lot.name)}</h2><p>${escapeHtml(cropOf(lot))} · ${hectaresOf(lot).toLocaleString('es-AR',{maximumFractionDigits:2})} ha</p></div><div class="field-book-actions"><select id="fieldBookLotSelect">${state.lots.map(x=>`<option value="${x.id}" ${x.id===lot.id?'selected':''}>${escapeHtml(x.name)}</option>`).join('')}</select><button class="primary fieldBookNewEvent">+ Evento</button><button class="secondary fieldBookNewRec">+ Recomendación</button><button class="secondary fieldBookSimulator">🤖 Simular decisión</button><button class="secondary fieldBookNewDoc">+ Documento</button></div></div>
      <div class="field-book-tabs"><button class="active" data-field-tab="overview">Resumen</button><button data-field-tab="timeline">Línea de tiempo</button><button data-field-tab="precision">Precisión</button><button data-field-tab="analytics">Análisis</button><button data-field-tab="compare">Comparador</button><button data-field-tab="documents">Documentos</button></div>
      <section class="field-book-tab active" data-field-panel="overview">
        <div class="field-book-kpis"><article><span class="kpi-icon">💧</span><div><small>Balance hídrico</small><b>${hydric?.soil_water_mm!=null?`${n(hydric.soil_water_mm).toFixed(0)} mm`:'Sin cálculo'}</b><span>${hydric?dateOnly(hydric.balance_date):'Falta calcular'}</span></div></article><article><span class="kpi-icon">🌿</span><div><small>NDVI reciente</small><b>${lastFlight?.ndvi_avg!=null?n(lastFlight.ndvi_avg).toFixed(2):'Sin vuelo'}</b><span>${lastFlight?dateOnly(lastFlight.flight_date):'Falta relevamiento'}</span></div></article><article><span class="kpi-icon">🌧️</span><div><small>Lluvia pronosticada</small><b>${rain7.toFixed(1)} mm</b><span>Próximos 7 días</span></div></article><article><span class="kpi-icon">🤖</span><div><small>Recomendaciones activas</small><b>${active.length}</b><span>${active.filter(x=>['alta','critica'].includes(x.priority)).length} prioritarias</span></div></article></div>
        <section class="panel agro-score-card"><div class="agro-score-main"><div><p class="eyebrow">AGRO SCORE</p><div class="agro-score-number">${score.total}<small>/1000</small></div><p class="muted">Índice orientativo calculado con la información disponible del lote.</p></div><div class="agro-score-ring" style="--score:${score.total/10}"><span>${score.total>=800?'Excelente':score.total>=650?'Bueno':score.total>=500?'Atención':'Crítico'}</span></div></div><div class="agro-score-bars">${[['Estado hídrico',score.hydric],['Vigor',score.vigor],['Manejo',score.manejo],['Calidad de datos',score.datos],['Riesgo',score.riesgo]].map(([label,val])=>`<div><span>${label}</span><b>${val}</b><i><em style="width:${val}%"></em></i></div>`).join('')}</div></section>
        <section class="panel agronomic-intelligence-card">
          <div class="panel-title"><div><p class="eyebrow">CENTRO DE INTELIGENCIA AGRONÓMICA</p><h3>Qué hacer ahora</h3><p class="muted">Prioridades calculadas con los datos disponibles. Confirmá siempre la decisión en campo.</p></div><span class="pill ${decisions.length?'warn':'ok'}">${decisions.length} acciones</span></div>
          <div class="agronomic-decisions">${decisions.length?decisions.map((d,index)=>`<article class="agronomic-decision priority-${d.priority}"><div class="decision-rank">${index+1}</div><div class="decision-body"><div class="decision-heading"><span class="decision-icon">${d.icon}</span><div><small>${d.priority.toUpperCase()} · CONFIANZA ${Math.round(d.confidence)}%</small><h4>${escapeHtml(d.title)}</h4></div></div><p>${escapeHtml(d.recommendation)}</p><ul>${d.reasons.slice(0,3).map(r=>`<li>${escapeHtml(r)}</li>`).join('')}</ul></div><button class="secondary fieldBookDecisionAction" data-page="${d.page||''}">${escapeHtml(d.action)}</button></article>`).join(''):'<div class="empty intelligence-empty"><b>Sin acciones urgentes.</b><span>El lote no presenta alertas con la información disponible.</span></div>'}</div>
        </section>
        <div class="field-book-dashboard">
          <section class="panel field-book-map-panel"><div class="panel-title"><div><p class="eyebrow">UBICACIÓN</p><h3>Mapa del lote</h3></div><span class="pill ${lotGeometry(lot.id)?'ok':'warn'}">${lotGeometry(lot.id)?'Georreferenciado':'Sin polígono'}</span></div><div id="fieldBookMap" class="field-book-map"></div></section>
          <section class="panel"><div class="panel-title"><div><p class="eyebrow">ESTADO ACTUAL</p><h3>Ficha rápida</h3></div><button class="secondary fieldBookOpenLot">Abrir ficha 360</button></div><div class="field-book-summary"><div><span>Último riego</span><b>${lastIrr?dateOnly(lastIrr.event_date||lastIrr.irrigation_date):'Sin registrar'}</b><small class="status ${irrStatus.cls}">${irrStatus.label}</small></div><div><span>Último corte</span><b>${lastCut?dateOnly(lastCut.cut_date):'Sin registrar'}</b><small class="status ${cutStatus.cls}">${cutStatus.label}</small></div><div><span>Última muestra gravimétrica</span><b>${grav?dateOnly(grav.sample_date):'Sin registrar'}</b><small class="status ${gravStatus.cls}">${gravStatus.label}</small></div><div><span>Eventos consolidados</span><b>${events.length}</b><small class="status ${events.length?'ok':'warn'}">${events.length?'Historial activo':'Sin actividad'}</small></div></div></section>
        </div>
        <div class="grid2 field-book-grid">
          <section class="panel"><div class="panel-title"><div><p class="eyebrow">INTELIGENCIA AGRONÓMICA</p><h3>Acciones recomendadas</h3></div></div>${active.length?active.slice(0,6).map(r=>`<article class="field-book-rec"><div class="panel-title"><b>${escapeHtml(r.title)}</b><span class="pill ${priorityClass(r.priority)}">${escapeHtml(r.priority)}</span></div><p>${escapeHtml(r.recommendation)}</p><small>Confianza ${r.confidence==null?'—':`${n(r.confidence).toFixed(0)}%`} · ${escapeHtml(r.status)}</small><div class="actions"><button class="secondary fieldBookCompleteRec" data-id="${r.id}">Marcar ejecutada</button></div></article>`).join(''):'<p class="empty">No hay recomendaciones activas.</p>'}</section>
          <section class="panel"><div class="panel-title"><div><p class="eyebrow">ACTIVIDAD RECIENTE</p><h3>Últimos movimientos</h3></div><button class="secondary fieldBookShowTimeline">Ver todo</button></div><div class="field-book-timeline">${events.length?events.slice(0,8).map(eventCard).join(''):'<p class="empty">Todavía no hay actividad registrada.</p>'}</div></section>
        </div>
      </section>
      <section class="field-book-tab" data-field-panel="timeline"><section class="panel"><div class="panel-title"><div><p class="eyebrow">AGRO TIMELINE</p><h3>Historia completa del lote</h3></div><span class="pill">${events.length} eventos</span></div><div class="field-book-timeline field-book-timeline-full">${events.length?events.map(eventCard).join(''):'<p class="empty">Todavía no hay eventos.</p>'}</div></section></section>
      <section class="field-book-tab" data-field-panel="precision"><div class="field-book-gallery">${(state.analyses||[]).filter(x=>x.lot_id===lot.id).length?(state.analyses||[]).filter(x=>x.lot_id===lot.id).map(a=>`<article class="panel field-book-analysis"><div class="field-book-analysis-cover">🛰️</div><small>${dateOnly(a.flight_date)}</small><h3>Vuelo multiespectral</h3><div class="field-book-analysis-metrics"><span>NDVI <b>${a.ndvi_avg!=null?n(a.ndvi_avg).toFixed(2):'—'}</b></span><span>NDRE <b>${a.ndre_avg!=null?n(a.ndre_avg).toFixed(2):'—'}</b></span><span>NDMI <b>${a.ndmi_avg!=null?n(a.ndmi_avg).toFixed(2):'—'}</b></span></div></article>`).join(''):'<section class="panel"><p class="empty">No hay vuelos o imágenes asociados a este lote.</p></section>'}</div></section>
      <section class="field-book-tab" data-field-panel="analytics">
        <div class="analytics-grid">
          <section class="panel"><div class="panel-title"><div><p class="eyebrow">EVOLUCIÓN HÍDRICA</p><h3>Agua disponible</h3></div><span class="pill">${(state.hydricDailyBalances||[]).filter(x=>x.lot_id===lot.id).length} registros</span></div>${sparkline((state.hydricDailyBalances||[]).filter(x=>x.lot_id===lot.id).sort((a,b)=>new Date(a.balance_date)-new Date(b.balance_date)).map(x=>x.soil_water_mm))}</section>
          <section class="panel"><div class="panel-title"><div><p class="eyebrow">VIGOR</p><h3>Evolución NDVI</h3></div><span class="pill">${(state.analyses||[]).filter(x=>x.lot_id===lot.id).length} vuelos</span></div>${sparkline((state.analyses||[]).filter(x=>x.lot_id===lot.id).sort((a,b)=>new Date(a.flight_date)-new Date(b.flight_date)).map(x=>x.ndvi_avg),{min:0,max:1})}</section>
          <section class="panel"><div class="panel-title"><div><p class="eyebrow">PRODUCCIÓN</p><h3>Rollos por corte</h3></div><span class="pill">${(state.cuts||[]).filter(x=>x.lot_id===lot.id).length} cortes</span></div>${sparkline((state.cuts||[]).filter(x=>x.lot_id===lot.id).sort((a,b)=>new Date(a.cut_date)-new Date(b.cut_date)).map(x=>x.bales||x.rolls))}</section>
          <section class="panel automation-card"><div class="panel-title"><div><p class="eyebrow">AUTOMATIZACIÓN</p><h3>Gemelo sincronizado</h3></div><span class="pill ok">Activo</span></div><p class="muted">Riegos, cortes, vuelos y muestras gravimétricas se incorporan automáticamente a la historia del lote.</p><div class="automation-sources"><span>💧 Riegos</span><span>✂️ Cortes</span><span>🛰️ Vuelos</span><span>🧪 Muestras</span></div><small>Requiere ejecutar la migración 022 incluida en esta entrega.</small></section>
          <section class="panel decision-simulator-card"><p class="eyebrow">PLANIFICACIÓN</p><h3>Simulador de decisiones</h3><p class="muted">Probá escenarios de riego, lluvia, corte o relevamiento y compará su efecto orientativo.</p><button class="primary fieldBookSimulator">Abrir simulador</button></section>
        </div>
      </section>
      <section class="field-book-tab" data-field-panel="compare">
        <section class="panel"><div class="panel-title"><div><p class="eyebrow">COMPARADOR DE LOTES</p><h3>Prioridad general del establecimiento</h3></div><span class="pill">${(state.lots||[]).length} lotes</span></div>
          <div class="lot-comparison-table"><div class="comparison-head"><span>Lote</span><span>AGRO SCORE</span><span>Hídrico</span><span>Vigor</span><span>Datos</span><span>Acción</span></div>
          ${comparisonRows().map(row=>`<div class="comparison-row ${row.lot.id===lot.id?'selected':''}"><span><b>${escapeHtml(row.lot.name)}</b><small>${escapeHtml(cropOf(row.lot))} · ${hectaresOf(row.lot).toFixed(2)} ha</small></span><span><b>${row.score.total}</b>/1000</span><span>${row.score.hydric}</span><span>${row.score.vigor}</span><span>${row.score.datos}</span><span><button class="secondary fieldBookSelectComparedLot" data-id="${row.lot.id}">Abrir</button></span></div>`).join('')}</div>
        </section>
      </section>
      <section class="field-book-tab" data-field-panel="documents"><section class="panel"><div class="panel-title"><div><p class="eyebrow">DOCUMENTACIÓN</p><h3>Archivos asociados</h3></div><button class="secondary fieldBookNewDoc">Registrar documento</button></div><div class="field-book-docs">${docs.length?docs.map(d=>`<article><div><b>${escapeHtml(d.title)}</b><small>${escapeHtml(d.category||'otro')} · ${dateTime(d.created_at)}</small></div><button class="secondary fieldBookOpenDoc" data-path="${escapeHtml(d.storage_path)}" data-bucket="${escapeHtml(d.storage_bucket||'precision-files')}">Abrir</button></article>`).join(''):'<p class="empty">No hay documentos asociados.</p>'}</div></section></section>
    </div>`;
  }
  function eventCard(e){return `<article><div class="field-book-dot">${icon(e.event_type)}</div><div><div class="panel-title"><b>${escapeHtml(e.title)}</b><time>${dateTime(e.event_date)}</time></div><small>${escapeHtml(String(e.event_type||'otro').replaceAll('_',' '))}${e.source?` · ${escapeHtml(e.source)}`:''}</small>${e.description?`<p>${escapeHtml(e.description)}</p>`:''}</div></article>`;}
  function initMap(){
    const el=document.querySelector('#fieldBookMap'); if(!el||!window.L)return;
    if(fieldMap){fieldMap.remove();fieldMap=null}
    fieldMap=L.map(el,{zoomControl:true,attributionControl:false}).setView([-31.332065,-63.311986],15);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:20}).addTo(fieldMap);
    const lot=selectedLot(),geom=lot&&lotGeometry(lot.id);
    if(geom?.geojson){try{const layer=L.geoJSON(geom.geojson,{style:{color:'#d8f35a',weight:4,fillColor:'#42a36c',fillOpacity:.28}}).addTo(fieldMap);fieldMap.fitBounds(layer.getBounds().pad(.18));layer.bindTooltip(`${escapeHtml(lot.name)} · ${hectaresOf(lot).toFixed(2)} ha`,{permanent:true,direction:'center'});}catch(e){console.warn(e)}}
    setTimeout(()=>fieldMap?.invalidateSize(),150);
  }
  function eventModal(){const lot=selectedLot();openModal(`<p class="eyebrow">AGRO TIMELINE</p><h2>Nuevo evento · ${escapeHtml(lot.name)}</h2><form id="fieldBookEventForm"><div class="form-grid"><label>Tipo<select name="event_type">${['siembra','fertilizacion','riego','lluvia','corte','cosecha','aplicacion','vuelo_mavic','imagen_satelital','analisis_suelo','humedad_gravimetrica','produccion','costo','observacion','otro'].map(x=>`<option value="${x}">${x.replaceAll('_',' ')}</option>`).join('')}</select></label><label>Fecha y hora<input type="datetime-local" name="event_date" value="${new Date().toISOString().slice(0,16)}" required></label><label class="wide">Título<input name="title" required placeholder="Ej.: Riego de 25 mm"></label><label class="wide">Descripción<textarea name="description" placeholder="Detalle, resultado u observaciones"></textarea></label></div><button class="primary">Guardar evento</button><p id="fieldBookMsg" class="error hidden"></p></form>`);document.querySelector('#fieldBookEventForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),payload=Object.fromEntries(f);payload.company_id=state.companyId;payload.lot_id=lot.id;payload.created_by=state.session?.user?.id||null;const {error}=await supabase.from('field_timeline_events').insert(payload);if(error)return showError(error);document.querySelector('#modalRoot').innerHTML='';await loadData();render();};}
  function recModal(){const lot=selectedLot();openModal(`<p class="eyebrow">INTELIGENCIA AGRONÓMICA</p><h2>Nueva recomendación · ${escapeHtml(lot.name)}</h2><form id="fieldBookRecForm"><div class="form-grid"><label>Tipo<select name="recommendation_type">${['riego','corte','fertilizacion','inspeccion','sanidad','vuelo_mavic','muestreo_gravimetrico','comercial','otro'].map(x=>`<option value="${x}">${x.replaceAll('_',' ')}</option>`).join('')}</select></label><label>Prioridad<select name="priority"><option>baja</option><option selected>media</option><option>alta</option><option>critica</option></select></label><label class="wide">Título<input name="title" required></label><label class="wide">Recomendación<textarea name="recommendation" required></textarea></label><label>Confianza (%)<input type="number" min="0" max="100" step="1" name="confidence"></label><label>Válida hasta<input type="date" name="valid_until"></label></div><button class="primary">Guardar recomendación</button><p id="fieldBookMsg" class="error hidden"></p></form>`);document.querySelector('#fieldBookRecForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),payload=Object.fromEntries(f);payload.company_id=state.companyId;payload.lot_id=lot.id;payload.confidence=payload.confidence===''?null:n(payload.confidence);payload.valid_until=payload.valid_until||null;payload.created_by=state.session?.user?.id||null;const {error}=await supabase.from('field_recommendations').insert(payload);if(error)return showError(error);document.querySelector('#modalRoot').innerHTML='';await loadData();render();};}
  function docModal(){const lot=selectedLot();openModal(`<p class="eyebrow">DOCUMENTACIÓN</p><h2>Asociar documento · ${escapeHtml(lot.name)}</h2><form id="fieldBookDocForm"><div class="form-grid"><label>Categoría<select name="category"><option>mapa</option><option>analisis</option><option>vuelo</option><option>informe</option><option>foto</option><option>factura</option><option>otro</option></select></label><label>Archivo<input type="file" name="file" required></label><label class="wide">Título<input name="title" required></label><label class="wide">Descripción<textarea name="description"></textarea></label></div><button class="primary">Subir y asociar</button><p id="fieldBookMsg" class="error hidden"></p></form>`);document.querySelector('#fieldBookDocForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),file=f.get('file');try{const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_'),path=`${state.companyId}/field-book/${lot.id}/${Date.now()}_${safe}`;const up=await supabase.storage.from('precision-files').upload(path,file,{upsert:false});if(up.error)throw up.error;const payload={company_id:state.companyId,lot_id:lot.id,category:f.get('category'),title:f.get('title'),description:f.get('description')||null,storage_bucket:'precision-files',storage_path:path,mime_type:file.type||null,file_size_bytes:file.size||null,created_by:state.session?.user?.id||null};const ins=await supabase.from('field_documents').insert(payload);if(ins.error)throw ins.error;document.querySelector('#modalRoot').innerHTML='';await loadData();render();}catch(error){showError(error);}};}
  function showError(error){const m=document.querySelector('#fieldBookMsg');if(m){m.textContent=error.message||String(error);m.classList.remove('hidden');}}
  async function openDoc(button){const {data,error}=await supabase.storage.from(button.dataset.bucket||'precision-files').createSignedUrl(button.dataset.path,300);if(error)return alert(error.message);window.open(data.signedUrl,'_blank');}
  async function completeRec(id){const {error}=await supabase.from('field_recommendations').update({status:'ejecutada',updated_at:new Date().toISOString()}).eq('id',id);if(error)return alert(error.message);await loadData();render();}
  function activateTab(name){document.querySelectorAll('[data-field-tab]').forEach(b=>b.classList.toggle('active',b.dataset.fieldTab===name));document.querySelectorAll('[data-field-panel]').forEach(p=>p.classList.toggle('active',p.dataset.fieldPanel===name));if(name==='overview')setTimeout(initMap,50);}
  function bind(){const select=document.querySelector('#fieldBookLotSelect');if(select)select.onchange=e=>{state.selectedLotId=e.target.value;render();setTimeout(initMap,50)};document.querySelectorAll('[data-field-tab]').forEach(b=>b.onclick=()=>activateTab(b.dataset.fieldTab));document.querySelectorAll('.fieldBookShowTimeline').forEach(b=>b.onclick=()=>activateTab('timeline'));document.querySelectorAll('.fieldBookNewEvent').forEach(b=>b.onclick=eventModal);document.querySelectorAll('.fieldBookNewRec').forEach(b=>b.onclick=recModal);document.querySelectorAll('.fieldBookNewDoc').forEach(b=>b.onclick=docModal);document.querySelectorAll('.fieldBookOpenDoc').forEach(b=>b.onclick=()=>openDoc(b));document.querySelectorAll('.fieldBookCompleteRec').forEach(b=>b.onclick=()=>completeRec(b.dataset.id));document.querySelectorAll('.fieldBookGoLots').forEach(b=>b.onclick=()=>setPage('lots'));document.querySelectorAll('.fieldBookOpenLot').forEach(b=>b.onclick=()=>setPage('lots'));document.querySelectorAll('.fieldBookDecisionAction').forEach(b=>b.onclick=()=>{if(b.dataset.page)setPage(b.dataset.page);else activateTab('timeline')});document.querySelectorAll('.fieldBookSimulator').forEach(b=>b.onclick=simulatorModal);document.querySelectorAll('.fieldBookSelectComparedLot').forEach(b=>b.onclick=()=>{state.selectedLotId=b.dataset.id;render();setTimeout(()=>activateTab('compare'),50)});setTimeout(initMap,50);}
  return {renderPage,bind,initMap};
}

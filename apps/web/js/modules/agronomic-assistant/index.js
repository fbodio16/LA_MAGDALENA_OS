export function createAgronomicAssistantModule({
  state,supabase,escapeHtml,openModal,loadData,render,setPage
}){
  const esc=escapeHtml;
  const n=v=>Number(v||0);
  const daysSince=value=>{
    if(!value)return null;
    return Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/86400000));
  };
  const lotName=id=>state.lots.find(x=>x.id===id)?.name||'Lote';
  const latest=(rows,lotId,fields)=>{
    const filtered=(rows||[]).filter(x=>x.lot_id===lotId);
    return filtered.sort((a,b)=>{
      const ad=new Date(fields.map(f=>a[f]).find(Boolean)||0);
      const bd=new Date(fields.map(f=>b[f]).find(Boolean)||0);
      return bd-ad;
    })[0]||null;
  };

  function assessLot(lot){
    const lastIrr=latest(state.irrigations,lot.id,['event_date','irrigation_date']);
    const lastCut=latest(state.cuts,lot.id,['cut_date']);
    const lastFlight=latest(state.analyses,lot.id,['flight_date']);
    const grav=latest(state.gravimetricSamples,lot.id,['sample_date']);
    const hydric=latest(state.hydricDailyBalances,lot.id,['balance_date']);
    const observations=(state.fieldObservations||[]).filter(x=>x.lot_id===lot.id && ['abierta','en_revision'].includes(x.status));
    const activeRecs=(state.fieldRecommendations||[]).filter(x=>x.lot_id===lot.id && x.status==='activa');

    const irrAge=daysSince(lastIrr?.event_date||lastIrr?.irrigation_date);
    const cutAge=daysSince(lastCut?.cut_date);
    const flightAge=daysSince(lastFlight?.flight_date);
    const gravAge=daysSince(grav?.sample_date);

    let hydricScore=55;
    if(hydric?.soil_water_mm!=null){
      const water=n(hydric.soil_water_mm);
      hydricScore=Math.max(10,Math.min(100,Math.round(water*1.6)));
    }else if(irrAge!=null){
      hydricScore=Math.max(20,90-irrAge*4);
    }

    let vigorScore=50;
    if(lastFlight?.ndvi_avg!=null){
      vigorScore=Math.max(10,Math.min(100,Math.round(n(lastFlight.ndvi_avg)*100)));
    }

    let managementScore=55;
    if(cutAge!=null)managementScore=Math.max(25,Math.min(95,95-Math.abs(28-cutAge)*2));
    if(irrAge==null)managementScore-=10;

    let dataScore=20;
    if(lastIrr)dataScore+=18;
    if(lastCut)dataScore+=18;
    if(lastFlight)dataScore+=18;
    if(grav)dataScore+=14;
    if(hydric)dataScore+=12;
    dataScore=Math.min(100,dataScore);

    let riskScore=100;
    riskScore-=observations.filter(x=>x.severity==='critica').length*25;
    riskScore-=observations.filter(x=>x.severity==='alta').length*15;
    riskScore-=activeRecs.filter(x=>x.priority==='critica').length*20;
    riskScore-=activeRecs.filter(x=>x.priority==='alta').length*10;
    riskScore=Math.max(0,riskScore);

    const alerts=[];
    const actions=[];

    if(hydricScore<50){
      alerts.push({level:'alta',icon:'💧',title:'Posible déficit hídrico',detail:'El indicador hídrico está por debajo del nivel deseable.'});
      actions.push({priority:'alta',title:'Revisar necesidad de riego',detail:'Confirmar balance hídrico, pronóstico y condición del cultivo.',page:'irrigation'});
    }
    if(!lastFlight || flightAge>14){
      alerts.push({level:'media',icon:'🛰️',title:'Información de vigor desactualizada',detail:lastFlight?`Último vuelo hace ${flightAge} días.`:'No hay vuelos asociados.'});
      actions.push({priority:'media',title:'Programar vuelo Mavic',detail:'Actualizar NDVI, NDRE y uniformidad del lote.',page:'precision-center'});
    }
    if(!grav || gravAge>30){
      alerts.push({level:'media',icon:'🧪',title:'Calibración gravimétrica pendiente',detail:grav?`Última muestra hace ${gravAge} días.`:'Sin muestras registradas.'});
      actions.push({priority:'media',title:'Tomar muestra gravimétrica',detail:'Mejorar la confianza del balance hídrico.',page:'hydric-intelligence'});
    }
    if(String(lot.crop||lot.current_crop||'').toLowerCase().includes('alfalfa') && (cutAge==null || cutAge>32)){
      alerts.push({level:'alta',icon:'✂️',title:'Ventana de corte a revisar',detail:cutAge==null?'No hay cortes registrados.':`Pasaron ${cutAge} días desde el último corte.`});
      actions.push({priority:'alta',title:'Inspeccionar estado de corte',detail:'Validar estado fenológico, calidad esperada y clima.',page:'production'});
    }
    observations.filter(x=>['alta','critica'].includes(x.severity)).slice(0,2).forEach(x=>{
      alerts.push({level:x.severity,icon:'📷',title:x.title,detail:x.description||'Observación de campo pendiente.'});
    });

    const score=Math.round(
      hydricScore*2.2 +
      vigorScore*2.0 +
      managementScore*2.0 +
      dataScore*1.5 +
      riskScore*2.3
    );
    const confidence=Math.round(Math.min(95,35+dataScore*.6));

    return {
      lot,score,confidence,hydricScore,vigorScore,managementScore,dataScore,riskScore,
      alerts,actions,lastIrr,lastCut,lastFlight,grav,hydric
    };
  }

  function allAssessments(){
    return (state.lots||[]).map(assessLot).sort((a,b)=>a.score-b.score);
  }

  function saveSnapshots(){
    const rows=allAssessments().map(a=>({
      company_id:state.companyId,
      lot_id:a.lot.id,
      snapshot_date:new Date().toISOString().slice(0,10),
      score:a.score,
      hydric_score:a.hydricScore,
      vigor_score:a.vigorScore,
      management_score:a.managementScore,
      data_quality_score:a.dataScore,
      risk_score:a.riskScore,
      alerts:a.alerts,
      recommendations:a.actions,
      evidence:{
        irrigation_date:a.lastIrr?.event_date||a.lastIrr?.irrigation_date||null,
        cut_date:a.lastCut?.cut_date||null,
        flight_date:a.lastFlight?.flight_date||null,
        gravimetric_date:a.grav?.sample_date||null,
        balance_date:a.hydric?.balance_date||null
      },
      confidence:a.confidence,
      model_version:'rules-v1',
      created_by:state.session.user.id
    }));
    return supabase.from('agronomic_intelligence_snapshots').upsert(rows,{onConflict:'company_id,lot_id,snapshot_date'});
  }

  function alertCard(alert){
    return `<article class="assistant-alert alert-${alert.level}">
      <span>${alert.icon}</span>
      <div><b>${esc(alert.title)}</b><p>${esc(alert.detail)}</p></div>
      <em>${esc(alert.level)}</em>
    </article>`;
  }

  function actionCard(action,index){
    return `<article class="assistant-action">
      <span>${index+1}</span>
      <div><b>${esc(action.title)}</b><p>${esc(action.detail)}</p></div>
      <button class="secondary assistantGo" data-page="${action.page}">Abrir</button>
    </article>`;
  }

  function renderPage(){
    const rows=allAssessments();
    const worst=rows[0];
    const avg=rows.length?Math.round(rows.reduce((s,x)=>s+x.score,0)/rows.length):0;
    const confidence=rows.length?Math.round(rows.reduce((s,x)=>s+x.confidence,0)/rows.length):0;
    const alerts=rows.flatMap(x=>x.alerts.map(a=>({...a,lot:x.lot})));
    const actions=rows.flatMap(x=>x.actions.map(a=>({...a,lot:x.lot})))
      .sort((a,b)=>({critica:4,alta:3,media:2,baja:1}[b.priority]-({critica:4,alta:3,media:2,baja:1}[a.priority])))
      .slice(0,8);

    return `<section class="agronomic-assistant-page">
      <section class="assistant-hero">
        <div><p class="eyebrow">ASISTENTE AGRONÓMICO · REGLAS EXPLICABLES</p><h2>Buenos días, Franco</h2><p>Resumen calculado con la información real disponible en La Magdalena.</p></div>
        <div class="assistant-hero-score"><small>AGRO SCORE promedio</small><b>${avg}</b><span>Confianza ${confidence}%</span></div>
      </section>

      <div class="assistant-actions-top">
        <button class="primary assistantRefresh">↻ Recalcular análisis</button>
        <button class="secondary assistantSave">Guardar foto del día</button>
        <button class="secondary assistantGo" data-page="field-operations">📱 Cargar datos</button>
      </div>

      <div class="assistant-kpis">
        <article><small>Lotes evaluados</small><b>${rows.length}</b><span>del establecimiento</span></article>
        <article><small>Alertas activas</small><b>${alerts.length}</b><span>requieren revisión</span></article>
        <article><small>Acciones sugeridas</small><b>${actions.length}</b><span>priorizadas</span></article>
        <article><small>Lote más comprometido</small><b>${esc(worst?.lot?.name||'—')}</b><span>${worst?worst.score+'/1000':'sin datos'}</span></article>
      </div>

      <div class="assistant-main-grid">
        <section class="panel">
          <div class="panel-title"><div><p class="eyebrow">PLAN DE ACCIÓN</p><h3>Qué conviene revisar hoy</h3></div><span class="pill ${actions.length?'warn':'ok'}">${actions.length} acciones</span></div>
          <div class="assistant-action-list">
            ${actions.length?actions.map((a,i)=>actionCard({...a,title:`${a.lot.name}: ${a.title}`},i)).join(''):'<div class="empty"><b>Sin acciones urgentes.</b><span>La información disponible no genera prioridades altas.</span></div>'}
          </div>
        </section>

        <section class="panel">
          <div class="panel-title"><div><p class="eyebrow">ALERTAS</p><h3>Evidencia detectada</h3></div><span class="pill">${alerts.length}</span></div>
          <div class="assistant-alert-list">
            ${alerts.length?alerts.slice(0,10).map(a=>alertCard({...a,title:`${a.lot.name}: ${a.title}`})).join(''):'<div class="empty"><b>Sin alertas.</b><span>No se detectaron desvíos con los datos actuales.</span></div>'}
          </div>
        </section>
      </div>

      <section class="panel">
        <div class="panel-title"><div><p class="eyebrow">COMPARADOR INTELIGENTE</p><h3>Estado de todos los lotes</h3></div><span class="pill">${rows.length} lotes</span></div>
        <div class="assistant-lot-table">
          <div class="assistant-lot-head"><span>Lote</span><span>Score</span><span>Hídrico</span><span>Vigor</span><span>Manejo</span><span>Datos</span><span>Confianza</span><span></span></div>
          ${rows.map(r=>`<div class="assistant-lot-row">
            <span><b>${esc(r.lot.name)}</b><small>${esc(r.lot.crop||r.lot.current_crop||'Sin cultivo')}</small></span>
            <span><b>${r.score}</b>/1000</span>
            <span>${r.hydricScore}</span><span>${r.vigorScore}</span><span>${r.managementScore}</span><span>${r.dataScore}</span><span>${r.confidence}%</span>
            <span><button class="secondary assistantOpenLot" data-id="${r.lot.id}">Abrir</button></span>
          </div>`).join('')}
        </div>
      </section>

      <section class="assistant-disclaimer">
        <b>Importante:</b> este asistente usa reglas agronómicas y los registros cargados en la plataforma. Las recomendaciones son orientativas y deben confirmarse con observación de campo y criterio profesional.
      </section>
    </section>`;
  }

  function bind(){
    document.querySelectorAll('.assistantGo').forEach(b=>b.onclick=()=>setPage(b.dataset.page));
    document.querySelectorAll('.assistantOpenLot').forEach(b=>b.onclick=()=>{
      state.selectedLotId=b.dataset.id;
      setPage('field-book');
    });
    document.querySelectorAll('.assistantRefresh').forEach(b=>b.onclick=()=>render());
    document.querySelectorAll('.assistantSave').forEach(b=>b.onclick=async()=>{
      b.disabled=true;b.textContent='Guardando…';
      const {error}=await saveSnapshots();
      if(error)alert(error.message);
      else alert('Análisis diario guardado correctamente.');
      b.disabled=false;b.textContent='Guardar foto del día';
    });
  }

  return {renderPage,bind};
}
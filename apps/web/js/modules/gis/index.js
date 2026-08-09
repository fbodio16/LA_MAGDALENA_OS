export function createGisModule({state, supabase, select, escapeHtml, number, hectares, shortDate, latest, loadData, render, orderModal, openLotDetails, openModal}) {
  const S=state, sb=supabase, $=select, esc=escapeHtml;

function lotOperationalData(lot){
  const byDate=(rows,fields)=>[...rows].sort((a,b)=>String(fields.map(k=>b[k]).find(Boolean)||'').localeCompare(String(fields.map(k=>a[k]).find(Boolean)||'')));
  const analyses=byDate((S.analyses||[]).filter(x=>x.lot_id===lot.id),['flight_date','created_at']);
  const irrigations=byDate((S.irrigations||[]).filter(x=>x.lot_id===lot.id),['event_date','irrigation_date','created_at']);
  const cuts=byDate((S.cuts||[]).filter(x=>x.lot_id===lot.id),['cut_date','created_at']);
  const orders=byDate((S.orders||[]).filter(x=>x.lot_id===lot.id),['order_date','created_at']);
  const fieldEvents=byDate((S.fieldTimelineEvents||[]).filter(x=>x.lot_id===lot.id),['event_date','created_at']);
  const observations=byDate((S.fieldObservations||[]).filter(x=>x.lot_id===lot.id),['observation_date','created_at']);
  const recommendations=byDate((S.fieldRecommendations||[]).filter(x=>x.lot_id===lot.id),['created_at']);
  const rolls=cuts.reduce((n,x)=>n+Number(x.bales||x.rolls||0),0);
  const dateValue=v=>v?new Date(String(v).slice(0,10)+'T12:00:00'):null;
  const daysSince=v=>{const d=dateValue(v);return d&&Number.isFinite(d.getTime())?Math.max(0,Math.floor((Date.now()-d.getTime())/86400000)):null};
  const ndvi=analyses[0]?.ndvi_avg;
  const irrigationDays=daysSince(irrigations[0]?.event_date||irrigations[0]?.irrigation_date);
  const cutDays=daysSince(cuts[0]?.cut_date);
  let stateLabel='Normal', stateClass='ok', score=0;
  if(ndvi!=null&&Number(ndvi)<.45)score+=3; else if(ndvi!=null&&Number(ndvi)<.62)score+=2;
  if(irrigationDays!=null&&irrigationDays>10)score+=2;
  if(String(lot.crop||'').toLowerCase().includes('alfalfa')&&cutDays!=null&&cutDays>38)score+=2;
  if(score>=4){stateLabel='Prioridad alta';stateClass='bad'}
  else if(score>=2){stateLabel='Revisar';stateClass='warn'}
  const timeline=[
    ...analyses.slice(0,3).map(x=>({date:x.flight_date,type:'Vuelo Mavic',detail:`NDVI ${number(x.ndvi_avg,2)}`})),
    ...irrigations.slice(0,3).map(x=>({date:x.event_date||x.irrigation_date,type:'Riego',detail:`${number(x.millimeters||x.mm||x.water_mm||0,1)} mm`})),
    ...cuts.slice(0,3).map(x=>({date:x.cut_date,type:'Corte',detail:`${number(x.bales||x.rolls||0)} rollos`})),
    ...orders.slice(0,3).map(x=>({date:x.order_date,type:'Orden T100',detail:x.status||x.application_type||'Planificada'})),
    ...fieldEvents.slice(0,3).map(x=>({date:x.event_date,type:x.event_type||x.title||'Evento',detail:x.notes||x.description||''})),
    ...observations.slice(0,2).map(x=>({date:x.observation_date,type:'Observación',detail:x.notes||x.description||''}))
  ].filter(x=>x.date).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,6);
  let ai='Sin alertas críticas con la información registrada.';
  if(stateClass==='bad')ai=`${lot.name} requiere atención prioritaria. Verificá vigor, humedad y estado operativo antes de programar trabajos.`;
  else if(ndvi!=null&&Number(ndvi)<.62)ai=`El vigor de ${lot.name} está por debajo del nivel deseado. Conviene realizar una recorrida y revisar agua, nutrición y sanidad.`;
  else if(String(lot.crop||'').toLowerCase().includes('alfalfa')&&cutDays!=null&&cutDays>=32)ai=`${lot.name} lleva ${cutDays} días desde el último corte. Revisá madurez y pronóstico para definir la próxima ventana de corte.`;
  else if(irrigationDays!=null&&irrigationDays>7)ai=`Pasaron ${irrigationDays} días desde el último riego registrado. Confirmá humedad del suelo y necesidad de reposición.`;
  return {analyses,irrigations,cuts,orders,recommendations,rolls,ndvi,irrigationDays,cutDays,stateLabel,stateClass,timeline,ai};
}
function timelineHtml(items){
  return items.length?`<div class="gis-timeline">${items.map(x=>`<div class="gis-timeline-item"><span></span><div><b>${esc(x.type)}</b><small>${shortDate(x.date)}${x.detail?` · ${esc(x.detail)}`:''}</small></div></div>`).join('')}</div>`:'<p class="muted">Todavía no hay eventos registrados para este lote.</p>';
}

function ndviSparkline(rows){
  const points=rows.slice(0,8).reverse().map(x=>Number(x.ndvi_avg)).filter(Number.isFinite);
  if(points.length<2)return '<div class="gis-chart-empty">Sin historial suficiente para graficar NDVI.</div>';
  const min=Math.min(...points,.2),max=Math.max(...points,.9),range=Math.max(.01,max-min);
  const coords=points.map((v,i)=>`${10+i*(180/(points.length-1))},${70-((v-min)/range)*52}`).join(' ');
  return `<svg class="gis-sparkline" viewBox="0 0 200 80" role="img" aria-label="Evolución del NDVI"><line x1="10" y1="70" x2="190" y2="70"></line><polyline points="${coords}"></polyline>${points.map((v,i)=>`<circle cx="${10+i*(180/(points.length-1))}" cy="${70-((v-min)/range)*52}" r="3"><title>NDVI ${number(v,2)}</title></circle>`).join('')}</svg>`;
}
function mapLotCard(lot){
  if(!lot)return `<div class="gis-empty-card"><div class="gis-empty-icon">◎</div><h3>Ficha inteligente del lote</h3><p>Seleccione una válvula en el mapa o en el listado para ver producción, riegos, NDVI, órdenes y recomendaciones.</p></div>`;
  const d=lotOperationalData(lot),geom=(S.geometries||[]).find(x=>x.lot_id===lot.id);
  const lastObservation=(S.fieldObservations||[]).filter(x=>x.lot_id===lot.id).sort((a,b)=>String(b.observation_date||b.created_at||'').localeCompare(String(a.observation_date||a.created_at||'')))[0];
  return `<div class="gis-card-head"><div><span class="pill ${d.stateClass}">${esc(d.stateLabel)}</span><h3>${esc(lot.name)}</h3><p>${esc(lot.crop||'Sin cultivo')} · ${hectares(lot.hectares||lot.area_ha)}</p></div><span class="gis-geo-state ${geom?'ok':'warn'}">${geom?'Georreferenciado':'Sin polígono'}</span></div>
  <div class="gis-card-grid"><div><span>NDVI actual</span><b>${d.ndvi!=null?number(d.ndvi,2):'Sin datos'}</b></div><div><span>Último riego</span><b>${shortDate(d.irrigations[0]?.event_date||d.irrigations[0]?.irrigation_date)}</b></div><div><span>Último corte</span><b>${shortDate(d.cuts[0]?.cut_date)}</b></div><div><span>Producción</span><b>${number(d.rolls)} rollos</b></div><div><span>Órdenes T100</span><b>${d.orders.length}</b></div><div><span>Campaña</span><b>${esc(lot.campaign||lot.season||'Sin informar')}</b></div></div>
  <div class="gis-card-section"><div class="gis-section-title"><b>Evolución NDVI</b><small>${d.analyses.length} análisis</small></div>${ndviSparkline(d.analyses)}</div>
  <div class="gis-ai"><b>LM AI · recomendación operativa</b><p>${esc(d.ai)}</p></div>
  ${lastObservation?`<div class="gis-observation"><b>Última observación</b><p>${esc(lastObservation.notes||lastObservation.description||'Sin detalle')}</p><small>${shortDate(lastObservation.observation_date||lastObservation.created_at)}</small></div>`:''}
  <div class="gis-card-section"><div class="gis-section-title"><b>Cronología operativa</b><small>${d.timeline.length} eventos recientes</small></div>${timelineHtml(d.timeline)}</div>
  <div class="gis-card-actions"><button class="secondary gis-field-book" data-id="${lot.id}">Libro Digital</button><button class="secondary gis-open-lot" data-id="${lot.id}">Ficha 360</button><button class="secondary gis-new-irrigation" data-id="${lot.id}">Registrar riego</button><button class="primary gis-new-order" data-id="${lot.id}">Crear orden T100</button></div>`
}


function valveNumber(name=''){
  const m=String(name).match(/(?:válvula|valvula|lote)\s*([0-9]+)/i);
  return m?Number(m[1]):null;
}
function bulkInitialSetup(){
  const lots=(S.lots||[]).filter(l=>valveNumber(l.name)!=null).sort((a,b)=>valveNumber(a.name)-valveNumber(b.name));
  if(!lots.length)return alert('No se encontraron las 13 válvulas para precargar.');
  const rows=lots.map(l=>{
    const n=valveNumber(l.name),crop=n<=5?'Trigo':'Alfalfa';
    return `<tr><td>${esc(l.name)}</td><td>${crop}</td><td>${number(l.hectares||l.area_ha,2)} ha</td><td>Goteo</td></tr>`;
  }).join('');
  openModal(`<div class="bulk-setup">
    <p class="eyebrow">PRECONFIGURACIÓN LA MAGDALENA · 29.0.0</p>
    <h2>Precargar los 13 lotes</h2>
    <p class="muted">Se actualizarán únicamente datos generales conocidos. No se inventarán fechas de siembra, riegos, cortes, producción ni NDVI.</p>
    <div class="bulk-summary"><div><span>Lotes</span><b>${lots.length}</b></div><div><span>Trigo</span><b>Válvulas 1–5</b></div><div><span>Alfalfa</span><b>Válvulas 6–13</b></div><div><span>Campaña</span><b>2026</b></div></div>
    <div class="table-wrap"><table><thead><tr><th>Lote</th><th>Cultivo</th><th>Superficie</th><th>Riego</th></tr></thead><tbody>${rows}</tbody></table></div>
    <label class="wizard-check"><input type="checkbox" id="confirmBulkSetup"> Confirmo que esta distribución es correcta.</label>
    <p id="bulkSetupMsg" class="error hidden"></p>
    <div class="actions" style="justify-content:flex-end"><button class="secondary" id="cancelBulkSetup">Cancelar</button><button class="primary" id="runBulkSetup">Aplicar precarga</button></div>
  </div>`);
  document.querySelector('#cancelBulkSetup').onclick=()=>document.querySelector('#modalRoot').innerHTML='';
  document.querySelector('#runBulkSetup').onclick=async()=>{
    const confirm=document.querySelector('#confirmBulkSetup'),msg=document.querySelector('#bulkSetupMsg'),btn=document.querySelector('#runBulkSetup');
    if(!confirm.checked){msg.textContent='Marque la confirmación antes de continuar.';msg.classList.remove('hidden');return}
    btn.disabled=true;btn.textContent='Guardando...';
    try{
      for(const lot of lots){
        const n=valveNumber(lot.name),crop=n<=5?'Trigo':'Alfalfa';
        const notes=[lot.notes,`Precarga V29: ${crop}, campaña 2026, riego por goteo.`].filter(Boolean).join('\n');
        const {error}=await sb.from('lots').update({
          crop,
          campaign:'2026',
          irrigation_type:'Goteo',
          status:lot.status||'Activo',
          notes,
          updated_at:new Date().toISOString()
        }).eq('id',lot.id);
        if(error)throw error;
      }
      document.querySelector('#modalRoot').innerHTML='';
      await loadData();
      render();
      setTimeout(()=>initMap(),0);
      alert(`Precarga completada: ${lots.length} lotes actualizados.`);
    }catch(error){
      msg.textContent=`No se pudo completar la precarga: ${error.message}`;
      msg.classList.remove('hidden');
      btn.disabled=false;btn.textContent='Aplicar precarga';
    }
  };
}
function openSelectedFieldBook(lotId=S.selectedLotId){
  if(!lotId)return alert('Seleccione primero una válvula.');
  S.selectedLotId=lotId;
  S.page='field-book';
  render();
}

function initialLoadWizard(preselectedId=S.selectedLotId){
  const lots=(S.lots||[]),selected=lots.find(x=>x.id===preselectedId)||lots[0];
  if(!selected)return alert('Primero debe existir al menos un lote.');
  const today=new Date().toISOString().slice(0,10);
  const options=lots.map(l=>`<option value="${l.id}" ${l.id===selected.id?'selected':''}>${esc(l.name)} · ${esc(l.crop||'Sin cultivo')}</option>`).join('');
  openModal(`<div class="initial-wizard">
    <div class="wizard-head"><div><p class="eyebrow">PRECARGA Y LIBRO DIGITAL · 29.0.0</p><h2>Activar el gemelo digital</h2><p class="muted">Complete solo los datos disponibles. Los registros vacíos se omiten.</p></div><span class="wizard-progress-label">Paso <b id="wizardStepNumber">1</b> de 4</span></div>
    <div class="wizard-progress"><span id="wizardProgressBar"></span></div>
    <form id="initialLoadForm">
      <section class="wizard-step active" data-step="1">
        <h3>1. Identificación agronómica</h3>
        <div class="form-grid">
          <label class="wide">Lote<select name="lot_id" id="wizardLot" required>${options}</select></label>
          <label>Cultivo<select name="crop"><option>Alfalfa</option><option>Trigo</option><option>Maíz</option><option>Soja</option><option>Otro</option></select></label>
          <label>Variedad<input name="variety" placeholder="Ej.: Monarca, Klein..."></label>
          <label>Campaña<input name="campaign" value="${new Date().getFullYear()}"></label>
          <label>Fecha de siembra / implantación<input type="date" name="sowing_date"></label>
          <label>Tipo de riego<select name="irrigation_type"><option value="">Sin informar</option><option>Goteo</option><option>Aspersión</option><option>Pivote</option><option>Secano</option></select></label>
          <label>Humedad de suelo actual (%)<input type="number" name="soil_moisture" min="0" max="100" step="0.1"></label>
          <label class="wide">Observación general<textarea name="lot_notes" placeholder="Estado general, variedad, manejo, problemas visibles..."></textarea></label>
        </div>
      </section>
      <section class="wizard-step" data-step="2">
        <h3>2. Último riego y producción</h3>
        <div class="wizard-block">
          <label class="wizard-check"><input type="checkbox" name="add_irrigation" id="addIrrigation"> Registrar último riego</label>
          <div class="form-grid wizard-optional" data-enabled-by="addIrrigation">
            <label>Fecha<input type="date" name="irrigation_date" value="${today}"></label>
            <label>Milímetros aplicados<input type="number" name="millimeters" min="0" step="0.1"></label>
            <label>Horas de riego<input type="number" name="irrigation_hours" min="0" step="0.1"></label>
            <label>Tipo<input name="irrigation_event_type" value="Riego"></label>
          </div>
        </div>
        <div class="wizard-block">
          <label class="wizard-check"><input type="checkbox" name="add_cut" id="addCut"> Registrar último corte / producción</label>
          <div class="form-grid wizard-optional" data-enabled-by="addCut">
            <label>Fecha del corte<input type="date" name="cut_date" value="${today}"></label>
            <label>Rollos producidos<input type="number" name="rolls" min="0" step="1"></label>
            <label>Kilos totales<input type="number" name="total_kg" min="0" step="1"></label>
            <label>Calidad / destino<input name="cut_notes" placeholder="Premium, consumo, venta..."></label>
          </div>
        </div>
      </section>
      <section class="wizard-step" data-step="3">
        <h3>3. Agricultura de precisión</h3>
        <div class="wizard-block">
          <label class="wizard-check"><input type="checkbox" name="add_ndvi" id="addNdvi"> Registrar análisis NDVI inicial</label>
          <div class="form-grid wizard-optional" data-enabled-by="addNdvi">
            <label>Fecha del vuelo<input type="date" name="flight_date" value="${today}"></label>
            <label>NDVI promedio<input type="number" name="ndvi_avg" min="-1" max="1" step="0.01"></label>
            <label>NDVI mínimo<input type="number" name="ndvi_min" min="-1" max="1" step="0.01"></label>
            <label>NDVI máximo<input type="number" name="ndvi_max" min="-1" max="1" step="0.01"></label>
            <label>Bajo vigor (%)<input type="number" name="low_vigor_pct" min="0" max="100" step="0.1"></label>
            <label class="wide">Recomendación / interpretación<textarea name="ndvi_recommendation" placeholder="Ej.: recorrer sector oeste, revisar humedad..."></textarea></label>
          </div>
        </div>
        <label class="wide">Observación de campo inicial<textarea name="field_observation" placeholder="Sanidad, malezas, plagas, estado del cultivo..."></textarea></label>
      </section>
      <section class="wizard-step" data-step="4">
        <h3>4. Próxima tarea y confirmación</h3>
        <div class="form-grid">
          <label>Próxima tarea<input name="next_task" placeholder="Ej.: controlar humedad, programar corte..."></label>
          <label>Fecha prevista<input type="date" name="task_date" value="${today}"></label>
          <label>Prioridad<select name="task_priority"><option>baja</option><option selected>media</option><option>alta</option><option>critica</option></select></label>
          <label>Responsable<input name="manager_name" value="${esc(selected.manager_name||'Franco')}"></label>
          <label class="wide">Detalle de la tarea<textarea name="task_description"></textarea></label>
        </div>
        <div class="wizard-summary" id="wizardSummary"></div>
      </section>
      <p id="wizardMsg" class="error hidden"></p>
      <div class="wizard-actions"><button type="button" class="secondary" id="wizardBack">Anterior</button><button type="button" class="primary" id="wizardNext">Siguiente</button><button type="submit" class="primary hidden" id="wizardSave">Guardar carga inicial</button></div>
    </form>
  </div>`);
  const form=document.querySelector('#initialLoadForm');
  let step=1;
  const refreshOptional=()=>document.querySelectorAll('.wizard-optional').forEach(box=>{const input=document.querySelector(`#${box.dataset.enabledBy}`);box.classList.toggle('disabled',!input?.checked);box.querySelectorAll('input,select,textarea').forEach(el=>el.disabled=!input?.checked)});
  const update=()=>{
    document.querySelectorAll('.wizard-step').forEach(x=>x.classList.toggle('active',Number(x.dataset.step)===step));
    document.querySelector('#wizardStepNumber').textContent=step;
    document.querySelector('#wizardProgressBar').style.width=`${step*25}%`;
    document.querySelector('#wizardBack').disabled=step===1;
    document.querySelector('#wizardNext').classList.toggle('hidden',step===4);
    document.querySelector('#wizardSave').classList.toggle('hidden',step!==4);
    if(step===4){
      const f=new FormData(form),lot=lots.find(x=>x.id===f.get('lot_id'));
      document.querySelector('#wizardSummary').innerHTML=`<h4>Resumen de la carga</h4><div class="wizard-summary-grid"><div><span>Lote</span><b>${esc(lot?.name||'—')}</b></div><div><span>Cultivo</span><b>${esc(f.get('crop')||'—')}</b></div><div><span>Campaña</span><b>${esc(f.get('campaign')||'—')}</b></div><div><span>Riego</span><b>${f.get('add_irrigation')?'Sí':'No'}</b></div><div><span>Corte</span><b>${f.get('add_cut')?'Sí':'No'}</b></div><div><span>NDVI</span><b>${f.get('add_ndvi')?'Sí':'No'}</b></div></div>`;
    }
  };
  document.querySelectorAll('#addIrrigation,#addCut,#addNdvi').forEach(x=>x.onchange=refreshOptional);
  document.querySelector('#wizardNext').onclick=()=>{step=Math.min(4,step+1);update()};
  document.querySelector('#wizardBack').onclick=()=>{step=Math.max(1,step-1);update()};
  document.querySelector('#wizardLot').onchange=e=>{
    const lot=lots.find(x=>x.id===e.target.value);if(!lot)return;
    form.elements.crop.value=lot.crop||'Alfalfa';
    form.elements.variety.value=lot.variety||'';
    form.elements.campaign.value=lot.campaign||new Date().getFullYear();
    form.elements.sowing_date.value=lot.sowing_date||'';
    form.elements.irrigation_type.value=lot.irrigation_type||lot.irrigation||'';
    form.elements.manager_name.value=lot.manager_name||'Franco';
  };
  document.querySelector('#wizardLot').dispatchEvent(new Event('change'));
  refreshOptional();update();
  form.onsubmit=saveInitialLoad;
}
async function saveInitialLoad(e){
  e.preventDefault();
  const form=e.target,f=new FormData(form),msg=document.querySelector('#wizardMsg'),lotId=f.get('lot_id');
  const n=v=>v===''||v==null?null:Number(v);
  try{
    const lotUpdate={
      crop:f.get('crop')||null,
      variety:f.get('variety')||null,
      campaign:f.get('campaign')||null,
      sowing_date:f.get('sowing_date')||null,
      irrigation_type:f.get('irrigation_type')||null,
      soil_moisture:n(f.get('soil_moisture')),
      manager_name:f.get('manager_name')||null,
      next_task:f.get('next_task')||null,
      notes:f.get('lot_notes')||null,
      updated_at:new Date().toISOString()
    };
    const {error:lotError}=await sb.from('lots').update(lotUpdate).eq('id',lotId);
    if(lotError)throw lotError;
    if(f.get('add_irrigation')){
      const date=f.get('irrigation_date');
      const {error}=await sb.from('irrigation_events').insert({company_id:S.companyId,lot_id:lotId,event_date:date,irrigation_date:date,event_type:f.get('irrigation_event_type')||'Riego',millimeters:n(f.get('millimeters'))||0,hours:n(f.get('irrigation_hours'))||0,notes:'Carga inicial V28'});
      if(error)throw error;
      await sb.from('lots').update({last_irrigation:date}).eq('id',lotId);
    }
    if(f.get('add_cut')){
      const date=f.get('cut_date'),rolls=Math.round(n(f.get('rolls'))||0);
      const {error}=await sb.from('alfalfa_cuts').insert({company_id:S.companyId,lot_id:lotId,cut_date:date,bales:rolls,rolls,total_kg:n(f.get('total_kg'))||0,notes:f.get('cut_notes')||'Carga inicial V28'});
      if(error)throw error;
      await sb.from('lots').update({last_cut:date}).eq('id',lotId);
    }
    if(f.get('add_ndvi')){
      const {error}=await sb.from('precision_analyses').insert({company_id:S.companyId,lot_id:lotId,flight_date:f.get('flight_date'),hectares:Number((S.lots||[]).find(x=>x.id===lotId)?.hectares||0),ndvi_avg:n(f.get('ndvi_avg')),ndvi_min:n(f.get('ndvi_min')),ndvi_max:n(f.get('ndvi_max')),low_vigor_pct:n(f.get('low_vigor_pct')),recommendation:f.get('ndvi_recommendation')||null,observations:'Análisis inicial cargado mediante asistente V28',created_by:S.session?.user?.id||null});
      if(error)throw error;
    }
    if(String(f.get('field_observation')||'').trim()){
      const {error}=await sb.from('field_observations').insert({company_id:S.companyId,lot_id:lotId,observation_type:'general',title:'Observación inicial del lote',description:String(f.get('field_observation')).trim(),severity:'informativa',status:'abierta',created_by:S.session?.user?.id||null});
      if(error)throw error;
    }
    if(String(f.get('next_task')||'').trim()){
      const {error}=await sb.from('daily_field_tasks').insert({company_id:S.companyId,lot_id:lotId,task_date:f.get('task_date')||new Date().toISOString().slice(0,10),task_type:'general',title:String(f.get('next_task')).trim(),description:f.get('task_description')||null,priority:f.get('task_priority')||'media',status:'pendiente',created_by:S.session?.user?.id||null});
      if(error)throw error;
    }
    document.querySelector('#modalRoot').innerHTML='';
    S.selectedLotId=lotId;
    await loadData();
    render();
    setTimeout(()=>initMap(),0);
  }catch(error){
    msg.textContent=`No se pudo completar la carga: ${error.message}`;
    msg.classList.remove('hidden');
  }
}

function mapPage(){
  const selected=(S.lots||[]).find(l=>l.id===S.selectedLotId);
  return `<div class="page-head gis-page-head"><div><p class="eyebrow">PRECARGA Y LIBRO DIGITAL · 29.0.0</p><h2>Gemelo digital productivo</h2><p class="muted">Mapa, ficha 360, cronología, agricultura de precisión y acciones operativas en una sola pantalla.</p></div><div class="actions"><button class="secondary" id="fitAllBtn">Ver establecimiento</button><button class="secondary" id="bulkSetupBtn">Precargar 13 lotes</button><button class="secondary" id="initialLoadBtn">Asistente de carga</button><button class="primary" id="saveGeometry">Guardar geometría</button></div></div>
  <div class="gis-workspace">
    <aside class="panel gis-sidebar">
      <h3>Capas y herramientas</h3>
      <label>Lote de trabajo<select id="mapLotSelect"><option value="">Seleccionar lote</option>${(S.lots||[]).map(l=>`<option value="${l.id}" ${S.selectedLotId===l.id?'selected':''}>${esc(l.name)} · ${esc(l.crop||'')}</option>`).join('')}</select></label>
      <div class="gis-layer-list"><label><input type="checkbox" id="layerLots" checked> Lotes guardados</label><label><input type="checkbox" id="layerReference" checked> Mapa real / válvulas</label><label><input type="checkbox" id="layerLabels" checked> Etiquetas</label></div>
      <div class="gis-section"><b>Mapa base</b><div class="actions"><button class="secondary" id="satelliteBtn">Satelital</button><button class="secondary" id="streetBtn">Calles</button></div></div>
      <div class="gis-section"><b>Importar archivo</b><input id="gisFile" type="file" accept=".geojson,.json,.kml,application/geo+json,application/vnd.google-earth.kml+xml"><small class="muted">GeoJSON o KML para asociar al lote seleccionado.</small></div>
      <div class="gis-section"><b>Geometría activa</b><div id="geometryStats" class="gis-stats"><span>Superficie</span><strong>Sin geometría</strong><span>Perímetro</span><strong>—</strong></div><button class="secondary" id="clearDrawingBtn">Limpiar dibujo</button></div>
    </aside>
    <section class="gis-map-panel">
      <div class="gis-toolbar"><span class="status">Santiago Temple · WGS84</span><span id="gisMessage" class="muted">Haga clic sobre un lote para abrir su ficha.</span></div>
      <div id="map" class="map gis-map"></div>
    </section>
    <aside class="panel gis-intelligence-panel"><div id="gisLotCard" class="gis-lot-card">${mapLotCard(selected)}</div></aside>
  </div>`
}

async function initMap(){
  if(S.map){S.map.remove();S.map=null}
  const center=[-31.332065,-63.311986];
  S.map=L.map('map',{zoomControl:true}).setView(center,15);
  const street=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20,attribution:'© OpenStreetMap'});
  const satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:20,attribution:'Esri World Imagery'}).addTo(S.map);
  const savedGroup=L.featureGroup().addTo(S.map),referenceGroup=L.featureGroup().addTo(S.map),labelGroup=L.layerGroup().addTo(S.map);
  S.drawn=new L.FeatureGroup().addTo(S.map);
  const styleForLot=lotId=>{const lot=(S.lots||[]).find(x=>x.id===lotId),d=lot?lotOperationalData(lot):null,crop=String(lot?.crop||'').toLowerCase();const fill=crop.includes('trigo')?'#c79a2b':crop.includes('alfalfa')?'#238b57':'#4f8ea8';const edge=d?.stateClass==='bad'?'#b93636':d?.stateClass==='warn'?'#bd7a16':'#134e3a';return{color:edge,weight:d?.stateClass==='bad'?5:3,fillColor:fill,fillOpacity:.46}};
  const addStats=layer=>{try{const gj=layer.toGeoJSON(),area=turf.area(gj)/10000,len=turf.length(turf.polygonToLine(gj),{units:'kilometers'});$('#geometryStats').innerHTML=`<span>Superficie calculada</span><strong>${number(area,2)} ha</strong><span>Perímetro</span><strong>${number(len,2)} km</strong>`;$('#gisMessage').textContent='Geometría activa lista para guardar.'}catch{$('#geometryStats').innerHTML='<span>Superficie</span><strong>Geometría cargada</strong><span>Perímetro</span><strong>—</strong>'}};
  const bindCardActions=()=>{
    document.querySelectorAll('.gis-open-lot').forEach(b=>b.onclick=()=>{const lot=(S.lots||[]).find(x=>x.id===b.dataset.id);if(!lot)return;S.selectedLotId=lot.id;openLotDetails(lot)});
    document.querySelectorAll('.gis-new-order').forEach(b=>b.onclick=()=>orderModal({lot_id:b.dataset.id}));
    document.querySelectorAll('.gis-new-irrigation').forEach(b=>b.onclick=()=>{S.page='irrigation';S.selectedLotId=b.dataset.id;document.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('active',x.dataset.page==='irrigation'));render()});
  };
  const selectLot=lotId=>{const lot=(S.lots||[]).find(x=>x.id===lotId);if(!lot)return;S.selectedLotId=lotId;if($('#mapLotSelect'))$('#mapLotSelect').value=lotId;$('#gisLotCard').innerHTML=mapLotCard(lot);$('#gisMessage').textContent=`${lot.name} seleccionado · consulte la ficha o genere una tarea.`;bindCardActions()};
  (S.geometries||[]).forEach(g=>{try{const l=(S.lots||[]).find(x=>x.id===g.lot_id),a=latest(l||{}),layer=L.geoJSON(g.geojson,{style:()=>styleForLot(g.lot_id),onEachFeature:(f,ly)=>{ly.options.lotId=g.lot_id;ly.bindTooltip(()=>{const d=l?lotOperationalData(l):null;return `<b>${esc(l?.name||'Lote')}</b><br>${esc(l?.crop||'Sin cultivo')} · ${hectares(l?.hectares||l?.area_ha)}<br>Estado: ${esc(d?.stateLabel||'Sin datos')}`},{sticky:true})}});layer.eachLayer(x=>x.options.lotId=g.lot_id);layer.addTo(savedGroup);if(layer.getBounds?.().isValid()){const c=layer.getBounds().getCenter();L.marker(c,{icon:L.divIcon({className:'gis-label',html:`<span>${esc(l?.name||'Lote')}<small>${esc(l?.crop||'')} · ${number(l?.hectares||l?.area_ha||0,1)} ha</small></span>`})}).addTo(labelGroup)}}catch(e){console.warn(e)}});
  try{const response=await fetch('data/mapa-la-magdalena.geojson?version=29.0.0');if(response.ok){const data=await response.json();L.geoJSON(data,{style:f=>{const crop=String(f.properties?.crop||'').toLowerCase();return{color:crop.includes('trigo')?'#8a6514':'#126047',weight:2,dashArray:(S.geometries||[]).length?'6 4':null,fillColor:crop.includes('trigo')?'#c79a2b':'#238b57',fillOpacity:(S.geometries||[]).length?.14:.42}},onEachFeature:(f,l)=>{const p=f.properties||{};l.bindTooltip(`<b>${esc(p.name||'Sector')}</b><br>${esc(p.crop||'Sin cultivo')} · ${number(p.operational_area_ha||p.area_ha,2)} ha`,{sticky:true});l.on('click',()=>{const lot=(S.lots||[]).find(x=>String(x.name||'').toLowerCase()===String(p.name||'').toLowerCase());if(lot)selectLot(lot.id)})}}).addTo(referenceGroup)}}catch(e){console.warn('Mapa de referencia no disponible',e)}
  const drawControl=new L.Control.Draw({edit:{featureGroup:S.drawn},draw:{polyline:false,circle:false,circlemarker:false,marker:false,polygon:{allowIntersection:false,showArea:true},rectangle:{showArea:true}}});S.map.addControl(drawControl);
  S.map.on(L.Draw.Event.CREATED,e=>{S.drawn.clearLayers();S.drawn.addLayer(e.layer);addStats(e.layer)});S.map.on(L.Draw.Event.EDITED,e=>e.layers.eachLayer(addStats));
  savedGroup.on('click',e=>{const lotId=e.layer?.options?.lotId;if(!lotId)return;selectLot(lotId);S.drawn.clearLayers();const copy=L.geoJSON(e.layer.toGeoJSON()).getLayers()[0];S.drawn.addLayer(copy);addStats(copy)});
  $('#mapLotSelect').onchange=e=>selectLot(e.target.value);
  $('#layerLots').onchange=e=>e.target.checked?S.map.addLayer(savedGroup):S.map.removeLayer(savedGroup);$('#layerReference').onchange=e=>e.target.checked?S.map.addLayer(referenceGroup):S.map.removeLayer(referenceGroup);$('#layerLabels').onchange=e=>e.target.checked?S.map.addLayer(labelGroup):S.map.removeLayer(labelGroup);
  $('#satelliteBtn').onclick=()=>{S.map.removeLayer(street);satellite.addTo(S.map)};$('#streetBtn').onclick=()=>{S.map.removeLayer(satellite);street.addTo(S.map)};
  $('#bulkSetupBtn').onclick=bulkInitialSetup;$('#initialLoadBtn').onclick=()=>initialLoadWizard(S.selectedLotId);$('#saveGeometry').onclick=saveGeometry;$('#clearDrawingBtn').onclick=()=>{S.drawn.clearLayers();$('#geometryStats').innerHTML='<span>Superficie</span><strong>Sin geometría</strong><span>Perímetro</span><strong>—</strong>';$('#gisMessage').textContent='Dibujo eliminado.'};
  $('#fitAllBtn').onclick=()=>{const bounds=L.latLngBounds([]);[savedGroup,referenceGroup].forEach(g=>g.eachLayer(l=>{if(l.getBounds)bounds.extend(l.getBounds())}));bounds.isValid()?S.map.fitBounds(bounds.pad(.08)):S.map.setView(center,15)};
  $('#gisFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const text=await file.text();let geo;if(file.name.toLowerCase().endsWith('.kml')){const xml=new DOMParser().parseFromString(text,'text/xml');geo=toGeoJSON.kml(xml)}else geo=JSON.parse(text);const imported=L.geoJSON(geo,{style:{color:'#1d6fa5',weight:3,fillColor:'#5fb4df',fillOpacity:.25}}),layers=[];imported.eachLayer(l=>{if(l.toGeoJSON&&['Polygon','MultiPolygon'].includes(l.toGeoJSON().geometry?.type))layers.push(l)});if(!layers.length)throw new Error('El archivo no contiene polígonos compatibles.');S.drawn.clearLayers();const chosen=layers[0];S.drawn.addLayer(chosen);addStats(chosen);S.map.fitBounds(chosen.getBounds().pad(.12));$('#gisMessage').textContent=`Importado: ${file.name}` }catch(err){alert(`No se pudo importar el archivo: ${err.message}`)}finally{e.target.value=''}};
  bindCardActions();setTimeout(()=>$('#fitAllBtn')?.click(),300)
}
async function saveGeometry(){const lotId=$('#mapLotSelect').value||S.selectedLotId,layer=S.drawn.getLayers()[0];if(!lotId)return alert('Seleccione un lote.');if(!layer)return alert('Dibuje un polígono con la herramienta del mapa.');const center=layer.getBounds().getCenter(),row={company_id:S.companyId,lot_id:lotId,geojson:layer.toGeoJSON(),center_lat:center.lat,center_lng:center.lng,updated_by:S.session.user.id,updated_at:new Date().toISOString()};const {error}=await sb.from('lot_geometries').upsert(row,{onConflict:'lot_id'});if(error)return alert(error.message);try{const area=turf.area(layer.toGeoJSON())/10000;await sb.from('lots').update({hectares:Number(area.toFixed(4))}).eq('id',lotId)}catch(e){console.warn(e)}await loadData();alert('Geometría guardada y superficie actualizada.');render()}

  return {
    renderPage: mapPage,
    initMap
  };
}

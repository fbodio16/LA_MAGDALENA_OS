export function createOperationRealModule({
  state,supabase,escapeHtml,openModal,loadData,render,setPage
}){
  const esc=escapeHtml;
  const n=v=>Number(v||0);
  const profile=()=>state.operationalProfile||{};
  const pct=(value,target)=>target>0?Math.max(0,Math.min(100,Math.round(value/target*100))):0;

  function statusCard({icon,title,value,target,label,page}){
    const progress=target==null?(value>0?100:0):pct(value,target);
    const stateLabel=progress>=100?'Completo':progress>=60?'Avanzado':progress>0?'En progreso':'Pendiente';
    return `<article class="operation-readiness-card">
      <div class="readiness-icon">${icon}</div>
      <div class="readiness-content">
        <div class="readiness-heading"><b>${esc(title)}</b><span>${stateLabel}</span></div>
        <strong>${esc(value)}${target!=null?' / '+esc(target):''}</strong>
        <small>${esc(label)}</small>
        <div class="readiness-bar"><i style="width:${progress}%"></i></div>
      </div>
      <button class="secondary operationGo" data-page="${page}">Abrir</button>
    </article>`;
  }

  function renderPage(){
    const p=profile();
    const lots=state.lots||[];
    const lotArea=lots.reduce((sum,l)=>sum+n(l.area_ha),0);
    const irrigations=state.irrigations?.length||0;
    const cuts=state.cuts?.length||0;
    const analyses=state.analyses?.length||0;
    const clients=state.clients?.length||0;
    const observations=state.fieldObservations?.length||0;
    const tasks=(state.dailyFieldTasks||[]).filter(t=>['pendiente','en_curso'].includes(t.status)).length;
    const checks=[
      lots.length>0,
      irrigations>0,
      cuts>0,
      analyses>0,
      clients>0,
      p.establishment_name
    ];
    const readiness=Math.round(checks.filter(Boolean).length/checks.length*100);

    return `<section class="operation-real-page">
      <section class="operation-real-hero">
        <div><p class="eyebrow">VERSIÓN 21 · OPERACIÓN REAL</p><h2>${esc(p.establishment_name||'La Magdalena')}</h2><p>${esc(p.locality||'Santiago Temple')} · ${esc(p.province||'Córdoba')} · ${n(p.productive_area_ha||148)} ha productivas</p></div>
        <div class="operation-readiness-score"><small>Puesta en marcha</small><b>${readiness}%</b><span>${readiness===100?'Lista para operar':'Completá los datos faltantes'}</span></div>
      </section>

      <div class="operation-real-actions">
        <button class="primary editOperationalProfile">⚙ Configurar establecimiento</button>
        <button class="secondary operationGo" data-page="field-operations">📱 Cargar desde el campo</button>
        <button class="secondary operationGo" data-page="field-book">🌎 Abrir Gemelo Digital</button>
      </div>

      <section class="panel">
        <div class="panel-title"><div><p class="eyebrow">ESTADO DE LOS DATOS</p><h3>Preparación de La Magdalena</h3><p class="muted">El sistema deja de depender de ejemplos a medida que cargás información real.</p></div><span class="pill ${readiness>=80?'ok':'warn'}">${readiness}% completo</span></div>
        <div class="operation-readiness-grid">
          ${statusCard({icon:'▱',title:'Lotes reales',value:lots.length,target:n(p.expected_lots||13),label:`${lotArea.toFixed(2)} ha configuradas`,page:'lots'})}
          ${statusCard({icon:'💧',title:'Historial de riegos',value:irrigations,target:null,label:'registros cargados',page:'irrigation'})}
          ${statusCard({icon:'✂️',title:'Historial de cortes',value:cuts,target:null,label:'cortes registrados',page:'production'})}
          ${statusCard({icon:'🛰️',title:'Agricultura de precisión',value:analyses,target:null,label:'vuelos y análisis',page:'precision-center'})}
          ${statusCard({icon:'👥',title:'Clientes',value:clients,target:null,label:'clientes reales',page:'clients'})}
          ${statusCard({icon:'📷',title:'Observaciones de campo',value:observations,target:null,label:'observaciones registradas',page:'field-operations'})}
        </div>
      </section>

      <div class="operation-real-columns">
        <section class="panel">
          <div class="panel-title"><div><p class="eyebrow">BASE PRODUCTIVA</p><h3>Parámetros de referencia</h3></div><button class="secondary editOperationalProfile">Editar</button></div>
          <div class="operational-profile-grid">
            <div><small>Alfalfa</small><b>${n(p.alfalfa_area_ha||88)} ha</b></div>
            <div><small>Trigo</small><b>${n(p.wheat_area_ha||60)} ha</b></div>
            <div><small>Cortes esperados</small><b>${n(p.expected_cuts_per_year||10)} / año</b></div>
            <div><small>Rollos objetivo</small><b>${n(p.expected_bales_per_ha_cut||6)} / ha/corte</b></div>
            <div><small>Peso estándar</small><b>${n(p.standard_bale_weight_kg||500)} kg</b></div>
            <div><small>Riego</small><b>${esc(p.irrigation_system||'Goteo')}</b></div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-title"><div><p class="eyebrow">HOY</p><h3>Actividad operativa</h3></div><span class="pill">${tasks} tareas</span></div>
          <div class="operation-today">
            <div><span>📋</span><b>${tasks}</b><small>tareas activas</small></div>
            <div><span>📷</span><b>${observations}</b><small>observaciones acumuladas</small></div>
            <div><span>📦</span><b>${state.bales?.reduce((s,x)=>s+n(x.quantity),0)||0}</b><small>rollos en stock</small></div>
          </div>
          <button class="primary operationGo full" data-page="field-operations">Ir a Carga de Campo</button>
        </section>
      </div>

      <section class="panel">
        <div class="panel-title"><div><p class="eyebrow">SIGUIENTES PASOS</p><h3>Plan de puesta en marcha</h3></div></div>
        <div class="operation-checklist">
          <article class="${lots.length?'done':''}"><span>${lots.length?'✓':'1'}</span><div><b>Confirmar los 13 lotes</b><p>Superficie, cultivo, variedad y polígono real.</p></div><button class="secondary operationGo" data-page="lots">Abrir</button></article>
          <article class="${irrigations?'done':''}"><span>${irrigations?'✓':'2'}</span><div><b>Cargar el primer riego real</b><p>Fecha, lote, horas y milímetros aplicados.</p></div><button class="secondary operationGo" data-page="irrigation">Abrir</button></article>
          <article class="${cuts?'done':''}"><span>${cuts?'✓':'3'}</span><div><b>Cargar el historial de cortes</b><p>Rollos, peso, calidad y fecha por lote.</p></div><button class="secondary operationGo" data-page="production">Abrir</button></article>
          <article class="${analyses?'done':''}"><span>${analyses?'✓':'4'}</span><div><b>Incorporar el primer vuelo Mavic</b><p>NDVI, NDRE, NDMI e informe asociado.</p></div><button class="secondary operationGo" data-page="precision-center">Abrir</button></article>
        </div>
      </section>
    </section>`;
  }

  function profileModal(){
    const p=profile();
    openModal(`<p class="eyebrow">CONFIGURACIÓN OPERATIVA</p><h2>Datos reales del establecimiento</h2>
      <form id="operationalProfileForm">
        <div class="form-grid">
          <label>Establecimiento<input name="establishment_name" value="${esc(p.establishment_name||'La Magdalena')}" required></label>
          <label>Localidad<input name="locality" value="${esc(p.locality||'Santiago Temple')}"></label>
          <label>Provincia<input name="province" value="${esc(p.province||'Córdoba')}"></label>
          <label>Superficie productiva (ha)<input name="productive_area_ha" type="number" step=".01" value="${n(p.productive_area_ha||148)}"></label>
          <label>Alfalfa (ha)<input name="alfalfa_area_ha" type="number" step=".01" value="${n(p.alfalfa_area_ha||88)}"></label>
          <label>Trigo (ha)<input name="wheat_area_ha" type="number" step=".01" value="${n(p.wheat_area_ha||60)}"></label>
          <label>Lotes esperados<input name="expected_lots" type="number" value="${n(p.expected_lots||13)}"></label>
          <label>Cortes por año<input name="expected_cuts_per_year" type="number" step=".1" value="${n(p.expected_cuts_per_year||10)}"></label>
          <label>Rollos/ha/corte<input name="expected_bales_per_ha_cut" type="number" step=".1" value="${n(p.expected_bales_per_ha_cut||6)}"></label>
          <label>Peso por rollo (kg)<input name="standard_bale_weight_kg" type="number" step=".1" value="${n(p.standard_bale_weight_kg||500)}"></label>
          <label>Riego<input name="irrigation_system" value="${esc(p.irrigation_system||'Riego por goteo')}"></label>
          <label>Estación meteorológica<input name="weather_station_name" value="${esc(p.weather_station_name||'')}"></label>
          <label>Drone multiespectral<input name="primary_drone" value="${esc(p.primary_drone||'DJI Mavic 3 Multispectral')}"></label>
          <label>Drone de aplicación<input name="spraying_drone" value="${esc(p.spraying_drone||'DJI Agras T100')}"></label>
          <label class="wide">Notas<textarea name="notes">${esc(p.notes||'')}</textarea></label>
        </div>
        <button class="primary">Guardar configuración</button>
        <p id="operationalProfileMsg" class="error hidden"></p>
      </form>`);
    document.querySelector('#operationalProfileForm').onsubmit=async e=>{
      e.preventDefault();
      const f=new FormData(e.target);
      const row={company_id:state.companyId,updated_by:state.session.user.id};
      for(const key of ['establishment_name','locality','province','irrigation_system','weather_station_name','primary_drone','spraying_drone','notes'])row[key]=f.get(key)||null;
      for(const key of ['productive_area_ha','alfalfa_area_ha','wheat_area_ha','expected_lots','expected_cuts_per_year','expected_bales_per_ha_cut','standard_bale_weight_kg'])row[key]=f.get(key)?Number(f.get(key)):null;
      const {error}=await supabase.from('company_operational_profiles').upsert(row,{onConflict:'company_id'});
      if(error){
        const msg=document.querySelector('#operationalProfileMsg');msg.textContent=error.message;msg.classList.remove('hidden');return;
      }
      document.querySelector('#modalRoot').innerHTML='';
      await loadData();render();
    };
  }

  function bind(){
    document.querySelectorAll('.operationGo').forEach(b=>b.onclick=()=>setPage(b.dataset.page));
    document.querySelectorAll('.editOperationalProfile').forEach(b=>b.onclick=profileModal);
  }

  return {renderPage,bind};
}
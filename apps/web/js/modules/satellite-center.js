export function createSatelliteCenterModule({state,supabase,escapeHtml,number,shortDate,loadData,render,setPage}){
  const n=v=>Number(v||0);
  const dateOf=o=>(o?.observed_from||o?.observed_to||'').slice(0,10);
  const latestByLot=()=>{
    const map=new Map();
    [...(state.satelliteObservations||[])].sort((a,b)=>String(dateOf(b)).localeCompare(String(dateOf(a)))).forEach(o=>{if(!map.has(o.lot_id))map.set(o.lot_id,o)});
    return map;
  };
  const latestRadarByLot=()=>{
    const map=new Map();
    [...(state.satelliteRadarObservations||[])].sort((a,b)=>String(dateOf(b)).localeCompare(String(dateOf(a)))).forEach(o=>{if(!map.has(o.lot_id))map.set(o.lot_id,o)});
    return map;
  };
  const status=v=>v>=.65?{label:'Excelente',cls:'sat-good',note:'Vigor alto y uniforme'}:v>=.52?{label:'Bueno',cls:'sat-ok',note:'Evolución normal'}:v>=.42?{label:'Atención',cls:'sat-warn',note:'Conviene verificar en campo'}:v>0?{label:'Crítico',cls:'sat-bad',note:'Prioridad de recorrida'}:{label:'Sin datos',cls:'sat-empty',note:'Sin lectura válida'};
  const avg=(rows,key)=>rows.length?rows.reduce((s,x)=>s+n(x[key]),0)/rows.length:0;
  const daysSince=d=>d?Math.max(0,Math.floor((Date.now()-new Date(`${d}T12:00:00`).getTime())/86400000)):null;
  function sparkline(values){
    const vals=values.filter(v=>Number.isFinite(Number(v))).map(Number);if(vals.length<2)return '<div class="sat-chart-empty">Se necesitan al menos dos imágenes.</div>';
    const w=520,h=150,p=16,min=Math.min(...vals,.25),max=Math.max(...vals,.8),range=max-min||1;
    const pts=vals.map((v,i)=>`${p+i*(w-2*p)/(vals.length-1)},${h-p-(v-min)*(h-2*p)/range}`).join(' ');
    return `<svg class="sat-spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="Evolución NDVI"><line x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}"/><line x1="${p}" y1="${p}" x2="${p}" y2="${h-p}"/><polyline points="${pts}"/><circle cx="${pts.split(' ').at(-1).split(',')[0]}" cy="${pts.split(' ').at(-1).split(',')[1]}" r="5"/></svg>`;
  }
  function recommendation(row){
    const v=n(row.obs?.ndvi), s=status(v), age=daysSince(dateOf(row.obs));
    if(!row.obs)return 'Sin imagen satelital válida. Ejecutar sincronización.';
    if(v<.42)return 'Recorrer el lote y contrastar humedad, nutrición, plagas y estado del rebrote.';
    if(v<.52)return 'Revisar sectores débiles antes de definir riego o intervención.';
    if(age!=null&&age>12)return 'El vigor es aceptable, pero la imagen ya perdió actualidad; sincronizar nuevamente.';
    return s.note+'. Mantener seguimiento y comparar con la próxima pasada.';
  }
  function rows(){
    const latest=latestByLot();
    return (state.lots||[]).map(l=>({lot:l,obs:latest.get(l.id)||null})).sort((a,b)=>n(a.obs?.ndvi)-n(b.obs?.ndvi));
  }
  function renderPage(){
    const all=state.satelliteObservations||[], data=rows(), valid=data.filter(x=>x.obs?.ndvi!=null), lastDate=[...valid].map(x=>dateOf(x.obs)).sort().at(-1)||null;
    const radarMap=latestRadarByLot(), radarAll=state.satelliteRadarObservations||[], radarValid=(state.lots||[]).filter(l=>radarMap.get(l.id)?.vv_mean!=null), radarLastDate=radarAll.map(dateOf).filter(Boolean).sort().at(-1)||null;
    const avgNdvi=avg(valid.map(x=>x.obs),'ndvi'), avgNdre=avg(valid.map(x=>x.obs),'ndre'), avgMsavi=avg(valid.map(x=>x.obs),'msavi');
    const alerts=data.filter(x=>x.obs&&n(x.obs.ndvi)<.52), critical=alerts.filter(x=>n(x.obs.ndvi)<.42);
    const rank=[...data].sort((a,b)=>n(b.obs?.ndvi)-n(a.obs?.ndvi));
    const table=data.map(({lot,obs})=>{const v=n(obs?.ndvi),s=status(v),age=daysSince(dateOf(obs));return `<tr><td><b>${escapeHtml(lot.name)}</b><small>${number(lot.hectares||lot.area_ha||0,2)} ha</small></td><td>${obs?shortDate(dateOf(obs)):'—'}<small>${age==null?'Sin dato':age===0?'Hoy':`Hace ${age} días`}</small></td><td><b>${obs?.ndvi!=null?number(obs.ndvi,3):'—'}</b><div class="sat-mini"><i style="width:${Math.max(0,Math.min(100,v*100))}%"></i></div></td><td>${obs?.ndre!=null?number(obs.ndre,3):'—'}</td><td>${obs?.msavi!=null?number(obs.msavi,3):'—'}</td><td><span class="sat-status ${s.cls}">${s.label}</span></td><td><small>${escapeHtml(recommendation({lot,obs}))}</small></td></tr>`}).join('');
    const trend=[...all].sort((a,b)=>String(dateOf(a)).localeCompare(String(dateOf(b))));
    const latestRun=(state.satelliteSyncRuns||[])[0];
    return `<div class="sat-page">
      <section class="sat-hero"><div><p class="eyebrow">SENTINEL-1 + SENTINEL-2 · COPERNICUS</p><h2>Centro de Inteligencia Satelital</h2><p>Auditoría por válvula de datos ópticos y radar, integrada al Gemelo Digital.</p></div><div class="actions"><button class="secondary satGoMap">Abrir Gemelo Digital</button><button class="secondary satSyncMission" data-mission="sentinel-1">↻ Sentinel-1</button><button class="secondary satSyncMission" data-mission="sentinel-2">↻ Sentinel-2</button><button class="primary satSync">↻ Sincronizar ambos</button></div></section>
      <div id="satSyncMessage"></div>
      <section class="sat-connection-grid"><article class="panel"><div class="panel-title"><div><p class="eyebrow">RADAR · NUBES Y NOCHE</p><h3>Sentinel-1 GRD</h3></div><span class="pill ${radarValid.length===(state.lots||[]).length?'ok':'warn'}">${radarValid.length}/${(state.lots||[]).length} válvulas</span></div><b class="big">${radarLastDate?shortDate(radarLastDate):'Sin datos'}</b><p class="muted">Última observación radar · VV, VH, relación VH/VV e índice radar.</p></article><article class="panel"><div class="panel-title"><div><p class="eyebrow">ÓPTICO · VEGETACIÓN</p><h3>Sentinel-2 L2A</h3></div><span class="pill ${valid.length===data.length?'ok':'warn'}">${valid.length}/${data.length} válvulas</span></div><b class="big">${lastDate?shortDate(lastDate):'Sin datos'}</b><p class="muted">Última observación óptica · NDVI, NDRE y MSAVI con control de nubes.</p></article></section>
      <section class="sat-kpis"><article><span>NDVI promedio</span><b>${valid.length?number(avgNdvi,3):'—'}</b><small>${valid.length} lotes con lectura</small></article><article><span>NDRE promedio</span><b>${valid.length?number(avgNdre,3):'—'}</b><small>Clorofila y estado foliar</small></article><article><span>MSAVI promedio</span><b>${valid.length?number(avgMsavi,3):'—'}</b><small>Vigor ajustado por suelo</small></article><article><span>Última imagen</span><b>${lastDate?shortDate(lastDate):'—'}</b><small>${lastDate?`${daysSince(lastDate)} días de antigüedad`:'Sin imágenes'}</small></article><article><span>Alertas</span><b>${alerts.length}</b><small>${critical.length} críticas</small></article></section>
      <div class="sat-grid">
        <section class="panel sat-ranking"><div class="panel-title"><div><p class="eyebrow">RANKING</p><h3>Vigor por válvula</h3></div><span class="pill">${valid.length}/${data.length} activas</span></div>${rank.map((x,i)=>{const v=n(x.obs?.ndvi),s=status(v);return `<div class="sat-rank-row"><span>${i+1}</span><div><b>${escapeHtml(x.lot.name)}</b><small>${s.label}</small></div><div class="sat-rank-bar"><i style="width:${Math.max(2,Math.min(100,v*100))}%"></i></div><strong>${x.obs?.ndvi!=null?number(x.obs.ndvi,3):'—'}</strong></div>`}).join('')}</section>
        <section class="panel"><div class="panel-title"><div><p class="eyebrow">TENDENCIA</p><h3>Evolución general NDVI</h3></div><span class="pill ${latestRun?.status==='success'?'ok':''}">${escapeHtml(latestRun?.status||'Sin ejecución')}</span></div>${sparkline(trend.map(x=>x.ndvi))}<p class="muted">${all.length} observaciones almacenadas. La serie se actualiza de forma incremental.</p><div class="sat-legend"><span>● Excelente ≥ 0,65</span><span>● Bueno ≥ 0,52</span><span>● Atención ≥ 0,42</span><span>● Crítico &lt; 0,42</span></div></section>
      </div>
      <section class="panel sat-alerts"><div class="panel-title"><div><p class="eyebrow">LM AI</p><h3>Prioridades de recorrida</h3></div></div>${alerts.length?alerts.map(x=>`<article><span class="sat-dot ${status(n(x.obs.ndvi)).cls}"></span><div><b>${escapeHtml(x.lot.name)} · NDVI ${number(x.obs.ndvi,3)}</b><p>${escapeHtml(recommendation(x))}</p></div></article>`).join(''):'<div class="status">No hay lotes por debajo del umbral de atención.</div>'}</section>
      <section class="panel"><div class="panel-title"><div><p class="eyebrow">DETALLE OPERATIVO</p><h3>Última observación por lote</h3></div><span class="pill">Fuente: Sentinel-2 L2A</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Lote</th><th>Imagen</th><th>NDVI</th><th>NDRE</th><th>MSAVI</th><th>Estado</th><th>Recomendación</th></tr></thead><tbody>${table||'<tr><td colspan="7" class="empty">Todavía no hay observaciones satelitales.</td></tr>'}</tbody></table></div></section>
      <section class="panel" style="margin-top:18px"><div class="panel-title"><div><p class="eyebrow">AUDITORÍA COMPLETA</p><h3>Sentinel-1 y Sentinel-2 por válvula</h3></div><span class="pill">Solo lectura</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Válvula / lote</th><th>Sentinel-1</th><th>VV</th><th>VH</th><th>Índice radar</th><th>Sentinel-2</th><th>NDVI</th><th>Estado</th></tr></thead><tbody>${(state.lots||[]).map(l=>{const optical=latestByLot().get(l.id),radar=radarMap.get(l.id),complete=optical?.ndvi!=null&&radar?.vv_mean!=null;return `<tr><td><b>${escapeHtml(l.name)}</b></td><td>${radar?shortDate(dateOf(radar)):'—'}</td><td>${radar?.vv_mean!=null?number(radar.vv_mean,4):'—'}</td><td>${radar?.vh_mean!=null?number(radar.vh_mean,4):'—'}</td><td>${radar?.radar_vegetation_index!=null?number(radar.radar_vegetation_index,3):'—'}</td><td>${optical?shortDate(dateOf(optical)):'—'}</td><td>${optical?.ndvi!=null?number(optical.ndvi,3):'—'}</td><td><span class="pill ${complete?'ok':'warn'}">${complete?'Ambos disponibles':'Falta sincronizar'}</span></td></tr>`}).join('')}</tbody></table></div><p class="muted">Sentinel-1 y Sentinel-2 son fuentes diferentes. La pantalla conserva sus indicadores separados para evitar interpretaciones incorrectas.</p></section>
    </div>`;
  }
  async function sync(missions=['sentinel-1','sentinel-2'],button=null){
    const btn=button||document.querySelector('.satSync'),msg=document.querySelector('#satSyncMessage');if(!btn)return;btn.disabled=true;const old=btn.textContent;btn.textContent='Sincronizando…';msg.innerHTML=`<div class="status">Consultando ${missions.join(' + ')} en Copernicus para los lotes…</div>`;
    try{
      const {data,error}=await supabase.functions.invoke('satellite-sync',{body:{mode:'sync_all',missions,days:60,maxCloudCoverage:80,company_id:state.companyId}});if(error)throw error;if(!data?.ok&&!(data?.lots_ok>0))throw new Error(data?.error||'La sincronización no pudo completarse');
      msg.innerHTML=`<div class="status sat-success"><b>Sincronización completada.</b> ${data.lots_ok} lotes · Sentinel-1: ${data.radar_observations_saved||0} · Sentinel-2: ${data.observations_saved||0} observaciones.</div>`;await loadData();render();
    }catch(e){msg.innerHTML=`<div class="status sat-error"><b>No se pudo sincronizar:</b> ${escapeHtml(e.message||e)}</div>`;btn.disabled=false;btn.textContent=old;}
  }
  function bind(){const b=document.querySelector('.satSync');if(b)b.onclick=()=>sync(undefined,b);document.querySelectorAll('.satSyncMission').forEach(x=>x.onclick=()=>sync([x.dataset.mission],x));const m=document.querySelector('.satGoMap');if(m)m.onclick=()=>setPage('field-book');}
  return {renderPage,bind};
}

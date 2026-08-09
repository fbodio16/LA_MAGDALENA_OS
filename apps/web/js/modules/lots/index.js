import { createLotsService } from '../../services/lots-service.js';

export function createLotsModule({ state, supabase, select, escapeHtml, totalHa, latest, vigor, openModal, openOrder, loadData, render }) {
  const service = createLotsService({ supabase });
  const ui = { query: '', crop: '', status: 'Activo', geometry: '', sort: 'name', view: 'table' };
  const num = value => Number(value || 0);
  const ha = value => num(value).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  const date = value => value ? new Intl.DateTimeFormat('es-AR').format(new Date(`${value}T12:00:00`)) : 'Sin registrar';
  const related = (list, lotId) => list.filter(item => item.lot_id === lotId);
  const geometryFor = lotId => state.geometries.find(item => item.lot_id === lotId);
  const crops = () => [...new Set(state.lots.map(l => l.crop).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));

  function filteredLots() {
    const q = ui.query.trim().toLocaleLowerCase('es');
    const rows = state.lots.filter(lot => {
      const haystack = `${lot.name || ''} ${lot.crop || ''} ${lot.variety || ''} ${lot.next_task || ''}`.toLocaleLowerCase('es');
      if (q && !haystack.includes(q)) return false;
      if (ui.crop && lot.crop !== ui.crop) return false;
      if (ui.status && (lot.status || 'Activo') !== ui.status) return false;
      const hasGeometry = Boolean(geometryFor(lot.id));
      if (ui.geometry === 'with' && !hasGeometry) return false;
      if (ui.geometry === 'without' && hasGeometry) return false;
      return true;
    });
    return rows.sort((a,b) => {
      if (ui.sort === 'hectares-desc') return num(b.hectares) - num(a.hectares);
      if (ui.sort === 'ndvi-asc') return num(latest(a)?.ndvi_avg || 99) - num(latest(b)?.ndvi_avg || 99);
      if (ui.sort === 'updated-desc') return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
      return String(a.name || '').localeCompare(String(b.name || ''), 'es', { numeric: true });
    });
  }

  function metricCards() {
    const active = state.lots.filter(l => (l.status || 'Activo') === 'Activo');
    const alerts = active.filter(l => latest(l)?.ndvi_avg != null && num(latest(l).ndvi_avg) < .62);
    const withoutGeometry = active.filter(l => !geometryFor(l.id));
    const ndvis = active.map(l => latest(l)?.ndvi_avg).filter(v => v != null).map(Number);
    const avg = ndvis.length ? ndvis.reduce((a,b)=>a+b,0)/ndvis.length : 0;
    return `<div class="metrics lots-metrics">
      <div class="metric"><span>Lotes activos</span><b>${active.length}</b><small>${state.lots.length - active.length} archivado(s)</small></div>
      <div class="metric"><span>Superficie activa</span><b>${ha(active.reduce((s,l)=>s+num(l.hectares),0))}</b><small>hectáreas declaradas</small></div>
      <div class="metric"><span>NDVI promedio</span><b>${ndvis.length ? avg.toFixed(2) : '—'}</b><small>${ndvis.length} lote(s) monitoreados</small></div>
      <div class="metric"><span>Requieren atención</span><b>${alerts.length}</b><small>${withoutGeometry.length} sin polígono</small></div>
    </div>`;
  }

  function filters() {
    return `<div class="panel lots-toolbar">
      <div class="lots-filter-grid">
        <label>Buscar<input id="lotSearch" value="${escapeHtml(ui.query)}" placeholder="Nombre, cultivo, variedad o tarea"></label>
        <label>Cultivo<select id="lotCrop"><option value="">Todos</option>${crops().map(c=>`<option ${ui.crop===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select></label>
        <label>Estado<select id="lotStatus"><option value="">Todos</option><option ${ui.status==='Activo'?'selected':''}>Activo</option><option ${ui.status==='Archivado'?'selected':''}>Archivado</option><option ${ui.status==='En descanso'?'selected':''}>En descanso</option></select></label>
        <label>Geometría<select id="lotGeometry"><option value="">Todos</option><option value="with" ${ui.geometry==='with'?'selected':''}>Con polígono</option><option value="without" ${ui.geometry==='without'?'selected':''}>Sin polígono</option></select></label>
        <label>Ordenar<select id="lotSort"><option value="name" ${ui.sort==='name'?'selected':''}>Nombre</option><option value="hectares-desc" ${ui.sort==='hectares-desc'?'selected':''}>Mayor superficie</option><option value="ndvi-asc" ${ui.sort==='ndvi-asc'?'selected':''}>NDVI más bajo</option><option value="updated-desc" ${ui.sort==='updated-desc'?'selected':''}>Actualización reciente</option></select></label>
      </div>
      <div class="lots-view-actions"><button class="secondary clearLotFilters">Limpiar filtros</button><div class="lots-view-toggle"><button class="secondary lotView" data-view="table" aria-pressed="${ui.view==='table'}">Tabla</button><button class="secondary lotView" data-view="cards" aria-pressed="${ui.view==='cards'}">Tarjetas</button></div></div>
    </div>`;
  }

  function table(rows) {
    if (!rows.length) return '<div class="panel empty">No hay lotes que coincidan con los filtros.</div>';
    return `<div class="panel lots-table-wrap"><table class="table lots-table"><thead><tr><th>Lote</th><th>Cultivo</th><th>Superficie</th><th>NDVI</th><th>Última actividad</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map(lot => {
      const analysis = latest(lot), level = vigor(analysis?.ndvi_avg), irrigation = related(state.irrigations, lot.id)[0], cut = related(state.cuts, lot.id)[0];
      const last = [irrigation?.event_date || irrigation?.irrigation_date, cut?.cut_date, analysis?.flight_date].filter(Boolean).sort().reverse()[0];
      return `<tr><td><button class="lot-name-button lotDetail" data-id="${lot.id}">${escapeHtml(lot.name)}</button><small>${geometryFor(lot.id)?'Polígono cargado':'Sin polígono'} · ${escapeHtml(lot.variety || 'Sin variedad')}</small></td><td>${escapeHtml(lot.crop || 'Sin cultivo')}</td><td><b>${ha(lot.hectares)} ha</b></td><td>${analysis?`<span class="pill ${level[1]}">${num(analysis.ndvi_avg).toFixed(2)} · ${level[0]}</span>`:'<span class="pill warn">Sin datos</span>'}</td><td>${date(last)}<small>${escapeHtml(lot.next_task || 'Sin tarea pendiente')}</small></td><td><span class="pill ${(lot.status||'Activo')==='Archivado'?'bad':''}">${escapeHtml(lot.status || 'Activo')}</span></td><td><div class="actions"><button class="secondary lotDetail" data-id="${lot.id}">Ver</button><button class="secondary editLot" data-id="${lot.id}">Editar</button></div></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function cards(rows) {
    if (!rows.length) return '<div class="panel empty">No hay lotes que coincidan con los filtros.</div>';
    return `<div class="lots-card-grid">${rows.map(lot=>{const a=latest(lot),level=vigor(a?.ndvi_avg);return `<article class="panel lot-card"><div class="panel-title"><div><p class="eyebrow">${escapeHtml(lot.crop||'SIN CULTIVO')}</p><h3>${escapeHtml(lot.name)}</h3></div><span class="pill ${(lot.status||'Activo')==='Archivado'?'bad':''}">${escapeHtml(lot.status||'Activo')}</span></div><div class="lot-card-stats"><div><span>Superficie</span><b>${ha(lot.hectares)} ha</b></div><div><span>NDVI</span><b>${a?num(a.ndvi_avg).toFixed(2):'—'}</b></div><div><span>Mapa</span><b>${geometryFor(lot.id)?'Sí':'No'}</b></div></div><p class="muted">${escapeHtml(lot.variety || 'Variedad no informada')}</p><p>${escapeHtml(lot.next_task || 'Sin próxima tarea registrada.')}</p><div class="actions"><button class="primary lotDetail" data-id="${lot.id}">Abrir ficha</button><button class="secondary editLot" data-id="${lot.id}">Editar</button>${a?`<span class="pill ${level[1]}">${level[0]}</span>`:''}</div></article>`}).join('')}</div>`;
  }

  function renderPage() {
    const rows = filteredLots();
    return `<section class="lots-module"><div class="page-head"><div><p class="eyebrow">REGISTRO MAESTRO AGRONÓMICO</p><h2>Gestión profesional de lotes</h2><p class="muted">Información productiva, riego, precisión y operaciones reunidas por unidad de manejo.</p></div><div class="actions"><button class="secondary goMap">Abrir mapa</button><button class="primary newLot">+ Nuevo lote</button></div></div>${metricCards()}${filters()}<div class="lots-results-head"><b>${rows.length} lote(s)</b><span class="muted">${ha(rows.reduce((s,l)=>s+num(l.hectares),0))} ha filtradas de ${ha(totalHa())} ha totales</span></div>${ui.view==='cards'?cards(rows):table(rows)}</section>`;
  }

  function openEditor(lot = {}) {
    const editing = Boolean(lot.id);
    openModal(`<p class="eyebrow">${editing?'EDITAR LOTE':'NUEVO LOTE'}</p><h2>${editing?escapeHtml(lot.name):'Crear unidad de manejo'}</h2><form id="lotForm"><div class="form-grid">
      <label>Nombre<input name="name" value="${escapeHtml(lot.name||'')}" required maxlength="80"></label>
      <label>Estado<select name="status"><option ${(lot.status||'Activo')==='Activo'?'selected':''}>Activo</option><option ${lot.status==='En descanso'?'selected':''}>En descanso</option><option ${lot.status==='Archivado'?'selected':''}>Archivado</option></select></label>
      <label>Cultivo<input name="crop" value="${escapeHtml(lot.crop||'Alfalfa')}" required></label>
      <label>Variedad<input name="variety" value="${escapeHtml(lot.variety||'')}"></label>
      <label>Campaña<input name="campaign" value="${escapeHtml(lot.campaign||'2026/27')}" placeholder="2026/27"></label>
      <label>Ambiente / sector<input name="management_zone" value="${escapeHtml(lot.management_zone||'')}" placeholder="Norte, bajo, loma..."></label>
      <label>Tipo de suelo<input name="soil_type" value="${escapeHtml(lot.soil_type||'')}" placeholder="Franco limoso, arenoso..."></label>
      <label>Tipo de riego<select name="irrigation_type"><option value="">Sin informar</option><option ${lot.irrigation_type==='Goteo'?'selected':''}>Goteo</option><option ${lot.irrigation_type==='Pivote'?'selected':''}>Pivote</option><option ${lot.irrigation_type==='Aspersión'?'selected':''}>Aspersión</option><option ${lot.irrigation_type==='Secano'?'selected':''}>Secano</option><option ${lot.irrigation_type==='Otro'?'selected':''}>Otro</option></select></label>
      <label>Responsable<input name="manager_name" value="${escapeHtml(lot.manager_name||'')}" placeholder="Encargado del lote"></label>
      <label>Superficie (ha)<input name="hectares" type="number" min="0.01" step="0.01" value="${num(lot.hectares||lot.area_ha)||''}" required></label>
      <label>Fecha de implantación<input name="sowing_date" type="date" value="${escapeHtml(lot.sowing_date||'')}"></label>
      <label>Último corte<input name="last_cut" type="date" value="${escapeHtml(lot.last_cut||'')}"></label>
      <label>Último riego<input name="last_irrigation" type="date" value="${escapeHtml(lot.last_irrigation||'')}"></label>
      <label>Humedad de suelo (%)<input name="soil_moisture" type="number" min="0" max="100" step="0.1" value="${lot.soil_moisture??''}"></label>
      <label>Próxima tarea<input name="next_task" value="${escapeHtml(lot.next_task||'')}"></label>
      <label class="wide">Notas<textarea name="notes">${escapeHtml(lot.notes||'')}</textarea></label>
    </div><div class="actions"><button class="primary">${editing?'Guardar cambios':'Crear lote'}</button>${editing?`<button type="button" class="secondary archiveLot" data-id="${lot.id}">${lot.status==='Archivado'?'Reactivar':'Archivar lote'}</button>`:''}</div><p id="lotFormMsg" class="error hidden"></p></form>`);
    const form = select('#lotForm');
    form.onsubmit = async event => {
      event.preventDefault(); const msg=select('#lotFormMsg'); const f=new FormData(form);
      try {
        const hectares=num(f.get('hectares')); if (!(hectares>0)) throw new Error('La superficie debe ser mayor que cero.');
        const row={company_id:state.companyId,name:String(f.get('name')).trim(),crop:String(f.get('crop')).trim()||null,variety:String(f.get('variety')).trim()||null,campaign:String(f.get('campaign')||'').trim()||null,management_zone:String(f.get('management_zone')||'').trim()||null,soil_type:String(f.get('soil_type')||'').trim()||null,irrigation_type:String(f.get('irrigation_type')||'').trim()||null,manager_name:String(f.get('manager_name')||'').trim()||null,hectares,area_ha:hectares,status:f.get('status'),sowing_date:f.get('sowing_date')||null,last_cut:f.get('last_cut')||null,last_irrigation:f.get('last_irrigation')||null,soil_moisture:f.get('soil_moisture')===''?null:num(f.get('soil_moisture')),next_task:String(f.get('next_task')).trim()||null,notes:String(f.get('notes')).trim()||null,updated_at:new Date().toISOString()};
        await service.saveLot({id:lot.id,row}); select('#modalRoot').innerHTML=''; await loadData(); render();
      } catch (error) { msg.textContent=error.message; msg.classList.remove('hidden'); }
    };
    const archive=select('.archiveLot'); if(archive) archive.onclick=async()=>{try{await service.setStatus(lot.id,lot.status==='Archivado'?'Activo':'Archivado');select('#modalRoot').innerHTML='';await loadData();render()}catch(error){const msg=select('#lotFormMsg');msg.textContent=error.message;msg.classList.remove('hidden')}};
  }


  function openIrrigationModal(lot) {
    const today=new Date().toISOString().slice(0,10);
    openModal(`<p class="eyebrow">RIEGO DEL LOTE</p><h2>${escapeHtml(lot.name)}</h2><form id="lotIrrigationForm"><div class="form-grid">
      <label>Fecha<input name="event_date" type="date" value="${today}" required></label>
      <label>Tipo<select name="event_type"><option>Riego</option><option>Fertirriego</option><option>Lavado de líneas</option></select></label>
      <label>Lámina aplicada (mm)<input name="millimeters" type="number" min="0" step="0.1" required></label>
      <label>Duración (horas)<input name="hours" type="number" min="0" step="0.1" required></label>
      <label class="wide">Observaciones<textarea name="notes" placeholder="Sector, válvula, presión, humedad o incidencias"></textarea></label>
    </div><button class="primary">Guardar riego</button><p id="lotActionMsg" class="error hidden"></p></form>`);
    const form=select('#lotIrrigationForm');
    form.onsubmit=async event=>{event.preventDefault();const f=new FormData(form),msg=select('#lotActionMsg');try{const row={company_id:state.companyId,lot_id:lot.id,event_date:f.get('event_date'),irrigation_date:f.get('event_date'),event_type:f.get('event_type'),millimeters:num(f.get('millimeters')),hours:num(f.get('hours')),notes:String(f.get('notes')||'').trim()||null};const {error}=await supabase.from('irrigation_events').insert(row);if(error)throw error;await supabase.from('lots').update({last_irrigation:row.event_date,updated_at:new Date().toISOString()}).eq('id',lot.id);select('#modalRoot').innerHTML='';await loadData();openDetails(state.lots.find(x=>x.id===lot.id)||lot)}catch(error){msg.textContent=error.message;msg.classList.remove('hidden')}};
  }

  function openCutModal(lot) {
    const today=new Date().toISOString().slice(0,10);
    openModal(`<p class="eyebrow">PRODUCCIÓN DE ALFALFA</p><h2>Registrar corte · ${escapeHtml(lot.name)}</h2><form id="lotCutForm"><div class="form-grid">
      <label>Fecha del corte<input name="cut_date" type="date" value="${today}" required></label>
      <label>Rollos producidos<input name="rolls" type="number" min="0" step="1" value="0" required></label>
      <label>Peso total (kg)<input name="total_kg" type="number" min="0" step="1" value="0" required></label>
      <label>Peso promedio por rollo<input id="averageRollWeight" value="0 kg" readonly></label>
      <label class="wide">Observaciones<textarea name="notes" placeholder="Calidad, humedad, lote de almacenamiento o incidencias"></textarea></label>
    </div><button class="primary">Guardar corte</button><p id="lotActionMsg" class="error hidden"></p></form>`);
    const form=select('#lotCutForm'),rolls=form.elements.rolls,total=form.elements.total_kg,average=select('#averageRollWeight');
    const updateAverage=()=>{const count=num(rolls.value),kg=num(total.value);average.value=count?`${(kg/count).toLocaleString('es-AR',{maximumFractionDigits:1})} kg`:'0 kg'};rolls.addEventListener('input',updateAverage);total.addEventListener('input',updateAverage);
    form.onsubmit=async event=>{event.preventDefault();const f=new FormData(form),msg=select('#lotActionMsg');try{const count=Math.round(num(f.get('rolls'))),kg=num(f.get('total_kg'));if(count<0||kg<0)throw new Error('Los valores de producción no pueden ser negativos.');const row={company_id:state.companyId,lot_id:lot.id,cut_date:f.get('cut_date'),bales:count,rolls:count,total_kg:kg,notes:String(f.get('notes')||'').trim()||null};const {error}=await supabase.from('alfalfa_cuts').insert(row);if(error)throw error;await supabase.from('lots').update({last_cut:row.cut_date,updated_at:new Date().toISOString()}).eq('id',lot.id);select('#modalRoot').innerHTML='';await loadData();openDetails(state.lots.find(x=>x.id===lot.id)||lot)}catch(error){msg.textContent=error.message;msg.classList.remove('hidden')}};
  }

  function cutMeta(cut) {
    try {
      const notes=String(cut.notes||'');
      return notes.startsWith('LMOS_CUT:')?JSON.parse(notes.slice(9)):{observations:notes};
    } catch { return {observations:String(cut.notes||'')}; }
  }

  function lotMapSvg(lot) {
    const geometry=geometryFor(lot.id)?.geojson;
    const coords=geometry?.geometry?.type==='Polygon'?geometry.geometry.coordinates?.[0]:geometry?.geometry?.type==='MultiPolygon'?geometry.geometry.coordinates?.[0]?.[0]:null;
    if(!coords?.length)return `<div class="lot-command-map empty"><span>🗺️</span><b>${escapeHtml(lot.name)}</b><small>Polígono pendiente</small></div>`;
    const xs=coords.map(c=>Number(c[0])),ys=coords.map(c=>Number(c[1])),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),dx=maxX-minX||1,dy=maxY-minY||1;
    const points=coords.map(c=>`${12+(Number(c[0])-minX)/dx*176},${108-(Number(c[1])-minY)/dy*88}`).join(' ');
    return `<button class="lot-command-map openLotMap" type="button"><svg viewBox="0 0 200 120" role="img" aria-label="Polígono de ${escapeHtml(lot.name)}"><polygon points="${points}"></polygon><text x="100" y="116" text-anchor="middle">${escapeHtml(lot.name)}</text></svg><small>Abrir GIS completo</small></button>`;
  }

  function aiLotAdvice(lot,cuts,analyses,irrigations,economics) {
    const latestCut=cuts[0],meta=latestCut?cutMeta(latestCut):{},daysCut=latestCut?.cut_date?Math.max(0,Math.floor((Date.now()-new Date(`${latestCut.cut_date}T12:00:00`).getTime())/86400000)):null;
    const ndvi=analyses[0]?.ndvi_avg,rollsHa=economics.hectares?economics.rolls/economics.hectares:0;
    const messages=[];
    if(ndvi!=null)messages.push(Number(ndvi)<.55?'El último NDVI indica sectores que requieren recorrida prioritaria.':`El vigor actual es ${Number(ndvi)>=.72?'alto':'estable'} (NDVI ${Number(ndvi).toFixed(2)}).`);
    if(daysCut!=null)messages.push(`Pasaron ${daysCut} días desde el último corte.`);
    if(rollsHa)messages.push(`El rendimiento acumulado es de ${rollsHa.toLocaleString('es-AR',{maximumFractionDigits:1})} rollos/ha.`);
    if(economics.margin<0)messages.push('El margen acumulado es negativo; conviene revisar costos de maquinaria, combustible y flete.');
    else if(economics.income>0)messages.push(`El margen bruto acumulado es ${economics.money(economics.margin)}.`);
    if(!geometryFor(lot.id))messages.push('Falta georreferenciar el lote para integrar mapas, NDVI y aplicaciones por ambiente.');
    return messages.length?messages.join(' '):'Todavía faltan datos productivos para generar una recomendación confiable. Registre cortes, riegos y vuelos para activar el análisis.';
  }


  function daysSince(value) {
    if(!value) return null;
    const time=new Date(`${String(value).slice(0,10)}T12:00:00`).getTime();
    return Number.isFinite(time)?Math.max(0,Math.floor((Date.now()-time)/86400000)):null;
  }

  function lotHealth({lot,analysis,daysCut,daysIrrigation,margin}) {
    let score=70;
    if(analysis?.ndvi_avg!=null) score+=Number(analysis.ndvi_avg)>=.72?15:Number(analysis.ndvi_avg)<.55?-25:0;
    if(daysIrrigation!=null&&daysIrrigation>10) score-=10;
    if(daysCut!=null&&daysCut>38) score-=8;
    if(margin<0) score-=12;
    if(!geometryFor(lot.id)) score-=8;
    score=Math.max(0,Math.min(100,score));
    if(score>=80)return{label:'Excelente',className:'excellent',icon:'🟢',score};
    if(score>=60)return{label:'Estable',className:'stable',icon:'🟡',score};
    return{label:'Requiere atención',className:'critical',icon:'🔴',score};
  }

  function phenologyLabel(lot,daysCut) {
    if(!String(lot.crop||'').toLowerCase().includes('alfalfa'))return 'Seguimiento general';
    if(daysCut==null)return 'Sin historial';
    if(daysCut<8)return 'Rebrote inicial';
    if(daysCut<18)return 'Desarrollo vegetativo';
    if(daysCut<28)return 'Prebotón / seguimiento';
    if(daysCut<36)return 'Ventana probable de corte';
    return 'Corte a revisar';
  }

  function openDetails(lot) {
    const analyses=related(state.analyses,lot.id).sort((a,b)=>String(b.flight_date||'').localeCompare(String(a.flight_date||'')));
    const irrigations=related(state.irrigations,lot.id).sort((a,b)=>String(b.event_date||b.irrigation_date||'').localeCompare(String(a.event_date||a.irrigation_date||'')));
    const cuts=related(state.cuts,lot.id).sort((a,b)=>String(b.cut_date||'').localeCompare(String(a.cut_date||'')));
    const orders=related(state.orders,lot.id).sort((a,b)=>String(b.order_date||'').localeCompare(String(a.order_date||'')));
    const a=analyses[0], level=vigor(a?.ndvi_avg);
    const rollCount=cuts.reduce((s,c)=>s+num(c.rolls||c.bales),0),kg=cuts.reduce((s,c)=>s+num(c.total_kg),0),hectares=num(lot.hectares||lot.area_ha);
    const production=cuts.map(c=>({cut:c,meta:cutMeta(c)}));
    const costKeys=['fuel_cost','tractor_cost','mower_cost','rake_cost','baler_cost','labor_cost','machinery_cost','freight_cost','repairs_cost','other_cost'];
    const cost=production.reduce((sum,x)=>sum+costKeys.reduce((s,k)=>s+num(x.meta[k]),0),0);
    const income=production.reduce((sum,x)=>{const rolls=num(x.cut.rolls||x.cut.bales),tons=num(x.cut.total_kg)/1000,sold=num(x.meta.sold_rolls),perRoll=num(x.meta.sale_price_per_roll),perTon=num(x.meta.sale_price_per_ton);return sum+(perRoll?sold*perRoll:perTon?tons*perTon:0)},0);
    const margin=income-cost, stockRolls=production.reduce((sum,x)=>sum+Math.max(0,num(x.cut.rolls||x.cut.bales)-num(x.meta.sold_rolls)),0);
    const money=value=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(num(value));
    const economics={rolls:rollCount,hectares,income,cost,margin,money};
    const lastCutDate=cuts[0]?.cut_date||lot.last_cut;
    const lastIrrigationDate=irrigations[0]?.event_date||irrigations[0]?.irrigation_date||lot.last_irrigation;
    const daysCut=daysSince(lastCutDate),daysIrrigation=daysSince(lastIrrigationDate);
    const soilMoisture=lot.soil_moisture!=null?num(lot.soil_moisture):null;
    const avgYield=production.length&&hectares?production.reduce((sum,x)=>sum+(num(x.cut.rolls||x.cut.bales)/Math.max(.01,num(x.meta.hectares||hectares))),0)/production.length:0;
    const projectedYield=avgYield||6;
    const projectedRolls=Math.round(projectedYield*hectares);
    const confidence=production.length>=4?'Alta':production.length>=2?'Media':'Inicial';
    const nextCutMin=daysCut==null?null:Math.max(0,26-daysCut),nextCutMax=daysCut==null?null:Math.max(0,32-daysCut);
    const health=lotHealth({lot,analysis:a,daysCut,daysIrrigation,margin});
    const phenology=phenologyLabel(lot,daysCut);
    const events=[
      ...analyses.map(x=>({category:'analysis',date:x.flight_date,icon:'🛰️',type:'Vuelo multiespectral',title:`NDVI ${num(x.ndvi_avg).toFixed(2)}`,detail:x.recommendation||x.observations||'Análisis procesado'})),
      ...irrigations.map(x=>({category:'irrigation',date:x.event_date||x.irrigation_date,icon:'💧',type:'Riego',title:`${num(x.millimeters).toFixed(1)} mm · ${num(x.hours).toFixed(1)} h`,detail:x.notes||x.event_type||'Riego registrado'})),
      ...production.map(x=>({category:'cut',date:x.cut.cut_date,icon:'✂️',type:`Corte ${x.meta.cut_number||''}`.trim(),title:`${num(x.cut.rolls||x.cut.bales)} rollos · ${(num(x.cut.total_kg)/1000).toLocaleString('es-AR',{maximumFractionDigits:1})} t`,detail:`${x.meta.quality||'Sin calidad'} · ${x.meta.destination||'Sin destino'}`})),
      ...orders.map(x=>({category:'order',date:x.order_date,icon:'🚁',type:'Orden T100',title:`${escapeHtml(x.application_type||'Aplicación')} · ${escapeHtml(x.status||'')}`,detail:`${num(x.hectares).toLocaleString('es-AR',{maximumFractionDigits:1})} ha · ${escapeHtml(x.product||'Sin producto')}`}))
    ].filter(x=>x.date).sort((x,y)=>String(y.date).localeCompare(String(x.date)));
    const photos=production.flatMap(x=>(Array.isArray(x.meta.photos)?x.meta.photos:[]).map(path=>({path,date:x.cut.cut_date,label:`Corte ${x.meta.cut_number||''}`}))).slice(0,12);
    const orderedProduction=production.slice().reverse();
    const chartSeries={
      yield:orderedProduction.map(x=>({label:`C${x.meta.cut_number||'?'}`,value:num(x.meta.hectares||hectares)?num(x.cut.rolls||x.cut.bales)/num(x.meta.hectares||hectares):0})),
      tons:orderedProduction.map(x=>({label:`C${x.meta.cut_number||'?'}`,value:num(x.cut.total_kg)/1000})),
      margin:orderedProduction.map(x=>{const rolls=num(x.cut.rolls||x.cut.bales),tons=num(x.cut.total_kg)/1000,sold=num(x.meta.sold_rolls),perRoll=num(x.meta.sale_price_per_roll),perTon=num(x.meta.sale_price_per_ton),cutIncome=perRoll?sold*perRoll:perTon?tons*perTon:0,cutCost=costKeys.reduce((sum,key)=>sum+num(x.meta[key]),0);return{label:`C${x.meta.cut_number||'?'}`,value:cutIncome-cutCost}}),
      ndvi:analyses.slice().reverse().map((x,index)=>({label:`V${index+1}`,value:num(x.ndvi_avg)}))
    };
    const chartLabels={yield:'rollos/ha',tons:'toneladas',margin:'margen ARS',ndvi:'NDVI'};
    const chartHtml=metric=>{const rows=chartSeries[metric]||[],max=Math.max(1,...rows.map(x=>Math.abs(x.value)));return rows.length?rows.slice(-10).map(x=>`<div class="${x.value<0?'negative':''}"><b>${metric==='margin'?money(x.value):x.value.toLocaleString('es-AR',{maximumFractionDigits:metric==='ndvi'?2:1})}</b><i><em style="height:${Math.max(5,Math.abs(x.value)/max*100)}%"></em></i><span>${x.label}</span></div>`).join(''):'<p class="muted">Sin datos para comparar.</p>'};
    const files=[...analyses.flatMap(x=>[{path:x.map_file_path,label:'Mapa procesado',date:x.flight_date,kind:'Mapa NDVI'},{path:x.source_file_path,label:'Archivo fuente',date:x.flight_date,kind:'Datos de vuelo'}]),...photos.map(x=>({path:x.path,label:x.label,date:x.date,kind:'Fotografía'}))].filter(x=>x.path).slice(0,18);
    openModal(`<div class="lot-command"><div class="lot-command-head"><div><p class="eyebrow">LOTE 360 · VERSIÓN 8.0.0</p><h2>${escapeHtml(lot.name)}</h2><p class="muted">${escapeHtml(lot.crop||'Sin cultivo')} · ${escapeHtml(lot.variety||'Sin variedad')} · ${ha(hectares)} ha</p></div><div class="actions"><span class="lot-health ${health.className}">${health.icon} ${health.label}</span><button class="secondary editLotFromDetail">Editar</button></div></div>
      <div class="lot-command-overview"><div class="lot-command-kpis lot-kpis-enterprise"><div><span>NDVI actual</span><b>${a?num(a.ndvi_avg).toFixed(2):'—'}</b><small>${a?level[0]:'Sin análisis'}</small></div><div><span>Humedad de suelo</span><b>${soilMoisture!=null?`${soilMoisture.toFixed(1)}%`:'—'}</b><small>${soilMoisture==null?'Sin sensor o medición':'última medición'}</small></div><div><span>Días desde corte</span><b>${daysCut==null?'—':daysCut}</b><small>${phenology}</small></div><div><span>Días desde riego</span><b>${daysIrrigation==null?'—':daysIrrigation}</b><small>${date(lastIrrigationDate)}</small></div><div><span>Producción acumulada</span><b>${rollCount.toLocaleString('es-AR')} rollos</b><small>${(kg/1000).toLocaleString('es-AR',{maximumFractionDigits:1})} toneladas</small></div><div><span>Stock estimado</span><b>${stockRolls.toLocaleString('es-AR')} rollos</b><small>según ventas registradas</small></div><div class="${margin<0?'negative':margin>0?'positive':''}"><span>Margen bruto</span><b>${money(margin)}</b><small>ingresos ${money(income)} · costos ${money(cost)}</small></div><div class="lot-health-kpi ${health.className}"><span>Estado integral</span><b>${health.score}/100</b><small>${health.label}</small></div></div>${lotMapSvg(lot)}</div>
      <div class="lot-command-actions lot-event-actions"><div class="lot-event-menu-wrap"><button class="primary detailNewEvent">＋ Nuevo evento</button><div class="lot-event-menu" hidden><button type="button" data-event="cut">✂️ Registrar corte</button><button type="button" data-event="irrigation">💧 Registrar riego</button><button type="button" data-event="order">🚁 Crear orden T100</button><button type="button" data-event="flight">🛰️ Importar vuelo</button></div></div><button class="secondary detailGoMap">Abrir GIS</button></div>
      <div class="lot-command-grid"><section class="panel"><div class="panel-title"><div><p class="eyebrow">HISTORIA CLÍNICA PRODUCTIVA</p><h3>Cronología unificada</h3></div><span class="pill">${events.length} eventos</span></div><div class="lot-timeline-filters"><button class="secondary active" data-filter="all">Todos</button><button class="secondary" data-filter="cut">Cortes</button><button class="secondary" data-filter="irrigation">Riegos</button><button class="secondary" data-filter="analysis">Vuelos</button><button class="secondary" data-filter="order">T100</button></div><div class="lot-master-timeline">${events.slice(0,24).map(e=>`<article data-category="${e.category}"><i>${e.icon}</i><div><span>${escapeHtml(e.type)}</span><b>${e.title}</b><small>${escapeHtml(e.detail)}</small></div><time>${date(e.date)}</time></article>`).join('')||'<div class="empty">Todavía no hay actividades registradas.</div>'}</div></section>
      <aside class="lot-command-side"><section class="panel lot-ai-enterprise"><div class="panel-title"><div><p class="eyebrow">LM AI PREDICTIVO</p><h3>Diagnóstico operativo</h3></div><span class="lot-health ${health.className}">${health.icon} ${health.label}</span></div><p class="lot-ai-text">${escapeHtml(aiLotAdvice(lot,cuts,analyses,irrigations,economics))}</p><div class="lot-ai-prediction"><span>Producción orientativa próximo corte</span><b>${projectedRolls.toLocaleString('es-AR')} rollos</b><small>${projectedYield.toLocaleString('es-AR',{maximumFractionDigits:1})} rollos/ha · confianza ${confidence.toLowerCase()}</small></div><div class="lot-ai-prediction"><span>Ventana orientativa de corte</span><b>${nextCutMin==null?'Faltan datos':nextCutMin===0?'Revisar ahora':`${nextCutMin}–${nextCutMax} días`}</b><small>estimación basada en historial y días transcurridos</small></div><div class="lot-ai-next"><span>Próxima tarea</span><b>${escapeHtml(lot.next_task||(!geometryFor(lot.id)?'Georreferenciar lote':'Definir recorrida y actualizar ficha'))}</b></div></section>
      <section class="panel"><div class="panel-title"><h3>Evolución del lote</h3><span id="lotChartUnit" class="pill">${chartLabels.yield}</span></div><div class="lot-chart-tabs"><button class="secondary active" data-metric="yield">Rendimiento</button><button class="secondary" data-metric="tons">Toneladas</button><button class="secondary" data-metric="ndvi">NDVI</button><button class="secondary" data-metric="margin">Margen</button></div><div id="lotDynamicChart" class="lot-yield-chart">${chartHtml('yield')}</div></section></aside></div>
      <section class="panel lot-gallery-panel"><div class="panel-title"><div><p class="eyebrow">ARCHIVOS DEL LOTE</p><h3>Fotos, mapas y documentos</h3></div><span class="pill">${files.length} archivos</span></div><div class="lot-file-tabs"><button class="secondary active" data-file-filter="all">Todos</button><button class="secondary" data-file-filter="Fotografía">Fotos</button><button class="secondary" data-file-filter="Mapa NDVI">Mapas</button><button class="secondary" data-file-filter="Datos de vuelo">Datos</button></div><div class="lot-photo-grid">${files.map((file,index)=>`<button type="button" class="lot-photo lot-file" data-kind="${escapeHtml(file.kind)}" data-path="${escapeHtml(file.path)}"><span>${file.kind==='Fotografía'?'📷':file.kind==='Mapa NDVI'?'🗺️':'📄'}</span><b>${escapeHtml(file.label)}</b><small>${date(file.date)} · ${escapeHtml(file.kind)}</small></button>`).join('')||'<div class="empty">Los archivos de Producción y Vuelos aparecerán aquí.</div>'}</div></section>
      <section class="panel"><div class="panel-title"><h3>Ficha agronómica</h3><span class="pill">Registro maestro</span></div><div class="lot-facts-grid"><div><span>Campaña</span><b>${escapeHtml(lot.campaign||'Sin informar')}</b></div><div><span>Ambiente / sector</span><b>${escapeHtml(lot.management_zone||'Sin informar')}</b></div><div><span>Tipo de suelo</span><b>${escapeHtml(lot.soil_type||'Sin informar')}</b></div><div><span>Responsable</span><b>${escapeHtml(lot.manager_name||'Sin asignar')}</b></div><div><span>Implantación</span><b>${date(lot.sowing_date)}</b></div><div><span>Tipo de riego</span><b>${escapeHtml(lot.irrigation_type||lot.irrigation||'Sin informar')}</b></div><div><span>Último riego</span><b>${date(irrigations[0]?.event_date||irrigations[0]?.irrigation_date||lot.last_irrigation)}</b></div><div><span>Último corte</span><b>${date(cuts[0]?.cut_date||lot.last_cut)}</b></div><div><span>Humedad de suelo</span><b>${lot.soil_moisture!=null?`${num(lot.soil_moisture).toFixed(1)}%`:'Sin datos'}</b></div><div><span>Geometría</span><b>${geometryFor(lot.id)?'Georreferenciado':'Pendiente'}</b></div></div><p class="muted lot-notes">${escapeHtml(lot.notes||'Sin observaciones generales.')}</p></section></div>`);
    const eventButton=select('.detailNewEvent'),eventMenu=select('.lot-event-menu');
    eventButton.onclick=()=>{eventMenu.hidden=!eventMenu.hidden};
    eventMenu.querySelectorAll('button[data-event]').forEach(button=>button.onclick=()=>{const type=button.dataset.event;eventMenu.hidden=true;if(type==='cut')openCutModal(lot);if(type==='irrigation')openIrrigationModal(lot);if(type==='order'&&openOrder)openOrder({lot_id:lot.id,hectares});if(type==='flight'){select('#modalRoot').innerHTML='';state.page='flights';state.selectedLotId=lot.id;render()}});
    select('.editLotFromDetail').onclick=()=>openEditor(lot);
    document.querySelectorAll('.detailGoMap,.openLotMap').forEach(button=>button.onclick=()=>{select('#modalRoot').innerHTML='';state.page='map';state.selectedLotId=lot.id;render()});
    document.querySelectorAll('.lot-photo').forEach(button=>button.onclick=async()=>{const path=button.dataset.path;if(!path)return;const {data,error}=await supabase.storage.from('precision-files').createSignedUrl(path,300);if(error)return alert(error.message);window.open(data.signedUrl,'_blank')});
    document.querySelectorAll('.lot-timeline-filters button').forEach(button=>button.onclick=()=>{document.querySelectorAll('.lot-timeline-filters button').forEach(x=>x.classList.toggle('active',x===button));const filter=button.dataset.filter;document.querySelectorAll('.lot-master-timeline article').forEach(item=>item.hidden=filter!=='all'&&item.dataset.category!==filter)});
    document.querySelectorAll('.lot-chart-tabs button').forEach(button=>button.onclick=()=>{document.querySelectorAll('.lot-chart-tabs button').forEach(x=>x.classList.toggle('active',x===button));const metric=button.dataset.metric;select('#lotChartUnit').textContent=chartLabels[metric];select('#lotDynamicChart').innerHTML=chartHtml(metric)});
    document.querySelectorAll('.lot-file-tabs button').forEach(button=>button.onclick=()=>{document.querySelectorAll('.lot-file-tabs button').forEach(x=>x.classList.toggle('active',x===button));const filter=button.dataset.fileFilter;document.querySelectorAll('.lot-file').forEach(item=>item.hidden=filter!=='all'&&item.dataset.kind!==filter)});
  }

  function bind() {
    if (state.page !== 'lots') return;
    const rerender=()=>render();
    const search=select('#lotSearch'); if(search) search.oninput=e=>{ui.query=e.target.value;rerender()};
    [['#lotCrop','crop'],['#lotStatus','status'],['#lotGeometry','geometry'],['#lotSort','sort']].forEach(([selector,key])=>{const el=select(selector);if(el)el.onchange=e=>{ui[key]=e.target.value;rerender()}});
    document.querySelectorAll('.lotView').forEach(b=>b.onclick=()=>{ui.view=b.dataset.view;render()});
    const clear=select('.clearLotFilters');if(clear)clear.onclick=()=>{Object.assign(ui,{query:'',crop:'',status:'Activo',geometry:'',sort:'name'});render()};
  }

  return { renderPage, bind, openEditor, openDetails };
}

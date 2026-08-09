function parseCutMetadata(cut) {
  try {
    const notes = String(cut.notes || '');
    if (!notes.startsWith('LMOS_CUT:')) return { observations: notes };
    return JSON.parse(notes.slice(9));
  } catch (_error) {
    return { observations: String(cut.notes || '') };
  }
}

function normalizeCut(cut) {
  const metadata = parseCutMetadata(cut);
  const rolls = Number(cut.bales || cut.rolls || 0);
  const kg = Number(cut.total_kg || 0);
  const hectares = Number(metadata.hectares || 0);
  return {
    ...cut,
    ...metadata,
    rolls,
    kg,
    hectares,
    weight: rolls ? kg / rolls : Number(metadata.weight || 500),
    quality: metadata.quality || 'Sin clasificar',
    destination: metadata.destination || 'Stock',
    cut_number: Number(metadata.cut_number || 0),
    campaign: metadata.campaign || new Date(cut.cut_date || Date.now()).getFullYear().toString(),
    operator: metadata.operator || '',
    equipment: metadata.equipment || '',
    contractor: metadata.contractor || '',
    humidity: Number(metadata.humidity || 0),
    weather: metadata.weather || '',
    crop_status: metadata.crop_status || '',
    work_hours: Number(metadata.work_hours || 0),
    fuel_liters: Number(metadata.fuel_liters || 0),
    fuel_price_per_liter: Number(metadata.fuel_price_per_liter || 0),
    tractor_name: metadata.tractor_name || '',
    mower_name: metadata.mower_name || '',
    rake_name: metadata.rake_name || '',
    baler_name: metadata.baler_name || '',
    fertilizer_product: metadata.fertilizer_product || '',
    fertilizer_kg: Number(metadata.fertilizer_kg || 0),
    fuel_cost: Number(metadata.fuel_cost || 0),
    labor_cost: Number(metadata.labor_cost || 0),
    machinery_cost: Number(metadata.machinery_cost || 0),
    tractor_cost: Number(metadata.tractor_cost || 0),
    mower_cost: Number(metadata.mower_cost || 0),
    rake_cost: Number(metadata.rake_cost || 0),
    baler_cost: Number(metadata.baler_cost || 0),
    freight_cost: Number(metadata.freight_cost || 0),
    repairs_cost: Number(metadata.repairs_cost || 0),
    other_cost: Number(metadata.other_cost || 0),
    stock_value_per_roll: Number(metadata.stock_value_per_roll || 0),
    sale_price_per_roll: Number(metadata.sale_price_per_roll || 0),
    sale_price_per_ton: Number(metadata.sale_price_per_ton || 0),
    protein: Number(metadata.protein || 0),
    fda: Number(metadata.fda || 0),
    fdn: Number(metadata.fdn || 0),
    leaf_pct: Number(metadata.leaf_pct || 0),
    weeds_pct: Number(metadata.weeds_pct || 0),
    forage_color: metadata.forage_color || '',
    photos: Array.isArray(metadata.photos) ? metadata.photos : [],
    sold_rolls: Number(metadata.sold_rolls || (metadata.destination === 'Venta' ? rolls : 0)),
    expected_cuts_year: Number(metadata.expected_cuts_year || 10),
    customer: metadata.customer || '',
    payment_method: metadata.payment_method || '',
    collection_date: metadata.collection_date || '',
    batch_code: metadata.batch_code || '',
    storage_location: metadata.storage_location || 'Sin asignar',
    operational_status: metadata.operational_status || 'En stock',
    baling_date: metadata.baling_date || cut.cut_date || '',
    stock_movements: Array.isArray(metadata.stock_movements) ? metadata.stock_movements : [],
  };
}

export function createProductionModule({ state, supabase, select, escapeHtml, openModal, loadData, render }) {
  const filters = { search: '', lotId: '', quality: '', destination: '', campaign: '' };
  const normalizedCuts = () => state.cuts.map(normalizeCut).sort((a,b)=>String(b.cut_date||'').localeCompare(String(a.cut_date||'')));
  const money = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0));
  const number = (value, digits=1) => new Intl.NumberFormat('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value || 0));
  const cutCost = cut => ['fuel_cost','labor_cost','machinery_cost','tractor_cost','mower_cost','rake_cost','baler_cost','freight_cost','repairs_cost','other_cost'].reduce((sum,key)=>sum+Number(cut[key]||0),0);
  const cutRevenue = cut => { const sold=Number(cut.sold_rolls||0), soldKg=sold*Number(cut.weight||0); return Number(cut.sale_price_per_ton||0)>0 ? (soldKg/1000)*Number(cut.sale_price_per_ton) : sold*Number(cut.sale_price_per_roll||0); };
  const movementBalance = cut => (cut.stock_movements || []).reduce((sum,m)=>sum+(m.type==='Ingreso'?Number(m.quantity||0):-Number(m.quantity||0)),0);
  const stockRollsOf = cut => Math.max(0, cut.rolls - Number(cut.sold_rolls || 0) + movementBalance(cut));
  const rfvOf = cut => {
    const adf=Number(cut.fda||0), ndf=Number(cut.fdn||0);
    if(!(adf>0&&ndf>0)) return 0;
    const digestibleDryMatter=88.9-(0.779*adf);
    const dryMatterIntake=120/ndf;
    return Math.max(0,(digestibleDryMatter*dryMatterIntake)/1.29);
  };
  const qualityClass = rfv => rfv>=185?'Supreme':rfv>=170?'Premium':rfv>=150?'Primera':rfv>=130?'Segunda':rfv>0?'Regular':'Sin análisis';
  const daysBetween = (from,to=new Date()) => {
    if(!from) return null;
    const a=new Date(`${String(from).slice(0,10)}T12:00:00`), b=to instanceof Date?to:new Date(`${String(to).slice(0,10)}T12:00:00`);
    return Math.max(0,Math.floor((b-a)/86400000));
  };

  function filteredCuts() {
    const term = filters.search.trim().toLowerCase();
    return normalizedCuts().filter(cut => {
      const lot = state.lots.find(item => item.id === cut.lot_id);
      return (!term || [lot?.name, cut.observations, cut.quality, cut.destination, cut.campaign].some(value => String(value || '').toLowerCase().includes(term)))
        && (!filters.lotId || cut.lot_id === filters.lotId)
        && (!filters.quality || cut.quality === filters.quality)
        && (!filters.destination || cut.destination === filters.destination)
        && (!filters.campaign || cut.campaign === filters.campaign);
    });
  }

  function metrics(cuts) {
    const rolls = cuts.reduce((sum, cut) => sum + cut.rolls, 0);
    const kg = cuts.reduce((sum, cut) => sum + cut.kg, 0);
    const hectares = cuts.reduce((sum, cut) => sum + cut.hectares, 0);
    const stockRolls = cuts.reduce((sum, cut) => sum + stockRollsOf(cut), 0);
    const totalCost = cuts.reduce((sum, cut) => sum + cutCost(cut), 0);
    const revenue = cuts.reduce((sum, cut) => sum + cutRevenue(cut), 0);
    const stockValue = cuts.reduce((sum, cut) => sum + stockRollsOf(cut) * Number(cut.stock_value_per_roll || cut.sale_price_per_roll || 0), 0);
    const workHours = cuts.reduce((sum, cut) => sum + Number(cut.work_hours || 0), 0);
    const fuelLiters = cuts.reduce((sum, cut) => sum + Number(cut.fuel_liters || 0), 0);
    return { rolls, kg, hectares, stockRolls, totalCost, revenue, stockValue, workHours, fuelLiters, margin: revenue-totalCost,
      rollsPerHa: hectares ? rolls/hectares : 0, kgPerHa: hectares ? kg/hectares : 0,
      hoursPerHa: hectares ? workHours/hectares : 0, litersPerHa: hectares ? fuelLiters/hectares : 0,
      costPerRoll: rolls ? totalCost/rolls : 0, costPerHa: hectares ? totalCost/hectares : 0,
      costPerTon: kg ? totalCost/(kg/1000) : 0, averageWeight: rolls ? kg/rolls : 0 };
  }

  function lotPerformance(cuts) {
    return state.lots.filter(l=>String(l.crop||'').toLowerCase().includes('alfalfa')).map(lot=>{
      const rows=cuts.filter(c=>c.lot_id===lot.id), m=metrics(rows);
      const completedCuts=new Set(rows.map(c=>`${c.campaign}-${c.cut_number||c.cut_date}`)).size;
      const expected=rows[0]?.expected_cuts_year || 10;
      const annualProjection=completedCuts ? (m.rolls/completedCuts)*expected : 0;
      return { lot, ...m, completedCuts, expected, annualProjection };
    }).sort((a,b)=>b.rollsPerHa-a.rollsPerHa);
  }

  function periodMetrics(cuts) {
    const today = new Date().toISOString().slice(0,10), month=today.slice(0,7), year=today.slice(0,4);
    const yearCuts=cuts.filter(c=>String(c.cut_date||'').startsWith(year));
    const distinctCuts=new Set(yearCuts.map(c=>`${c.lot_id}-${c.cut_number||c.cut_date}`)).size;
    const expected=yearCuts[0]?.expected_cuts_year || 10;
    const projection=distinctCuts ? (yearCuts.reduce((s,c)=>s+c.rolls,0)/distinctCuts)*expected*Math.max(1,new Set(yearCuts.map(c=>c.lot_id)).size) : 0;
    return { todayRolls:cuts.filter(c=>c.cut_date===today).reduce((s,c)=>s+c.rolls,0), monthRolls:cuts.filter(c=>String(c.cut_date||'').startsWith(month)).reduce((s,c)=>s+c.rolls,0), yearKg:yearCuts.reduce((s,c)=>s+c.kg,0), annualProjection:projection };
  }

  function exportCsv() {
    const header=['Fecha','Campaña','Lote','Corte','Hectáreas','Rollos','Kg','Rollos/ha','Kg/ha','Calidad','Destino','Cliente','Forma de pago','Fecha de cobro','Vendidos','Precio/rollo','Precio/tonelada','Proteína','FDA','FDN','Hoja %','Malezas %','Ingreso','Costo total','Margen','Costo/rollo','Observaciones'];
    const rows=filteredCuts().map(c=>{const lot=state.lots.find(l=>l.id===c.lot_id);return [c.cut_date,c.campaign,lot?.name||'',c.cut_number,c.hectares,c.rolls,c.kg,c.hectares?(c.rolls/c.hectares).toFixed(2):'',c.hectares?(c.kg/c.hectares).toFixed(0):'',c.quality,c.destination,c.customer,c.payment_method,c.collection_date,c.sold_rolls,c.sale_price_per_roll,c.sale_price_per_ton,c.protein,c.fda,c.fdn,c.leaf_pct,c.weeds_pct,cutRevenue(c),cutCost(c),cutRevenue(c)-cutCost(c),c.rolls?cutCost(c)/c.rolls:0,c.observations]});
    const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;const blob=new Blob([`\ufeff${[header,...rows].map(r=>r.map(q).join(';')).join('\n')}`],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`produccion-alfalfa-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
  }

  function renderFilters() {
    const cuts=normalizedCuts(), qualities=[...new Set(cuts.map(c=>c.quality))].sort(), destinations=[...new Set(cuts.map(c=>c.destination))].sort(), campaigns=[...new Set(cuts.map(c=>c.campaign))].sort().reverse();
    return `<div class="panel production-filters"><div class="production-filter-grid enterprise"><label>Buscar<input id="productionSearch" value="${escapeHtml(filters.search)}" placeholder="Lote, calidad u observación"></label><label>Campaña<select id="productionCampaignFilter"><option value="">Todas</option>${campaigns.map(v=>`<option ${filters.campaign===v?'selected':''}>${escapeHtml(v)}</option>`).join('')}</select></label><label>Lote<select id="productionLotFilter"><option value="">Todos</option>${state.lots.map(l=>`<option value="${l.id}" ${filters.lotId===l.id?'selected':''}>${escapeHtml(l.name)}</option>`).join('')}</select></label><label>Calidad<select id="productionQualityFilter"><option value="">Todas</option>${qualities.map(v=>`<option ${filters.quality===v?'selected':''}>${escapeHtml(v)}</option>`).join('')}</select></label><label>Destino<select id="productionDestinationFilter"><option value="">Todos</option>${destinations.map(v=>`<option ${filters.destination===v?'selected':''}>${escapeHtml(v)}</option>`).join('')}</select></label><button id="clearProductionFilters" class="secondary production-clear">Limpiar</button></div></div>`;
  }

  function renderEvolution(cuts) {
    const selected = filters.lotId || state.lots.find(l=>String(l.crop||'').toLowerCase().includes('alfalfa'))?.id || '';
    const lot = state.lots.find(l=>l.id===selected);
    const rows = normalizedCuts().filter(c=>c.lot_id===selected).sort((a,b)=>String(a.cut_date||'').localeCompare(String(b.cut_date||''))).slice(-10);
    const values = rows.map(c=>c.hectares?c.rolls/c.hectares:0), max=Math.max(1,...values);
    const bars = rows.map((c,i)=>`<div class="production-trend-row"><span>${c.cut_number?`${c.cut_number}° corte`:escapeHtml(c.cut_date)}</span><div class="production-trend-track"><i style="width:${Math.max(3,values[i]/max*100)}%"></i></div><b>${number(values[i],1)} rollos/ha</b></div>`).join('');
    return `<div class="panel production-evolution"><div class="panel-title"><div><p class="eyebrow">EVOLUCIÓN DEL LOTE</p><h3>${escapeHtml(lot?.name||'Seleccione un lote')}</h3></div><span class="pill">${rows.length} cortes</span></div>${bars||'<div class="empty">Elegí un lote en los filtros o registrá cortes para ver su evolución.</div>'}</div>`;
  }

  function renderQualityLaboratory(cuts) {
    const analysed=cuts.filter(c=>Number(c.protein||0)>0||Number(c.fda||0)>0||Number(c.fdn||0)>0);
    const avg=key=>analysed.length?analysed.reduce((sum,c)=>sum+Number(c[key]||0),0)/analysed.length:0;
    const rfvRows=analysed.map(c=>({...c,rfv:rfvOf(c)})).filter(c=>c.rfv>0);
    const avgRfv=rfvRows.length?rfvRows.reduce((s,c)=>s+c.rfv,0)/rfvRows.length:0;
    const best=[...rfvRows].sort((a,b)=>b.rfv-a.rfv)[0];
    const bestLot=best?state.lots.find(l=>l.id===best.lot_id):null;
    return `<div class="panel production-quality-lab"><div class="panel-title"><div><p class="eyebrow">CALIDAD DEL FORRAJE</p><h3>Laboratorio y valor relativo</h3></div><span class="pill">${analysed.length} análisis</span></div><div class="quality-kpis"><div><span>Proteína promedio</span><b>${analysed.length?`${number(avg('protein'),1)}%`:'—'}</b></div><div><span>FDA promedio</span><b>${analysed.length?`${number(avg('fda'),1)}%`:'—'}</b></div><div><span>FDN promedio</span><b>${analysed.length?`${number(avg('fdn'),1)}%`:'—'}</b></div><div><span>RFV promedio</span><b>${avgRfv?number(avgRfv,0):'—'}</b><small>${qualityClass(avgRfv)}</small></div></div>${best?`<div class="quality-best"><div><span>Mejor calidad registrada</span><b>${escapeHtml(bestLot?.name||'Lote')} · Corte ${best.cut_number||'—'}</b></div><strong>RFV ${number(best.rfv,0)} · ${qualityClass(best.rfv)}</strong></div>`:'<div class="status">Cargá proteína, FDA y FDN en un corte para calcular RFV y comparar calidad.</div>'}</div>`;
  }

  function renderCutCalendar(cuts) {
    const today=new Date();
    const alfalfaLots=state.lots.filter(l=>String(l.crop||'').toLowerCase().includes('alfalfa'));
    const rows=alfalfaLots.map(lot=>{
      const history=normalizedCuts().filter(c=>c.lot_id===lot.id).sort((a,b)=>String(b.cut_date||'').localeCompare(String(a.cut_date||'')));
      const last=history[0];
      const elapsed=daysBetween(last?.cut_date,today);
      const cycle=Number(lot.cut_cycle_days||lot.days_between_cuts||30);
      const remaining=elapsed==null?null:cycle-elapsed;
      const status=remaining==null?'Sin historial':remaining<=0?'Listo para revisar':remaining<=5?'Próximo':'En desarrollo';
      const cls=remaining!=null&&remaining<=0?'bad':remaining!=null&&remaining<=5?'warn':'';
      return {lot,last,elapsed,remaining,status,cls};
    }).sort((a,b)=>(a.remaining??999)-(b.remaining??999));
    return `<div class="panel production-calendar"><div class="panel-title"><div><p class="eyebrow">PLANIFICACIÓN</p><h3>Calendario estimado de cortes</h3></div><span class="pill">${rows.length} lotes</span></div><div class="cut-calendar-list">${rows.map(r=>`<article><div><b>${escapeHtml(r.lot.name)}</b><small>${r.last?`Último corte ${escapeHtml(r.last.cut_date)} · ${r.elapsed} días`:'Sin cortes registrados'}</small></div><div><span class="pill ${r.cls}">${r.status}</span><small>${r.remaining==null?'Registrar primer corte':r.remaining<=0?`${Math.abs(r.remaining)} días sobre la fecha estimada`:`Faltan aproximadamente ${r.remaining} días`}</small></div></article>`).join('')}</div><div class="status production-note">Estimación orientativa basada en un ciclo de 30 días o el ciclo configurado en cada lote. Confirmar estado fenológico, clima y humedad antes de cortar.</div></div>`;
  }

  function renderPage() {
    const cuts=filteredCuts(), totals=metrics(cuts), periods=periodMetrics(cuts), performance=lotPerformance(cuts), qualities=['Premium','Primera','Segunda','Descarte','Sin clasificar'];
    return `<div class="page-head"><div><p class="eyebrow">GESTIÓN COMPLETA DE CORTES · 10.0</p><h2>Producción, costos y rentabilidad</h2><p class="muted">Control integral de cortes, rendimiento, stock, ventas, margen y proyección anual.</p></div><div class="actions"><button class="secondary exportProduction">⇩ Exportar CSV</button><button class="primary newCut">＋ Registrar corte</button></div></div>
    <div class="metrics production-metrics enterprise"><div class="metric"><span>Producción acumulada</span><b>${totals.rolls.toLocaleString('es-AR')} rollos</b><small>${number(totals.kg/1000,1)} toneladas</small></div><div class="metric"><span>Rendimiento</span><b>${number(totals.rollsPerHa,1)}</b><small>rollos por ha</small></div><div class="metric"><span>Stock disponible</span><b>${totals.stockRolls.toLocaleString('es-AR')}</b><small>${money(totals.stockValue)} valorizado</small></div><div class="metric"><span>Ingresos registrados</span><b>${money(totals.revenue)}</b><small>ventas declaradas</small></div><div class="metric"><span>Margen bruto</span><b>${money(totals.margin)}</b><small>ingresos menos costos</small></div><div class="metric"><span>Proyección anual</span><b>${Math.round(periods.annualProjection).toLocaleString('es-AR')}</b><small>rollos estimados</small></div></div>
    <div class="production-cost-summary enterprise"><div><span>Costo total</span><b>${money(totals.totalCost)}</b></div><div><span>Costo por rollo</span><b>${money(totals.costPerRoll)}</b></div><div><span>Costo por hectárea</span><b>${money(totals.costPerHa)}</b></div><div><span>Costo por tonelada</span><b>${money(totals.costPerTon)}</b></div><div><span>Peso promedio</span><b>${number(totals.averageWeight,0)} kg</b></div></div>
    <div class="production-cost-summary enterprise production-efficiency-summary"><div><span>Horas trabajadas</span><b>${number(totals.workHours,1)} h</b></div><div><span>Horas por hectárea</span><b>${number(totals.hoursPerHa,2)} h/ha</b></div><div><span>Gasoil utilizado</span><b>${number(totals.fuelLiters,1)} L</b></div><div><span>Litros por hectárea</span><b>${number(totals.litersPerHa,1)} L/ha</b></div><div><span>Kg por hectárea</span><b>${number(totals.kgPerHa,0)} kg/ha</b></div></div>
    ${renderFilters()}
    <div class="grid2 production-insights-grid">${renderCutCalendar(cuts)}${renderQualityLaboratory(cuts)}</div>
    <div class="grid2 production-enterprise-grid"><div class="panel"><div class="panel-title"><div><p class="eyebrow">COMPARATIVO</p><h3>Rendimiento por lote</h3></div><span class="pill">${performance.length} lotes</span></div><div class="production-ranking">${performance.map((p,i)=>`<article><span class="rank">${i+1}</span><div><b>${escapeHtml(p.lot.name)}</b><small>${p.completedCuts} cortes · ${number(p.kg/1000,1)} t</small></div><div class="rank-value"><b>${number(p.rollsPerHa,1)} rollos/ha</b><small>Proy. ${Math.round(p.annualProjection)} rollos/año</small></div></article>`).join('')||'<p class="empty">Todavía no hay producción registrada.</p>'}</div></div>
    <div class="panel"><div class="panel-title"><div><p class="eyebrow">INVENTARIO</p><h3>Stock por calidad</h3></div><span class="pill">${totals.stockRolls} rollos</span></div>${qualities.map(q=>{const rows=cuts.filter(c=>c.quality===q), rolls=rows.reduce((s,c)=>s+stockRollsOf(c),0),kg=rows.reduce((s,c)=>s+(stockRollsOf(c)*c.weight),0),value=rows.reduce((s,c)=>s+stockRollsOf(c)*Number(c.stock_value_per_roll||c.sale_price_per_roll||0),0);return `<div class="row"><div><b>${q}</b><small>${number(kg/1000,1)} t · ${money(value)}</small></div><span class="pill">${rolls} rollos</span></div>`}).join('')}<div class="status production-note">El stock se calcula con toda la producción registrada, descontando los rollos vendidos o consumidos informados.</div></div></div>
    ${renderEvolution(cuts)}
    <div class="panel"><div class="panel-title"><div><h3>Historial económico y productivo</h3><small>Trazabilidad por lote, corte y partida</small></div><span class="pill">${cuts.length} registros</span></div>${cuts.length?`<div class="production-table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Lote</th><th>Partida</th><th>Corte</th><th>Rollos</th><th>Rinde</th><th>Calidad</th><th>Estado</th><th>Margen</th><th>Acciones</th></tr></thead><tbody>${cuts.map(c=>{const lot=state.lots.find(l=>l.id===c.lot_id),margin=cutRevenue(c)-cutCost(c);return `<tr><td>${escapeHtml(c.cut_date)}</td><td><b>${escapeHtml(lot?.name||'Sin lote')}</b><small>${escapeHtml(c.storage_location||'Sin asignar')}</small></td><td><span class="pill">${escapeHtml(c.batch_code||`CORTE-${String(c.id||'').slice(0,6).toUpperCase()}`)}</span></td><td>${c.cut_number||'—'}</td><td>${c.rolls}</td><td>${c.hectares?number(c.rolls/c.hectares,1):'—'}</td><td><span class="pill">${escapeHtml(c.quality)}</span></td><td>${escapeHtml(c.operational_status)}</td><td class="${margin<0?'negative':'positive'}">${money(margin)}</td><td><div class="actions compact"><button class="secondary cutDetail" data-id="${c.id}">Ver</button><button class="secondary cutMove" data-id="${c.id}">Stock</button><button class="secondary cutEdit" data-id="${c.id}">Editar</button><button class="secondary danger cutDelete" data-id="${c.id}">Eliminar</button></div></td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty"><b>No hay cortes registrados.</b><p>Registrá el primer corte para comenzar el seguimiento.</p></div>'}</div>`;
  }

  function lotMiniMap(lot) {
    const geometry = state.geometries?.find(item => item.lot_id === lot?.id)?.geojson;
    const raw = geometry?.geometry || geometry;
    let rings = raw?.type === 'Polygon' ? raw.coordinates : raw?.type === 'MultiPolygon' ? raw.coordinates?.flat(1) : null;
    const points = Array.isArray(rings?.[0]) ? rings[0] : null;
    if (!points?.length) return `<div class="production-lot-map empty-map"><span>🗺️</span><b>${escapeHtml(lot?.name||'Lote')}</b><small>Polígono pendiente</small></div>`;
    const xs=points.map(p=>Number(p[0])), ys=points.map(p=>Number(p[1])), minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys), dx=maxX-minX||1, dy=maxY-minY||1;
    const coords=points.map(([x,y])=>`${8+(Number(x)-minX)/dx*144},${92-(Number(y)-minY)/dy*76}`).join(' ');
    return `<div class="production-lot-map"><svg viewBox="0 0 160 100" role="img" aria-label="Polígono de ${escapeHtml(lot?.name||'lote')}"><polygon points="${coords}"></polygon><text x="80" y="55" text-anchor="middle">${escapeHtml(lot?.name||'Lote')}</text></svg><small>Polígono guardado en GIS</small></div>`;
  }

  function openCutEditor(seed={}) {
    const today=new Date().toISOString().slice(0,10), year=today.slice(0,4), defaultLotId=seed.lot_id||state.lots.find(l=>String(l.crop||'').toLowerCase().includes('alfalfa'))?.id||'';
    openModal(`<p class="eyebrow">GESTIÓN COMPLETA DE CORTES · 10.0</p><h2>Registrar nuevo corte</h2><form id="cutForm" class="production-cut-form"><div class="production-editor-layout"><div class="production-editor-fields"><div class="form-grid">
    <label>Fecha<input name="cut_date" type="date" value="${today}" required></label><label>Campaña<input name="campaign" value="${year}" required></label>
    <label>Lote<select name="lot_id" id="cutLot" required><option value="">Seleccionar lote</option>${state.lots.filter(l=>String(l.crop||'').toLowerCase().includes('alfalfa')).map(l=>`<option value="${l.id}" data-ha="${Number(l.hectares||l.area_ha||0)}" ${defaultLotId===l.id?'selected':''}>${escapeHtml(l.name)} · ${number(l.hectares||l.area_ha,2)} ha</option>`).join('')}</select></label>
    <label>Número de corte<input name="cut_number" type="number" min="1" max="20" value="1" required></label><label>Cortes previstos/año<input name="expected_cuts_year" type="number" min="1" max="20" value="10"></label><label>Superficie cortada (ha)<input id="cutHa" name="hectares" type="number" min="0.1" step="0.01" required></label>
    <div id="cutLotInfo" class="wide production-lot-info"><span>Seleccione un lote para cargar automáticamente su ficha técnica e historial.</span></div>
    <label>Rollos obtenidos<input id="cutRolls" name="rolls" type="number" min="0" step="1" required></label><label>Peso promedio por rollo (kg)<input id="cutWeight" name="weight" type="number" min="1" step="1" value="500" required></label>
    <label>Calidad<select name="quality"><option>Premium</option><option>Exportación</option><option>Lechero</option><option>Feedlot</option><option>Regular</option><option>Primera</option><option>Segunda</option><option>Descarte</option></select></label><label>Destino<select name="destination"><option>Stock</option><option>Venta</option><option>Consumo interno</option></select></label>
    <div class="wide production-form-section"><b>Calidad del forraje</b><div class="form-grid"><label>Proteína (%)<input name="protein" type="number" min="0" max="40" step="0.1"></label><label>FDA (%)<input name="fda" type="number" min="0" max="100" step="0.1"></label><label>FDN (%)<input name="fdn" type="number" min="0" max="100" step="0.1"></label><label>Humedad (%)<input name="humidity" type="number" min="0" max="100" step="0.1"></label><label>Hoja (%)<input name="leaf_pct" type="number" min="0" max="100" step="0.1"></label><label>Malezas (%)<input name="weeds_pct" type="number" min="0" max="100" step="0.1"></label><label>Color<select name="forage_color"><option value="">Sin evaluar</option><option>Verde intenso</option><option>Verde</option><option>Verde amarillento</option><option>Amarillento</option><option>Oscuro</option></select></label></div></div>
    <div class="wide production-form-section"><b>Venta e inventario</b><div class="form-grid"><label>Rollos vendidos<input id="soldRolls" name="sold_rolls" type="number" min="0" step="1" value="0"></label><label>Precio por rollo (ARS)<input id="salePrice" name="sale_price_per_roll" type="number" min="0" step="1" value="0"></label><label>Precio por tonelada (ARS)<input id="salePriceTon" name="sale_price_per_ton" type="number" min="0" step="1" value="0"></label><label>Valor de stock por rollo (ARS)<input name="stock_value_per_roll" type="number" min="0" step="1" value="0"></label><label>Cliente<input name="customer" placeholder="Nombre o razón social"></label><label>Forma de pago<select name="payment_method"><option value="">Sin informar</option><option>Contado</option><option>Transferencia</option><option>Cheque</option><option>Cuenta corriente</option><option>Canje</option></select></label><label>Fecha de cobro<input name="collection_date" type="date"></label></div><small class="muted">Si se informa precio por tonelada, tendrá prioridad para calcular los ingresos vendidos.</small></div>
    <div class="wide production-form-section"><b>Operación y maquinaria</b><div class="form-grid"><label>Operador<input name="operator"></label><label>Contratista<input name="contractor"></label><label>Estado del cultivo<select name="crop_status"><option value="">Sin evaluar</option><option>Vegetativo</option><option>Botón floral</option><option>Inicio de floración</option><option>Floración avanzada</option><option>Estresado</option><option>Con malezas</option></select></label><label>Clima<input name="weather" placeholder="Despejado, viento leve…"></label><label>Horas trabajadas<input name="work_hours" type="number" min="0" step="0.1" value="0"></label><label>Litros de gasoil<input id="fuelLiters" name="fuel_liters" type="number" min="0" step="0.1" value="0"></label><label>Precio gasoil por litro (ARS)<input id="fuelPrice" name="fuel_price_per_liter" type="number" min="0" step="0.01" value="0"></label><label>Tractor<input name="tractor_name" placeholder="Marca y modelo"></label><label>Segadora<input name="mower_name" placeholder="Marca y modelo"></label><label>Rastrillo<input name="rake_name" placeholder="Marca y modelo"></label><label>Rotoenfardadora<input name="baler_name" placeholder="Marca y modelo"></label><label>Equipo adicional<input name="equipment" placeholder="Acoplado, cargador…"></label><label>Fertilizante / insumo<input name="fertilizer_product" placeholder="Opcional"></label><label>Dosis total aplicada (kg)<input name="fertilizer_kg" type="number" min="0" step="0.1" value="0"></label></div></div>
    <div class="wide production-form-section"><b>Costos del corte (ARS)</b><div class="form-grid"><label>Costo combustible<input id="fuelCost" class="cut-cost" name="fuel_cost" type="number" min="0" step="0.01" value="0"><small class="muted">Se calcula con litros × precio, pero puede ajustarse.</small></label><label>Horas/uso tractor<input class="cut-cost" name="tractor_cost" type="number" min="0" value="0"></label><label>Segadora<input class="cut-cost" name="mower_cost" type="number" min="0" value="0"></label><label>Rastrillo<input class="cut-cost" name="rake_cost" type="number" min="0" value="0"></label><label>Rotoenfardadora<input class="cut-cost" name="baler_cost" type="number" min="0" value="0"></label><label>Mano de obra<input class="cut-cost" name="labor_cost" type="number" min="0" value="0"></label><label>Maquinaria adicional<input class="cut-cost" name="machinery_cost" type="number" min="0" value="0"></label><label>Flete<input class="cut-cost" name="freight_cost" type="number" min="0" value="0"></label><label>Reparaciones<input class="cut-cost" name="repairs_cost" type="number" min="0" value="0"></label><label>Otros<input class="cut-cost" name="other_cost" type="number" min="0" value="0"></label></div></div>
    <label class="wide">Fotografías del corte<input id="cutPhotos" name="photos" type="file" accept="image/*" multiple><small class="muted">Podés adjuntar fotos de andana, enfardado, rollos, carga o campo terminado.</small><div id="cutPhotoPreview" class="production-photo-preview"></div></label>
    <label class="wide">Observaciones<textarea name="observations"></textarea></label></div></div><aside class="production-editor-summary"><p class="eyebrow">RESULTADO EN TIEMPO REAL</p><div id="cutCalc" class="status production-calculator"></div><div class="production-summary-help"><b>Cómo usarlo</b><small>Elegí el lote y cargá rollos, peso, ventas y costos. Los indicadores se recalculan automáticamente.</small></div><button class="primary production-save-cut">Guardar corte</button><p id="cutMsg" class="error hidden"></p></aside></div></form>`);
    select('.modal')?.classList.add('production-modal');
    const selectedLot=()=>state.lots.find(l=>l.id===select('#cutLot')?.value);
    const updateLotInfo=()=>{const lot=selectedLot();if(!lot){select('#cutLotInfo').innerHTML='<span>Seleccione un lote para cargar automáticamente su ficha técnica e historial.</span>';return}const prior=normalizedCuts().filter(c=>c.lot_id===lot.id),last=prior[0],avg=prior.length?prior.reduce((sum,c)=>sum+(c.hectares?c.rolls/c.hectares:0),0)/prior.length:0,lastDate=last?.cut_date||lot.last_cut||'',days=lastDate?Math.max(0,Math.floor((Date.now()-new Date(`${lastDate}T12:00:00`).getTime())/86400000)):null,nextCut=Math.max(0,...prior.map(c=>Number(c.cut_number||0)))+1,irrigation=state.irrigations?.find(x=>x.lot_id===lot.id),irrigationDate=irrigation?.event_date||irrigation?.irrigation_date||lot.last_irrigation||'';const cutNo=select('[name="cut_number"]');if(cutNo&&!cutNo.dataset.manual){cutNo.value=nextCut||1}const ndvi=state.analyses?.find(a=>a.lot_id===lot.id)?.ndvi_avg, stateLabel=String(lot.status||'Activo'), stateClass=stateLabel.toLowerCase().includes('activ')?'good':'neutral', timeline=[{icon:'🌱',label:'Implantación',value:lot.planting_date||lot.establishment_date||'Sin informar'},...prior.slice(0,4).reverse().map(c=>({icon:'✂️',label:c.cut_number?`Corte ${c.cut_number}`:'Corte',value:c.cut_date||'Sin fecha'})),{icon:'●',label:'Hoy',value:new Date().toLocaleDateString('es-AR')}];select('#cutLotInfo').innerHTML=`<div class="production-lot-profile"><div class="production-lot-facts"><div><span>🌿 Cultivo</span><b>${escapeHtml(lot.crop||'Alfalfa')}</b></div><div><span>🧬 Variedad</span><b>${escapeHtml(lot.variety||'Sin informar')}</b></div><div><span>📐 Superficie</span><b>${number(lot.hectares||lot.area_ha,2)} ha</b></div><div><span>🌱 Implantación</span><b>${escapeHtml(lot.planting_date||lot.establishment_date||'Sin informar')}</b></div><div><span>💧 Riego</span><b>${escapeHtml(lot.irrigation_type||lot.irrigation||'Sin informar')}</b></div><div class="${stateClass}"><span>🟢 Estado</span><b>${escapeHtml(stateLabel)}</b></div><div><span>💦 Último riego</span><b>${irrigationDate||'Sin registrar'}</b></div><div><span>✂️ Último corte</span><b>${lastDate||'Sin registrar'}${days!=null?` · ${days} días`:''}</b></div><div><span>📈 NDVI</span><b>${ndvi!=null?number(ndvi,2):'Sin datos'}</b></div><div><span>📊 Promedio histórico</span><b>${prior.length?`${number(avg,1)} rollos/ha`:'Sin datos'}</b></div></div>${lotMiniMap(lot)}</div><div class="production-timeline">${timeline.map(item=>`<div><i>${item.icon}</i><span>${escapeHtml(item.label)}</span><b>${escapeHtml(item.value)}</b></div>`).join('')}</div>`};
    const calculate=()=>{const ha=Number(select('#cutHa')?.value||0),rolls=Number(select('#cutRolls')?.value||0),weight=Number(select('#cutWeight')?.value||0),sold=Number(select('#soldRolls')?.value||0),price=Number(select('#salePrice')?.value||0),priceTon=Number(select('#salePriceTon')?.value||0),cost=[...document.querySelectorAll('.cut-cost')].reduce((sum,x)=>sum+Number(x.value||0),0),kg=rolls*weight,tons=kg/1000,soldKg=sold*weight,revenue=priceTon>0?(soldKg/1000)*priceTon:sold*price,margin=revenue-cost,rollsHa=ha?rolls/ha:0,kgHa=ha?kg/ha:0,costHa=ha?cost/ha:0,costRoll=rolls?cost/rolls:0,costTon=tons?cost/tons:0,marginHa=ha?margin/ha:0,profitability=cost?margin/cost*100:0,stockRolls=Math.max(0,rolls-sold),stockTons=stockRolls*weight/1000,stockPrice=Number(select('[name="stock_value_per_roll"]')?.value||price||0),stockValue=stockRolls*stockPrice,lot=selectedLot(),targetRollsHa=Number(lot?.target_rolls_ha||6),targetCostHa=Number(lot?.target_cost_ha||costHa||1),yieldProgress=Math.max(0,Math.min(130,targetRollsHa?rollsHa/targetRollsHa*100:0)),costProgress=Math.max(0,Math.min(130,targetCostHa?costHa/targetCostHa*100:0)),profitProgress=Math.max(0,Math.min(130,100+profitability)),prior=lot?normalizedCuts().filter(c=>c.lot_id===lot.id):[],historical=prior.length?prior.reduce((sum,c)=>sum+(c.hectares?c.rolls/c.hectares:0),0)/prior.length:0,humidity=Number(select('[name="humidity"]')?.value||0),delta=historical?((rollsHa-historical)/historical*100):0,marginClass=margin>0?'good':margin<0?'bad':'neutral',yieldClass=historical?(delta>10?'good':delta<-10?'bad':'neutral'):'neutral',campaign=String(select('[name="campaign"]')?.value||year),previousCampaign=String(Number(campaign)-1),currentCampaignRows=prior.filter(c=>String(c.campaign)===campaign),previousCampaignRows=prior.filter(c=>String(c.campaign)===previousCampaign),avgRows=rows=>rows.length?rows.reduce((sum,c)=>sum+(c.hectares?c.rolls/c.hectares:0),0)/rows.length:0,currentCampaignAvg=currentCampaignRows.length?avgRows(currentCampaignRows):rollsHa,previousCampaignAvg=avgRows(previousCampaignRows),campaignDelta=previousCampaignAvg?((currentCampaignAvg-previousCampaignAvg)/previousCampaignAvg*100):null,trendRows=[...prior].sort((a,b)=>String(a.cut_date||'').localeCompare(String(b.cut_date||''))).slice(-4),trendValues=[...trendRows.map(c=>c.hectares?c.rolls/c.hectares:0),rollsHa].filter(v=>v>0),trendMax=Math.max(1,...trendValues),trendHtml=[...trendRows.map(c=>({label:c.cut_number?`${c.cut_number}°`:'Hist.',value:c.hectares?c.rolls/c.hectares:0})),...(rollsHa?[{label:'Actual',value:rollsHa}]:[])].map(x=>`<div class="production-mini-trend"><span>${x.label}</span><i><b style="width:${Math.max(4,x.value/trendMax*100)}%"></b></i><strong>${number(x.value,1)}</strong></div>`).join(''),advice=!rolls||!ha?'Complete superficie y rollos para generar el análisis.':historical&&delta<-10?`Rendimiento ${number(Math.abs(delta),0)}% por debajo del promedio histórico. Revisar humedad, nutrición y fecha de corte.`:humidity>20?'Humedad elevada: reforzar control de almacenamiento y ventilación antes de comercializar.':margin<0&&revenue>0?'El resultado económico es negativo. Revisar costos de maquinaria, combustible y precio de venta.':historical&&delta>10?`Rendimiento ${number(delta,0)}% superior al promedio histórico. Registrar las condiciones que favorecieron este corte.`:'Resultado dentro del rango esperado. Mantener seguimiento del lote y comparar con el próximo corte.';select('#cutCalc').innerHTML=`<div class="production-live-grid"><div><span>Producción</span><b>${number(tons,1)} t</b></div><div class="${yieldClass}"><span>Rendimiento</span><b>${number(rollsHa,2)} rollos/ha</b><small>${number(kgHa,0)} kg/ha${historical?` · ${delta>=0?'+':''}${number(delta,1)}% vs. historial`:''}</small></div><div><span>Ingreso bruto</span><b>${money(revenue)}</b></div><div><span>Costo total</span><b>${money(cost)}</b><small>${money(costHa)}/ha · ${money(costRoll)}/rollo · ${money(costTon)}/t</small></div><div class="${marginClass}"><span>Margen bruto</span><b>${money(margin)}</b><small>${money(marginHa)}/ha · ${number(profitability,1)}% rentabilidad</small></div><div><span>Stock resultante</span><b>${number(stockRolls,0)} rollos</b><small>${number(stockTons,1)} t · ${money(stockValue)}</small></div></div><div class="production-campaign-compare"><div><span>Campaña ${campaign}</span><b>${number(currentCampaignAvg,1)} rollos/ha</b></div><div><span>Campaña ${previousCampaign}</span><b>${previousCampaignAvg?`${number(previousCampaignAvg,1)} rollos/ha`:'Sin datos'}</b></div><strong class="${campaignDelta==null?'neutral':campaignDelta>=0?'good':'bad'}">${campaignDelta==null?'Sin comparación':`${campaignDelta>=0?'▲':'▼'} ${number(Math.abs(campaignDelta),1)}%`}</strong></div>${trendHtml?`<div class="production-live-trend"><b>Evolución reciente</b>${trendHtml}</div>`:''}<div class="production-objectives"><b>Objetivos del corte</b><div><span>Producción objetivo</span><i><em style="width:${Math.min(100,yieldProgress)}%"></em></i><strong>${number(yieldProgress,0)}%</strong></div><div><span>Costo objetivo</span><i class="${costProgress>100?'over':''}"><em style="width:${Math.min(100,costProgress)}%"></em></i><strong>${number(costProgress,0)}%</strong></div><div><span>Rentabilidad</span><i class="${profitability<0?'over':''}"><em style="width:${Math.min(100,profitProgress)}%"></em></i><strong>${number(profitability,1)}%</strong></div></div><div class="production-ai-advice"><b>🤖 LM AI · recomendación automática</b><p>${escapeHtml(advice)}</p><small>Próximo corte sugerido: ${rolls&&ha?'entre 26 y 32 días, sujeto a clima, humedad y estado del cultivo.':'complete los datos productivos para estimarlo.'}</small></div>`};
    select('#cutLot').onchange=e=>{const ha=Number(e.target.selectedOptions[0]?.dataset?.ha||0);if(ha)select('#cutHa').value=ha;updateLotInfo();calculate()};['#cutHa','#cutRolls','#cutWeight','#soldRolls','#salePrice','#salePriceTon','[name="campaign"]'].forEach(id=>{const el=select(id);if(el)el.oninput=calculate});['[name="stock_value_per_roll"]','[name="humidity"]','[name="work_hours"]'].forEach(q=>{const el=select(q);if(el)el.oninput=calculate});const updateFuelCost=()=>{const liters=Number(select('#fuelLiters')?.value||0),price=Number(select('#fuelPrice')?.value||0),field=select('#fuelCost');if(field&&liters>=0&&price>=0){field.value=(liters*price).toFixed(2);calculate()}};['#fuelLiters','#fuelPrice'].forEach(q=>{const el=select(q);if(el)el.oninput=updateFuelCost});const cutNumber=select('[name="cut_number"]');if(cutNumber)cutNumber.oninput=()=>cutNumber.dataset.manual='1';document.querySelectorAll('.cut-cost').forEach(x=>x.oninput=calculate);const photoInput=select('#cutPhotos');if(photoInput)photoInput.onchange=()=>{const preview=select('#cutPhotoPreview');preview.innerHTML='';[...photoInput.files].slice(0,8).forEach(file=>{const url=URL.createObjectURL(file),item=document.createElement('figure');item.innerHTML=`<img src="${url}" alt="${escapeHtml(file.name)}"><figcaption>${escapeHtml(file.name)}</figcaption>`;preview.appendChild(item)})};select('#cutForm').onsubmit=saveCut;if(defaultLotId){const lotSelect=select('#cutLot');const ha=Number(lotSelect?.selectedOptions[0]?.dataset?.ha||0);if(ha)select('#cutHa').value=ha}updateLotInfo();calculate();
  }

  async function uploadCutPhotos(files, cutDate) {
    const paths=[];
    for(const file of [...(files||[])]){if(!file?.size)continue;const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_'),path=`${state.companyId}/cuts/${cutDate}/${Date.now()}_${safe}`;const {error}=await supabase.storage.from('precision-files').upload(path,file,{upsert:false});if(error)throw error;paths.push(path)}
    return paths;
  }

  async function saveCut(event) {
    event.preventDefault();const form=new FormData(event.target),message=select('#cutMsg');message.classList.add('hidden');
    try {const rolls=Number(form.get('rolls')),weight=Number(form.get('weight')),hectares=Number(form.get('hectares')),sold=Number(form.get('sold_rolls')||0);if(!state.companyId)throw new Error('No hay empresa seleccionada.');if(!form.get('lot_id'))throw new Error('Seleccioná un lote.');if(!(hectares>0))throw new Error('La superficie debe ser mayor que cero.');if(rolls<0||sold<0||sold>rolls)throw new Error('Los rollos vendidos no pueden superar los producidos.');
      const photos=await uploadCutPhotos(select('#cutPhotos')?.files,form.get('cut_date'));
      const metadata={cut_number:Number(form.get('cut_number')),campaign:form.get('campaign'),expected_cuts_year:Number(form.get('expected_cuts_year')||10),hectares,weight,quality:form.get('quality'),destination:form.get('destination'),sold_rolls:sold,sale_price_per_roll:Number(form.get('sale_price_per_roll')||0),sale_price_per_ton:Number(form.get('sale_price_per_ton')||0),stock_value_per_roll:Number(form.get('stock_value_per_roll')||0),customer:form.get('customer')||'',payment_method:form.get('payment_method')||'',collection_date:form.get('collection_date')||'',batch_code:`${String(form.get('campaign')||'')}-${String(form.get('cut_number')||'').padStart(2,'0')}-${String(form.get('lot_id')||'').slice(0,6).toUpperCase()}`,storage_location:'Sin asignar',operational_status:'En stock',baling_date:form.get('cut_date'),observations:form.get('observations')||'',operator:form.get('operator')||'',equipment:form.get('equipment')||'',contractor:form.get('contractor')||'',crop_status:form.get('crop_status')||'',work_hours:Number(form.get('work_hours')||0),fuel_liters:Number(form.get('fuel_liters')||0),fuel_price_per_liter:Number(form.get('fuel_price_per_liter')||0),tractor_name:form.get('tractor_name')||'',mower_name:form.get('mower_name')||'',rake_name:form.get('rake_name')||'',baler_name:form.get('baler_name')||'',fertilizer_product:form.get('fertilizer_product')||'',fertilizer_kg:Number(form.get('fertilizer_kg')||0),humidity:Number(form.get('humidity')||0),protein:Number(form.get('protein')||0),fda:Number(form.get('fda')||0),fdn:Number(form.get('fdn')||0),leaf_pct:Number(form.get('leaf_pct')||0),weeds_pct:Number(form.get('weeds_pct')||0),forage_color:form.get('forage_color')||'',weather:form.get('weather')||'',fuel_cost:Number(form.get('fuel_cost')||0),tractor_cost:Number(form.get('tractor_cost')||0),mower_cost:Number(form.get('mower_cost')||0),rake_cost:Number(form.get('rake_cost')||0),baler_cost:Number(form.get('baler_cost')||0),labor_cost:Number(form.get('labor_cost')||0),machinery_cost:Number(form.get('machinery_cost')||0),freight_cost:Number(form.get('freight_cost')||0),repairs_cost:Number(form.get('repairs_cost')||0),other_cost:Number(form.get('other_cost')||0),photos};
      const lotId=form.get('lot_id'), cutDate=form.get('cut_date'), cutHectares=Number(form.get('hectares')||0);
      if(!(cutHectares>0)) throw new Error('La superficie cortada debe ser mayor que cero.');
      if(!(rolls>=0)) throw new Error('La cantidad de rollos no puede ser negativa.');
      if(!(weight>0)) throw new Error('El peso promedio debe ser mayor que cero.');
      const lot=state.lots.find(item=>item.id===lotId), lotHa=Number(lot?.hectares||lot?.area_ha||0);
      if(lotHa>0 && cutHectares>lotHa+0.01) throw new Error(`La superficie cortada (${cutHectares} ha) supera la superficie del lote (${lotHa} ha).`);
      const duplicate=normalizedCuts().find(c=>c.lot_id===lotId && c.cut_date===cutDate && Number(c.cut_number||0)===Number(form.get('cut_number')||0));
      if(duplicate && !confirm('Ya existe un corte del mismo lote, fecha y número. ¿Querés registrarlo igualmente?')) return;
      metadata.batch_code=metadata.batch_code||`ALF-${String(cutDate).replaceAll('-','')}-${String(lot?.name||'LOTE').replace(/[^A-Za-z0-9]/g,'').toUpperCase().slice(0,8)}-C${metadata.cut_number||1}`;
      const row={company_id:state.companyId,lot_id:lotId,cut_date:cutDate,bales:rolls,rolls,total_kg:rolls*weight,notes:`LMOS_CUT:${JSON.stringify(metadata)}`};const {error}=await supabase.from('alfalfa_cuts').insert(row);if(error)throw error;await supabase.from('lots').update({last_cut:form.get('cut_date')}).eq('id',form.get('lot_id'));select('#modalRoot').innerHTML='';await loadData();state.page='production';render();
    } catch(error){message.textContent=error.message;message.classList.remove('hidden')}
  }

  function cutById(id) { return normalizedCuts().find(c => String(c.id) === String(id)); }

  function openCutDetail(cut) {
    const lot=state.lots.find(l=>l.id===cut.lot_id), cost=cutCost(cut), revenue=cutRevenue(cut), margin=revenue-cost, rfv=rfvOf(cut);
    openModal(`<p class="eyebrow">TRAZABILIDAD · PRODUCCIÓN 10.0</p><h2>${escapeHtml(cut.batch_code||'Partida sin código')}</h2><div class="production-detail-grid"><div><span>Lote</span><b>${escapeHtml(lot?.name||'Sin lote')}</b></div><div><span>Fecha de corte</span><b>${escapeHtml(cut.cut_date||'—')}</b></div><div><span>Estado</span><b>${escapeHtml(cut.operational_status)}</b></div><div><span>Ubicación</span><b>${escapeHtml(cut.storage_location)}</b></div><div><span>Producción</span><b>${cut.rolls} rollos · ${number(cut.kg/1000,1)} t</b></div><div><span>Rendimiento</span><b>${cut.hectares?number(cut.rolls/cut.hectares,1):'—'} rollos/ha</b></div><div><span>Calidad</span><b>${escapeHtml(cut.quality)}${rfv?` · RFV ${number(rfv,0)}`:''}</b></div><div><span>Humedad</span><b>${cut.humidity?`${number(cut.humidity,1)}%`:'Sin análisis'}</b></div><div><span>Costo</span><b>${money(cost)}</b></div><div><span>Ingreso</span><b>${money(revenue)}</b></div><div><span>Margen</span><b class="${margin<0?'negative':'positive'}">${money(margin)}</b></div><div><span>Cliente</span><b>${escapeHtml(cut.customer||'Sin asignar')}</b></div><div><span>Horas trabajadas</span><b>${number(cut.work_hours,1)} h</b></div><div><span>Gasoil</span><b>${number(cut.fuel_liters,1)} L</b></div><div><span>Estado del cultivo</span><b>${escapeHtml(cut.crop_status||'Sin evaluar')}</b></div><div><span>Tractor</span><b>${escapeHtml(cut.tractor_name||'Sin informar')}</b></div><div><span>Segadora</span><b>${escapeHtml(cut.mower_name||'Sin informar')}</b></div><div><span>Rotoenfardadora</span><b>${escapeHtml(cut.baler_name||'Sin informar')}</b></div></div><div class="status production-note"><b>Observaciones</b><br>${escapeHtml(cut.observations||'Sin observaciones')}</div><div class="actions" style="margin-top:16px"><button class="secondary detailStockMove" data-id="${cut.id}">Registrar movimiento</button><button class="primary detailEditCut" data-id="${cut.id}">Editar trazabilidad</button></div>`);
    const btn=select('.detailEditCut'); if(btn) btn.onclick=()=>openCutQuickEditor(cut); const moveBtn=select('.detailStockMove'); if(moveBtn) moveBtn.onclick=()=>openStockMovement(cut);
  }


  function openStockMovement(cut) {
    const available=stockRollsOf(cut), movements=[...(cut.stock_movements||[])].reverse();
    openModal(`<p class="eyebrow">INVENTARIO DE ALFALFA · 10.0</p><h2>Movimiento de ${escapeHtml(cut.batch_code||'partida')}</h2><div class="status"><b>Disponible actual:</b> ${available} rollos · ${escapeHtml(cut.storage_location||'Sin asignar')}</div><form id="stockMovementForm" style="margin-top:16px"><input type="hidden" name="id" value="${cut.id}"><div class="form-grid"><label>Tipo<select name="type"><option>Salida</option><option>Ingreso</option></select></label><label>Cantidad de rollos<input name="quantity" type="number" min="1" max="${Math.max(1,available)}" value="1" required></label><label>Fecha<input name="date" type="date" value="${new Date().toISOString().slice(0,10)}" required></label><label>Destino / motivo<select name="reason"><option>Venta</option><option>Reserva</option><option>Consumo interno</option><option>Traslado</option><option>Ajuste de inventario</option><option>Devolución</option></select></label><label>Cliente / receptor<input name="customer" placeholder="Opcional"></label><label>Precio por rollo<input name="unit_price" type="number" min="0" step="1" value="0"></label><label>Precio por tonelada<input name="ton_price" type="number" min="0" step="1" value="0"></label><label>Estado de cobro<select name="payment_status"><option>Pendiente</option><option>Parcial</option><option>Cobrado</option></select></label><label>Vencimiento<input name="due_date" type="date"></label><label>Nueva ubicación<input name="storage_location" value="${escapeHtml(cut.storage_location||'')}"></label><label class="wide">Observaciones<textarea name="notes" rows="3"></textarea></label></div><button class="primary">Guardar movimiento</button><p id="stockMovementMsg" class="error hidden"></p></form><div class="panel" style="margin-top:18px"><div class="panel-title"><h3>Historial de movimientos</h3><span class="pill">${movements.length}</span></div>${movements.length?movements.map(m=>`<div class="row"><div><b>${escapeHtml(m.type)} · ${Number(m.quantity||0)} rollos</b><small>${escapeHtml(m.date||'')} · ${escapeHtml(m.reason||'Sin motivo')}${m.customer?` · ${escapeHtml(m.customer)}`:''}</small></div><span class="pill">${escapeHtml(m.storage_location||cut.storage_location||'')}</span></div>`).join(''):'<div class="empty">Todavía no hay movimientos registrados para esta partida.</div>'}</div>`);
    select('#stockMovementForm').onsubmit=saveStockMovement;
  }

  async function saveStockMovement(event) {
    event.preventDefault(); const form=new FormData(event.target), cut=cutById(form.get('id')), msg=select('#stockMovementMsg');
    try { if(!cut) throw new Error('No se encontró la partida.'); const quantity=Number(form.get('quantity')||0), type=form.get('type'); if(!(quantity>0)) throw new Error('La cantidad debe ser mayor que cero.'); if(type==='Salida'&&quantity>stockRollsOf(cut)) throw new Error('La salida supera el stock disponible.'); const unitPrice=Number(form.get('unit_price')||0),tonPrice=Number(form.get('ton_price')||0),total=tonPrice>0?(quantity*Number(cut.weight||500)/1000)*tonPrice:quantity*unitPrice,status=form.get('payment_status')||'Pendiente'; const movement={id:`MOV-${Date.now()}`,type,quantity,date:form.get('date'),reason:form.get('reason'),customer:form.get('customer')||'',storage_location:form.get('storage_location')||cut.storage_location||'Sin asignar',unit_price:unitPrice,ton_price:tonPrice,total_amount:total,payment_status:status,collected_amount:status==='Cobrado'?total:0,due_date:form.get('due_date')||'',notes:form.get('notes')||'',created_at:new Date().toISOString()}; const metadata={...parseCutMetadata(cut),storage_location:movement.storage_location,stock_movements:[...(cut.stock_movements||[]),movement]}; if(type==='Salida'&&movement.reason==='Venta') metadata.sold_rolls=Number(metadata.sold_rolls||0)+quantity; const {error}=await supabase.from('alfalfa_cuts').update({notes:`LMOS_CUT:${JSON.stringify(metadata)}`}).eq('id',cut.id); if(error) throw error; select('#modalRoot').innerHTML=''; await loadData(); render(); } catch(error){msg.textContent=error.message;msg.classList.remove('hidden');}
  }

  function openCutQuickEditor(cut) {
    openModal(`<p class="eyebrow">GESTIÓN DE ALFALFA · 5.1</p><h2>Editar trazabilidad</h2><form id="cutQuickForm"><input type="hidden" name="id" value="${cut.id}"><div class="form-grid"><label>Código de partida<input name="batch_code" value="${escapeHtml(cut.batch_code||'')}" required></label><label>Estado<select name="operational_status">${['En campo','Secado','Enfardado','En stock','Reservado','Vendido','Consumido'].map(v=>`<option ${cut.operational_status===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Ubicación / galpón<input name="storage_location" value="${escapeHtml(cut.storage_location||'')}" placeholder="Ej.: Galpón Norte"></label><label>Fecha de enfardado<input name="baling_date" type="date" value="${escapeHtml(cut.baling_date||cut.cut_date||'')}"></label><label>Calidad<select name="quality">${['Premium','Exportación','Lechero','Feedlot','Primera','Segunda','Regular','Descarte','Sin clasificar'].map(v=>`<option ${cut.quality===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Humedad (%)<input name="humidity" type="number" min="0" max="100" step="0.1" value="${Number(cut.humidity||0)}"></label><label>Rollos vendidos/consumidos<input name="sold_rolls" type="number" min="0" max="${cut.rolls}" value="${Number(cut.sold_rolls||0)}"></label><label>Cliente / destino<input name="customer" value="${escapeHtml(cut.customer||'')}"></label><label class="wide">Observaciones<textarea name="observations" rows="4">${escapeHtml(cut.observations||'')}</textarea></label></div><button class="primary">Guardar cambios</button><p id="cutQuickMsg" class="error hidden"></p></form>`);
    select('#cutQuickForm').onsubmit=saveCutQuickEdit;
  }

  async function saveCutQuickEdit(event) {
    event.preventDefault(); const form=new FormData(event.target), cut=cutById(form.get('id')), msg=select('#cutQuickMsg');
    try { if(!cut) throw new Error('No se encontró el corte.'); const metadata={...parseCutMetadata(cut),batch_code:form.get('batch_code'),operational_status:form.get('operational_status'),storage_location:form.get('storage_location')||'Sin asignar',baling_date:form.get('baling_date')||cut.cut_date,quality:form.get('quality'),humidity:Number(form.get('humidity')||0),sold_rolls:Number(form.get('sold_rolls')||0),customer:form.get('customer')||'',observations:form.get('observations')||''}; if(metadata.sold_rolls>cut.rolls) throw new Error('Los rollos vendidos o consumidos no pueden superar la producción.'); const {error}=await supabase.from('alfalfa_cuts').update({notes:`LMOS_CUT:${JSON.stringify(metadata)}`}).eq('id',cut.id); if(error) throw error; select('#modalRoot').innerHTML=''; await loadData(); render(); } catch(error){msg.textContent=error.message;msg.classList.remove('hidden');}
  }

  async function deleteCut(cut) {
    const lot=state.lots.find(l=>l.id===cut.lot_id); if(!confirm(`¿Eliminar el corte de ${lot?.name||'este lote'} del ${cut.cut_date}? Esta acción no se puede deshacer.`)) return;
    const {error}=await supabase.from('alfalfa_cuts').delete().eq('id',cut.id); if(error){alert(error.message);return;} await loadData(); render();
  }

  function bind() {
    document.querySelectorAll('.newCut').forEach(b=>b.onclick=()=>openCutEditor());document.querySelectorAll('.exportProduction').forEach(b=>b.onclick=exportCsv);document.querySelectorAll('.cutDetail').forEach(b=>b.onclick=()=>{const c=cutById(b.dataset.id);if(c)openCutDetail(c)});document.querySelectorAll('.cutMove').forEach(b=>b.onclick=()=>{const c=cutById(b.dataset.id);if(c)openStockMovement(c)});document.querySelectorAll('.cutEdit').forEach(b=>b.onclick=()=>{const c=cutById(b.dataset.id);if(c)openCutQuickEditor(c)});document.querySelectorAll('.cutDelete').forEach(b=>b.onclick=()=>{const c=cutById(b.dataset.id);if(c)deleteCut(c)});
    const bindings=[['#productionSearch','input','search'],['#productionLotFilter','change','lotId'],['#productionQualityFilter','change','quality'],['#productionDestinationFilter','change','destination'],['#productionCampaignFilter','change','campaign']];bindings.forEach(([id,event,key])=>{const el=select(id);if(el)el[`on${event}`]=e=>{filters[key]=e.target.value;render()}});const clear=select('#clearProductionFilters');if(clear)clear.onclick=()=>{Object.keys(filters).forEach(k=>filters[k]='');render()};
  }
  return { renderPage, openCutEditor, bind };
}

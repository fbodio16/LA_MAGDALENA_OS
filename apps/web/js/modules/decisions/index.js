export function createDecisionsModule({ state, supabase, escapeHtml, openModal, loadData, render, setPage }) {
  const money = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0));
  const number = (value, digits = 0) => new Intl.NumberFormat('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value || 0));
  const today = () => new Date();
  const daysSince = value => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return Math.max(0, Math.floor((today() - date) / 86400000));
  };
  const settings = () => state.decisionSettings?.[0] || {
    cut_alert_days: 32,
    irrigation_alert_days: 7,
    ndvi_alert_threshold: 0.55,
    collection_alert_days: 7,
    target_margin_percent: 20
  };
  const activeCampaign = () => (state.campaigns || []).find(c => c.status === 'Activa') || (state.campaigns || [])[0] || null;
  const lotName = id => state.lots.find(l => l.id === id)?.name || 'Lote sin identificar';

  function latestForLot(rows, lotId, field) {
    return rows.filter(x => x.lot_id === lotId).sort((a,b)=>String(b[field]||'').localeCompare(String(a[field]||'')))[0] || null;
  }

  function buildActions() {
    const cfg = settings();
    const actions = [];
    const campaign = activeCampaign();
    const campaignLots = campaign ? state.lots.filter(l => l.campaign_id === campaign.id || !l.campaign_id) : state.lots;
    campaignLots.forEach(lot => {
      const cut = latestForLot(state.cuts || [], lot.id, 'cut_date');
      const irrigation = latestForLot(state.irrigations || [], lot.id, 'event_date');
      const analysis = latestForLot(state.analyses || [], lot.id, 'flight_date');
      const cutDays = daysSince(cut?.cut_date);
      const irrigationDays = daysSince(irrigation?.event_date);
      const ndvi = Number(analysis?.ndvi_avg ?? analysis?.average_ndvi ?? 0);
      if (cutDays === null || cutDays >= Number(cfg.cut_alert_days || 32)) {
        actions.push({ priority: cutDays === null ? 78 : Math.min(100, 70 + cutDays - Number(cfg.cut_alert_days || 32)), level:'Alta', icon:'🌾', title:`Revisar corte de ${lot.name}`, detail:cutDays===null?'No registra cortes recientes.':`Pasaron ${cutDays} días desde el último corte.`, page:'production' });
      }
      if (irrigationDays === null || irrigationDays >= Number(cfg.irrigation_alert_days || 7)) {
        actions.push({ priority: irrigationDays === null ? 58 : Math.min(90, 50 + irrigationDays - Number(cfg.irrigation_alert_days || 7)), level:irrigationDays > Number(cfg.irrigation_alert_days || 7) + 4 ? 'Alta':'Media', icon:'💧', title:`Controlar riego de ${lot.name}`, detail:irrigationDays===null?'No registra riegos.':`Último riego hace ${irrigationDays} días.`, page:'irrigation' });
      }
      if (analysis && ndvi > 0 && ndvi < Number(cfg.ndvi_alert_threshold || 0.55)) {
        actions.push({ priority:Math.min(92, 60 + Math.round((Number(cfg.ndvi_alert_threshold)-ndvi)*100)), level:'Alta', icon:'🛰️', title:`Vigor bajo en ${lot.name}`, detail:`NDVI promedio ${number(ndvi,2)}. Revisar causas y generar orden.`, page:'map' });
      }
    });
    (state.salesOrders || []).filter(s => s.status !== 'Anulada' && Number(s.total_amount || 0) > Number(s.paid_amount || 0)).forEach(sale => {
      const overdue = sale.due_date ? daysSince(sale.due_date) : 0;
      if (sale.due_date && new Date(sale.due_date) < today()) actions.push({ priority:Math.min(95, 66 + Number(overdue || 0)), level:'Alta', icon:'💵', title:`Cobranza vencida: ${sale.client_name || 'cliente'}`, detail:`Saldo ${money(Number(sale.total_amount||0)-Number(sale.paid_amount||0))} · venció hace ${overdue} días.`, page:'sales' });
    });
    (state.equipment || []).filter(e => e.next_service_hours && Number(e.hour_meter || 0) >= Number(e.next_service_hours || 0)).forEach(e => actions.push({ priority:74, level:'Alta', icon:'🔧', title:`Servicio pendiente: ${e.name}`, detail:`Horómetro ${number(e.hour_meter)} h. Superó el próximo servicio.`, page:'resources' }));
    (state.orders || []).filter(o => !['Completada','Cancelada'].includes(o.status)).forEach(o => actions.push({ priority:55, level:'Media', icon:'✈️', title:`Orden T100 activa en ${lotName(o.lot_id)}`, detail:`${o.product || 'Aplicación'} · estado ${o.status || 'Pendiente'}.`, page:'orders' }));
    return actions.sort((a,b)=>b.priority-a.priority).slice(0,18);
  }

  function economics() {
    const sales = (state.salesOrders || []).filter(x => x.status !== 'Anulada');
    const revenue = sales.reduce((s,x)=>s+Number(x.total_amount||0),0) + (state.trips||[]).reduce((s,x)=>s+Number(x.income||0),0);
    const productionCost = (state.cuts||[]).reduce((s,x)=>s+Number(x.total_cost||x.cost||0),0);
    const logisticsCost = (state.trips||[]).reduce((s,x)=>s+Number(x.cost||0),0);
    const operatingCost = (state.fuelEntries||[]).reduce((s,x)=>s+Number(x.total_cost||0),0) + (state.maintenanceEntries||[]).reduce((s,x)=>s+Number(x.total_cost||x.cost||0),0) + (state.laborEntries||[]).reduce((s,x)=>s+Number(x.total_cost||0),0);
    const costs = productionCost + logisticsCost + operatingCost;
    const margin = revenue - costs;
    const marginPct = revenue ? margin / revenue * 100 : 0;
    return { revenue, costs, margin, marginPct };
  }

  function renderPage() {
    const cfg = settings();
    const actions = buildActions();
    const eco = economics();
    const campaign = activeCampaign();
    const stock = (state.cuts||[]).reduce((s,x)=>s+Number(x.bales||x.rolls||0),0) + (state.stockMovements||[]).reduce((s,x)=>s+(String(x.direction||x.movement_type||'').toLowerCase().includes('ingreso')?1:-1)*Number(x.quantity||x.bales||0),0);
    const high = actions.filter(x=>x.level==='Alta').length;
    const actionRows = actions.map((a,i)=>`<article class="decision-action"><div class="decision-rank">${i+1}</div><div><div class="decision-title"><span>${a.icon}</span><b>${escapeHtml(a.title)}</b><span class="pill ${a.level==='Alta'?'bad':'warn'}">${a.level}</span></div><small>${escapeHtml(a.detail)}</small></div><button class="secondary decisionGo" data-page="${a.page}">Abrir</button></article>`).join('');
    const marginStatus = eco.marginPct >= Number(cfg.target_margin_percent||20) ? 'Objetivo cumplido' : `Faltan ${number(Math.max(0,Number(cfg.target_margin_percent||20)-eco.marginPct),1)} puntos`;
    return `<div class="page-head"><div><p class="eyebrow">CENTRO DE DECISIONES INTELIGENTE · 14.0.0</p><h2>Qué hacer hoy en La Magdalena</h2><p class="muted">Prioriza producción, riego, precisión, cobranzas, mantenimiento y logística con los datos reales del establecimiento.</p></div><button class="secondary decisionSettings">⚙ Configurar alertas</button></div>
      <div class="metrics decision-metrics"><div class="metric"><span>Acciones sugeridas</span><b>${actions.length}</b><small>${high} de prioridad alta</small></div><div class="metric"><span>Campaña activa</span><b>${escapeHtml(campaign?.name||'Sin definir')}</b><small>${escapeHtml(campaign?.status||'Creá una campaña')}</small></div><div class="metric"><span>Stock estimado</span><b>${number(Math.max(0,stock))} rollos</b><small>inventario productivo</small></div><div class="metric"><span>Margen acumulado</span><b class="${eco.margin>=0?'positive':'negative'}">${money(eco.margin)}</b><small>${number(eco.marginPct,1)}% · ${marginStatus}</small></div></div>
      <div class="decision-layout"><section class="panel"><div class="panel-title"><div><h3>Plan de acción priorizado</h3><p class="muted">Ordenado por urgencia e impacto operativo.</p></div><span class="pill">Actualizado ahora</span></div><div class="decision-list">${actionRows||'<div class="status">No hay alertas críticas. Revisá el tablero y mantené la carga de datos actualizada.</div>'}</div></section>
      <aside class="panel"><div class="panel-title"><div><h3>Resultado y objetivos</h3><p class="muted">Lectura rápida del desempeño económico.</p></div></div><div class="decision-economics"><div><span>Ingresos</span><b>${money(eco.revenue)}</b></div><div><span>Costos</span><b>${money(eco.costs)}</b></div><div><span>Margen</span><b class="${eco.margin>=0?'positive':'negative'}">${money(eco.margin)}</b></div><div><span>Margen sobre ventas</span><b>${number(eco.marginPct,1)}%</b></div></div><div class="decision-gauge"><div><span style="width:${Math.max(0,Math.min(100,eco.marginPct/Math.max(1,Number(cfg.target_margin_percent||20))*100))}%"></span></div><small>Objetivo configurado: ${number(cfg.target_margin_percent||20,1)}%</small></div><div class="decision-shortcuts"><button class="secondary decisionGo" data-page="campaigns">🗓 Campaña</button><button class="secondary decisionGo" data-page="production">🌾 Producción</button><button class="secondary decisionGo" data-page="sales">💵 Cobranzas</button><button class="secondary decisionGo" data-page="transport">🚛 Logística</button></div></aside></div>`;
  }

  function settingsModal() {
    const cfg=settings();
    openModal(`<p class="eyebrow">REGLAS DE DECISIÓN · 14.0.0</p><h2>Configurar alertas</h2><form id="decisionSettingsForm"><div class="form-grid"><label>Alertar corte después de (días)<input name="cut_alert_days" type="number" min="1" value="${Number(cfg.cut_alert_days||32)}"></label><label>Alertar riego después de (días)<input name="irrigation_alert_days" type="number" min="1" value="${Number(cfg.irrigation_alert_days||7)}"></label><label>NDVI mínimo esperado<input name="ndvi_alert_threshold" type="number" min="0" max="1" step="0.01" value="${Number(cfg.ndvi_alert_threshold||0.55)}"></label><label>Objetivo de margen (%)<input name="target_margin_percent" type="number" min="0" step="0.1" value="${Number(cfg.target_margin_percent||20)}"></label></div><button class="primary">Guardar configuración</button><p id="decisionSettingsMsg" class="error hidden"></p></form>`);
    document.querySelector('#decisionSettingsForm').onsubmit=saveSettings;
  }

  async function saveSettings(event) {
    event.preventDefault();
    const f=new FormData(event.target);
    const row={company_id:state.companyId,cut_alert_days:Number(f.get('cut_alert_days')),irrigation_alert_days:Number(f.get('irrigation_alert_days')),ndvi_alert_threshold:Number(f.get('ndvi_alert_threshold')),target_margin_percent:Number(f.get('target_margin_percent')),updated_at:new Date().toISOString()};
    const result=await supabase.from('decision_settings').upsert(row,{onConflict:'company_id'});
    if(result.error){const m=document.querySelector('#decisionSettingsMsg');m.textContent=result.error.message;m.classList.remove('hidden');return;}
    document.querySelector('#modalRoot').innerHTML='';await loadData();render();
  }

  function bind() {
    document.querySelectorAll('.decisionGo').forEach(b=>b.onclick=()=>setPage(b.dataset.page));
    document.querySelectorAll('.decisionSettings').forEach(b=>b.onclick=settingsModal);
  }
  return { renderPage, bind };
}

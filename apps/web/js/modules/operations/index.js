const asNumber = value => Number(value || 0);
const dayMs = 86400000;

function parseCut(cut) {
  let meta = {};
  try {
    const raw = String(cut.notes || '');
    if (raw.startsWith('LMOS_CUT:')) meta = JSON.parse(raw.slice(9));
  } catch (_error) {}
  const rolls = asNumber(cut.bales || cut.rolls);
  const weight = asNumber(meta.weight || (rolls ? asNumber(cut.total_kg) / rolls : 500)) || 500;
  const sold = asNumber(meta.sold_rolls);
  const costs = ['fuel_cost','labor_cost','machinery_cost','tractor_cost','mower_cost','rake_cost','baler_cost','freight_cost','repairs_cost','other_cost']
    .reduce((sum, key) => sum + asNumber(meta[key]), 0);
  const revenue = asNumber(meta.sale_price_per_ton) > 0
    ? (sold * weight / 1000) * asNumber(meta.sale_price_per_ton)
    : sold * asNumber(meta.sale_price_per_roll);
  return { ...cut, meta, rolls, weight, sold, stock: Math.max(0, rolls - sold), costs, revenue, margin: revenue - costs };
}

export function createOperationsModule({ state, escapeHtml, render, setPage }) {
  const money = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(asNumber(value));
  const number = (value, digits = 0) => new Intl.NumberFormat('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(asNumber(value));
  const dateLabel = value => value ? new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${String(value).slice(0,10)}T12:00:00`)) : 'Sin registrar';
  const latestDate = rows => rows.map(row => row.cut_date || row.event_date || row.trip_date || row.movement_date || row.order_date).filter(Boolean).sort().at(-1) || '';

  function snapshot() {
    const cuts = state.cuts.map(parseCut);
    const totalRolls = cuts.reduce((sum, item) => sum + item.rolls, 0);
    const stock = cuts.reduce((sum, item) => sum + item.stock, 0);
    const costs = cuts.reduce((sum, item) => sum + item.costs, 0);
    const revenue = cuts.reduce((sum, item) => sum + item.revenue, 0);
    const tripIncome = state.trips.reduce((sum, item) => sum + asNumber(item.income || item.revenue || item.amount), 0);
    const tripCosts = state.trips.reduce((sum, item) => sum + asNumber(item.total_cost || item.cost || item.fuel_cost) + asNumber(item.tolls) + asNumber(item.per_diem), 0);
    const movementIncome = state.movements.filter(item => String(item.type || item.movement_type || '').toLowerCase().includes('ing')).reduce((sum, item) => sum + asNumber(item.amount), 0);
    const movementExpense = state.movements.filter(item => String(item.type || item.movement_type || '').toLowerCase().includes('egr')).reduce((sum, item) => sum + asNumber(item.amount), 0);
    const activeOrders = state.orders.filter(item => !['completada','cancelada'].includes(String(item.status || '').toLowerCase())).length;
    const lowNdvi = state.analyses.filter(item => asNumber(item.ndvi_avg) > 0 && asNumber(item.ndvi_avg) < 0.62).length;
    const today = Date.now();
    const staleLots = state.lots.filter(lot => {
      const lotCuts = state.cuts.filter(cut => cut.lot_id === lot.id).map(cut => cut.cut_date).filter(Boolean).sort();
      if (!String(lot.crop || '').toLowerCase().includes('alfalfa')) return false;
      if (!lotCuts.length) return true;
      return (today - new Date(`${lotCuts.at(-1)}T12:00:00`).getTime()) / dayMs >= 32;
    });
    return {
      cuts, totalRolls, stock, costs, revenue, tripIncome, tripCosts,
      movementIncome, movementExpense, activeOrders, lowNdvi, staleLots,
      result: revenue + tripIncome + movementIncome - costs - tripCosts - movementExpense,
      lastActivity: latestDate([...state.cuts, ...state.irrigations, ...state.trips, ...state.movements, ...state.orders])
    };
  }

  function priorityRows(data) {
    const rows = [];
    data.staleLots.slice(0, 5).forEach(lot => rows.push({ level: 'Alta', area: 'Alfalfa', title: `Revisar ${lot.name}`, detail: 'Sin corte reciente o con más de 32 días desde el último corte.', page: 'alfalfa' }));
    if (data.lowNdvi) rows.push({ level: 'Alta', area: 'Precisión', title: `${data.lowNdvi} análisis con NDVI bajo`, detail: 'Revisar vigor, humedad y nutrición de los lotes afectados.', page: 'map' });
    if (data.activeOrders) rows.push({ level: 'Media', area: 'T100', title: `${data.activeOrders} órdenes activas`, detail: 'Confirmar programación, insumos y estado operativo.', page: 'orders' });
    if (data.stock > 0) rows.push({ level: 'Media', area: 'Comercial', title: `${number(data.stock)} rollos disponibles`, detail: 'Validar ubicación, calidad, reservas y ventas pendientes.', page: 'production' });
    if (!rows.length) rows.push({ level: 'Baja', area: 'Operación', title: 'Sin alertas críticas', detail: 'La información cargada no muestra desvíos prioritarios.', page: 'dashboard' });
    return rows;
  }

  function renderPage() {
    const data = snapshot();
    const priorities = priorityRows(data);
    return `<div class="page-head"><div><p class="eyebrow">ERP AGROPECUARIO 6.0</p><h2>Centro operativo</h2><p class="muted">Una vista única de producción, finanzas, transporte, riego y agricultura de precisión.</p></div><button class="secondary exportOps">Exportar resumen CSV</button></div>
      <div class="metrics">
        <div class="metric"><span>Resultado consolidado</span><b>${money(data.result)}</b><small>movimientos, alfalfa y transporte</small></div>
        <div class="metric"><span>Stock de alfalfa</span><b>${number(data.stock)} rollos</b><small>${number(data.totalRolls)} producidos</small></div>
        <div class="metric"><span>Órdenes activas</span><b>${number(data.activeOrders)}</b><small>DJI Agras T100</small></div>
        <div class="metric"><span>Última actividad</span><b>${dateLabel(data.lastActivity)}</b><small>último registro operativo</small></div>
      </div>
      <div class="ops-grid">
        <section class="panel"><div class="panel-title"><div><p class="eyebrow">PLAN DE ACCIÓN</p><h3>Prioridades de hoy</h3></div><span class="pill">${priorities.length} acciones</span></div>
          <div class="ops-priority-list">${priorities.map((item, index) => `<article class="ops-priority"><span class="ops-rank">${index + 1}</span><div><div class="ops-priority-head"><b>${escapeHtml(item.title)}</b><span class="pill ${item.level === 'Alta' ? 'bad' : item.level === 'Media' ? 'warn' : ''}">${item.level}</span></div><small>${escapeHtml(item.area)} · ${escapeHtml(item.detail)}</small></div><button class="secondary opsGo" data-page="${item.page}">Abrir</button></article>`).join('')}</div>
        </section>
        <section class="panel"><p class="eyebrow">CONTROL ECONÓMICO</p><h3>Composición del resultado</h3>
          <div class="ops-breakdown"><div><span>Ingresos alfalfa</span><b>${money(data.revenue)}</b></div><div><span>Costos alfalfa</span><b>${money(data.costs)}</b></div><div><span>Ingresos transporte</span><b>${money(data.tripIncome)}</b></div><div><span>Costos transporte</span><b>${money(data.tripCosts)}</b></div><div><span>Otros movimientos netos</span><b>${money(data.movementIncome - data.movementExpense)}</b></div></div>
        </section>
      </div>
      <div class="grid3" style="margin-top:18px">
        <button class="ops-card opsGo" data-page="alfalfa"><span>🌱</span><b>Alfalfa</b><small>${data.staleLots.length} lotes para revisar</small></button>
        <button class="ops-card opsGo" data-page="transport"><span>🚛</span><b>Transporte</b><small>${state.trips.length} viajes registrados</small></button>
        <button class="ops-card opsGo" data-page="map"><span>🛰️</span><b>Precisión</b><small>${state.analyses.length} análisis procesados</small></button>
        <button class="ops-card opsGo" data-page="irrigation"><span>💧</span><b>Riego</b><small>${state.irrigations.length} eventos registrados</small></button>
        <button class="ops-card opsGo" data-page="clients"><span>👥</span><b>Clientes</b><small>${state.clients.length} clientes activos</small></button>
        <button class="ops-card opsGo" data-page="admin"><span>💰</span><b>Administración</b><small>${state.movements.length} movimientos</small></button>
      </div>`;
  }

  function exportCsv() {
    const data = snapshot();
    const rows = [
      ['Indicador','Valor'],
      ['Resultado consolidado', data.result],
      ['Rollos producidos', data.totalRolls],
      ['Rollos en stock', data.stock],
      ['Ingresos alfalfa', data.revenue],
      ['Costos alfalfa', data.costs],
      ['Ingresos transporte', data.tripIncome],
      ['Costos transporte', data.tripCosts],
      ['Órdenes activas', data.activeOrders],
      ['Análisis NDVI bajos', data.lowNdvi]
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"','""')}"`).join(';')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `la-magdalena-resumen-${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function bind() {
    document.querySelectorAll('.opsGo').forEach(button => button.onclick = () => setPage(button.dataset.page));
    const exportButton = document.querySelector('.exportOps');
    if (exportButton) exportButton.onclick = exportCsv;
  }

  return { renderPage, bind };
}

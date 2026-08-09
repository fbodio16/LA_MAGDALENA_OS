export function createLotsPage({
  state,
  escapeHtml,
  totalHa,
  latest,
  vigor,
  filters,
  activities,
}) {
  return function renderPage() {
    const active = state.lots.filter(
      lot => (lot.status || 'Activo') === 'Activo',
    ).length;
    const crops = filters.getAvailableCrops(state.lots);

    return `<div class="lots-module"><div class="page-head"><div><p class="eyebrow">BASE PRODUCTIVA</p><h2>Gestión de lotes</h2><p class="muted">Ficha técnica, cultivo, variedad, labores recientes y estado agronómico de cada lote.</p></div><div class="actions"><button class="primary newLot">＋ Nuevo lote</button></div></div><div class="metrics"><div class="metric"><span>Lotes totales</span><b>${state.lots.length}</b><small>${active} activos</small></div><div class="metric"><span>Superficie</span><b>${totalHa()}</b><small>hectáreas registradas</small></div><div class="metric"><span>Cultivos</span><b>${crops.length}</b><small>${escapeHtml(crops.join(', ') || 'Sin cultivos')}</small></div><div class="metric"><span>Con polígono</span><b>${state.lots.filter(lot => state.geometries.some(geometry => geometry.lot_id === lot.id)).length}</b><small>georreferenciados</small></div></div><div class="lot-grid">${state.lots.map(lot => renderLotCard(lot)).join('')}</div></div>`;
  };

  function renderLotCard(lot) {
    const analysis = latest(lot);
    const vigorState = vigor(analysis?.ndvi_avg);
    const summary = activities.getSummary(state, lot.id);

    return `<article class="panel"><div class="panel-title"><div><h3>${escapeHtml(lot.name)}</h3><span class="pill">${escapeHtml(lot.status || 'Activo')}</span></div><button class="secondary editLot" data-id="${lot.id}">Editar</button></div><div class="row"><div><b>${escapeHtml(lot.crop || 'Sin cultivo')}</b><small>${escapeHtml(lot.variety || 'Variedad no informada')}</small></div><b>${Number(lot.hectares || 0).toFixed(1)} ha</b></div><div class="row"><div><b>Último NDVI</b><small>${analysis ? `${analysis.flight_date} · ${Number(analysis.low_vigor_pct || 0).toFixed(1)}% bajo vigor` : 'Sin análisis procesado'}</small></div><span class="pill ${vigorState[1]}">${analysis ? Number(analysis.ndvi_avg).toFixed(2) : '—'}</span></div><div class="row"><div><b>Producción</b><small>${summary.cuts.length} corte(s) registrados</small></div><span>${summary.rolls} rollos</span></div><div class="row"><div><b>Riego</b><small>${summary.irrigations.length ? `${summary.irrigations.length} evento(s)` : 'Sin eventos'}</small></div><span>${escapeHtml(lot.last_irrigation || '—')}</span></div><div class="status" style="margin-top:12px"><b>Próxima tarea:</b> ${escapeHtml(lot.next_task || 'Sin tarea programada')}<br><small>${escapeHtml(lot.notes || 'Sin observaciones')}</small></div><div class="actions" style="margin-top:14px"><button class="secondary lotDetail" data-id="${lot.id}">Ver ficha</button><button class="secondary goMap">Mapa</button></div></article>`;
  }
}

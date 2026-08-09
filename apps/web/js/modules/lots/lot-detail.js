export function createLotDetail({
  state,
  select,
  escapeHtml,
  openModal,
  openEditor,
  activities,
}) {
  return function openDetails(lot) {
    if (!lot) return;

    const summary = activities.getSummary(state, lot.id);
    const analysis = summary.analyses[0];

    openModal(`<p class="eyebrow">FICHA DEL LOTE</p><div class="panel-title"><div><h2>${escapeHtml(lot.name)}</h2><span class="pill">${escapeHtml(lot.status || 'Activo')}</span></div><button class="secondary editLotFromDetail">Editar ficha</button></div><div class="metrics"><div class="metric"><span>Superficie</span><b>${Number(lot.hectares || 0).toFixed(1)}</b><small>hectáreas</small></div><div class="metric"><span>Cultivo</span><b style="font-size:22px">${escapeHtml(lot.crop || '—')}</b><small>${escapeHtml(lot.variety || 'Sin variedad')}</small></div><div class="metric"><span>NDVI</span><b>${analysis ? Number(analysis.ndvi_avg).toFixed(2) : '—'}</b><small>${summary.analyses.length} análisis</small></div><div class="metric"><span>Rollos</span><b>${summary.rolls}</b><small>${summary.cuts.length} cortes</small></div></div><div class="grid2"><div class="panel"><h3>Información agronómica</h3><div class="row"><b>Fecha de siembra</b><span>${escapeHtml(lot.sowing_date || '—')}</span></div><div class="row"><b>Último corte</b><span>${escapeHtml(lot.last_cut || '—')}</span></div><div class="row"><b>Último riego</b><span>${escapeHtml(lot.last_irrigation || '—')}</span></div><div class="row"><b>Órdenes T100</b><span>${summary.orders.length}</span></div><div class="row"><b>Eventos de riego</b><span>${summary.irrigations.length}</span></div></div><div class="panel"><h3>Plan operativo</h3><p class="status"><b>Próxima tarea:</b><br>${escapeHtml(lot.next_task || 'Sin tarea programada')}</p><p class="muted">${escapeHtml(lot.notes || 'Sin observaciones registradas.')}</p></div></div>`);
    select('.editLotFromDetail').onclick = () => openEditor(lot);
  };
}

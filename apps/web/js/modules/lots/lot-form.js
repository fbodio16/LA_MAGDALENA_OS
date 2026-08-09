export function createLotForm({
  state,
  select,
  escapeHtml,
  openModal,
  service,
  loadData,
  render,
}) {
  function openEditor(lot = {}) {
    openModal(`<p class="eyebrow">BASE PRODUCTIVA</p><h2>${lot.id ? 'Editar lote' : 'Nuevo lote'}</h2><form id="lotForm"><input type="hidden" name="id" value="${escapeHtml(lot.id || '')}"><div class="form-grid"><label>Nombre<input name="name" value="${escapeHtml(lot.name || '')}" required></label><label>Estado<select name="status"><option ${lot.status === 'Activo' ? 'selected' : ''}>Activo</option><option ${lot.status === 'En descanso' ? 'selected' : ''}>En descanso</option><option ${lot.status === 'Inactivo' ? 'selected' : ''}>Inactivo</option></select></label><label>Superficie (ha)<input name="hectares" type="number" min="0" step="0.1" value="${Number(lot.hectares || 0)}" required></label><label>Cultivo<input name="crop" value="${escapeHtml(lot.crop || '')}" placeholder="Alfalfa, trigo..."></label><label>Variedad<input name="variety" value="${escapeHtml(lot.variety || '')}"></label><label>Fecha de siembra<input name="sowing_date" type="date" value="${escapeHtml(lot.sowing_date || '')}"></label><label>Último corte<input name="last_cut" type="date" value="${escapeHtml(lot.last_cut || '')}"></label><label>Último riego<input name="last_irrigation" type="date" value="${escapeHtml(lot.last_irrigation || '')}"></label><label class="wide">Próxima tarea<input name="next_task" value="${escapeHtml(lot.next_task || '')}" placeholder="Ej.: revisar humedad, fertilizar..."></label><label class="wide">Observaciones<textarea name="notes">${escapeHtml(lot.notes || '')}</textarea></label></div><button class="primary">Guardar lote</button><p id="lotMsg" class="error hidden"></p></form>`);
    select('#lotForm').onsubmit = saveLot;
  }

  async function saveLot(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    const id = form.get('id');
    const message = select('#lotMsg');

    try {
      const hectares = Number(form.get('hectares'));
      const row = {
        company_id: state.companyId,
        name: String(form.get('name')).trim(),
        status: form.get('status'),
        hectares,
        area_ha: hectares,
        crop: form.get('crop') || null,
        variety: form.get('variety') || null,
        sowing_date: form.get('sowing_date') || null,
        last_cut: form.get('last_cut') || null,
        last_irrigation: form.get('last_irrigation') || null,
        next_task: form.get('next_task') || null,
        notes: form.get('notes') || null,
        updated_at: new Date().toISOString(),
      };

      if (!row.name) throw new Error('Ingresá el nombre del lote.');
      if (row.hectares < 0) {
        throw new Error('La superficie no puede ser negativa.');
      }

      await service.saveLot({ id, row });
      select('#modalRoot').innerHTML = '';
      await loadData();
      state.page = 'lots';
      render();
    } catch (error) {
      message.textContent = error.message;
      message.classList.remove('hidden');
    }
  }

  return { openEditor };
}

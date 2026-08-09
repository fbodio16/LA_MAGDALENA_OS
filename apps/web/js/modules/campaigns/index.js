export function createCampaignsModule({ state, supabase, escapeHtml, openModal, loadData, render }) {
  const money = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0));
  const number = (value, digits = 0) => new Intl.NumberFormat('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value || 0));
  const campaigns = () => [...(state.campaigns || [])].sort((a,b)=>String(b.start_date||'').localeCompare(String(a.start_date||'')));
  const selected = () => state.selectedCampaignId || campaigns().find(c=>c.status==='Activa')?.id || campaigns()[0]?.id || '';
  const campaignById = id => campaigns().find(c=>c.id===id);
  const linked = (row,id) => row.campaign_id===id || (!row.campaign_id && campaignById(id)?.status==='Activa');

  function metrics(campaign) {
    if (!campaign) return { lots:[], cuts:[], sales:[], trips:[], hectares:0, rolls:0, tons:0, revenue:0, costs:0, margin:0, collected:0, pending:0, transportMargin:0 };
    const lots=(state.lots||[]).filter(x=>linked(x,campaign.id));
    const lotIds=new Set(lots.map(x=>x.id));
    const cuts=(state.cuts||[]).filter(x=>x.campaign_id===campaign.id || (!x.campaign_id && lotIds.has(x.lot_id)));
    const sales=(state.salesOrders||[]).filter(x=>linked(x,campaign.id) && x.status!=='Anulada');
    const trips=(state.trips||[]).filter(x=>linked(x,campaign.id) && x.status!=='Cancelado');
    const hectares=lots.reduce((s,x)=>s+Number(x.hectares||x.area_ha||0),0);
    const rolls=cuts.reduce((s,x)=>s+Number(x.bales||x.rolls||0),0);
    const tons=cuts.reduce((s,x)=>s+Number(x.total_kg||0)/1000,0);
    const revenue=sales.reduce((s,x)=>s+Number(x.total_amount||0),0);
    const collected=sales.reduce((s,x)=>s+Number(x.paid_amount||0),0);
    const productionCosts=cuts.reduce((s,x)=>s+Number(x.total_cost||x.cost||0),0);
    const transportIncome=trips.reduce((s,x)=>s+Number(x.income||0),0);
    const transportCosts=trips.reduce((s,x)=>s+Number(x.cost||0),0);
    const costs=productionCosts+transportCosts;
    return {lots,cuts,sales,trips,hectares,rolls,tons,revenue:revenue+transportIncome,costs,margin:revenue+transportIncome-costs,collected,pending:Math.max(0,revenue-collected),transportMargin:transportIncome-transportCosts};
  }

  function renderPage() {
    const rows=campaigns();
    const id=selected();
    state.selectedCampaignId=id;
    const campaign=campaignById(id);
    const m=metrics(campaign);
    const options=rows.map(c=>`<option value="${c.id}" ${c.id===id?'selected':''}>${escapeHtml(c.name)} · ${escapeHtml(c.status)}</option>`).join('');
    const progress=campaign?.target_rolls?Math.min(100,Math.round(m.rolls/Number(campaign.target_rolls)*100)):0;
    const lotRows=m.lots.map(l=>{const cuts=m.cuts.filter(x=>x.lot_id===l.id);const rolls=cuts.reduce((s,x)=>s+Number(x.bales||x.rolls||0),0);const kg=cuts.reduce((s,x)=>s+Number(x.total_kg||0),0);return `<tr><td><b>${escapeHtml(l.name)}</b><small>${escapeHtml(l.crop||'Sin cultivo')}</small></td><td>${number(l.hectares||l.area_ha,2)} ha</td><td>${cuts.length}</td><td>${number(rolls)} rollos</td><td>${number(kg/1000,1)} t</td><td>${Number(l.hectares||l.area_ha)?number(rolls/Number(l.hectares||l.area_ha),1):'0,0'} rollos/ha</td></tr>`}).join('');
    const history=rows.map(c=>{const x=metrics(c);return `<tr><td><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.start_date||'')} → ${escapeHtml(c.end_date||'Abierta')}</small></td><td><span class="pill">${escapeHtml(c.status)}</span></td><td>${number(x.hectares,2)} ha</td><td>${number(x.rolls)} rollos</td><td>${money(x.revenue)}</td><td class="${x.margin>=0?'positive':'negative'}">${money(x.margin)}</td><td><button class="secondary editCampaign" data-id="${c.id}">Editar</button></td></tr>`}).join('');
    return `<div class="page-head"><div><p class="eyebrow">GESTIÓN INTEGRAL DE CAMPAÑA · 13.0.0</p><h2>Campañas agrícolas</h2><p class="muted">Integra lotes, cortes, stock, ventas, cobranzas y transporte en un único resultado.</p></div><button class="primary newCampaign">+ Nueva campaña</button></div>
      <div class="panel"><div class="panel-title"><div><h3>Campaña seleccionada</h3><p class="muted">Elegí la campaña para ver su avance y rentabilidad.</p></div><select id="campaignSelector"><option value="">Sin campaña</option>${options}</select></div>${campaign?`<div class="metrics"><div class="metric"><span>Superficie</span><b>${number(m.hectares,2)} ha</b><small>${m.lots.length} lotes</small></div><div class="metric"><span>Producción</span><b>${number(m.rolls)} rollos</b><small>${number(m.tons,1)} toneladas</small></div><div class="metric"><span>Ingresos</span><b>${money(m.revenue)}</b><small>Cobrado ${money(m.collected)}</small></div><div class="metric"><span>Costos</span><b>${money(m.costs)}</b><small>Producción y logística</small></div><div class="metric"><span>Margen</span><b class="${m.margin>=0?'positive':'negative'}">${money(m.margin)}</b><small>Por cobrar ${money(m.pending)}</small></div><div class="metric"><span>Viajes</span><b>${m.trips.length}</b><small>Margen ${money(m.transportMargin)}</small></div></div>
      <div class="campaign-progress"><div class="panel-title"><div><h3>Objetivo productivo</h3><p class="muted">${number(m.rolls)} de ${number(campaign.target_rolls||0)} rollos previstos.</p></div><b>${progress}%</b></div><div class="progress-track"><span style="width:${progress}%"></span></div></div>`:'<p class="empty">Todavía no hay campañas creadas.</p>'}</div>
      ${campaign?`<div class="panel"><div class="panel-title"><div><h3>Rendimiento por lote</h3><p class="muted">Producción acumulada dentro de la campaña seleccionada.</p></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Lote</th><th>Superficie</th><th>Cortes</th><th>Producción</th><th>Toneladas</th><th>Rendimiento</th></tr></thead><tbody>${lotRows||'<tr><td colspan="6" class="empty">No hay lotes asociados.</td></tr>'}</tbody></table></div></div>`:''}
      <div class="panel"><div class="panel-title"><div><h3>Historial de campañas</h3><p class="muted">Comparación productiva y económica entre campañas.</p></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Campaña</th><th>Estado</th><th>Superficie</th><th>Producción</th><th>Ingresos</th><th>Margen</th><th></th></tr></thead><tbody>${history||'<tr><td colspan="7" class="empty">Todavía no hay campañas registradas.</td></tr>'}</tbody></table></div></div>`;
  }

  function campaignModal(seed={}) {
    openModal(`<p class="eyebrow">CAMPAÑA AGRÍCOLA · 13.0.0</p><h2>${seed.id?'Editar campaña':'Nueva campaña'}</h2><form id="campaignForm"><input type="hidden" name="id" value="${seed.id||''}"><div class="form-grid"><label>Nombre<input name="name" value="${escapeHtml(seed.name||'Alfalfa 2026/27')}" required></label><label>Estado<select name="status">${['Planificada','Activa','Cerrada'].map(v=>`<option ${seed.status===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Fecha de inicio<input name="start_date" type="date" value="${seed.start_date||new Date().toISOString().slice(0,10)}" required></label><label>Fecha de cierre<input name="end_date" type="date" value="${seed.end_date||''}"></label><label>Cultivo principal<input name="crop" value="${escapeHtml(seed.crop||'Alfalfa')}"></label><label>Objetivo de rollos<input name="target_rolls" type="number" min="0" value="${Number(seed.target_rolls||0)}"></label><label>Objetivo de ingresos (ARS)<input name="target_revenue" type="number" min="0" step="0.01" value="${Number(seed.target_revenue||0)}"></label><label class="wide">Observaciones<textarea name="notes">${escapeHtml(seed.notes||'')}</textarea></label></div><button class="primary">Guardar campaña</button><p id="campaignMsg" class="error hidden"></p></form>`);
    document.querySelector('#campaignForm').onsubmit=saveCampaign;
  }

  async function saveCampaign(event) {
    event.preventDefault();
    const f=new FormData(event.target),id=f.get('id');
    const row={company_id:state.companyId,name:f.get('name'),status:f.get('status'),start_date:f.get('start_date'),end_date:f.get('end_date')||null,crop:f.get('crop')||null,target_rolls:Number(f.get('target_rolls')||0),target_revenue:Number(f.get('target_revenue')||0),notes:f.get('notes')||null};
    const result=id?await supabase.from('campaigns').update(row).eq('id',id):await supabase.from('campaigns').insert(row).select().single();
    if(result.error){const m=document.querySelector('#campaignMsg');m.textContent=result.error.message;m.classList.remove('hidden');return;}
    if(!id&&result.data)state.selectedCampaignId=result.data.id;
    document.querySelector('#modalRoot').innerHTML='';await loadData();render();
  }

  function bind() {
    document.querySelectorAll('.newCampaign').forEach(b=>b.onclick=()=>campaignModal());
    document.querySelectorAll('.editCampaign').forEach(b=>b.onclick=()=>campaignModal(campaignById(b.dataset.id)||{}));
    const selector=document.querySelector('#campaignSelector');if(selector)selector.onchange=()=>{state.selectedCampaignId=selector.value;render();};
  }
  return {renderPage,bind};
}

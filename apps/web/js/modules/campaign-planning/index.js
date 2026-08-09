export function createCampaignPlanningModule({
  state,supabase,escapeHtml,openModal,loadData,render
}){
  const esc=escapeHtml;
  const n=v=>Number(v||0);
  const money=v=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n(v));
  const cropName=id=>state.cropCatalog.find(x=>x.id===id)?.name||'Cultivo';
  const lotName=id=>state.lots.find(x=>x.id===id)?.name||'Lote';
  const seasonName=id=>state.cropSeasons.find(x=>x.id===id)?.name||'Sin campaña';

  function calc(plan){
    const revenue=n(plan.planned_area_ha)*n(plan.expected_yield)*n(plan.expected_price);
    const cost=n(plan.planned_area_ha)*(n(plan.direct_cost_per_ha)+n(plan.indirect_cost_per_ha)+n(plan.irrigation_cost_per_ha)+n(plan.harvest_cost_per_ha));
    return {revenue,cost,margin:revenue-cost};
  }

  function economicRow(plan){
    const x=calc(plan);
    return `<div class="campaign-economy-row">
      <span><b>${esc(cropName(plan.crop_id))}</b><small>${esc(seasonName(plan.season_id))}</small></span>
      <span>${n(plan.planned_area_ha).toFixed(1)} ha</span>
      <span>${money(x.revenue)}</span>
      <span>${money(x.cost)}</span>
      <span class="${x.margin>=0?'positive':'negative'}">${money(x.margin)}</span>
      <span><button class="secondary editEconomicPlan" data-id="${plan.id}">Editar</button></span>
    </div>`;
  }

  function rotationMatrix(){
    const years=[2026,2027,2028,2029,2030];
    const rows=(state.lots||[]).map(lot=>{
      const entries=(state.rotationPlanEntries||[]).filter(x=>x.lot_id===lot.id);
      return `<div class="rotation-row">
        <span><b>${esc(lot.name)}</b><small>${n(lot.area_ha).toFixed(2)} ha</small></span>
        ${years.map(y=>{
          const e=entries.find(x=>n(x.plan_year)===y);
          return `<button class="rotation-cell editRotationEntry" data-lot="${lot.id}" data-year="${y}" data-id="${e?.id||''}"><b>${e?esc(cropName(e.crop_id)):'＋'}</b><small>${e?esc(e.status):'Planificar'}</small></button>`;
        }).join('')}
      </div>`;
    }).join('');
    return `<div class="rotation-table"><div class="rotation-head"><span>Lote</span>${years.map(y=>`<span>${y}</span>`).join('')}</div>${rows}</div>`;
  }

  function renderPage(){
    const plans=state.cropEconomicPlans||[];
    const totals=plans.reduce((a,p)=>{
      const x=calc(p);a.area+=n(p.planned_area_ha);a.revenue+=x.revenue;a.cost+=x.cost;a.margin+=x.margin;return a;
    },{area:0,revenue:0,cost:0,margin:0});
    const seasons=state.cropSeasons||[];
    const rotations=state.rotationPlanEntries||[];

    return `<section class="campaign-planning-page">
      <section class="campaign-planning-hero">
        <div><p class="eyebrow">CAMPAÑAS · ROTACIONES · ECONOMÍA</p><h2>Plan productivo 2026–2030</h2><p>Organizá cultivos por lote, compará márgenes y proyectá los próximos años.</p></div>
        <div class="campaign-planning-actions"><button class="primary newSeason">＋ Campaña</button><button class="secondary newEconomicPlan">💰 Presupuesto</button></div>
      </section>

      <div class="campaign-planning-kpis">
        <article><small>Campañas</small><b>${seasons.length}</b><span>creadas</span></article>
        <article><small>Superficie planificada</small><b>${totals.area.toFixed(1)} ha</b><span>en presupuestos</span></article>
        <article><small>Ingreso esperado</small><b>${money(totals.revenue)}</b><span>estimación bruta</span></article>
        <article><small>Margen esperado</small><b class="${totals.margin>=0?'positive':'negative'}">${money(totals.margin)}</b><span>antes de impuestos</span></article>
      </div>

      <section class="panel">
        <div class="panel-title"><div><p class="eyebrow">ROTACIONES</p><h3>Plan por lote y año</h3><p class="muted">Hacé clic en cualquier celda para asignar o editar el cultivo.</p></div><span class="pill">${rotations.length} decisiones</span></div>
        ${rotationMatrix()}
      </section>

      <section class="panel">
        <div class="panel-title"><div><p class="eyebrow">ECONOMÍA POR CULTIVO</p><h3>Comparador de márgenes</h3></div><button class="secondary newEconomicPlan">Agregar presupuesto</button></div>
        <div class="campaign-economy-table">
          <div class="campaign-economy-head"><span>Cultivo</span><span>Ha</span><span>Ingreso</span><span>Costo</span><span>Margen</span><span></span></div>
          ${plans.length?plans.map(economicRow).join(''):'<div class="empty"><b>Sin presupuestos cargados.</b><span>Creá un presupuesto por cultivo para comparar escenarios.</span></div>'}
        </div>
      </section>

      <div class="campaign-planning-grid">
        <section class="panel">
          <div class="panel-title"><div><p class="eyebrow">CAMPAÑAS</p><h3>Períodos productivos</h3></div><button class="secondary newSeason">Crear</button></div>
          <div class="season-list">${seasons.length?seasons.map(s=>`<article><div><b>${esc(s.name)}</b><small>${esc(s.start_date)}${s.end_date?' → '+esc(s.end_date):''}</small></div><span class="pill ${s.status==='active'?'ok':'neutral'}">${esc(s.status)}</span><button class="secondary editSeason" data-id="${s.id}">Editar</button></article>`).join(''):'<div class="empty"><b>No hay campañas.</b><span>Creá 2026/27, 2027/28 y los períodos que necesites.</span></div>'}</div>
        </section>

        <section class="panel">
          <div class="panel-title"><div><p class="eyebrow">REGLAS DE ROTACIÓN</p><h3>Secuencias recomendadas</h3></div><span class="pill">${state.cropRotationRules.length}</span></div>
          <div class="rotation-rules">${state.cropRotationRules.slice(0,8).map(r=>`<article><b>${esc(cropName(r.predecessor_crop_id))} → ${esc(cropName(r.successor_crop_id))}</b><span>${n(r.suitability_score).toFixed(0)}/100</span><p>${esc(r.rationale||'Regla editable')}</p></article>`).join('')}</div>
        </section>
      </div>
    </section>`;
  }

  function seasonModal(season=null){
    openModal(`<p class="eyebrow">CAMPAÑA</p><h2>${season?'Editar':'Nueva'} campaña</h2>
      <form id="seasonForm"><div class="form-grid">
        <label>Nombre<input name="name" value="${esc(season?.name||'')}" placeholder="Ej.: 2026/27" required></label>
        <label>Inicio<input name="start_date" type="date" value="${season?.start_date||''}" required></label>
        <label>Fin<input name="end_date" type="date" value="${season?.end_date||''}"></label>
        <label>Estado<select name="status">${['planned','active','closed','archived'].map(v=>`<option ${season?.status===v?'selected':''}>${v}</option>`).join('')}</select></label>
        <label class="wide">Notas<textarea name="notes">${esc(season?.notes||'')}</textarea></label>
      </div><button class="primary">Guardar campaña</button></form>`);
    document.querySelector('#seasonForm').onsubmit=async e=>{
      e.preventDefault();const f=new FormData(e.target);
      const row={company_id:state.companyId,name:f.get('name'),start_date:f.get('start_date'),end_date:f.get('end_date')||null,status:f.get('status'),notes:f.get('notes')||null};
      const q=season?supabase.from('crop_seasons').update(row).eq('id',season.id):supabase.from('crop_seasons').insert({...row,created_by:state.session.user.id});
      const {error}=await q;if(error)return alert(error.message);
      document.querySelector('#modalRoot').innerHTML='';await loadData();render();
    };
  }

  function economicModal(plan=null){
    openModal(`<p class="eyebrow">PRESUPUESTO POR CULTIVO</p><h2>${plan?'Editar':'Nuevo'} escenario</h2>
      <form id="economicPlanForm"><div class="form-grid">
        <label>Campaña<select name="season_id"><option value="">Sin campaña</option>${state.cropSeasons.map(s=>`<option value="${s.id}" ${plan?.season_id===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>
        <label>Cultivo<select name="crop_id" required>${state.cropCatalog.filter(x=>x.active).map(c=>`<option value="${c.id}" ${plan?.crop_id===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
        <label>Superficie (ha)<input name="planned_area_ha" type="number" step=".01" value="${plan?.planned_area_ha||''}" required></label>
        <label>Rendimiento esperado<input name="expected_yield" type="number" step=".01" value="${plan?.expected_yield||''}"></label>
        <label>Unidad<input name="yield_unit" value="${esc(plan?.yield_unit||'t/ha')}"></label>
        <label>Precio esperado (ARS)<input name="expected_price" type="number" step=".01" value="${plan?.expected_price||''}"></label>
        <label>Costo directo/ha<input name="direct_cost_per_ha" type="number" step=".01" value="${plan?.direct_cost_per_ha||0}"></label>
        <label>Costo indirecto/ha<input name="indirect_cost_per_ha" type="number" step=".01" value="${plan?.indirect_cost_per_ha||0}"></label>
        <label>Riego/ha<input name="irrigation_cost_per_ha" type="number" step=".01" value="${plan?.irrigation_cost_per_ha||0}"></label>
        <label>Cosecha/ha<input name="harvest_cost_per_ha" type="number" step=".01" value="${plan?.harvest_cost_per_ha||0}"></label>
        <label class="wide">Notas<textarea name="notes">${esc(plan?.notes||'')}</textarea></label>
      </div><button class="primary">Guardar presupuesto</button></form>`);
    document.querySelector('#economicPlanForm').onsubmit=async e=>{
      e.preventDefault();const f=new FormData(e.target);
      const row={company_id:state.companyId,season_id:f.get('season_id')||null,crop_id:f.get('crop_id'),planned_area_ha:n(f.get('planned_area_ha')),expected_yield:f.get('expected_yield')?n(f.get('expected_yield')):null,yield_unit:f.get('yield_unit')||null,expected_price:f.get('expected_price')?n(f.get('expected_price')):null,direct_cost_per_ha:n(f.get('direct_cost_per_ha')),indirect_cost_per_ha:n(f.get('indirect_cost_per_ha')),irrigation_cost_per_ha:n(f.get('irrigation_cost_per_ha')),harvest_cost_per_ha:n(f.get('harvest_cost_per_ha')),notes:f.get('notes')||null};
      const q=plan?supabase.from('crop_economic_plans').update(row).eq('id',plan.id):supabase.from('crop_economic_plans').insert({...row,created_by:state.session.user.id});
      const {error}=await q;if(error)return alert(error.message);
      document.querySelector('#modalRoot').innerHTML='';await loadData();render();
    };
  }

  function rotationModal({lotId,year,entry=null}){
    openModal(`<p class="eyebrow">ROTACIÓN</p><h2>${esc(lotName(lotId))} · ${year}</h2>
      <form id="rotationEntryForm"><div class="form-grid">
        <label>Cultivo<select name="crop_id" required>${state.cropCatalog.filter(x=>x.active).map(c=>`<option value="${c.id}" ${entry?.crop_id===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
        <label>Campaña<select name="season_id"><option value="">Sin campaña</option>${state.cropSeasons.map(s=>`<option value="${s.id}" ${entry?.season_id===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>
        <label>Superficie (ha)<input name="area_ha" type="number" step=".01" value="${entry?.area_ha||''}"></label>
        <label>Estado<select name="status">${['planned','confirmed','active','completed','cancelled'].map(v=>`<option ${entry?.status===v?'selected':''}>${v}</option>`).join('')}</select></label>
        <label>Margen esperado (ARS)<input name="expected_margin" type="number" step=".01" value="${entry?.expected_margin||''}"></label>
        <label class="wide">Notas<textarea name="notes">${esc(entry?.notes||'')}</textarea></label>
      </div><button class="primary">Guardar rotación</button></form>`);
    document.querySelector('#rotationEntryForm').onsubmit=async e=>{
      e.preventDefault();const f=new FormData(e.target);
      const row={company_id:state.companyId,lot_id:lotId,crop_id:f.get('crop_id'),season_id:f.get('season_id')||null,plan_year:year,area_ha:f.get('area_ha')?n(f.get('area_ha')):null,status:f.get('status'),expected_margin:f.get('expected_margin')?n(f.get('expected_margin')):null,notes:f.get('notes')||null};
      const q=entry?supabase.from('rotation_plan_entries').update(row).eq('id',entry.id):supabase.from('rotation_plan_entries').insert({...row,created_by:state.session.user.id});
      const {error}=await q;if(error)return alert(error.message);
      document.querySelector('#modalRoot').innerHTML='';await loadData();render();
    };
  }

  function bind(){
    document.querySelectorAll('.newSeason').forEach(b=>b.onclick=()=>seasonModal());
    document.querySelectorAll('.editSeason').forEach(b=>b.onclick=()=>seasonModal(state.cropSeasons.find(x=>x.id===b.dataset.id)));
    document.querySelectorAll('.newEconomicPlan').forEach(b=>b.onclick=()=>economicModal());
    document.querySelectorAll('.editEconomicPlan').forEach(b=>b.onclick=()=>economicModal(state.cropEconomicPlans.find(x=>x.id===b.dataset.id)));
    document.querySelectorAll('.editRotationEntry').forEach(b=>b.onclick=()=>rotationModal({lotId:b.dataset.lot,year:Number(b.dataset.year),entry:state.rotationPlanEntries.find(x=>x.id===b.dataset.id)}));
  }

  return {renderPage,bind};
}
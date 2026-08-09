export function createCommandCenterModule({
  state,supabase,escapeHtml,openModal,loadData,render,setPage
}){
  const esc=escapeHtml;
  const n=v=>Number(v||0);
  const cropName=id=>state.cropCatalog.find(x=>x.id===id)?.name||'Sin cultivo';
  const lotName=id=>state.lots.find(x=>x.id===id)?.name||'Lote';

  function cycleCard(cycle){
    return `<article class="crop-cycle-card">
      <div><small>${esc(lotName(cycle.lot_id))}</small><b>${esc(cropName(cycle.crop_id))}</b><span>${esc(cycle.variety||'Variedad sin informar')}</span></div>
      <div><small>Superficie</small><b>${n(cycle.area_ha).toFixed(2)} ha</b></div>
      <div><small>Estado</small><b>${esc(cycle.status)}</b></div>
      <button class="secondary editCropCycle" data-id="${cycle.id}">Editar</button>
    </article>`;
  }

  function renderPage(){
    const active=(state.lotCropCycles||[]).filter(x=>x.status==='active');
    const planned=(state.lotCropCycles||[]).filter(x=>x.status==='planned');
    const activeArea=active.reduce((s,x)=>s+n(x.area_ha),0);
    const cropTypes=new Set(active.map(x=>x.crop_id)).size;
    const alerts=(state.fieldRecommendations||[]).filter(x=>x.status==='activa'&&['alta','critica'].includes(x.priority)).length;
    const tasks=(state.dailyFieldTasks||[]).filter(x=>['pendiente','en_curso'].includes(x.status)).length;

    return `<section class="command-center-page">
      <section class="command-center-hero">
        <div><p class="eyebrow">CENTRO DE COMANDO AGRONÓMICO</p><h2>La Magdalena, hoy</h2><p>Operación actual y planificación de los próximos ciclos productivos.</p></div>
        <div class="command-hero-actions"><button class="primary newCropCycle">＋ Asignar cultivo</button><button class="secondary manageCropCatalog">🌱 Catálogo de cultivos</button></div>
      </section>

      <div class="command-kpis">
        <article><small>Cultivos disponibles</small><b>${state.cropCatalog.length}</b><span>catálogo editable</span></article>
        <article><small>Ciclos activos</small><b>${active.length}</b><span>${cropTypes} tipos de cultivo</span></article>
        <article><small>Superficie activa</small><b>${activeArea.toFixed(1)} ha</b><span>asignadas a campañas</span></article>
        <article><small>Acciones pendientes</small><b>${tasks+alerts}</b><span>tareas y alertas</span></article>
      </div>

      <div class="command-main-grid">
        <section class="panel">
          <div class="panel-title"><div><p class="eyebrow">CAMPAÑA ACTUAL</p><h3>Cultivos por lote</h3></div><button class="secondary newCropCycle">Agregar</button></div>
          <div class="crop-cycle-list">${active.length?active.map(cycleCard).join(''):'<div class="empty"><b>No hay ciclos activos.</b><span>Asigná alfalfa, trigo u otro cultivo a cada lote.</span></div>'}</div>
        </section>
        <section class="panel">
          <div class="panel-title"><div><p class="eyebrow">PRÓXIMOS AÑOS</p><h3>Planificación</h3></div><span class="pill">${planned.length} planificados</span></div>
          <div class="crop-planning-list">${planned.length?planned.map(cycleCard).join(''):'<div class="empty"><b>Sin cultivos planificados.</b><span>Podés preparar rotaciones para 2027, 2028 y campañas siguientes.</span></div>'}</div>
        </section>
      </div>

      <section class="panel">
        <div class="panel-title"><div><p class="eyebrow">CATÁLOGO MULTICULTIVO</p><h3>Cultivos habilitados</h3></div><button class="secondary manageCropCatalog">Administrar</button></div>
        <div class="crop-catalog-grid">${state.cropCatalog.filter(x=>x.active).map(c=>`<article><span>🌱</span><div><b>${esc(c.name)}</b><small>${esc(c.crop_group)} · ${esc(c.cycle_type)}</small></div></article>`).join('')}</div>
      </section>

      <section class="panel">
        <div class="panel-title"><div><p class="eyebrow">ACCESOS DIRECTOS</p><h3>Tomar decisiones</h3></div></div>
        <div class="command-shortcuts">
          <button class="commandGo" data-page="agronomic-assistant">🧠<b>Asistente Agronómico</b><span>Prioridades y alertas</span></button>
          <button class="commandGo" data-page="field-book">🌎<b>Gemelo Digital</b><span>Historia por lote</span></button>
          <button class="commandGo" data-page="field-operations">📱<b>Carga de Campo</b><span>Registrar datos</span></button>
          <button class="commandGo" data-page="campaigns">📅<b>Campañas</b><span>Plan productivo</span></button>
        </div>
      </section>
    </section>`;
  }

  function catalogModal(){
    openModal(`<p class="eyebrow">CATÁLOGO MULTICULTIVO</p><h2>Cultivos disponibles</h2>
      <form id="cropCatalogForm"><div class="form-grid">
        <label>Nombre<input name="name" required></label>
        <label>Nombre científico<input name="scientific_name"></label>
        <label>Grupo<select name="crop_group"><option>cereal</option><option>oleaginosa</option><option>forrajero</option><option>cultivo_servicio</option><option>hortícola</option><option>otro</option></select></label>
        <label>Ciclo<select name="cycle_type"><option>annual</option><option>perennial</option><option>biennial</option></select></label>
        <label>Días de ciclo<input name="default_cycle_days" type="number"></label>
      </div><button class="primary">Agregar cultivo</button></form>
      <div class="modal-crop-list">${state.cropCatalog.map(c=>`<div><b>${esc(c.name)}</b><span>${esc(c.crop_group)}</span></div>`).join('')}</div>`);
    document.querySelector('#cropCatalogForm').onsubmit=async e=>{
      e.preventDefault();const f=new FormData(e.target);
      const {error}=await supabase.from('crop_catalog').insert({
        company_id:state.companyId,name:f.get('name'),scientific_name:f.get('scientific_name')||null,
        crop_group:f.get('crop_group'),cycle_type:f.get('cycle_type'),
        default_cycle_days:f.get('default_cycle_days')?Number(f.get('default_cycle_days')):null,
        created_by:state.session.user.id
      });
      if(error)return alert(error.message);
      document.querySelector('#modalRoot').innerHTML='';await loadData();render();
    };
  }

  function cycleModal(cycle=null){
    openModal(`<p class="eyebrow">CICLO PRODUCTIVO</p><h2>${cycle?'Editar':'Asignar'} cultivo</h2>
      <form id="cropCycleForm"><div class="form-grid">
        <label>Lote<select name="lot_id" required>${state.lots.map(l=>`<option value="${l.id}" ${cycle?.lot_id===l.id?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label>
        <label>Cultivo<select name="crop_id" required>${state.cropCatalog.filter(x=>x.active).map(c=>`<option value="${c.id}" ${cycle?.crop_id===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
        <label>Variedad<input name="variety" value="${esc(cycle?.variety||'')}"></label>
        <label>Superficie (ha)<input name="area_ha" type="number" step=".01" value="${cycle?.area_ha||''}"></label>
        <label>Siembra<input name="planting_date" type="date" value="${cycle?.planting_date||''}"></label>
        <label>Cosecha esperada<input name="expected_harvest_date" type="date" value="${cycle?.expected_harvest_date||''}"></label>
        <label>Estado<select name="status">${['planned','active','harvested','closed','cancelled'].map(v=>`<option ${cycle?.status===v?'selected':''}>${v}</option>`).join('')}</select></label>
        <label>Antecesor<input name="predecessor_crop" value="${esc(cycle?.predecessor_crop||'')}"></label>
        <label class="wide">Notas<textarea name="notes">${esc(cycle?.notes||'')}</textarea></label>
      </div><button class="primary">Guardar ciclo</button></form>`);
    document.querySelector('#cropCycleForm').onsubmit=async e=>{
      e.preventDefault();const f=new FormData(e.target);
      const row={
        company_id:state.companyId,lot_id:f.get('lot_id'),crop_id:f.get('crop_id'),
        variety:f.get('variety')||null,area_ha:f.get('area_ha')?Number(f.get('area_ha')):null,
        planting_date:f.get('planting_date')||null,expected_harvest_date:f.get('expected_harvest_date')||null,
        status:f.get('status'),predecessor_crop:f.get('predecessor_crop')||null,notes:f.get('notes')||null
      };
      const q=cycle?supabase.from('lot_crop_cycles').update(row).eq('id',cycle.id):supabase.from('lot_crop_cycles').insert({...row,created_by:state.session.user.id});
      const {error}=await q;if(error)return alert(error.message);
      document.querySelector('#modalRoot').innerHTML='';await loadData();render();
    };
  }

  function bind(){
    document.querySelectorAll('.commandGo').forEach(b=>b.onclick=()=>setPage(b.dataset.page));
    document.querySelectorAll('.manageCropCatalog').forEach(b=>b.onclick=catalogModal);
    document.querySelectorAll('.newCropCycle').forEach(b=>b.onclick=()=>cycleModal());
    document.querySelectorAll('.editCropCycle').forEach(b=>b.onclick=()=>cycleModal((state.lotCropCycles||[]).find(x=>x.id===b.dataset.id)));
  }

  return {renderPage,bind};
}
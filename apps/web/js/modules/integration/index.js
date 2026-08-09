export function createIntegrationModule({state,supabase,escapeHtml,number,money,loadData,render,setPage}){
  const today=()=>new Date().toISOString().slice(0,10);
  const activeCampaign=()=>state.campaigns.find(c=>c.status==='Activa')||state.campaigns[0]||null;
  const produced=()=>state.cuts.reduce((sum,c)=>sum+Number(c.bales||c.rolls||0),0);
  const stockAvailable=()=>produced()-state.stockMovements.filter(m=>m.movement_type==='Salida').reduce((s,m)=>s+Number(m.quantity||0),0);
  const pendingSales=()=>state.salesOrders.filter(s=>s.status!=='Anulada'&&Number(s.total_amount||0)>Number(s.paid_amount||0));
  const overdueTasks=()=>state.workTasks.filter(t=>!['Completada','Cancelada'].includes(t.status)&&t.due_date<today());
  const lowInventory=()=>state.inventoryItems.filter(i=>Number(i.current_stock||0)<=Number(i.minimum_stock||0));
  const checks=()=>[
    {key:'company',label:'Empresa activa',ok:Boolean(state.companyId),detail:state.companies.find(c=>c.id===state.companyId)?.name||'Sin empresa'},
    {key:'lots',label:'Lotes válidos',ok:state.lots.length>0&&state.lots.every(l=>Number(l.hectares)>0&&l.name),detail:`${state.lots.length} lotes`},
    {key:'campaign',label:'Campaña activa',ok:Boolean(activeCampaign()),detail:activeCampaign()?.name||'Crear campaña'},
    {key:'production',label:'Producción probada',ok:state.cuts.length>0,detail:`${state.cuts.length} cortes`},
    {key:'stock',label:'Stock consistente',ok:stockAvailable()>=0,detail:`${Math.max(0,stockAvailable())} rollos disponibles`},
    {key:'clients',label:'Clientes maestros',ok:state.clients.length>0,detail:`${state.clients.length} clientes`},
    {key:'resources',label:'Recursos cargados',ok:state.equipment.length>0&&state.personnel.length>0,detail:`${state.equipment.length} equipos · ${state.personnel.length} personas`},
    {key:'precision',label:'Precisión lista',ok:Array.isArray(state.precisionObservations)&&Array.isArray(state.labAnalyses),detail:'Observaciones y laboratorio conectados'},
    {key:'security',label:'Auditoría y respaldo',ok:true,detail:'Controles instalados'}
  ];
  const score=()=>Math.round(checks().filter(x=>x.ok).length/checks().length*100);
  const blockers=()=>checks().filter(x=>!x.ok);
  const pageFor={lots:'lots',campaign:'campaigns',production:'production',stock:'production',clients:'clients',resources:'resources',precision:'precision-center',security:'data-safety',company:'saas'};
  const lastRun=()=>[...(state.validationRuns||[])].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))[0];

  function renderPage(){
    const pct=score(), campaign=activeCampaign(), pending=pendingSales(), due=overdueTasks(), low=lowInventory(), last=lastRun();
    const sales=state.salesOrders.filter(s=>s.status!=='Anulada').reduce((s,x)=>s+Number(x.total_amount||0),0);
    const collected=state.salesOrders.filter(s=>s.status!=='Anulada').reduce((s,x)=>s+Number(x.paid_amount||0),0);
    const transportMargin=state.trips.reduce((s,t)=>s+Number(t.income||0)-Number(t.cost||0),0);
    const ready=pct===100;
    return `<div class="hero"><div><p class="eyebrow">17.1 · CONSOLIDACIÓN OPERATIVA</p><h2>Puesta en marcha con datos reales</h2><p>Valida el circuito completo y deja una constancia antes de comenzar la carga definitiva.</p></div><div class="hero-kpi"><b>${pct}%</b><span>${ready?'habilitado':'preparación'}</span></div></div>
    <div class="kpi-grid"><article class="kpi"><span>CAMPAÑA</span><b>${escapeHtml(campaign?.name||'Sin definir')}</b><small>${campaign?.status||'Pendiente'}</small></article><article class="kpi"><span>PRODUCCIÓN</span><b>${number(produced())} rollos</b><small>${state.cuts.length} cortes</small></article><article class="kpi"><span>STOCK</span><b>${number(Math.max(0,stockAvailable()))}</b><small>rollos disponibles</small></article><article class="kpi"><span>VENTAS / COBROS</span><b>${money(sales)}</b><small>${money(collected)} cobrados</small></article><article class="kpi"><span>MARGEN LOGÍSTICO</span><b>${money(transportMargin)}</b><small>${state.trips.length} viajes</small></article></div>
    <div class="two-col"><section class="panel"><div class="section-head"><div><p class="eyebrow">CONTROL DE HABILITACIÓN</p><h3>${ready?'Sistema listo':'Faltan '+blockers().length+' controles'}</h3></div><span class="pill ${ready?'success':'warn'}">${pct}%</span></div><div class="checklist">${checks().map(c=>`<button class="check-row integrationGo" data-page="${pageFor[c.key]||'dashboard'}"><span class="check-icon ${c.ok?'ok':'pending'}">${c.ok?'✓':'!'}</span><span><b>${escapeHtml(c.label)}</b><small>${escapeHtml(c.detail)}</small></span><span>›</span></button>`).join('')}</div></section>
    <section class="panel"><p class="eyebrow">PRUEBA DE PUNTA A PUNTA</p><h3>Circuito mínimo obligatorio</h3><div class="flow-list">${[['1','Campaña y lotes','campaigns'],['2','Corte y partida','production'],['3','Movimiento de stock','production'],['4','Venta y cobro','sales'],['5','Viaje y entrega','transport'],['6','Resultado y respaldo','finance']].map(x=>`<button class="flow-step integrationGo" data-page="${x[2]}"><span>${x[0]}</span><div><b>${x[1]}</b><small>Abrir módulo</small></div><strong>→</strong></button>`).join('')}</div></section></div>
    <div class="three-col"><section class="panel"><p class="eyebrow">TAREAS</p><h3>${due.length} vencidas</h3><p class="muted">${due.length?due.slice(0,3).map(t=>escapeHtml(t.title)).join(' · '):'Sin tareas vencidas.'}</p></section><section class="panel"><p class="eyebrow">COBRANZAS</p><h3>${pending.length} pendientes</h3><p class="muted">Saldo ${money(pending.reduce((s,x)=>s+Number(x.total_amount||0)-Number(x.paid_amount||0),0))}</p></section><section class="panel"><p class="eyebrow">INVENTARIO</p><h3>${low.length} críticos</h3><p class="muted">${low.length?low.slice(0,3).map(i=>escapeHtml(i.name)).join(' · '):'Stock normal.'}</p></section></div>
    <section class="panel launch-panel"><div><p class="eyebrow">ACTA DE VALIDACIÓN</p><h3>${last?`Última validación: ${new Date(last.created_at).toLocaleString('es-AR')}`:'Todavía no se registró una validación'}</h3><p class="muted">${last?`${last.readiness_pct}% · ${escapeHtml(last.status)}`:'Completá los controles y registrá el resultado.'}</p></div><div class="actions"><button id="exportReadiness" class="secondary">Exportar diagnóstico CSV</button><button id="saveValidation" class="primary" ${ready?'':'disabled'}>${ready?'Habilitar datos reales':'Completar controles'}</button></div><p id="validationMsg" class="status hidden"></p></section>`;
  }
  function exportReadiness(){const rows=[['control','estado','detalle'],...checks().map(c=>[c.label,c.ok?'OK':'PENDIENTE',c.detail])];const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`diagnostico_lmos_${today()}.csv`;a.click();URL.revokeObjectURL(a.href)}
  async function saveValidation(){if(score()!==100)return;const msg=document.querySelector('#validationMsg');try{const row={company_id:state.companyId,readiness_pct:score(),status:'Habilitado para datos reales',checks_json:checks(),validated_by:state.session?.user?.id||null};const {error}=await supabase.from('operational_validation_runs').insert(row);if(error)throw error;await loadData();render()}catch(err){msg.textContent=err.message;msg.classList.remove('hidden')}}
  function bind(){document.querySelectorAll('.integrationGo').forEach(b=>b.onclick=()=>setPage(b.dataset.page));document.querySelector('#exportReadiness')?.addEventListener('click',exportReadiness);document.querySelector('#saveValidation')?.addEventListener('click',saveValidation)}
  return {renderPage,bind};
}

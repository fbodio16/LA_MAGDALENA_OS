
export function createEnterpriseControlModule({state,escapeHtml,number,render}){
  const esc=escapeHtml;
  const role=()=>state.membership?.role||'Cliente';
  const activeCompanies=()=>state.companies.filter(c=>(c.status||'active')==='active');
  const enabledModules=companyId=>state.modules.filter(m=>m.company_id===companyId&&m.enabled).length;
  const money=v=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(v||0));
  const getCompany=()=>state.companies.find(c=>c.id===state.companyId)||{};
  const health=()=>{
    const checks=[
      {label:'Sesión autenticada',ok:Boolean(state.session?.user?.id),detail:state.session?.user?.email||'Sin usuario'},
      {label:'Empresa activa',ok:Boolean(state.companyId),detail:getCompany().name||'Sin empresa seleccionada'},
      {label:'Base productiva',ok:(state.lots||[]).length>0,detail:`${(state.lots||[]).length} lotes`},
      {label:'Gemelo digital',ok:(state.geometries||[]).length>0,detail:`${(state.geometries||[]).length} geometrías`},
      {label:'Usuarios y roles',ok:(state.members||[]).length>0,detail:`${(state.members||[]).length} miembros`},
      {label:'Publicación web',ok:location.protocol==='https:'||location.hostname==='localhost',detail:location.hostname},
    ];
    return {checks,score:Math.round(checks.filter(x=>x.ok).length/checks.length*100)};
  };
  function renderPage(){
    const company=getCompany(),h=health(),openTasks=(state.dailyFieldTasks||[]).filter(x=>!['completada','completed','cancelada'].includes(String(x.status||'').toLowerCase())).length;
    const openOpps=(state.crmOpportunities||[]).filter(x=>!['Ganada','Perdida'].includes(x.stage)).length;
    const pendingOrders=(state.orders||[]).filter(x=>!['Completada','Cancelada'].includes(x.status)).length;
    const totalHa=(state.lots||[]).reduce((s,x)=>s+Number(x.hectares||x.area_ha||0),0);
    const companyMRR=activeCompanies().reduce((s,c)=>s+Number(c.monthly_price||0),0);
    return `<div class="page-head"><div><p class="eyebrow">PLATAFORMA ENTERPRISE · 30.0.0</p><h2>Centro de control empresarial</h2><p class="muted">Usuarios, empresas, seguridad, operación y estado online en una sola vista.</p></div><div class="actions"><span class="pill ok">Online</span><button class="primary enterpriseRefresh">Actualizar indicadores</button></div></div>
    <div class="metrics"><div class="metric"><span>Estado de plataforma</span><b>${h.score}%</b><small>${h.checks.filter(x=>x.ok).length} de ${h.checks.length} controles correctos</small></div><div class="metric"><span>Superficie gestionada</span><b>${number(totalHa,1)} ha</b><small>${(state.lots||[]).length} lotes</small></div><div class="metric"><span>Usuarios activos</span><b>${(state.members||[]).length}</b><small>rol actual: ${esc(role())}</small></div><div class="metric"><span>MRR plataforma</span><b>${money(companyMRR)}</b><small>${activeCompanies().length} empresas activas</small></div></div>
    <div class="enterprise-grid">
      <div class="panel"><div class="panel-title"><div><h3>Empresa seleccionada</h3><small>Configuración y capacidad habilitada.</small></div><span class="pill">${esc(company.plan||'Sin plan')}</span></div>
        <div class="enterprise-company"><div><span>Empresa</span><b>${esc(company.name||'—')}</b></div><div><span>Ubicación</span><b>${esc(company.location||'—')}</b></div><div><span>Módulos habilitados</span><b>${enabledModules(company.id)}</b></div><div><span>Estado</span><b>${esc(company.status||'active')}</b></div></div>
        <div class="enterprise-actions"><button class="secondary enterpriseGo" data-page="saas">Administrar empresas</button><button class="secondary enterpriseGo" data-page="data-safety">Seguridad de datos</button><button class="secondary enterpriseGo" data-page="admin">Usuarios y permisos</button></div>
      </div>
      <div class="panel"><div class="panel-title"><div><h3>Salud técnica</h3><small>Controles del entorno de producción.</small></div><span class="pill ${h.score===100?'ok':'warn'}">${h.score}%</span></div>
        <div class="enterprise-checks">${h.checks.map(x=>`<div class="enterprise-check"><span class="${x.ok?'ok':'bad'}">${x.ok?'✓':'!'}</span><div><b>${esc(x.label)}</b><small>${esc(x.detail)}</small></div></div>`).join('')}</div>
      </div>
    </div>
    <div class="grid3" style="margin-top:18px">
      <div class="panel"><h3>Operación pendiente</h3><div class="row"><div><b>${openTasks} tareas</b><small>trabajo de campo pendiente</small></div></div><div class="row"><div><b>${pendingOrders} órdenes T100</b><small>planificadas o en curso</small></div></div><button class="secondary enterpriseGo" data-page="operations">Abrir centro operativo</button></div>
      <div class="panel"><h3>Actividad comercial</h3><div class="row"><div><b>${(state.clients||[]).length} clientes</b><small>cartera registrada</small></div></div><div class="row"><div><b>${openOpps} oportunidades</b><small>pipeline abierto</small></div></div><button class="secondary enterpriseGo" data-page="crm">Abrir CRM</button></div>
      <div class="panel"><h3>Acceso desde cualquier lugar</h3><p class="muted">La aplicación está preparada para operar con Vercel, GitHub y Supabase.</p><div class="status"><b>Dirección pública</b><br>la-magdalena-os.vercel.app</div><p class="muted">La computadora local puede permanecer apagada.</p></div>
    </div>
    <div class="panel" style="margin-top:18px"><div class="panel-title"><div><h3>Usuarios y roles</h3><small>Separación de permisos por empresa.</small></div><span class="pill">${(state.members||[]).length}</span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Usuario</th><th>Rol</th><th>Empresa</th><th>Estado</th></tr></thead><tbody>${(state.members||[]).map(m=>`<tr><td><b>${esc(m.full_name||m.email||m.user_id||'Usuario')}</b><small>${esc(m.email||'')}</small></td><td>${esc(m.role||'Cliente')}</td><td>${esc(company.name||'—')}</td><td><span class="pill ok">${esc(m.status||'Activo')}</span></td></tr>`).join('')||'<tr><td colspan="4" class="empty">No hay usuarios cargados.</td></tr>'}</tbody></table></div>
    </div>`;
  }
  function bind(){
    document.querySelectorAll('.enterpriseGo').forEach(b=>b.onclick=()=>{state.page=b.dataset.page;render()});
    document.querySelectorAll('.enterpriseRefresh').forEach(b=>b.onclick=()=>render());
  }
  return {renderPage,bind};
}

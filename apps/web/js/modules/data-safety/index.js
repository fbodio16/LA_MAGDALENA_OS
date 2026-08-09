export function createDataSafetyModule({state,escapeHtml,render}){
  const tables=()=>({
    companies:state.companies,lots:state.lots,lot_geometries:state.geometries,
    precision_analyses:state.analyses,precision_orders:state.orders,clients:state.clients,
    irrigation_events:state.irrigations,alfalfa_cuts:state.cuts,transport_trips:state.trips,
    financial_movements:state.movements,company_modules:state.modules,
    company_members:state.members,company_invitations:state.invitations
  });
  const count=()=>Object.values(tables()).reduce((n,rows)=>n+(rows?.length||0),0);
  const duplicateNames=(rows,key='name')=>{const seen=new Set(),dups=[];for(const row of rows||[]){const v=String(row?.[key]||'').trim().toLowerCase();if(v&&seen.has(v))dups.push(row[key]);seen.add(v)}return [...new Set(dups)]};
  const issues=()=>{
    const out=[];
    const lotIds=new Set((state.lots||[]).map(x=>x.id));
    for(const cut of state.cuts||[])if(cut.lot_id&&!lotIds.has(cut.lot_id))out.push(`Corte sin lote válido: ${cut.id||cut.cut_date||'sin identificar'}`);
    for(const row of state.irrigations||[])if(row.lot_id&&!lotIds.has(row.lot_id))out.push(`Riego sin lote válido: ${row.id||row.event_date||'sin identificar'}`);
    for(const row of state.analyses||[])if(row.lot_id&&!lotIds.has(row.lot_id))out.push(`Análisis sin lote válido: ${row.id||row.flight_date||'sin identificar'}`);
    for(const n of duplicateNames(state.lots))out.push(`Nombre de lote duplicado: ${n}`);
    for(const n of duplicateNames(state.clients))out.push(`Cliente duplicado: ${n}`);
    for(const cut of state.cuts||[]){if(Number(cut.bales||cut.rolls||0)<0)out.push(`Cantidad negativa en corte ${cut.id||cut.cut_date}`);if(cut.cut_date&&new Date(cut.cut_date)>new Date())out.push(`Corte con fecha futura: ${cut.cut_date}`)}
    for(const m of state.movements||[])if(Number(m.amount||m.income||m.cost||0)<0)out.push(`Movimiento financiero con importe negativo: ${m.id||m.movement_date}`);
    return out;
  };
  const download=(name,text,type='application/json')=>{const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500)};
  const exportBackup=()=>{
    const company=state.companies.find(c=>c.id===state.companyId);
    const payload={format:'LA_MAGDALENA_OS_BACKUP',version:'7.0.0',created_at:new Date().toISOString(),company:{id:state.companyId,name:company?.name||''},record_count:count(),tables:tables()};
    const stamp=new Date().toISOString().slice(0,10);
    download(`LA_MAGDALENA_BACKUP_${stamp}.json`,JSON.stringify(payload,null,2));
    localStorage.setItem(`lmos:lastBackup:${state.companyId}`,new Date().toISOString());
    render();
  };
  const exportReport=()=>{
    const rows=[['Control','Resultado'],['Empresa',state.companies.find(c=>c.id===state.companyId)?.name||''],['Registros incluidos',count()],['Problemas detectados',issues().length],['Generado',new Date().toLocaleString('es-AR')],...issues().map((x,i)=>[`Problema ${i+1}`,x])];
    const csv=rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(';')).join('\n');
    download(`INFORME_INTEGRIDAD_${new Date().toISOString().slice(0,10)}.csv`,`\ufeff${csv}`,'text/csv;charset=utf-8');
  };
  const inspectFile=async file=>{
    const box=document.querySelector('#backupPreview');
    try{
      const data=JSON.parse(await file.text());
      if(data?.format!=='LA_MAGDALENA_OS_BACKUP'||!data?.tables)throw new Error('El archivo no es un respaldo válido de LA MAGDALENA OS.');
      const n=Object.values(data.tables).reduce((s,x)=>s+(Array.isArray(x)?x.length:0),0);
      box.innerHTML=`<div class="status"><b>Respaldo válido</b><br>Versión ${escapeHtml(data.version||'sin informar')} · ${escapeHtml(data.company?.name||'Empresa sin nombre')} · ${n} registros · ${escapeHtml(new Date(data.created_at).toLocaleString('es-AR'))}</div><p class="muted">La restauración permanece bloqueada en esta etapa para evitar sobrescribir datos. El archivo fue validado sin modificar Supabase.</p>`;
    }catch(err){box.innerHTML=`<p class="error">${escapeHtml(err.message)}</p>`}
  };
  function renderPage(){
    const found=issues();const last=localStorage.getItem(`lmos:lastBackup:${state.companyId}`);const lastText=last?new Date(last).toLocaleString('es-AR'):'Todavía no se generó';
    const checks=[
      ['Conexión y autenticación',!!state.session,'Sesión activa con Supabase'],
      ['Empresa seleccionada',!!state.companyId,'Contexto de empresa disponible'],
      ['Relaciones básicas',found.length===0,found.length?`${found.length} observación(es) para revisar`:'No se detectaron inconsistencias'],
      ['Respaldo descargado',!!last,`Último respaldo: ${lastText}`],
      ['Auditoría SQL instalada',false,'Pendiente aplicar supabase/004_data_integrity_audit.sql'],
      ['Prueba integral',false,'Pendiente ejecutar corte → stock → venta → cobro con datos de prueba']
    ];
    const ready=checks.every(x=>x[1]);
    return `<div class="page-head"><div><p class="eyebrow">ESTABILIZACIÓN 7.0</p><h2>Seguridad e integridad de datos</h2><p class="muted">Respaldo, diagnóstico y preparación antes de habilitar datos reales.</p></div><span class="pill ${ready?'':'warn'}">${ready?'APTO PARA DATOS REALES':'MODO PRUEBA'}</span></div>
    <div class="metrics"><div class="metric"><span>Registros respaldables</span><b>${count()}</b><small>De la empresa seleccionada</small></div><div class="metric"><span>Observaciones</span><b>${found.length}</b><small>Validación automática</small></div><div class="metric"><span>Último respaldo</span><b>${last?'Realizado':'Pendiente'}</b><small>${escapeHtml(lastText)}</small></div><div class="metric"><span>Estado general</span><b>${ready?'Habilitado':'En preparación'}</b><small>${ready?'Controles completos':'Usar solamente datos de prueba'}</small></div></div>
    <div class="grid2"><div class="panel"><div class="panel-title"><div><p class="eyebrow">LISTA DE CONTROL</p><h3>Preparación operativa</h3></div></div><div class="readiness-list">${checks.map(([name,ok,detail])=>`<article class="readiness-item"><span class="readiness-icon ${ok?'ok':'pending'}">${ok?'✓':'!'}</span><div><b>${escapeHtml(name)}</b><small>${escapeHtml(detail)}</small></div></article>`).join('')}</div></div>
    <div class="panel"><div class="panel-title"><div><p class="eyebrow">RESPALDO</p><h3>Exportación segura</h3></div></div><p>Genera un archivo JSON con los datos actualmente cargados para esta empresa. No borra ni modifica registros.</p><div class="actions"><button class="primary exportFullBackup">Descargar respaldo completo</button><button class="secondary exportIntegrityReport">Exportar informe CSV</button></div><hr><h3>Validar un respaldo</h3><label>Archivo JSON<input id="backupFile" type="file" accept="application/json,.json"></label><div id="backupPreview"></div></div></div>
    <div class="panel"><div class="panel-title"><div><p class="eyebrow">DIAGNÓSTICO</p><h3>Observaciones detectadas</h3></div></div>${found.length?`<div class="data-issues">${found.map(x=>`<p class="status">${escapeHtml(x)}</p>`).join('')}</div>`:'<p class="status">✓ No se detectaron inconsistencias básicas en los datos cargados.</p>'}<p class="muted">Este control detecta relaciones rotas, duplicados simples, cantidades negativas y fechas futuras. No reemplaza el respaldo ni la auditoría de base de datos.</p></div>`;
  }
  function bind(){document.querySelector('.exportFullBackup')?.addEventListener('click',exportBackup);document.querySelector('.exportIntegrityReport')?.addEventListener('click',exportReport);document.querySelector('#backupFile')?.addEventListener('change',e=>e.target.files?.[0]&&inspectFile(e.target.files[0]));}
  return{renderPage,bind};
}

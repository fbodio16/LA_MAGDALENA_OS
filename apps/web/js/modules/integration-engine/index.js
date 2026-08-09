export function createIntegrationEngineModule({state, escapeHtml, number, money, setPage}){
  const num=v=>Number(v||0);
  const lower=v=>String(v||'').toLowerCase();
  const sum=(items,fn)=>items.reduce((a,x)=>a+num(fn(x)),0);
  const latestDate=values=>values.filter(Boolean).sort().reverse()[0]||null;
  function metrics(){
    const cuts=state.cuts||[], sales=state.salesOrders||[], payments=state.salesPayments||[], trips=state.trips||[];
    const stockProduced=sum(cuts,c=>c.bales||c.rolls);
    const stockMoved=sum(state.stockMovements||[],m=>lower(m.direction||m.movement_type).includes('sal')?-num(m.quantity||m.bales):num(m.quantity||m.bales));
    const stock=Math.max(0,stockProduced+stockMoved);
    const salesTotal=sum(sales,s=>s.total_amount||s.total);
    const collected=sum(payments,p=>p.amount);
    const pending=Math.max(0,salesTotal-collected);
    const productionCosts=sum(cuts,c=>c.total_cost||c.costs||c.cost);
    const transportIncome=sum(trips,t=>t.revenue||t.income);
    const transportCosts=sum(trips,t=>t.total_cost||t.cost);
    const otherNet=sum(state.movements||[],m=>num(m.income)-num(m.cost));
    const result=salesTotal+transportIncome+otherNet-productionCosts-transportCosts;
    const lastActivity=latestDate([...cuts.map(x=>x.cut_date),...sales.map(x=>x.sale_date),...payments.map(x=>x.payment_date),...trips.map(x=>x.trip_date),...(state.fuelEntries||[]).map(x=>x.entry_date),...(state.workTasks||[]).map(x=>x.updated_at||x.created_at)]);
    return {stock,salesTotal,collected,pending,productionCosts,transportIncome,transportCosts,result,lastActivity};
  }
  function recommendations(m){
    const out=[];
    if(!(state.campaigns||[]).some(c=>lower(c.status).includes('activa'))) out.push(['Alta','Activar una campaña','La integración económica necesita una campaña activa para agrupar producción, ventas y transporte.','campaigns']);
    if(!(state.equipment||[]).length) out.push(['Alta','Cargar maquinaria','Registrar tractores y equipos para calcular costos reales por corte.','resources']);
    if(!(state.personnel||[]).length) out.push(['Media','Cargar personal','Agregar operarios y tarifas para completar el costo de mano de obra.','resources']);
    if(m.pending>0) out.push(['Alta','Revisar cobranzas',`Hay ${money(m.pending)} pendientes de cobro.`,'sales']);
    const overdue=(state.workTasks||[]).filter(t=>!['completada','cancelada'].includes(lower(t.status))&&t.due_date&&new Date(t.due_date)<new Date()).length;
    if(overdue) out.push(['Alta','Resolver tareas vencidas',`${overdue} tarea(s) operativa(s) están vencidas.`,'establishment']);
    const lowStock=(state.inventoryItems||[]).filter(i=>num(i.current_stock)<num(i.minimum_stock)).length;
    if(lowStock) out.push(['Media','Reponer inventario',`${lowStock} artículo(s) están por debajo del stock mínimo.`,'establishment']);
    if(!out.length) out.push(['Baja','Sistema integrado','Los controles principales no muestran desvíos críticos.','dashboard']);
    return out;
  }
  function renderPage(){
    const m=metrics(), recs=recommendations(m);
    const readiness=[['Campaña activa',(state.campaigns||[]).some(c=>lower(c.status).includes('activa'))],['Lotes',(state.lots||[]).length>0],['Producción',(state.cuts||[]).length>0],['Clientes',(state.clients||[]).length>0],['Maquinaria',(state.equipment||[]).length>0],['Personal',(state.personnel||[]).length>0],['Ventas',(state.salesOrders||[]).length>0],['Transporte',(state.trips||[]).length>0]];
    const ready=readiness.filter(x=>x[1]).length, pct=Math.round(ready/readiness.length*100);
    return `<div class="page-head"><div><p class="eyebrow">MOTOR INTELIGENTE 18.0</p><h2>Integración económica y operativa</h2><p class="muted">Una vista única para comprobar cómo producción, stock, ventas, recursos y transporte impactan en el resultado.</p></div><button class="secondary engineExport">Exportar diagnóstico CSV</button></div><div class="metrics"><div class="metric"><span>Preparación integral</span><b>${pct}%</b><small>${ready} de ${readiness.length} controles</small></div><div class="metric"><span>Stock disponible</span><b>${number(m.stock)} rollos</b><small>producción y movimientos</small></div><div class="metric"><span>Por cobrar</span><b>${money(m.pending)}</b><small>ventas menos cobros</small></div><div class="metric"><span>Resultado integrado</span><b>${money(m.result)}</b><small>producción, logística y finanzas</small></div></div><div class="grid2"><div class="panel"><h3>Flujo económico consolidado</h3><div class="row"><span>Ventas registradas</span><b>${money(m.salesTotal)}</b></div><div class="row"><span>Cobranzas</span><b>${money(m.collected)}</b></div><div class="row"><span>Costos productivos</span><b>${money(m.productionCosts)}</b></div><div class="row"><span>Ingresos de transporte</span><b>${money(m.transportIncome)}</b></div><div class="row"><span>Costos de transporte</span><b>${money(m.transportCosts)}</b></div><div class="status" style="margin-top:14px"><b>Última actividad:</b> ${escapeHtml(m.lastActivity||'Sin registrar')}</div></div><div class="panel"><h3>Estado de integración</h3>${readiness.map(([n,ok])=>`<div class="row"><span>${escapeHtml(n)}</span><span class="pill ${ok?'':'warn'}">${ok?'Listo':'Pendiente'}</span></div>`).join('')}<div class="progress" style="margin-top:14px"><i style="width:${pct}%"></i></div></div></div><div class="panel" style="margin-top:18px"><div class="panel-title"><div><h3>Recomendaciones automáticas</h3><p class="muted">Prioridades calculadas con los datos actuales.</p></div></div>${recs.map(([p,t,d,page],i)=>`<div class="row"><div><b>${i+1}. ${escapeHtml(t)}</b><small>${escapeHtml(d)}</small></div><div class="actions"><span class="pill ${p==='Alta'?'bad':p==='Media'?'warn':''}">${p}</span><button class="secondary engineGo" data-page="${page}">Abrir</button></div></div>`).join('')}</div>`;
  }
  function bind(){document.querySelectorAll('.engineGo').forEach(b=>b.onclick=()=>setPage(b.dataset.page));const x=document.querySelector('.engineExport');if(x)x.onclick=()=>{const m=metrics();const rows=[['Indicador','Valor'],['Stock disponible',m.stock],['Ventas',m.salesTotal],['Cobranzas',m.collected],['Pendiente',m.pending],['Costos productivos',m.productionCosts],['Ingresos transporte',m.transportIncome],['Costos transporte',m.transportCosts],['Resultado integrado',m.result]];const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='LA_MAGDALENA_OS_18_DIAGNOSTICO.csv';a.click();URL.revokeObjectURL(a.href);};}
  return {renderPage,bind};
}

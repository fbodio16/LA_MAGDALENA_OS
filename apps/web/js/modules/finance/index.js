function purchaseMeta(row){
  try{return String(row.notes||'').startsWith('LMOS_PURCHASE:')?JSON.parse(String(row.notes).slice(14)):null}catch(_error){return null}
}
function saleMeta(row){
  try{return String(row.notes||'').startsWith('LMOS_SALE:')?JSON.parse(String(row.notes).slice(10)):null}catch(_error){return null}
}

export function createFinanceModule({state,supabase,escapeHtml,openModal,loadData,render}){
  const money=value=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(value||0));
  const dateKey=value=>String(value||'').slice(0,7);
  const currentMonth=()=>new Date().toISOString().slice(0,7);
  const normalized=()=>state.movements.map(row=>{
    const purchase=purchaseMeta(row),sale=saleMeta(row);
    const income=Number(row.income||0),cost=Number(row.cost||0);
    let category='Otros',party='',status='Registrado',due='';
    if(purchase){category=purchase.category||'Compras';party=purchase.supplier||'';status=purchase.payment_status||'Pendiente';due=purchase.due_date||''}
    else if(sale){category='Ventas';party=sale.client_name||sale.client||'';status=sale.payment_status||'Pendiente';due=sale.due_date||''}
    else if(income>0)category='Otros ingresos';
    else if(cost>0)category='Otros egresos';
    return {...row,income,cost,balance:income-cost,category,party,status,due};
  }).sort((a,b)=>String(b.movement_date||'').localeCompare(String(a.movement_date||'')));

  function renderPage(){
    const all=normalized(),month=currentMonth(),list=all.filter(x=>dateKey(x.movement_date)===month);
    const income=list.reduce((s,x)=>s+x.income,0),cost=list.reduce((s,x)=>s+x.cost,0),result=income-cost;
    const receivable=all.reduce((sum,row)=>{const meta=saleMeta(row);return sum+(meta?Math.max(0,Number(row.income||meta.total||0)-Number(meta.paid||0)):0)},0);
    const payable=all.reduce((sum,row)=>{const meta=purchaseMeta(row);return sum+(meta?Math.max(0,Number(row.cost||0)-Number(meta.paid||0)):0)},0);
    const months=[];for(let i=5;i>=0;i--){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);const key=d.toISOString().slice(0,7),rows=all.filter(x=>dateKey(x.movement_date)===key);months.push({key,label:new Intl.DateTimeFormat('es-AR',{month:'short'}).format(d),income:rows.reduce((s,x)=>s+x.income,0),cost:rows.reduce((s,x)=>s+x.cost,0)})}
    const max=Math.max(1,...months.flatMap(x=>[x.income,x.cost]));
    const categories=[...new Set(list.filter(x=>x.cost>0).map(x=>x.category))].map(name=>({name,total:list.filter(x=>x.category===name).reduce((s,x)=>s+x.cost,0)})).sort((a,b)=>b.total-a.total);
    return `<div class="page-head"><div><p class="eyebrow">FINANZAS · 6.4</p><h2>Flujo de fondos y presupuesto</h2><p class="muted">Ingresos, egresos, saldos pendientes y evolución mensual en pesos argentinos.</p></div><div class="actions"><button class="secondary exportFinance">Exportar CSV</button><button class="primary newFinanceMovement">Nuevo movimiento</button></div></div>
    <div class="metrics"><div class="metric"><span>Ingresos del mes</span><b>${money(income)}</b><small>${list.filter(x=>x.income>0).length} movimientos</small></div><div class="metric"><span>Egresos del mes</span><b>${money(cost)}</b><small>${list.filter(x=>x.cost>0).length} movimientos</small></div><div class="metric"><span>Resultado mensual</span><b class="${result>=0?'positive':'negative'}">${money(result)}</b><small>${result>=0?'Superávit operativo':'Déficit operativo'}</small></div><div class="metric"><span>Capital de trabajo</span><b>${money(receivable-payable)}</b><small>Cobrar ${money(receivable)} · Pagar ${money(payable)}</small></div></div>
    <div class="grid2"><div class="panel"><div class="panel-title"><div><p class="eyebrow">EVOLUCIÓN</p><h3>Últimos seis meses</h3></div><span class="pill">ARS</span></div><div class="cash-chart">${months.map(x=>`<div class="cash-month"><div class="cash-bars"><i title="Ingresos ${money(x.income)}" style="height:${Math.max(3,x.income/max*120)}px"></i><i title="Egresos ${money(x.cost)}" style="height:${Math.max(3,x.cost/max*120)}px"></i></div><small>${escapeHtml(x.label)}</small><b>${money(x.income-x.cost)}</b></div>`).join('')}</div><div class="chart-legend"><span>Primer barra: ingresos</span><span>Segunda barra: egresos</span></div></div>
    <div class="panel"><div class="panel-title"><div><p class="eyebrow">ESTRUCTURA DE COSTOS</p><h3>Egresos del mes</h3></div><span class="pill">${categories.length}</span></div>${categories.length?categories.slice(0,8).map(x=>`<div class="row"><div><b>${escapeHtml(x.name)}</b><small>${cost?((x.total/cost)*100).toFixed(1).replace('.',','):'0,0'}% del gasto</small></div><b>${money(x.total)}</b></div>`).join(''):'<div class="empty">Todavía no hay egresos registrados este mes.</div>'}</div></div>
    <div class="panel"><div class="panel-title"><div><h3>Libro de movimientos</h3><small>Últimos movimientos financieros de la empresa</small></div><span class="pill">${all.length}</span></div>${all.length?`<div class="production-table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Contraparte</th><th>Categoría</th><th>Ingreso</th><th>Egreso</th><th>Resultado</th><th>Estado</th></tr></thead><tbody>${all.slice(0,80).map(x=>`<tr><td>${escapeHtml(x.movement_date||'')}</td><td><b>${escapeHtml(x.concept||'Sin concepto')}</b></td><td>${escapeHtml(x.party||'—')}</td><td>${escapeHtml(x.category)}</td><td class="positive">${x.income?money(x.income):'—'}</td><td class="negative">${x.cost?money(x.cost):'—'}</td><td class="${x.balance>=0?'positive':'negative'}">${money(x.balance)}</td><td><span class="pill">${escapeHtml(x.status)}</span></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><b>No hay movimientos financieros.</b><p>Registrá un ingreso o egreso para comenzar el control de caja.</p></div>'}</div>`;
  }

  function openEditor(){
    openModal(`<p class="eyebrow">MOVIMIENTO FINANCIERO</p><h2>Registrar ingreso o egreso</h2><form id="financeForm"><div class="form-grid"><label>Fecha<input name="movement_date" type="date" value="${new Date().toISOString().slice(0,10)}" required></label><label>Tipo<select name="type"><option value="income">Ingreso</option><option value="cost">Egreso</option></select></label><label>Concepto<input name="concept" required placeholder="Ej.: Cobro de servicio, impuesto"></label><label>Monto<input name="amount" type="number" min="0" step="1" required></label><label>Lote asociado<select name="lot_id"><option value="">General</option>${state.lots.map(l=>`<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('')}</select></label><label>Categoría<select name="category"><option>Administración</option><option>Producción</option><option>Riego</option><option>Transporte</option><option>Servicios con drones</option><option>Impuestos</option><option>Inversión</option><option>Otros</option></select></label><label class="wide">Observaciones<textarea name="observations"></textarea></label></div><button class="primary">Guardar movimiento</button><p id="financeMsg" class="error hidden"></p></form>`);
    document.querySelector('#financeForm').onsubmit=saveMovement;
  }
  async function saveMovement(event){event.preventDefault();const data=new FormData(event.target),msg=document.querySelector('#financeMsg');try{const amount=Number(data.get('amount')||0);if(!(amount>0))throw new Error('El monto debe ser mayor que cero.');const type=data.get('type');const metadata={category:data.get('category'),observations:data.get('observations')||''};const payload={company_id:state.companyId,movement_date:data.get('movement_date'),concept:data.get('concept'),income:type==='income'?amount:0,cost:type==='cost'?amount:0,lot_id:data.get('lot_id')||null,notes:`LMOS_FINANCE:${JSON.stringify(metadata)}`};const {error}=await supabase.from('financial_movements').insert(payload);if(error)throw error;document.querySelector('#modalRoot').innerHTML='';await loadData();render()}catch(error){msg.textContent=error.message;msg.classList.remove('hidden')}}
  function exportCsv(){const header=['Fecha','Concepto','Contraparte','Categoría','Ingreso','Egreso','Resultado','Estado'];const data=normalized().map(x=>[x.movement_date,x.concept,x.party,x.category,x.income,x.cost,x.balance,x.status]);const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;const blob=new Blob([`\ufeff${[header,...data].map(r=>r.map(q).join(';')).join('\n')}`],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`flujo_fondos_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url)}
  function bind(){document.querySelectorAll('.newFinanceMovement').forEach(b=>b.onclick=openEditor);document.querySelectorAll('.exportFinance').forEach(b=>b.onclick=exportCsv)}
  return {renderPage,bind};
}

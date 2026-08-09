function parsePurchase(row) {
  try {
    const notes = String(row.notes || '');
    const metadata = notes.startsWith('LMOS_PURCHASE:') ? JSON.parse(notes.slice(14)) : {};
    return {
      ...row,
      ...metadata,
      total: Number(row.cost || metadata.total || 0),
      paid: Number(metadata.paid || 0),
      balance: Math.max(0, Number(row.cost || 0) - Number(metadata.paid || 0)),
      supplier: metadata.supplier || 'Sin proveedor',
      category: metadata.category || 'Otros',
      due_date: metadata.due_date || '',
      payment_status: metadata.payment_status || (Number(metadata.paid || 0) >= Number(row.cost || 0) ? 'Pagado' : 'Pendiente'),
    };
  } catch (_error) {
    return { ...row, total: Number(row.cost || 0), paid: 0, balance: Number(row.cost || 0), supplier: 'Sin proveedor', category: 'Otros', due_date: '', payment_status: 'Pendiente' };
  }
}

export function createPurchasesModule({ state, supabase, escapeHtml, openModal, loadData, render }) {
  const money = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0));
  const rows = () => state.movements.filter(item => Number(item.cost || 0) > 0 && String(item.notes || '').startsWith('LMOS_PURCHASE:')).map(parsePurchase).sort((a,b)=>String(b.movement_date||'').localeCompare(String(a.movement_date||'')));

  function renderPage() {
    const list = rows();
    const total = list.reduce((s,x)=>s+x.total,0);
    const paid = list.reduce((s,x)=>s+x.paid,0);
    const overdue = list.filter(x=>x.balance>0 && x.due_date && x.due_date < new Date().toISOString().slice(0,10));
    const suppliers = [...new Set(list.map(x=>x.supplier).filter(Boolean))];
    return `<div class="page-head"><div><p class="eyebrow">ABASTECIMIENTO · 6.3</p><h2>Compras y proveedores</h2><p class="muted">Control de insumos, servicios, vencimientos y pagos.</p></div><div class="actions"><button class="secondary exportPurchases">Exportar CSV</button><button class="primary newPurchase">Nueva compra</button></div></div>
    <div class="metrics"><div class="metric"><span>Compras registradas</span><b>${money(total)}</b><small>${list.length} comprobantes</small></div><div class="metric"><span>Pagado</span><b>${money(paid)}</b><small>${total ? ((paid/total)*100).toFixed(1).replace('.',',') : '0,0'}% del total</small></div><div class="metric"><span>Saldo pendiente</span><b>${money(total-paid)}</b><small>${list.filter(x=>x.balance>0).length} cuentas abiertas</small></div><div class="metric"><span>Vencidas</span><b>${overdue.length}</b><small>${money(overdue.reduce((s,x)=>s+x.balance,0))} pendiente</small></div></div>
    <div class="grid2"><div class="panel"><div class="panel-title"><div><p class="eyebrow">PROVEEDORES</p><h3>Saldos por proveedor</h3></div><span class="pill">${suppliers.length}</span></div>${suppliers.length ? suppliers.map(name=>{const items=list.filter(x=>x.supplier===name),balance=items.reduce((s,x)=>s+x.balance,0);return `<div class="row"><div><b>${escapeHtml(name)}</b><small>${items.length} compras</small></div><b>${money(balance)}</b></div>`}).join('') : '<div class="empty">Todavía no hay compras registradas.</div>'}</div>
    <div class="panel"><div class="panel-title"><div><p class="eyebrow">ALERTAS</p><h3>Pagos vencidos</h3></div><span class="pill">${overdue.length}</span></div>${overdue.length ? overdue.slice(0,8).map(x=>`<div class="row"><div><b>${escapeHtml(x.supplier)}</b><small>${escapeHtml(x.due_date)} · ${escapeHtml(x.concept)}</small></div><span class="pill">${money(x.balance)}</span></div>`).join('') : '<div class="status">No hay pagos vencidos.</div>'}</div></div>
    <div class="panel"><div class="panel-title"><div><h3>Historial de compras</h3><small>Insumos, repuestos, servicios y gastos operativos</small></div><span class="pill">${list.length}</span></div>${list.length ? `<div class="production-table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Proveedor</th><th>Concepto</th><th>Categoría</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${list.map(x=>`<tr><td>${escapeHtml(x.movement_date||'')}</td><td><b>${escapeHtml(x.supplier)}</b><small>${escapeHtml(x.invoice_number||'Sin comprobante')}</small></td><td>${escapeHtml(x.concept||'')}</td><td>${escapeHtml(x.category)}</td><td>${money(x.total)}</td><td>${money(x.paid)}</td><td class="${x.balance>0?'negative':'positive'}">${money(x.balance)}</td><td><span class="pill">${escapeHtml(x.payment_status)}</span></td><td><button class="secondary purchasePay" data-id="${x.id}">Pago</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><b>No hay compras registradas.</b><p>Registrá insumos, servicios o repuestos para controlar costos y vencimientos.</p></div>'}</div>`;
  }

  function openEditor() {
    openModal(`<p class="eyebrow">NUEVA COMPRA</p><h2>Registrar compra o gasto</h2><form id="purchaseForm"><div class="form-grid"><label>Fecha<input name="movement_date" type="date" value="${new Date().toISOString().slice(0,10)}" required></label><label>Proveedor<input name="supplier" required></label><label>Concepto<input name="concept" placeholder="Ej.: Urea, gasoil, repuesto" required></label><label>Categoría<select name="category"><option>Insumos agrícolas</option><option>Combustible</option><option>Repuestos</option><option>Maquinaria</option><option>Servicios</option><option>Transporte</option><option>Impuestos</option><option>Otros</option></select></label><label>Monto total<input name="total" type="number" min="0" step="1" required></label><label>Monto pagado<input name="paid" type="number" min="0" step="1" value="0"></label><label>Vencimiento<input name="due_date" type="date"></label><label>Condición<select name="payment_terms"><option>Contado</option><option>7 días</option><option>15 días</option><option>30 días</option><option>60 días</option><option>Cuenta corriente</option></select></label><label>Factura / comprobante<input name="invoice_number"></label><label>Medio de pago<select name="payment_method"><option>Transferencia</option><option>Efectivo</option><option>Cheque</option><option>Tarjeta</option><option>Cuenta corriente</option></select></label><label>Lote asociado<select name="lot_id"><option value="">General</option>${state.lots.map(l=>`<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('')}</select></label><label class="wide">Observaciones<textarea name="observations"></textarea></label></div><button class="primary">Guardar compra</button><p id="purchaseMsg" class="error hidden"></p></form>`);
    document.querySelector('#purchaseForm').onsubmit=savePurchase;
  }

  async function savePurchase(event) {
    event.preventDefault(); const data=new FormData(event.target),msg=document.querySelector('#purchaseMsg');
    try {
      const total=Number(data.get('total')||0),paid=Math.min(total,Number(data.get('paid')||0)); if(!(total>0)) throw new Error('El monto total debe ser mayor que cero.');
      const metadata={supplier:data.get('supplier'),category:data.get('category'),paid,due_date:data.get('due_date')||'',payment_terms:data.get('payment_terms'),invoice_number:data.get('invoice_number')||'',payment_method:data.get('payment_method'),payment_status:paid>=total?'Pagado':paid>0?'Parcial':'Pendiente',observations:data.get('observations')||'',payments:paid>0?[{date:data.get('movement_date'),amount:paid,method:data.get('payment_method')}]:[]};
      const payload={company_id:state.companyId,movement_date:data.get('movement_date'),concept:data.get('concept'),income:0,cost:total,lot_id:data.get('lot_id')||null,notes:`LMOS_PURCHASE:${JSON.stringify(metadata)}`};
      const {error}=await supabase.from('financial_movements').insert(payload); if(error) throw error;
      document.querySelector('#modalRoot').innerHTML=''; await loadData(); render();
    } catch(error){msg.textContent=error.message;msg.classList.remove('hidden');}
  }

  function openPayment(id) {
    const item=rows().find(x=>x.id===id); if(!item)return;
    openModal(`<p class="eyebrow">PAGO A PROVEEDOR</p><h2>${escapeHtml(item.supplier)}</h2><div class="production-detail-grid"><div><span>Total</span><b>${money(item.total)}</b></div><div><span>Pagado</span><b>${money(item.paid)}</b></div><div><span>Saldo</span><b>${money(item.balance)}</b></div><div><span>Vencimiento</span><b>${escapeHtml(item.due_date||'Sin fecha')}</b></div></div><form id="paymentForm" style="margin-top:16px"><input type="hidden" name="id" value="${id}"><div class="form-grid"><label>Importe<input name="amount" type="number" min="0" max="${item.balance}" step="1" value="${item.balance}" required></label><label>Fecha<input name="date" type="date" value="${new Date().toISOString().slice(0,10)}" required></label><label>Medio<select name="method"><option>Transferencia</option><option>Efectivo</option><option>Cheque</option><option>Tarjeta</option><option>Compensación</option></select></label><label>Referencia<input name="reference"></label></div><button class="primary">Registrar pago</button><p id="paymentMsg" class="error hidden"></p></form>`);
    document.querySelector('#paymentForm').onsubmit=savePayment;
  }

  async function savePayment(event) {
    event.preventDefault(); const data=new FormData(event.target),msg=document.querySelector('#paymentMsg');
    try {
      const item=rows().find(x=>x.id===data.get('id')); if(!item) throw new Error('No se encontró la compra.'); const amount=Number(data.get('amount')||0); if(!(amount>0) || amount>item.balance) throw new Error('El importe no es válido.');
      let metadata={}; try{metadata=JSON.parse(String(item.notes).slice(14))}catch(_error){}
      const paid=Number(metadata.paid||0)+amount; metadata={...metadata,paid,payment_status:paid>=item.total?'Pagado':'Parcial',payments:[...(metadata.payments||[]),{date:data.get('date'),amount,method:data.get('method'),reference:data.get('reference')||''}]};
      const {error}=await supabase.from('financial_movements').update({notes:`LMOS_PURCHASE:${JSON.stringify(metadata)}`}).eq('id',item.id); if(error)throw error;
      document.querySelector('#modalRoot').innerHTML=''; await loadData(); render();
    } catch(error){msg.textContent=error.message;msg.classList.remove('hidden');}
  }

  function exportCsv(){const header=['Fecha','Proveedor','Concepto','Categoría','Total','Pagado','Saldo','Estado','Vencimiento','Comprobante'];const data=rows().map(x=>[x.movement_date,x.supplier,x.concept,x.category,x.total,x.paid,x.balance,x.payment_status,x.due_date,x.invoice_number]);const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;const blob=new Blob([`\ufeff${[header,...data].map(r=>r.map(q).join(';')).join('\n')}`],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`compras_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url)}

  function bind(){document.querySelectorAll('.newPurchase').forEach(b=>b.onclick=openEditor);document.querySelectorAll('.purchasePay').forEach(b=>b.onclick=()=>openPayment(b.dataset.id));document.querySelectorAll('.exportPurchases').forEach(b=>b.onclick=exportCsv)}
  return {renderPage,bind};
}

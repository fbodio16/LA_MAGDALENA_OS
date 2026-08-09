function parseTripMetadata(trip) {
  try {
    const notes = String(trip.notes || '');
    if (!notes.startsWith('LMOS_TRIP:')) return { observations: notes };
    return JSON.parse(notes.slice(10));
  } catch (_error) {
    return { observations: String(trip.notes || '') };
  }
}

function normalizeTrip(trip) {
  const meta = parseTripMetadata(trip);
  return {
    ...trip,
    client_name: trip.client_name || meta.client_name || trip.client || '',
    origin: trip.origin || meta.origin || 'Santiago Temple',
    destination: trip.destination || meta.destination || '',
    cargo_type: trip.cargo_type || meta.cargo || 'Rollos de alfalfa',
    rolls: Number(trip.rolls || meta.rolls || 0),
    kilometers: Number(trip.kilometers || 0),
    tons: Number(trip.tons || 0),
    income: Number(trip.income || 0),
    cost: Number(trip.cost || 0),
    fuel_liters: Number(trip.fuel_liters || meta.fuel_liters || 0),
    fuel_price: Number(trip.fuel_price || meta.fuel_price || 0),
    tolls: Number(trip.tolls || meta.tolls || 0),
    driver_cost: Number(trip.driver_cost || meta.driver_cost || 0),
    maintenance_cost: Number(trip.maintenance_cost || meta.maintenance_cost || 0),
    other_cost: Number(trip.other_cost || meta.other_cost || 0),
    vehicle_name: trip.vehicle_name || meta.vehicle || 'Scania R450',
    trailer: trip.trailer || meta.trailer || 'Semirremolque',
    driver_name: trip.driver_name || meta.driver || 'Franco Bodio',
    status: trip.status || meta.status || 'Planificado',
    payment_status: trip.payment_status || meta.payment_status || 'Pendiente',
    invoice_number: trip.invoice_number || meta.invoice_number || '',
    delivery_note: trip.delivery_note || meta.delivery_note || '',
    observations: trip.observations || meta.observations || '',
  };
}

export function createTransportModule({ state, supabase, escapeHtml, openModal, loadData, render }) {
  const money = value => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0));
  const number = (value, digits = 0) => new Intl.NumberFormat('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value || 0));
  const trips = () => state.trips.map(normalizeTrip).sort((a,b)=>String(b.trip_date||'').localeCompare(String(a.trip_date||'')));
  const totalCost = trip => Number(trip.cost || 0) || (trip.fuel_liters*trip.fuel_price + trip.tolls + trip.driver_cost + trip.maintenance_cost + trip.other_cost);
  const margin = trip => Number(trip.income || 0) - totalCost(trip);
  const saleById = id => state.salesOrders.find(x=>x.id===id);
  const vehicleById = id => state.equipment.find(x=>x.id===id);
  const driverById = id => state.personnel.find(x=>x.id===id);

  function renderPage() {
    const rows = trips();
    const km = rows.reduce((s,x)=>s+x.kilometers,0);
    const tons = rows.reduce((s,x)=>s+x.tons,0);
    const rolls = rows.reduce((s,x)=>s+x.rolls,0);
    const income = rows.reduce((s,x)=>s+x.income,0);
    const costs = rows.reduce((s,x)=>s+totalCost(x),0);
    const fuel = rows.reduce((s,x)=>s+x.fuel_liters,0);
    const completed = rows.filter(x=>x.status==='Completado').length;
    const pendingCollections = rows.filter(x=>x.payment_status!=='Cobrado' && x.status!=='Cancelado').reduce((s,x)=>s+Math.max(0,x.income),0);
    const avgCostKm = km ? costs/km : 0;
    const avgMarginTrip = rows.length ? (income-costs)/rows.length : 0;
    const table = rows.map(t=>`<tr>
      <td>${escapeHtml(t.trip_date||'—')}</td>
      <td><b>${escapeHtml(t.client_name||'Sin cliente')}</b><small>${escapeHtml(t.origin)} → ${escapeHtml(t.destination||'Sin destino')}</small></td>
      <td>${escapeHtml(t.cargo_type)}<small>${number(t.rolls)} rollos · ${number(t.tons,1)} t</small></td>
      <td>${number(t.kilometers)} km<small>${t.kilometers&&t.fuel_liters?number(t.fuel_liters/t.kilometers*100,1)+' L/100 km':'Sin consumo'}</small></td>
      <td>${money(t.income)}<small>Costo ${money(totalCost(t))}</small></td>
      <td><b class="${margin(t)>=0?'positive':'negative'}">${money(margin(t))}</b><small>${t.kilometers?money(margin(t)/t.kilometers)+'/km':'—'}</small></td>
      <td><span class="pill">${escapeHtml(t.status)}</span><small>${escapeHtml(t.payment_status)}</small></td>
      <td>${t.invoice_number?escapeHtml(t.invoice_number):'—'}<small>${t.delivery_note?escapeHtml(t.delivery_note):''}</small></td>
      <td><button class="secondary editTrip" data-id="${t.id}">Editar</button></td>
    </tr>`).join('');
    return `<div class="page-head"><div><p class="eyebrow">TRANSPORTE Y LOGÍSTICA · 12.0.0</p><h2>Centro de Transporte</h2><p class="muted">Viajes propios y para terceros, ventas vinculadas, combustible, documentación y rentabilidad por operación.</p></div><button class="primary newTrip">+ Registrar viaje</button></div>
      <div class="metrics transport-metrics"><div class="metric"><span>Viajes</span><b>${number(rows.length)}</b><small>${number(completed)} completados</small></div><div class="metric"><span>Kilómetros</span><b>${number(km)}</b><small>${number(tons,1)} t · ${number(rolls)} rollos</small></div><div class="metric"><span>Ingresos</span><b>${money(income)}</b><small>Costo ${money(costs)}</small></div><div class="metric"><span>Margen</span><b>${money(income-costs)}</b><small>${money(avgMarginTrip)} por viaje</small></div><div class="metric"><span>Costo por km</span><b>${money(avgCostKm)}</b><small>${km?number(fuel/km*100,1):'0,0'} L/100 km</small></div><div class="metric"><span>Por cobrar</span><b>${money(pendingCollections)}</b><small>fletes pendientes</small></div></div>
      <div class="panel"><div class="panel-title"><div><h3>Historial logístico</h3><p class="muted">Ruta, carga, documentación, costos y resultado de cada viaje.</p></div></div><div class="table-wrap"><table class="table transport-table"><thead><tr><th>Fecha</th><th>Cliente / ruta</th><th>Carga</th><th>Distancia</th><th>Facturación</th><th>Margen</th><th>Estado</th><th>Documentos</th><th></th></tr></thead><tbody>${table||'<tr><td colspan="9" class="empty">Todavía no hay viajes registrados.</td></tr>'}</tbody></table></div></div>`;
  }

  function tripModal(seed={}) {
    const t=normalizeTrip(seed);
    const saleOptions=state.salesOrders.filter(s=>s.status!=='Anulada').map(s=>`<option value="${s.id}" ${t.sale_id===s.id?'selected':''}>${escapeHtml(s.client_name)} · ${escapeHtml(s.invoice_number||s.delivery_note||String(s.sale_date||''))} · ${money(s.total_amount)}</option>`).join('');
    const vehicleOptions=state.equipment.map(x=>`<option value="${x.id}" ${t.vehicle_id===x.id?'selected':''}>${escapeHtml(x.name||x.brand||'Equipo')}</option>`).join('');
    const driverOptions=state.personnel.map(x=>`<option value="${x.id}" ${t.driver_id===x.id?'selected':''}>${escapeHtml(x.full_name||x.name||'Operario')}</option>`).join('');
    openModal(`<p class="eyebrow">TRANSPORTE Y LOGÍSTICA · 12.0.0</p><h2>${t.id?'Editar viaje':'Nuevo viaje'}</h2><form id="tripForm"><input type="hidden" name="id" value="${t.id||''}"><div class="form-grid">
      <label>Fecha<input name="trip_date" type="date" value="${t.trip_date||new Date().toISOString().slice(0,10)}" required></label>
      <label>Venta vinculada<select name="sale_id"><option value="">Sin venta vinculada</option>${saleOptions}</select></label>
      <label>Cliente<input name="client_name" value="${escapeHtml(t.client_name)}" required></label>
      <label>Origen<input name="origin" value="${escapeHtml(t.origin)}" required></label>
      <label>Destino<input name="destination" value="${escapeHtml(t.destination)}" required></label>
      <label>Tipo de carga<select name="cargo_type">${['Rollos de alfalfa','Granos','Insumos','Maquinaria','Carga general'].map(v=>`<option ${t.cargo_type===v?'selected':''}>${v}</option>`).join('')}</select></label>
      <label>Rollos<input name="rolls" type="number" min="0" step="1" value="${t.rolls||0}"></label>
      <label>Toneladas<input name="tons" type="number" min="0" step="0.01" value="${t.tons||0}"></label>
      <label>Kilómetros totales<input name="kilometers" type="number" min="0" step="1" value="${t.kilometers||0}"></label>
      <label>Ingreso / tarifa del viaje<input name="income" type="number" min="0" step="1" value="${t.income||0}"></label>
      <label>Litros de combustible<input name="fuel_liters" type="number" min="0" step="0.1" value="${t.fuel_liters||0}"></label>
      <label>Precio por litro<input name="fuel_price" type="number" min="0" step="0.01" value="${t.fuel_price||0}"></label>
      <label>Peajes<input name="tolls" type="number" min="0" step="1" value="${t.tolls||0}"></label>
      <label>Chofer / viáticos<input name="driver_cost" type="number" min="0" step="1" value="${t.driver_cost||0}"></label>
      <label>Mantenimiento imputado<input name="maintenance_cost" type="number" min="0" step="1" value="${t.maintenance_cost||0}"></label>
      <label>Otros costos<input name="other_cost" type="number" min="0" step="1" value="${t.other_cost||0}"></label>
      <label>Camión / equipo<select name="vehicle_id"><option value="">Sin vincular</option>${vehicleOptions}</select></label>
      <label>Nombre del vehículo<input name="vehicle_name" value="${escapeHtml(t.vehicle_name)}"></label>
      <label>Semirremolque<input name="trailer" value="${escapeHtml(t.trailer)}"></label>
      <label>Chofer<select name="driver_id"><option value="">Sin vincular</option>${driverOptions}</select></label>
      <label>Nombre del chofer<input name="driver_name" value="${escapeHtml(t.driver_name)}"></label>
      <label>Estado<select name="status">${['Planificado','Cargando','En viaje','Entregado','Completado','Cancelado'].map(v=>`<option ${t.status===v?'selected':''}>${v}</option>`).join('')}</select></label>
      <label>Estado de cobro<select name="payment_status">${['Pendiente','Facturado','Parcial','Cobrado'].map(v=>`<option ${t.payment_status===v?'selected':''}>${v}</option>`).join('')}</select></label>
      <label>Factura / comprobante<input name="invoice_number" value="${escapeHtml(t.invoice_number)}"></label>
      <label>Remito / carta de porte<input name="delivery_note" value="${escapeHtml(t.delivery_note)}"></label>
      <label class="wide">Observaciones<textarea name="observations">${escapeHtml(t.observations)}</textarea></label>
    </div><div class="actions"><button class="primary">Guardar viaje</button>${t.id?'<button type="button" class="danger deleteTrip">Eliminar</button>':''}</div><p id="tripMsg" class="error hidden"></p></form>`);
    const saleSelect=document.querySelector('[name="sale_id"]');
    if(saleSelect) saleSelect.onchange=()=>{
      const sale=saleById(saleSelect.value); if(!sale)return;
      document.querySelector('[name="client_name"]').value=sale.client_name||'';
      document.querySelector('[name="invoice_number"]').value=sale.invoice_number||'';
      document.querySelector('[name="delivery_note"]').value=sale.delivery_note||'';
      const items=state.salesItems.filter(i=>i.sale_id===sale.id);
      document.querySelector('[name="rolls"]').value=items.reduce((a,x)=>a+Number(x.quantity_rolls||0),0);
      document.querySelector('[name="tons"]').value=items.reduce((a,x)=>a+Number(x.quantity_rolls||0)*Number(x.weight_per_roll_kg||500)/1000,0).toFixed(2);
    };
    const vehicleSelect=document.querySelector('[name="vehicle_id"]');
    if(vehicleSelect) vehicleSelect.onchange=()=>{const v=vehicleById(vehicleSelect.value);if(v)document.querySelector('[name="vehicle_name"]').value=v.name||v.brand||''};
    const driverSelect=document.querySelector('[name="driver_id"]');
    if(driverSelect) driverSelect.onchange=()=>{const d=driverById(driverSelect.value);if(d)document.querySelector('[name="driver_name"]').value=d.full_name||d.name||''};
    document.querySelector('#tripForm').onsubmit=saveTrip;
    const del=document.querySelector('.deleteTrip'); if(del)del.onclick=()=>deleteTrip(t.id);
  }

  async function saveTrip(event) {
    event.preventDefault();
    const f=new FormData(event.target), id=f.get('id');
    const fuelLiters=Number(f.get('fuel_liters')||0),fuelPrice=Number(f.get('fuel_price')||0),tolls=Number(f.get('tolls')||0),driverCost=Number(f.get('driver_cost')||0),maintenanceCost=Number(f.get('maintenance_cost')||0),otherCost=Number(f.get('other_cost')||0);
    const computedCost=fuelLiters*fuelPrice+tolls+driverCost+maintenanceCost+otherCost;
    const row={company_id:state.companyId,trip_date:f.get('trip_date'),sale_id:f.get('sale_id')||null,client:f.get('client_name'),client_name:f.get('client_name'),origin:f.get('origin'),destination:f.get('destination'),cargo_type:f.get('cargo_type'),rolls:Number(f.get('rolls')||0),kilometers:Number(f.get('kilometers')||0),tons:Number(f.get('tons')||0),income:Number(f.get('income')||0),cost:computedCost,fuel_liters:fuelLiters,fuel_price:fuelPrice,tolls,driver_cost:driverCost,maintenance_cost:maintenanceCost,other_cost:otherCost,vehicle_id:f.get('vehicle_id')||null,vehicle_name:f.get('vehicle_name'),trailer:f.get('trailer'),driver_id:f.get('driver_id')||null,driver_name:f.get('driver_name'),status:f.get('status'),payment_status:f.get('payment_status'),invoice_number:f.get('invoice_number'),delivery_note:f.get('delivery_note'),observations:f.get('observations'),notes:f.get('observations')};
    const result=id?await supabase.from('transport_trips').update(row).eq('id',id):await supabase.from('transport_trips').insert(row);
    if(result.error){const m=document.querySelector('#tripMsg');m.textContent=result.error.message;m.classList.remove('hidden');return}
    document.querySelector('#modalRoot').innerHTML='';await loadData();render();
  }

  async function deleteTrip(id){if(!confirm('¿Eliminar este viaje?'))return;const {error}=await supabase.from('transport_trips').delete().eq('id',id);if(error)return alert(error.message);document.querySelector('#modalRoot').innerHTML='';await loadData();render()}

  function bind(){document.querySelectorAll('.newTrip').forEach(b=>b.onclick=()=>tripModal());document.querySelectorAll('.editTrip').forEach(b=>b.onclick=()=>tripModal(state.trips.find(t=>t.id===b.dataset.id)||{}))}
  return {renderPage,bind};
}

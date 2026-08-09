export function createFieldOperationsModule({
  state,supabase,escapeHtml,openModal,loadData,render,setPage
}){
  const esc=escapeHtml;
  const today=()=>new Date().toISOString().slice(0,10);
  const lotName=id=>state.lots.find(l=>l.id===id)?.name||'General';
  const fmt=value=>value?new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'—';

  function severityClass(value){
    return ({critica:'danger',alta:'danger',media:'warn',baja:'ok',informativa:'neutral'})[value]||'neutral';
  }

  function taskCard(task){
    return `<article class="field-task-card priority-${task.priority}">
      <div class="field-task-check">
        <button class="taskToggle ${task.status==='completada'?'done':''}" data-id="${task.id}" title="Cambiar estado">${task.status==='completada'?'✓':'○'}</button>
      </div>
      <div>
        <div class="field-task-title"><b>${esc(task.title)}</b><span class="pill ${task.priority==='critica'||task.priority==='alta'?'danger':task.priority==='media'?'warn':'ok'}">${esc(task.priority)}</span></div>
        <p>${esc(task.description||'Sin descripción')}</p>
        <small>${esc(lotName(task.lot_id))} · ${esc(task.task_type)}${task.due_time?' · '+esc(task.due_time.slice(0,5)):''}</small>
      </div>
      <button class="secondary editTask" data-id="${task.id}">Editar</button>
    </article>`;
  }

  function observationCard(obs){
    return `<article class="field-observation-card">
      <div class="observation-icon">${obs.photo_path?'📷':'📍'}</div>
      <div>
        <div class="field-task-title"><b>${esc(obs.title)}</b><span class="pill ${severityClass(obs.severity)}">${esc(obs.severity)}</span></div>
        <p>${esc(obs.description||'Sin descripción')}</p>
        <small>${esc(lotName(obs.lot_id))} · ${fmt(obs.observation_date)}${obs.latitude!=null?' · georreferenciada':''}</small>
      </div>
      ${obs.photo_path?`<button class="secondary openObservationPhoto" data-path="${esc(obs.photo_path)}">Foto</button>`:''}
    </article>`;
  }

  function renderPage(){
    const tasks=(state.dailyFieldTasks||[]).filter(t=>t.task_date===today());
    const pending=tasks.filter(t=>t.status==='pendiente'||t.status==='en_curso');
    const completed=tasks.filter(t=>t.status==='completada');
    const observations=(state.fieldObservations||[]).filter(o=>String(o.observation_date).slice(0,10)===today());
    const priority=pending.filter(t=>t.priority==='alta'||t.priority==='critica').length;

    return `<section class="field-ops-page">
      <section class="field-ops-hero">
        <div><p class="eyebrow">OPERACIÓN MÓVIL</p><h2>Carga de Campo</h2><p>Registrá datos desde el lote y organizá las tareas de hoy.</p></div>
        <div class="field-ops-actions">
          <button class="primary newQuickRecord">＋ Carga rápida</button>
          <button class="secondary newFieldObservation">📷 Observación</button>
          <button class="secondary newDailyTask">＋ Tarea</button>
        </div>
      </section>

      <div class="field-ops-kpis">
        <article><small>Pendientes</small><b>${pending.length}</b><span>para hoy</span></article>
        <article><small>Prioridad alta</small><b>${priority}</b><span>requieren atención</span></article>
        <article><small>Completadas</small><b>${completed.length}</b><span>durante el día</span></article>
        <article><small>Observaciones</small><b>${observations.length}</b><span>registradas hoy</span></article>
      </div>

      <div class="field-ops-grid">
        <section class="panel">
          <div class="panel-title"><div><p class="eyebrow">PLAN DEL DÍA</p><h3>Tareas pendientes</h3></div><button class="secondary newDailyTask">Agregar</button></div>
          <div class="field-task-list">${pending.length?pending.map(taskCard).join(''):'<div class="empty"><b>No hay tareas pendientes.</b><span>Podés crear una tarea o usar una recomendación del Gemelo Digital.</span></div>'}</div>
        </section>
        <section class="panel">
          <div class="panel-title"><div><p class="eyebrow">REGISTRO DE CAMPO</p><h3>Observaciones de hoy</h3></div><button class="secondary newFieldObservation">Registrar</button></div>
          <div class="field-observation-list">${observations.length?observations.map(observationCard).join(''):'<div class="empty"><b>Sin observaciones hoy.</b><span>Registrá fotos, malezas, plagas, daños o novedades del cultivo.</span></div>'}</div>
        </section>
      </div>

      <section class="panel field-quick-access">
        <div class="panel-title"><div><p class="eyebrow">ACCESOS RÁPIDOS</p><h3>Cargar sin perder tiempo</h3></div></div>
        <div class="quick-access-grid">
          <button data-target="irrigation">💧<b>Registrar riego</b><span>Fecha, horas y milímetros</span></button>
          <button data-target="production">✂️<b>Registrar corte</b><span>Rollos y producción</span></button>
          <button data-target="hydric-intelligence">🧪<b>Muestra gravimétrica</b><span>Calibrar balance hídrico</span></button>
          <button class="newFieldObservation">📷<b>Foto y observación</b><span>Con ubicación del celular</span></button>
        </div>
      </section>
    </section>`;
  }

  function quickRecordModal(){
    openModal(`<p class="eyebrow">CARGA RÁPIDA</p><h2>¿Qué querés registrar?</h2>
      <div class="quick-record-modal">
        <button data-page="irrigation">💧<b>Riego</b><span>Registrar horas y milímetros</span></button>
        <button data-page="production">✂️<b>Corte</b><span>Cargar rollos y producción</span></button>
        <button data-page="hydric-intelligence">🧪<b>Muestra</b><span>Humedad gravimétrica</span></button>
        <button class="openObservationFromQuick">📷<b>Observación</b><span>Foto, ubicación y comentario</span></button>
      </div>`);
    document.querySelectorAll('.quick-record-modal [data-page]').forEach(b=>b.onclick=()=>{
      document.querySelector('#modalRoot').innerHTML='';
      setPage(b.dataset.page);
    });
    document.querySelector('.openObservationFromQuick').onclick=()=>{
      document.querySelector('#modalRoot').innerHTML='';
      observationModal();
    };
  }

  function taskModal(task=null){
    openModal(`<p class="eyebrow">TAREA DE CAMPO</p><h2>${task?'Editar tarea':'Nueva tarea'}</h2>
      <form id="dailyTaskForm">
        <div class="form-grid">
          <label>Fecha<input name="task_date" type="date" value="${task?.task_date||today()}" required></label>
          <label>Hora<input name="due_time" type="time" value="${task?.due_time?.slice(0,5)||''}"></label>
          <label>Lote<select name="lot_id"><option value="">General</option>${state.lots.map(l=>`<option value="${l.id}" ${task?.lot_id===l.id?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label>
          <label>Tipo<select name="task_type">${['general','riego','corte','vuelo','muestreo','recorrida','aplicacion','mantenimiento','transporte','administracion','otro'].map(v=>`<option ${task?.task_type===v?'selected':''}>${v}</option>`).join('')}</select></label>
          <label>Prioridad<select name="priority">${['baja','media','alta','critica'].map(v=>`<option ${task?.priority===v?'selected':''}>${v}</option>`).join('')}</select></label>
          <label>Estado<select name="status">${['pendiente','en_curso','completada','cancelada'].map(v=>`<option ${task?.status===v?'selected':''}>${v}</option>`).join('')}</select></label>
          <label class="wide">Título<input name="title" value="${esc(task?.title||'')}" required></label>
          <label class="wide">Descripción<textarea name="description">${esc(task?.description||'')}</textarea></label>
        </div>
        <button class="primary">Guardar tarea</button><p id="taskMsg" class="error hidden"></p>
      </form>`);
    document.querySelector('#dailyTaskForm').onsubmit=async e=>{
      e.preventDefault();
      const f=new FormData(e.target);
      const row={
        company_id:state.companyId,
        lot_id:f.get('lot_id')||null,
        task_date:f.get('task_date'),
        due_time:f.get('due_time')||null,
        task_type:f.get('task_type'),
        title:f.get('title'),
        description:f.get('description')||null,
        priority:f.get('priority'),
        status:f.get('status')
      };
      const q=task
        ? supabase.from('daily_field_tasks').update(row).eq('id',task.id)
        : supabase.from('daily_field_tasks').insert({...row,created_by:state.session.user.id});
      const {error}=await q;
      if(error){
        const msg=document.querySelector('#taskMsg');msg.textContent=error.message;msg.classList.remove('hidden');return;
      }
      document.querySelector('#modalRoot').innerHTML='';
      await loadData();render();
    };
  }

  function observationModal(){
    openModal(`<p class="eyebrow">OBSERVACIÓN DE CAMPO</p><h2>Registrar novedad</h2>
      <form id="fieldObservationForm">
        <div class="form-grid">
          <label>Lote<select name="lot_id" required><option value="">Seleccionar</option>${state.lots.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select></label>
          <label>Tipo<select name="observation_type">${['general','riego','cultivo','plaga','enfermedad','malezas','suelo','corte','maquinaria','seguridad','otro'].map(v=>`<option>${v}</option>`).join('')}</select></label>
          <label>Importancia<select name="severity"><option>informativa</option><option>baja</option><option>media</option><option>alta</option><option>critica</option></select></label>
          <label>Foto<input name="photo" type="file" accept="image/*" capture="environment"></label>
          <label class="wide">Título<input name="title" placeholder="Ej.: mancha de malezas en cabecera" required></label>
          <label class="wide">Descripción<textarea name="description" placeholder="Describí lo observado y la acción sugerida"></textarea></label>
        </div>
        <div class="location-status" id="locationStatus">📍 Ubicación todavía no capturada.</div>
        <div class="modal-actions"><button type="button" class="secondary" id="captureLocation">Usar ubicación actual</button><button class="primary">Guardar observación</button></div>
        <p id="observationMsg" class="error hidden"></p>
      </form>`);

    let coords={latitude:null,longitude:null,accuracy_m:null};
    document.querySelector('#captureLocation').onclick=()=>{
      const status=document.querySelector('#locationStatus');
      if(!navigator.geolocation){status.textContent='El navegador no permite geolocalización.';return;}
      status.textContent='Obteniendo ubicación…';
      navigator.geolocation.getCurrentPosition(
        p=>{
          coords={latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy_m:p.coords.accuracy};
          status.textContent=`📍 Ubicación capturada · precisión aproximada ${Math.round(p.coords.accuracy)} m`;
          status.classList.add('ok');
        },
        e=>status.textContent='No se pudo obtener la ubicación: '+e.message,
        {enableHighAccuracy:true,timeout:12000,maximumAge:30000}
      );
    };

    document.querySelector('#fieldObservationForm').onsubmit=async e=>{
      e.preventDefault();
      const f=new FormData(e.target),msg=document.querySelector('#observationMsg');
      try{
        let photo_path=null;
        const photo=f.get('photo');
        if(photo?.size){
          const safe=photo.name.replace(/[^a-zA-Z0-9._-]/g,'_');
          photo_path=`${state.companyId}/field-observations/${Date.now()}_${safe}`;
          const {error:uploadError}=await supabase.storage.from('precision-files').upload(photo_path,photo,{upsert:false});
          if(uploadError)throw uploadError;
        }
        const {error}=await supabase.from('field_observations').insert({
          company_id:state.companyId,
          lot_id:f.get('lot_id'),
          observation_type:f.get('observation_type'),
          title:f.get('title'),
          description:f.get('description')||null,
          severity:f.get('severity'),
          ...coords,
          photo_path,
          created_by:state.session.user.id
        });
        if(error)throw error;
        document.querySelector('#modalRoot').innerHTML='';
        await loadData();render();
      }catch(err){msg.textContent=err.message;msg.classList.remove('hidden');}
    };
  }

  async function toggleTask(id){
    const task=(state.dailyFieldTasks||[]).find(t=>t.id===id);
    if(!task)return;
    const completed=task.status!=='completada';
    const {error}=await supabase.from('daily_field_tasks').update({
      status:completed?'completada':'pendiente',
      completed_at:completed?new Date().toISOString():null,
      completed_by:completed?state.session.user.id:null
    }).eq('id',id);
    if(error)return alert(error.message);
    await loadData();render();
  }

  async function openPhoto(path){
    const {data,error}=await supabase.storage.from('precision-files').createSignedUrl(path,300);
    if(error)return alert(error.message);
    window.open(data.signedUrl,'_blank');
  }

  function bind(){
    document.querySelectorAll('.newQuickRecord').forEach(b=>b.onclick=quickRecordModal);
    document.querySelectorAll('.newDailyTask').forEach(b=>b.onclick=()=>taskModal());
    document.querySelectorAll('.newFieldObservation').forEach(b=>b.onclick=observationModal);
    document.querySelectorAll('.taskToggle').forEach(b=>b.onclick=()=>toggleTask(b.dataset.id));
    document.querySelectorAll('.editTask').forEach(b=>b.onclick=()=>taskModal((state.dailyFieldTasks||[]).find(t=>t.id===b.dataset.id)));
    document.querySelectorAll('.openObservationPhoto').forEach(b=>b.onclick=()=>openPhoto(b.dataset.path));
    document.querySelectorAll('.quick-access-grid [data-target]').forEach(b=>b.onclick=()=>setPage(b.dataset.target));
  }

  return {renderPage,bind};
}
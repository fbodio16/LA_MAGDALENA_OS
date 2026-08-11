// LA MAGDALENA OS v75.1 - motor hídrico canónico, estable y auditable.
// Una sola instantánea por válvula, protección contra saltos, historial causal y explicación operativa.
let provider=null;
let snapshot=null;
let revision=0;
let updatedAt=null;
let lastReason='startup';
const listeners=new Set();
const STORAGE_KEY='lm:v75:hydric-stable';
const HISTORY_KEY='lm:v75:hydric-history';
const MONITOR_KEY='lm:v92:hydric-daily-monitor';
const MAX_UNEXPLAINED_JUMP=25;
const MAX_HISTORY=1000;

// Estado operativo de respaldo validado visualmente el 06/08/2026.
// SOLO se usa cuando el proveedor no logra construir un balance integrado.
// Nunca reemplaza un cálculo real balance_integrado.
const LAST_VALIDATED_BY_VALVE={
  1:{occupancy:80,status:'No regar',application:0,hours:null,confidence:83},
  2:{occupancy:76,status:'No regar',application:0,hours:null,confidence:82},
  3:{occupancy:97,status:'No regar',application:0,hours:null,confidence:85},
  4:{occupancy:68,status:'No regar',application:0,hours:null,confidence:83},
  5:{occupancy:100,status:'No regar',application:0,hours:null,confidence:85},
  6:{occupancy:69,status:'No regar',application:0,hours:null,confidence:80},
  7:{occupancy:47,status:'Regar en 24–48 h',application:45,hours:null,confidence:80},
  8:{occupancy:28,status:'Regar hoy',application:45,hours:32.7,confidence:85},
  9:{occupancy:72,status:'No regar',application:0,hours:null,confidence:86},
 10:{occupancy:82,status:'No regar',application:0,hours:null,confidence:85},
 11:{occupancy:68,status:'No regar',application:0,hours:null,confidence:80},
 12:{occupancy:75,status:'No regar',application:0,hours:null,confidence:80},
 13:{occupancy:71,status:'No regar',application:0,hours:null,confidence:80}
};
function valveNumber(row){const m=valveCode(row).match(/(\d{1,2})/);return m?Number(m[1]):null}
const LAST_VALIDATED_AT='2026-08-06';
function projectedFallback(row,seed){
  const days=Math.max(0,Math.min(14,Math.floor((new Date()-new Date(`${LAST_VALIDATED_AT}T12:00:00`))/86400000)));
  const capacity=numberOrNull(row?.st?.capacity)||320;
  const etoDay=numberOrNull(row?.etoDay)||0;
  const kc=numberOrNull(row?.kc)||1;
  const dailyEtc=Math.max(0,etoDay*kc);
  const depletionPct=capacity>0?dailyEtc*days/capacity*100:0;
  const occupancy=Math.max(0,Math.min(100,Number(seed.occupancy)-depletionPct));
  const trigger=numberOrNull(row?.p?.refill_trigger_pct)||45;
  let status='No regar';
  if(occupancy<=trigger)status='Regar hoy';
  else if(occupancy<=trigger+10)status='Regar en 24–48 h';
  else if(occupancy<=trigger+20)status='Vigilar';
  return {occupancy,status,days,dailyEtc,capacity,depletionPct};
}
function validatedFallback(row){
  const n=valveNumber(row),seed=n?LAST_VALIDATED_BY_VALVE[n]:null;
  if(!seed)return null;
  const proj=projectedFallback(row,seed);
  const action=/^Regar hoy|^Regar en 24/.test(proj.status);
  return {...row,...seed,occupancy:proj.occupancy,status:proj.status,application:action?seed.application:0,hours:action?seed.hours:null,ready:true,calculationReady:false,canonicalStabilized:true,stabilizationReason:'last-validated-projected',fallbackProjected:true,fallbackBaseline:LAST_VALIDATED_AT,fallbackDays:proj.days,fallbackDailyEtc:proj.dailyEtc,fallbackCapacity:proj.capacity,fallbackDepletionPct:proj.depletionPct,canonicalNote:`RESPALDO PROYECTADO: parte del último estado validado del ${LAST_VALIDATED_AT} y descuenta ETc diaria (${proj.dailyEtc.toFixed(2)} mm/día) durante ${proj.days} día(s). Es una estimación temporal, no reemplaza una muestra/balance integrado.`,instruction:proj.status==='Regar hoy'?'Respaldo proyectado: verificar humedad en campo antes de aplicar riego.':proj.status==='Regar en 24–48 h'?'Respaldo proyectado: verificar humedad y clima antes de programar riego.':'Respaldo proyectado: no regar por ahora; confirmar con muestra/balance integrado.'};
}

const text=x=>String(x??'').trim();
const valveCode=row=>text(row?.valve?.valve_code||row?.p?.valve_code||row?.lot?.valve_code||row?.lot?.name);
const lotId=row=>text(row?.lot?.id||row?.p?.lot_id||row?.valve?.lot_id);
const numberOrNull=value=>value==null||value===''||!Number.isFinite(Number(value))?null:Number(value);
const dateToken=value=>text(value).slice(0,19);
const storage=()=>typeof window!=='undefined'&&window.localStorage?window.localStorage:null;
function readJson(key,fallback){try{return JSON.parse(storage()?.getItem(key)||'')||fallback}catch{return fallback}}
function writeJson(key,value){try{storage()?.setItem(key,JSON.stringify(value))}catch(err){console.warn('No se pudo persistir el estado hídrico',err)}}
function deepFreeze(value,seen=new WeakSet()){if(!value||typeof value!=='object'||seen.has(value))return value;seen.add(value);Object.values(value).forEach(v=>deepFreeze(v,seen));return Object.freeze(value)}
function evidenceParts(row){return {
  sample:dateToken(row?.lastSample?.sample_date),
  irrigation:dateToken(row?.lastIrr?.event_date||row?.lastIrr?.irrigation_date),
  satellite:dateToken(row?.lastSatellite?.observed_to||row?.lastSatellite?.observed_from),
  analysis:dateToken(row?.lastAnalysis?.flight_date),
  observation:dateToken(row?.lastObs?.observation_date),
  occupancySource:text(row?.occupancySource),
  rain:numberOrNull(row?.effectiveRain),irrigationUseful:numberOrNull(row?.effectiveIrrigation),etc:numberOrNull(row?.etc),eto:numberOrNull(row?.etoDay)
}}
function evidence(row){const e=evidenceParts(row);return Object.values(e).join('|')}
function stableFields(row){return {occupancy:numberOrNull(row?.occupancy),status:text(row?.status),css:text(row?.css),application:numberOrNull(row?.application),hours:numberOrNull(row?.hours),confidence:numberOrNull(row?.confidence),instruction:text(row?.instruction),estimatedWater:numberOrNull(row?.estimatedWater),deficit:numberOrNull(row?.deficit),refillNeed:numberOrNull(row?.refillNeed),ready:Boolean(row?.ready),calculationReady:Boolean(row?.calculationReady),evidence:evidence(row),evidenceParts:evidenceParts(row),savedAt:new Date().toISOString()}}
function dayKey(value=new Date()){const d=value instanceof Date?value:new Date(value);return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):''}
function monitorRows(rows){
  const store=readJson(MONITOR_KEY,{}),today=dayKey();
  rows.forEach(row=>{const key=lotId(row)||valveCode(row);if(!key)return;const list=Array.isArray(store[key])?store[key]:[];const rec={date:today,occupancy:numberOrNull(row?.occupancy),etc:numberOrNull(row?.etc),rain:numberOrNull(row?.effectiveRain),irrigation:numberOrNull(row?.effectiveIrrigation),eto:numberOrNull(row?.etoDay),source:text(row?.occupancySource),ready:Boolean(row?.ready)};const i=list.findIndex(x=>x?.date===today);if(i>=0)list[i]=rec;else list.push(rec);store[key]=list.slice(-30)});
  writeJson(MONITOR_KEY,store);return store
}
function frozenAudit(row,monitor){
  const key=lotId(row)||valveCode(row),list=(monitor?.[key]||[]).filter(x=>x?.ready&&numberOrNull(x?.occupancy)!=null).slice(-7);
  if(list.length<3)return {flag:false,label:'Sin evidencia de congelamiento',days:list.length};
  const span=[...new Set(list.map(x=>x.date))].length;
  const occ=list.map(x=>Number(x.occupancy));const spread=Math.max(...occ)-Math.min(...occ);
  const first=list[0],last=list.at(-1);const etcDelta=Math.max(0,(numberOrNull(last.etc)||0)-(numberOrNull(first.etc)||0));const inputDelta=Math.max(0,(numberOrNull(last.rain)||0)-(numberOrNull(first.rain)||0))+Math.max(0,(numberOrNull(last.irrigation)||0)-(numberOrNull(first.irrigation)||0));
  const demandEvidence=etcDelta>=2 || list.some(x=>(numberOrNull(x.eto)||0)>0.5);
  const unexplainedFlat=span>=3&&spread<=0.5&&demandEvidence&&etcDelta-inputDelta>=1;
  return {flag:unexplainedFlat,label:unexplainedFlat?'REVISAR BALANCE · posible valor congelado':'Evolución coherente',days:span,spread,etcDelta,inputDelta};
}

function decisionReadiness(row){
  const blockers=[],warnings=[];
  const status=text(row?.status).replace(' · estimado','');
  const action=/^Regar hoy|^Regar en 24/.test(status);
  const occupancy=numberOrNull(row?.occupancy);
  const confidence=numberOrNull(row?.confidence);
  const sampleAge=numberOrNull(row?.sampleAge);
  const eto=numberOrNull(row?.etoDay);
  const hasEstimate=occupancy!=null;
  if(!hasEstimate)blockers.push('sin porcentaje hídrico disponible');
  if(!row?.calculationReady)warnings.push('balance preventivo / no completamente calibrado');
  if(row?.canonicalStabilized)warnings.push(row?.fallbackProjected?'respaldo hídrico proyectado: confirmar con muestra/balance integrado':'se conserva un respaldo histórico mientras actualizan las fuentes');
  if(text(row?.occupancySource)!=='balance_integrado')warnings.push('porcentaje provisional: falta balance integrado para evolución diaria');
  if(confidence==null)warnings.push('confianza sin calcular');
  else if(confidence<65)warnings.push(`confianza baja (${Math.round(confidence)}%)`);
  else if(confidence<80)warnings.push(`confianza moderada (${Math.round(confidence)}%)`);
  if(sampleAge==null||sampleAge>=999)warnings.push('falta muestra gravimétrica vigente');
  else if(sampleAge>21)warnings.push(`muestra de suelo vencida (${Math.round(sampleAge)} días)`);
  if(eto==null||eto<=0)warnings.push('ET₀ no disponible: decisión provisional');
  if(action&&!(numberOrNull(row?.application)>0))warnings.push('lámina exacta pendiente');
  if(action&&!(numberOrNull(row?.rate)>0))warnings.push('tasa/caudal pendiente de calibración');
  if(action&&numberOrNull(row?.hours)==null)warnings.push('duración exacta pendiente');
  const fullyOperational=hasEstimate&&Boolean(row?.calculationReady)&&confidence!=null&&confidence>=80&&sampleAge!=null&&sampleAge<=21&&eto!=null&&eto>0&&(!action||(numberOrNull(row?.application)>0&&numberOrNull(row?.rate)>0&&numberOrNull(row?.hours)!=null));
  const level=!hasEstimate?'incompleta':fullyOperational?'operativa':'provisional';
  const label=!hasEstimate?'DATOS INSUFICIENTES':fullyOperational?'DECISIÓN HABILITADA':'DECISIÓN PROVISIONAL · VERIFICAR';
  return {ready:fullyOperational,usable:hasEstimate,level,label,blockers,warnings,actionable:action&&fullyOperational,advisory:action&&hasEstimate&&!fullyOperational,computedAt:new Date().toISOString()};
}
function applyStable(row,stable,reason){if(!stable)return row;return {...row,...stable,canonicalStabilized:true,stabilizationReason:reason,canonicalNote:reason==='loading'?'Se conserva el último cálculo válido mientras terminan de cargar las fuentes.':'Se evitó un cambio brusco sin un nuevo riego, lluvia, muestra o dato satelital.'}}
function inferReason(prev,row){if(!prev)return {code:'initial',label:'Cálculo inicial',sources:['motor hídrico']};const now=evidenceParts(row),before=prev.evidenceParts||{};const sources=[];if(now.sample&&now.sample!==before.sample)sources.push('nueva muestra de suelo');if(now.irrigation&&now.irrigation!==before.irrigation)sources.push('nuevo riego');if(now.satellite&&now.satellite!==before.satellite)sources.push('nueva observación satelital');if(now.analysis&&now.analysis!==before.analysis)sources.push('nuevo análisis multiespectral');if(now.observation&&now.observation!==before.observation)sources.push('nueva observación de campo');if(now.rain!==before.rain&&now.rain!=null)sources.push('lluvia útil actualizada');if(now.irrigationUseful!==before.irrigationUseful&&now.irrigationUseful!=null)sources.push('aporte de riego actualizado');if(now.etc!==before.etc&&now.etc!=null)sources.push('ETc actualizada');if(now.eto!==before.eto&&now.eto!=null)sources.push('ET₀ actualizada');if(!sources.length)sources.push('recalculo con las mismas fuentes');return {code:sources[0].startsWith('nuevo riego')?'irrigation':sources[0].startsWith('nueva muestra')?'sample':sources[0].startsWith('nueva observación satelital')?'satellite':sources[0].startsWith('lluvia')?'rain':sources[0].includes('ET')?'evapotranspiration':'recalculation',label:sources.join(', '),sources}}
function canonicalRow(row,index,stableMap){const key=lotId(row)||valveCode(row)||`row-${index}`;const previous=stableMap[key];const occupancy=numberOrNull(row?.occupancy);const currentEvidence=evidence(row);const incomplete=!row?.ready||occupancy==null;const unexplained=previous?.occupancy!=null&&occupancy!=null&&Math.abs(occupancy-previous.occupancy)>MAX_UNEXPLAINED_JUMP&&previous.evidence===currentEvidence;const noIntegratedBalance=text(row?.occupancySource)!=='balance_integrado';let result=row;if(noIntegratedBalance){if(occupancy!=null&&row?.ready){result={...row,canonicalStabilized:false,stabilizationReason:'provisional-source',canonicalNote:'Valor provisional leído de la vista hídrica/perfil. No se reemplaza por un porcentaje fijo histórico; verificar fuentes antes de actuar.'};}else{const fallback=validatedFallback(row);if(fallback)result={...fallback,ready:true,canonicalStabilized:true,stabilizationReason:fallback.fallbackProjected?'last-validated-projected':'last-validated-emergency',canonicalNote:fallback.canonicalNote||'RESPALDO HISTÓRICO: no hay porcentaje hídrico actual disponible. Este valor no debe interpretarse como cálculo vigente.'};else if(previous)result=applyStable(row,previous,'loading');}}else if(previous&&incomplete)result=applyStable(row,previous,'loading');else if(previous&&unexplained)result=applyStable(row,previous,'unexplained-jump');const finalOccupancy=numberOrNull(result?.occupancy);const reason=inferReason(previous,result);const decision=decisionReadiness(result);return {...result,decision,canonical:{key,lotId:lotId(row),valveCode:valveCode(row),occupancy:finalOccupancy,application:numberOrNull(result?.application),hours:numberOrNull(result?.hours),confidence:numberOrNull(result?.confidence),status:text(result?.status)||'Sin decisión',ready:Boolean(result?.ready),decisionReady:decision.ready,decisionLabel:decision.label,source:'hydric-engine-v75.1',revision,evidence:currentEvidence,evidenceParts:evidenceParts(result),stabilized:Boolean(result?.canonicalStabilized),stabilizationReason:result?.stabilizationReason||null,reason}}}
function auditRows(rows){const byLot=new Map(),byValve=new Map(),duplicates=[],missingIds=[];rows.forEach((row,index)=>{const id=lotId(row),code=valveCode(row);if(!id)missingIds.push({index,code});if(id){if(byLot.has(id))duplicates.push(`lote:${id}`);else byLot.set(id,row)}if(code){if(byValve.has(code))duplicates.push(`válvula:${code}`);else byValve.set(code,row)}});const issues=[];if(rows.length!==13)issues.push(`Se esperaban 13 válvulas y se obtuvieron ${rows.length}`);if(duplicates.length)issues.push(`${duplicates.length} identificadores duplicados`);if(missingIds.length)issues.push(`${missingIds.length} filas sin lot_id`);return {byLot,byValve,audit:{ok:issues.length===0,issues,duplicates:[...new Set(duplicates)],missingIds,count:rows.length}}}
function explanation(prev,row,reason){const next=numberOrNull(row?.occupancy),old=numberOrNull(prev?.occupancy),delta=old==null||next==null?null:next-old;const valve=row?.canonical?.valveCode||valveCode(row)||'Sector';const status=text(row?.status)||'Sin decisión';const sourceText=(reason?.sources||[]).join(', ');if(row?.canonical?.stabilized)return `${valve}: se mantiene el último valor válido (${next==null?'sin porcentaje':Math.round(next)+'%'}) porque las fuentes todavía están cargando o el salto detectado no tiene evidencia nueva.`;if(old==null)return `${valve}: primer cálculo canónico en ${next==null?'sin porcentaje':Math.round(next)+'%'}. Estado: ${status}. Fuentes: ${sourceText}.`;const dir=delta>0?'subió':delta<0?'bajó':'se mantuvo';return `${valve}: el agua disponible ${dir} de ${Math.round(old)}% a ${Math.round(next)}% (${delta>0?'+':''}${delta.toFixed(1)} puntos). Estado actual: ${status}. Motivo registrado: ${sourceText}.`}
function appendHistory(previousMap,rows){const history=readJson(HISTORY_KEY,readJson('lm:v71:hydric-history',[])),now=new Date().toISOString();rows.forEach(row=>{const key=row.canonical.key,prev=previousMap[key],next=numberOrNull(row.occupancy);if(next==null||row.canonical.stabilized)return;const pctChanged=!prev||prev.occupancy==null||Math.abs(next-prev.occupancy)>=0.5;const statusChanged=text(row.status)!==text(prev?.status);if(!pctChanged&&!statusChanged)return;const reason=inferReason(prev,row);history.push({at:now,key,lotId:row.canonical.lotId,valveCode:row.canonical.valveCode,occupancy:next,previousOccupancy:numberOrNull(prev?.occupancy),delta:prev?.occupancy==null?null:next-prev.occupancy,status:text(row.status),previousStatus:text(prev?.status),reason:reason.code,reasonLabel:reason.label,sources:reason.sources,evidence:row.canonical.evidence,explanation:explanation(prev,row,reason),application:numberOrNull(row?.application),hours:numberOrNull(row?.hours),confidence:numberOrNull(row?.confidence),etc:numberOrNull(row?.etc),effectiveRain:numberOrNull(row?.effectiveRain),ndvi:numberOrNull(row?.ndvi)})});writeJson(HISTORY_KEY,history.slice(-MAX_HISTORY))}
function buildSnapshot(){const stableMap=readJson(STORAGE_KEY,readJson('lm:v71:hydric-stable',{}));if(!provider){const a=auditRows([]);return {rows:[],...a,quality:'sin-proveedor',stabilizedCount:0}}let source=[];try{const raw=provider();source=Array.isArray(raw)?raw:[]}catch(err){console.error('Proveedor hídrico',err)}let rows=source.map((row,index)=>canonicalRow(row,index,stableMap));const monitor=monitorRows(rows);rows=rows.map(row=>{const frozen=frozenAudit(row,monitor);const decision=row.decision?{...row.decision,warnings:[...(row.decision.warnings||[]),...(frozen.flag?[frozen.label]:[])]}:row.decision;return {...row,frozenAudit:frozen,decision}});const checked=auditRows(rows);const candidateComplete=checked.audit.ok&&rows.every(r=>r.ready&&numberOrNull(r.occupancy)!=null);const nextStable={...stableMap};appendHistory(stableMap,rows);rows.forEach(r=>{if(!r.canonical.stabilized&&numberOrNull(r.occupancy)!=null)nextStable[r.canonical.key]=stableFields(r)});if(Object.keys(nextStable).length)writeJson(STORAGE_KEY,nextStable);const stabilizedCount=rows.filter(r=>r.canonical.stabilized).length;return {rows:deepFreeze(rows),...checked,quality:candidateComplete?'estable':stabilizedCount?'conservado':'incompleto',stabilizedCount}}
function notify(type,detail={}){const payload={type,revision,updatedAt,lastReason,...detail};listeners.forEach(fn=>{try{fn(payload)}catch(err){console.error('hydric-state listener',err)}});if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent(`lm:hydric-state-${type}`,{detail:payload}))}
export function registerHydricProvider(fn){if(typeof fn!=='function')throw new TypeError('El proveedor hídrico debe ser una función');provider=fn;invalidateHydricState('provider-registered')}
export function getHydricState(){if(!snapshot){revision+=1;updatedAt=new Date().toISOString();snapshot=buildSnapshot();notify('updated',{count:snapshot.rows.length,audit:snapshot.audit,quality:snapshot.quality,stabilizedCount:snapshot.stabilizedCount})}return {rows:snapshot.rows,updatedAt,revision,source:'canonical-hydric-engine-v75.1',audit:snapshot.audit,quality:snapshot.quality,stabilizedCount:snapshot.stabilizedCount,lastReason}}
export function getHydricRows(){return getHydricState().rows}
export function getHydricValve(id){getHydricState();const key=text(id);return snapshot.byLot.get(key)||snapshot.byValve.get(key)||null}
export function getHydricValveByCode(code){getHydricState();return snapshot.byValve.get(text(code))||null}
export function getHydricAudit(){return getHydricState().audit}
export function getHydricRevision(){getHydricState();return revision}
export function getHydricHistory(id=null){const rows=readJson(HISTORY_KEY,[]);if(id==null)return rows;const key=text(id);return rows.filter(x=>text(x.key)===key||text(x.lotId)===key||text(x.valveCode)===key)}
export function getHydricDecision(id){const row=getHydricValve(id)||getHydricValveByCode(id);if(!row)return {ready:false,label:'SECTOR NO ENCONTRADO',blockers:['No se encontró la válvula'],warnings:[],actionable:false};return row.decision||decisionReadiness(row)}
export function explainHydricValve(id){const row=getHydricValve(id)||getHydricValveByCode(id);if(!row)return {text:'No se encontró la válvula.',history:[],delta:null};const history=getHydricHistory(id);const last=history.at(-1)||null;return {text:last?.explanation||`${valveCode(row)}: ${row.occupancy==null?'sin porcentaje disponible':Math.round(row.occupancy)+'% de agua disponible'}. ${text(row.status)||'Sin decisión'}.`,history,last,delta:last?.delta??null,reason:last?.reasonLabel||row?.canonical?.reason?.label||'Cálculo canónico'}}
export function getHydricSummary(){const state=getHydricState(),valid=state.rows.filter(x=>x.ready&&x.occupancy!=null),avg=valid.length?valid.reduce((s,x)=>s+Number(x.occupancy),0)/valid.length:null;return {count:state.rows.length,valid:valid.length,decisionReady:valid.filter(x=>x?.decision?.ready).length,actionable:valid.filter(x=>x?.decision?.actionable).length,average:avg,urgent:valid.filter(x=>String(x.status).startsWith('Regar hoy')).length,watch:valid.filter(x=>String(x.status).startsWith('Regar en 24')||String(x.status).startsWith('Vigilar')).length,stable:valid.filter(x=>String(x.status).startsWith('No regar')).length,updatedAt:state.updatedAt,quality:state.quality,audit:state.audit}}
export function subscribeHydricState(fn){if(typeof fn!=='function')throw new TypeError('El suscriptor debe ser una función');listeners.add(fn);return ()=>listeners.delete(fn)}
export function invalidateHydricState(reason='data-change'){snapshot=null;updatedAt=null;lastReason=reason;notify('invalidated',{reason})}
export function refreshHydricState(reason='manual-refresh'){invalidateHydricState(reason);return getHydricState()}
export function assertHydricConsistency(){const audit=getHydricAudit();if(!audit.ok)console.warn('Auditoría hídrica v75:',audit);return audit}
export function clearHydricStableCache(){try{storage()?.removeItem(STORAGE_KEY);storage()?.removeItem(HISTORY_KEY);storage()?.removeItem(MONITOR_KEY)}catch{}invalidateHydricState('stable-cache-cleared')}

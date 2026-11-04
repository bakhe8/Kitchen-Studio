import {cleanDeliveryObservation} from './kitchen-delivery-domain.js';

const record=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const keys=(v,allowed,required=allowed)=>record(v)&&Reflect.ownKeys(v).every(k=>allowed.includes(k))&&required.every(k=>Object.hasOwn(v,k));
const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const copy=v=>structuredClone(v);
const fields={
 'warranty-record':['terms'],'service-open':['ticket'],'service-review':['ticketId','diagnosis','coverage','reference'],
 'service-repair':['ticketId','work','verification'],'service-close':['ticketId','customer','note'],'service-reopen':['ticketId','reason']
};
export const maintenanceActions=Object.freeze(Object.keys(fields));
export const maintenanceOwnerActions=Object.freeze(['warranty-record','service-review','service-close']);
const termFields=['reference','provider','startsOn','endsOn','coverage','exclusions'];
function day(v){
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
 const n=Date.parse(v);return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===v;
}
function utcDay(at){
 if(at instanceof Date)return Number.isFinite(at.getTime())?at.toISOString().slice(0,10):null;
 if(typeof at!=='string'||!day(at.slice(0,10))||!/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(at))return null;
 const n=Date.parse(at);return Number.isFinite(n)?new Date(n).toISOString().slice(0,10):null;
}
export function cleanWarrantyTerms(value){
 if(!keys(value,termFields,termFields.filter(k=>k!=='exclusions'))||!text(value.reference,180)||!text(value.provider,140)||!text(value.coverage,500)||
  !day(value.startsOn)||!day(value.endsOn)||value.endsOn<value.startsOn||value.exclusions!==undefined&&(typeof value.exclusions!=='string'||value.exclusions.length>500))return null;
 return {reference:value.reference.trim(),provider:value.provider.trim(),startsOn:value.startsOn,endsOn:value.endsOn,coverage:value.coverage.trim(),exclusions:(value.exclusions||'').trim()};
}
export function cleanServiceTicket(unit,value){
 if(!keys(value,['title','description','priority','anchor'])||!text(value.title,120)||!text(value.description,500)||!['normal','urgent'].includes(value.priority))return null;
 const located=cleanDeliveryObservation(unit,{text:value.description,severity:'info',anchor:value.anchor});
 return located?{title:value.title.trim(),description:located.text,priority:value.priority,anchor:located.anchor}:null;
}
/** Latest documented terms from one unit's API events. No assumed policy. */
export function serviceWarranty(events){
 let latest=null;
 for(const event of Array.isArray(events)?events:[]){
  if(event?.action!=='warranty-record'||event.state!=='accepted')continue;
  const terms=cleanWarrantyTerms(event.data?.terms);
  if(terms&&Number.isInteger(event.seq)&&event.seq>0&&utcDay(event.date))latest={...terms,seq:event.seq,date:event.date};
 }return latest;
}
/** Calendar comparison only, never a coverage decision; at must be supplied. */
export function warrantyStatus(terms,at){
 const clean=record(terms)&&cleanWarrantyTerms(Object.fromEntries(termFields.filter(k=>terms[k]!==undefined).map(k=>[k,terms[k]]))),date=utcDay(at);
 if(!clean||!date)return 'unknown';return date<clean.startsOn?'upcoming':date>clean.endsOn?'expired':'within';
}
const evidence=(event,keys)=>({...Object.fromEntries(keys.filter(k=>event.data[k]!==undefined).map(k=>[k,copy(event.data[k])])),seq:event.seq,date:event.date});
/** Detached per-ticket current cycles plus the complete relevant event history.
 * Input is API-shaped, server-ordered events. Factory closure projections omit
 * private customer/note fields; their public event still closes the ticket.
 */
export function serviceTickets(events){
 const tickets=new Map();
 for(const event of Array.isArray(events)?events:[]){
  if(!text(event?.unit,190)||event.state!=='accepted'||!record(event.data))continue;
  const data=event.data;
  if(event.action==='service-open'){
   const t=data.ticket;
   if(!record(t)||!text(t.id,64)||!text(t.title,120)||!text(t.description,500)||!['normal','urgent'].includes(t.priority)||!record(t.anchor)||!Number.isInteger(t.handoverSeq)||t.handoverSeq<1||!utcDay(event.date)||tickets.has(t.id))continue;
   tickets.set(t.id,{id:t.id,unit:event.unit,title:t.title,description:t.description,priority:t.priority,anchor:copy(t.anchor),status:'open',openedAt:event.date,cycleOpenedAt:event.date,handoverSeq:t.handoverSeq,history:[copy(event)]});continue;
  }
  const ticket=tickets.get(data.ticketId);if(!ticket||ticket.unit!==event.unit)continue;
  if(event.action==='service-review'&&ticket.status==='open'){
   ticket.status='reviewed';ticket.review=evidence(event,['diagnosis','coverage','reference','warranty']);
  }else if(event.action==='service-repair'&&ticket.status==='reviewed'){
   ticket.status='repaired';ticket.repair=evidence(event,['work','verification']);
  }else if(event.action==='service-close'&&ticket.status==='repaired'){
   ticket.status='closed';ticket.closure=evidence(event,['customer','note']);
  }else if(event.action==='service-reopen'&&['repaired','closed'].includes(ticket.status)&&utcDay(event.date)){
   ticket.status='open';ticket.cycleOpenedAt=event.date;delete ticket.review;delete ticket.repair;delete ticket.closure;
  }else continue;
  ticket.history.push(copy(event));
 }
 return [...tickets.values()];
}
export function serviceActionFor(ticket,role){
 if(!['owner','factory'].includes(role))return null;
 return ticket?.status==='open'&&role==='owner'?'service-review':ticket?.status==='reviewed'?'service-repair':ticket?.status==='repaired'&&role==='owner'?'service-close':null;
}
const fail=(message,status=422)=>{const error=Error(message);error.status=status;throw error;};
/** Pure canonical payload builder. The API separately enforces current role
 * and atomically checks expected seq, receipt custody, actor and request ID.
 * Every command requires an actual accepted handover and preserves that state.
 */
export function reviewMaintenanceCommand(unit,events,body,{requestId,now}={}){
 if(!record(body)||!Object.hasOwn(fields,body.action)||!keys(body,['action','unit','expected',...fields[body.action]])||body.unit!==unit?.id||!Number.isInteger(body.expected)||body.expected<0)fail('بيانات إجراء الخدمة أو حقوله غير صالحة.');
 const own=(Array.isArray(events)?events:[]).filter(e=>e.unit===unit.id),handover=own.find(e=>e.action==='accept'&&e.state==='accepted'),latest=own.at(-1);
 if(!handover||latest?.state!=='accepted')fail('يلزم محضر استلام فعلي لهذه الوحدة قبل توثيق الضمان أو الخدمة.',409);
 if(body.expected!==latest.seq)fail('تغيّر سجل الوحدة. حدّث البلاغ قبل تسجيل الإجراء.',409);
 if(!text(requestId,64)||!utcDay(now))fail('تعذّر تحديد هوية الحدث وتاريخ الخادم.');
 const {action}=body;
 if(action==='warranty-record'){
  const terms=cleanWarrantyTerms(body.terms);if(!terms)fail('أكمل مرجع الضمان ومزوّده ونطاقه وتاريخيه الصحيحين.');return {terms};
 }
 if(action==='service-open'){
  const ticket=cleanServiceTicket(unit,body.ticket);if(!ticket)fail('راجع عنوان البلاغ ووصفه وأولويته وموضعه على الوحدة الصادرة.');
  return {ticket:{id:requestId,...ticket,handoverSeq:handover.seq},status:'open'};
 }
 const ticket=serviceTickets(own).find(t=>t.id===body.ticketId);if(!ticket)fail('البلاغ غير موجود ضمن هذه الوحدة والإيصال.');
 const required={'service-review':['open'],'service-repair':['reviewed'],'service-close':['repaired'],'service-reopen':['repaired','closed']};
 if(!required[action]?.includes(ticket.status))fail('أكمل مرحلة البلاغ السابقة قبل تسجيل هذا الإجراء.',409);
 if(action==='service-review'){
  if(!text(body.diagnosis,500)||!['covered','outside','goodwill'].includes(body.coverage)||!text(body.reference,180))fail('وثّق التشخيص وقرار التغطية ومرجع القرار صراحةً.');
  const warranty=serviceWarranty(own);
  if(body.coverage==='covered'&&warrantyStatus(warranty,ticket.cycleOpenedAt)!=='within')fail('قرار التغطية يحتاج شروط ضمان موثقة تشمل تاريخ فتح الدورة الحالية.');
  return {ticketId:ticket.id,diagnosis:body.diagnosis.trim(),coverage:body.coverage,reference:body.reference.trim(),warranty,status:'reviewed'};
 }
 if(action==='service-repair'){
  if(!text(body.work,500)||!text(body.verification,500))fail('سجّل العمل المنفذ ونتيجة إعادة الفحص.');return {ticketId:ticket.id,work:body.work.trim(),verification:body.verification.trim(),status:'repaired'};
 }
 if(action==='service-close'){
  if(!text(body.customer,140)||!text(body.note,500))fail('أدخل اسم العميل ومحضر اعتماد المعالجة.');return {ticketId:ticket.id,customer:body.customer.trim(),note:body.note.trim(),status:'closed'};
 }
 if(!text(body.reason,500))fail('سجّل سبب إعادة فتح البلاغ.');return {ticketId:ticket.id,reason:body.reason.trim(),status:'open'};
}

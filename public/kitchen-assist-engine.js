import {resolveDefault} from './kitchen-defaults-model.js';
// Stateful evidence is read from the project's technician register. Derived
// results and design hints are deliberately computed afresh and never saved
// back as site measurements.
import {readFieldRegister,upsertFieldRecord,fieldChoices} from './kitchen-field-model.js';
import {fieldInputByCode} from './kitchen-field-catalog.js';
import {buildSite,contourAttestation} from './kitchen-assist-site.js';
import {validateKitchenChange} from './kitchen-model.js';
import {validRoomCladding} from './kitchen-studio-room.js';
import {checkSitePoints} from './kitchen-site-survey-model.js';
import {buildEquipment} from './kitchen-assist-equipment.js';
import {buildCustomer} from './kitchen-assist-customer.js';
const titles={site:'رفع الغرفة',services:'الفتحات والخدمات',equipment:'فحص غسالة الصحون',customer:'احتياجات العميل',production:'قبل التصنيع'};
const num=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:3});
export {assistFold,assistNumber,convertAssistUnit} from './kitchen-measurement-identity.js';
import {assistFold,assistNumber,convertAssistUnit,stableHash,measurementBaseline as baseline} from './kitchen-measurement-identity.js';
const keyOf=q=>'g-'+stableHash(JSON.stringify([q.code,q.itemId,q.id]));
const optionOf=(q,v)=>(q.options||[]).find(o=>[o.value,o.label,...(o.aliases||[])].some(x=>assistFold(x)===assistFold(v)));
const asBool=v=>v===true||v==='true'||v==='نعم'?true:v===false||v==='false'||v==='لا'?false:null;
const eq=(a,b)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<1e-7:typeof a===typeof b&&assistFold(a)===assistFold(b);
const verified=new Set(['measured','confirmed','documented']);
function matching(q,rows,opts){const scope=new Set([q.itemId,...q.itemAliases||[]].filter(Boolean).map(assistFold));const ids=[...(q.scopeIds||[]),...(q.allowLocationEntity?[q.itemId]:[])];const props=[q.property,...q.aliases||[]].map(assistFold),refs=(q.refs||[]).map(assistFold);
 return rows.filter(r=>{if(r.execution==='excluded'||r.inputCode!==q.code||opts.revision&&assistFold(r.revision)!==assistFold(opts.revision))return false;
 const ref=r.readingRef&&refs.includes(assistFold(r.readingRef)),scoped=scope.has(assistFold(r.itemId))||ids.some(id=>String(r.location||'').endsWith('['+id+']'));
 return (scoped||(ref&&q.allowGlobalRef===true))&&(r.assist?.key===q._key||props.includes(assistFold(r.property))||ref);});}
function decoded(q,r){if(r.value===null||r.value===undefined||r.value==='')return null;
 if(q.type==='number'){const n=convertAssistUnit(assistNumber(r.value),r.unit,q.unit||'');return r.valueType==='number'&&n!==null&&(q.min==null||n>=q.min)&&(q.max==null||n<=q.max)?n:null;}
 if(q.type==='boolean')return asBool(r.value);
 if(q.type==='choice')return optionOf(q,r.value)?.value??null;
 return typeof r.value==='string'?r.value:null;}
const no=(reason,rs)=>({state:reason,value:null,records:rs,source:reason==='conflict'?'قراءات لا تتفق؛ يلزم حسمها':reason==='unknown'?'لم يُحسم في الموقع':reason==='na'?'مسجّل: لا ينطبق':''});
function resolve(q,rows,opts){
 const all=matching(q,rows,opts);if(!all.length)return no('missing',[]);
 let rs=all,own=all.filter(r=>r.assist?.key===q._key);
 // Even a formerly resolved conflict reopens if a competing record changes.
 if(own.length===1&&own[0].assist?.baseline===baseline(all.filter(r=>r.id!==own[0].id)))rs=[own[0]];
 // Transferred plan attestation cannot outlive a withdrawn/edited source.
 if(rs.some(r=>r.assist?.support?.some(v=>{const original=rows.find(x=>x.id===v.id);return !original||baseline([original])!==v.sig;})))return no('conflict',all);
 if(rs.some(r=>r.verification==='conflict'))return no('conflict',all);
 const usable=rs.filter(r=>!['unknown','na'].includes(r.verification)),vals=usable.map(r=>decoded(q,r));
 if(!usable.length)return no(rs.every(r=>r.verification==='na')?'na':'unknown',all);
 // Invalid units (or an implausible value) are not evidence; never coerce an
 // unreadable recorded number to zero or quietly choose the other reading.
 if(vals.some(v=>v===null)||rs.some(r=>r.verification==='na')||vals.some(v=>!eq(v,vals[0])))return no('conflict',all);
 const r=usable.find(r=>verified.has(r.verification))||usable[0];
 return {state:verified.has(r.verification)?'known':'preliminary',value:decoded(q,r),record:r,records:all,source:[fieldChoices.verification[r.verification],r.source||r.readingRef||r.itemId].filter(Boolean).join(' · ')};
}
// A planning default can drive a proposal, but never certify an observed wall,
 // a test, a customer sign-off, a measured datum or a machine specification.
function planningEvidence(doc,q,base,topic){
 if(base.state!=='missing')return base;
 const cfg=resolveDefault(doc,{code:q.code,property:q.property,itemId:q.itemId,unit:q.unit,type:q.type,aliases:q.aliases||[]});
 if(!cfg||cfg.origin==='pending')return base;
 const planned=topic==='customer'&&!['matching-quote'].includes(q.id);
 const specificModel=topic==='equipment'&&q.id==='min'&&cfg.itemId&&cfg.itemId===q.itemId;
 const allowed=planned||specificModel;
 if(cfg.mode==='na')return allowed?{state:'assumed-na',value:null,source:cfg.source+' · مستبعد من التقدير',records:[],defaultRow:cfg}:base;
 if(cfg.mode!=='value')return base;
 let val=cfg.value;if(q.type==='number'){val=cfg.type==='number'?convertAssistUnit(val,cfg.unit,q.unit):null;if(val===null||(q.min!=null&&val<q.min)||(q.max!=null&&val>q.max))return base;}
 else if(q.type==='choice'){const o=optionOf(q,val);if(!o)return base;val=o.value;}
 else if(q.type==='boolean'){val=asBool(val);if(val===null)return base;}
 else if(typeof val!=='string')return base;
 if(!allowed){if(['number','text','date'].includes(q.type)&&q.defaultValue==null){q.defaultValue=val;q.defaultSource=cfg.source+' · مرجع تقديري فقط';}return base;}
 return {state:'assumed',value:val,records:[],source:cfg.source+' · قيمة تقديرية',defaultRow:cfg};
}
export function createAssistContext(doc,options={}){
 const rows=readFieldRegister(doc.room).records,model={questions:[],known:[],derived:[],deferred:[],answers:[],notes:[],entities:[],scopeChoices:[]};
 const ctx={doc,room:doc.room,kitchen:doc.kitchen,rows,records:rows,options,model,
  targets(list,selectedId){const clean=list.map(t=>({id:t.id??t.value,label:t.label}));model.entities=clean;model.scopeChoices=clean.map(e=>({value:e.id,label:e.label}));model.entityId=clean.find(x=>x.id===selectedId)?.id??clean[0]?.id??'';return model.entityId;},
  design(label,value,source='من الرسم · لم يُقَس في الموقع'){model.known.push({label,value,source,kind:'design'});},derive(label,value,source){model.derived.push({label,value,source,kind:'derived'});},info(label,value,source){model.notes.push({label,value,source,kind:'note'});},
  peek(spec){const q={type:'text',...spec};q._key=keyOf(q);return resolve(q,rows,options);},
  ask(spec){
   if(!spec?.id||!spec.itemId||!fieldInputByCode.has(spec.code))throw Error('Guided question has no valid context: '+spec?.id);
   const q={type:'text',verification:'confirmed',...spec};q._key=keyOf(q);
   const evidence=planningEvidence(doc,q,resolve(q,rows,options),options.topicId);q.evidence=evidence;q.recordId=evidence.record?.id;
   model.answers.push(q);
   if(evidence.state==='assumed-na')model.known.push({label:q.property,value:'مستبعد من التقدير',source:evidence.source,kind:'default',questionId:q.id,state:evidence.state});
   if(['known','preliminary','assumed'].includes(evidence.state)){const v=evidence.value,display=q.type==='number'?num.format(v)+(q.unit?' '+q.unit:''):q.type==='boolean'?(v?'نعم':'لا'):q.type==='choice'?(optionOf(q,v)?.label??v):String(v);
     model.known.push({label:q.property,value:display,source:evidence.source,kind:evidence.state==='assumed'?'default':'record',questionId:q.id,state:evidence.state});}
   if(evidence.state==='unknown'||evidence.state==='na')model.deferred.push(q);
   else if(evidence.state==='conflict'||!q.optional&&!['known','assumed','assumed-na'].includes(evidence.state))model.questions.push(q);
   return evidence;
  }
 };return ctx;
}
export function buildAssistant(doc,topicId='site',options={}){
 let id=titles[topicId]?topicId:'site';const ctx=createAssistContext(doc,{...options,topicId:id});
 const out=(id==='equipment'?buildEquipment:id==='customer'||id==='production'?buildCustomer:buildSite)(ctx,id,options)||{};
 const m={id,title:titles[id],...ctx.model,...out};if(out.scopeChoices&&!m.entities?.length)m.entities=out.scopeChoices.map(t=>({id:t.value??t.id,label:t.label}));if(out.entities&&!m.scopeChoices?.length)m.scopeChoices=out.entities.map(t=>({value:t.id??t.value,label:t.label}));if(m.answers.some(q=>q.evidence.state==='assumed'||q.evidence.state==='assumed-na')){m.estimating=true;for(const f of m.derived)if(!f.source?.includes('قيمة افتراضية'))f.source+=' · وفق الافتراضيات السارية';}
 return m;
}
export function applyAnswer(doc,topicId,questionId,value,options={}){
 const state=buildAssistant(doc,topicId,options),q=state.answers.find(t=>t.id===questionId);
 const err=reason=>({ok:false,reason});if(!q)return err('تغيّر السياق؛ أعد فتح السؤال المناسب.');
 if(q.evidence.state==='conflict'&&!options.resolve)return err('توجد قراءات متعارضة؛ راجعها ثم اعتمد القراءة صراحةً.');
 const unknown=options.unknown===true,na=options.na===true;let actual=value,unit=q.unit||'';
 if(unknown||na)actual=null;
 else if(q.type==='number'){actual=assistNumber(actual);if(actual===null||(q.min!=null&&actual<q.min)||(q.max!=null&&actual>q.max))return err('أدخل قياسًا ضمن المجال'+(q.min==null?'':' من '+q.min)+(q.max==null?'':' إلى '+q.max)+(unit?' '+unit:'')+'.');}
 else if(q.type==='choice'){const o=optionOf(q,actual);if(!o)return err('اختر أحد الخيارات الظاهرة.');actual=o.label;}
 else if(q.type==='boolean'){actual=asBool(actual);if(actual===null)return err('اختر نعم أو لا.');}
 else if(typeof actual!=='string'||!actual.trim())return err('أدخل قيمة أو أجّل السؤال.');
 const visit=options.visit||{},rev=options.revision||visit.revision||'',records=q.evidence.records,own=records.find(r=>r.assist?.key===q._key&&r.revision===rev);
 const manual=records.filter(r=>r.id!==own?.id),assist={key:q._key};if(options.resolve||((own?.assist?.baseline&&own.assist.baseline===baseline(manual))))assist.baseline=baseline(manual);
 const row={...(own||{date:visit.date||'',responsible:visit.responsible||''}),inputCode:q.code,itemId:q.itemId,property:q.property,location:q.location||'',revision:rev,valueType:q.type,value:actual,unit,verification:unknown?'unknown':na?'na':q.verification,assist,source:q.source||(q.verification==='measured'?'قياس أدخله الفني':q.verification==='documented'?'حسب مرجع الموديل':'إجابة الزيارة'),execution:q.execution||(q.verification==='measured'?'existing':'unspecified')};
 if(!records.length&&q.writeRef)row.readingRef=q.writeRef;
 return upsertFieldRecord(doc.room,row);
}


// A guided answer only updates the register. Changing CAD requires a separate
// user action and the host still runs its normal single atomic project commit.
export function applyAssistRoomProposal(doc,expectedToken,options={}){
 if(expectedToken&&typeof expectedToken==='object'){options=expectedToken;expectedToken=options.token;}
 const no=reason=>({ok:false,reason}),p=buildAssistant(doc,'site',options).roomProposal;
 if(!p||expectedToken&&p.token!==expectedToken)return no('تغيّرت القياسات أو الرسم؛ راجع الاقتراح الحالي.');
 const room={...doc.room,[p.dimension]:p.toMM/10},candidate={...doc,room},next=createAssistContext(candidate,options),q=contourAttestation(room),prior=next.peek(q);
 const floor=checkSitePoints(room),guard=validateKitchenChange(doc.kitchen,doc.room,doc.kitchen,room);
 if(!floor.ok||!guard.ok)return no((!floor.ok?floor:guard).reason);if(!validRoomCladding(room.cladding,room.height))return no('منسوب التبليط يتجاوز ارتفاع الغرفة المقترح.');
 if(prior.state!=='missing'&&!(prior.state==='known'&&prior.value==='match'))return no('للمسقط المقترح إفادة سابقة تحتاج إلى مراجعة قبل التطبيق.');
 if(prior.state==='known')return {ok:true,room,proposal:p};
 // This is a transfer of an existing field attestation, not an invented fresh
 // measurement. Include the unaltered evidence IDs in the durable record.
 const ev=upsertFieldRecord(room,{inputCode:q.code,itemId:q.itemId,revision:options.revision||'',location:q.location,property:q.property,valueType:'choice',value:q.options.find(x=>x.value==='match').label,
 verification:'confirmed',execution:'existing',assist:{key:keyOf(q),support:p.evidenceIds.map(id=>({id,sig:baseline([next.rows.find(r=>r.id===id)])}))},source:'تطبيق قراءة الرفع على الرسم؛ بقيت الأبعاد المؤكدة كما هي.',notes:'مراجع التحقق والقياس الأصليين: '+p.evidenceIds.join('، ')});
 return ev.ok?{...ev,proposal:p}:ev;
}

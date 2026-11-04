// Reuse the interview's normalization, evidence ranking, explicit conflict
// resolution and scoping. Suggested defaults and assumptions cannot order food storage.
import {assistFold} from './kitchen-measurement-identity.js';
import {buildAssistant} from './kitchen-assist-engine.js';
export const pantryModes={unknown:'لم يُحسم نوع التخزين',bags:'الأكياس الأصلية',owned:'حافظة يوفّرها العميل',bin:'حافظة يورّدها المصنع حسب الوصفة',dispenser:'عيّاشة بموديل ومرجع توريد'};
const pantryProps=new Set(['طريقة التخزين','كمية الأرز التي يريد العميل تخزينها','كمية الأرز','وزن الأرز المطلوب','وزن الكيس الواحد','جهة توريد الحافظة','سعة الحافظة من الأرز بالكيلوغرام'].map(assistFold));
export function pantryRequests(doc){
 const records=(doc.room.fieldRegister?.records||[]).filter(r=>r.inputCode==='USE-08'&&r.execution!=='excluded'&&r.itemId&&pantryProps.has(assistFold(r.property)));
 return [...new Set(records.map(r=>r.itemId))].map(id=>{
  const qs=buildAssistant(doc,'customer',{entityId:'pantry:'+id}).answers;
  const ev=k=>qs.find(q=>q.id===k)?.evidence,known=k=>ev(k)?.state==='known'?ev(k).value:null;
  const choice=known('packaging'),supply=known('bin-supply'),per=choice==='bag'?'bag-fill':choice==='accessory'?'rice-rated':'bin-kg';
  return {id,choice,confirmed:choice!==null,mode:choice==='bag'?'bags':choice==='accessory'?'dispenser':choice==='bin'?(supply==='owner'?'owned':supply==='factory'?'bin':'unknown'):'unknown',
   amountKg:known('rice-qty'),packageKg:known(per),amountStatus:ev('rice-qty')?.state,packageStatus:ev(per)?.state,model:known('rice-model'),source:ev('packaging')?.record?.source||'',state:ev('packaging')?.state||'missing'};
 });
}
const riceUnits=doc=>Object.entries(doc.room.workshop?.rows||{}).flatMap(([runId,row])=>row.units.filter(u=>u.family==='rice'&&doc.kitchen.units.some(x=>x.id===u.id&&x.runId===runId)).map(e=>({runId,e})));
export function pantryContext(doc,runId=null,selectedId=null){
 const requests=pantryRequests(doc),units=riceUnits(doc),here=units.filter(x=>x.runId===runId),other=units.filter(x=>x.runId!==runId),existing=here[0]?.e;
 const id=selectedId??existing?.pantryId??(requests.length===1?requests[0].id:null);
 const req=requests.find(r=>r.id===id)||null,placed=req&&other.some(x=>x.e.pantryId===req.id||!x.e.pantryId&&requests.length===1);
 return {requests,req,placed,existing,wanted:existing?true:!!(req?.confirmed&&req.choice!=='none'&&!placed),mode:existing?.riceMode||req?.mode||'unknown',
  note:requests.length===0?'لا يوجد طلب أرز مؤكد في مقابلة العميل.':!req?'توجد طلبات تخزين متعددة. عيّن الطلب المقصود قبل استعمال كمياته.':!req.confirmed?'طريقة تخزين الأرز غير محسومة في المقابلة.':req.choice==='none'?'أكد العميل عدم طلب تخزين الأرز.':placed?'رُبط طلب الأرز بوحدة على صف آخر.':req.mode==='unknown'?'حدّد في مقابلة العميل من يورّد الحافظة.':'طلب العميل · '+pantryModes[req.mode]+(req.amountKg!=null?' · '+req.amountKg+' كجم':'')};
}
export function pantryForUnit(doc,entry){
 const reqs=pantryRequests(doc);return entry.pantryId?reqs.find(r=>r.id===entry.pantryId)||null:reqs.length===1&&riceUnits(doc).length===1?reqs[0]:null;
}
export function pantryUnitIssues(doc,run,entry,check){
 const {requests}=pantryContext(doc,run.id,entry.pantryId),all=riceUnits(doc);
 if(!requests.length&&!entry.pantryId)return [];
 const req=entry.pantryId?requests.find(r=>r.id===entry.pantryId):requests.length===1&&all.length===1?requests[0]:null;
 if(!req)return ['عيّن طلب مقابلة العميل لهذه الوحدة أو راجع الطلب المحذوف.'];
 if(!req.confirmed)return ['قرار الأرز في مقابلة العميل غير مؤكد. راجع المصدر قبل الاعتماد.'];
 if(req.choice==='none')return ['طلب العميل عدم تخصيص درج للأرز. راجع الوظيفة في الصف أو حدّث المقابلة مع العميل.'];
 const issues=[];
 if([req.amountStatus,req.packageStatus].includes('conflict'))issues.push('توجد كميات أو سعات متعارضة في مقابلة العميل. احسم المصدر قبل اعتماد فحص السعة.');
 if(all.filter(x=>x.e.pantryId===req.id||!x.e.pantryId&&requests.length===1).length>1)issues.push('طُبّق طلب التخزين نفسه على أكثر من وحدة. اربط كل وحدة بطلب مستقل وكمية محددة.');
 if(req.mode==='unknown'||entry.riceMode!==req.mode)issues.push('نوع التخزين أو جهة توريد الحافظة تختلف عن مقابلة العميل أو لم تُحسم.');
 if(check&&((req.amountKg!=null&&req.amountKg!==check.amountKg)||(req.packageKg!=null&&req.packageKg!==check.packageKg)))issues.push('كميات فحص السعة تختلف عن آخر طلب مؤكد. راجع القيم المنقولة من المقابلة واحفظ الفحص مجددًا.');
 if(req.choice==='accessory'&&entry.pantrySupply&&(!req.model||entry.pantrySupply.model!==req.model))issues.push('موديل العيّاشة المربوط بالصنف لا يطابق مرجع الموديل في المقابلة.');
 return issues;
}
export function matchingPantryModel(doc,entry){
 const req=pantryForUnit(doc,entry);return !req||req.choice!=='accessory'||(!!req.model&&entry.pantrySupply?.model===req.model);
}
export function validPantrySupply(x){
 return !!x&&typeof x.sku==='string'&&/^[a-zA-Z0-9][\w.-]{0,47}$/.test(x.sku)&&[x.model,x.reference].every(v=>typeof v==='string'&&v.trim()&&v.length<=160);
}
export function pantryDecisionItems(doc){
 const requests=pantryRequests(doc),all=riceUnits(doc);
 return requests.map(req=>{
  const matches=all.filter(x=>x.e.pantryId===req.id||!x.e.pantryId&&requests.length===1);
  const selected=matches[0],run=selected&&doc.kitchen.runs.find(r=>r.id===selected.runId);
  let issue='';
  if(!req.confirmed)issue='طريقة التخزين غير محسومة في مقابلة العميل.';
  else if(req.choice==='none'&&matches.length)issue='طلب العميل عدم تخزين الأرز بينما توجد وحدة أرز على الرسم.';
  else if(req.choice!=='none'){
   if(!matches.length)issue='طلب العميل التخزين ولم يرتبط بوحدة على الرسم.';
   else if(matches.length>1)issue='طلب واحد مرتبط بعدة وحدات، راجع كمية كل طلب.';
   else if(req.mode==='unknown'||req.mode!==selected.e.riceMode)issue='طريقة التخزين أو جهة توريد الحافظة غير مطابقة للطلب.';
   else if(req.mode==='dispenser'&&(!req.model||selected.e.pantrySupply?.model!==req.model))issue='موديل العيّاشة لم يُطابق بعد مع صنف توريد الوحدة.';
  }
  return {id:'pantry:'+req.id,name:'أرز ومؤن · '+req.id,value:issue||(req.choice==='none'?'أكد العميل عدم طلب الأرز':pantryModes[req.mode]+' · '+selected.e.id),open:!!issue,step:'row',focus:run?{wall:run.wall,runId:run.id}:{}};
 });
}

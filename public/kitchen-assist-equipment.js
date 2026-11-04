// Adaptive on-site height check. Site selections are observations; cabinet
// geometry is a design reference, never a substitute for a tape measurement.
import {kitchenGeometry} from './kitchen-model.js';
import {architectureWallLabel} from './kitchen-architecture.js';
import {isClearanceCandidate} from './kitchen-field-clearance.js';

const external='@field',manual='غسالة-صحون-ميدانية',FMT=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2});
const mm=v=>FMT.format(v)+' مم',round=x=>Math.round(x*1e7)/1e7;
const locId=r=>String(r.location||'').match(/\[([^\]]+)\]\s*$/)?.[1]||'';
const slotInfo={
 ledge:{key:'ledge',ref:'D2-LEDGE',code:'SITE-19',property:'منسوب أعلى التعلية',label:'ما منسوب سطح التعلية عند جميع أرجل الغسالة؟'},
 floor:{key:'floor',ref:'D2-FLOOR',code:'SITE-19',property:'منسوب أرضية فراغ الجهاز',label:'ما منسوب الأرضية الفعلي عند أرجل الغسالة؟'},
 top:{key:'top',ref:'D2-TOP',code:'CAT-17',property:'منسوب أسفل الرخام عن صفر الأرضية النهائية',label:'ما منسوب السطح من أسفل عند فتحة الغسالة؟'},
 min:{key:'min',ref:'D2-MIN',code:'EQP-02',property:'الحد الأدنى لارتفاع فتحة الموديل',label:'ما أقل ارتفاع للفتحة بحسب دليل هذا الموديل؟'}
};
const isKnown=a=>a.state==='known'||a.state==='preliminary'||a.state==='assumed';
const inGroup=(r,meta)=>isClearanceCandidate(meta,r);
const sourceText=v=>v.source||v.record?.source||v.record?.property||'قراءة مرتبطة بالموضع';
const option=(value,label)=>({value,label});
function mountChoices(rows,selected,drawnIds){
 const choices=[];
 for(const key of ['ledge','floor']){
  const info=slotInfo[key],seen=new Set();
  for(const r of rows){
   if(!inGroup(r,info)||r.verification==='na'||r.execution==='excluded'||r.itemId===selected||locId(r)===selected||drawnIds.has(r.itemId)||drawnIds.has(locId(r)))continue;
   const id=key+'|'+r.inputCode+'|'+r.itemId;if(seen.has(id))continue;seen.add(id);
   choices.push(option(id,(key==='ledge'?'فوق التعلية المسجّلة: ':'في فراغ الأرضية المسجّل: ')+r.itemId+' ('+r.inputCode+')'));
  }
 }
 const custom=(value,label,newLabel)=>({value,label:choices.some(o=>o.value.startsWith(value+'|'))?newLabel:label,aliases:[label,newLabel]});
 return [option('zero','على أرضية مستوية عند صفر الرفع'),...choices,custom('floor','على أرضية بمنسوب آخر','على منسوب أرضي آخر غير مسجّل'),custom('ledge','فوق تعلية مبلّطة','فوق تعلية أخرى غير مسجّلة'),option('mixed','الأرجل موزّعة على منسوبين'),{value:'absent',label:'لا توجد غسالة ولا تُطلب هنا',aliases:['لا توجد غسالة في هذا الموضع']}];
}
function readSlot(ctx,key,spec){
 const m=slotInfo[key],ids=new Set([spec.itemId,...(spec.scopeIds||[])]);
 const comparable=ctx.rows.filter(r=>inGroup(r,m)&&r.inputCode===(spec.code||m.code)&&(ids.has(r.itemId)||ids.has(locId(r))));
 return ctx.ask({id:key,label:m.label,code:m.code,property:m.property,type:'number',unit:'مم',verification:key==='min'?'documented':'measured',allowLocationEntity:true,refs:[m.ref],...spec,
  aliases:[...new Set([...(spec.aliases||[]),...comparable.map(r=>r.property)])],itemAliases:[...(spec.itemAliases||[]),...(spec.scopeIds||[]),...comparable.filter(r=>ids.has(locId(r))).map(r=>r.itemId)].filter(id=>!ctx.rows.some(row=>row.itemId===id&&locId(row)&&!ids.has(locId(row))))});
}
export function buildEquipment(ctx,topicId,opts={}){
 const k=ctx.kitchen,rows=ctx.rows,geom=kitchenGeometry(k,ctx.room),units=geom.units.filter(u=>u.kind==='dishwasher');
 const scopeChoices=units.map((u,i)=>option(u.id,(units.length>1?'غسالة '+FMT.format(i+1):'غسالة الصحون')+' · '+(u.wall?architectureWallLabel(u.wall):'الجزيرة')));
 // A named appliance in the technician inventory can be checked even before
 // it is put on the drawing. Do not turn an unrelated unnamed appliance, a
 // rejected model, or mere lack of a symbol on plan into a real dishwasher.
 const registered=new Map(),drawn=new Set(units.map(v=>v.id)),dwName=/غسال[ةه]\s*(?:ال)?(?:صحون|[أا]طباق)|dishwasher/i;
 for(const r of rows){
  if(!['EQP-01','EQP-02'].includes(r.inputCode)||r.itemId===manual||drawn.has(r.itemId)||drawn.has(locId(r))||r.execution==='excluded'||['na','unknown','conflict'].includes(r.verification)||r.value===false)continue;
  const explicit=dwName.test(r.itemId)||dwName.test(r.location)||(/^(نوع|اسم) الجهاز/.test(r.property)&&typeof r.value==='string'&&dwName.test(r.value));
  if(explicit&&!registered.has(r.itemId))registered.set(r.itemId,r);
 }
 for(const [id] of registered)scopeChoices.push(option('@record:'+id,'من السجل · '+id));
 scopeChoices.push(option(external,scopeChoices.length?'غسالة خارج الرسم والسجل':'غسالة غير موجودة في الرسم'));
 const entityId=scopeChoices.some(o=>o.value===opts.entityId)?opts.entityId:scopeChoices[0].value;
 const u=units.find(u=>u.id===entityId),registeredRow=entityId.startsWith('@record:')?registered.get(entityId.slice(8)):null,scopeId=u?.id||registeredRow?.itemId||manual,location=u?scopeChoices.find(o=>o.value===u.id).label+' ['+u.id+']':registeredRow?.location||'موقع غسالة صحون خارج الرسم';
 const header={title:'فتحة غسالة الصحون',entityId,scopeChoices};
 const gRun=u&&geom.runs.find(r=>r.id===u.runId);
 const worktop=u&&geom.worktops.find(t=>t.runId===u.runId&&t.start<=u.u+1e-5&&t.end>=u.u+u.width-1e-5);
 const designTop=worktop?round(worktop.bottom*10):null;
 if(u){ctx.design('الغسالة في التصميم',location.split(' [')[0],'موضع الوحدة في الرسم؛ لا يثبت أنها مركّبة في الموقع.');
  if(worktop)ctx.design('أسفل سطح العمل في الرسم',mm(designTop),'منسوب الصف '+mm(gRun.bottom*10)+' + ارتفاع جسمه '+mm(gRun.height*10)+'؛ السماكة فوق هذا الوجه.');
 }else if(registeredRow){ctx.info('الغسالة من سجل المشروع',registeredRow.itemId,'مرجعها '+(registeredRow.readingRef||registeredRow.inputCode)+'؛ لا يوجد موضع مرتبط بها في الرسم.');}
 else{
  const has=ctx.ask({id:'present',itemId:scopeId,location,property:'وجود غسالة صحون خارج الرسم',code:'EQP-01',label:'هل توجد أو تُطلب غسالة صحون خارج الرسم؟',type:'boolean',verification:'confirmed'});
  if(!isKnown(has)||has.value!==true){if(isKnown(has))ctx.info('الفحص غير منطبق','لا تتطلب هذه الزيارة فحص فتحة غسالة خارج الرسم.','من إجابة الفني؛ لا تُطلب مناسيب أو مواصفات موديل.');return header;}
 }
 const bearing=ctx.ask({id:'bearing',itemId:scopeId,location,allowLocationEntity:true,property:'حالة ارتكاز أرجل غسالة الصحون',code:'SITE-19',label:'أين ترتكز كل أرجل الغسالة؟',type:'choice',verification:'confirmed',options:mountChoices(rows,scopeId,new Set(units.map(u=>u.id))),hint:'اختر الحالة الفعلية عند موضع الجهاز، وبنفس مرجع صفر الأرضية النهائية.'});
 if(!isKnown(bearing))return header;
 if(bearing.value==='absent'){ctx.info('الفحص غير منطبق','الغسالة غير موجودة هنا.','سُجّل الاستثناء للموقع؛ لم تُحذف الوحدة من التصميم.');return header;}
 if(bearing.value==='mixed'){ctx.info('يحتاج مراجعة ارتكاز','لا توجد نتيجة ارتفاع موحّدة.','قِس المنسوب عند كل رجل وراجع حدود تسوية الموديل؛ طرح متوسط المنسوبين لن يثبت ملاءمة الفتحة.');return header;}
 const [kind,code,...parts]=String(bearing.value).split('|');if(!['zero','ledge','floor'].includes(kind))return header;
 const associated=parts.join('|');
 let base;
 if(kind==='zero'){base={state:bearing.state,value:0,source:'اختيار الفني أن جميع الأرجل على أرضية صفر الرفع.'};ctx.derive('منسوب ارتكاز الأرجل',mm(0),base.source);}
 else {base=readSlot(ctx,kind,{itemId:associated||scopeId,code:code||slotInfo[kind].code,location:associated?'عند '+associated:location,scopeIds:associated?[]:[scopeId],hint:'أدخل منسوب سطح الارتكاز عن صفر الرفع، وليس سماكة البلاط.'});}
 const counter=readSlot(ctx,'top',{itemId:scopeId,location,scopeIds:[scopeId,...(worktop?[worktop.id,gRun.id]:[])],
  optional:worktop!=null,defaultValue:designTop??undefined,defaultSource:worktop?'من التصميم فقط':undefined,hint:worktop?'يتاح حساب مبدئي من الرسم؛ أدخل منسوب أسفل السطح من الموقع للحصول على فحص موثّق.':'قِس إلى أسفل السطح وليس أعلاه، وبنفس صفر الرفع.'});
 const min=readSlot(ctx,'min',{itemId:scopeId,location,scopeIds:[scopeId],min:0.1,hint:'مقاس فتحة تركيب الجهاز من دليله، وليس ارتفاع جسم غسالة افتراضية.'});
 // The absence of any site top reading allows a provisional CAD value; an
 // explicitly unknown, disputed or inapplicable reading must never fall back.
 const fallback=counter.state==='missing'&&Number.isFinite(designTop);
 const topValue=fallback?designTop:isKnown(counter)?counter.value:null;
 const trustworthy=(kind==='zero'?bearing.state==='known':base.state==='known')&&counter.state==='known'&&bearing.state==='known';
 if(!Number.isFinite(topValue)||!isKnown(base)||!Number.isFinite(base.value)){
  ctx.info('صافي الارتفاع','بانتظار قراءات الموضع','لا تُستبدل قراءة مفقودة أو متعارضة بصفر.');return header;
 }
 const available=round(topValue-base.value);
 const source='أسفل السطح '+mm(topValue)+' ('+(fallback?'من التصميم':sourceText(counter))+') − الارتكاز '+mm(base.value)+' ('+sourceText(base)+').';
 ctx.derive('صافي ارتفاع فتحة الغسالة'+(trustworthy?'':' · مبدئي'),mm(available),source);
 if(!isKnown(min)||!Number.isFinite(min.value)||min.value<=0){ctx.info('ملاءمة ارتفاع الموديل','بانتظار الحد الأدنى من دليل الجهاز.','يمكن قياس الفتحة قبل اختيار الموديل.');return header;}
 const diff=round(available-min.value),name=diff<0?'ينقص '+mm(-diff):diff===0?'يطابق الحد الأدنى تمامًا':'فائض '+mm(diff);
 ctx.derive('مقارنة ارتفاع الموديل'+(trustworthy&&min.state==='known'?'':' · مبدئية'),name,mm(available)+' متاح − '+mm(min.value)+' مطلوب ('+sourceText(min)+'). لا تشمل النتيجة العرض أو العمق أو التهوية.');
 return header;
}

import {ownKey,inheritedName} from './kitchen-safe-keys.js';
// Numeric work instructions at a declared part datum. These are a shop operation
// sheet for an engineer/operator; they are not a controller-specific program.
export const processNames={scribe:'تشذيب حافة على مسار مرفوع',size:'قص لوح مستطيل إلى المقاس',drill:'ثقب دائري',mill:'تفريز جيب مستطيل',miter:'قص طرف بزاوية',bend:'ثني على خط'};
const key=s=>typeof s==='string'&&/^[A-Za-z0-9][\w.-]{0,46}$/.test(s)&&!inheritedName(s);
const str=(s,n)=>typeof s==='string'&&s.trim()&&s.length<=n;
const num=(v,lo,hi)=>Number.isFinite(v)&&v>=lo&&v<=hi;
const maybe=(v,lo,hi)=>v==null||num(v,lo,hi);
export function cleanMachineBook(v,items){
 if(v==null)return undefined;
 if(!v||!Array.isArray(v.machines)||v.machines.length>48||typeof v.strict!=='boolean')return null;
 const machines=[],seen=new Set();
 for(const m of v.machines){
  if(!m||!key(m.id)||seen.has(m.id)||!str(m.name,120)||!str(m.datum,150)||!Array.isArray(m.skus)||!m.skus.length||m.skus.some(x=>!items.some(i=>i.sku===x&&i.kind!=='piece'))||
    !Array.isArray(m.ops)||!m.ops.length||m.ops.some(x=>!ownKey(processNames,x))||!num(m.maxLength,1,100000)||!num(m.maxWidth,1,100000)||!num(m.maxThickness,.001,1500)||
    !num(m.minTolerance,.0001,100)||!num(m.clampMargin,0,1000)||!num(m.maxAngle,0,180)||!num(m.minBendRadius,0,5000)||
    !maybe(m.setupMin,0,10000)||!maybe(m.dailyMin,1,1440))return null;
  machines.push({id:m.id,name:m.name.trim(),datum:m.datum.trim(),skus:[...new Set(m.skus)],ops:[...new Set(m.ops)],maxLength:m.maxLength,maxWidth:m.maxWidth,maxThickness:m.maxThickness,
   minTolerance:m.minTolerance,clampMargin:m.clampMargin,maxAngle:m.maxAngle,minBendRadius:m.minBendRadius,setupMin:m.setupMin??null,dailyMin:m.dailyMin??null});seen.add(m.id);
 }
 return {strict:v.strict,machines};
}
export function cleanPartOperations(raw){
 if(raw==null)return undefined;
 if(!Array.isArray(raw)||raw.length>24)return null;const normalized=[];
 for(const op of raw){
  if(!op||!ownKey(processNames,op.kind)||(!key(op.machine)&&op.machine!=='external')||!str(op.reference,160)||!num(op.tolerance,.0001,100)||
    !maybe(op.minutes,0,1440)||!['start','end'].includes(op.xFrom)||!['start','end'].includes(op.yFrom))return null;
  if(!['x','y','diameter','depth','length','width','angle','radius'].every(k=>num(op[k],0,100000)))return null;
  if(op.kind==='size'&&(!op.length||!op.width)||op.kind==='drill'&&(!op.diameter||!op.depth)||op.kind==='mill'&&(!op.length||!op.width||!op.depth)||op.kind==='bend'&&(!op.radius||!op.angle)||op.angle>180)return null;
  if(op.machine==='external'&&(!str(op.provider,120)||!str(op.confirmation,160)||!maybe(op.leadDays,0,365)))return null;
  normalized.push({...Object.fromEntries(['kind','machine','reference','tolerance','xFrom','yFrom','x','y','diameter','depth','length','width','angle','radius'].map(k=>[k,op[k]])),minutes:op.minutes??null,
   ...(op.machine==='external'?{provider:op.provider.trim(),confirmation:op.confirmation.trim(),leadDays:op.leadDays??null}:{})});
 }
 return normalized;
}
export function machiningSheet(pieces,catalog){
 const operations=[],issues=[],unrouted=[],book=catalog.machining||{strict:false,machines:[]};
 for(const p of pieces){
  if(p.kind==='piece')continue;
  if(!p.operations?.length){unrouted.push(p.unitId+' / '+p.label);if(book.strict)issues.push('مسار تشغيل غير محدد للقطعة '+p.unitId+' / '+p.label);continue;}
  const item=catalog.items.find(x=>x.sku===p.sku);if(!item)continue;
  const stockWidth=p.kind==='panel'?p.b:item.sectionWidthMm;
  if(book.strict&&p.ends)for(const [edge,angle] of [['start',p.ends.startDeg],['end',p.ends.endDeg]]){
   if(angle&&!p.operations.some(op=>op.kind==='miter'&&op.xFrom===edge&&Math.abs(op.angle-Math.abs(angle))<1e-6))issues.push('زاوية طرف '+p.label+' تحتاج عملية قص مطابقة لمرجع الوصلة.');
  }
  for(const op of p.operations){
   const problems=[],x=op.xFrom==='end'?p.a-op.x:op.x,y=op.yFrom==='end'?(stockWidth??0)-op.y:op.y;
   const machine=book.machines.find(m=>m.id===op.machine),out=op.machine==='external';
   if(!num(item.thicknessMm,.001,1500)||!num(stockWidth,.001,100000))problems.push('أكمل سماكة الخام وعرض المقطع الحقيقي.');
   // For bar hole/pocket depth the stock's wall gauge may be less than its
   // outside section. Require explicit solid section or verified wall gauge.
   const gauge=p.kind==='bar'?item.gaugeMm:item.thicknessMm;
   if(['drill','mill'].includes(op.kind)&&(gauge==null||gauge<=0||op.depth>gauge))problems.push('عمق التشغيل يتجاوز سماكة الوجه المؤكدة أو تنقص سماكته.');
   if(!out&&!machine)problems.push('الماكينة غير معرّفة.');
   if(machine){
    if(!machine.skus.includes(item.sku)||!machine.ops.includes(op.kind))problems.push('الماكينة غير معتمدة لهذا الصنف أو العملية.');
    if(p.a>machine.maxLength||stockWidth>machine.maxWidth||item.thicknessMm>machine.maxThickness)problems.push('القطعة تتجاوز غلاف الماكينة.');
    if(op.tolerance<machine.minTolerance)problems.push('السماحة أضيق من دقة الماكينة المعتمدة.');
    if(['miter','bend'].includes(op.kind)&&op.angle>machine.maxAngle||op.kind==='bend'&&op.radius<machine.minBendRadius)problems.push('الزاوية أو نصف قطر الثني خارج القدرة.');
   }
   const margin=machine?.clampMargin||0,dx=op.kind==='drill'?op.diameter/2:op.kind==='mill'?op.length/2:0,dy=op.kind==='drill'?op.diameter/2:op.kind==='mill'?op.width/2:0;
   if(['drill','mill'].includes(op.kind)&&(x-dx<margin||x+dx>p.a-margin||y-dy<margin||y+dy>stockWidth-margin))problems.push('مساحة الثقب أو الجيب تتعدى حافة القطعة أو مساحة الماسك.');
   if(['drill','mill'].includes(op.kind)&&p.cutEnvelope){
    const edge=p.cutEnvelope,ys=[y-dy-margin,y+dy+margin];
    const leftAt=t=>edge.left[0]+(edge.left[1]-edge.left[0])*t/edge.width;
    const rightAt=t=>edge.right[0]+(edge.right[1]-edge.right[0])*t/edge.width;
    if(ys.some(t=>x-dx-margin<leftAt(t)-1e-6||x+dx+margin>rightAt(t)+1e-6))problems.push('موضع التشغيل يخرج من المادة بعد قص طرف القطاع بزاوية.');
   }
   if(op.kind==='bend'&&(x-op.radius<margin||x+op.radius>p.a-margin))problems.push('خط الثني أو نصف قطره خارج الجزء الحر.');
   if(op.kind==='scribe'&&(p.kind!=='panel'||!p.scribe?.points?.length))problems.push('عملية التشذيب تحتاج مسار الحشوة المرفوع المعتمد.');
   if(op.kind==='size'&&(p.kind!=='panel'||op.x!==0||op.y!==0||Math.abs(p.a-op.length)>.001||Math.abs(p.b-op.width)>.001))problems.push('طول وعرض عملية قص اللوح يجب أن يطابقا مستطيل القطعة من مرجع الصفر.');
   if(op.kind==='miter'&&op.x!==0)problems.push('حدّد طرف القطعة بقيمة إزاحة صفر للقص الزاوي.');
   const scope=p.unitId+' / '+p.label,errors=problems.map(e=>scope+' · '+e);issues.push(...errors);
   operations.push({unitId:p.unitId,sku:p.sku,part:p.label,kind:op.kind,count:p.count,machine:op.machine,station:out?op.provider:machine?.name||op.machine,
    reference:op.reference,datum:out?op.confirmation:machine?.datum||'',x,y,edge:op.xFrom,angle:op.angle,diameter:op.diameter,depth:op.depth,length:op.length,width:op.width,radius:op.radius,
    tolerance:op.tolerance,minutes:op.minutes,leadDays:op.leadDays,ok:!errors.length});
  }
 }
 return {operations,issues:[...new Set(issues)],unrouted};
}
export function candidateFinishDate(quote,catalog,start,workdays){
 if(!/^\d{4}-\d\d-\d\d$/.test(start)||!Array.isArray(workdays)||!workdays.length||!workdays.every(x=>Number.isInteger(x)&&x>=0&&x<=6))return {issues:['اختر تاريخًا وأيام تشغيل المصنع.']};
 const day=new Date(start+'T00:00:00Z');if(!Number.isFinite(+day)||day.toISOString().slice(0,10)!==start)return {issues:['التاريخ غير صالح.']};
 const issues=[...(quote.machineIssues||[]),...(quote.issues||[])],byMachine=new Map(),external=new Map(),plan=quote.operations||[];
 if(!catalog.approved)issues.push('اعتمد وصفات المصنع ومدة عملياته أولًا.');
 if(!plan.length||quote.unrouted?.length)issues.push('أكمل مسارات القطع وتوقيتاتها لحساب موعد تصنيع شامل.');
 let lead=0;
 for(const p of quote.purchases||[]){const i=catalog.items.find(x=>x.sku===p.sku);
  if(p.orderQty==null){issues.push('الرصيد غير محسوم للصنف '+p.sku);continue;}
  if(p.orderQty>0){if(i?.leadDays==null)issues.push('ينقص زمن توريد '+p.sku);else lead=Math.max(lead,i.leadDays);}
 }
 if(quote.worktopIncluded)issues.push('موعد السطح مرتبط بقالب الموقع ومورد السطح.');
 for(const op of plan){
  if(op.machine==='external'){if(op.leadDays==null)issues.push('ينقص موعد المورد '+op.station);else external.set(op.station,Math.max(external.get(op.station)||0,op.leadDays));continue;}
  const m=catalog.machining?.machines.find(x=>x.id===op.machine);if(!m||m.dailyMin==null||m.setupMin==null||op.minutes==null){issues.push('ينقص وقت الإعداد أو الدورة أو الطاقة اليومية في '+op.station);continue;}
  byMachine.set(m.id,(byMachine.get(m.id)||0)+m.setupMin+op.minutes*op.count);
 }
 if(issues.length)return {issues:[...new Set(issues)]};
 let work=0;for(const [id,min] of byMachine)work+=Math.ceil(min/catalog.machining.machines.find(m=>m.id===id).dailyMin);
 // Conservative serial work-centre allowance, same-day start after material
 // availability, procurement and subcontract lead in ordinary calendar days.
 for(const n of external.values())lead+=Math.ceil(n);if(lead+work>3650)return {issues:['أفق الخطة يتجاوز عشر سنوات.']};
 day.setUTCDate(day.getUTCDate()+Math.ceil(lead));
 while(!workdays.includes(day.getUTCDay()))day.setUTCDate(day.getUTCDate()+1);
 for(let n=1;n<work;n++){day.setUTCDate(day.getUTCDate()+1);while(!workdays.includes(day.getUTCDay()))day.setUTCDate(day.getUTCDate()+1);}
 return {issues:[],date:day.toISOString().slice(0,10),workdays:work,leadDays:lead};
}

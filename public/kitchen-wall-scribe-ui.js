import {drawingDXF,outputFilename} from './kitchen-drawing-output.js';
import {outputStamp} from './kitchen-output-stamp.js';
import {approveScribe,exactScribeScan,scribeDatum,scribeDXF,scribePiece} from './kitchen-wall-scribe.js';
import {roomArchitecture} from './kitchen-architecture.js';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opts=(values,chosen)=>values.map(([v,k])=>'<option value="'+e(v)+'" '+(v===chosen?'selected':'')+'>'+e(k)+'</option>').join('');
const select=(k,l,values,v)=>'<label>'+l+'<select name="'+k+'">'+opts(values,v)+'</select></label>';
const input=(k,l,v='',num=false)=>'<label>'+l+'<input required name="'+k+'" '+(num?'type="number" step="any"':'maxlength="160"')+' value="'+e(v)+'"></label>';
const values={minimumBlankMm:'أقل عرض لمستطيل الخام',maxStripMm:'أقصى عرض حشوة نهائي',minimumLipMm:'أقل عرض متين عند أي نقطة',roughAllowanceMm:'زيادة للتشذيب بعد فصل الخام',spacingMm:'أقصى مسافة بين محطتين مرفوعتين',cutToleranceMm:'سماحة قص المصنع ±',minGapMm:'أقل فراغ تركيب مسموح',targetGapMm:'فراغ التركيب المستهدف',maxGapMm:'أكبر فراغ تركيب مسموح'};
export function mountScribes(host,{getDoc,read,apply,update,download,focus={}}){
 let policy='',unit='',against='',recipe='',kind='end',side='start',band='',height=0,inset=0,selected=null;
 const selectRecord=r=>{unit=r.unitId;against=r.against;recipe=r.recipe;kind=r.kind;side=r.side;band=r.band||'';height=r.plinthHeightMm;inset=r.insetMm;selected=r;};
 // A source link names one saved measured template. Never guess when an old
 // anchor, another wall, or duplicate records prevent a unique match.
 if(focus.wall&&focus.anchor&&focus.unitId){
  const rows=(getDoc().room.workshop?.options?.[focus.wall]?.scribes||[]).filter(r=>r.unitId===focus.unitId&&r.anchor===focus.anchor);
  if(rows.length===1)selectRecord(rows[0]);
 }
 const notify=s=>{const n=host.querySelector('[data-scribe-status]');if(n)n.textContent=s;};
 function context(){
  const doc=getDoc(),c=read(),units=doc.kitchen.units.filter(u=>doc.kitchen.runs.find(r=>r.id===u.runId)?.wall);
  unit=units.some(u=>u.id===unit)?unit:units[0]?.id||'';
  const u=units.find(q=>q.id===unit),run=doc.kitchen.runs.find(r=>r.id===u?.runId),wall=run?.wall,walls=roomArchitecture(doc.room).walls.filter(w=>w.id!==wall);
  against=walls.some(w=>w.id===against)?against:walls[0]?.id||'';
  const book=c.scribePolicies||{},recipes=Object.entries(book);recipe=book[recipe]?recipe:recipes[0]?.[0]||'';
  return {doc,c,units,wall,walls,book,recipes};
 }
 const trace=()=>({unitId:unit,against,recipe,kind,side,insetMm:inset,plinthHeightMm:height,...(band?{band}:{})});
 function draw(){
  const {doc,c,units,wall,walls,book,recipes}=context(),r=book[policy],record=selected;
  const a=unit&&against&&recipe&&scribeDatum(doc,wall,trace(),c);
  const rows=Object.entries(doc.room.workshop?.options||{}).flatMap(([w,o])=>(o.scribes||[]).map((row,index)=>({w,row,index})));
  const bands=(doc.room.workshop?.wallProfiles?.bands||[]).filter(b=>b.wall===against&&b.review);
  const ps=c.items.filter(i=>i.kind==='panel'),machines=(c.machining?.machines||[]).filter(m=>['size','scribe'].every(op=>m.ops.includes(op)));
  host.innerHTML='<h3>حشوة تنسخ تعرّج الجدار عند طرف الوحدة</h3><p>قطعة رأسية مسطحة من لوح واحد. يقاس عرضها أفقيًا من الحافة المستقيمة للوحدة إلى وجه الجدار المقابل عند ارتفاعات معلومة. المقاسات بالملليمتر.</p>'+
   '<details><summary>وصفات المصنع للحشوات المرسومة</summary>'+select('policy','وصفة المصنع',[['','إنشاء وصفة'],...recipes.map(([k,v])=>[k,v.name])],policy)+'<form data-scribe-form="policy"><div class="kw-grid">'+input('id','رمز فريد لاتيني',policy)+input('name','الاسم',r?.name)+input('reference','رسم ومراجعة المصنع',r?.reference)+select('sku','اللوح الفعلي',ps.map(i=>[i.sku,i.name+' · '+i.sku]),r?.sku)+select('grain','محور طول الخام',[['vertical','مع ارتفاع الحشوة'],['horizontal','مع عرض الحشوة']],r?.grain)+Object.entries(values).map(([k,l])=>input(k,l,r?.[k],true)).join('')+select('machine','ماكينة لقص المستطيل وتشذيب المحيط',[['','لم يحدد المصنع مسارًا'],...machines.map(m=>[m.id,m.name])],r?.machine||'')+'</div><p>يضيف الحصر عرض الشفرة المحدد للصنف إلى زيادة التشذيب. فصل مستطيل الخام من اللوح يُحسب في مخطط قص المخزون.</p><button>حفظ وصفة الحشوة</button></form></details>'+
   (units.length&&recipes.length?'<h4>تحديد مستوى القياس</h4><div class="kw-grid">'+select('unit','الوحدة',units.map(v=>[v.id,v.id+' · '+v.kind]),unit)+select('recipe','وصفة الحشوة',recipes.map(([k,v])=>[k,v.name]),recipe)+select('against','الجدار المقابل',walls.map(v=>[v.id,v.label]),against)+select('side','طرف الوحدة',[['start','طرف البداية بمحور الصف'],['end','طرف النهاية بمحور الصف']],side)+select('kind','موضوع التفصيل',[['end','حشوة بارتفاع جسم الدولاب'],['plinth','طرف الوزرة السفلي']],kind)+(kind==='plinth'?input('height','ارتفاع الوزرة من الأرض النهائية',height,true)+input('inset','ارتداد واجهة الوزرة عن واجهة الجسم',inset,true):'')+select('band','شريحة مسح موثقة إن وُجدت',[['','قراءات مباشرة عند هذه الحافة'],...bands.map(v=>[v.id,v.id+' · '+v.review.ref])],band)+'</div>'+
   (a?.ok?'<p>فجوة الرسم إلى الجدار '+e(a.nominal)+' مم · ارتفاع البداية عن الأرض '+e(a.low)+' مم · آخر محطة '+e(a.span)+' مم · موضع التماس على الجدار من بدايته '+e(a.along)+' مم.</p><form data-scribe-form="trace"><label>في كل سطر اكتب ارتفاع المحطة من بداية الحشوة ثم الإزاحة عن خط الجدار المرسوم. الموجب بروز باتجاه الوحدة والسالب ابتعاد.<textarea dir="ltr" name="points" rows="6" required placeholder="0, +2.5">'+e(record?.stations.map(p=>p.join(', ')).join('\n')||'')+'</textarea></label>'+(band?'<button type="button" data-scribe-act="scan">جلب النقاط المنطبقة على خط التماس</button>':'')+input('accuracy','هامش خطأ القياس الفعلي ± مم',record?.accuracyMm,true)+input('reference','مرجع الرفع الميداني',record?.reference)+input('reviewer','الفني المعتمد',record?.reviewer)+'<label><input type="checkbox" name="verified" required> تحققت في الموقع من الحافة ومن كامل سماكة اللوح، ومن استقامة الجزء بين كل محطتين. سجلت الطرفين وكل نقطة تغير.</label><button>اعتماد قالب الحشوة لهذه الوحدة</button></form>':'<p>'+e(a?.reason)+'</p>'):'<p>بعد حفظ وصفة المصنع ووضع وحدة في صف جداري يظهر نموذج الرفع.</p>')+
   '<h4>الحشوات المحفوظة</h4>'+rows.map(({w,row,index})=>{const g=scribePiece(doc,w,row,c),shape=g.ok?g.part.scribe:null;
   return '<article class="ws-card"><b>'+e(row.unitId+' · '+row.reference)+'</b><p>'+(shape?'غلاف الخام '+e(shape.blankWidthMm)+' × '+e(shape.blankHeightMm)+' مم · أقصى عرض تشطيب '+e(shape.finishedWidthMm)+' مم · '+shape.points.length+' رؤوس.':e(g.reason))+'</p><div data-wall="'+e(w)+'" data-index="'+index+'"><button type="button" data-scribe-act="edit">فتح القياسات</button> '+(g.ok?'<button type="button" data-scribe-act="dxf">تنزيل المحيط النهائي DXF للمراجعة بالملليمتر</button>':'')+' <button type="button" data-scribe-act="remove">إزالة من المشروع</button></div></article>';}).join('')+'<p data-scribe-status role="status"></p>';
 }
 host.onchange=ev=>{const t=ev.target,k=t.name,v=t.value;
  if(k==='policy')policy=v;else if(k==='unit')unit=v;else if(k==='against'){against=v;band='';}else if(k==='recipe')recipe=v;else if(k==='kind'){kind=v;if(kind==='end'){height=0;inset=0;}}else if(k==='side')side=v;else if(k==='height')height=Number(v);else if(k==='inset')inset=Number(v);else if(k==='band')band=v;else return;
  selected=null;draw();
 };
 host.onsubmit=ev=>{
  ev.stopPropagation();ev.preventDefault();const f=ev.target,data=Object.fromEntries(new FormData(f));
  if(f.dataset.scribeForm==='policy'){
   if(data.id!==policy&&Object.hasOwn(read().scribePolicies||{},data.id)){notify('رمز الوصفة مستخدم.');return;}
   const p={name:data.name,reference:data.reference,sku:data.sku,grain:data.grain,...Object.fromEntries(Object.keys(values).map(k=>[k,Number(data[k])])),...(data.machine?{machine:data.machine}:{})};
   if(!update(c=>{c.scribePolicies={...c.scribePolicies,[data.id]:p};})){notify('راجع حدود الوصفة واكتمال الصنف والسماحات.');return;}
   policy=data.id;draw();
  }else{
   const {doc,c,wall}=context(),stations=data.points.trim().split(/\r?\n/).map(line=>line.trim().split(/[,،\s]+/).map(Number));
   const checked=approveScribe(doc,wall,{...trace(),linearVerified:data.verified==='on',accuracyMm:Number(data.accuracy),reference:data.reference,reviewer:data.reviewer,stations},c);
   if(!checked.ok){notify(checked.reason);return;}
   const result=apply(checked.doc,'حُفظت حشوة الوحدة وقطعتها.');if(result?.ok===false){notify(result.reason);return;}selected=null;draw();notify('حُفظت القراءة ومسارها وأضيف مستطيلها إلى حصر الوحدة.');
  }
 };
 host.onclick=ev=>{const button=ev.target.closest('[data-scribe-act]');if(!button)return;
  const {doc,wall,c}=context(),a=button.dataset.scribeAct;
  if(a==='scan'){const q=exactScribeScan(doc,wall,trace(),c);if(!q.ok){notify(q.reason);return;}host.querySelector('[name="points"]').value=q.stations.map(p=>p.join(', ')).join('\n');return;}
  const {wall:w,index}=button.parentElement.dataset,o=doc.room.workshop.options[w],r=o?.scribes?.[Number(index)];if(!r)return;
  if(a==='edit'){selectRecord(r);draw();}
  if(a==='dxf'){const g=scribePiece(doc,w,r,c);if(g.ok){const stamp=outputStamp(doc,r.unitId+' · '+w,'قالب الحشوة المقاسة');download(drawingDXF(scribeDXF(g.part),stamp),outputFilename(stamp,'scribe-'+r.unitId+'-'+r.kind+'-'+r.side,'dxf'),'application/dxf');}}
  if(a==='remove'){const ws=doc.room.workshop;apply({...doc,room:{...doc.room,workshop:{...ws,options:{...ws.options,[w]:{...o,scribes:o.scribes.filter((_,j)=>j!==Number(index))}}}}},'أزيلت الحشوة.');selected=null;draw();}
 };draw();
}

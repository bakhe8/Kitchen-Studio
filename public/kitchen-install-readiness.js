import {ownKey,inheritedName} from './kitchen-safe-keys.js';
import {kitchenGeometry} from './kitchen-model.js';
import {offlineDigest} from './kitchen-workshop-revision.js';

export const workKinds={receipt:'وصول جهاز أو ملحق يورّده العميل',finish:'إضافة أو استبدال تشطيب',remove:'إزالة عنصر قائم',relocate:'نقل عنصر أو خدمة'};
export const routeKinds={door:'باب أو فتحة مرور',corridor:'ممر مستقيم',lift:'حجرة مصعد',turn:'منعطف بزاوية قائمة'};
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,80}$/.test(v)&&!inheritedName(v);
const ref=(s,max=160)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
const date=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
const pos=(x,max=30000)=>Number.isFinite(x)&&x>0&&x<=max;
const mm=(x,max=30000)=>Number.isFinite(x)&&x>=0&&x<=max;
const eq=s=>s.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const digest=obj=>offlineDigest(new TextEncoder().encode(JSON.stringify(obj,(_,v)=>plain(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0)):v)));
function cleanRoute(r){
 if(!plain(r)||!id(r.id)||!id(r.unitId)||!ref(r.source)||!ref(r.name)||!['assembled','section'].includes(r.mode)||!['normal','quarter','either'].includes(r.entry)||!mm(r.margin,1000)||!mm(r.padding,1000)||r.mass!=null&&!pos(r.mass,20000)||!Array.isArray(r.stations)||r.stations.length<1||r.stations.length>32)return null;
 const copy={id:r.id,unitId:r.unitId,source:r.source.trim(),name:r.name.trim(),mode:r.mode,entry:r.entry,margin:r.margin,padding:r.padding,mass:r.mass??null};
 if(r.mode==='section'){if(!ref(r.drawing)||!Array.isArray(r.sizes)||r.sizes.length!==3||!r.sizes.every(x=>pos(x)))return null;copy.drawing=r.drawing.trim();copy.sizes=[...r.sizes];}
 copy.stations=[];
 for(const s of r.stations){if(!plain(s)||!ownKey(routeKinds,s.kind)||!ref(s.label)||!pos(s.width)||!pos(s.height))return null;
  const x={kind:s.kind,label:s.label.trim(),width:s.width,height:s.height};
  if(['turn','lift'].includes(s.kind)){if(!pos(s.depth))return null;x.depth=s.depth;}
  if(s.kind==='lift'){if(s.capacity!=null&&!pos(s.capacity,50000))return null;x.capacity=s.capacity??null;}
  if(s.kind==='turn'&&s.manoeuvre){if(!ref(s.manoeuvre,300)||s.reviewer!=null&&s.reviewer!==''&&!ref(s.reviewer))return null;x.manoeuvre=s.manoeuvre.trim();if(s.reviewer)x.reviewer=s.reviewer.trim();}
  copy.stations.push(x);
 }
 return copy;
}
function cleanWork(r){
 if(!plain(r)||!id(r.id)||!id(r.unitId)||!ownKey(workKinds,r.kind)||!['cut','install'].includes(r.phase)||!ref(r.name)||!ref(r.trade)||!ref(r.planRef)||!date(r.due)||
 !Array.isArray(r.checks)||r.checks.length<1||r.checks.length>12)return null;
 const keys=new Set(),checks=[];
 for(const q of r.checks){if(!plain(q)||!ref(q.label,80)||keys.has(eq(q.label))||!Number.isFinite(q.target)||Math.abs(q.target)>30000||!mm(q.tolerance,2000))return null;
  keys.add(eq(q.label));checks.push({label:q.label.trim(),target:q.target,tolerance:q.tolerance});}
 const d={id:r.id,unitId:r.unitId,kind:r.kind,phase:r.phase,name:r.name.trim(),trade:r.trade.trim(),planRef:r.planRef.trim(),due:r.due,checks};
 if(r.kind==='receipt'){if(!ref(r.model))return null;d.model=r.model.trim();}
 if(r.finish!=null){
  const q=r.finish;if(r.kind!=='finish'||!plain(q)||!['width','height','depth'].includes(q.axis)||![q.currentClear,q.required].every(x=>pos(x))||![q.add,q.remove,q.tolerance].every(x=>mm(x))||q.add===0&&q.remove===0||q.currentClear+q.remove<=q.add)return null;
  d.finish={axis:q.axis,currentClear:q.currentClear,required:q.required,add:q.add,remove:q.remove,tolerance:q.tolerance};
 }
 if(r.change!=null){
  const q=r.change;if(!['remove','relocate'].includes(r.kind)||!plain(q)||!id(q.feature)||!id(q.wall)||!ref(q.kind)||![q.originalStation,q.originalBottom].every(x=>mm(x)))return null;
  d.change={feature:q.feature,kind:q.kind,wall:q.wall,originalStation:q.originalStation,originalBottom:q.originalBottom};
  if(r.kind==='relocate'){if(![q.plannedStation,q.plannedBottom,q.tolerance].every(x=>mm(x)))return null;Object.assign(d.change,{plannedStation:q.plannedStation,plannedBottom:q.plannedBottom,tolerance:q.tolerance});}
 }
 if(r.proof){const p=r.proof;
  if(!plain(p)||!ref(p.by)||!ref(p.ref)||!date(p.date)||!Array.isArray(p.actual)||p.actual.length!==checks.length||!p.actual.every(x=>Number.isFinite(x)&&Math.abs(x)<=30000)||!/^i-[0-9a-f]{64}$/.test(p.key)||r.kind==='receipt'&&!ref(p.model))return null;
  if(d.finish&&!pos(p.finishedClear))return null;
  d.proof={by:p.by.trim(),ref:p.ref.trim(),date:p.date,actual:[...p.actual],key:p.key,...(r.kind==='receipt'?{model:p.model.trim()}:{}),...(d.finish?{finishedClear:p.finishedClear}:{})};
 }
 return d;
}
export function cleanInstallReadiness(raw){
 if(!plain(raw)||!Array.isArray(raw.routes)||raw.routes.length>256||!Array.isArray(raw.dependencies)||raw.dependencies.length>512)return null;
 const group=(arr,fn)=>{const ids=new Set();const result=[];for(const row of arr){const r=fn(row);if(!r||ids.has(r.id))return null;ids.add(r.id);result.push(r);}return result;};
 const routes=group(raw.routes,cleanRoute),dependencies=group(raw.dependencies,cleanWork);
 return routes&&dependencies?{routes,dependencies}:null;
}
const dims=n=>Math.round(n*1000)/1000;
function unitData(doc,id,geo){
 const unit=geo.units.find(u=>u.id===id),run=unit&&geo.runs.find(r=>r.id===unit.runId);
 return unit&&run?{sizes:[unit.width*10,unit.depth*10,unit.height*10].map(dims),signature:[id,unit.kind,run.wall,unit.runId,unit.bottom,unit.height,unit.depth,unit.width,unit.polygon.map(p=>[p.x,p.z]),doc.room.height,doc.room.workshop?.chains?.[run.wall]?.rows]}:null;
}
function planKey(doc,r,geo){
 const def={...r};delete def.proof;
 const unit=unitData(doc,r.unitId,geo);return unit?'i-'+digest([def,unit.signature]):'';
}
export function linkInstallChange(doc,r,featureId,work={}){
 const feature=doc.kitchen.features.find(x=>x.id===featureId),u=doc.kitchen.units.find(x=>x.id===r.unitId),run=u&&doc.kitchen.runs.find(x=>x.id===u.runId);
 if(!feature||!run||feature.wall!==run.wall||!['remove','relocate'].includes(r.kind))return {ok:false,reason:'اختر عائقًا أو خدمة موجودة على جدار الوحدة المرتبطة.'};
 const change={feature:feature.id,kind:feature.kind,wall:feature.wall,originalStation:feature.u*10,originalBottom:feature.bottom*10};
 if(r.kind==='relocate')Object.assign(change,{plannedStation:work.plannedStation,plannedBottom:work.plannedBottom,tolerance:work.tolerance});
 const copy={...r,change};delete copy.proof;const record=cleanWork(copy);
 return record?{ok:true,record}:{ok:false,reason:'راجع مقاسات الهدف ومرجع التغيير.'};
}
export function certifyInstallDependency(doc,raw,evidence){
 const without={...raw};delete without.proof;const r=cleanWork(without);if(!r)return {ok:false,reason:'راجع مسؤول البند ومرجعه والقياسات المستهدفة.'};
 const geo=kitchenGeometry(doc.kitchen,doc.room),key=planKey(doc,r,geo);if(!key)return {ok:false,reason:'الوحدة المرتبطة غير موجودة.'};
 const record=cleanWork({...r,proof:{...evidence,key}});return record?{ok:true,record}:{ok:false,reason:'أكمل القيم الفعلية واسم المسؤول وتاريخ التنفيذ ومرجع الإثبات.'};
}
function evalWork(doc,r,geo){
 if(!r.proof){const notes=['ينتظر إثبات الإنجاز وإعادة القياس.'];if(r.finish){const q=r.finish,x=q.currentClear+q.remove-q.add;if(x<q.required)notes.push('الصافي المتوقع بعد التشطيب '+dims(x)+' مم، والعجز '+dims(q.required-x)+' مم.');}return notes;}
 if(r.proof.key!==planKey(doc,r,geo))return ['تغيّر الموضع أو مواصفة الطلب بعد الإثبات. أعد مطابقة النتيجة.'];
 const notes=[];
 // The proof date is typed in the technician's calendar (UTC+3 here) while this also runs on the server in UTC, so a proof
 // dated "today" read as tomorrow between 00:00 and 03:00 local time and blocked release, packing and installation.
 // One day of slack covers every zone ahead of UTC and still rejects genuinely future dates.
 if(r.proof.date>new Date(Date.now()+864e5).toISOString().slice(0,10))notes.push('تاريخ إثبات التنفيذ أو الاستلام لاحق لليوم.');
 if(r.finish){const f=r.finish,projected=f.currentClear+f.remove-f.add;if(r.proof.finishedClear<f.required)notes.push('صافي التركيب الفعلي ينقصه '+dims(f.required-r.proof.finishedClear)+' مم.');
  if(Math.abs(r.proof.finishedClear-projected)>f.tolerance)notes.push('الصافي بعد التشطيب يختلف عن المتوقع خارج السماحية. حدّث التصميم والرفع.');}
 if(r.change){const f=doc.kitchen.features.find(f=>f.id===r.change.feature),c=r.change;
  if(r.kind==='remove'&&f)notes.push('لا يزال العنصر المطلوب إزالته موجودًا في الرسم المقاس.');
  if(r.kind==='relocate'&&(!f||f.wall!==c.wall||f.kind!==c.kind||Math.abs(f.u*10-c.plannedStation)>c.tolerance||Math.abs(f.bottom*10-c.plannedBottom)>c.tolerance))notes.push('موضع العنصر في الرسم الحالي لا يطابق الموضع المطلوب بعد النقل.');}
 if(r.kind==='receipt'&&eq(r.model)!==eq(r.proof.model))notes.push('موديل القطعة المستلمة يختلف عن الموديل المطلوب.');
 r.checks.forEach((c,i)=>{const gap=dims(Math.abs(c.target-r.proof.actual[i])-c.tolerance);if(gap>0)notes.push(c.label+' خارج السماحية بـ '+gap+' مم.');});
 return notes;
}
export function evaluateInstallRoute(doc,r,geo=kitchenGeometry(doc.kitchen,doc.room)){
 const unit=unitData(doc,r.unitId,geo);if(!unit)return {ok:false,issues:['الوحدة غير موجودة.']};
 const sizes=(r.mode==='assembled'?unit.sizes:r.sizes).map(x=>x+2*r.padding);
 const [w,d,h]=sizes,margin=2*r.margin;let reachable=r.entry==='either'?[0,1]:[r.entry==='normal'?0:1];const results=[];
 for(const s of r.stations){
  const issues=[],allowed=[];
  if(h+margin>s.height)issues.push('عجز الارتفاع '+dims(h+margin-s.height)+' مم');
  const fits=(rot,depth)=>{const a=rot?d:w,b=rot?w:d;return a+margin<=s.width&&(!depth||b+margin<=s.depth);};
  for(const rot of reachable){
   if(s.kind==='turn'){
    if(!fits(rot,true)||!fits(1-rot,true))continue;
    // Continuous in-place rotation of a rigid upright rectangle inside an empty measured landing.
    if(Math.hypot(w,d)+margin<=Math.min(s.width,s.depth)||(ref(s.manoeuvre,300)&&ref(s.reviewer)))allowed.push(1-rot);
   }else if(fits(rot,s.kind==='lift'))allowed.push(rot);
  }
  if(!allowed.length)issues.push(s.kind==='turn'?'لم يثبت دوران الحزمة في البسطة. يلزم تعديل المسار أو توثيق طريقة مرور بديلة تحقق وضعي البداية والنهاية واسم المراجع.':'لا يوجد اتجاه متصل يجتاز العرض أو العمق المقاس.');
  if(s.kind==='lift'){if(s.capacity===null||r.mass===null)issues.push('حمولة المصعد الفعلية أو وزن الحزمة مع وسائل المناولة مجهول.');
   else if(r.mass>s.capacity)issues.push('تتجاوز الحمولة المتاحة الموثقة بـ '+dims(r.mass-s.capacity)+' كجم.');}
  results.push({station:s.label,issues});if(issues.length)break;reachable=[...new Set(allowed)];
 }
 const issues=results.flatMap(s=>s.issues.map(t=>s.station+' · '+t));return {ok:!issues.length,issues,sizes,results};
}
export function installReadinessIssues(doc,scope,phase='cut'){
 const raw=doc.room?.workshop?.installReadiness;if(!raw)return [];
 const state=cleanInstallReadiness(raw);if(!state)return ['سجل الجاهزية غير صالح.'];
 const sel=scope&&new Set(scope.unitIds),relevant=r=>!sel||sel.has(r.unitId);const errors=[],geo=kitchenGeometry(doc.kitchen,doc.room);
 for(const r of state.dependencies.filter(relevant))if(r.phase==='cut'||phase==='install'&&r.phase==='install')errors.push(...evalWork(doc,r,geo).map(v=>r.name+' · '+v));
 if(phase==='ship'||phase==='install')for(const r of state.routes.filter(relevant))errors.push(...evaluateInstallRoute(doc,r,geo).issues.map(v=>r.name+' · '+v));
 return [...new Set(errors)];
}
export function installReadinessKey(doc,ids){
 const state=doc.room.workshop?.installReadiness;if(!state)return '';if(!ids)return digest(state);
 const keep=r=>ids.includes(r.unitId);return digest([state.dependencies.filter(keep),state.routes.filter(keep)]);
}
export function installJobIssues(released,current,unitId,phase){
 const before=released.room.workshop?.installReadiness||{routes:[],dependencies:[]},after=current.room.workshop?.installReadiness||{routes:[],dependencies:[]};
 const pick=r=>r.unitId===unitId,errors=[];
 const dueInPhase=r=>pick(r)&&(r.phase==='cut'||phase==='install');
 for(const def of before.dependencies.filter(dueInPhase)){const newer=after.dependencies.find(q=>q.id===def.id&&pick(q));if(!newer){errors.push('بند سابق مطلوب للدفعة لم يعد مربوطًا بالوحدة: '+def.name);continue;}
  const a={...def},b={...newer};delete a.proof;delete b.proof;if(digest(a)!==digest(b))errors.push('تغيرت المواصفة المعتمدة لبند '+def.name+'؛ راجع أمر التغيير قبل استخدام الإثبات اللاحق.');}
 for(const r of before.routes.filter(pick))if(!after.routes.some(q=>q.id===r.id&&pick(q)))errors.push('لم تُوثّق معاودة التحقق من مسار نقل '+r.name+'.');
 if((before.routes.some(pick)||after.routes.some(pick)||before.dependencies.some(pick)||after.dependencies.some(pick))&&
 digest(unitData(released,unitId,kitchenGeometry(released.kitchen,released.room))?.signature.slice(0,-1)||null)!==digest(unitData(current,unitId,kitchenGeometry(current.kitchen,current.room))?.signature.slice(0,-1)||null))
  errors.push('أبعاد الوحدة الحالية تختلف عن الوحدة المصنّعة في الإيصال.');
 return [...new Set([...errors,...installReadinessIssues(current,{unitIds:[unitId]},phase)])];
}

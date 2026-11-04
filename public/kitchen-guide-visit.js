// Compute the next field/brief decisions from the live drawing and the scoped
// customer record. A draft layout is allowed before on-site attestation.
import {roomArchitecture} from './kitchen-architecture.js';
import {resolveChain,surveyedDesignRange,attestChain} from './kitchen-chain-model.js';
import {applyWallOptions,readWallOptions} from './kitchen-chain-options.js';
import {projectDecisions,updateDecisionReview,existingDeviceListKey,confirmExistingDeviceList} from './kitchen-project-decisions.js';
import {applianceIntakeStatus,applianceFamilyOptions} from './kitchen-appliance-intake.js';
import {pantryRequests,pantryDecisionItems} from './kitchen-pantry-brief.js';
import {evaluatePipeRoutes} from './kitchen-pipe-routes.js';
import {kitchenRunLocal} from './kitchen-model.js';
import {buildAssistant} from './kitchen-assist-engine.js';

const task=(id,stage,actor,step,focus,question,why,priority,blocking=true)=>({id:'visit.'+id,stage,actor,step,focus,question,why,priority,blocking});
const axes=['width','height','depth'];
const dimensions={width:'العرض',height:'الارتفاع',depth:'العمق'};
const kitchenPresent=doc=>doc?.room&&Array.isArray(doc?.kitchen?.runs)&&Array.isArray(doc.kitchen.units)&&Array.isArray(doc.kitchen.features);

function wallQuestion(doc,wall,range){
 const w=doc.room.workshop||{},chain=w.chains?.[wall.id],label=wall.label,focus={wall:wall.id};
 if(!chain?.rows?.length)return task('survey.'+wall.id,'survey','rep','survey',focus,'أين تبدأ الدواليب وأين تنتهي على '+label+'؟','سجّل المسافة من الركن إلى طرف البرواز أو التجهيز، ثم حدّد نهاية الدواليب أو ركن نهاية الجدار.',5);
 const solved=resolveChain(doc.room,wall.id,chain);
 if(!solved.ok)return task('survey.'+wall.id,'survey','rep','survey',focus,'أي قياس يحتاج تصحيحًا على '+label+'؟',solved.reason,5);
 if(!chain.rows.some(r=>r.kind==='corner'||r.kind==='stop'))return task('survey.'+wall.id,'survey','rep','survey',focus,'إلى أين يصل الصف على '+label+'؟','القياسات السابقة محفوظة. أضف نهاية الدواليب المطلوبة أو أغلق الجدار عند الركن.',6);
 if(!range)return task('survey.'+wall.id,'survey','rep','survey',focus,'هل تطابق قياسات '+label+' العناصر على الرسم؟','تغيّر عنصر أو أزيل من الرسم بعد الرفع. طابق القياسات قبل توزيع الوحدات.',6);
 return null;
}
function deviceQuestion(doc,r,designed){
 const field=(name,axes)=>({requestId:r.id,field:name,...(axes?{axes}:{})});
 if(!r.model)return task('device.'+r.id,'survey','customer','intake',field('model'),'ما موديل '+r.name+' الذي سيورّده العميل؟','رقم الموديل يحدد دليل التركيب والحيز الذي سنحجزه في التصميم.',22);
 if(!r.manual)return task('device.'+r.id,'survey','supplier','intake',field('manual'),'أين دليل تركيب '+r.name+' للموديل '+r.model+'؟','تؤخذ أبعاد حيز التركيب وخلوصه من مرجع الموديل.',23);
 for(const [part,label] of [['body','جسم الجهاز'],['space','حيز التركيب']]){
  const missing=axes.filter(k=>r[part]?.[k]==null);
  if(missing.length)return task('device.'+r.id,'survey','rep','intake',field(part,missing),'كم يبلغ '+missing.map(k=>dimensions[k]).join(' و')+' في '+label+' لـ'+r.name+'؟','أدخل الأبعاد الناقصة فقط بالملليمتر من دليل '+r.model+'.',24);
 }
 const status=applianceIntakeStatus(doc,r);
 if(status.ok)return null;
 const short=axes.filter(k=>r.space[k]<r.body[k]);
 if(short.length)return task('device.'+r.id,'survey','rep','intake',field('space',short),'هل يطابق حيز '+r.name+' مقاسات الموديل؟',status.reason,24);
 if(r.placement==='bay'&&!applianceFamilyOptions(doc,r).length)return task('device.'+r.id,'design','factory','factory',{tab:'recipes'},'ما وصفة المصنع التي تستوعب '+r.name+'؟','مقاسات '+r.model+' محفوظة. يلزم حيز مصنع مناسب لها كي يستطيع البرنامج حجز موضعه.',33);
 // A complete, unplaced device is an input the automatic layout consumes.
 if(!r.host&&!designed)return null;
 return task('device.'+r.id,'design','rep','intake',field('host'),'أين يُحجز '+r.name+' في الرسم؟',status.reason,35);
}
function pantryQuestions(doc,chosen){
 const issues=pantryDecisionItems(doc),out=[];
 for(const req of pantryRequests(doc)){
  const item=issues.find(x=>x.id==='pantry:'+req.id);
  if(item?.focus.wall&&!chosen.includes(item.focus.wall))continue;
  const entityId='pantry:'+req.id,assistant=buildAssistant(doc,'customer',{entityId});
  const q=assistant.questions[0];
  if(q&&req.choice!=='none'){
   out.push(task('pantry.'+req.id,'survey',q.verification==='documented'?'supplier':'customer','assist',{topic:'customer',entityId,questionId:q.id},q.label,'طلب تخزين الأرز مسجّل. تُستخدم الإجابة لتحديد الحجم أو التجهيز لهذا الطلب.',29));
  }else if(item?.open&&(item.focus.runId||doc.kitchen.units.length)){
   out.push(task('pantry.'+req.id,'design','rep','row',item.focus,'أي وحدة تطابق طلب تخزين الأرز '+req.id+'؟',item.value,40));
  }
 }
 return out;
}
function cornerIntent(doc,joint,unassigned){
 const ids=[...new Set((doc.room.fieldRegister?.records||[]).filter(r=>r.inputCode==='CAT-14'&&r.execution!=='excluded').map(r=>r.itemId))];
 const id=ids.includes(joint)?joint:unassigned&&ids.length===1&&ids[0]==='ركن-المطبخ'?ids[0]:null;
 if(!id)return null;
 const s=buildAssistant(doc,'customer',{entityId:'corner:'+id}).answers.find(q=>q.id==='corner-tiers');
 return s?.evidence.state==='known'?s.evidence.value:null;
}
export function guidedVisit(doc,ctx={}){
 if(!kitchenPresent(doc))return [task('room','survey','rep','survey',{},'ما مقاسات غرفة المطبخ؟','ابدأ برفع الغرفة لربط كل قياس بالجدار الصحيح.',1)];
 const w=doc.room.workshop||{},review=w.decisionReview,physical=roomArchitecture(doc.room).walls,wallSet=new Set(physical.map(p=>p.id));
 const designWalls=[...new Set(doc.kitchen.runs.map(r=>r.wall).filter(id=>wallSet.has(id)))];
 const drawn=doc.kitchen.units.length>0,selected=ctx.wallIds??(review?.active?review.walls:null);
 const started=Object.keys(w.chains||{}).filter(id=>wallSet.has(id));
 const inferred=drawn?designWalls:started.length?started:[wallSet.has(w.activeWall)?w.activeWall:physical[0]?.id];
 const chosen=[...new Set(selected??inferred)].filter(id=>wallSet.has(id));
 const out=[],ranges=new Map();
 for(const wall of chosen){
  const p=physical.find(v=>v.id===wall),range=surveyedDesignRange(doc,wall);
  if(range)ranges.set(wall,range);
  const gap=wallQuestion(doc,p,range);if(gap)out.push(gap);
  if(!range)continue;
  const chain=w.chains[wall],proof=chain.attestation;
  const fresh=proof&&chain.source==='field'&&attestChain(doc,wall,chain,proof).chain?.attestation.key===proof.key;
  if(!fresh)out.push(task('proof.'+wall,'release','rep','survey',{wall,proof:true},'من تحقّق من رفع '+p.label+' في الموقع؟','يُستعمل الرفع للمقترح الأولي. يلزم مرجع الزيارة واسم الفني لاعتماد قياسات هذا الجدار للتصنيع.',68));
 }
 if(!selected&&!drawn&&ranges.size){
  out.push(task('scope','survey','customer','decisions',{chooseWalls:true},'على أي جدران يريد العميل دواليب؟','اختر الجدران الجاهزة للتوزيع من الرفع. تُستبعد بقية الجدران من أسئلة هذا التصميم.',10));
 }
 if(!ranges.size&&!drawn)return out;
 // A blank project needs one intentional scope before branching into individual questions.
 if(!selected&&!drawn)return out;
 const included=id=>chosen.includes(id);
 const decisionDoc={...doc,room:{...doc.room,workshop:{...w,decisionReview:{active:true,walls:chosen,noCorners:review?.noCorners||[],noCustomerDevices:review?.noCustomerDevices||false,...(review?.existingDeviceListKey?{existingDeviceListKey:review.existingDeviceListKey}:{})}}}};
 if(review?.active||!drawn){
  const decisionGaps=projectDecisions(decisionDoc).missing;
  for(const dec of decisionGaps){
   const {id,focus,value}=dec;
   if(id.startsWith('measure:')||id.startsWith('pantry:')||id==='devices'||focus.wall&&!ranges.has(focus.wall))continue;
   if(id.startsWith('corner:')&&!focus.joint.split('+').every(k=>ranges.has(k)))continue;
   const wall=physical.find(p=>p.id===focus.wall)?.label||'';
   if(id.startsWith('upper:'))out.push(task('upper.'+focus.wall,'design','customer',dec.step,{...focus,op:'mode'},'كيف ينتهي الصف العلوي على '+wall+'؟','الارتفاع المختار يحدد امتداد العلوي إلى السقف أو الفراغ فوقه، أو استبعاده.',41));
   if(id.startsWith('cornice:')&&w.options?.[focus.wall]?.decisions?.upper)out.push(task('cornice.'+focus.wall,'design','customer',dec.step,{...focus,op:'cornice/enabled'},'هل يريد العميل كورنيشًا أعلى الدواليب على '+wall+'؟','يؤثر الكورنيش في الحيز أعلى الصف والحصر.',44));
   if(id.startsWith('feature:'))out.push(task('feature.'+id.slice(8),'design','customer',dec.step,{...focus,featureId:id.slice(8)},'ما اختيار العميل بخصوص '+dec.name+'؟','هذا العنصر موجود في الرسم. يحدد الاختيار الخلوص والتوريد حوله.',43));
   if(id.startsWith('corner:')){
    const intent=cornerIntent(doc,focus.joint,decisionGaps.filter(q=>q.id.startsWith('corner:')).length===1);
    if(intent)out.push(task('corner.'+focus.joint,'survey','rep','corner',{...focus,cornerIntent:intent},'هل يطبّق اختيار المقابلة على '+dec.name+'؟','اختار العميل «'+({none:'دون وحدة زاوية',base:'سفلي فقط',upper:'علوي فقط',both:'سفلي وعلوي منفصلان',tall:'وحدة بطول كامل'})[intent]+'». اربط الاختيار بموضع الركن في الرسم.',18));
    else out.push(task('corner.'+focus.joint,'survey','customer','corner',focus,'كيف يريد العميل استخدام '+dec.name+'؟','يصل الصفان إلى الركن نفسه. تتوقف مساحة الوحدات المجاورة على طريقته أو استبعاده.',18));
   }
  }
  if(!w.applianceIntake?.length&&decisionGaps.some(i=>i.id==='devices')){
   const cards=w.applianceFit?.devices||[],existing=cards.length>0;
   const key=existingDeviceListKey(doc);
   out.push(task('devices','survey','customer','decisions',key?{deviceListKey:key}:{},existing?'هل تشمل هذه القائمة كل الأجهزة التي سيورّدها العميل؟':'ما الأجهزة التي سيورّدها العميل لهذا المطبخ؟',existing?cards.map(d=>d.name+' · '+d.model).join('، '):'يؤثر طلب الأجهزة في الحيز المحجوز. يمكن تأكيد عدم توريد أجهزة.',20));
  }
 }
 for(const r of w.applianceIntake||[]){
  if(r.wall&&!included(r.wall)){
   if(review?.active||ctx.wallIds)out.push(task('device.'+r.id,'survey','customer','intake',{requestId:r.id},'هل يبقى '+r.name+' على الجدار المختار له؟','جدار الجهاز خارج نطاق الدواليب المحدد. راجع الموضع أو نطاق المشروع قبل التوزيع.',21));
   continue;
  }
  const issue=deviceQuestion(doc,r,drawn);if(issue)out.push(issue);
 }
 out.push(...pantryQuestions(doc,chosen));
 // A missing point matters only for a sink that has actually been placed.
 for(const u of doc.kitchen.units.filter(u=>u.kind==='sink')){
  const run=doc.kitchen.runs.find(r=>r.id===u.runId);
  if(!run?.wall||!included(run.wall)||!ranges.has(run.wall))continue;
  const local=ranges.get(run.wall).features,under=f=>{const x=f.u+f.width/2;return x>u.u&&x<u.u+u.width;};
  const floorWater=doc.room.sitePoints?.some(f=>{if(f.kind!=='floor-water')return false;const p=kitchenRunLocal(doc.room,run,f);return p&&p.u>u.u&&p.u<u.u+u.width&&p.d>=0&&p.d<=(u.modelSpec?.depthMm/10||run.depth);});
  const routes=(w.pipeRoutes||[]).filter(r=>r.unitId===u.id&&r.kind!=='duct');
  const routed=routes.length&&evaluatePipeRoutes(doc,{unitIds:[u.id]}).results.some(r=>!r.issues.length&&routes.some(v=>v.id===r.id));
  const missing=['water','drain'].filter(k=>!(k==='drain'&&routed||k==='water'&&floorWater||local.some(f=>f.kind===k&&under(f))));
  if(!missing.length)continue;
  const unlocated=missing.filter(k=>!doc.kitchen.features.some(f=>f.kind===k)&&!(k==='water'&&doc.room.sitePoints?.some(f=>f.kind==='floor-water')));
  const label=k=>k==='water'?'تغذية الماء':'فتحة الصرف',wall=physical.find(p=>p.id===run.wall).label;
  if(unlocated.length)out.push(task('sink.'+u.id,'release','rep','survey',{wall:run.wall},'أين '+unlocated.map(label).join(' و')+' للمجلى على '+wall+'؟','سجّل نقطة الخدمة التي يحتاجها المجلى ليتحقق المصنع من موضعها.',61));
  else out.push(task('sink.'+u.id,'release','engineer',missing.includes('drain')?'routes':'row',{wall:run.wall,runId:run.id,unitId:u.id},'كيف تتصل وحدة المجلى على '+wall+' بالخدمات المرسومة؟','موضع '+missing.map(label).join(' و')+' معروف خارج الوحدة. راجع المسار أو موضع المجلى دون إعادة قياس النقاط المسجلة.',62));
 }
 return out;
}

export function visitQuickAnswers(doc,t){
 if(!t||!kitchenPresent(doc))return [];
 const w=doc.room.workshop||{},wall=t.focus?.wall;
 if(t.id==='visit.devices'&&t.focus?.deviceListKey&&t.focus.deviceListKey===existingDeviceListKey(doc)&&!w.applianceIntake?.length)return [{id:'existing',label:'هذه قائمتي كاملة'}];
 if(t.id==='visit.devices'&&!w.applianceIntake?.length&&!w.applianceFit?.devices?.length)return [{id:'none',label:'لن يورّد العميل أجهزة'}];
 if(t.id.startsWith('visit.corner.')&&t.focus?.canDecline&&(!t.focus.cornerIntent||t.focus.cornerIntent==='none'))return [{id:'none',label:'بدون وحدة ركن'}];
 if(!wall)return [];
 const o=readWallOptions(doc,wall);
 if(t.id.startsWith('visit.upper.')&&!doc.kitchen.runs.some(r=>r.wall===wall&&r.tier==='upper')&&!o.cornice.enabled&&!o.factoryTrim&&!o.linearLight)return [{id:'none',label:'بدون صف علوي'}];
 if(t.id.startsWith('visit.cornice.')&&!o.cornice.enabled&&!o.factoryTrim?.cornice)return [{id:'none',label:'بدون كورنيش'}];
 const f=doc.kitchen.features.find(x=>x.id===t.focus.featureId&&x.wall===wall);
 return f?.kind==='window'?[{id:'none',label:'بدون ستارة'}]:f?.kind==='heater'?[{id:'exposed',label:'يبقى السخان ظاهرًا'}]:[];
}
export function answerVisitQuestion(doc,t,answerId,ctx={}){
 // Verify the scoped question is still pending and the quick choice is valid for the current drawing.
 const pending=guidedVisit(doc,ctx).find(x=>x.id===t?.id);
 if(!pending||!visitQuickAnswers(doc,t).some(a=>a.id===answerId)||!visitQuickAnswers(doc,pending).some(a=>a.id===answerId))return {ok:false,doc,reason:'تغيّر هذا السؤال أو اختياره في المشروع. راجع الحالة الحالية.'};
 if(pending.id==='visit.devices'&&answerId==='existing')return confirmExistingDeviceList(doc);
 if(pending.id==='visit.devices')return updateDecisionReview(doc,{noCustomerDevices:true});
 if(pending.id.startsWith('visit.corner.'))return updateDecisionReview(doc,{noCorners:[...(doc.room.workshop?.decisionReview?.noCorners||[]),pending.focus.joint]});
 const {wall,featureId}=pending.focus,o=structuredClone(readWallOptions(doc,wall));
 if(pending.id.startsWith('visit.upper.')){o.mode='none';o.decisions={...o.decisions,upper:true};}
 else if(pending.id.startsWith('visit.cornice.'))o.decisions={...o.decisions,cornice:true};
 else if(answerId==='exposed')o.heaters[featureId]={state:'exposed',model:'',reviewed:false,leftMm:null,rightMm:null,aboveMm:null,belowMm:null,frontMm:null};
 else o.curtains[featureId]={state:'none',type:'roller',leftMm:0,rightMm:0,aboveMm:0,dropMm:0,projectionMm:0};
 return applyWallOptions(doc,wall,o);
}

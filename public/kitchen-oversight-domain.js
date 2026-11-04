import {approvalState,releaseConcernGroups} from './kitchen-workshop-state.js';
import {kitchenWorkGuide} from './kitchen-work-guide.js';
import {catalogRecordStates} from './kitchen-catalog-records.js';
import {roomArchitecture} from './kitchen-architecture.js';
import {surveyNotebookSummary} from './kitchen-survey-notebook-model.js';
import {configuredCorners} from './kitchen-project-decisions.js';
import {deliveryObservations} from './kitchen-delivery-domain.js';
import {serviceTickets,serviceWarranty} from './kitchen-maintenance-domain.js';

const titles={survey:'دفتر الموقع والقياسات',design:'توزيع الوحدات والهيكل',finish:'الخامات والتشطيبات',quote:'التكلفة وعرض العميل',production:'مراجعة التصنيع وفحص الجودة',delivery:'التركيب واستلام العميل',maintenance:'الصيانة وما بعد البيع'};
const action=(step,label,focus={})=>({label,step,focus:{...focus}});
const issue=(id,question,why,actor,step,focus={})=>({id,question,why,actor,step,focus:{...focus}});
const unique=rows=>[...new Map(rows.map(t=>[t.id,t])).values()];
const locations={catalog:'template',prices:'quote',budget:'quote',customer:'sign',quote:'quote',production:'production',fitout:'assembly',row:'row',collision:'whole',surface:'surface',tap:'tap',decisions:'decisions',intake:'intake',surfaces3d:'surfaces3d',corner:'corner',logistics:'logistics',measure:'measure',routes:'routes',profile:'profile',uses:'uses',appliances:'appliances',zones:'zones',pair:'survey',wallOptions:'wallOptions',survey:'survey',proof:'survey',field:'field',empty:'whole'};
const copyTask=t=>({...t,...(t.focus?{focus:structuredClone(t.focus)}:{focus:{}})});
const milestone=(id,title,valid,exists,step,focus={})=>({id,title,state:valid?'ready':exists?'attention':'waiting',summary:valid?'الاعتماد يطابق البيانات الحالية':exists?'تغيّرت البيانات أو بقيت شروط تحقق بعد الاعتماد':'بانتظار اعتماد هذه النسخة',step,focus});

/** Pure projection of the current document and one explicitly selected receipt.
 * The controller authenticates and binds job.project/subject/receipt identity.
 * receiptLoaded=false means server evidence is unknown; cached job data is ignored.
 * ready describes the supplied evidence, never permanent project completion.
 * Original guide fields are retained so contextual answers use their existing
 * validation keys. No document, signature, receipt or event is changed here.
 */
export async function buildOversightReport(doc,{job=null,receipts=[],receiptLoaded=false}={}){
 const approval=await approvalState(doc),guide=await kitchenWorkGuide(doc,{approval}),w=doc.room.workshop||{},quote=approval.quote;
 const guideTasks=unique([...guide.tasks,...guide.later].map(copyTask)),records=catalogRecordStates(w),groups=releaseConcernGroups(doc,approval);
 const localRelease=guideTasks.filter(t=>t.stage==='release');
 for(const [index,group] of groups.entries())for(const [n,why] of group.issues.entries())if(!localRelease.some(t=>t.why===why))localRelease.push(issue('release:'+group.origin+':'+index+':'+n,'ما المطلوب قبل إصدار التصنيع؟',why,group.origin==='customer'?'customer':'owner',locations[group.origin]||'sign',group.focus||{}));
 if(!approval.valid.release&&!localRelease.some(t=>t.id==='production:release'))localRelease.push(issue('release:approval','هل اعتمد مسؤول الورشة النسخة الحالية؟','اعتماد نسخة التصميم مستقل عن إصدار إيصال التصنيع على الخادم.','owner','sign',{section:'release'}));
 const physical=roomArchitecture(doc.room).walls,wallSet=new Set(physical.map(v=>v.id)),started=Object.keys(w.chains||{}).filter(id=>wallSet.has(id));
 const chosen=w.decisionReview?.active?w.decisionReview.walls:doc.kitchen.units.length?[...new Set(doc.kitchen.runs.map(r=>r.wall))]:started.length?started:[wallSet.has(w.activeWall)?w.activeWall:physical[0]?.id];
 const surveys=[...new Set(chosen)].filter(id=>wallSet.has(id)).map(id=>({wall:id,...surveyNotebookSummary(doc,id)}));
 const surveyIssues=guideTasks.filter(t=>t.stage==='survey'||t.id.startsWith('visit.proof.'));
 for(const s of surveys)if(!s.proofValid&&!surveyIssues.some(t=>t.focus?.wall===s.wall&&t.step==='survey'))surveyIssues.push(issue('survey:proof:'+s.wall,'هل يطابق الرفع الموثق الرسم الحالي؟',s.error||s.status,'rep','survey',{wall:s.wall,proof:true}));
 const designIssues=guideTasks.filter(t=>t.stage==='design'),finishIssues=guideTasks.filter(t=>t.stage==='finish'),quoteIssues=guideTasks.filter(t=>t.stage==='quote');
 const built=!!(doc.kitchen.units.length||configuredCorners(w)),surveyReady=surveys.length>0&&surveys.every(s=>s.proofValid)&&!surveyIssues.length;
 const localReady=approval.valid.release&&!groups.length&&quote.ready;
 const approvals=[milestone('structure','الهيكل',approval.valid.structure,w.approvals?.structure,'approve'),milestone('customer','تصميم العميل وعرضه',approval.valid.customer,w.approvals?.customer,'sign'),milestone('release','مراجعة نسخة المشروع',localReady,w.approvals?.release,'sign',{section:'release'}),...Object.entries({store:['كتالوج المتجر','store'],factory:['وصفات المصنع','template'],pricing:['شروط التسعير','sale']}).map(([id,[title,step]])=>({id,title,state:records?.[id]?.approved?'ready':records?.[id]?'attention':'waiting',summary:records?.[id]?'الإصدار '+records[id].revision+' · '+(records[id].approved?'معتمد':'بانتظار الاعتماد'):'لم يوثّق سجل مستقل',step,focus:{}}))];
 const counts={surveyWalls:surveys.length,surveyProven:surveys.filter(s=>s.proofValid).length,units:doc.kitchen.units.length,receiptUnits:0,qcPassed:0,packed:0,installed:0,accepted:0,blockingObservations:0,openTickets:0,closedTickets:0,undocumentedWarranty:0};
 const stages=[
  {id:'survey',state:surveyReady?'ready':surveys.some(s=>s.readingCount)?'attention':'waiting',summary:counts.surveyProven+' / '+counts.surveyWalls+' جدران في النطاق برفع ميداني موثّق يطابق الرسم',issues:surveyIssues,action:action('survey','فتح دفتر الموقع',surveyIssues[0]?.focus)},
  {id:'design',state:built&&approval.valid.structure&&!designIssues.length?'ready':built?'attention':'waiting',summary:built?(approval.valid.structure?'الهيكل معتمد على البيانات الحالية':'التوزيع الحالي يحتاج مراجعة واعتماد الهيكل'):'لم يطبّق توزيع وحدات بعد',issues:designIssues,action:action(approval.valid.structure?'whole':'approve','مراجعة توزيع الوحدات')},
  {id:'finish',state:!approval.valid.structure?'waiting':finishIssues.length?'attention':approval.valid.customer?'ready':'waiting',summary:!approval.valid.structure?'اختيار التشطيبات ينتظر اعتماد الهيكل':finishIssues.length?'توجد اختيارات أو مراجعات تشطيب مفتوحة':approval.valid.customer?'التشطيبات الحالية مشمولة بموافقة العميل':'التشطيبات الحالية بانتظار موافقة العميل',issues:finishIssues,action:action('finish','مراجعة الخامات والتشطيبات')},
  {id:'quote',state:!built?'waiting':approval.valid.customer&&quote.complete&&!quote.fitoutPending?.length&&!quoteIssues.length?'ready':'attention',summary:Number.isFinite(quote.total)?'إجمالي العرض الحالي '+quote.total.toFixed(2)+' ر.س · '+(approval.valid.customer?'معتمد من العميل':'بانتظار موافقة العميل'):'السعر غير مكتمل؛ لا يُعامل المجهول كصفر',issues:quoteIssues,action:action('quote','مراجعة التكلفة وعرض العميل')}
 ];
 const serverKnown=receiptLoaded&&job&&Array.isArray(job.units)&&Array.isArray(job.events),listed=Array.isArray(receipts)&&receipts.length>0;
 const productionIssues=[...localRelease],deliveryIssues=[],maintenanceIssues=[];
 let productionState='unknown',deliveryState='unknown',maintenanceState='unknown',productionSummary='لم يتحقق سجل الإيصال بعد.',deliverySummary='لم يتحقق سجل التركيب والاستلام بعد.',maintenanceSummary='لم يتحقق سجل الخدمة بعد.';
 let productionAction=action('sync','مراجعة إصدار التصنيع'),deliveryAction=action('tracking','فتح إيصال التنفيذ'),maintenanceAction=action('maintenance','فتح دفتر الخدمة');
 if(serverKnown){
  const units=job.units,allEvents=job.events;counts.receiptUnits=units.length;
  for(const unit of units){
   const events=allEvents.filter(e=>e.unit===unit.id).sort((a,b)=>a.seq-b.seq),last=events.at(-1),state=last?.state||'issued',focus={unitId:unit.id};
   const qc=events.filter(e=>e.action==='qc').at(-1),accepted=events.some(e=>e.action==='accept'&&e.state==='accepted');
   if(qc?.data?.passed===true)counts.qcPassed++;if(events.some(e=>e.action==='pack'))counts.packed++;if(events.some(e=>e.action==='install'))counts.installed++;if(accepted)counts.accepted++;
   if(state==='issued'||state==='planned')productionIssues.push(issue('job:qc:'+unit.id,state==='issued'?'ما مرجع السماحات المعتمدة لهذه الوحدة؟':'ما نتيجة فحص الجودة لهذه الوحدة؟',unit.name+' · '+(qc?.data?.passed===false?'آخر فحص خارج السماحة؛ يحتاج معالجة وإعادة فحص':state==='issued'?'صدر الإيصال ولم يوثّق مرجع السماحات':'لم يثبت اجتياز فحص الجودة'),state==='issued'?'owner':'factory','tracking',focus));
   if(!accepted){const question=state==='passed'?'هل وثّق تغليف الوحدة؟':state==='packed'?'أين ركبت الوحدة؟':state==='installed'?'هل وثق استلام العميل؟':'متى تستكمل الوحدة فحص الجودة؟';deliveryIssues.push(issue('job:delivery:'+unit.id,question,unit.name+' · '+({issued:'بانتظار مرجع السماحات',planned:'بانتظار اجتياز الجودة',passed:'بانتظار التغليف',packed:'بانتظار التركيب',installed:'بانتظار استلام العميل'}[state]||'راجع سجل الوحدة'),state==='installed'?'owner':'factory','tracking',focus));}
   for(const o of deliveryObservations(events).filter(o=>!o.resolved&&o.severity==='blocking')){counts.blockingObservations++;deliveryIssues.push(issue('job:observation:'+unit.id+':'+o.id,'ما معالجة الملاحظة المانعة؟',o.text,'factory','tracking',focus));}
   if(accepted&&!serviceWarranty(events))counts.undocumentedWarranty++;
   for(const t of serviceTickets(events)){if(t.status==='closed'){counts.closedTickets++;continue;}counts.openTickets++;maintenanceIssues.push(issue('job:service:'+unit.id+':'+t.id,t.status==='open'?'ما التشخيص وقرار التغطية؟':t.status==='reviewed'?'ما العمل المنفذ ونتيجة إعادة الفحص؟':'هل وثقت موافقة العميل على المعالجة؟',t.title+' · '+t.description,t.status==='reviewed'?'factory':'owner','maintenance',{...focus,ticketId:t.id}));}
  }
  productionState=!units.length?'waiting':productionIssues.length?'attention':counts.qcPassed===units.length?'ready':'waiting';
  deliveryState=!units.length?'waiting':counts.blockingObservations?'attention':counts.accepted===units.length?'ready':counts.packed||counts.installed?'attention':'waiting';
  maintenanceState=counts.openTickets?'attention':counts.closedTickets?'ready':'waiting';
  productionSummary=counts.qcPassed+' / '+units.length+' وحدات الإيصال اجتازت آخر فحص جودة · '+(localReady?'مراجعة نسخة المشروع جاهزة':'مراجعة نسخة المشروع لها متطلبات مستقلة');
  deliverySummary=counts.installed+' / '+units.length+' مركّبة · '+counts.accepted+' / '+units.length+' بمحضر استلام العميل';
  maintenanceSummary=counts.openTickets?counts.openTickets+' بلاغات مفتوحة · '+counts.closedTickets+' مغلقة بمحضر العميل':counts.closedTickets?counts.closedTickets+' بلاغات مسجلة مغلقة بمحضر العميل':'لا بلاغات مسجلة'+(counts.accepted?' على الوحدات المستلمة':'؛ يبدأ سجل الخدمة بعد الاستلام');
  const p=productionIssues.find(t=>t.step==='tracking'),d=deliveryIssues[0],m=maintenanceIssues[0];
  productionAction=p?action('tracking','مراجعة فحص الوحدة',p.focus):action('production','مراجعة قوائم التصنيع');deliveryAction=action('tracking','مراجعة التركيب والاستلام',d?.focus||{unitId:units[0]?.id});maintenanceAction=action('maintenance','مراجعة سجل الخدمة',m?.focus||{unitId:units.find(u=>allEvents.some(e=>e.unit===u.id&&e.action==='accept'))?.id});
 }else if(receiptLoaded&&!listed){
  productionState=localReady?'waiting':'attention';deliveryState=maintenanceState='waiting';productionSummary='لا يوجد إيصال تصنيع مسجل لهذا المشروع · '+(localReady?'نسخة المشروع جاهزة للإيداع':'راجع متطلبات اعتماد نسخة التصميم');deliverySummary='لا يوجد إيصال لبدء متابعة التركيب والاستلام';maintenanceSummary='لا بلاغات مسجلة؛ يلزم إيصال ومحضر استلام فعلي';
 }else if(receiptLoaded){productionSummary='اختر إيصالًا للتحقق من تقدم التصنيع';deliverySummary='اختر إيصالًا للتحقق من التركيب والاستلام';maintenanceSummary='اختر إيصالًا للتحقق من البلاغات ومحاضرها';}
 stages.push({id:'production',state:productionState,summary:productionSummary,issues:productionIssues,action:productionAction},{id:'delivery',state:deliveryState,summary:deliverySummary,issues:deliveryIssues,action:deliveryAction},{id:'maintenance',state:maintenanceState,summary:maintenanceSummary,issues:maintenanceIssues,action:maintenanceAction});
 for(const s of stages){s.title=titles[s.id];s.issues=unique(s.issues);}
 return {stages,approvals,tasks:unique([...guideTasks,...stages.flatMap(s=>s.issues)]),counts,approval,guide};
}

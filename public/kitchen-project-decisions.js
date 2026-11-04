import {offlineDigest} from './kitchen-workshop-revision.js';
import {pantryDecisionItems} from './kitchen-pantry-brief.js';
// Customer intent, placed CAD and engineering evidence are different states.
// The signed decision list applies only to the walls the rep explicitly selects.
import {architectureWallIdKnown,architectureWall} from './kitchen-architecture.js';
import {connectedWallCorners} from './kitchen-production-row-corners.js';
import {readChainRange} from './kitchen-chain-model.js';
import {intakeIssues} from './kitchen-appliance-intake.js';
export function cleanDecisionReview(v){
 if(!v||typeof v.active!=='boolean'||typeof v.noCustomerDevices!=='boolean'||!Array.isArray(v.walls)||v.walls.length>32||new Set(v.walls).size!==v.walls.length||!v.walls.every(architectureWallIdKnown)||v.active&&!v.walls.length||
 !Array.isArray(v.noCorners)||v.noCorners.length>64||new Set(v.noCorners).size!==v.noCorners.length||v.noCorners.some(k=>{if(typeof k!=='string')return true;const p=k.split('+');return p.length!==2||!p.every(architectureWallIdKnown)||p[0]>=p[1];}))return null;
 if(v.existingDeviceListKey!==undefined&&!/^[0-9a-f]{64}$/.test(v.existingDeviceListKey))return null;
 return {active:v.active,walls:[...v.walls].sort(),noCustomerDevices:v.noCustomerDevices,noCorners:[...v.noCorners].sort(),...(v.existingDeviceListKey?{existingDeviceListKey:v.existingDeviceListKey}:{})};
}
const defaultReview={active:false,walls:[],noCustomerDevices:false,noCorners:[]};
export function updateDecisionReview(doc,changes){
 const w=doc.room.workshop||{},raw={...(w.decisionReview||defaultReview),...changes},clean=cleanDecisionReview(raw);
 if(!clean||clean.walls.some(k=>!architectureWall(doc.room,k)))return {ok:false,reason:'اختر جدران المشروع الفعلية التي يغطيها محضر العميل.'};
 if(clean.noCustomerDevices&&(w.applianceIntake?.length||w.applianceFit?.devices?.length))return {ok:false,reason:'توجد أجهزة مسجلة. راجع قائمة العميل قبل اختيار عدم وجود أجهزة.'};
 if(clean.noCorners.some(k=>w.corners?.[k]))return {ok:false,reason:'يوجد ركن مرسوم. ألغِ تكوينه من شاشة الزوايا أولًا.'};
 return {ok:true,doc:{...doc,room:{...doc.room,workshop:{...w,decisionReview:clean}}}};
}
// A confirmation covers the listed devices, not fit, wiring or approval to cut.
export function existingDeviceListKey(doc){
 const cards=doc.room.workshop?.applianceFit?.devices||[],units=new Set(doc.kitchen.units.map(u=>u.id));
 if(!cards.length||cards.some(d=>!d.model?.trim()||!d.manual?.trim()||!units.has(d.host)))return '';
 const list=cards.map(d=>[d.id,d.kind,d.name,d.model]).sort(([a],[b])=>a<b?-1:a>b?1:0);
 return offlineDigest(new TextEncoder().encode(JSON.stringify(list)));
}
export function confirmExistingDeviceList(doc){
 const key=existingDeviceListKey(doc);
 if(!key||doc.room.workshop?.applianceIntake?.length)return {ok:false,doc,reason:'راجع نماذج الأجهزة القائمة ومواضعها قبل اعتماد قائمة العميل.'};
 return updateDecisionReview(doc,{noCustomerDevices:false,existingDeviceListKey:key});
}
const upperLabels={none:'دون صف علوي',gap:'صف علوي مع فراغ فوقه',tall:'صف ممتد إلى السقف',two:'صفّان علويان',filler:'صف مع قفلة علوية'};
const cornersLabel={a:'من الجدار الأول',b:'من الجدار الثاني',both:'من الجهتين'};
const contains=(range,point)=>range&&point*10>=range.startMm-.1&&point*10<=range.endMm+.1;
export function projectDecisions(doc){
 const w=doc.room.workshop||{},review=w.decisionReview||defaultReview,items=[];
 const wallIds=review.active?review.walls:Object.keys(w.chains||{}),spans={};
 const add=(id,name,value,open,step,focus={})=>items.push({id,name,value,open,step,focus});
 for(const wall of wallIds){const geo=architectureWall(doc.room,wall),name=geo?.label||wall,o=w.options?.[wall],r=geo&&readChainRange(doc,wall);spans[wall]=r;
  add('measure:'+wall,'رفع '+name,r?'يبدأ نطاق الدواليب عند '+r.startMm+' وينتهي عند '+r.endMm+' مم':'يلزم تحديد قياسات الجدار ونطاق الدواليب',!r,'survey',{wall});
  if(!r)continue;
  add('upper:'+wall,'نهاية الدواليب العلوية · '+name,o?.decisions?.upper?upperLabels[o.mode]:o?.mode&&o.mode!=='gap'?'الخيار المرسوم '+upperLabels[o.mode]+'، لم يُسجّل حسمه مع العميل':'لم يُحسم مع العميل',!o?.decisions?.upper,'wallOptions',{wall});
  if(o?.mode!=='none'||!o?.decisions?.upper)add('cornice:'+wall,'كورنيش · '+name,o?.decisions?.cornice?(o.cornice.enabled?'طلب كورنيش':'بدون كورنيش'):'لم يُحسم مع العميل',!o?.decisions?.cornice,'wallOptions',{wall});
  for(const f of doc.kitchen.features.filter(x=>x.wall===wall&&['heater','window'].includes(x.kind))){
   const curtain=f.kind==='window',c=curtain?o?.curtains?.[f.id]:o?.heaters?.[f.id],label=curtain?'ستارة الشباك':'تغطية السخان';
   const text=curtain?({none:'بدون ستارة',existing:'ستارة قائمة',factory:'ستارة من المصنع',external:'ستارة من مورد خارجي'}):({exposed:'طلب العميل إبقاءه ظاهرًا',cover:'طلب العميل تغطيته'});
   add('feature:'+f.id,label+' · '+name+' · '+Math.round(f.u*10)+' مم',text[c?.state]||'لم يُحسم مع العميل',!text[c?.state],'wallOptions',{wall});
  }
 }
 for(const j of connectedWallCorners(doc.room)){
  const c=w.corners?.[j.id],declined=review.noCorners.includes(j.id);
  if(!wallIds.includes(j.a.id)||!wallIds.includes(j.b.id)||!c&&!(contains(spans[j.a.id],j.pointA)&&contains(spans[j.b.id],j.pointB)))continue;
  const name='الركن · '+j.a.label+' × '+j.b.label,detail=c?[c.tall?'وحدة بطول كامل':c.base&&c.upper?'سفلي وعلوي مستقلان':c.base?'سفلي فقط':'علوي فقط',...([c.base,...(c.tall?[]:[c.upper])].filter(Boolean).map(p=>(cornersLabel[p.access]||'')+(p.build?' · '+(p.build.mode==='split'?'جسمان مستقلان':'جسم مشترك'):'')))].join(' · '):declined?'اختار العميل عدم تنفيذ ركن':'لم يُحسم مع العميل';
  add('corner:'+j.id,name,detail,!c&&!declined,'corner',{joint:j.id,canDecline:!c&&!declined,canReopen:declined&&!c});
 }
 const intake=w.applianceIntake||[],gaps=intakeIssues(doc),legacy=w.applianceFit?.devices?.length||0;
 const confirmedExisting=!!review.existingDeviceListKey&&review.existingDeviceListKey===existingDeviceListKey(doc);
 add('devices','أجهزة العميل',intake.length?intake.length+' أجهزة مسجلة · '+(gaps.length?gaps.join(' / '):'مرتبطة بالرسم'):legacy?(confirmedExisting?'أكد العميل قائمة الأجهزة الموجودة على الرسم.':'توجد بطاقات لأجهزة على الرسم. راجع القائمة الكاملة مع العميل.'):review.noCustomerDevices?'أكد العميل أنه لن يورّد أجهزة':'لم تُسجّل قائمة العميل بعد',!intake.length&&!review.noCustomerDevices&&!confirmedExisting||gaps.length>0,'intake');
 items.push(...pantryDecisionItems(doc));
 return {review,items,missing:items.filter(i=>i.open)};
}
export function decisionIssues(doc){return doc.room.workshop?.decisionReview?.active?projectDecisions(doc).missing.map(i=>i.name+' · '+i.value):[];}
export function configuredCorners(w){return Object.values(w.corners||{}).some(c=>c.base?.build||c.upper?.build);}

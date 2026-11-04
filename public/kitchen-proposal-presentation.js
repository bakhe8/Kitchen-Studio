import {proposalUnitSymbol} from './kitchen-proposal-symbols.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
import {cadPartTarget} from './kitchen-cad-parts.js';
import {factoryFrontSurfaces,frontAppearanceSource} from './kitchen-render-factory-fronts.js';
import {factoryHandleSummary} from './kitchen-finish-parts.js';
import {outputApprovalState} from './kitchen-workshop-state.js';
import {outputStamp} from './kitchen-output-stamp.js';
// Every view is drawn from the same proposed CAD document the rep can apply.
import {customerSceneOverview} from './kitchen-report-scene.js';
import {kitchenFrontFinishes,kitchenWorktopFinishes} from './kitchen-materials.js';
import {customerSheetStyle} from './kitchen-customer-sheet-style.js';
import {pantryRequests} from './kitchen-pantry-brief.js';
import {roomArchitecture} from './kitchen-architecture.js';
import {kitchenGeometry,kitchenUnitSpecs} from './kitchen-model.js';
import {scenePlan} from './kitchen-project.js';
import {renderKitchenRoom} from './kitchen-render.js';
import {elevationSheet,planSheet} from './kitchen-sheet.js';
import {buildFactoryQuote,getFactoryCatalog} from './kitchen-workshop-factory.js';
import {readChainRange} from './kitchen-chain-model.js';
import {factoryWidthEditable,factoryPositionEditable} from './kitchen-proposal-change.js';

export const escapeProposalText=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=escapeProposalText,ar=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2});
export const proposalNumber=n=>Number.isFinite(n)?ar.format(n):'—';
export const proposalPrice=n=>Number.isFinite(n)?proposalNumber(n)+' ر.س':'بانتظار اكتمال التسعير';
const mm=v=>proposalNumber(v)+' مم';
const unitCount=n=>n===1?'وحدة واحدة':n===2?'وحدتان':proposalNumber(n)+(n>=3&&n<=10?' وحدات':' وحدة');
export function proposalUnits(doc){
 const w=doc.room.workshop||{},catalog=readWorkshopCatalog(w),runs=new Map(doc.kitchen.runs.map(r=>[r.id,r]));
 const entries=new Map(Object.values(w.rows||{}).flatMap(row=>row.units).map(e=>[e.id,e]));
 return doc.kitchen.units.map((u,i)=>{
  const r=runs.get(u.runId),entry=entries.get(u.id),kind=kitchenUnitSpecs[u.kind]?.label||u.kind;
  const label=entry?.use||(entry?.family==='rice'?'درج الأرز':catalog?.families?.[entry?.recipeId]?.label||kind);
  return {id:u.id,runId:u.runId,wall:r?.wall,tier:r?.tier,kind:u.kind,family:entry?.family,label,model:u.modelSpec?.model,code:'U'+(i+1),
   startMm:Math.round(u.u*10),widthMm:Math.round(u.width*10),resizable:factoryWidthEditable(doc,u,entry),movable:factoryPositionEditable(doc,u,entry)};
 });
}
// Ignore generated identifiers. Two independently generated cabinets may occupy
// the same physical station and still receive different ids or sheet numbers.
export function proposalComparisons(docs){
 if(docs.length<2)return [];
 const wallNames=new Map(roomArchitecture(docs[0].room).walls.map(w=>[w.id,w.label]));
 const sets=docs.map(doc=>proposalUnits(doc).sort((a,b)=>String(a.wall).localeCompare(String(b.wall))||a.startMm-b.startMm));
 const signature=u=>JSON.stringify([u.wall,u.tier,u.kind,u.model,u.label,u.startMm,u.widthMm]);
 const common=new Set(sets[0].map(signature).filter(k=>sets.every(set=>set.some(u=>signature(u)===k))));
 const changed=sets.map(set=>set.filter(u=>!common.has(signature(u))));
 const families=[...new Set(changed.flat().map(u=>u.model||u.family||u.kind))];
 // Describe a change the owner can identify on the drawing, preferably the
 // same type of component across every option (placement or subdivision).
 const groups=families.map(family=>changed.map(set=>set.filter(u=>(u.model||u.family||u.kind)===family)));
 function facts(group){
  return JSON.stringify(group.map(u=>[u.wall,u.tier,u.startMm,u.widthMm,u.label]));
 }
 groups.sort((a,b)=>new Set(b.map(facts)).size-new Set(a.map(facts)).size||
  b.filter(g=>g.length).length-a.filter(g=>g.length).length||
  new Set(b.map(g=>g.length)).size-new Set(a.map(g=>g.length)).size);
 const descriptions=changed.map((all,i)=>{
  const group=groups.find(g=>g[i].length&&g.some((other,j)=>j!==i&&facts(other)!==facts(g[i])))?.[i]||all;
  if(!group.length)return {title:'التوزيع الأساسي',detail:'التوزيع ضمن حدود الرفع',ids:[]};
  const first=group[0],last=group.at(-1),sameWall=group.every(u=>u.wall===first.wall&&u.tier===first.tier);
  const continuous=sameWall&&group.every((u,j)=>j===0||u.startMm===group[j-1].startMm+group[j-1].widthMm);
  const cabinet=group.every(u=>u.kind==='storage'&&u.family!=='dishwasher'&&!u.model);
  const widths=group.map(u=>u.widthMm),sameWidth=widths.every(w=>w===widths[0]);
  let title=first.label+(first.model?' '+first.model:'');
  if(cabinet&&continuous){
   const count=group.length;
   const pieces=count===1?'خزانة واحدة':count===2?'خزانتان':proposalNumber(count)+' خزائن';
   title=pieces+' · '+(sameWidth?mm(widths[0])+(count===2?' لكل منهما':count>2?' لكل خزانة':''):widths.map(proposalNumber).join(' + ')+' مم');
  }else if(group.length>1)title+=' · '+proposalNumber(group.length)+' وحدات';
  const wall=wallNames.get(first.wall)||'الجزيرة',tier=first.tier==='upper'?'علوي':'سفلي';
  const detail=sameWall?wall+' · '+tier+' · '+(continuous?'من '+mm(first.startMm)+' إلى '+mm(last.startMm+last.widthMm):'البداية عند '+mm(first.startMm)):group.map(u=>wallNames.get(u.wall)||'الجزيرة').filter((w,j,a)=>a.indexOf(w)===j).join('، ');
  return {title,detail,ids:group.map(u=>u.id)};
 });
 // When the unit kinds are alike, the wall and station are the actual choice.
 const titles=descriptions.map(v=>v.title);
 return descriptions.map((d,i)=>titles.some((t,j)=>j!==i&&t===d.title)&&d.ids.length?
  {...d,title:d.title+' · '+d.detail,detail:''}:d);
}

// Frame the built units, using the same projected points used for hit testing.
function cabinetViewBox(scene){
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(const r of scene.editOccluders){
  if(r.f.part!=='module')continue;
  left=Math.min(left,r.x0);top=Math.min(top,r.y0);right=Math.max(right,r.x1);bottom=Math.max(bottom,r.y1);
 }
 if(!Number.isFinite(left))return scene.viewBox;
 const margin=Math.max(22,Math.max(right-left,bottom-top)*.14);
 return [left-margin,top-margin,right-left+2*margin,bottom-top+2*margin].map(v=>Number(v.toFixed(3))).join(' ');
}
function widthHandles(unit,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
 if(length<1)return '';
 const angle=Math.atan2(dy,dx)*180/Math.PI,cursor=Math.abs(dx)>Math.abs(dy)?'ew-resize':'ns-resize';
 // Stroke widths stay finger-sized at every viewBox zoom; these marks belong only to the live editor.
 const resize=unit.resizable?[['start',a],['end',b]].map(([edge,p])=>'<g data-wp-grip="'+edge+'" data-axis-x="'+dx+'" data-axis-y="'+dy+
  '" transform="translate('+p.x+' '+p.y+') rotate('+angle+')" style="cursor:'+cursor+'"><title>اسحب حافة '+esc(unit.label)+' لتغيير العرض</title>'+
  '<path class="pd-grip-hit" d="M0 0h.01"/><path class="pd-grip-ring" d="M0 0h.01"/><path class="pd-grip-dot" d="M0 0h.01"/></g>').join(''):'';
 const move=unit.movable?'<g data-wp-grip="move" data-axis-x="'+dx+'" data-axis-y="'+dy+'" transform="translate('+((a.x+b.x)/2)+' '+((a.y+b.y)/2)+')" style="cursor:grab"><title>اسحب لإعادة ترتيب '+esc(unit.label)+' داخل الصف</title><path class="pd-move-hit" d="M0 0h.01"/><path class="pd-move-ring" d="M0 0h.01"/><path class="pd-move-icon" d="M-3 0h6 M-3 0l1.4 -1.4 M-3 0l1.4 1.4 M3 0l-1.4 -1.4 M3 0l-1.4 1.4"/></g>':'';
 return resize+move;
}
// Only the on-screen proposal gets pictorial tags; export keeps its print references.
function proposalTag(unit,code,x,y,span){
 const description=esc(code+' · '+unit.label+' · '+mm(unit.widthMm));
 if(span<15)return '<title>'+description+'</title>';
 const textWidth=code.length*7.5+7,hasSymbol=span>=textWidth+18;
 const width=Math.min(span-2,textWidth+(hasSymbol?18:0)),height=19;
 const size=Math.min(12,(width-(hasSymbol?18:0))/(code.length*.63));
 return '<g data-sheet-unit="'+esc(unit.id)+'" data-sheet-label="" class="pd-cabinet-tag" transform="translate('+x+' '+y+')"><title>'+description+'</title>'+
  '<rect x="'+(-width/2)+'" y="-9.5" width="'+width+'" height="'+height+'" rx="3"/>'+
  (hasSymbol?proposalUnitSymbol(unit,16,-width/2+2,-8):'')+
  '<text x="'+(hasSymbol?8:0)+'" y="'+size*.34+'" font-size="'+size+'" text-anchor="middle" font-weight="650" direction="ltr">'+esc(code)+'</text></g>';
}
export function alternativeStrip(units,changedIds){
 const changed=new Set(changedIds),affected=units.filter(u=>changed.has(u.id));
 if(!affected.length||affected.some(u=>u.runId!==affected[0].runId))return '';
 const row=units.filter(u=>u.runId===affected[0].runId);
 const start=Math.min(...row.map(u=>u.startMm)),length=Math.max(...row.map(u=>u.startMm+u.widthMm))-start;
 if(length<=0)return '';
 // Compare the affected station in the context of its complete measured row.
 // A space between units is represented at its actual size.
 const blocks=row.map(u=>{
  const x=2+120*(u.startMm-start)/length,w=120*u.widthMm/length,active=changed.has(u.id);
  return '<rect x="'+x+'" y="4" width="'+w+'" height="14"'+(active?' class="pd-alt-change"':'')+'/>'+
   (active?'<path d="M'+x+' 21h'+w+'"/>':'');
 });
 return '<svg class="pd-alt-strip" aria-hidden="true" viewBox="0 0 124 24" width="124" height="24" preserveAspectRatio="xMinYMid meet">'+blocks.join('')+'</svg>';
}
export function proposalScene(doc,face='volume',prefix='kp',options={}){
 const unit=options.interactive&&(options.editableUnit?.resizable||options.editableUnit?.movable)?options.editableUnit:null;
 const widthGrip=unit&&{id:unit.id,draw:(a,b)=>widthHandles(unit,a,b)};
 if(face!=='volume'){
  const units=options.interactive?new Map((options.units||proposalUnits(doc)).map(u=>[u.id,u])):null;
  const labelUnit=units?(u,code,x,y,span)=>proposalTag(units.get(u.id),code,x,y,span):undefined;
  if(face==='plan')return {html:planSheet(doc,true,{tier:options.tier,interactive:!!options.interactive,widthGrip,labelUnit})};
  return {html:elevationSheet(doc,face,true,widthGrip,{labelUnit})};
 }
 const wallIds=new Set(doc.kitchen.runs.map(r=>r.wall).filter(Boolean));
 const wall=wallIds.size===1&&!doc.kitchen.runs.some(r=>r.placement==='free')?
  roomArchitecture(doc.room).walls.find(w=>wallIds.has(w.id)):null;
 const normalYaw=wall?Math.atan2(wall.inward.x,wall.inward.z)*180/Math.PI:0;
 const scene=renderKitchenRoom(scenePlan(doc.room,doc.kitchen),{kitchen:doc.kitchen,mode:'cutaway',prefix,
  yaw:normalYaw+(options.yaw??18),pitch:wall?13:24,selectedId:options.selectedId});
 let handles='';
 if(widthGrip){
  const g=scene.geometry,u=g.units.find(u=>u.id===unit.id);
  if(u){
   const [, ,right,left]=u.polygon,y=g.room.height-u.bottom-u.height*.55,P=scene.projection;
   const a=P.project(left.x,y,left.z),b=P.project(right.x,y,right.z),hit=scene.hitTest((a.x+b.x)/2,(a.y+b.y)/2);
   if(hit?.id===u.id||hit?.unitId===u.id)handles=widthGrip.draw(a,b);
  }
 }
 return {html:'<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="مجسّم المطبخ المقترح" viewBox="'+esc(options.frameUnits?cabinetViewBox(scene):scene.viewBox)+'">'+scene.html+handles+'</svg>',hitTest:scene.hitTest,partTarget:hit=>cadPartTarget(hit,scene.geometry)};
}
export function proposalView(doc,face='volume',prefix='kp'){return proposalScene(doc,face,prefix).html;}
const cell=v=>'<td>'+esc(v)+'</td>';
const table=(head,rows)=>'<div class="wp-scroll"><table><thead><tr>'+head.map(v=>'<th scope="col">'+esc(v)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(cell).join('')+'</tr>').join('')+'</tbody></table></div>';
export function distributionTable(doc,wallIds){
 const walls=roomArchitecture(doc.room).walls,units=proposalUnits(doc),rank=id=>walls.findIndex(w=>w.id===id);
 return table(['الرسم','الوحدة','الجدار والمستوى','من بداية الجدار','العرض'],units.filter(u=>!wallIds||wallIds.includes(u.wall))
  .sort((a,b)=>rank(a.wall)-rank(b.wall)||a.tier.localeCompare(b.tier)||a.startMm-b.startMm)
  .map(u=>[u.code,u.label+(u.model?' · '+u.model:''),(walls.find(w=>w.id===u.wall)?.label||'جزيرة')+' · '+(u.tier==='upper'?'علوي':'سفلي'),mm(u.startMm),mm(u.widthMm)]));
}
export function wallFacts(doc,wallIds){
 const walls=roomArchitecture(doc.room).walls,facts=[];
 for(const w of walls.filter(w=>wallIds.includes(w.id))){
  const r=readChainRange(doc,w.id);if(!r)continue;
  const text=spans=>spans.length?spans.map(s=>proposalNumber(s.endMm-s.startMm)).join(' + ')+' مم':'دون امتداد';
  facts.push({label:w.label,detail:'من '+mm(r.startMm)+' إلى '+mm(r.endMm)+(r.pairPending?.base?' · امتداد السفلي على الرسم مبدئي بانتظار مطابقة قياس الظهر والوجه':' · امتداد السفلي المتاح من الرفع '+text(r.baseSpans))+(r.pairPending?.upper?' · امتداد العلوي مبدئي بانتظار مطابقة قياس الظهر والوجه':r.upperSpans.length?' · مساحات أول مستوى علوي من الرفع '+text(r.upperSpans):'')});
 }return facts;
}
export function changeTable(change){
 if(!change?.changes?.length)return '';
 return table(['الوحدة','العرض السابق','العرض الجديد','البداية السابقة','البداية الجديدة','عرض الواجهة الواحدة قبل ← بعد'],change.changes.map(v=>[
  v.label||v.unitId,mm(v.beforeWidthMm),mm(v.afterWidthMm),mm(v.beforeStartMm),mm(v.afterStartMm),
  Number.isFinite(v.frontBeforeMm)&&Number.isFinite(v.frontAfterMm)?mm(v.frontBeforeMm)+' ← '+mm(v.frontAfterMm):'غير منطبق']));
}
function deltaLabel(value){return value===0?'بقي السعر كما هو':!Number.isFinite(value)?'فرق السعر بانتظار بيانات التسعير':(value>0?'زيادة ':'انخفاض ')+proposalPrice(Math.abs(value));}
export function priceDifference(change){
 const price=change?.price;if(!price)return '';
 return '<p><strong>'+esc(deltaLabel(price.deltaSar))+'</strong> · قبل التعديل '+esc(proposalPrice(price.beforeSar))+' · بعده '+esc(proposalPrice(price.afterSar))+'</p>';
}
export function purchaseNote(before,after,change){
 if(!change||!before?.complete||!after?.complete||change.price.deltaSar!==0||!change.cutChanges.length)return '';
 const quantities=q=>q.purchases.map(p=>[p.sku,p.qty]).sort(([a],[b])=>a.localeCompare(b));
 return JSON.stringify(quantities(before))===JSON.stringify(quantities(after))?'تغيّرت أبعاد القص وبقيت كميات الأصناف المسعّرة في الحصر كما هي.':'';
}
export function frontCutSummary(change){
 if(!change)return '';
 const lines=change.cutChanges.filter(p=>p.label==='حشوة واجهة'||p.label==='عارضة جسم');
 const dimension=parts=>parts.map(p=>[p.a,p.b].filter(Number.isFinite).map(proposalNumber).join(' × ')+' مم · '+proposalNumber(p.count)+' قطع').join('، ');
 return lines.length?'<details><summary>نماذج من القطع المتأثرة</summary>'+table(['الوحدة','القطعة','القص قبل التعديل','القص بعده'],lines.map(p=>[
  change.changes.find(c=>c.unitId===p.unitId)?.label||p.unitId,p.label,dimension(p.before),dimension(p.after)]))+'</details>':'';
}
// Distinguish something the customer chose from a finish only shown in CAD.
function reportSamples(doc,visible){
 const codes=new Map(visible.map(u=>[u.id,u.code])),cat=getFactoryCatalog(doc),ws=doc.room.workshop||{};
 const source=frontAppearanceSource(ws),fronts=factoryFrontSurfaces(doc.kitchen,source);
 const items=new Map(cat.items.map(i=>[i.sku,i])),samples=new Map();
 function add(key,part,name,color,note,ref){
  if(!samples.has(key))samples.set(key,{part,name,color:/^#[a-f0-9]{6}$/i.test(color)?color:null,note,refs:[]});
  samples.get(key).refs.push(ref);
 }
 for(const u of doc.kitchen.units){
  if(!codes.has(u.id))continue;
  const resolved=fronts.get(u.id),item=resolved&&items.get(resolved.sku);
  if(item?.kind==='panel'&&item.role==='front'){
   const note=[item.color&&!item.color.startsWith('#')?item.color:null,item.thicknessMm?mm(item.thicknessMm):null].filter(Boolean).join(' · ');
   const selected=!!(source.units[u.id]||source.frontSku);
   add((selected?'choice/':'recipe/')+item.sku,selected?'عينة الواجهة المختارة':'الواجهة حسب وصفة المصنع',item.name,resolved.color,note,codes.get(u.id));
  }else if(u.frontColor||kitchenFrontFinishes[u.frontFinish]){
   const f=kitchenFrontFinishes[u.frontFinish],color=u.frontColor||f?.color;
   add('front/'+(u.frontFinish||'')+'/'+color,'الواجهة في الرسم',f?.label||'لون مخصص',color,'',codes.get(u.id));
  }
 }
 const runs=new Set(visible.map(u=>u.runId)),tops=new Set(kitchenGeometry(doc.kitchen,doc.room).worktops.map(t=>t.runId));
 for(const r of doc.kitchen.runs){
  const f=kitchenWorktopFinishes[r.worktopFinish];
  if(runs.has(r.id)&&tops.has(r.id)&&f)add('top/'+r.worktopFinish,'سطح العمل في الرسم',f.label,f.color,'',roomArchitecture(doc.room).walls.find(w=>w.id===r.wall)?.label||'الجزيرة');
 }
 return [...samples.values()].map(s=>'<div class="material"><i class="chip" '+(s.color?'style="--swatch:'+s.color+'"':'data-unset')+' aria-hidden="true"></i><div><small>'+esc(s.part)+'</small><strong>'+esc(s.name)+'</strong>'+(s.note?'<span>'+esc(s.note)+'</span>':'')+'<span>'+esc([...new Set(s.refs)].join('، '))+'</span></div></div>').join('');
}
const list=items=>items.length?'<ul>'+items.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul>':'';
const detail=(label,content)=>content?'<details><summary>'+esc(label)+'</summary><div>'+content+'</div></details>':'';
const figure=(title,svg)=>'<figure><figcaption>'+esc(title)+'</figcaption>'+svg+'</figure>';
function reportMark(){return '<svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="6" fill="#20463d"/><g fill="none" stroke="#edcf96" stroke-width="1.5" stroke-linejoin="round"><path d="m16 5 10 5.5v11L16 27 6 21.5v-11zM6 10.5 16 16l10-5.5M16 16v11"/><path d="m11 8 10 5.5" /></g></svg>';}
export function customerReport({doc,before=null,change=null,wallIds=null,reasons=[],questions=[],example=false,comparison=null,saved=false}){
 const arch=roomArchitecture(doc.room),walls=arch.walls,ids=wallIds||[...new Set(doc.kitchen.runs.map(r=>r.wall).filter(Boolean))];
 const chosen=walls.filter(w=>ids.includes(w.id)),units=proposalUnits(doc),visible=wallIds?units.filter(u=>ids.includes(u.wall)):units;
 const visibleIds=new Set(visible.map(u=>u.id)),scope=wallIds?(chosen.map(w=>w.label).join('، ')||'دون جدار محدد'):'المطبخ كاملًا';
 const quote=buildFactoryQuote(doc),name=doc.room.name||'مشروع المطبخ';
 const corners=Object.values(doc.room.workshop?.corners||{});
 const whole=!wallIds||(visible.length>0&&units.length===visible.length&&corners.every(c=>ids.includes(c.a)&&ids.includes(c.b))&&quote.extras.every(e=>!e.wall||ids.includes(e.wall)));
 const header=example?'مثال تدريبي • قياسات وأسعار افتراضية':saved?'عرض التصميم المحفوظ':'مقترح لمراجعة العميل';
 const stamp=outputStamp(doc,scope,header,{state:outputApprovalState(doc,quote)});
 const day=new Intl.DateTimeFormat('ar-SA',{calendar:'gregory',year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Riyadh'}).format(new Date(stamp.issued));
 const quoteTitle=quote.fitoutPending?.length?'قيمة البنود المحسوبة حتى الآن للمطبخ كاملًا':'إجمالي المطبخ';
 const summary=whole?'<div class="estimate"><small>'+esc(quoteTitle)+'</small><strong>'+esc(proposalPrice(quote.complete?quote.total:null))+'</strong><span>سطح العمل '+(quote.worktopIncluded?'مشمول':'خارج السعر')+'</span></div>':'<div class="estimate"><small>النطاق المعروض</small><strong>'+esc(scope)+'</strong><span>سعر هذا النطاق غير محسوب على حدة.</span></div>';
 const plan=planSheet(doc,true,{wallIds}),sketch=customerSceneOverview(doc,{wallIds});
 const drawingTitle=sketch?(whole?'منظور المطبخ':'منظور التوزيع المحدد'):'مسقط الغرفة';
 const metric=(term,value)=>'<div><dt>'+esc(term)+'</dt><dd>'+esc(value)+'</dd></div>';
 const hero='<section class="cover" id="overview"><div class="visual"><div class="visual-head"><span>'+drawingTitle+'</span><small>'+esc(scope)+'</small></div><div class="scene">'+(sketch||plan)+'</div><div class="visual-foot"><span>استوديو المطابخ</span><bdi>'+esc(stamp.revision)+'</bdi></div></div>'+
  '<div class="cover-copy"><div class="kicker"><i></i> ملف تصميم المطبخ</div><h1>'+esc(name)+'</h1><p class="state"><strong>'+esc(stamp.status)+'</strong> · '+esc(header)+'</p>'+
  '<dl class="metrics">'+metric('وحدات مرقّمة',proposalNumber(visible.length))+metric('مساحة الغرفة',proposalNumber(arch.area/10000)+' م²')+metric('ارتفاع السقف',mm(arch.height*10))+'</dl>'+
  summary+'<a href="#drawings" class="jump">استعرض الرسومات <span aria-hidden="true">↓</span></a></div></section>';
 const views=chosen.map(w=>({label:w.label,wall:w})),planView={label:'المسقط',html:figure('مسقط المطبخ',plan)};
 if(views.length===1)views.push(planView);else views.unshift(planView);
 const drawingSheet=(v,i)=>{
  const art=v.wall?(before&&change?'<div class="two">'+figure('قبل التعديل الأخير',elevationSheet(before,v.wall.id,true,null,{customer:true}))+figure('بعد التعديل الأخير',elevationSheet(doc,v.wall.id,true,null,{customer:true}))+'</div>':figure('واجهة الوحدات بالملليمتر',elevationSheet(doc,v.wall.id,true,null,{customer:true}))):v.html;
  return '<div class="view-panel" id="drawing-'+i+'"><h2>'+esc(v.label)+'</h2>'+art+'<div class="sheet-line"><span>'+esc(name)+'</span><span>'+esc(v.label)+' · مم</span><bdi>'+esc(stamp.revision)+'</bdi></div></div>';
 };
 const galleryCSS=views.map((_,i)=>`#view-${i}:checked~.drawings #drawing-${i}{display:block}#view-${i}:checked~.views [for="view-${i}"]{background:var(--ks-action);color:var(--ks-on-dark);border-color:var(--ks-action);text-decoration:underline;border-inline-start:4px double var(--ks-action)}#view-${i}:focus-visible~.views [for="view-${i}"]{outline:3px solid var(--ks-focus-ring);outline-offset:2px}`).join('');
 const gallery='<div class="gallery" role="group" aria-label="رسومات المطبخ">'+views.map((v,i)=>'<input type="radio" name="drawing" id="view-'+i+'"'+(i===0?' checked':'')+'>').join('')+'<div class="views">'+views.map((v,i)=>'<label for="view-'+i+'">'+esc(v.label)+'</label>').join('')+(sketch?'<a href="#overview">المنظور ↑</a>':'')+'</div><div class="drawings">'+views.map(drawingSheet).join('')+'</div></div>';
 const schedule=['base','upper'].map(t=>({n:visible.filter(u=>(u.tier==='upper'?'upper':'base')===t).length,label:t==='upper'?'علوية':'سفلية'})).filter(x=>x.n).map(x=>proposalNumber(x.n)+' '+x.label).join(' · ');
 const head=(n,title,note='')=>'<div class="section-title"><span>'+n+'</span><h2>'+title+'</h2>'+(note?'<small>'+esc(note)+'</small>':'')+'</div>';
 const samples=reportSamples(doc,visible);
 const finish='<section class="book-section" id="finishes">'+head('٠٢','الخامات والتخصيص')+(samples?'<div class="materials">'+samples+'</div>':'<p class="empty">اختيارات الخامات لهذا التوزيع بانتظار التحديد.</p>');
 const ws=doc.room.workshop||{},entries=Object.values(ws.rows||{}).flatMap(r=>r.units||[]);
 const useRows=entries.filter(e=>visibleIds.has(e.id)).flatMap(e=>(e.drawerUses||[]).flatMap((purpose,i)=>purpose?.trim()?[[units.find(u=>u.id===e.id).code,'الدرج '+proposalNumber(i+1),purpose]]:[]));
 const amounts=pantryRequests(doc).filter(r=>r.confirmed&&r.choice==='bag'&&r.amountKg>0&&r.packageKg>0&&(whole||entries.some(e=>visibleIds.has(e.id)&&e.pantryId===r.id)));
 const appliances=(ws.applianceIntake||[]).filter(v=>whole||visibleIds.has(v.host));
 const handles=factoryHandleSummary(doc,visible.map(u=>u.id),{customer:true});
 const details=detail('استخدام الأدراج',useRows.length?table(['الوحدة','الدرج','الاستخدام'],useRows):'')+
  detail('استخدام درج الأرز',list(amounts.map(r=>'الطلب '+proposalNumber(r.amountKg)+' كجم في الأكياس الأصلية. وزن الكيس '+proposalNumber(r.packageKg)+' كجم، والعدد المطلوب '+proposalNumber(Math.ceil(r.amountKg/r.packageKg))+'. تُراجع أبعاد الكيس وصافي الدرج والحمولة قبل التصنيع.')))+
  detail('الأيدي في الرسم',list(handles))+
  detail('أجهزة العميل',list(appliances.map(v=>v.name+' · '+(v.model||'الموديل غير محسوم')+' · '+(v.host?'مرتبط بالوحدة '+(units.find(u=>u.id===v.host)?.code||v.host):'ينتظر تحديد الموضع'))))+
  detail('قواعد الدواليب ونعلة الرخام',whole?list([...(quote.fitoutSummary||[]),...(quote.fitoutPending||[])]):'')+
  detail('تجهيزات مورّد الرخام',list(quote.extras.filter(e=>(e.kind==='upstand'||e.kind==='windowSill')&&(whole||ids.includes(e.wall))).map(e=>e.label+' · '+proposalNumber(e.quantity)+' '+e.unit+' · خارج سعر المصنع')));
 const openItems=new Set(),technicalTopics=new Set();
 const topics={survey:'رفع الجدران وحدود الفتحات',appliances:'مقاسات وارتكاز الأجهزة وتوصيلاتها',row:'صافي الوحدات ومواصفات العتاد',measure:'سماحات التركيب',surfaces3d:'مناسيب الأرضية والسقف',routes:'مسارات الخدمات',tap:'حركة الخلاط والشباك',corner:'مقاسات وحركة وحدة الركن',quote:'اكتمال التسعير',factory:'مطابقة الخامات',surface:'قالب السطح',uses:'ملاءمة التقسيم الداخلي'};
 for(const q of questions){
  if(!whole&&(q.focus?.wall&&!ids.includes(q.focus.wall)||q.focus?.unitId&&!visibleIds.has(q.focus.unitId)))continue;
  if(q.step==='decisions'||q.step==='wallOptions'||q.step==='intake'||q.step==='corner'&&q.focus?.joint){if(q.text)openItems.add(q.text);}
  else technicalTopics.add(topics[q.step]||'مطابقة التصميم لمتطلبات الموقع');
 }
 const review=(openItems.size?'<div><h3>قرارات مع العميل</h3>'+list([...openItems])+'</div>':'')+(technicalTopics.size?'<div><h3>يراجعها الفني قبل التصنيع</h3>'+list([...technicalTopics])+'</div>':'');
 const changed=change?.changes?.filter(v=>visibleIds.has(v.unitId)&&v.beforeWidthMm!==v.afterWidthMm)||[];
 const stock=before&&change&&whole?purchaseNote(buildFactoryQuote(before),quote,change):'';
 const delta=change&&changed.length?'<section class="change-note"><h3>التعديل الأخير</h3>'+changeTable({...change,changes:changed})+(whole?priceDifference(change):'')+(stock?'<p>'+esc(stock)+'</p>':'')+'</section>':'';
 return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(name)+' · عرض التصميم</title><style>'+customerSheetStyle+galleryCSS+'</style></head><body data-design-revision="'+esc(stamp.revision)+'">'+
 '<header class="mast"><div class="brand">'+reportMark()+'<span>استوديو المطابخ</span></div><nav aria-label="أقسام الملف"><a href="#overview">التصميم</a><a href="#drawings">الرسومات</a><a href="#finishes">التخصيص</a></nav><button type="button" class="print" onclick="window.print()">طباعة / PDF</button></header>'+
 '<main>'+hero+'<div class="folio-id"><span>'+(example?'عرض توضيحي':doc.room.projectId?'رقم المشروع <bdi>'+esc(doc.room.projectId)+'</bdi>':'ملف تصميم المطبخ')+'</span><span>تاريخ الإصدار '+esc(day)+'</span></div>'+
 '<section class="book-section sheets" id="drawings">'+head('٠١','لوحات التصميم',schedule)+'<p class="scope">'+esc(scope)+' · أبعاد المسقط الداخلي <bdi>'+mm(arch.width*10)+' × '+mm(arch.length*10)+'</bdi></p>'+gallery+
 (comparison&&whole?'<p class="chosen"><b>'+esc(comparison.title)+'</b> '+esc(comparison.detail)+'</p>':'')+
 detail('الوحدات في الرسم · '+proposalNumber(visible.length)+' · '+scope,visible.length?distributionTable(doc,wallIds):'<p>لا توجد وحدات في هذا النطاق.</p>')+
 detail('حدود التفصيل',list(wallFacts(doc,ids).map(v=>v.label+' · '+v.detail))+list(whole?reasons:[]))+'</section>'+
 finish+details+'</section>'+delta+(review?'<section class="review">'+head('٠٣','قرارات وقياسات باقية')+'<div class="review-grid">'+review+'</div></section>':'')+
 '</main><footer><strong>استوديو المطابخ</strong><span>'+esc(stamp.status)+' · '+esc(scope)+'</span><bdi>'+esc(stamp.revision)+'</bdi></footer>'+
 '<script>if(window.parent!==window)document.documentElement.classList.add("in-preview");let folded=[];addEventListener("beforeprint",()=>{folded=Array.from(document.querySelectorAll("details:not([open])"));folded.forEach(d=>d.open=true)});addEventListener("afterprint",()=>folded.forEach(d=>d.open=false));</script></body></html>';
}

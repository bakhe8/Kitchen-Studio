import {ownKey,inheritedName} from './kitchen-safe-keys.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
// Factory-published kits, evaluated in wall-local millimetres. The takeoff,
// customer view, service path and inspection dimensions share this geometry.
import {architectureWall,architectureWallPoint,architectureContainsPolygon} from './kitchen-architecture.js';
import {convexIntersection} from './kitchen-oriented.js';
import {surveyServiceBlocks} from './kitchen-service-zones.js';
import {inwardDoorSectors} from './kitchen-placement.js';
import {offlineDigest} from './kitchen-workshop-revision.js';

const key=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_.-]{0,47}$/i.test(v)&&!inheritedName(v)&&!['constructor','prototype','__proto__'].includes(v);
const word=(v,n)=>typeof v==='string'&&!!v.trim()&&v.length<=n;
const num=(v,l,h)=>Number.isFinite(v)&&v>=l&&v<=h;
const round=n=>Math.round(n*1000)/1000;
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
export const accessoryTypes={roller:'ستارة رول',track:'ستارة بمجرى تتجمع عند طرف البداية',heater:'غطاء سخان بجانبين وواجهة قابلة للفك'};
export function cleanWallAccessories(raw,items){
 if(raw==null)return {};
 if(typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>64)return null;
 const result={};
 for(const [id,r] of Object.entries(raw)){
  if(!key(id)||!r||!ownKey(accessoryTypes,r.kind)||!word(r.label,84)||!word(r.reference,160)||!num(r.minWidth,1,6000)||!num(r.maxWidth,r.minWidth,6000)||!num(r.maxHeight,1,6000))return null;
  const data={kind:r.kind,label:r.label.trim(),reference:r.reference.trim(),minWidth:r.minWidth,maxWidth:r.maxWidth,maxHeight:r.maxHeight};
  const sku=(k,kind)=>{const item=items.get(r[k]);if(!item||item.kind!==kind)return false;data[k]=item.sku;return true;};
  const dimension=(k,lo,hi)=>{if(!num(r[k],lo,hi))return false;data[k]=r[k];return true;};
  if(r.kind==='heater'){
   if(!sku('sides','panel')||!sku('face','panel')||!sku('clips','piece')||!sku('mount','piece')||!word(r.model,100)||!word(r.permission,160)||
    !['innerGap','lift','pull','edgeBand','ventMin'].every(k=>dimension(k,0,k==='ventMin'?1e7:2500))||!dimension('faceFreePct',0,100)||
     !dimension('clipCount',1,64)||!Number.isInteger(r.clipCount)||!dimension('mountCount',1,64)||!Number.isInteger(r.mountCount)||
     !items.get(r.sides).thicknessMm||!items.get(r.face).thicknessMm||r.pull<=0)return null;
   data.model=r.model.trim();data.permission=r.permission.trim();
  }else{
   if(!sku('rail','bar')||!sku('cloth','panel')||!sku('fixing','piece')||!dimension('projection',1,1000)||!dimension('headHeight',1,1000)||
    !dimension('railDeduct',0,1000)||!dimension('clothDeduct',0,1000)||!dimension('hem',0,2000)||!dimension('fullness',1,5)||!dimension('parked',1,3000)||
    r.kind==='track'&&!dimension('fixPitch',10,5000)||r.kind==='roller'&&r.fullness!==1)return null;
  }
  if(r.extras!==undefined){
   if(!Array.isArray(r.extras)||r.extras.length>20)return null;
   const list=[];for(const x of r.extras){
    if(!x||!word(x.label,84)||!['fixed','pitch','span'].includes(x.rule)||items.get(x.sku)?.kind!==(x.rule==='span'?'bar':'piece')||
     x.rule==='fixed'&&(!Number.isInteger(x.value)||!num(x.value,1,200))||x.rule==='pitch'&&!num(x.value,10,6000)||x.rule==='span'&&!num(x.value,-1000,1000))return null;
    list.push({label:x.label.trim(),rule:x.rule,sku:x.sku,value:x.value});
   }if(list.length)data.extras=list;
  }
  result[id]=data;
 }return result;
}
export const accessoryChoice=(o,kind,id)=>kind==='curtain'?o?.curtains?.[id]:o?.heaters?.[id];
export function wallAccessoryApproval(room,k,wall,fid,catalog,o){
 const f=k.features.find(f=>f.wall===wall&&f.id===fid),h=o.heaters?.[fid],r=h?.recipe&&catalog?.wallAccessories?.[h.recipe],edge=architectureWall(room,wall);if(!r||!f||!edge)return '';
 const {kitProof,reviewed,...rest}=h;
 const itemDims=[r.sides,r.face].map(s=>catalog.items.find(i=>i.sku===s)?.thicknessMm);
 return offlineDigest(new TextEncoder().encode(stable([f,edge.a,edge.b,room.height,rest,r,itemDims])));
}
function colorOf(c,i){
 const m=c?.items?.find(m=>m.sku===i);return /^#[0-9a-f]{6}$/i.test(m?.colorHex||m?.color||'')?(m.colorHex||m.color):null;
}
export function wallAssembly(room,f,option,catalog){
 const heater=f.kind==='heater',r=option?.recipe&&catalog?.wallAccessories?.[option.recipe];
 if(!option||heater&&option.state!=='cover'||!heater&&option.state==='none')return null;
 const result={bodies:[],paths:[],parked:[],pieces:[],issues:[],reference:r?.reference,recipeId:option.recipe};
 const issue=s=>result.issues.push(s);
 const box=(role,x,y,z,w,h,d,color)=>({role,wall:f.wall,featureId:f.id,x,y,z,w,h,d,color});
 const part=(sku,label,count,a=null,b=null,operation='تركيب حسب مرجع المصنع')=>{
  const stock=catalog?.items?.find(i=>i.sku===sku);
  if(!stock||a!==null&&a<=0||b!==null&&b<=0){issue('مادة أو مقاس قطع غير صالح · '+label);return;}
  const unitId='wall:'+f.wall+':'+(heater?'heater-cover':'curtain')+':'+f.id;
  result.pieces.push({unitId,runId:f.wall,family:heater?'heater-cover':'curtain',sku:stock.sku,kind:stock.kind,label,count,a:a===null?null:round(a),b:b===null?null:round(b),operation,recipeId:option.recipe,drawing:r.reference});
 };
 const fx=f.u*10,fy=f.bottom*10,fw=f.width*10,fh=f.height*10,fd=f.depth*10;
 if(!heater){
  const W=fw+option.leftMm+option.rightMm,H=option.dropMm,x=fx-option.leftMm,top=fy+fh+option.aboveMm,D=r?.projection??option.projectionMm;
  if(!(H>0&&D>0))return null;
  const head=r?.headHeight??Math.min(25,H*.15),clothDepth=Math.min(2,D/2);
  const rail=box('curtain-head',x,top-head,0,W,head,D,colorOf(catalog,r?.rail)||'#8b8580');
  const cloth=(x,y,w,h)=>box('curtain-cloth',x,y,D-clothDepth,w,h,clothDepth,colorOf(catalog,r?.cloth)||'#a2b3a1');
  const closed=cloth(x,top-H,W,H-head),parked=(r?.kind||option.type)==='track'?cloth(x,top-H,Math.min(W,r?.parked??W),H-head):cloth(x,top-head-Math.min(H-head,r?.parked??(H-head)),W,Math.min(H-head,r?.parked??(H-head)));
  result.closed=[rail,closed];result.parked=[rail,parked];result.bodies=option.pose==='parked'&&r?result.parked:result.closed;
  if(!r){if(option.recipe)issue('وصفة الستارة المختارة غير متاحة في كتالوج المشروع.');return result;}
  if(r.kind!==option.type||r.kind==='heater'){issue('نوع الستارة لا يطابق الوصفة المنشورة.');return result;}
  if(W<r.minWidth||W>r.maxWidth||H>r.maxHeight||H<=head||r.kind==='track'&&r.parked>W||r.kind==='roller'&&r.parked>H-head)issue('مقاس الستارة أو جزء التجميع يتجاوز حدود موديل المورد.');
  if(Math.abs(option.projectionMm-D)>.001)issue('تغير بروز نظام الستارة. أعد تطبيق موديل المصنع على الشباك.');
  const clothW=(W-r.clothDeduct)*r.fullness,railW=W-r.railDeduct;
  part(r.rail,r.kind==='track'?'مجرى الستارة':'أنبوب الرول',1,railW,null,'قص بالطول بعد خصم النهايات');
  part(r.cloth,'قماش الستارة من خام المورد',1,H-head+r.hem,clothW,'الضلع الأول في اتجاه طول الخام؛ عرض شامل التجميع الموثق');
  const count=r.kind==='roller'?2:Math.max(2,Math.ceil(railW/r.fixPitch)+1);part(r.fixing,'حامل تثبيت الستارة',count);
 }else{
  if(!r||r.kind!=='heater'){if(option.recipe)issue('وصفة غطاء السخان المختارة غير موجودة.');return result;}
  if(!['leftMm','rightMm','aboveMm','belowMm','frontMm'].every(k=>Number.isFinite(option[k]))){issue('تحتاج أبعاد الغطاء إلى خلوصات دليل السخان.');return result;}
  if(r.model!==option.model?.trim())issue('وصفة الغطاء مرخصة في الكتالوج لموديل سخان مختلف.');
  const side=catalog.items.find(i=>i.sku===r.sides)?.thicknessMm,face=catalog.items.find(i=>i.sku===r.face)?.thicknessMm;
  if(!(side>0&&face>0)){issue('يلزم سمك ألواح الجانبين والواجهة.');return result;}
  const clear=fw+option.leftMm+option.rightMm,W=clear+2*side,H=fh+option.aboveMm+option.belowMm,D=fd+r.innerGap;
  const x=fx-option.leftMm-side,y=fy-option.belowMm;
  if(W<r.minWidth||W>r.maxWidth||H>r.maxHeight)issue('الغلاف خارج مجال المقاس الذي اعتمده المصنع للغطاء.');
  const vent=Math.max(0,clear-2*r.edgeBand)*Math.max(0,H-2*r.edgeBand)*r.faceFreePct/100;
  if(vent+.001<r.ventMin)issue('مساحة التهوية الصافية '+round(vent)+' مم² أقل من متطلب الغطاء '+r.ventMin+' مم².');
  result.ventMm2=vent;
  const sideC=colorOf(catalog,r.sides)||'#b7b6ae',faceC=colorOf(catalog,r.face)||'#e1dfd6';
  result.bodies=[box('cover-side',x,y,0,side,H,D,sideC),box('cover-side',x+W-side,y,0,side,H,D,sideC),box('cover-face',x,y,D,W,H,face,faceC)];
  result.paths=[box('cover-lift',x,y,D,W,H+r.lift,face),box('cover-pull',x,y+r.lift,D,W,H,face+r.pull),box('heater-service',x+side,y,0,clear,H,fd+option.frontMm)];
  part(r.sides,'جانبا غطاء السخان',2,H,D,'قص ارتفاع × عمق الجانب');part(r.face,'واجهة غطاء السخان القابلة للفك',1,H,W,'قص ارتفاع × عرض الواجهة حسب دليل التهوية');
  part(r.clips,'مشبك واجهة الغطاء',r.clipCount);part(r.mount,'مثبت جانبي الغطاء',r.mountCount);
 }
 const span=heater?result.bodies.at(-1).w:result.bodies[0].w;
 for(const extra of r.extras||[]){
  if(extra.rule==='span')part(extra.sku,extra.label,1,span+extra.value,null,'طول التركيب مع بدل طرفي الموديل');
  else part(extra.sku,extra.label,extra.rule==='fixed'?extra.value:Math.ceil(span/extra.value)+1);
 }
 return result;
}
export const volumePolygon=(room,v)=>[[v.x,v.z],[v.x+v.w,v.z],[v.x+v.w,v.z+v.d],[v.x,v.z+v.d]].map(([u,d])=>architectureWallPoint(room,v.wall,u/10,d/10));
const polyVolume=(room,v)=>({polygon:volumePolygon(room,v),bottom:v.y/10,height:v.h/10});
const overlap=(a,b)=>Math.min(a.bottom+a.height,b.bottom+b.height)>Math.max(a.bottom,b.bottom)+1e-6&&convexIntersection(a.polygon,b.polygon).length>0;
export function assemblyIssues(doc,f,assembly,geometry){
 if(!assembly)return [];const room=doc.room,result=[...assembly.issues],edge=architectureWall(room,f.wall);if(!edge)return ['تعذر تحديد جدار الملحق.'];
 const vlist=f.kind==='heater'?[...assembly.bodies,...assembly.paths]:(assembly.closed||assembly.bodies);
 const other=[...geometry.units.flatMap(u=>[...(u.bodyParts||[u]),...u.openParts]),...geometry.worktops,...(geometry.cornerBodies||[]).flatMap(c=>c.parts),...geometry.features.filter(o=>o.id!==f.id&&['column','shaft','beam','heater','door','window'].includes(o.kind)),...inwardDoorSectors(geometry).filter(o=>o.id!==f.id)];
 for(const f2 of doc.kitchen.features){
  if(f2.id===f.id)continue;const o=room.workshop?.options?.[f2.wall];
  const v=f2.kind==='heater'?o?.heaters[f2.id]:f2.kind==='window'?o?.curtains[f2.id]:null;
  if(!v)continue;const a=wallAssembly(room,f2,v,readWorkshopCatalog(room.workshop));
  for(const b of a?.closed||a?.bodies||[])other.push({...polyVolume(room,b),id:f2.id});
 }
 for(const [wall,o] of Object.entries(room.workshop?.options||{})){
  const edge=architectureWall(room,wall);if(!edge)continue;
  for(const p of o.profiles||[]){const b={wall,x:edge.start*10+p.fromMm,y:p.bottomMm,z:0,w:p.toMm-p.fromMm,h:p.topMm-p.bottomMm,d:p.depthMm};other.push({...polyVolume(room,b),id:p.id});}
 }
 other.push(...surveyServiceBlocks(room));
 for(const v of vlist){
  const poly=polyVolume(room,v);
  if(v.x<edge.start*10-.001||v.x+v.w>edge.end*10+.001||v.y<-.001||v.y+v.h>room.height*10+.001||!architectureContainsPolygon(room,poly.polygon))result.push('يتجاوز حيز '+f.id+' حدود الجدار أو السقف أو الغرفة.');
  const peer=other.find(o=>overlap(poly,o));if(peer)result.push('يتعارض '+(v.role==='cover-pull'||v.role==='cover-lift'?'مسار فك الواجهة':v.role==='heater-service'?'حيز صيانة السخان':'الملحق')+' مع '+(peer.id||peer.label||'عنصر مرسوم')+'.');
 }
 if(f.kind==='window'&&assembly.recipeId&&assembly.parked.length){
  if(!f.swing)result.push('حدّد حركة الشباك لتأكيد خلوص الستارة عند فتحه.');
  const sweep=inwardDoorSectors(geometry).find(o=>o.id===f.id);
  if(sweep&&assembly.parked.some(v=>overlap(polyVolume(room,v),sweep)))result.push('ضلفة الشباك تصطدم بالستارة حتى بعد تجميعها. غيّر امتدادها أو منسوب تثبيتها.');
 }
 return [...new Set(result)];
}

// A partial cabinet release must honor the adjacent accessory even when that
// accessory will be purchased or manufactured on a later receipt.
export function accessoryCabinetIssues(doc,scope,geometry){
 const selected=new Set(scope?.unitIds||[]),issues=[];
 for(const f of doc.kitchen.features){
  const o=doc.room.workshop?.options?.[f.wall],v=f.kind==='heater'?o?.heaters?.[f.id]:f.kind==='window'?o?.curtains?.[f.id]:null;
  if(!v)continue;const a=wallAssembly(doc.room,f,v,readWorkshopCatalog(doc.room.workshop));if(!a)continue;
  const volumes=[...(a.closed||a.bodies),...a.paths].map(b=>polyVolume(doc.room,b));
  for(const u of geometry.units.filter(u=>selected.has(u.id))){
   const relevant=[...(u.bodyParts||[u]),...u.openParts];
   for(const t of geometry.worktops.filter(t=>t.runId===u.runId&&t.end>u.u&&t.start<u.u+u.width)){
    const polygon=convexIntersection(t.polygon,u.polygon);if(polygon.length)relevant.push({...t,polygon});
   }
   if(volumes.some(b=>relevant.some(p=>overlap(b,p))))issues.push('تتداخل الوحدة '+u.id+' مع الملحق أو مع حيز الخدمة المرتبط بـ '+f.id+'.');
  }
 }return [...new Set(issues)];
}

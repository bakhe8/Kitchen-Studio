import {ownKey,inheritedName} from './kitchen-safe-keys.js';
// All support dimensions are millimetres relative to the bottom of the installed
// run. A measured masonry ledge is already represented by run.bottom.
import {architectureWall} from './kitchen-architecture.js';
import {kitchenUnitSpecs} from './kitchen-catalog.js';

const plain = v => !!v && typeof v === 'object' && !Array.isArray(v);
const key = x => typeof x === 'string' && /^[a-z0-9][a-z0-9_.-]{0,79}$/i.test(x)&&!inheritedName(x) && !['constructor','prototype','__proto__'].includes(x);
const ref = x => typeof x === 'string' && x.trim() && x.length <= 180;
const number = (n,lo,hi) => Number.isFinite(n) && n >= lo && n <= hi;
const qty = n => Number.isInteger(n) && number(n,1,64);
const rnd = n => Math.round(n*1000)/1000;
const bag = (v,n) => plain(v) && Object.keys(v).length <= n && Object.keys(v).every(key);
const eq = (a,b) => Math.abs(a-b)<.001;
const modes = ['legs','platform','integral','suspended'];
const sites = ['any','floor','platform'];
const appliances = new Set(['dishwasher','fridge','freezer','oven','microwave','laundry-bay','hood']);
const defaultBook = () => ({rules:{},aprons:{}});
const defaultChoices = () => ({runs:{},units:{}});
export const baseModeNames = {legs:'أرجل قابلة للضبط',platform:'ارتكاز مباشر على تعلية قائمة',integral:'قاعدة مدمجة في جسم الدولاب',suspended:'تثبيت معلّق',unknown:'لم يحدَّد',excluded:'خارج حصر القواعد'};

export function cleanBaseSupportBook(raw,items,families){
 if(raw==null)return defaultBook();
 if(!plain(raw)||!bag(raw.rules,128)||!bag(raw.aprons,64))return null;
 const book=defaultBook();
 for(const [id,a] of Object.entries(raw.aprons)){
  const item=items.get(a?.sku);
  if(id==='none'||!item||!['bar','panel'].includes(item.kind)||!ref(a.label)||!ref(a.reference)||
     !number(a.heightMm,1,800)||!number(a.insetMm,0,1000)||!number(a.thicknessMm,.1,100)||
     !['included','separate'].includes(a.fixing))return null;
  if(item.kind==='bar'&&!eq(item.sectionWidthMm,a.heightMm)||item.kind==='panel'&&!eq(item.thicknessMm,a.thicknessMm))return null;
  if(a.fixing==='separate'&&(items.get(a.clipSku)?.kind!=='piece'||!qty(a.clipsPerUnit)))return null;
  book.aprons[id]={label:a.label.trim(),reference:a.reference.trim(),sku:a.sku,heightMm:a.heightMm,insetMm:a.insetMm,thicknessMm:a.thicknessMm,fixing:a.fixing,
   ...(a.fixing==='separate'?{clipSku:a.clipSku,clipsPerUnit:a.clipsPerUnit}:{})};
 }
 for(const [id,r] of Object.entries(raw.rules)){
  if(!r||!ref(r.label)||!ref(r.reference)||!ownKey(families,r.family)||families[r.family].customerBay||['upperStorage','dishwasher'].includes(r.family)||
     !modes.includes(r.mode)||!sites.includes(r.site)||typeof r.default!=='boolean'||!number(r.minWidthMm,1,12000)||!number(r.maxWidthMm,r.minWidthMm,12000)||
     !number(r.bodyClearMm,0,2000)||(r.apron!=='none'&&!ownKey(book.aprons,r.apron)))return null;
  if(r.recipeHeightBasis!=null&&!['net','envelope'].includes(r.recipeHeightBasis))return null;
  if(r.mode==='legs'&&r.bodyClearMm<=0||r.mode==='platform'&&r.bodyClearMm!==0)return null;
  // The integral base belongs to the existing body recipe. It must remain a
  // full-height body unless its fabrication has its own documented framing.
  if(r.mode==='integral'&&r.bodyClearMm!==0)return null;
  const a={label:r.label.trim(),reference:r.reference.trim(),family:r.family,mode:r.mode,site:r.site,default:r.default,minWidthMm:r.minWidthMm,maxWidthMm:r.maxWidthMm,bodyClearMm:r.bodyClearMm,recipeHeightBasis:r.recipeHeightBasis||'net',apron:r.apron};
  if(['legs','suspended'].includes(r.mode)){
   if(items.get(r.sku)?.kind!=='piece'||!qty(r.count)||!['assembly','family'].includes(r.supply))return null;
   Object.assign(a,{sku:r.sku,count:r.count,supply:r.supply});
  }
  if(r.default&&Object.values(book.rules).some(o=>o.default&&o.family===r.family&&o.site===r.site&&o.maxWidthMm>=r.minWidthMm&&o.minWidthMm<=r.maxWidthMm))return null;
  book.rules[id]=a;
 }
 return book;
}
export function cleanBaseSupportChoices(raw){
 if(!plain(raw)||!bag(raw.units,1200)||!bag(raw.runs,80))return null;
 const out=defaultChoices();
 for(const group of ['runs','units'])for(const [id,v] of Object.entries(raw[group])){
  if(!plain(v)||Object.keys(v).some(k=>!['rule','apron','reference'].includes(k))||
     (v.rule!=null&&!key(v.rule))||(v.apron!=null&&!key(v.apron))||(v.reference!=null&&!ref(v.reference)))return null;
  if(Object.keys(v).length)out[group][id]={...(v.rule?{rule:v.rule}:{}),...(v.apron?{apron:v.apron}:{}),...(v.reference?{reference:v.reference.trim()}:{})};
 }
 return out;
}

// Historical imports may contain a dangling selection. Leave it visible until
// the user repairs it. An actual deletion/replacement is part of the same
// undoable edit as removing its binding, so a recycled CAD ID cannot inherit it.
export function pruneBaseSupportChoices(doc,before){
 const current=doc.room.workshop?.baseSupport;
 if(!current)return doc;
 const next={...current};let changed=false;
 for(const group of ['units','runs']){
  const live=new Map(doc.kitchen[group].map(v=>[v.id,v]));
  const old=new Map((before?.kitchen?.[group]||[]).map(v=>[v.id,v]));
  const drop=Object.keys(current[group]).filter(id=>{
   const a=old.get(id),b=live.get(id);
   if(!before)return !b;
   if(a&&!b)return true;
   if(!a&&b)return !!before.room.workshop?.baseSupport?.[group]?.[id];
   return a&&b&&(group==='units'?a.kind!==b.kind:a.tier!==b.tier);
  });
  if(drop.length){
   next[group]={...current[group]};for(const id of drop)delete next[group][id];changed=true;
  }
 }
 return changed?{...doc,room:{...doc.room,workshop:{...doc.room.workshop,baseSupport:next}}}:doc;
}

function unitMm(u,r,axis){
 return u.modelSpec?.[axis+'Mm']??((u[axis]??kitchenUnitSpecs[u.kind]?.[axis]??r[axis])*10);
}
function ledgeUnder(doc,run,u){
 if(!run.wall||run.placement==='free')return {site:Math.abs(run.bottom)<.001?'floor':'unknown'};
 const profiles=doc.room.workshop?.options?.[run.wall]?.profiles?.filter(p=>p.type==='ledge');
 if(!profiles?.length)return {site:Math.abs(run.bottom)<.001?'floor':'unknown'};
 const edge=architectureWall(doc.room,run.wall);
 if(!edge)return {site:'unknown'};
 const x=u.u*10-edge.start*10,end=x+u.width*10,depth=unitMm(u,run,'depth');
 const touch=profiles.filter(p=>p.fromMm<end-.001&&p.toMm>x+.001);
 const full=touch.filter(p=>p.fromMm<=x+.001&&p.toMm>=end-.001&&p.depthMm>=depth-.001).sort((a,b)=>b.topMm-a.topMm);
 const ledge=full[0];
 if(ledge&&eq(ledge.topMm,run.bottom*10)&&touch.every(p=>p.topMm<=ledge.topMm+.001))
  return {site:'platform',ledge:ledge.id,measured:!!ref(ledge.reference)&&doc.room.workshop?.chains?.[run.wall]?.source==='field'};
 return {site:touch.length||run.bottom>0?'unknown':'floor'};
}

export function resolveUnitSupport(doc,catalog,u,run){
 const w=doc.room.workshop||{}, book=catalog?.baseSupport||defaultBook(), choices=w.baseSupport||defaultChoices();
 const entry=w.rows?.[run?.id]?.units?.find(e=>e.id===u.id);
 const familyKinds={storage:'storage',rice:'drawers',sink:'sink'};
 const alternatives=Object.entries(catalog?.families||{}).filter(([id,f])=>id!=='upperStorage'&&f.base!=='upperStorage'&&!f.customerBay&&(f.cadKind||familyKinds[f.base||id])===u.kind).map(([id])=>id);
 const candidate=book.rules[choices.units?.[u.id]?.rule||choices.runs?.[run?.id]?.rule]?.family;
 const family=entry?.recipeId||entry?.family||(alternatives.includes(candidate)?candidate:u.kind);
 const realFamily=catalog?.families?.[family],special=catalog?.specials?.['unit:'+u.id];
 const excluded=run?.tier!=='base'||realFamily?.customerBay||family==='dishwasher'||special?.bay||
   appliances.has(u.kind)&&(!entry||!realFamily?.recipe?.length);
 const out={id:u.id,runId:u.runId,family,compatibleFamilies:entry?[family]:alternatives,applicable:!excluded,mode:excluded?'excluded':'unknown',apron:excluded?'none':'unknown',bodyClearMm:0,
  legCount:0,legSku:null,apronHeightMm:0,apronInsetMm:0,apronThicknessMm:0,pads:[],issues:[],releaseIssues:[]};
 if(excluded)return out;
 const context=ledgeUnder(doc,run,u),rowChoice={...choices.runs?.[run.id]};
 if(rowChoice.rule&&book.rules[rowChoice.rule]&&book.rules[rowChoice.rule].family!==family)delete rowChoice.rule;
 const choice={...rowChoice,...choices.units?.[u.id]},width=u.width*10,depth=unitMm(u,run,'depth');
 const matches=r=>r.family===family&&width>=r.minWidthMm&&width<=r.maxWidthMm&&(r.site==='any'||r.site===context.site);
 const autos=Object.entries(book.rules).filter(([,r])=>r.default&&matches(r)).sort(([,a],[,b])=>Number(a.site==='any')-Number(b.site==='any'));
 const ruleId=choice.rule||autos[0]?.[0],rule=book.rules[ruleId];
 out.site=context.site;out.ruleId=ruleId??null;out.inspection=choice.reference||'';
 const point=w.surfaces3d?.checks?.find(c=>c.target===u.id)?.support;
 if(!rule||!matches(rule)){
  out.issues.push(ruleId?'تفصيل القاعدة غير موجود أو لا يطابق عائلة الوحدة وعرضها وموضع ارتكازها.':'اختر تفصيل ارتكاز من كتالوج المصنع لهذه الوحدة.');
 }else{
  out.mode=rule.mode;out.bodyClearMm=rule.bodyClearMm;out.reference=rule.reference;out.recipeHeightBasis=rule.recipeHeightBasis||'net';
  if(rule.bodyClearMm>=unitMm(u,run,'height'))out.issues.push('فراغ القاعدة يستهلك كامل ارتفاع الجسم.');
  if(rule.mode==='legs'){
   out.legSku=rule.sku;out.legCount=rule.count;
   if(point&&point.pads.length===rule.count&&eq(point.mountMm,rule.bodyClearMm))out.pads=point.pads;
   else out.releaseIssues.push('طابق عدد مواضع الأرجل وارتفاع تثبيتها مع مخطط الأرجل في الرفع.');
   if(!w.surfaces3d?.patches?.some(p=>p.kind==='floor'||p.kind==='plinth'))out.releaseIssues.push('يلزم رفع منسوب سطح الارتكاز للتحقق من مجال ضبط الأرجل.');
  }
  if(rule.mode==='platform'&&!(context.site==='platform'&&context.measured))
   out.releaseIssues.push('تحقق من تعلية مقاسة تغطي طول الوحدة وعمقها ومنسوب أسفلها في رفع الجدار.');
  if(context.site==='unknown'&&rule.mode!=='suspended')out.releaseIssues.push('منسوب الأرض أو تغطية التعلية غير محسومين عند هذه الوحدة.');
  if(rule.mode==='integral'&&!choice.reference)out.releaseIssues.push('سجّل مرجع مطابقة منسوب القاعدة المدمجة في الموقع.');
  if(rule.mode==='suspended'&&!choice.reference)out.releaseIssues.push('سجّل مطابقة تثبيت الوحدة المعلّقة للجدار ومرجع المراجعة.');
  if(point&&rule.mode!=='legs')out.releaseIssues.push('يوجد جدول أرجل لهذه الوحدة يخالف طريقة الارتكاز المختارة.');
  if(!entry&&out.bodyClearMm>0)out.releaseIssues.push('راجع ارتفاع الجسم والواجهة في رسم الوحدة الخاصة بعد خصم فراغ الارتكاز.');
 }
 const apronId=choice.apron??(out.mode!=='unknown'?rule.apron:undefined);
 if(apronId==='none'){out.apron='none';return out;}
 if(apronId){
  out.apronId=apronId;
  const a=book.aprons[apronId];
  if(!a){out.issues.push('تفصيل ساتر الأرجل غير موجود في الكتالوج.');return out;}
  out.apron='yes';out.apronHeightMm=a.heightMm;out.apronInsetMm=a.insetMm;out.apronThicknessMm=a.thicknessMm;
  if(a.heightMm>out.bodyClearMm+.001||a.insetMm+a.thicknessMm>=depth){
   out.issues.push('يتجاوز الساتر فراغ القاعدة أو عمق الوحدة. راجع مقطع الساتر ومناسيبه.');out.apronFits=false;
  }else out.apronFits=true;
 }
 return out;
}

// Shared strips are split at a real cabinet joint when stock would be too
// short. A partial receipt must own all units on each shared physical cut.
export function baseSupportTakeoff(doc,catalog,scope,priorPieces=[]){
 const w=doc.room.workshop||{},book=catalog?.baseSupport||defaultBook();
 const known=!!w.baseSupport||Object.keys(book.rules).length>0||Object.keys(book.aprons).length>0;
 const selected=scope?new Set(scope.unitIds||[]):null,has=id=>!selected||selected.has(id);
 const items=new Map((catalog?.items||[]).map(i=>[i.sku,i])),runs=new Map(doc.kitchen.runs.map(r=>[r.id,r]));
 const pieces=[],issues=[],releaseIssues=[],units=[],aprons=[];
 const orphanIssues=[];
 for(const group of ['units','runs']){
  const ids=new Set(doc.kitchen[group].map(v=>v.id));
  for(const id of Object.keys(w.baseSupport?.[group]||{}))if(!ids.has(id))orphanIssues.push('اختيار ارتكاز مرتبط ب'+(group==='units'?'وحدة':'صف')+' محذوف · '+id);
 }
 if(!scope)releaseIssues.push(...orphanIssues);
 const prior=new Map();
 for(const p of priorPieces){const k=p.unitId+'|'+p.sku;if(!prior.has(k))prior.set(k,[]);prior.get(k).push(p);}
 function hardware(u,sku,count,supply,label,reference){
  const existing=prior.get(u.id+'|'+sku)||[],n=existing.reduce((v,p)=>v+p.count,0);
  if(supply==='family'){
   if(n!==count)issues.push(u.id+' · عدد '+label+' في وصفة الجسم لا يطابق التفصيل ('+count+').');
  }else if(n)issues.push(u.id+' · صنف '+sku+' مستخدم في وصفة الجسم. حدّد مصدر التوريد قبل الجمع.');
  else pieces.push({unitId:u.id,runId:u.runId,family:'baseSupport',recipeId:u.ruleId,sku,label,drawing:reference,kind:'piece',count,a:null,b:null});
 }
 const byRun=new Map();
 for(const u of doc.kitchen.units){
  const r=runs.get(u.runId);if(!r)continue;
  const v=resolveUnitSupport(doc,catalog,u,r);
  units.push(v);
  if(!known||!v.applicable)continue;
  if(has(u.id)){
   issues.push(...v.issues.map(s=>u.id+' · '+s));releaseIssues.push(...v.releaseIssues.map(s=>u.id+' · '+s));
   const rule=book.rules[v.ruleId];
   if(v.mode==='legs'||v.mode==='suspended')hardware(v,rule.sku,rule.count,rule.supply,v.mode==='legs'?'رجل دولاب':'تجهيز تعليق',rule.reference);
   if(v.apron==='yes'&&v.apronFits){
    const a=book.aprons[v.apronId];if(a.fixing==='separate')hardware(v,a.clipSku,a.clipsPerUnit,'assembly','مشبك ساتر قابل للفك',a.reference);
   }
  }
  if(v.apron!=='yes'||!v.apronFits)continue;
  const a=book.aprons[v.apronId],item=items.get(a.sku);
  if(!byRun.has(r.id))byRun.set(r.id,[]);
  byRun.get(r.id).push({id:u.id,runId:r.id,rule:v.apronId,sku:a.sku,startMm:rnd(u.u*10),endMm:rnd((u.u+u.width)*10),bottomMm:rnd(r.bottom*10+v.bodyClearMm-a.heightMm),
   heightMm:a.heightMm,insetMm:a.insetMm,thicknessMm:a.thicknessMm,depthMm:unitMm(u,r,'depth'),cap:item?.stockLengthMm??0});
 }
 for(const spans of byRun.values()){
  let part=null;
  for(const span of spans.sort((a,b)=>a.startMm-b.startMm)){
   if(part&&eq(part.endMm,span.startMm)&&part.rule===span.rule&&eq(part.bottomMm,span.bottomMm)&&eq(part.depthMm,span.depthMm)&&span.endMm-part.startMm<=span.cap+.001){
    part.endMm=span.endMm;part.unitIds.push(span.id);
   }else{
    const {id,cap,...rest}=span;part={...rest,unitIds:[id]};aprons.push(part);
   }
  }
 }
 for(const p of aprons){
  if(!p.unitIds.some(has))continue;
  if(p.unitIds.some(id=>!has(id))){releaseIssues.push('الساتر المتصل يخدم الوحدات '+p.unitIds.join('، ')+'؛ أدرجها معًا قبل الإفراج عن القطعة.');continue;}
  const a=book.aprons[p.rule],item=items.get(a.sku),len=rnd(p.endMm-p.startMm);
  if(!item||len>item.stockLengthMm+.001||item.kind==='panel'&&a.heightMm>item.stockWidthMm+.001){issues.push(p.runId+' · مقاس الساتر يتجاوز الخام عند وصلة الدولاب.');continue;}
  if(p.unitIds.some(id=>prior.has(id+'|'+p.sku))){issues.push(p.runId+' · صنف الساتر موجود في وصفة وحدة تخدمها القطعة. افصل حصره أو استخدم صنفًا مخصصًا.');continue;}
  pieces.push({unitId:p.unitIds[0],runId:p.runId,family:'baseApron',recipeId:p.rule,sku:p.sku,kind:item.kind,label:'ساتر أرجل أمامي قابل للفك',drawing:a.reference,
   a:len,b:item.kind==='panel'?a.heightMm:null,count:1,stationMm:p.startMm,unitIds:p.unitIds});
 }
 return {known,pieces,units,aprons,orphanIssues,issues:[...new Set(issues)],releaseIssues:[...new Set(releaseIssues)]};
}

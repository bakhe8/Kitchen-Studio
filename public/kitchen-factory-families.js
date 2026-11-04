import {ownKey} from './kitchen-safe-keys.js';
// Named factory recipes share CAD behavior. Their manufacturing knowledge is
// portable; only a concrete unit stores the selected recipe ID.
import {kitchenUnitAllowed,kitchenUnitSpecs} from './kitchen-catalog.js';
export const baseFactoryKinds={storage:'storage',upperStorage:'storage',rice:'drawers',dishwasher:'dishwasher',sink:'sink'};
export const isCustomFamily=key=>typeof key==='string'&&/^custom-[a-z0-9][a-z0-9-]{0,38}$/.test(key);
const range=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
const finiteInteger=(n,a,b)=>Number.isSafeInteger(n)&&range(n,a,b);
const note=(s,n=180)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
export const sizeKeys=['minMm','maxMm','stepMm','minHeightMm','maxHeightMm','heightStepMm','minDepthMm','maxDepthMm','depthStepMm'];
export const familyCADKind=(f,base)=>f?.cadKind||baseFactoryKinds[base];
export function recipeLineApplies(line,entry){
 return !line.when||line.when==='all'||line.when===entry.riceMode||
  (entry.riceMode==='dispenser'&&line.when==='bin'&&line.sku===entry.pantrySupply?.sku);
}
export function familyRecipeOptions(catalog,base){
 return Object.entries(catalog?.families||{}).filter(([key,f])=>(f.base||key)===base).map(([k,f])=>[k,f.label]);
}
export function factoryLayoutKey(c){
 return JSON.stringify(Object.entries(c.families).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([id,f])=>[id,f.base||id,familyCADKind(f,f.base||id),...sizeKeys.map(k=>f[k]??null)]));
}
const envelope=(value,min,max,step)=>Number.isFinite(value)&&value>0&&(min==null||value>=min-1e-6&&value<=max+1e-6&&Math.abs((value-min)/step-Math.round((value-min)/step))<1e-6);
export function checkFactorySize(f,width,height,depth){
 return !!f&&envelope(width,f.minMm,f.maxMm,f.stepMm)&&envelope(height,f.minHeightMm,f.maxHeightMm,f.heightStepMm)&&envelope(depth,f.minDepthMm,f.maxDepthMm,f.depthStepMm);
}
export function validCadChoices(base){
 const tier=base==='upperStorage'?'upper':'base';
 // Rice, water and appliance roles already own specific planning/fit behavior.
 return Object.keys(kitchenUnitSpecs).filter(k=>kitchenUnitAllowed(k,tier)&&(['storage','upperStorage'].includes(base)||k===baseFactoryKinds[base]));
}
export const materialTerms={sectionWidthMm:'عرض القطاع',thicknessMm:'سمك اللوح أو الصنف',gaugeMm:'سماكة وجه التيوب',grooveDepthMm:'عمق الأخدود'};
export const ruleMetrics={frontWidth:'عرض الدرفة أو واجهة الدرج (مم)',frontHeight:'ارتفاع الدرفة أو واجهة الدرج (مم)',frontMass:'وزن الدرفة أو واجهة الدرج (كجم)',depth:'عمق الوحدة (مم)',width:'عرض الوحدة (مم)'};
export function familyProperties(key,f,items){
 const custom=isCustomFamily(key),base=custom?f.base:key;
 if(!ownKey(baseFactoryKinds,base))return null;
 const result={};
 if(custom){
  if(!note(f.reference)||!validCadChoices(base).includes(familyCADKind(f,base)))return null;
  result.base=base;result.reference=f.reference.trim();result.cadKind=familyCADKind(f,base);
 }else if(f.base!=null&&f.base!==base||f.cadKind!=null&&f.cadKind!==baseFactoryKinds[base])return null;
 if(f.customerBay!==undefined){
  if(typeof f.customerBay!=='boolean'||f.customerBay&&(!custom||!['fridge','freezer','oven','oven-tower','dishwasher','microwave','laundry-bay','hood','hob'].includes(result.cadKind)))return null;
  if(f.customerBay)result.customerBay=true;
 }
 for(const keys of [sizeKeys.slice(3,6),sizeKeys.slice(6)]){
  const [lo,hi,step]=keys.map(k=>f[k]);
  if(lo==null&&hi==null&&step==null)continue;
  if(!finiteInteger(lo,1,12000)||!finiteInteger(hi,lo,12000)||!finiteInteger(step,1,12000))return null;
  keys.forEach(k=>{result[k]=f[k];});
 }
 if(f.frontSkus!=null){
  if(!Array.isArray(f.frontSkus)||f.frontSkus.length>200||new Set(f.frontSkus).size!==f.frontSkus.length||f.frontSkus.some(s=>items.get(s)?.role!=='front'))return null;
  if(f.frontSkus.length)result.frontSkus=[...f.frontSkus].sort();
 }
 if(f.frontMassModel!=null){
  const m=f.frontMassModel;
  if(!range(m.frameKgM,0,100)||!range(m.extraKg,0,500)||!note(m.reference))return null;
  result.frontMassModel={frameKgM:m.frameKgM,extraKg:m.extraKg,reference:m.reference.trim()};
 }
 return result;
}
export function cleanPartEngineering(line,item,by){
 const out={};
 for(const name of ['termsA','termsB']){
  const terms=line[name];
  if(terms==null)continue;
  if(!Array.isArray(terms)||terms.length>12||terms.length&&(item.kind==='piece'||name==='termsB'&&item.kind!=='panel'))return null;
  if(!terms.length)continue;
  out[name]=[];
  for(const t of terms){
   if(!t||!by.has(t.sku)||!ownKey(materialTerms,t.dimension)||!range(t.factor,-32,32)||t.factor===0)return null;
   out[name].push({sku:t.sku,dimension:t.dimension,factor:t.factor});
  }
 }
 if(line.grooveFit!=null){
  const v=line.grooveFit;
  if(item.kind!=='panel'||by.get(v.sku)?.kind!=='bar'||!range(v.minClearMm,0,100)||!range(v.maxClearMm,v.minClearMm,100)||!range(v.minEngageMm,0,500)||!note(v.reference))return null;
  out.grooveFit={sku:v.sku,minClearMm:v.minClearMm,maxClearMm:v.maxClearMm,minEngageMm:v.minEngageMm,reference:v.reference.trim()};
 }
 if(line.ends!=null){
  const v=line.ends;
  if(item.kind!=='bar'||!range(v.startDeg,-85,85)||!range(v.endDeg,-85,85)||!['near','middle','far'].includes(v.datum)||!note(v.reference))return null;
  out.ends={startDeg:v.startDeg,endDeg:v.endDeg,datum:v.datum,reference:v.reference.trim()};
 }
 if(line.hardwareRule!=null){
  const v=line.hardwareRule;
  if(item.kind!=='piece'||!note(v.group,50)||!ownKey(ruleMetrics,v.metric)||!range(v.min,0,100000)||!range(v.max,v.min,100000)||!note(v.reference))return null;
  if(v.priority!=null&&!finiteInteger(v.priority,1,100))return null;
  if(['__proto__','prototype','constructor'].includes(v.group.trim()))return null;
  out.hardwareRule={...(v.priority!=null?{priority:v.priority}:{}),group:v.group.trim(),metric:v.metric,min:v.min,max:v.max,reference:v.reference.trim()};
 }
 return out;
}
export function applyMaterialTerms(initial,terms,lookup){
 let total=initial;
 for(const term of terms||[]){
  const n=lookup.get(term.sku)?.[term.dimension];
  if(!Number.isFinite(n))return {issue:'تنقص قيمة '+materialTerms[term.dimension]+' للصنف '+term.sku+'.'};
  total+=term.factor*n;
 }
 return {value:Math.round(total*1000)/1000};
}
export function finishBarEnds(datumLength,item,ends){
 if(!ends)return {a:datumLength};
 const w=item.sectionWidthMm;
 if(!Number.isFinite(w)||w<=0)return {issue:'أدخل عرض مقطع '+item.sku+' لحساب زاويتي طرفيه.'};
 const datum={near:0,middle:.5,far:1}[ends.datum]*w;
 const start=Math.tan(ends.startDeg*Math.PI/180),end=Math.tan(ends.endDeg*Math.PI/180);
 const left=[-datum*start,(w-datum)*start],right=[datumLength-datum*end,datumLength+(w-datum)*end];
 if(right.some((r,i)=>r<=left[i]))return {issue:'تتقاطع نهايتا القطعة بحسب زاويتي القص والبعد المرجعي.'};
 const zero=Math.min(...left);
 return {a:Math.round((Math.max(...right)-zero)*1000)/1000,datumLengthMm:datumLength,ends,cutEnvelope:{width:w,left:left.map(x=>x-zero),right:right.map(x=>x-zero)}};
}
export function hardwareChoiceOptions(catalog,familyId){
 const groups=new Map();
 for(const row of catalog.families[familyId]?.recipe||[]){
  const rule=row.hardwareRule;if(!rule)continue;
  if(!groups.has(rule.group))groups.set(rule.group,new Map());
  groups.get(rule.group).set(row.sku,catalog.items.find(i=>i.sku===row.sku)?.name||row.sku);
 }
 return [...groups].map(([group,items])=>({group,choices:[...items].map(([sku,label])=>({sku,label}))}));
}
export function selectHardware(rows,metrics,where,bySku=new Map(),pins={}){

 const groups=new Map(),keep=[];
 for(const row of rows){const rule=row.hardwareRule;if(!rule){keep.push(row);continue;}
  const list=groups.get(rule.group)||[];list.push(row);groups.set(rule.group,list);
 }
 const issues=[];
 for(const [group,list] of groups){
  const axes=new Set(list.map(p=>p.hardwareRule.metric));if(axes.size!==1){issues.push('قواعد بدائل '+group+' تحتاج مقياسًا واحدًا.');continue;}
  const value=metrics[list[0].hardwareRule.metric];
  if(!Number.isFinite(value)){issues.push('لا يمكن اختيار '+group+' حتى توثيق '+ruleMetrics[list[0].hardwareRule.metric]+' في '+where+'.');continue;}
  const fit=list.filter(p=>value>=p.hardwareRule.min-1e-6&&value<=p.hardwareRule.max+1e-6);
  const pin=ownKey(pins,group)?pins[group]:null;
  let chosen=null;
  if(pin){const valid=fit.filter(p=>p.sku===pin);if(valid.length===1)chosen=valid[0];else{issues.push('صنف العميل المثبت '+pin+' لا يطابق قاعدة '+group+' الحالية في '+where+'.');continue;}}
  else if(fit.length===1)chosen=fit[0];
  else if(fit.length>1&&fit.every(p=>Number.isInteger(p.hardwareRule.priority))&&new Set(fit.map(p=>p.hardwareRule.priority)).size===fit.length){
   // Rank only alternatives explicitly approved for this family by the supplier.
   // A pinned SKU is never replaced. The authoritative ledger confirms allocation later.
   fit.sort((a,b)=>a.hardwareRule.priority-b.hardwareRule.priority);
   chosen=fit.find(p=>{const i=bySku.get(p.sku);return i&&(i.available||i.stockUnits!=null&&i.stockUnits>=p.count);})||fit[0];
  }
  if(!chosen){issues.push((fit.length?'تداخل نطاقات بدائل غير مرتبة لـ ':'لا يوجد بديل معتمد لـ ')+group+' في '+where+' عند '+Number(value.toFixed(3))+'.');continue;}
  keep.push({...chosen,selectionValue:value,...(pin?{pinnedHardware:true}:{}),...(fit.length>1&&chosen!==fit[0]?{replacedSku:fit[0].sku}:{})});
 }
 for(const key of Object.keys(pins))if(!groups.has(key))issues.push('قاعدة الصنف المثبت '+key+' غير موجودة في وصفة '+where+'.');
 return {rows:keep,issues};
}

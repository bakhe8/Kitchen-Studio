import {resolveUnitSupport} from './kitchen-base-support.js';
import {pantryUnitIssues} from './kitchen-pantry-brief.js';
import {getFactoryCatalog} from './kitchen-workshop-factory.js';

const positive=x=>Number.isFinite(x)&&x>0;
const dimension=x=>positive(x)&&x<=3000;
const weight=x=>positive(x)&&x<=500;
export function cleanRiceCheck(v){
 const auto=v?.drawerIndex!=null;if(auto&&(!Number.isInteger(v.drawerIndex)||v.drawerIndex<1||v.drawerIndex>8))return null;
 if(!v||!['bags','bin','owned','dispenser'].includes(v.mode)||!['one','stack'].includes(v.layers)||!auto&&!['moving','payload'].includes(v.ratingBasis)||!(auto?['source']:['sku','manual','source']).every(k=>typeof v[k]==='string'&&v[k].trim()&&v[k].length<=160)||!/^r-[0-9a-f]{8}$/.test(v.signature||''))return null;
 if(!(auto?[v.amountKg,v.packageKg]:[v.amountKg,v.packageKg,v.loadKg]).every(weight)||!(auto?[v.packagingKg]:[v.drawerKg,v.packagingKg]).every(x=>Number.isFinite(x)&&x>=0&&x<=500))return null;
 for(const o of [v.pack,v.inside])if(!o||!['w','d','h'].every(k=>dimension(o[k])))return null;
 const shape=o=>({w:o.w,d:o.d,h:o.h});
 return {mode:v.mode,...(auto?{drawerIndex:v.drawerIndex}:{sku:v.sku.trim(),manual:v.manual.trim(),drawerKg:v.drawerKg,loadKg:v.loadKg,ratingBasis:v.ratingBasis}),source:v.source.trim(),amountKg:v.amountKg,packageKg:v.packageKg,packagingKg:v.packagingKg,layers:v.layers,pack:shape(v.pack),inside:shape(v.inside),signature:v.signature};
}
export function riceSiteKey(doc,run,unit,entry){
 const cat=getFactoryCatalog(doc),recipe=cat.families[entry.recipeId||'rice']?.recipe||[],itemBySKU=new Map(cat.items.map(i=>[i.sku,i]));
 const sku=doc.room.workshop?.finishes?.units?.[unit.id]?.frontSku||doc.room.workshop?.finishes?.frontSku;
 const refs=[...new Set([...recipe.map(l=>l.sku),sku].filter(Boolean))].map(s=>[s,itemBySKU.get(s)?.thicknessMm,itemBySKU.get(s)?.name,itemBySKU.get(s)?.hardwareRole]);
 const clear=resolveUnitSupport(doc,cat,unit,run).bodyClearMm;
 const raw=JSON.stringify([run.id,run.height,run.depth,unit.id,unit.width,unit.kind,unit.interior,unit.detail,entry.riceMode,refs,recipe,...(entry.recipeId?[entry.recipeId]:[]),...(unit.drawerCount?[unit.drawerCount]:[]),...(clear?[clear]:[])]);
 let h=2166136261;for(let i=0;i<raw.length;i++)h=Math.imul(h^raw.charCodeAt(i),16777619);
 return 'r-'+(h>>>0).toString(16).padStart(8,'0');
}
export function riceFit(e){
 const packages=Math.ceil(e.amountKg/e.packageKg),layerCount=e.layers==='stack'?Math.floor(e.inside.h/e.pack.h):Number(e.pack.h<=e.inside.h);
 const perLayer=Math.max(Math.floor(e.inside.w/e.pack.w)*Math.floor(e.inside.d/e.pack.d),Math.floor(e.inside.w/e.pack.d)*Math.floor(e.inside.d/e.pack.w));
 const totalKg=(e.mode==='bags'?packages*e.packageKg:e.amountKg)+e.packagingKg+(e.ratingBasis==='moving'?e.drawerKg:0);
 return {packages,capacity:perLayer*layerCount,totalKg:Math.round(totalKg*1000)/1000};
}
export function currentRiceWarnings(doc,run,manifest){
 const issues=[],cat=getFactoryCatalog(doc);
 for(const entry of manifest.units.filter(u=>u.family==='rice')){
  const unit=doc.kitchen.units.find(u=>u.id===entry.id&&u.runId===run.id&&u.kind==='drawers'),e=cleanRiceCheck(manifest.riceChecks?.[entry.id]);
  issues.push(...pantryUnitIssues(doc,run,entry,e).map(v=>entry.id+' · '+v));
  if(!unit||!e||e.mode!==entry.riceMode){issues.push('أكمل مقاس '+(entry.riceMode!=='bags'?'الحاوية':'عبوة الأرز')+' وصافي الدرج وحمولة السكة من تبويب تعبئة الصف للوحدة '+entry.id+'.');continue;}
  if(e.signature!==riceSiteKey(doc,run,unit,entry)){issues.push('تغيّر الدرج أو وصفته بعد فحص الحمولة. راجع القياسات والسكة للوحدة '+entry.id+'.');continue;}
  const auto=cat.families[entry.recipeId||'rice']?.drawerRunners?.length;
  if(e.drawerIndex&&(!auto||e.drawerIndex>(unit.drawerCount||3)))issues.push('رقم درج الأرز أو سياسة اختيار سككه لا يطابق الوصفة الحالية.');
  if(!e.drawerIndex&&!auto&&(!cat.items.some(i=>i.sku===e.sku&&i.kind==='piece'&&i.hardwareRole==='runner')||!(cat.families[entry.recipeId||'rice']?.recipe||[]).some(l=>l.sku===e.sku)))issues.push('رمز السكة '+e.sku+' غير مطابق لصنف في وصفة درج الأرز.');
  if(e.inside.w>=unit.width*10||e.inside.d>run.depth*10||e.inside.h>run.height*10-resolveUnitSupport(doc,cat,unit,run).bodyClearMm)issues.push('الحيز الداخلي الموثق يتجاوز أبعاد وحدة الأرز أو يساوي عرضها الخارجي. راجع صافي الدرج.');
  const fit=riceFit(e);
  if(fit.capacity<fit.packages)issues.push('ترتيب '+fit.packages+' عبوة لا يسع في صافي درج '+entry.id+' بحسب المقاسات واتجاه الرص المحدد. السعة الهندسية لهذا الترتيب '+fit.capacity+'.');
  if(!e.drawerIndex&&!auto&&fit.totalKg>e.loadKg)issues.push('تتجاوز الحمولة المحسوبة '+fit.totalKg+' كجم حد السكة '+e.loadKg+' كجم بمقدار '+Number((fit.totalKg-e.loadKg).toFixed(3))+' كجم.');
  if(['bin','dispenser'].includes(e.mode)&&fit.packages>1)issues.push('يحتاج هذا الاختيار إلى '+fit.packages+' حاويات. وزّع الكمية على وحدات مستقلة أو طابق وصفة عدة حاويات في المصنع.');
 }
 return issues;
}

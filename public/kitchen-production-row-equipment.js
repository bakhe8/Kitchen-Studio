import {architectureWall,architectureWallLocal} from './kitchen-architecture.js';
import {offlineDigest} from './kitchen-workshop-revision.js';
const labels={width:'عرض الفتحة',depth:'عمق الفتحة',height:'ارتفاع الفتحة'};
const positive=n=>Number.isFinite(n)&&n>0&&n<=6000;
export function cleanDishwasherEvidence(v){
 if(!v||!['same','mixed'].includes(v.bearing)||!['model','manual','source','surveyor'].every(k=>typeof v[k]==='string'&&v[k].trim().length>0&&v[k].length<=160))return null;
 if(!['width','depth','height'].every(k=>positive(v.required?.[k]))||!['width','depth','underside'].every(k=>positive(v.measured?.[k]))||!Number.isFinite(v.measured.floor)||Math.abs(v.measured.floor)>3000||!/^(g-[0-9a-f]{8}|dw-[0-9a-f]{64})$/.test(v.signature||''))return null;
 return {model:v.model.trim(),manual:v.manual.trim(),source:v.source.trim(),surveyor:v.surveyor.trim(),bearing:v.bearing,
 required:{width:v.required.width,depth:v.required.depth,height:v.required.height},
 measured:{width:v.measured.width,depth:v.measured.depth,underside:v.measured.underside,floor:v.measured.floor},signature:v.signature};
}
export function legacyDishwasherSiteKey(doc,run,unit){
 const r=doc.room,features=doc.kitchen.features.filter(f=>f.wall===run.wall).map(f=>[f.id,f.kind,f.u,f.width,f.bottom,f.height,f.depth]);
 const raw=JSON.stringify([r.width,r.length,r.height,r.architecture,r.sitePoints,features,r.workshop?.chains?.[run.wall],
  r.fieldRegister?.records,run.id,run.wall,run.start,run.end,run.bottom,run.height,run.depth,unit.id,unit.u,unit.width,unit.kind]);
 let h=2166136261;for(let i=0;i<raw.length;i++)h=Math.imul(h^raw.charCodeAt(i),16777619);
 return 'g-'+(h>>>0).toString(16).padStart(8,'0');
}
// Re-check physical evidence only when a dependency of this specific opening
// changes. A photo or a hold attached to another cabinet does not change it.
export function dishwasherSiteKey(doc,run,unit){
 const room=doc.room,wall=architectureWall(room,run.wall),a=unit.u,b=a+unit.width;
 const ids=new Set([unit.id,run.id,'top:'+run.id,run.wall]),records=room.fieldRegister?.records||[];
 const relevant=records.filter(r=>{
  if(!/^(EQP-(01|02|03|04|10|17)|SITE-(0[2345789]|1[349]|2[012])|CAT-(03|17)|MEP-[0-9]+|INS-0[123])$/.test(r.inputCode||''))return false;
  return ids.has(r.itemId)||r.itemId?.startsWith('top:'+run.id+':')||r.location===unit.id||r.location===run.id;
 }).map(r=>[r.id,r.itemId,r.inputCode,r.property,r.valueType,r.unit,r.value,r.verification,r.readingRef,r.source]).sort((x,y)=>String(x[0]).localeCompare(String(y[0])));
 const intersects=(left,right)=>left<b&&right>a;
 const features=doc.kitchen.features.filter(f=>f.wall===run.wall&&intersects(f.u,f.u+f.width)).map(f=>[f.id,f.kind,f.u,f.width,f.bottom,f.height,f.depth]).sort((x,y)=>x[0].localeCompare(y[0]));
 const profiles=(room.workshop?.options?.[run.wall]?.profiles||[]).filter(p=>wall&&intersects(wall.start+p.fromMm/10,wall.start+p.toMm/10));
 const floor=(room.sitePoints||[]).filter(p=>{
  if(!wall)return false;
  const q=architectureWallLocal(room,wall.id,p),radius=(p.size/2+(p.accessMargin||0))*Math.SQRT2;
  return intersects(q.u-radius,q.u+radius)&&q.d+radius>=0&&q.d-radius<=run.depth;
 }).map(p=>[p.id,p.kind,p.x,p.z,p.size,p.accessMargin]);
 const raw=JSON.stringify([room.height,wall&&[wall.a.x,wall.a.z,wall.b.x,wall.b.z],run.id,run.wall,run.bottom,run.depth,run.height,unit.id,unit.u,unit.width,unit.kind,features,profiles,floor,relevant]);
 return 'dw-'+offlineDigest(new TextEncoder().encode(raw));
}
export function matchesDishwasherEvidence(signature,doc,run,unit){
 return signature===dishwasherSiteKey(doc,run,unit)||(signature?.startsWith('g-')&&signature===legacyDishwasherSiteKey(doc,run,unit));
}
export function currentDishwasherWarnings(doc,run,manifest){
 const warnings=[];
 for(const i of manifest.units.filter(i=>i.family==='dishwasher')){
  const u=doc.kitchen.units.find(u=>u.id===i.id&&u.runId===run.id&&u.kind==='dishwasher');
  const e=cleanDishwasherEvidence(manifest.equipmentChecks?.[i.id]);
  if(!u||!e){warnings.push('يحتاج حيز الغسالة '+i.id+' إلى موديل ومرجع التركيب وقياسات الفتحة وموضع الارتكاز.');continue;}
  if(u.modelSpec&&(e.model!==u.modelSpec.model||e.manual!==u.modelSpec.manual||Object.keys(labels).some(k=>u.modelSpec[k+'Mm']!==e.required[k])))warnings.push('اختلف موديل الغسالة أو أبعاد الدليل عن حيز الموديل المختار '+u.id+'.');
  if(!matchesDishwasherEvidence(e.signature,doc,run,u)){warnings.push('تغيّر الموقع أو موضع الغسالة '+i.id+' منذ التحقق من موديل '+e.model+'. راجع القياسات في تكوين الصف.');continue;}
  if(e.bearing==='mixed'){warnings.push('أرجل الغسالة '+i.id+' على مستويين. يلزم التحقق من تسويتها على موضع ارتكاز واحد قابل للقياس.');continue;}
  const available={width:Math.min(u.width*10,e.measured.width),depth:Math.min(u.modelSpec?.depthMm??run.depth*10,e.measured.depth),height:Math.min(u.modelSpec?.heightMm??run.height*10,e.measured.underside-e.measured.floor)};
  for(const k of Object.keys(labels))if(available[k]<e.required[k])warnings.push(labels[k]+' للغسالة '+e.model+' ينقصه '+Number((e.required[k]-available[k]).toFixed(2))+' مم وفق دليل الموديل والقياس الفعلي.');
 }
 return warnings;
}

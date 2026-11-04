import {architectureWall} from './kitchen-architecture.js';
import {readWallOptions,applyWallOptions} from './kitchen-chain-options.js';
import {scanSourceKey,profileDatum,cleanWallProfiles,fitWallBand} from './kitchen-wall-scan.js';
export {parseWallXYZ,profileDatum,cleanWallProfiles,fitWallBand} from './kitchen-wall-scan.js';
const fail=reason=>({ok:false,reason});
const text=(v,n)=>typeof v==='string'&&v.trim().length&&v.length<=n;
const num=(v,lo,hi)=>Number.isFinite(v)&&v>=lo&&v<=hi;
function packed(doc,store){return {...doc,room:{...doc.room,workshop:{...doc.room.workshop,wallProfiles:store}}};}
export function saveScanDraft(doc,raw,b){
 const result=fitWallBand(doc,raw,b);if(!result.ok)return result;
 const prev=doc.room.workshop?.wallProfiles||{sources:{},bands:[]};
 const sourceId=scanSourceKey(raw),id=b.id||'scan-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
 if(prev.bands.some(q=>q.id===id))return fail('يوجد نطاق محفوظ بنفس المعرّف.');
 const band={id,sourceId,wall:b.wall,low:b.low,high:b.high,pitchX:b.pitchX,pitchY:b.pitchY,tol:b.tol,datum:profileDatum(doc.room,b.wall)};
 const store=cleanWallProfiles({sources:{...prev.sources,[sourceId]:raw},bands:[...prev.bands,band]});
 return store?{ok:true,doc:packed(doc,store),band,result}:fail('تجاوز عدد الملفات أو الشرائح الحد المسموح.');
}
const scanID=id=>'xyz-'+id;
export function reviewScanBand(doc,id,review){
 const store=doc.room.workshop?.wallProfiles,b=store?.bands.find(v=>v.id===id);if(!b)return fail('اختر شريحة محفوظة.');
 if(b.datum!==profileDatum(doc.room,b.wall))return fail('تغيّر مرجع الجدار. طابق نقاط المسح مع المحور الحالي أولًا.');
 const fit=fitWallBand(doc,store.sources[b.sourceId],b);if(!fit.ok)return fit;
 if(!fit.bandOK)return fail('تغطية الشريحة غير كافية لظرف متصل. أضف قياسات عند حدود الارتفاع وفي الخلايا الناقصة.');
 if(!review||!text(review.ref,120)||!text(review.name,80)||!num(review.boundMm,Math.ceil(fit.peakMm),6000))return fail('أدخل اسم الفني ومرجع معاينته وحدًا محافظًا لا يقل عن أكبر بروز موجب في جميع النقاط.');
 const record={...b,review},s=cleanWallProfiles({...store,bands:store.bands.map(v=>v.id===id?record:v)});if(!s)return fail('بيانات اعتماد الشريحة غير صالحة.');
 const options=readWallOptions(doc,b.wall),profiles=(options.profiles||[]).filter(v=>v.id!==scanID(id));
 if(review.boundMm>0)profiles.push({id:scanID(id),type:'lean',fromMm:fit.from,toMm:fit.to,bottomMm:b.low,topMm:b.high,depthMm:review.boundMm,reference:review.ref});
 const result=applyWallOptions(doc,b.wall,{...options,profiles});if(!result.ok)return result;
 return {ok:true,doc:packed(result.doc,s)};
}
export function removeScanBand(doc,id){
 const store=doc.room.workshop?.wallProfiles,b=store?.bands.find(v=>v.id===id);if(!b)return fail('اختر شريحة موجودة.');
 const bands=store.bands.filter(x=>x.id!==id),sources=Object.fromEntries(Object.entries(store.sources).filter(([k])=>bands.some(v=>v.sourceId===k)));
 const options=readWallOptions(doc,b.wall),keep={...options,profiles:(options.profiles||[]).filter(v=>v.id!==scanID(id))};
 const result=applyWallOptions(doc,b.wall,keep);return result.ok?{ok:true,doc:packed(result.doc,{bands,sources})}:result;
}
export function profileIssues(doc,scope=null){
 const s=doc.room.workshop?.wallProfiles;if(!s)return [];
 const issues=[];for(const b of s.bands){if(scope&&!scope.walls.includes(b.wall))continue;
  const fit=fitWallBand(doc,s.sources[b.sourceId],b);
  if(scope&&fit.ok&&!doc.kitchen.units.some(u=>{const r=doc.kitchen.runs.find(x=>x.id===u.runId),w=architectureWall(doc.room,b.wall);return scope.unitIds.includes(u.id)&&r?.wall===b.wall&&u.u+u.width>w.start+fit.from/10&&u.u<w.start+fit.to/10&&r.bottom+r.height>b.low/10&&r.bottom<b.high/10;}))continue;
  if(!fit.ok||b.datum!==profileDatum(doc.room,b.wall)){issues.push('تحتاج شريحة المسح '+b.id+' مطابقة للمحور الحالي.');continue;}
  const actual=readWallOptions(doc,b.wall).profiles?.find(v=>v.id===scanID(b.id)),v=b.review;
  if(!v||!fit.bandOK||v.boundMm+1e-7<fit.peakMm||v.boundMm>0&&(!actual||actual.fromMm!==fit.from||actual.toMm!==fit.to||actual.bottomMm!==b.low||actual.topMm!==b.high||actual.depthMm!==v.boundMm))
   issues.push('شريحة '+fit.reference+' عند '+b.wall+' تنتظر اعتماد ظرفها ومرجع التحقق قبل التصنيع.');
 }
 return [...new Set(issues)];
}

import {inheritedName} from './kitchen-safe-keys.js';
// A recorded opening is the outer window casing. Recess depth and screw/handle
// clearance are independent field evidence, never derived from casing width.
import {architectureWallIdKnown,architectureWallLocal,architectureWall} from './kitchen-architecture.js';
import {convexIntersection,polygonArea} from './kitchen-oriented.js';
import {offlineDigest} from './kitchen-workshop-revision.js';

const eps=.0001;
const num=(x,min,max)=>Number.isFinite(x)&&x>=min&&x<=max;
const word=x=>typeof x==='string'&&x.trim()&&x.length<=160;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const rounded=x=>Math.round(x*1000)/1000;
const optional=(o,k,check)=>o[k]===undefined||check(o[k]);
const sku=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(x)&&!inheritedName(x);
const boundKeys=(obj,keys)=>Object.keys(obj).every(k=>keys.includes(k));

function cleanSill(v){
 if(!object(v)||!['supplier','factory'].includes(v.mode)||!boundKeys(v,['mode','depthMm','lengthMm','insetStartMm','reference','verified','proof',...(v.mode==='factory'?['sku']:['material','thicknessMm'])]))return null;
 if(!['depthMm','lengthMm','thicknessMm'].every(k=>optional(v,k,n=>num(n,.001,20000)))||!optional(v,'insetStartMm',n=>num(n,0,20000))||
    !optional(v,'reference',word)||!optional(v,'material',word)||!optional(v,'sku',sku)||!optional(v,'verified',n=>typeof n==='boolean')||!optional(v,'proof',n=>typeof n==='string'&&/^[a-f0-9]{64}$/.test(n)))return null;
 return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,typeof x==='string'?x.trim():x]));
}
export function cleanWindowChoice(v){
 if(!object(v)||!['gap','step','uniform'].includes(v.kind)||!/^ow-[a-f0-9]{64}$/.test(v.datum)||!boundKeys(v,['kind','datum','heightMm','clearanceMm','operationLimitMm','reference','operationChecked','sill'])||
    !optional(v,'heightMm',n=>num(n,.001,10000))||!optional(v,'clearanceMm',n=>num(n,0,3000))||!optional(v,'operationLimitMm',n=>num(n,0,10000))||!optional(v,'reference',word)||
    !optional(v,'operationChecked',x=>typeof x==='boolean'))return null;
 const out={kind:v.kind,datum:v.datum};
 if(v.kind!=='gap')for(const k of ['heightMm','clearanceMm','operationLimitMm','reference','operationChecked'])if(v[k]!==undefined)out[k]=typeof v[k]==='string'?v[k].trim():v[k];
 if(v.sill!==undefined){out.sill=cleanSill(v.sill);if(!out.sill)return null;}
 return out;
}
export function cleanWindowChoices(raw){
 if(!object(raw)||Object.keys(raw).length>512)return null;
 const result={};
 for(const [key,v] of Object.entries(raw)){
  const [wall,f,level]=key.split('/');
  if(key.split('/').length!==3||!architectureWallIdKnown(wall)||!sku(f)||!/^\d{1,6}(\.\d{1,3})?$/.test(level))return null;
  const choice=cleanWindowChoice(v);if(!choice)return null;result[key]=choice;
 }
 return result;
}
const issue=(w,st,role,msg)=>Object.assign(w,{status:st,requiredFrom:role,reason:msg,effectiveHeightMm:0});
function evaluate(w){
 const c=w.choice;
 if(!c){
  if(w.conflict)return issue(w,'pending','customer','اختر انقطاع النعلة أو طريقة استمرارها عند هذا الشباك.');
  if(Math.abs(w.rawClearMm-w.nominalMm)<=eps){
   w.reason='يلامس المقطع أسفل البرواز في الرسم. لم يُوثّق خلوص التشغيل والتركيب عند هذا الشباك.';
   w.status='pending';w.requiredFrom='rep';
  }
  return;
 }
 if(c.datum!==w.datum)return issue(w,'stale','rep','تغيّر البرواز أو السطح أو وصفة النعلة. راجع اختيار الشباك على الرفع الحالي.');
 if(c.kind==='gap'){w.status='resolved';w.effectiveHeightMm=0;return;}
 if(w.rawClearMm<=0)return issue(w,'invalid','customer','لا يوجد ارتفاع لشريط قائم تحت البرواز. اختر فراغًا، أو راجع تفصيل جلسة أفقية إذا كان المنسوب مطابقًا.');
 if(c.clearanceMm===undefined||!c.reference||c.operationChecked!==true)return issue(w,'pending','rep','يلزم خلوص تركيب موثّق والتحقق ميدانيًا من حركة الضلفة والمقبض ومسار التصريف عند مقطع الرخام.');
 const limit=rounded(Math.min(w.nominalMm,Math.min(w.rawClearMm,c.operationLimitMm??Infinity)-c.clearanceMm));
 const desired=c.heightMm??limit;
 if(limit<=0||desired>limit+eps)return issue(w,'invalid','engineer','ارتفاع الشريط المطلوب يتجاوز الصافي بعد خلوص التركيب أو ارتفاع الوصفة.');
 if(desired<w.minCutHeightMm-eps)return issue(w,'pending',w.mode==='factory'?'factory':'supplier','المقطع المنخفض خارج الارتفاعات المعتمدة لهذه الخامة. يلزم تفصيل متاح من جهة التوريد أو تعديل الاختيار.');
 w.status='resolved';w.effectiveHeightMm=desired;
}
export function wallWindows(doc,g,group,profile,spans,datumParts,choices){
 const {wall,bottomMm}=group,windows=[],boundary=architectureWall(doc.room,wall);
 for(const f of g.features){
  const fromMm=rounded(f.u*10),toMm=rounded((f.u+f.width)*10),sillMm=rounded(f.bottom*10);
  if(f.kind!=='window'||f.wall!==wall||(f.planningOffset||0)*10>=profile.thicknessMm||(f.bottom+f.height)*10<=bottomMm+eps||
     !spans.some(s=>Math.min(s.end,toMm)-Math.max(s.start,fromMm)>eps))continue;
  const key=[wall,f.id,bottomMm].join('/');
  const evidence=[wall,boundary?.a,boundary?.b,doc.room.architecture?.wallThickness,f.id,fromMm,toMm,sillMm,f.height,f.depth,f.planningOffset||0,f.hinge,f.swing,f.leafWidth,f.hingeInset,f.parkDepth,f.parking,
   bottomMm,profile.mode,profile.profileId,profile.sku,profile.reference,profile.material,profile.heightMm,profile.thicknessMm,profile.minCutHeightMm,
   spans.filter(s=>s.end>fromMm&&s.start<toMm).map(s=>[s.start,s.end,[...s.tops].map(id=>datumParts.get(id))]),
   (doc.room.workshop?.tapChecks||[]).filter(t=>t.windowId===f.id).map(t=>t.proof||[t.sash,t.source])];
  const window={key,windowId:f.id,wall,fromMm,toMm,sillMm,bottomMm,rawClearMm:rounded(sillMm-bottomMm),nominalMm:profile.heightMm,
   thicknessMm:profile.thicknessMm,mode:profile.mode,material:profile.material,profileId:profile.profileId,sku:profile.sku,minCutHeightMm:profile.minCutHeightMm??profile.heightMm,
   datum:'ow-'+offlineDigest(new TextEncoder().encode(JSON.stringify(evidence))),conflict:sillMm<bottomMm+profile.heightMm-eps,
   choice:choices?.[key]||null,status:'default',requiredFrom:null,reason:'',effectiveHeightMm:profile.heightMm};
  evaluate(window);windows.push(window);
 }
 return windows;
}
// Uniform treatment is scoped to a single architectural wall. Other owners'
// explicit gaps and local heights survive. Incompatible connected heights hold.
export function wallUniformHeight(windows,nominal){
 const uniform=windows.filter(w=>w.choice?.kind==='uniform'&&w.status==='resolved');
 if(!uniform.length)return nominal;
 const fixed=uniform.filter(w=>w.choice.heightMm!==undefined);
 const auto=Math.min(nominal,...uniform.map(w=>w.effectiveHeightMm));
 const height=fixed[0]?.choice.heightMm??auto;
 if(fixed.some(w=>Math.abs(w.choice.heightMm-height)>eps)||height>auto+eps||
    windows.some(w=>w.choice?.kind==='step'&&w.status==='resolved'&&Math.abs(w.effectiveHeightMm-height)>eps)){
  for(const w of uniform)issue(w,'invalid','customer','يتعارض ارتفاع النعلة الموحدة مع تفصيل محفوظ لشباك آخر على الجدار. وحّد الارتفاع أو اختر التفصيل المحلي.');
  return nominal;
 }
 for(const w of windows){
  if(w.choice?.kind==='uniform'&&w.status==='resolved'||w.status==='default')w.effectiveHeightMm=height;
  // A previously tangent unmodified opening is now geometrically above the
  // adopted wall strip. No need to ask for zero clearance on the old height.
  if(!w.choice&&!w.conflict&&w.rawClearMm>height+eps){w.effectiveHeightMm=height;w.requiredFrom=null;w.status='default';w.reason='';}
  if(w.choice)continue;
  w.inheritedUniformHeightMm=height;
  if(w.conflict){
   if(w.rawClearMm<=0){
    issue(w,'invalid','customer','لا يرتفع البرواز فوق السطح عند هذا الشباك. خط النعلة الموحد لا يمر هنا. اختر انقطاعًا محليًا أو تفصيل جلسة أفقية.');
   }else{
    issue(w,'pending','rep','اختير ارتفاع موحّد لهذا الجدار. تحقّق من خلوص هذا الشباك وحركة الضلفة والمقبض على المقطع الموحّد، أو سجّل استثناء.');
   }
  }
 }
 return height;
}
export function windowIntervals(span,windows,wallHeight){
 const cuts=[span.start,span.end];
 for(const w of windows)if(w.toMm>span.start&&w.fromMm<span.end)cuts.push(Math.max(w.fromMm,span.start),Math.min(w.toMm,span.end));
 const ticks=[...new Set(cuts)].sort((a,b)=>a-b),parts=[];
 for(let i=1;i<ticks.length;i++){
  const a=ticks[i-1],b=ticks[i];
  const height=Math.min(wallHeight,...windows.filter(w=>w.fromMm<b-eps&&w.toMm>a+eps).map(w=>w.effectiveHeightMm));
  if(height<=0||b<=a+eps)continue;
  const prev=parts.at(-1);
  if(prev&&prev.end===a&&prev.height===height)prev.end=b;else parts.push({start:a,end:b,height});
 }
 return parts;
}

export function sillProof(ctx,s,cat){
 const item=s.mode==='factory'?cat?.items?.find(i=>i.sku===s.sku):null;
 return offlineDigest(new TextEncoder().encode(JSON.stringify([ctx.datum,s.mode,s.sku||s.material,s.depthMm,s.insetStartMm,s.lengthMm,s.reference,s.thicknessMm,item?.name,item?.thicknessMm])));
}
export function horizontalSill(ctx,doc,cat,spans,solidTops){
 const c=ctx.choice?.sill;if(!c)return null;
 const hold=(who,reason)=>{ctx.sillStatus='pending';ctx.sillRequiredFrom=who;ctx.sillReason=reason;return null;};
 if(ctx.status==='stale')return hold('rep','راجع ربط جلسة الشباك بالسطح والبرواز الحاليين.');
 if(Math.abs(ctx.rawClearMm)>eps)return hold('engineer','الجلسة الأفقية المستوية تحتاج تطابق منسوب البرواز والسطح. يلزم قالب خاص لاختلاف المنسوب.');
 if(c.insetStartMm===undefined||!c.lengthMm||!c.depthMm||!c.reference||!c.verified)return hold('rep','ارفع موضع الجلسة وعرضها الصافي وعمقها من وجه الجدار إلى البرواز، وتحقق من الارتكاز والفتح ومن أنها إضافة منفصلة.');
 const a=rounded(ctx.fromMm+c.insetStartMm),b=rounded(a+c.lengthMm);
 if(b>ctx.toMm+eps||!spans.some(s=>s.start<=a+eps&&s.end>=b-eps))return hold('engineer','الامتداد الأفقي المقاس يتجاوز عرض الشباك أو حافة السطح الملامسة. راجع القالب.');
 if(spans.some(span=>span.start<b-eps&&span.end>a+eps&&[...span.tops].some(id=>solidTops.find(t=>t.id===id)?.patternStale)))return hold('engineer','تغيّر قالب السطح عند هذه الجلسة. طابق حدود اللوح المقاس قبل حصر امتداد منفصل.');
 const t=doc.room.architecture?.wallThickness;
 if(Number.isFinite(t)&&c.depthMm>t*10+eps)return hold('engineer','عمق الجلسة أكبر من سماكة الجدار المسجلة. يلزم تفصيل خاص.');
 let item=null,thickness=c.thicknessMm,material=c.material;
 if(c.mode==='factory'){
  item=cat?.items?.find(i=>i.sku===c.sku);
  if(!cat?.approved||!item||item.kind!=='panel'||!(item.thicknessMm>0))return hold('factory','اختر لوح الجلسة الأفقي من كتالوج معتمد للمصنع.');
  if(c.lengthMm>item.stockLengthMm+eps||c.depthMm>item.stockWidthMm+eps)return hold('factory','مقاس الجلسة يتجاوز اللوح المحدد. اختر خامًا مناسبًا أو اعتمد تفصيل الوصل.');
  thickness=item.thicknessMm;material=item.name;
 }else if(!thickness||!material)return hold('supplier','يلزم تحديد خامة الجلسة الأفقية وسماكتها من المورّد.');
 if(c.proof!==sillProof(ctx,c,cat)){
  hold('rep','تغيّر مقطع لوح الجلسة أو مرجعها. تحقّق من مناسيب القطعة وأعد تأكيد القالب.');ctx.sillStatus='stale';return null;
 }
 const rect=[{x:a,z:-c.depthMm},{x:b,z:-c.depthMm},{x:b,z:0},{x:a,z:0}];
 for(const top of solidTops){
  if(top.bottomMm>=ctx.bottomMm-eps||top.topMm<=ctx.bottomMm-thickness+eps)continue;
  const poly=top.polygon.map(p=>{const q=architectureWallLocal(doc.room,ctx.wall,p);return {x:q.u*10,z:q.d*10};});
  if(Math.abs(polygonArea(convexIntersection(poly,rect)))>eps)return hold('engineer','يتداخل الامتداد مع لوح سطح قائم أو قالب مدمج فيه. لا يمكن حصر الرخام مرتين.');
 }
 ctx.sillStatus='resolved';ctx.sillRequiredFrom=null;ctx.sillReason='';
 return {key:ctx.key,wall:ctx.wall,windowId:ctx.windowId,mode:c.mode,fromMm:a,toMm:b,lengthMm:c.lengthMm,depthMm:c.depthMm,
  bottomMm:rounded(ctx.bottomMm-thickness),thicknessMm:thickness,material,reference:c.reference,...(item?{sku:item.sku,color:item.colorHex}:{})};
}

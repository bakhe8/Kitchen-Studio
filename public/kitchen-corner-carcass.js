import {ownKey,inheritedName} from './kitchen-safe-keys.js';
import {catalogDisplayColor} from './kitchen-finish-parts.js';
// Rectangular panel construction approved by the factory for a square corner.
// Coordinates are local millimetres: X along the through wing, Z along its return.
// Two decks can join into one uninterrupted L; a seam is not a separating panel.
const text=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,47}$/.test(v)&&!inheritedName(v)&&!['__proto__','constructor','prototype'].includes(v);
const positive=(v,max)=>Number.isFinite(v)&&v>0&&v<=max;
const rounded=v=>Math.round(v*1000)/1000;
export const cornerBuilds={connected:'جسم ركني مشترك',split:'صندوقان مستقلان متجاوران'};
export const cornerRoles={bodySku:'لوح الجوانب والسطحين',shelfSku:'لوح الرف',frontSku:'لوح الدرفة والوجه الثابت',edgeSku:'شريط حافة الدرفة',hingeSku:'مفصلة الدرفة',handleSku:'يد الدرفة',bodyKit:'طقم تجميع وتثبيت جسم واحد',shelfKit:'طقم إسناد رف واحد'};
export const cornerLimits={revealMm:'خلوص الدرفة لكل طرف',shelfSetbackMm:'ارتداد الرف عن الوجه',edgeBuildMm:'زيادة الحافة على كل طرف من لوح الدرفة',maxSpanMm:'أقصى طول قطعة أفقية',maxDoorWidthMm:'أقصى عرض درفة معتمدة',maxDoorHeightMm:'أقصى ارتفاع درفة معتمدة',hingesPerDoor:'عدد المفصلات لكل درفة'};
export function cleanCornerRecipes(raw,items){
 if(raw==null)return {};
 if(typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>48)return null;
 const result={};
 for(const [key,r] of Object.entries(raw)){
  if(!id(key)||!r||!text(r.label,85)||!text(r.reference,160)||!['base','upper','tall'].includes(r.tier))return null;
  const out={label:r.label.trim(),reference:r.reference.trim(),tier:r.tier};
  for(const k of Object.keys(cornerRoles)){
   const i=items.get(r[k]),kind=['bodySku','shelfSku','frontSku'].includes(k)?'panel':k==='edgeSku'?'bar':'piece';
   if(i?.kind!==kind||kind==='panel'&&(!positive(i.thicknessMm,150)||(k==='frontSku'&&i.role!=='front')))return null;
   out[k]=r[k];
  }
  if(r.frontSkus!=null){
   if(!Array.isArray(r.frontSkus)||r.frontSkus.length>64||new Set(r.frontSkus).size!==r.frontSkus.length||r.frontSkus.some(s=>!id(s)||items.get(s)?.role!=='front'||items.get(s)?.kind!=='panel'||items.get(s).thicknessMm!==items.get(out.frontSku).thicknessMm))return null;
   if(r.frontSkus.length)out.frontSkus=[...r.frontSkus];
  }
  for(const k of Object.keys(cornerLimits)){
   const v=r[k];
   if(['revealMm','edgeBuildMm','shelfSetbackMm'].includes(k)?!Number.isFinite(v)||v<0||v>150:k==='hingesPerDoor'?!Number.isInteger(v)||!positive(v,20):!positive(v,6000))return null;
   out[k]=v;
  }
  result[key]=out;
 }
 return result;
}
export function cleanCornerBuild(v){
 if(!v||!id(v.recipe)||!ownKey(cornerBuilds,v.mode)||!['a','b'].includes(v.through))return null;
 const out={recipe:v.recipe,mode:v.mode,through:v.through,arms:{}};
 for(const side of ['a','b']){
  const a=v.arms?.[side];
  if(!a||typeof a.use!=='string'||a.use.length>100||!Array.isArray(a.shelves)||a.shelves.length>20||!a.shelves.every(x=>positive(x,6000))||new Set(a.shelves).size!==a.shelves.length)return null;
  out.arms[side]={use:a.use.trim(),shelves:[...a.shelves].sort((a,b)=>a-b)};
 }return out;
}
export function cornerAssembly(q,tier,cat,square,pickedFront=null){
 const build=q.build,r=cat?.cornerRecipes?.[build?.recipe],issues=[],panels=[],pieces=[],doors=[];
 const result={issues,panels,pieces,doors,bodyCount:build?.mode==='split'?2:1};const issue=s=>issues.push(s);
 if(!r||r.tier!==tier){issue('وصفة الركن غير موجودة لهذا المستوى في كتالوج المصنع.');return result;}
 if(!square||!q.body){issue('تحتاج هذه الوصفة جسمًا مقاسًا وركنًا قائمًا. للزوايا المائلة اختر ورقة تفصيل خاصة.');return result;}
 const by=new Map((cat.items||[]).map(i=>[i.sku,i]));
 const frontSku=pickedFront||r.frontSku;
 if(![r.frontSku,...(r.frontSkus||[])].includes(frontSku)||by.get(frontSku)?.thicknessMm!==by.get(r.frontSku)?.thicknessMm){issue('راجع اختيار لوح واجهة الركن بعد تغيّر وصفة المصنع.');return result;}
 const t=by.get(r.bodySku)?.thicknessMm,s=by.get(r.shelfSku)?.thicknessMm,f=by.get(frontSku)?.thicknessMm;
 if(![t,s,f].every(n=>positive(n,150))){issue('راجع سماكات الألواح المعرّفة في وصفة الركن.');return result;}
 const first=build.through,second=first==='a'?'b':'a',split=build.mode==='split';
 const H=q.body.heightMm,L=q[first+'Mm'],R=q[second+'Mm'],D=first==='a'?q.body.depthAMm:q.body.depthBMm,E=first==='a'?q.body.depthBMm:q.body.depthAMm;
 const join=D-f,rim=r.revealMm,edge=r.edgeBuildMm,sideName=a=>a==='a'?'الأول':'الثاني';
 if(H<=2*t||join<=2*t||E-f<=2*t||L<=E+2*rim||R<=D+2*rim){issue('لا تكفي أبعاد الركن لسماكات الجسم ووجهيه.');return result;}
 if(q.inside==='custom'){issue('التفصيل الداخلي الخاص يحتاج ورقة قطع منفصلة أو اختيار الرفوف أو آلية محددة.');return result;}
 function panel(tag,side,label,x0,x1,z0,z1,y0,y1,axis,sku,extra={}){
  const dims={x:x1-x0,z:z1-z0,y:y1-y0},cut=extra.edged?2*edge:0,ends=axis.split(''),a=rounded(dims[ends[0]]-cut),b=rounded(dims[ends[1]]-cut);
  if(![a,b,...Object.values(dims)].every(v=>positive(v,12000))){issue('مقاس غير صالح في '+label+'.');return;}
  if((tag==='shelf'||tag==='deck')&&Math.max(a,b)>r.maxSpanMm){issue('يتجاوز '+label+' أكبر امتداد أفقي معتمد.');return;}
  const group=split?side:'joint',arm=sideName(side);
  const assignment=' · '+arm,op=r.reference+' · '+(split?'صندوق '+arm:'جسم مشترك')+(tag==='shelf'?' · أسفل الرف '+y0+' مم':'');
  const color=catalogDisplayColor(by.get(sku))||null;
  panels.push({tag,side,group,x0,x1,z0,z1,y0,y1,color,...extra});
  pieces.push({sku,kind:'panel',label:label+assignment,count:1,a,b,operation:op,drawing:r.reference,cornerCut:{group,side,tag,x0,x1,z0,z1,y0,y1,use:build.arms[side].use}});
 }
 function item(sku,label,count,side){if(count>0)pieces.push({kind:'piece',sku,label,count,a:null,b:null,operation:r.reference+(side?' · '+sideName(side):'')});}
 // Vertical skins terminate where another full-height skin begins. The split
 // boxes have separate back pieces and two facing closure panels at the seam.
 panel('back',first,'ظهر',0,L,0,t,0,H,'yx',r.bodySku);
 if(split){panel('back',first,'ظهر نهاية الضلع المستمر',0,t,t,join,0,H,'yz',r.bodySku);panel('back',second,'ظهر الضلع الراجع',0,t,join,R,0,H,'yz',r.bodySku);}
 else panel('back',second,'ظهر',0,t,t,R,0,H,'yz',r.bodySku);
 panel('end',first,'جانب نهاية',L-t,L,t,join,0,H,'yz',r.bodySku);
 panel('end',second,'جانب نهاية',t,E-f,R-t,R,0,H,'yx',r.bodySku);
 for(const [y,label] of [[0,'قاعدة'],[H-t,'سقف الجسم']]){
  panel('deck',first,label,t,L-t,t,join,y,y+t,'xz',r.bodySku);
  panel('deck',second,label,t,E-f,join,R-t,y,y+t,'zx',r.bodySku);
 }
 if(split){panel('joint',first,'جانب فاصل للصندوق المستمر',t,E-f,join-t,join,t,H-t,'yx',r.bodySku);panel('joint',second,'جانب فاصل للصندوق الراجع',t,E-f,join,join+t,t,H-t,'yx',r.bodySku);}
 item(r.bodyKit,'طقم تجميع وتثبيت الجسم',result.bodyCount);
 for(const side of [first,second]){
  const through=side===first,open=q.access==='both'||q.access===side,arm=build.arms[side];
  if(!open&&split&&(arm.shelves.length||arm.use)){issue('الضلع '+sideName(side)+' صندوق مغلق بلا باب. اختر وصولًا إليه أو اتركه منطقة عمياء فارغة.');continue;}
  const low=(through?E:D)+rim,high=(through?L:R)-rim,w=high-low,fh=H-2*rim,face=open?'door':'fixed';
  if(open&&(w>r.maxDoorWidthMm||fh>r.maxDoorHeightMm)){issue('درفة الضلع '+sideName(side)+' تتجاوز حدود العتاد في وصفة المصنع.');continue;}
  panel(face,side,open?'درفة':'وجه ثابت',through?low:E-f,through?high:E,through?D-f:low,through?D:high,rim,H-rim,through?'yx':'yz',frontSku,{edged:true});
  for(const [a,label] of [[fh,'حافة رأسية'],[w,'حافة أفقية']])pieces.push({kind:'bar',sku:r.edgeSku,label:label+' · '+sideName(side),a:rounded(a),b:null,count:2,operation:r.reference});
  if(open){
   item(r.hingeSku,'مفصلات · '+sideName(side),r.hingesPerDoor,side);item(r.handleSku,'يد · '+sideName(side),1,side);
   doors.push({side,low,high,w,fh,through,D,E,rim});
  }
  if(q.inside==='empty'&&arm.shelves.length){issue('اختير حيز فارغ وفي الضلع رفوف. راجع وظيفة الركن.');continue;}
  let previous=t;
  for(const y of arm.shelves){
   if(y<previous||y+s>H-t){issue('تداخل رف أو خروجه من حدود الضلع '+sideName(side)+'.');break;}previous=y+s;
   panel('shelf',side,'رف داخلي',t,through?L-t:E-f-r.shelfSetbackMm,through?t:join+(split?t:0),through?join-(split?t:0)-r.shelfSetbackMm:R-t,y,y+s,through?'xz':'zx',r.shelfSku);
   item(r.shelfKit,'طقم تثبيت رف · '+sideName(side),1,side);
  }
 }
 if(['pullout','carousel'].includes(q.inside)){
  const sku=by.get(q.sku);if(sku?.kind!=='piece'||!q.body.motion)issue('حدد صنف الآلية وغلاف حركتها من دليل المورد.');
  else item(sku.sku,'آلية الركن',1);
 }else if(q.sku)issue('اختير صنف آلية مع ركن رفوف. راجع اختيار التجهيز الداخلي.');
 return result;
}

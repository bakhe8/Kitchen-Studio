import {upsertFieldRecord} from './kitchen-field-model.js';
import {applyChain} from './kitchen-chain-model.js';
import {architectureWall} from './kitchen-architecture.js';

export const photoClasses={door:['باب','SITE-11'],window:['شباك','SITE-12'],column:['بروز أو عمود','SITE-09'],heater:['سخان ظاهر','MEP-06']};
const norm=n=>Math.min(1,Math.max(0,n));
const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=1);
export function rectFromPoints(first,last){
 if(!validPoint(first)||!validPoint(last))return null;
 const [x1,x2]=[first[0],last[0]].sort((a,b)=>a-b),[y1,y2]=[first[1],last[1]].sort((a,b)=>a-b);
 return x2-x1>=.015&&y2-y1>=.015?{x1,y1,x2,y2}:null;
}
function intersect(a,b){
 const area=(b.x2-b.x1)*(b.y2-b.y1),aa=(a.x2-a.x1)*(a.y2-a.y1);
 const overlap=Math.max(0,Math.min(a.x2,b.x2)-Math.max(a.x1,b.x1))*Math.max(0,Math.min(a.y2,b.y2)-Math.max(a.y1,b.y1));
 return overlap/(area+aa-overlap);
}
// The input is a bounded preview. Summed directional edge masks let us score a
// candidate's four sides without walking the full image for each combination.
export function suggestWallRects(rgba,w,h){
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<16||h<16||w*h>350000||rgba?.length!==4*w*h)return [];
 const n=w*h,luma=new Uint8Array(n),gx=new Uint8Array(n),gy=new Uint8Array(n),hist=new Uint32Array(256);
 for(let i=0;i<n;i++)luma[i]=(rgba[4*i]*77+rgba[4*i+1]*150+rgba[4*i+2]*29)>>8;
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const i=y*w+x,dx=Math.abs(luma[i+1]-luma[i-1]),dy=Math.abs(luma[i+w]-luma[i-w]);
  if(dx>=dy*.9)gx[i]=dx;if(dy>=dx*.9)gy[i]=dy;hist[Math.max(dx,dy)]++;
 }
 let acc=0,threshold=24;for(let v=255;v>=24;v--){acc+=hist[v];if(acc>=n*.075){threshold=v;break;}}
 const vertical=new Uint16Array(w*(h+1)),horiz=new Uint16Array((w+1)*h),xs=new Uint32Array(w),ys=new Uint32Array(h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const ix=y*w+x,g1=gx[ix]>=threshold?1:0,g2=gy[ix]>=threshold?1:0;
  vertical[(y+1)*w+x]=vertical[y*w+x]+g1;horiz[y*(w+1)+x+1]=horiz[y*(w+1)+x]+g2;xs[x]+=g1;ys[y]+=g2;
 }
 function peaks(s,min){
  const candidates=Array.from(s,(_,i)=>i).filter(i=>i>1&&i<s.length-2&&s[i]>=min).sort((a,b)=>s[b]-s[a]),hits=[];
  for(const i of candidates){if(!hits.some(j=>Math.abs(j-i)<4))hits.push(i);if(hits.length===18)break;}
  return hits.sort((a,b)=>a-b);
 }
 const px=peaks(xs,h*.07),py=peaks(ys,w*.07),rects=[];
 for(let a=0;a<px.length;a++)for(let b=a+1;b<px.length;b++)for(let c=0;c<py.length;c++)for(let d=c+1;d<py.length;d++){
  const [l,r,t,bt]=[px[a],px[b],py[c],py[d]],rw=r-l,rh=bt-t,area=rw*rh/n;
  if(rw<w*.07||rh<h*.08||area<.014||area>.92)continue;
  const col=x=>(vertical[bt*w+x]-vertical[t*w+x])/rh,row=y=>(horiz[y*(w+1)+r]-horiz[y*(w+1)+l])/rw;
  const scores=[col(l),col(r),row(t),row(bt)],mean=scores.reduce((sum,k)=>sum+k,0)/4;
  if(Math.min(...scores)<.34||mean<.63)continue;
  rects.push({x1:l/w,y1:t/h,x2:r/w,y2:bt/h,score:mean+.04*Math.sqrt(area)});
 }
 const chosen=[];
 for(const r of rects.sort((a,b)=>b.score-a.score)){if(chosen.some(j=>intersect(j,r)>.60))continue;chosen.push(r);if(chosen.length===8)break;}
 return chosen.map(({x1,x2,y1,y2})=>({x1:norm(x1),y1:norm(y1),x2:norm(x2),y2:norm(y2)}));
}
export function photoMetric(rect,cal,w,h){
 if(!rectFromPoints([rect?.x1,rect?.y1],[rect?.x2,rect?.y2])||!Number.isInteger(w)||!Number.isInteger(h)||w<=0||h<=0||!validPoint(cal?.a)||!validPoint(cal?.b)||!Number.isFinite(cal.mm)||cal.mm<=0||cal.mm>20000)return null;
 const dx=Math.abs(cal.a[0]-cal.b[0])*w,dy=Math.abs(cal.a[1]-cal.b[1])*h;
 if(dx<Math.max(w*.04,6)||dy>Math.max(3,dx*.06))return null;
 const scale=cal.mm/dx;return {width:Math.round((rect.x2-rect.x1)*w*scale),height:Math.round((rect.y2-rect.y1)*h*scale)};
}
export function registerPhotoHints(doc,{wall,selected,photo,w,h,calibration=null}){
 if(!architectureWall(doc.room,wall)||!photo?.id||!Array.isArray(selected)||!selected.length||selected.length>32||!Number.isInteger(w)||!Number.isInteger(h)||w<=0||h<=0)return {ok:false,reason:'اختر جدارًا وصورة وعنصرًا واحدًا على الأقل.'};
 let room=doc.room;
 for(const v of selected){
  const klass=photoClasses[v.kind];
  if(!klass||!Number.isInteger(v.number)||v.number<1||v.number>1000||!rectFromPoints([v.x1,v.y1],[v.x2,v.y2])||v.x1>=v.x2||v.y1>=v.y2)return {ok:false,reason:'صحح حدود العنصر واختر نوعه.'};
  const metric=calibration?photoMetric(v,calibration,w,h):null;
  if(calibration&&!metric)return {ok:false,reason:'خط المعايرة قصير أو مائل، أو لا يحمل عرضًا معلومًا.'};
  const coords=[[v.x1,v.y1],[v.x2,v.y1],[v.x2,v.y2],[v.x1,v.y2]].map(p=>p.map(x=>Number(x.toFixed(5))));
  const stem='wa-'+photo.id+'-'+v.number,source='صورة أمامية للجدار · '+photo.name;
  const related=(room.fieldRegister?.records||[]).filter(r=>r.itemId===stem&&['polygon','width','height'].some(k=>r.id===stem+'-'+k));
  const prior=related.find(r=>r.id===stem+'-polygon');
  if(prior){
   let notes;try{notes=JSON.parse(prior.notes);}catch{}
   if(notes?.wall!==wall||notes.origin==='plane')return {ok:false,reason:'هذا الرقم مرتبط بجدار آخر أو بمعايرة منظور. ارسم عنصرًا جديدًا مع الاحتفاظ بالأصل.'};
  }
  if(room.fieldRegister?.records?.some(r=>r.id===stem+'-cad')){
   const priorPolygon=related.find(r=>r.id===stem+'-polygon');
   let oldWall;try{oldWall=JSON.parse(priorPolygon?.notes||'{}').wall;}catch{}
   if(priorPolygon?.value===JSON.stringify(coords)&&priorPolygon.inputCode===klass[1]&&oldWall===wall&&
    related.find(r=>r.id===stem+'-width')?.value===metric?.width&&related.find(r=>r.id===stem+'-height')?.value===metric?.height)continue;
   return {ok:false,reason:'ربط الفني هذا العنصر بفتحة مقاسة. راجع الفتحة في رفع الجدار واحفظ الملاحظة الجديدة كعنصر مستقل.'};
  }
  if(related.some(r=>!['preliminary','estimated'].includes(r.verification)))return {ok:false,reason:'إحدى قراءات هذا العنصر تحقّق منها الفني. عدّل القراءة المؤكدة من سجل الفني.'};
  if(related.length)room={...room,fieldRegister:{...room.fieldRegister,records:room.fieldRegister.records.filter(r=>!related.includes(r))}};
  const fields=[['polygon','حدود '+klass[0]+' على الصورة',JSON.stringify(coords),'نسبة من أبعاد الصورة','polygon']];
  if(metric)fields.push(['width','عرض تقديري من صورة أمامية',metric.width,'مم','number'],['height','ارتفاع تقديري من صورة أمامية',metric.height,'مم','number']);
  for(const [key,property,value,unit,valueType] of fields){
   const evidence=upsertFieldRecord(room,{id:stem+'-'+key,itemId:stem,inputCode:klass[1],location:architectureWall(room,wall).label,property,value,unit,valueType,verification:key==='polygon'?'preliminary':'estimated',source,attachments:[photo],
    notes:JSON.stringify({kind:v.kind,wall,w,h,coordinates:'normalized-top-left',origin:v.origin==='manual'?'manual':'reviewed-detection',calibration})});
   if(!evidence.ok)return evidence;room=evidence.room;
  }
 }
 return {ok:true,doc:{...doc,room}};
}

export function photoOpeningProposal(doc,photoId,number,wall) {
 const stem='wa-'+photoId+'-'+number, records=doc.room.fieldRegister?.records||[];
 const find=suffix=>records.find(r=>r.id===stem+'-'+suffix);
 const poly=find('polygon'),width=find('width'),height=find('height');let notes;
 try{notes=JSON.parse(poly?.notes);}catch{return null;}
 if(!['door','window'].includes(notes?.kind)||notes.wall!==wall||!notes.calibration||!width||!height||!poly.attachments?.some(a=>a.id===photoId)||find('cad'))return null;
 const plane=notes.calibration.mode==='perspective';
 const edge=architectureWall(doc.room,wall);
 if(plane&&(!edge||notes.anchor!==JSON.stringify([edge.a,edge.b,doc.room.height])||!find('station')||!find('sill')))return null;
 return {stem,...(plane?{gapMm:find('station').value,bottomMm:find('sill').value}:{}),kind:notes.kind,width:width.value,height:height.value,wall,coordinates:poly.value,calibration:notes.calibration,
  stamp:JSON.stringify([wall,poly.value,poly.notes,width.value,height.value,...(plane?[find('station').value,find('sill').value]:[])]),photo:poly.attachments[0]};
}
export function placeMeasuredPhotoOpening(doc,{photoId,number,wall,stamp,measured,confirmed}){
 const fail=reason=>({ok:false,reason});
 const p=photoOpeningProposal(doc,photoId,number,wall);
 if(!p||p.stamp!==stamp||confirmed!==true)return fail('أعد مراجعة العنصر المحفوظ وتأكيد قياسه. ربما تغيّر أو أُضيف من قبل.');
 const m=measured||{};
 if(!['widthMm','heightMm','bottomMm','depthMm','gapMm'].every(k=>Number.isFinite(m[k]))||m.widthMm<10||m.heightMm<10||m.depthMm<10||m.bottomMm<0||m.gapMm<0)return fail('أكمل القيم الميدانية المطلوبة بالملليمتر.');
 if(p.kind==='door'&&(!['in','out','sliding'].includes(m.swing)||(m.swing!=='sliding'&&!['left','right'].includes(m.hinge))))return fail('حدّد حركة الباب وجهة المفصلة للباب المفصلي.');
 const old=doc.room.workshop?.chains?.[wall],prior=old?.rows||[];
 let i=1;while(prior.some(r=>r.id==='ph'+i)||doc.kitchen.features.some(f=>f.id==='chain-'+wall+'-ph'+i))i++;
 const id='ph'+i,row={id,kind:p.kind,from:'origin',gapMm:m.gapMm,widthMm:m.widthMm,heightMm:m.heightMm,bottomMm:m.bottomMm,depthMm:m.depthMm};
 if(p.kind==='door'){row.swing=m.swing;if(m.swing!=='sliding')row.hinge=m.hinge;}
 const edge=architectureWall(doc.room,wall);if(!edge)return fail('جدار غير متاح.');
 const x=m.gapMm/10+edge.start;
 if(doc.kitchen.features.some(f=>f.wall===wall&&['window','door'].includes(f.kind)&&Math.min(x+m.widthMm/10,f.u+f.width)>Math.max(x,f.u)&&Math.min((m.bottomMm+m.heightMm)/10,f.bottom+f.height)>Math.max(m.bottomMm/10,f.bottom)))return fail('توجد فتحة في هذا الموضع. راجع الفتحة القائمة من رفع الجدار دون إضافة نسخة ثانية.');
 const chain={source:old?.source||'field',rows:[row,...prior.map((r,j)=>j===0?{...r,from:'origin'}:r)]};
 const drawn=applyChain(doc,wall,chain);if(!drawn.ok)return drawn;
 const fid='chain-'+wall+'-'+id;
 const record=upsertFieldRecord(drawn.doc.room,{id:p.stem+'-cad',itemId:fid,inputCode:photoClasses[p.kind][1],location:edge.label,property:'قياسات فتحة البرواز المضافة إلى الرسم',value:'البداية '+m.gapMm+'، العرض '+m.widthMm+'، الارتفاع '+m.heightMm+'، منسوب الأسفل '+m.bottomMm+'، البروز '+m.depthMm,unit:'مم',valueType:'text',verification:'measured',source:'تأكيد الفني للقياسات الميدانية على الفتحة',attachments:[p.photo],notes:JSON.stringify({wall,photoElement:p.stem,featureId:fid})});
 if(!record.ok)return record;
 return {ok:true,featureId:fid,doc:{...drawn.doc,room:record.room}};
}

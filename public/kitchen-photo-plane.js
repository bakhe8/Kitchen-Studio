// Homography between a single photographed wall plane and its measured local
// coordinates. Image coordinates are dimensionless; wall coordinates are mm.
import {architectureWall} from './kitchen-architecture.js';
import {upsertFieldRecord} from './kitchen-field-model.js';
const img=p=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&v>=0&&v<=1);
const metric=p=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&v>=0&&v<=25000);
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const convex=q=>q.length===4&&q.every((p,i)=>cross(p,q[(i+1)%4],q[(i+2)%4])*cross(q[0],q[1],q[2])>1e-9);
const inside=(p,q)=>q.every((a,i)=>cross(a,q[(i+1)%4],p)*Math.sign(cross(q[0],q[1],q[2]))>=-1e-9);
const fail=reason=>({ok:false,reason});
function fit(from,to){
 const a=[];
 for(let i=0;i<4;i++){const [x,y]=from[i],[u,v]=to[i];a.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]);}
 for(let i=0;i<8;i++){
  let p=i;for(let k=i+1;k<8;k++)if(Math.abs(a[k][i])>Math.abs(a[p][i]))p=k;
  if(Math.abs(a[p][i])<1e-10)return null;
  [a[i],a[p]]=[a[p],a[i]];const div=a[i][i];for(let j=i;j<9;j++)a[i][j]/=div;
  for(let k=0;k<8;k++)if(k!==i){const f=a[k][i];for(let j=i;j<9;j++)a[k][j]-=f*a[i][j];}
 }
 return a.map(row=>row[8]);
}
const map=(p,m)=>{const [x,y]=p,d=m[6]*x+m[7]*y+1;return Math.abs(d)<1e-9?null:[(m[0]*x+m[1]*y+m[2])/d,(m[3]*x+m[4]*y+m[5])/d];};
export function wallPlane(doc,wall,c){
 const edge=architectureWall(doc.room,wall);
 if(!edge||!c||!Array.isArray(c.pixels)||c.pixels.length!==4||!c.pixels.every(img)||!convex(c.pixels)||!metric(c.origin)||!metric(c.size)||!img(c.checkPixel)||!metric(c.checkMm)||!Number.isFinite(c.tolerance)||c.tolerance<=0||c.tolerance>100||typeof c.reference!=='string'||!c.reference.trim()||c.reference.length>170)return fail('أكمل مراجع المستوى والنقطة الخامسة وسماحية المطابقة.');
 const [u,y]=c.origin,[w,h]=c.size;
 if(w<100||h<100||u+w>edge.length*10+.001||y+h>doc.room.height*10+.001)return fail('المستطيل المرجعي أصغر من المطلوب أو خارج وجه الجدار المقاس.');
 if(!inside(c.checkPixel,c.pixels)||c.pixels.some(p=>Math.hypot(p[0]-c.checkPixel[0],p[1]-c.checkPixel[1])<.025)||
  c.checkMm[0]<=u||c.checkMm[0]>=u+w||c.checkMm[1]<=y||c.checkMm[1]>=y+h)return fail('اختَر نقطة خامسة داخل المراجع ومستقلة عن الأركان الأربعة.');
 const matrix=fit(c.pixels,[[u,y],[u+w,y],[u+w,y+h],[u,y+h]]);
 const check=matrix&&map(c.checkPixel,matrix);
 if(!check)return fail('تعذّر حل المنظور. باعد بين المراجع وأعد ترتيبها.');
 const residual=Math.hypot(check[0]-c.checkMm[0],check[1]-c.checkMm[1]);
 if(residual>c.tolerance)return fail('خطأ نقطة التحقق '+residual.toFixed(1)+' مم يتجاوز '+c.tolerance+' مم.');
 return {ok:true,matrix,residual,anchor:JSON.stringify([edge.a,edge.b,doc.room.height])};
}
export function measurePlaneOpening(doc,wall,c,corners){
 const plane=wallPlane(doc,wall,c);if(!plane.ok)return plane;
 if(!Array.isArray(corners)||corners.length!==4||!corners.every(p=>img(p)&&inside(p,c.pixels))||!convex(corners))return fail('حدّد أركان البرواز الأربعة داخل المساحة المعايَرة بالترتيب المطلوب.');
 const q=corners.map(p=>map(p,plane.matrix));if(q.some(p=>!p))return fail('تعذّر تعيين حدود البرواز.');
 const [a,b,d,e]=q,near=(a,b)=>(a+b)/2;
 const deviation=Math.max(Math.abs(a[1]-b[1]),Math.abs(b[0]-d[0]),Math.abs(d[1]-e[1]),Math.abs(e[0]-a[0]));
 if(deviation>c.tolerance||b[0]<=a[0]||e[1]<=a[1])return fail('الحدود لا تمثّل بروازًا قائمًا ضمن السماحية أو ترتيب الأركان غير صحيح.');
 const left=near(a[0],e[0]),right=near(b[0],d[0]),bottom=near(a[1],b[1]),top=near(e[1],d[1]);
 if(right-left<10||top-bottom<10)return fail('فتحة أصغر من النطاق المدعوم.');
 return {ok:true,width:Math.round(right-left),height:Math.round(top-bottom),gapMm:Math.round(left),bottomMm:Math.round(bottom),residual:plane.residual,anchor:plane.anchor};
}
export function storePlanePhoto(doc,wall,photo,c,opening){
 const plane=wallPlane(doc,wall,c);if(!plane.ok)return plane;
 if(!photo?.id||!photo.name)return fail('يلزم إرفاق الصورة.');
 const records=doc.room.fieldRegister?.records||[],edge=architectureWall(doc.room,wall);
 const base={inputCode:'DOC-01',itemId:wall,location:edge.label,source:'صورة جدار معايرة · '+photo.name,attachments:[photo]},cid='plane-'+photo.id+'-'+wall;
 const coverage=upsertFieldRecord(doc.room,{...base,id:cid,property:'نطاق الصورة المرجعي على الجدار',valueType:'file',verification:'documented',notes:JSON.stringify({type:'wall-plane',wall,anchor:plane.anchor,calibration:c})});if(!coverage.ok)return coverage;
 let room=coverage.room;
 if(!opening)return {ok:true,doc:{...doc,room}};
 const {kind,corners}=opening;if(!['window','door'].includes(kind))return fail('اختر بابًا أو نافذة.');
 const m=measurePlaneOpening(doc,wall,c,corners);if(!m.ok)return m;
 const old=records.find(r=>{
  if(r.valueType!=='polygon'||r.value!==JSON.stringify(corners)||r.attachments?.[0]?.id!==photo.id)return false;
  try{const n=JSON.parse(r.notes);return n.origin==='plane'&&n.kind===kind&&n.wall===wall&&n.anchor===m.anchor&&JSON.stringify(n.calibration)===JSON.stringify({...c,mode:'perspective'});}catch{return false;}
 });
 if(old)return {ok:true,number:Number(old.itemId.split('-').at(-1)),doc:{...doc,room}};
 let number=1;const prefix='wa-'+photo.id+'-';
 while(number<=1000&&records.some(r=>r.itemId===prefix+number))number++;
 if(number>1000)return fail('بلغت الصورة حد العناصر الممكنة.');
 const stem=prefix+number,notes=JSON.stringify({kind,wall,origin:'plane',anchor:m.anchor,coordinates:'normalized-top-left',calibration:{...c,mode:'perspective'}});
 for(const [key,prop,val] of [['polygon','أركان البرواز على الصورة',JSON.stringify(corners)],['width','عرض البرواز المصحّح بالمنظور',m.width],['height','ارتفاع البرواز المصحّح بالمنظور',m.height],['station','بداية البرواز من ركن الجدار',m.gapMm],['sill','منسوب أسفل البرواز',m.bottomMm]]){
  const polygon=key==='polygon',row=upsertFieldRecord(room,{...base,id:stem+'-'+key,itemId:stem,inputCode:kind==='window'?'SITE-12':'SITE-11',property:prop,value:val,unit:polygon?'نسبة من أبعاد الصورة':'مم',valueType:polygon?'polygon':'number',verification:polygon?'preliminary':'estimated',notes});if(!row.ok)return row;room=row.room;
 }
 return {ok:true,number,doc:{...doc,room}};
}
export function planePhotoCoverage(doc,wall){
 const edge=architectureWall(doc.room,wall);if(!edge)return null;
 const w=edge.length*10,h=doc.room.height*10,rects=[],stale=[];
 for(const r of doc.room.fieldRegister?.records||[]){
  if(r.inputCode!=='DOC-01'||r.itemId!==wall||r.execution==='excluded'||r.verification!=='documented'||!r.attachments?.length||!r.id.startsWith('plane-'))continue;
  let n;try{n=JSON.parse(r.notes);}catch{continue;}
  const p=n.type==='wall-plane'&&wallPlane(doc,wall,n.calibration);
  if(!p?.ok||p.anchor!==n.anchor){stale.push(r.id);continue;}
  const [[x,y],[a,b]]=[n.calibration.origin,n.calibration.size];rects.push([x,y,x+a,y+b]);
 }
 const xs=[...new Set([0,w,...rects.flatMap(r=>[r[0],r[2]])])].sort((a,b)=>a-b);
 let covered=0,largest=null;
 for(let i=1;i<xs.length;i++){
  const x=xs[i-1],end=xs[i],active=rects.filter(r=>r[0]<=x&&r[2]>=end).sort((a,b)=>a[1]-b[1]);let y=0;
  const gap=top=>{const area=(end-x)*(top-y);if(area>0&&(!largest||area>largest.area))largest={fromMm:x,toMm:end,bottomMm:y,topMm:top,area};};
  for(const r of active){gap(r[1]);const start=Math.max(r[1],y);if(r[3]>start)covered+=(end-x)*(r[3]-start);y=Math.max(y,r[3]);}gap(h);
 }
 return {coveredM2:covered/1e6,wallM2:w*h/1e6,largest,stale};
}

// Interior perimeter in centimetres in the CAD model, mm in the field exchange.
const eps=1e-7;
export const outlineId=n=>'poly-'+String(n).padStart(2,'0');
export const outlineWallId=v=>typeof v==='string'&&/^poly-(0[1-9]|[12][0-9]|3[0-2])$/.test(v);
const cross=(a,b,p)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);
const between=(a,b,v)=>v>=Math.min(a,b)-eps&&v<=Math.max(a,b)+eps;
const on=(a,b,p)=>Math.abs(cross(a,b,p))<eps&&between(a.x,b.x,p.x)&&between(a.z,b.z,p.z);
const meets=(a,b,c,d)=>on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b)||(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0);
const twiceArea=points=>points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p.x*q.z-q.x*p.z;},0);
const err=reason=>({ok:false,reason});
export function validateMeasuredOutline(raw,width,length){
 if(!raw||!Array.isArray(raw.vertices)||raw.vertices.length<3||raw.vertices.length>32||raw.holes!==undefined||typeof raw.reference!=='string'||!raw.reference.trim()||raw.reference.length>160)return err('يلزم مرجع وتتابع واحد من ٣ إلى ٣٢ رأسًا، دون فتحات داخلية.');
 const vertices=raw.vertices.map(v=>({id:v?.id,x:v?.x,z:v?.z})),n=vertices.length;
 if(vertices.some(p=>!outlineWallId(p.id)||![p.x,p.z].every(v=>Number.isFinite(v)&&v>=0&&v<=1200))||new Set(vertices.map(v=>v.id)).size!==n)return err('راجع معرّفات الأضلاع الفريدة وإحداثياتها الموجبة في مستطيل الغرفة.');
 const xs=vertices.map(p=>p.x),zs=vertices.map(p=>p.z);
 if(Math.min(...xs)>eps||Math.min(...zs)>eps||Math.abs(Math.max(...xs)-width)>eps||Math.abs(Math.max(...zs)-length)>eps)return err('يجب أن يطابق محيط الرفع أبعاد المستطيل الحاوي. اعتمد أقصى اليسار والخلف مرجعًا للصفر.');
 if(twiceArea(vertices)<=eps)return err('رتّب الرؤوس مع عقارب الساعة على المسقط حيث يمتد محور العمق إلى الأمام.');
 for(let i=0;i<n;i++){
  const a=vertices[i],b=vertices[(i+1)%n],c=vertices[(i+2)%n];
  if(Math.hypot(a.x-b.x,a.z-b.z)<.1||Math.abs(cross(a,b,c))<eps)return err('يوجد ضلع قصير أو رؤوس متكررة أو على استقامة واحدة. احتفظ بنقاط تغيّر اتجاه الجدار فقط.');
  for(let j=i+1;j<n;j++)if(j!==i+1&&!(i===0&&j===n-1)&&meets(a,b,vertices[j],vertices[(j+1)%n]))return err('يتقاطع محيط الغرفة مع نفسه. راجع ترتيب الرؤوس.');
 }
 return {ok:true,outline:{reference:raw.reference.trim(),vertices}};
}
// Disjoint convex pieces of the bounding box that are OUTSIDE a simple contour.
// Clipping a cabinet against each trapezoid catches a bridge across a recess
// even when all four cabinet corners are inside the room.
export function excludedOutlinePieces(points,length){
 const xs=[...new Set(points.map(p=>p.x))].sort((a,b)=>a-b),out=[];
 const zero=()=>0,top=()=>length;
 for(let i=0;i+1<xs.length;i++){
  const a=xs[i],b=xs[i+1],mid=(a+b)/2,lines=[];
  for(let j=0;j<points.length;j++){
   const p=points[j],q=points[(j+1)%points.length];
   if(mid<=Math.min(p.x,q.x)||mid>=Math.max(p.x,q.x))continue;
   lines.push(x=>p.z+(q.z-p.z)*(x-p.x)/(q.x-p.x));
  }
  lines.sort((f,g)=>f(mid)-g(mid));
  for(let k=0;k<=lines.length;k+=2){
   const low=k?lines[k-1]:zero,high=lines[k]||top;
   if(high(mid)-low(mid)<eps)continue;
   const corners=[{x:a,z:low(a)},{x:b,z:low(b)},{x:b,z:high(b)},{x:a,z:high(a)}];
   const poly=corners.filter((p,j)=>{const q=corners[(j+3)%4];return Math.hypot(q.x-p.x,q.z-p.z)>eps;});
   if(poly.length>=3&&Math.abs(twiceArea(poly))>eps)out.push(poly);
  }
 }
 return out;
}
export function parseMeasuredOutline(raw){
 if(!raw||raw.unit!=='mm'||!Array.isArray(raw.vertices)||raw.vertices.length<3||raw.vertices.length>32||raw.holes!==undefined)return err('ملف الرفع يحتاج وحدة mm ومصفوفة vertices. لا تُقبل ملفات صور أو سحب نقطية هنا.');
 if(!Number.isFinite(raw.heightMm)||raw.vertices.some(p=>Array.isArray(p)?p.length!==2||!p.every(Number.isFinite):!p||!Number.isFinite(p.xMm)||!Number.isFinite(p.zMm)))return err('كل رأس يحتاج إحداثيين عدديين صريحين بالملليمتر.');
 if(raw.thicknessMm!=null&&(!Number.isFinite(raw.thicknessMm)||raw.thicknessMm<10||raw.thicknessMm>1000))return err('سماكة الجدار إن أُدخلت تكون بين ١٠ و١٠٠٠ مم.');
 const vertices=raw.vertices.map((p,i)=>({id:Array.isArray(p)?outlineId(i+1):p?.wallId,x:(Array.isArray(p)?p[0]:p?.xMm)/10,z:(Array.isArray(p)?p[1]:p?.zMm)/10}));
 const width=Math.max(...vertices.map(p=>p.x)),length=Math.max(...vertices.map(p=>p.z)),height=raw.heightMm/10;
 if(!Number.isFinite(height)||height<60||height>600||![width,length].every(v=>Number.isFinite(v)&&v>=60&&v<=1200))return err('راجع طول الغرفة وعرضها وارتفاعها بالملليمتر ضمن مجال الاستوديو.');
 const result=validateMeasuredOutline({reference:raw.reference,vertices},width,length);
 return result.ok?{ok:true,room:{width,length,height,colors:{},name:'مطبخ من مسقط مقاس',architecture:{wallThickness:(raw.thicknessMm??200)/10,outline:result.outline}}}:result;
}

// Lengths are in mm. Bearings are absolute clockwise plan angles: +x=0°, +z=90°.
// Only floating-point residue is tolerated at closure, never a field tolerance.
import {assistNumber} from './kitchen-measurement-identity.js';
import {outlineId} from './kitchen-measured-outline.js';

export const headingOptions={right:'يمين المسقط',front:'نحو الأمام',left:'يسار المسقط',back:'نحو الخلف',bearing:'زاوية مقاسة'};
const axes={right:[1,0],front:[0,1],left:[-1,0],back:[0,-1]};
const epsilonMm=1e-6;
export function traceWallWalk(rows){
 const points=[{x:0,z:0}];
 const result={points,closed:false,complete:false,vertices:[],residualMm:0,reason:''};
 for(const [i,row] of rows.entries()){
  const length=assistNumber(row.length),angle=assistNumber(row.angle);
  if(!(length>=1&&length<=18000)){result.reason='أدخل طول الجدار '+(i+1)+' بالملليمتر.';return result;}
  let v=axes[row.direction];
  if(row.direction==='bearing'&&angle!==null&&angle>=0&&angle<=360){
    const radians=angle*Math.PI/180;v=[Math.cos(radians),Math.sin(radians)];
  }
  if(!Array.isArray(v)){result.reason='حدّد اتجاه الجدار '+(i+1)+(row.direction==='bearing'?' بزاوية من صفر إلى ٣٦٠ درجة.':' على المسقط.');return result;}
  const last=points.at(-1);points.push({x:last.x+v[0]*length,z:last.z+v[1]*length});
 }
 result.complete=rows.length>0;
 const last=points.at(-1);result.residualMm=Math.hypot(last.x,last.z);
 if(rows.length<3){result.reason='يتطلب المحيط ثلاثة جدران على الأقل.';return result;}
 if(result.residualMm>epsilonMm){result.reason='لم تصل نهاية الجدار الأخير إلى ركن البداية.';return result;}
 // Translate the measured path to the existing storage datum without changing
 // bearings or stations. The last point is the original start, not a new wall.
 const origins=points.slice(0,-1),xmin=Math.min(...origins.map(p=>p.x)),zmin=Math.min(...origins.map(p=>p.z));
 result.vertices=origins.map((p,i)=>({wallId:rows[i].id||outlineId(i+1),xMm:p.x-xmin,zMm:p.z-zmin}));
 result.closed=true;return result;
}

export function wallsFromVertices(vertices){
 return vertices.map((p,i)=>{
  const next=vertices[(i+1)%vertices.length],x=(next.x-p.x)*10,z=(next.z-p.z)*10;
  const direction=Math.abs(z)<epsilonMm?(x>0?'right':'left'):Math.abs(x)<epsilonMm?(z>0?'front':'back'):'bearing';
  return {id:p.id,length:String(Math.hypot(x,z)),direction,
   angle:direction==='bearing'?String((Math.atan2(z,x)*180/Math.PI+360)%360):''};
 });
}

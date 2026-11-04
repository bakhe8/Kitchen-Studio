// These diagrams read the same millimetres that the technician submits.
import {roomArchitecture} from './kitchen-architecture.js';
import {assistNumber} from './kitchen-measurement-identity.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1});
const round=v=>Math.round(v*10)/10;
const kinds={floor:'أرضية',plinth:'تعلية',ceiling:'سقف'};
export function surfacePlan(room,patches,active){
 const walls=roomArchitecture(room).walls,W=room.width*10,H=room.length*10;
 const scale=Math.min(288/W,160/H),x=v=>round(160+(v-W/2)*scale),y=v=>round(92+(v-H/2)*scale);
 const outline=walls.map(({a})=>x(a.x*10)+','+y(a.z*10)).join(' ');
 return '<svg class="site-surface-plan" role="group" aria-label="مواقع مثلثات الرفع على مسقط الغرفة" viewBox="0 0 320 184" dir="ltr"><polygon points="'+outline+'" fill="#f2f5f2" stroke="#45656d" stroke-width="2"/>'+
  patches.map((p,i)=>{const triangle=p.triangle.map(([ax,az])=>[x(ax),y(az)]),cx=triangle.reduce((s,v)=>s+v[0]/3,0),cy=triangle.reduce((s,v)=>s+v[1]/3,0);
   return '<g tabindex="0" role="button" aria-label="'+esc('تعديل '+kinds[p.kind]+' · '+p.reference)+'" data-map-patch="'+esc(p.id)+'" data-kind="'+esc(p.kind)+'" aria-pressed="'+(p.id===active)+'"><polygon points="'+triangle.map(v=>v.join(',')).join(' ')+'"/><text x="'+round(cx)+'" y="'+round(cy+4)+'" text-anchor="middle">'+fmt.format(i+1)+'</text></g>';}).join('')+'</svg>';
}
function pipePoints(raw){
 const value=raw.trim();if(!value)return {status:''};
 const lines=value.split(/\n+/);
 if(lines.length>64)return {status:'الحد الأقصى ٦٤ نقطة للمسار.'};
 const points=lines.map(row=>row.trim().split(/[\s,،]+/).map(assistNumber));
 const invalid=points.findIndex((p,i)=>p.length<3||p.length>(i===0||i===points.length-1?3:4)||p.some(v=>v===null||!Number.isFinite(v)));
 if(invalid>=0)return {status:'راجع إحداثيات النقطة '+fmt.format(invalid+1)+' وأدخل X وY وZ بالملليمتر.'};
 if(points.length<2)return {status:'أُدخلت نقطة البداية. أضف نقطة المخرج أو النقطة التالية.'};
 return {points,status:'يظهر مقطع '+fmt.format(points.length)+' نقاط من المدخلات الحالية. احفظ المسار للتحقق من حدود المواصفة.'};
}
export const pipeStatus=raw=>pipePoints(raw).status;
export function pipeProfile(raw){
 const {points}=pipePoints(raw);if(!points)return '';
 const stations=[0];for(let i=1;i<points.length;i++)stations.push(stations[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][2]-points[i-1][2]));
 const heights=points.map(p=>p[1]),low=Math.min(...heights),high=Math.max(...heights),len=stations.at(-1);
 const coords=stations.map((d,i)=>[round(len?18+d/len*284:160),round(high>low?80-(heights[i]-low)/(high-low)*60:50)]);
 return '<figure class="site-pipe-profile"><figcaption>مقطع المناسيب على طول المسار</figcaption><svg viewBox="0 0 320 100" role="img" aria-label="المسافة الأفقية التراكمية مقابل المنسوب، لكل محور مقياس مستقل" dir="ltr"><path d="M18 12V88H302" fill="none" stroke="#9aabad"/><polyline fill="none" stroke="#12685e" stroke-width="2.5" points="'+coords.map(v=>v.join(',')).join(' ')+'"/>'+
  coords.map(([x,y],i)=>'<circle cx="'+x+'" cy="'+y+'" r="3" fill="#12685e"><title>'+fmt.format(i+1)+' · '+fmt.format(heights[i])+' مم</title></circle>').join('')+'</svg><div><span>البداية <b>'+fmt.format(heights[0])+' مم</b></span><span>النهاية <b>'+fmt.format(heights.at(-1))+' مم</b></span><span>المسافة الأفقية <b>'+fmt.format(len)+' مم</b></span></div></figure>';
}
export function zoneElevation(room,wall,zones,draft){
 const edge=roomArchitecture(room).walls.find(v=>v.id===wall);if(!edge)return '';
 const width=edge.length*10,height=room.height*10,scale=Math.min(300/width,134/height);
 const x0=(320-width*scale)/2,y0=(150-height*scale)/2;
 const shapes=zones.filter(v=>v.wall===wall&&v.id!==draft.id);
 const fields=['startMm','endMm','bottomMm','topMm'],values=fields.map(k=>assistNumber(draft[k]));
 if(values.every(v=>v!==null&&v>=0)&&Math.max(...values.slice(0,2))<=width&&Math.max(...values.slice(2))<=height&&
    (draft.kind==='light'?(values[0]!==values[1]||values[2]!==values[3]):values[0]<values[1]&&values[2]<values[3]))
  shapes.push({...draft,...Object.fromEntries(fields.map((key,i)=>[key,values[i]])),current:true});
 return '<figure class="site-zone-elevation"><figcaption>'+esc(edge.label)+' · '+fmt.format(width)+' × '+fmt.format(height)+' مم</figcaption><svg viewBox="0 0 320 150" role="img" aria-label="امتداد الخدمات المقاسة على واجهة الجدار" dir="ltr"><rect x="'+round(x0)+'" y="'+round(y0)+'" width="'+round(width*scale)+'" height="'+round(height*scale)+'" fill="#fbfcf8" stroke="#688186"/>'+
  shapes.map(v=>{const a=round(x0+v.startMm*scale),b=round(x0+v.endMm*scale),bottom=round(y0+(height-v.bottomMm)*scale),top=round(y0+(height-v.topMm)*scale);
   const color=v.current?'#12685e':'#73868d';
   return '<g><title>'+esc(v.name||'النطاق المدخل')+'</title>'+(v.kind==='light'?'<line x1="'+a+'" x2="'+b+'" y1="'+bottom+'" y2="'+top+'" stroke="'+color+'" stroke-width="3"/>':'<rect x="'+a+'" y="'+top+'" width="'+round(b-a)+'" height="'+round(bottom-top)+'" fill="'+(v.current?'#b9dcd3':'#dde5e5')+'" stroke="'+color+'" stroke-width="'+(v.current?2.2:1)+'"/>')+'</g>';
  }).join('')+'</svg></figure>';
}

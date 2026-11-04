import {ownKey} from './kitchen-safe-keys.js';
import {architectureContainsDisc,architectureContainsPolygon,roomArchitecture} from './kitchen-architecture.js';
export const pointTypes=Object.freeze({'floor-drain':'بلاعة أرضية','floor-cleanout':'فتحة تسليك','floor-water':'تغذية أرضية'});
const round=n=>Math.round(n*10)/10;
export function checkSitePoints(room){
 const points=room.sitePoints;if(points==null)return {ok:true,points:[]};
 if(!Array.isArray(points)||points.length>64)return {ok:false,reason:'عدد نقاط الأرضية غير صالح.'};
 const seen=new Set(),out=[];for(const p of points){
  if(!p||typeof p.id!=='string'||!/^[\w-]{1,64}$/.test(p.id)||seen.has(p.id)||!ownKey(pointTypes,p.kind)||![p.x,p.z,p.size].every(Number.isFinite)||p.size<1||p.size>100)return {ok:false,reason:'راجع نوع النقطة الأرضية ومقاسها.'};
  const stored={id:p.id,kind:p.kind,x:round(p.x),z:round(p.z),size:round(p.size)};
  if(p.accessMargin!=null){
    if(p.kind==='floor-water'||!Number.isFinite(p.accessMargin)||p.accessMargin<0||p.accessMargin>150)return {ok:false,reason:'راجع المسافة الإضافية المطلوبة حول غطاء الأرضية.'};
    stored.accessMargin=round(p.accessMargin);
  }
  function fits(q){
    const half=q.size/2;
    if(q.kind!=='floor-drain')return architectureContainsDisc(room,q,half);
    return architectureContainsPolygon(room,[{x:q.x-half,z:q.z-half},{x:q.x+half,z:q.z-half},{x:q.x+half,z:q.z+half},{x:q.x-half,z:q.z+half}]);
  }
  if(stored.accessMargin){
    const half=stored.size/2+stored.accessMargin;
    if(!architectureContainsPolygon(room,[{x:stored.x-half,z:stored.z-half},{x:stored.x+half,z:stored.z-half},{x:stored.x+half,z:stored.z+half},{x:stored.x-half,z:stored.z+half}]))return {ok:false,reason:'حيّز الوصول المقاس حول الغطاء يتجاوز أرضية الغرفة.'};
  }
  if(!fits(p)||!fits(stored))return {ok:false,reason:pointTypes[p.kind]+' خارج أرضية الغرفة. غيّر موضعها أو حدّ الغرفة.'};
  seen.add(p.id);out.push(stored);
 }return {ok:true,points:out};
}
export const wallOptions=room=>roomArchitecture(room).walls.map(w=>[w.id,w.label]);
export const sourceLinks=Object.freeze({
 sedra:'https://alb-home.roshn.sa/docs/pdf/448/SEDRA_Brochure_2092025_155aa70cdb/SEDRA_Brochure_2092025_155aa70cdb.pdf',
 apartment:'https://naf.com.sa/uploads/5705152_pdf_638806399611390703.pdf',
 hasa:'https://ruh-s3.bluvalt.com/api-nhc.sa/s3fs-public/2023-03/%D8%A7%D9%84%D8%A3%D8%B5%D8%A7%D9%84%D8%A9_compressed_compressed.pdf'
});

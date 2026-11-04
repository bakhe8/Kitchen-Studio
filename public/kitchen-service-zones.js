import {ownKey,inheritedName} from './kitchen-safe-keys.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
// The technician supplies each envelope from an actual measurement or a documented
// restriction. Geometry in the persisted module is mm from the near end of a wall.
import {architectureWall,architectureWallIdKnown} from './kitchen-architecture.js';
import {kitchenGeometry,kitchenRunPolygon,kitchenUnitSpecs} from './kitchen-model.js';
import {convexIntersection,polygonArea,polygonBounds} from './kitchen-oriented.js';

export const zoneKinds={solid:'جسم قائم أو مسار تمديد ظاهر',access:'حيز فتح أو صيانة يجب إبقاؤه متاحًا',noDrill:'منطقة ممنوع الحفر فيها',light:'مقطع إنارة مستقيم'};
const code=['valve','pipe','filter','switch','panel','ac','alarm','data','driver','other'];
export const serviceClasses={valve:'محبس ماء',pipe:'ماسورة أو تمديد',filter:'فلتر أو مضخة',switch:'مفتاح',panel:'لوحة أو علبة تفتيش',ac:'تكييف أو فلتر هواء',alarm:'كاشف أو رشاش',data:'تحكم أو بيانات',driver:'محوّل إنارة',other:'تجهيز آخر'};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v)&&!inheritedName(v)&&!['constructor','__proto__','prototype'].includes(v);
const txt=(s,n)=>typeof s==='string'&&s.trim()&&s.length<=n;
const range=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
const opt=(v,min,max)=>v===undefined||v===null||range(v,min,max);
const show=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n);
export function cleanServiceZones(raw){
 if(!plain(raw)||!Array.isArray(raw.zones)||raw.zones.length>128||raw.mounts!==undefined&&!plain(raw.mounts))return null;
 const zones=[],ids=new Set(),mounts={},openings={};
 for(const z of raw.zones){
  if(!plain(z)||!id(z.id)||ids.has(z.id)||!architectureWallIdKnown(z.wall)||!ownKey(zoneKinds,z.kind)||!code.includes(z.service)||!txt(z.name,92)||!txt(z.ref,160))return null;
  if(![z.startMm,z.endMm,z.bottomMm,z.topMm].every(n=>range(n,0,18000))||(z.kind==='light'?(z.startMm===z.endMm&&z.topMm===z.bottomMm):(z.startMm>=z.endMm||z.topMm<=z.bottomMm)))return null;
  const zone={id:z.id,wall:z.wall,kind:z.kind,service:z.service,name:z.name.trim(),ref:z.ref.trim(),startMm:z.startMm,endMm:z.endMm,bottomMm:z.bottomMm,topMm:z.topMm};
  if(['solid','access'].includes(z.kind)){if(!range(z.depthMm,1,18000))return null;zone.depthMm=z.depthMm;}
  if(z.kind==='light'){
   if(!opt(z.wattsPerM,0,10000)||z.driverId!=null&&!id(z.driverId))return null;
   if(z.wattsPerM!=null)zone.wattsPerM=z.wattsPerM;
   if(z.driverId)zone.driverId=z.driverId;
  }else if(z.service==='driver'&&z.capacityW!=null){if(!range(z.capacityW,.01,100000))return null;zone.capacityW=z.capacityW;}
  ids.add(z.id);zones.push(zone);
 }
 const listings=Object.entries(raw.mounts||{});if(listings.length>256)return null;
 for(const [unitId,m] of listings){
  if(!id(unitId)||!plain(m)||!['wall','free'].includes(m.mode)||!txt(m.drawing,160)||!txt(m.signature,320)||!Array.isArray(m.points)||m.points.length>128)return null;
  if(m.mode==='wall'&&!m.points.length||m.mode==='free'&&m.points.length)return null;
  if(m.points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(n=>range(n,0,18000))))return null;
  mounts[unitId]={mode:m.mode,drawing:m.drawing.trim(),signature:m.signature,points:m.points.map(p=>[...p])};
 }
 if(raw.openings!==undefined&&!plain(raw.openings))return null;
 const ports=Object.entries(raw.openings||{});if(ports.length>256)return null;
 for(const [key,p] of ports){
  if(!plain(p)||!id(p.zoneId)||!id(p.unitId)||key!==p.zoneId+'|'+p.unitId||!txt(p.drawing,160)||!txt(p.signature,1100)||p.reviewed!==true)return null;
  if(![p.start,p.end,p.bottom,p.top,p.depth].every(n=>range(n,0,18000))||p.end<=p.start||p.top<=p.bottom||p.depth<=0)return null;
  openings[key]={zoneId:p.zoneId,unitId:p.unitId,drawing:p.drawing.trim(),reviewed:true,signature:p.signature,start:p.start,end:p.end,bottom:p.bottom,top:p.top,depth:p.depth};
 }
 return {zones,mounts,...(ports.length?{openings}:{})};
}
export function serviceMountSignature(doc,unitId){
 const u=doc.kitchen.units.find(v=>v.id===unitId),r=u&&doc.kitchen.runs.find(v=>v.id===u.runId),w=r&&architectureWall(doc.room,r.wall);
 if(!u||!r||!w)return '';
 return JSON.stringify([r.id,u.id,r.wall,u.kind,u.u,u.width,r.bottom,r.height,r.depth,r.tier,w.start,w.end,readWorkshopCatalog(doc.room.workshop)?.layoutRevision??null]);
}
export function serviceOpeningSignature(doc,z,unitId){
 const u=doc.kitchen.units.find(v=>v.id===unitId);if(!u)return '';
 const parts=[serviceMountSignature(doc,unitId),u.frontStyle,u.doorHanding,u.handleStyle,u.interior,u.detail,z.wall,z.kind,z.service,z.startMm,z.endMm,z.topMm,z.bottomMm,z.depthMm,z.ref];
 // Retain the short stamp in records. The final projection and depth are still
 // compared against the actual current aperture at each evaluation.
 let h=2166136261;for(const c of JSON.stringify(parts))h=Math.imul(h^c.charCodeAt(0),16777619);
 return 'opening-'+(h>>>0).toString(16);
}
function passOpening(doc,u,z,w,record){
 if(!record||record.signature!==serviceOpeningSignature(doc,z,u.id)||!record.reviewed||
    u.wall!==z.wall||!['storage','sink','open-shelf'].includes(u.kind))return false;
 const l=(u.u-w.start)*10,b=u.bottom*10,eps=.000001;
 return record.start>=0&&record.end<=u.width*10+eps&&record.top<=u.height*10+eps&&
   record.depth+eps>=u.depth*10&&z.startMm>=l+record.start-eps&&z.endMm<=l+record.end+eps&&
   z.bottomMm>=b+record.bottom-eps&&z.topMm<=b+record.top+eps;
}
function wallBox(room,z){
 const w=architectureWall(room,z.wall);if(!w)return null;
 const u=w.start+z.startMm/10,width=(z.endMm-z.startMm)/10,depth=z.depthMm/10;
 const polygon=kitchenRunPolygon(room,{wall:z.wall},u,width,depth);
 return {id:'service-zone-'+z.id,kind:'column',wall:z.wall,u,width,depth,bottom:z.bottomMm/10,height:(z.topMm-z.bottomMm)/10,polygon,rect:polygonBounds(polygon)};
}
export function surveyServiceBlocks(room){
 const s=room.workshop?.serviceZones;
 return !s?[]:(s.zones||[]).filter(z=>z.kind==='solid'||z.kind==='access').map(z=>wallBox(room,z)).filter(Boolean);
}
function collides(a,b){
 if(Math.min(a.bottom+a.height,b.bottom+b.height)<=Math.max(a.bottom,b.bottom)+1e-7)return false;
 return a.polygon?.length>=3&&b.polygon?.length>=3&&Math.abs(polygonArea(convexIntersection(a.polygon,b.polygon)))>1e-7;
}
function drillIssue(doc,unit,zone,mount,wall){
 const localLeft=(unit.u-wall.start)*10,base=unit.bottom*10;
 if(localLeft>zone.endMm||localLeft+unit.width*10<zone.startMm||base>zone.topMm||base+unit.height*10<zone.bottomMm)return '';
 if(!mount||mount.signature!==serviceMountSignature(doc,unit.id))return 'يلزم مخطط تثبيت حالي للوحدة '+unit.id+' للتحقق من '+zone.name+'.';
 if(mount.mode==='free')return unit.tier==='upper'?'الوحدة المعلّقة '+unit.id+' تحتاج نقاط تعليق موثقة.':'';
 for(const [x,y] of mount.points){
  if(x>unit.width*10||y>unit.height*10)return 'نقطة تثبيت خارج حدود الوحدة '+unit.id+' في '+mount.drawing+'.';
  if(localLeft+x>=zone.startMm&&localLeft+x<=zone.endMm&&base+y>=zone.bottomMm&&base+y<=zone.topMm)return 'نقطة تثبيت الوحدة '+unit.id+' تقع في '+zone.name+' وفق '+mount.drawing+'.';
 }
 return '';
}
export function evaluateServiceZones(doc,scope=null){
 const raw=doc.room.workshop?.serviceZones;if(!raw)return {issues:[],lighting:[]};
 const cleaned=cleanServiceZones(raw);if(!cleaned)return {issues:['بيانات حيز الخدمات أو نقاط التعليق غير صالحة.'],lighting:[]};
 const {zones,mounts,openings={}}=cleaned,issues=[],lighting=[],loads=new Map();
 const ids=scope?new Set(scope.unitIds):null,walls=scope?new Set(scope.walls):null;
 const k={...doc.kitchen,units:doc.kitchen.units.map(u=>kitchenUnitSpecs[u.kind]?.openable?{...u,open:true}:u)};
 const geom=kitchenGeometry(k,doc.room);
 for(const z of zones){
  const wall=architectureWall(doc.room,z.wall),sel=!walls||walls.has(z.wall);
  if(!wall||Math.max(z.startMm,z.endMm)>(wall.end-wall.start)*10+.00001||Math.max(z.bottomMm,z.topMm)>doc.room.height*10+.00001){
   if(sel)issues.push(z.name+' يتجاوز حدود جدار الرفع الحالي. راجع '+z.ref+'.');continue;
  }
  if(z.kind==='light'){
   const length=Math.hypot(z.endMm-z.startMm,z.topMm-z.bottomMm),power=z.wattsPerM==null?null:length/1000*z.wattsPerM;
   const driver=zones.find(d=>d.id===z.driverId&&d.kind==='access'&&d.service==='driver');
   if(sel)lighting.push({name:z.name,lengthMm:length,powerW:power,driver:driver?.name||''});
   if(z.driverId){
    if(!driver){if(sel)issues.push('محوّل '+z.name+' يحتاج حيز صيانة معرّفًا.');}
    else{const group=loads.get(driver.id)||{draw:0,known:true,driver,selected:false};group.selected||=sel||!!walls?.has(driver.wall);group.draw+=power||0;group.known&&=power!==null;loads.set(driver.id,group);}
   }
   continue;
  }
  const box=z.kind==='noDrill'?null:wallBox(doc.room,z);
  for(const u of geom.units){
   if(ids&&!ids.has(u.id))continue;
   if(z.kind==='noDrill'){
    if(u.wall!==z.wall)continue;
    const reason=drillIssue(doc,u,z,mounts[u.id],wall);if(reason)issues.push(reason);continue;
   }
   if(z.kind==='access'&&passOpening(doc,u,z,wall,openings[z.id+'|'+u.id]))continue;
   if([...(u.bodyParts||[u]),...(u.openParts||[])].some(part=>collides(box,part)))issues.push('الوحدة '+u.id+' أو مسار فتحها يتداخل مع '+(z.kind==='access'?'حيز الخدمة ':'جسم ')+z.name+'.');
  }
  if(box)for(const t of geom.worktops||[]){
   if(scope&&!scope.runIds.includes(t.runId))continue;
   if((t.polygon?.length||0)>2&&collides(box,t))issues.push('سطح العمل في '+t.runId+' يتداخل مع '+z.name+'.');
  }
 }
 for(const {draw,known,driver,selected} of loads.values())if(selected){
  if(!known||!driver.capacityW)issues.push('راجع قدرة '+driver.name+' وكثافة القدرة لكل شريط موصول به من الدليل.');
  else if(draw>driver.capacityW+.00001)issues.push('أحمال '+driver.name+' المقيسة '+show(draw)+' واط تتجاوز قدرة '+show(driver.capacityW)+' واط.');
 }
 return {issues:[...new Set(issues)],lighting};
}
export const serviceZoneIssues=(doc,scope)=>evaluateServiceZones(doc,scope).issues;

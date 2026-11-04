import {inheritedName} from './kitchen-safe-keys.js';
import {cleanCornerBuild} from './kitchen-corner-carcass.js';
import {cleanCornerBody,cornerSolids,cornerCollisionIssues} from './kitchen-corner-solid.js';
import {optionEnvelopes} from './kitchen-chain-options.js';
import {kitchenGeometry} from './kitchen-model.js';
import {roomArchitecture} from './kitchen-architecture.js';

const wallKey=v=>typeof v==='string'&&/^[a-z][a-z0-9-]{1,55}$/.test(v)&&!inheritedName(v);
const extent=v=>Number.isInteger(v)&&v>=100&&v<=3000;
const insideKinds=['shelves','empty','carousel','pullout','custom'];
const accessKinds=['a','b','both'];
export const cornerKey=(a,b)=>[a,b].sort().join('+');
export function cleanProductionCorners(input){
 if(!input||Array.isArray(input)||typeof input!=='object'||Object.keys(input).length>32)return null;
 const result={};
 for(const [key,c] of Object.entries(input)){
  if(!c||!wallKey(c.a)||!wallKey(c.b)||c.a>=c.b||key!==cornerKey(c.a,c.b)||typeof c.tall!=='boolean')return null;
  const copy={a:c.a,b:c.b,tall:c.tall};
  for(const tier of ['base','upper']){
   const q=c[tier];if(q==null)continue;
   if(!extent(q.aMm)||!extent(q.bMm)||!insideKinds.includes(q.inside)||!accessKinds.includes(q.access)||typeof q.sku!=='string'||q.sku.length>90)return null;
   const body=q.body==null?null:cleanCornerBody(q.body);if(q.body!=null&&!body)return null;
   const build=q.build!=null?cleanCornerBuild(q.build):null;if(q.build!=null&&!build)return null;
   copy[tier]={...(build?{build}:{}),...(body?{body}:{}),aMm:q.aMm,bMm:q.bMm,access:q.access,inside:q.inside,sku:q.sku};
  }
  if(!copy.base&&!copy.upper||c.tall&&(!copy.base||!copy.upper||JSON.stringify(copy.base)!==JSON.stringify(copy.upper)))return null;
  result[key]=copy;
 }
 return result;
}
export function connectedWallCorners(room){
 const walls=roomArchitecture(room).walls,result=[];
 for(const a of walls)for(const b of walls){
  if(a.id>=b.id)continue;
  for(const [p,pointA] of [[a.a,a.start],[a.b,a.end]])for(const [q,pointB] of [[b.a,b.start],[b.b,b.end]]){
   if(Math.hypot(p.x-q.x,p.z-q.z)>1e-5)continue;
   result.push({id:cornerKey(a.id,b.id),a,b,pointA,pointB});
  }
 }
 return result;
}
export function cornerReservations(doc,run){
 if(!run.wall)return [];
 const corners=doc.room.workshop?.corners||{},intervals=[];
 for(const j of connectedWallCorners(doc.room)){
  const c=corners[j.id],q=c?.[run.tier];if(!q||run.wall!==j.a.id&&run.wall!==j.b.id)continue;
  const a=run.wall===j.a.id,wall=a?j.a:j.b,point=a?j.pointA:j.pointB,width=(a?q.aMm:q.bMm)/10;
  const start=Math.max(run.start,Math.abs(point-wall.start)<1e-5?point:point-width),end=Math.min(run.end,Math.abs(point-wall.start)<1e-5?point+width:point);
  if(end>start)intervals.push({u:start,width:end-start});
 }
 return intervals;
}
export function checkCornerPlacement(doc,record,key){
 if(!record||!cleanProductionCorners({[key]:record}))return 'أدخل امتدادًا بين ١٠٠ و٣٠٠٠ مم لكل ضلع وتفاصيل صحيحة.';
 const joint=connectedWallCorners(doc.room).find(j=>j.id===key);
 if(!joint)return 'الجداران لا يلتقيان في المسقط الحالي.';
 for(const q of [record.base,record.upper].filter(Boolean)){
  if(q.aMm>(joint.a.end-joint.a.start)*10||q.bMm>(joint.b.end-joint.b.start)*10)return 'يتجاوز امتداد الزاوية طول أحد ضلعي الجدار.';
 }
 const proposed={...doc,room:{...doc.room,workshop:{...doc.room.workshop,corners:{...doc.room.workshop?.corners,[key]:record}}}};
 for(const wall of [joint.a,joint.b])for(const tier of ['base','upper']){
  const bays=cornerReservations(proposed,{wall:wall.id,start:wall.start,end:wall.end,tier}).sort((a,b)=>a.u-b.u);
  if(bays.some((b,i)=>i&&b.u<bays[i-1].u+bays[i-1].width-1e-6))return 'يتداخل امتداد زاويتين على '+wall.label+' في المستوى نفسه. قلّل امتداد إحدى الزاويتين.';
 }
 return '';
}

export function cornerMotionIssues(doc,scope){
 const corners=doc.room.workshop?.corners;if(!corners||!Object.keys(corners).length)return [];
 const open={...doc.kitchen,features:[...doc.kitchen.features,...optionEnvelopes(doc)],units:doc.kitchen.units.map(u=>({...u,open:true}))};
 const geometry=kitchenGeometry(open,doc.room);
 return cornerCollisionIssues(cornerSolids(doc.room,corners),geometry,scope);
}

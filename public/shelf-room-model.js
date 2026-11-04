import {ownKey} from './kitchen-safe-keys.js';
// There is always ONE cabinet. The familiar wall editor keeps working in the
// local coordinates of its mounting wall. Looking at a face is UI state only.
import {SHELF_LIMITS as L,asScopedPlan,partitionMinimum,shelfDepth,wallColorIds} from './shelf-model.js';

export const roomWallIds=Object.freeze(['back','front','left','right']);
export const roomFaceIds=Object.freeze([...roomWallIds,'floor','ceiling']);
export const roomFaceLabels=Object.freeze({back:'الجدار الخلفي',front:'الجدار الأمامي',left:'الجدار الأيسر',right:'الجدار الأيمن',floor:'الأرضية',ceiling:'السقف'});
const eps=1e-8,plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const num=v=>new Intl.NumberFormat('ar',{maximumFractionDigits:2}).format(v);
const side=id=>id==='left'||id==='right',validWall=id=>roomWallIds.includes(id),near=(a,b)=>Math.abs(a-b)<=eps;
const sizeFor=(r,id)=>({w:side(id)?r.length:r.width,h:r.height,depth:side(id)?r.width:r.length});
const limitsOK=r=>[r.width,r.length,r.height].every(Number.isFinite)&&r.width>=L.minWallW&&r.width<=L.maxWallW&&r.length>=L.minWallW&&r.length<=L.maxWallW&&r.height>=L.minWallH&&r.height<=L.maxWallH;

export function getRoom(plan){
  const r=plan.room;return r?{width:r.width,length:r.length,height:r.height,attachedWall:r.attachedWall}:
    {width:plan.wall.w,length:300,height:plan.wall.h,attachedWall:'back'};
}
export function roomWallSize(plan,id){return validWall(id)?sizeFor(getRoom(plan),id):null;}
export function roomWallData(plan,id){
  if(!validWall(id))return null;
  if(id===getRoom(plan).attachedWall)return {color:plan.wallColor,grid:plan.wallGrid??null};
  const saved=plan.room?.layers?.[id];return {color:saved?.color??'sand',grid:saved?.grid??null};
}

// World x right, y down, z towards the front of the room. u (local x)
// points right to a person facing the wall from inside. d (local z) always
// points into the room. The same formulas serve furniture, picking and photos.
export function wallLocalToRoom(plan,id,p){
  if(!validWall(id)||!p||![p.x,p.y,p.z??0].every(Number.isFinite))return null;
  const {width:W,length:A}=getRoom(plan),u=p.x,y=p.y,d=p.z??0;
  switch(id){case 'back':return {x:u,y,z:d};case 'front':return {x:W-u,y,z:A-d};
    case 'left':return {x:d,y,z:A-u};case 'right':return {x:W-d,y,z:u};}
}
export function roomToWallLocal(plan,id,p){
  if(!validWall(id)||!p||![p.x,p.y,p.z].every(Number.isFinite))return null;
  const {width:W,length:A}=getRoom(plan),{x,y,z}=p;
  switch(id){case 'back':return {x,y,z};case 'front':return {x:W-x,y,z:A-z};
    case 'left':return {x:A-z,y,z:x};case 'right':return {x:z,y,z:W-x};}
}
const normals={back:[0,0,1],front:[0,0,-1],left:[1,0,0],right:[-1,0,0],floor:[0,-1,0],ceiling:[0,1,0]};
const pt=(x,y,z)=>({x,y,z});
export function roomFaces(plan){
  const r=getRoom(plan),W=r.width,A=r.length,H=r.height;
  return roomFaceIds.map(id=>{
    const isWall=validWall(id),{w,h}=isWall?sizeFor(r,id):{w:W,h:A};
    const points=isWall?[[0,0],[w,0],[w,h],[0,h]].map(([x,y])=>wallLocalToRoom(plan,id,{x,y,z:0})):
      id==='floor'?[pt(0,H,0),pt(W,H,0),pt(W,H,A),pt(0,H,A)]:[pt(0,0,A),pt(W,0,A),pt(W,0,0),pt(0,0,0)];
    return {id,kind:isWall?'wall':id,label:roomFaceLabels[id],w,h,points,inward:pt(...normals[id])};
  });
}

const refuse=(plan,code,reason)=>({ok:false,changed:false,plan,room:getRoom(plan),code,reason,clamped:false,adjustments:[]});
const accept=(p,next,reason='',adjustments=[])=>({ok:true,changed:p!==next,plan:next,room:getRoom(next),code:'',reason,clamped:!!adjustments.length,adjustments});
function checkRoom(p,r){
  if(!limitsOK(r))return refuse(p,'room-dimensions','أدخل عرضًا وطولًا بين ٦٠ و١٢٠٠ سم وارتفاعًا بين ٦٠ و٦٠٠ سم.');
  const size=sizeFor(r,r.attachedWall),c=p.cab,gap=Math.max(0,p.wall.h-c.y-c.h);
  if(c.w>size.w+eps)return refuse(p,'cabinet-width',`عرض الدولاب ${num(c.w)} سم، وعرض ${roomFaceLabels[r.attachedWall]} ${num(size.w)} سم فقط. لم يُصغَّر الدولاب.`);
  if(shelfDepth(p)>size.depth+eps)return refuse(p,'cabinet-depth',`عمق الدولاب ${num(shelfDepth(p))} سم يتجاوز المسافة إلى الجدار المقابل (${num(size.depth)} سم).`);
  if(c.h+gap>r.height+eps)return refuse(p,'mount-height',`يلزم ارتفاع ${num(c.h+gap)} سم لحفظ الدولاب والمسافة ${num(gap)} سم عن الأرض.`);
  for(const id of roomWallIds){
    const grid=roomWallData(p,id).grid;if(!grid)continue;
    const min=partitionMinimum(grid,true),sz=sizeFor(r,id);
    if(min.w>sz.w+eps||min.h>sz.h+eps)return refuse(p,'wall-zones',`التقسيم المحفوظ على ${roomFaceLabels[id]} يحتاج إلى ${num(min.w)} × ${num(min.h)} سم على الأقل.`);
  }
  return null;
}
function applyRoom(plan,r){
  const rejected=checkRoom(plan,r);if(rejected)return rejected;
  const prior=getRoom(plan),p=asScopedPlan(plan),from=prior.attachedWall,to=r.attachedWall;
  const {w,h}=sizeFor(r,to),c=p.cab,clearance=p.wall.h-c.y-c.h;
  const x=Math.max(0,Math.min(c.x,w-c.w)),y=Math.max(0,h-clearance-c.h);
  const changes=near(x,c.x)?[]:[{axis:'x',from:c.x,to:x}];
  const reason=changes.length?`عُدّلت المسافة من يسار الجدار من ${num(c.x)} إلى ${num(x)} سم ليبقى الدولاب كاملًا على الجدار.`:'';
  const moving=from!==to;
  let layers=p.room?.layers||{};
  let next=p;
  if(moving){
    const leaving=roomWallData(p,from),arriving=roomWallData(p,to);
    // Active wall metadata has one source of truth: editor fields. Inactive
    // walls are stored by ID, omitting defaults and never aliasing the active slot.
    layers={...layers};
    if(leaving.color!=='sand'||leaving.grid)layers[from]=leaving;else delete layers[from];
    delete layers[to];
    next={...p,wallColor:arriving.color,wallGrid:arriving.grid};
    // A zone ID belongs only to its own wall and must never rebind to a
    // similarly named zone on the destination. Cabinet cell IDs remain valid.
    if(p.selection.kind==='zone')next.selection={kind:'wall'};
  }
  const wall=near(w,p.wall.w)&&near(h,p.wall.h)?p.wall:{w,h};
  const cab=near(x,c.x)&&near(y,c.y)?c:{...c,x,y};
  return accept(plan,{...next,cab,wall,room:{...r,layers}},reason,changes);
}
export function updateRoom(plan,patch){
  if(!plain(patch)||!['width','length','height'].some(k=>ownKey(patch,k))||
      Object.keys(patch).some(k=>!['width','length','height'].includes(k)||!Number.isFinite(patch[k])))
    return refuse(plan,'room-dimensions','أدخل مقاسات الغرفة بالسنتيمتر.');
  const old=getRoom(plan),r={...old,...patch};
  if(plan.room&&r.width===old.width&&r.length===old.length&&r.height===old.height)return accept(plan,plan);
  return applyRoom(plan,r);
}
export function attachCabinet(plan,id){
  if(!validWall(id))return refuse(plan,'not-a-wall','يمكن تثبيت الدولاب على أحد الجدران الأربعة فقط.');
  const r=getRoom(plan);if(id===r.attachedWall)return accept(plan,plan);
  return applyRoom(plan,{...r,attachedWall:id});
}

// Called by validatePlan only. Reuse its depth/node/identity budget and grid
// sanitizer so inactive wall partitions meet exactly the same rules as active.
export function readRoomRecord(raw,p,readGrid){
  if(!plain(raw)||!validWall(raw.attachedWall)||!limitsOK(raw)||!plain(raw.layers))return null;
  const room={width:raw.width,length:raw.length,height:raw.height,attachedWall:raw.attachedWall,layers:{}};
  const live=sizeFor(room,room.attachedWall);
  if(!near(live.w,p.wall.w)||!near(live.h,p.wall.h)||shelfDepth(p)>live.depth+eps)return null;
  for(const [id,part] of Object.entries(raw.layers)){
    if(!validWall(id)||id===room.attachedWall||!plain(part)||!wallColorIds.includes(part.color)||!ownKey(part,'grid'))return null;
    const grid=part.grid===null?null:readGrid(part.grid,0,true);if(part.grid!==null&&!grid)return null;
    if(grid){const m=partitionMinimum(grid,true),sz=sizeFor(room,id);if(m.w>sz.w+eps||m.h>sz.h+eps)return null;}
    if(part.color!=='sand'||grid)room.layers[id]={color:part.color,grid};
  }
  return room;
}

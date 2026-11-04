import {ownKey,inheritedName} from './kitchen-safe-keys.js';
import {readWorkshopCatalog} from './kitchen-catalog-view.js';
import {resolveUnitSupport} from './kitchen-base-support.js';
import {lightBodies} from './kitchen-linear-light.js';
import {wallAssembly,volumePolygon} from './kitchen-wall-accessory.js';
import {cornerSolids} from './kitchen-corner-solid.js';
// Room centimetres. Horizontal u runs to the right when facing a wall from
// inside the room. Vertical "bottom" is measured UP from the finished floor.
// A kitchen is an independent immutable document, not a shelf cabinet preset.
import {measuredKitchenRoom,roomArchitecture,architectureWall,architectureWallPoint,architectureWallLocal,architectureWallIdKnown,architectureWallLabel,validateKitchenRoomArchitecture} from './kitchen-architecture.js';
import {validatePlan,cabMinimum} from './shelf-model.js';
import {polygonBounds,convexIntersection,outsidePieces} from './kitchen-oriented.js';
import {closedPlacementConflicts,fittingStarts} from './kitchen-placement.js';
import {fillKitchenRow} from './kitchen-row-fill.js';
export {fillKitchenRow};

const eps=1e-7,finite=Number.isFinite,wallOK=architectureWallIdKnown;
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
const validID=id=>typeof id==='string'&&/^[a-zA-Z0-9][\w-]{0,79}$/.test(id)&&!inheritedName(id);
const num=n=>new Intl.NumberFormat('ar',{maximumFractionDigits:1}).format(n);
const span=(x,a,b)=>finite(x)&&x>=a&&x<=b;
const tierOK=t=>t==='base'||t==='upper';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=(k,reason,code='invalid')=>({ok:false,changed:false,kitchen:k,id:null,reason,code,clamped:false});
const done=(k,next,id,reason='',clamped=false)=>({ok:true,changed:next!==k,kitchen:next,id,reason,code:'',clamped});
import {kitchenFrontFinishes,kitchenWorktopFinishes} from './kitchen-materials.js';
import {kitchenUnitSpecs,kitchenUnitAllowed,kitchenFrontStyles,kitchenHandleStyles,kitchenDoorHandings,kitchenHoodBlocks} from './kitchen-catalog.js';
export {kitchenFrontFinishes,kitchenWorktopFinishes,kitchenUnitSpecs,kitchenUnitAllowed,kitchenFrontStyles,kitchenHandleStyles,kitchenDoorHandings};
const materialOK=(table,s)=>s==null||typeof s==='string'&&ownKey(table,s);
// Only literal six-digit sRGB colours may cross the persistence/SVG boundary.
// The material underneath remains independently selectable; null clears tint.
const tintOK=s=>s==null||typeof s==='string'&&s.length===7&&/^#[0-9a-f]{6}$/i.test(s);
export const kitchenFeatureSpecs=Object.freeze({
  window:{label:'نافذة',width:95,height:100,bottom:100,depth:3},door:{label:'باب',width:85,height:205,bottom:0,depth:4},
  shaft:{label:'منور / مجرى خدمات مصمت',width:50,height:240,bottom:0,depth:45},beam:{label:'كمرة ساقطة',width:115,height:25,bottom:235,depth:35},heater:{label:'سخان جداري',width:42,height:65,bottom:110,depth:42},
  column:{label:'عمود',width:30,height:240,bottom:0,depth:30},water:{label:'نقطة مياه',width:6,height:6,bottom:50,depth:3},
  drain:{label:'صرف',width:8,height:8,bottom:42,depth:3},electric:{label:'مقبس كهرباء',width:8,height:8,bottom:108,depth:3},
  vent:{label:'تهوية',width:15,height:15,bottom:190,depth:3},gas:{label:'نقطة غاز',width:7,height:7,bottom:55,depth:3}
});
const unitKind=k=>ownKey(kitchenUnitSpecs,k),featureKind=k=>ownKey(kitchenFeatureSpecs,k);
const solidFeature=k=>['column','shaft','beam','heater','window','door'].includes(k);
const unitAllowed=kitchenUnitAllowed;
export const kitchenRoom=measuredKitchenRoom;
export const kitchenWallSpan=(input,wall)=>architectureWall(input,wall)?.end??0;
export const kitchenWallPoint=architectureWallPoint,kitchenWallLocal=architectureWallLocal;
const degrees=a=>((a%360)+360)%360;
const trig=a=>{const r=a*Math.PI/180,clean=n=>Math.abs(n)<1e-14?0:n;return [clean(Math.cos(r)),clean(Math.sin(r))];};
export const isFreeKitchenRun=r=>r?.placement==='free';
export function kitchenRunPoint(input,run,u,d=0){
  if(!run||!finite(u)||!finite(d))return null;
  if(!isFreeKitchenRun(run))return kitchenWallPoint(input,run.wall,u,d);
  const [c,s]=trig(run.angle);return {x:run.x+u*c-d*s,z:run.z+u*s+d*c};
}
export function kitchenRunLocal(input,run,p){
  if(!run||!p||![p.x,p.z].every(finite))return null;
  if(!isFreeKitchenRun(run))return kitchenWallLocal(input,run.wall,p);
  const [c,s]=trig(run.angle),x=p.x-run.x,z=p.z-run.z;return {u:x*c+z*s,d:-x*s+z*c};
}
/** [back-left,back-right,front-right,front-left] in wall or run-local u,d.
 * Wall-mounted u remains absolute on its wall; a free run starts at u=0. */
export function kitchenRunPolygon(room,run,u,width,depth,offset=0){
  return [[u,offset],[u+width,offset],[u+width,offset+depth],[u,offset+depth]].map(([i,d])=>kitchenRunPoint(room,run,i,d));
}
const footprint=(room,r,u,w,d,offset=0)=>{const polygon=kitchenRunPolygon(room,r,u,w,d,offset);return {polygon,rect:polygonBounds(polygon)};};
export function kitchenWallRect(input,wall,u,width,depth,offset=0){return architectureWall(input,wall)?footprint(input,{wall},u,width,depth,offset).rect:null;}
const intersectBand=(a,b)=>Math.min(a.bottom+a.height,b.bottom+b.height)-Math.max(a.bottom,b.bottom)>eps;
const modelKinds=new Set(['dishwasher','oven','oven-tower','fridge','freezer','hood','microwave','laundry-bay','hob']);
export function cleanDeviceModel(v,kind){
  if(!modelKinds.has(kind)||!v||!['model','manual'].every(key=>typeof v[key]==='string'&&v[key].trim()&&v[key].length<=160))return null;
  if(!span(v.widthMm,200,2400)||!span(v.heightMm,100,4000)||!span(v.depthMm,100,1500)||!['widthMm','heightMm','depthMm'].every(key=>Number.isSafeInteger(v[key])))return null;
  if(v.requestId!==undefined&&(typeof v.requestId!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,44}$/.test(v.requestId)))return null;
  return {...(v.requestId?{requestId:v.requestId}:{}),model:v.model.trim(),manual:v.manual.trim(),widthMm:v.widthMm,heightMm:v.heightMm,depthMm:v.depthMm};
}
const unitHeight=(u,r)=>u.modelSpec?u.modelSpec.heightMm/10:kitchenUnitSpecs[u.kind].height??r.height;
const unitDepth=(u,r)=>u.modelSpec?u.modelSpec.depthMm/10:kitchenUnitSpecs[u.kind].depth??r.depth;
const supportsTop=(u,r)=>r.tier==='base'&&kitchenUnitSpecs[u.kind].worktop!==false;
function physicalParts(room,r,u){
  if(u.kind!=='hood')return null;
  return kitchenHoodBlocks(u.width,unitHeight(u,r),unitDepth(u,r)).map(b=>({id:u.id,kind:u.kind,label:kitchenUnitSpecs.hood.label,part:b.part,wall:r.wall,runId:r.id,tier:r.tier,
    u:u.u+b.du,width:b.width,depth:b.depth,bottom:r.bottom+b.db,height:b.height,...footprint(room,r,u.u+b.du,b.width,b.depth)}));
}
const choicesOK=(u,s)=>materialOK(kitchenFrontStyles,u.frontStyle)&&materialOK(kitchenHandleStyles,u.handleStyle)
  &&(u.frontStyle==null||s.frontStyles===true)&&(u.handleStyle==null||s.handles===true);
const handingOK=(u,s)=>u.doorHanding==null||s.configurableHanding===true&&materialOK(kitchenDoorHandings,u.doorHanding);
const mark=(k,id)=>[...k.runs,...k.units,...k.features].some(x=>x.id===id);
function nextId(k,type,given){
  if(given!=null)return validID(given)&&!mark(k,given)?given:null;
  let i=k.nextId;while(mark(k,type+'-'+i))i++;return type+'-'+i;
}
const within=(a,b)=>a.start>=b.start-eps&&a.end<=b.end+eps;
const positiveOverlap=(lo,hi,l,r)=>Math.min(hi,r)-Math.max(lo,l)>eps;
function freeIntervals(run,units,skip){
  let cursor=run.start;const out=[];
  for(const u of units.filter(x=>x.runId===run.id&&x.id!==skip).sort((a,b)=>a.u-b.u)){
    if(u.u>cursor+eps)out.push({start:cursor,end:u.u,width:u.u-cursor});
    cursor=Math.max(cursor,u.u+u.width);
  }
  if(run.end>cursor+eps)out.push({start:cursor,end:run.end,width:run.end-cursor});return out;
}
const fillTypes=['frontFinish','frontColor','frontStyle','handleStyle'];
function validFillOptions(r){
  if(r.autoFill!==undefined&&r.autoFill!==true)return false;
  if(r.fillDefaults!==undefined&&(!r.autoFill||!plain(r.fillDefaults)||Object.keys(r.fillDefaults).some(key=>!fillTypes.includes(key))||!materialOK(kitchenFrontFinishes,r.fillDefaults.frontFinish)||!tintOK(r.fillDefaults.frontColor)||!materialOK(kitchenFrontStyles,r.fillDefaults.frontStyle)||!materialOK(kitchenHandleStyles,r.fillDefaults.handleStyle)))return false;
  if(r.fillGaps===undefined)return true;
  if(!r.autoFill||!Array.isArray(r.fillGaps)||r.fillGaps.length>256)return false;
  let last=r.start;
  return r.fillGaps.every(g=>{if(!plain(g)||!finite(g.u)||!finite(g.width)||g.width<=0||g.u<last-eps||g.u+g.width>r.end+eps)return false;last=g.u+g.width;return true;});
}
function fillAttrs(r){return r.autoFill===true?{autoFill:true,...(r.fillDefaults?{fillDefaults:Object.fromEntries(fillTypes.filter(f=>r.fillDefaults[f]!=null).map(f=>[f,r.fillDefaults[f]]))}:{}),...(r.fillGaps?.length?{fillGaps:r.fillGaps.map(({u,width})=>({u,width}))}:{})}:{};}
const heldGap=(r,u,w)=>(r.fillGaps||[]).some(g=>positiveOverlap(u,u+w,g.u,g.u+g.width));
const fixedRole=u=>u.fillRole==='auto'||u.fillRole==='fixed';
/** Virtual workspace for changing an anchor without colliding with units the solver may replace. */
export function kitchenEditableSpace(k,runId,exceptId=null){
  const managed=k.runs.some(r=>r.id===runId&&r.autoFill);
  if(!managed||!k.units.some(u=>u.runId===runId&&u.id!==exceptId&&u.fillRole==='auto'))return k;
  return {...k,units:k.units.filter(u=>u.runId!==runId||u.id===exceptId||u.fillRole!=='auto')};
}
function reflow(before,room,raw,ids){
  if(!raw.ok)return {...raw,kitchen:before};
  let next=raw.kitchen,report;
  for(const id of new Set(ids)){
    if(!next.runs.some(r=>r.id===id&&r.autoFill))continue;
    const result=fillKitchenRow(next,room,id,{previousKitchen:before});
    if(!result.ok)return {...result,kitchen:before,changed:false};
    next=result.kitchen;report=result;
  }
  const guarded=guardEdit(before,room,{...raw,kitchen:next,changed:!same(before,next),...(report?{stats:report.stats,reason:report.reason||raw.reason}: {})});
  return guarded.ok&&!guarded.changed?{...guarded,kitchen:before}:guarded;
}
function validRun(r){
  if(!plain(r)||!validID(r.id)||!tierOK(r.tier)||!span(r.depth,15,150)||!span(r.bottom,0,600)||!span(r.height,15,400)||!materialOK(kitchenWorktopFinishes,r.worktopFinish)||!tintOK(r.worktopColor)||!validFillOptions(r))return false;
  if(r.worktopThicknessMm!==undefined&&(r.tier!=='base'||!span(r.worktopThicknessMm,1,500)))return false;
  if(isFreeKitchenRun(r))return r.tier==='base'&&r.wall===null&&span(r.x,0,1200)&&span(r.z,0,1200)&&span(r.length,20,1700)&&span(r.angle,0,360)&&r.angle<360&&r.start===0&&r.end===r.length;
  return (r.placement==null||r.placement==='wall')&&wallOK(r.wall)&&span(r.start,0,1700)&&span(r.end,0,1700)&&r.end-r.start>=20-eps;
}
function putRun(k,room,raw,old=null){
  const free=isFreeKitchenRun(raw),tier=raw?.tier??(free?'base':null);
  if(!plain(raw)||(!free&&!wallOK(raw.wall))||!tierOK(tier)||(old&&free!==isFreeKitchenRun(old)))return fail(k,'اختر جدارًا للصف أو موضعًا حرًا للجزيرة.');
  if(!free&&!architectureWall(room,raw.wall))return fail(k,'هذا الجدار غير موجود في شكل الغرفة الحالي.','missing-wall');
  if(raw.placement!=null&&!['free','wall'].includes(raw.placement))return fail(k,'نوع الامتداد غير صالح.');
  if(!materialOK(kitchenWorktopFinishes,raw.worktopFinish))return fail(k,'خامة سطح العمل غير معروفة.','worktop-finish');
  if(!tintOK(raw.worktopColor))return fail(k,'لون سطح العمل يجب أن يضم ست خانات بعد #.','worktop-color');
  const base=tier==='base',r={id:raw.id,wall:free?null:raw.wall,tier,start:free?0:Math.min(raw.start,raw.end),end:free?raw.length:Math.max(raw.start,raw.end),
    depth:raw.depth??(base?60:34),bottom:raw.bottom??(base?0:145),height:raw.height??(base?86:70),
    ...(free?{placement:'free',x:raw.x,z:raw.z,angle:finite(raw.angle??0)?degrees(raw.angle??0):NaN,length:raw.length}:{}),
    ...(raw.worktopThicknessMm!=null?{worktopThicknessMm:raw.worktopThicknessMm}:{}),...(raw.worktopFinish!=null?{worktopFinish:raw.worktopFinish}:{}),...(raw.worktopColor!=null?{worktopColor:raw.worktopColor.toLowerCase()}:{})};
  if(raw.autoFill===true&&!validFillOptions({...r,autoFill:true,fillDefaults:raw.fillDefaults,fillGaps:raw.fillGaps}))return fail(k,'تمتد مساحة محجوزة خارج الصف الجديد، أو أن إعدادات التعبئة غير صالحة.','fill-range');
  Object.assign(r,fillAttrs(raw));
  if(!span(r.depth,15,150))return fail(k,'أدخل عمقًا للصف بين ١٥ و١٥٠ سم.','run-depth');
  if(!validRun(r))return fail(k,'يلزم امتداد صالح بطول ٢٠ سم على الأقل وعمق وارتفاع صالحين.');
  const initial=[r.start,r.end];
  // Editing depth alone moves the FRONT only. Don't shorten or slide the
  // mounted row to clear a corner; the placement guard must reject a real
  // obstruction against the original longitudinal span instead.
  const keepSpan=old&&!free&&old.wall===r.wall&&old.start===r.start&&old.end===r.end&&old.depth!==r.depth;
  for(const o of k.runs){
    if(keepSpan||o.id===old?.id||!intersectBand(r,o))continue;
    const oPoly=kitchenRunPolygon(room,o,o.start,o.end-o.start,o.depth);
    if(!convexIntersection(kitchenRunPolygon(room,r,r.start,r.end-r.start,r.depth),oPoly).length)continue;
    // Only trim a newly encountered perpendicular wall corner. Pre-existing
    // overlaps are compared against their previous physical extent below.
    if(free||isFreeKitchenRun(o)||o.wall===r.wall)continue;
    const w=architectureWall(room,r.wall),other=architectureWall(room,o.wall);
    if(!other||!within(r,w)||Math.abs(w.tangent.x*other.tangent.x+w.tangent.z*other.tangent.z)>eps||
      ![w.a,w.b].some(p=>[other.a,other.b].some(q=>Math.hypot(q.x-p.x,q.z-p.z)<eps)))continue;
    if(old&&intersectBand(old,o)&&convexIntersection(kitchenRunPolygon(room,old,old.start,old.end-old.start,old.depth),oPoly).length)continue;
    const projected=oPoly.map(p=>kitchenWallLocal(room,r.wall,p).u),lo=Math.min(...projected),hi=Math.max(...projected);
    if(lo<=r.start+eps)r.start=Math.max(hi,r.start);else if(hi>=r.end-eps)r.end=Math.min(lo,r.end);else return fail(k,'يشطر الضلع المجاور هذا الامتداد. ارسم من أحد جانبيه.','corner');
    if(r.end-r.start<20-eps)return fail(k,'الجزء المتاح بعد حسم الركن أقل من ٢٠ سم.','corner');
  }
  if(old&&k.units.some(u=>u.runId===old.id&&(!unitAllowed(u.kind,r)||!within({start:u.u,end:u.u+u.width},r))))
    return fail(k,'سيخرج جسم وحدة من امتدادها. انقل الوحدة أولًا؛ لا يتغير عرضها تلقائيًا.','occupied-range');
  if(old&&k.units.some(u=>u.runId===old.id&&u.detail&&(cabMinimum(u.detail).h>unitHeight(u,r)+eps)))return fail(k,'الارتفاع الجديد لا يتسع لتقسيم إحدى الوحدات.','detail-fit');
  if(old&&same(r,old))return done(k,k,r.id);
  const trimmed=initial[0]!==r.start||initial[1]!==r.end;
  return done(k,{...k,nextId:k.nextId+(old?0:1),runs:old?k.runs.map(x=>x===old?r:x):[...k.runs,r]},r.id,trimmed?'حُسم عمق الضلع المجاور من الركن مرة واحدة.':'',trimmed);
}
export function addRun(k,room,s){if(!s||k.runs.length>=48)return fail(k,'بلغ المطبخ حدّ الامتدادات.');const out=guardEdit(k,room,putRun(k,room,{...s,id:nextId(k,'run',s.id)}));return out.ok&&s.autoFill?reflow(k,room,out,[out.id]):out;}
export function addFreeRun(k,room,s){return addRun(k,room,{...s,placement:'free'});}
export function updateRun(k,room,id,patch){
  const old=k.runs.find(x=>x.id===id);if(!old||!plain(patch))return fail(k,'لم يعد الامتداد موجودًا.');
  if(!old.autoFill||Object.keys(patch).every(p=>['worktopFinish','worktopColor'].includes(p)))return guardEdit(k,room,putRun(k,room,{...old,...patch,id},old));
  if(old.autoFill&&patch.autoFill===false)return fail(k,'لا يمكن نزع إدارة الصف من خصائص المقاس.');
  if(!Object.entries(patch).some(([p,v])=>!same(old[p],v)))return done(k,k,id);
  const base=kitchenEditableSpace(k,id),out=guardEdit(base,room,putRun(base,room,{...old,...patch,id},old));
  return reflow(k,room,out,[id]);
}
/** Translate the original centre by (dx,dz), rotate about it to absolute
 * angle. All attached records retain their run-local physical coordinates.
 * A wall stops the whole footprint; an impossible pose or a run collision
 * fails atomically instead of shifting cabinets relative to the island. */
export function transformFreeRun(k,input,id,{dx=0,dz=0,angle}={}){
  const r=k.runs.find(x=>x.id===id);
  if(!isFreeKitchenRun(r)||![dx,dz,angle??r.angle].every(finite))return fail(k,'اختر جزيرة وحركة صالحة.');
  const room=kitchenRoom(input),centre=kitchenRunPoint(room,r,r.length/2,r.depth/2),theta=degrees(angle??r.angle),[c,s]=trig(theta);
  let x=centre.x+dx-(r.length*c-r.depth*s)/2,z=centre.z+dz-(r.length*s+r.depth*c)/2;
  const box=footprint(room,{...r,x,z,angle:theta},0,r.length,r.depth).rect;
  if(box.w>room.width+eps||box.d>room.length+eps)return fail(k,'لا تتسع الغرفة لدوران الجزيرة بهذه الزاوية.','outside-room');
  const nx=Math.max(0,Math.min(room.width-box.w,box.x)),nz=Math.max(0,Math.min(room.length-box.d,box.z));
  const clipped=Math.abs(nx-box.x)>eps||Math.abs(nz-box.z)>eps;
  x=Math.max(0,x+nx-box.x);z=Math.max(0,z+nz-box.z);
  if(Math.abs(x-r.x)<eps)x=r.x;if(Math.abs(z-r.z)<eps)z=r.z;
  const result=updateRun(k,room,id,{x,z,angle:theta});
  return result.ok&&clipped?{...result,clamped:true,reason:'توقفت الجزيرة عند حد الغرفة مع بقاء أبعاد الوحدات ومواقعها النسبية.'}:result;
}

// Detailed interiors use the real cabinet validator. Deliberately omit room,
// wall grid, image/reference screen and selection state from imported detail.
function cleanDetail(v){
  if(!plain(v))return null;
  const detailed=v.version===2||v.cellGrids!=null,doc={version:detailed?2:1,wall:v.wall,cab:v.cab,cols:v.cols,rows:v.rows,cells:v.cells,
    finish:v.finish,wallColor:'sand',selectedCell:'0:0',...(v.depth!==undefined?{depth:v.depth}:{}),
    ...(detailed?{cellGrids:v.cellGrids||{},wallGrid:null,selection:{kind:'cabinet'},...(v.bayFinishes?{bayFinishes:v.bayFinishes}:{})}:{})};
  return validatePlan(doc);
}
function interior(i){return plain(i)&&['shelves','dividers'].every(k=>Number.isInteger(i[k])&&span(i[k],0,8))?{shelves:i.shelves,dividers:i.dividers}:null;}
function putUnit(k,room,s,old=null){
  const r=k.runs.find(x=>x.id===s.runId),spec=kitchenUnitSpecs[s.kind];
  if(!validID(s.id)||!r||!unitAllowed(s.kind,r))return fail(k,'اختر امتدادًا مناسبًا لنوع الوحدة.','unit-tier');
  const model=s.modelSpec&&cleanDeviceModel(s.modelSpec,s.kind);
  if(s.modelSpec!=null&&!model)return fail(k,'راجع نوع الجهاز وموديله ومرجع الدليل والأبعاد الخارجية بالملليمتر.','device-model');
  const width=s.width??(model?model.widthMm/10:spec.width);
  if(model&&Math.abs(width*10-model.widthMm)>eps)return fail(k,'يجب أن يطابق عرض الحيّز المرسوم عرض الموديل المحدد.','device-width');
  const drawers=s.drawerCount;
  if(drawers!=null&&(s.kind!=='drawers'||!Number.isInteger(drawers)||!span(drawers,1,8)))return fail(k,'عدد واجهات الأدراج من ١ إلى ٨ في وحدة أدراج فقط.');
  if(!span(width,20,240))return fail(k,'عرض الوحدة بين ٢٠ و٢٤٠ سم.');
  if(old&&spec.fixedWidth&&old.kind===s.kind&&width!==old.width&&(!model||same(model,old.modelSpec)))return fail(k,'عرض هذا الجهاز ثابت كما أُدخل عند إضافته.','fixed-width');
  const gaps=freeIntervals(r,k.units,old?.id),u=s.u??gaps.find(g=>g.width>=width-eps)?.start;
  if(!finite(u)||!within({start:u,end:u+width},r))return fail(k,'لا توجد مساحة كافية بهذا العرض داخل الامتداد.','unit-bounds');
  const inner=interior(s.interior??{shelves:s.kind==='open-shelf'?2:s.kind==='storage'||s.kind==='tall'?1:0,dividers:0});if(!inner)return fail(k,'أدخل عددًا صحيحًا من ٠ إلى ٨ للتقسيم الداخلي.');
  if(s.open!==undefined&&typeof s.open!=='boolean')return fail(k,'حالة الفتح غير صالحة.');
  if(!materialOK(kitchenFrontFinishes,s.frontFinish))return fail(k,'تشطيب واجهة الوحدة غير معروف.','front-finish');
  if(!tintOK(s.frontColor))return fail(k,'لون الواجهة يجب أن يضم ست خانات بعد #.','front-color');
  const unit={id:s.id,runId:r.id,kind:s.kind,u,width,open:!!spec.openable&&s.open===true,interior:inner};
  if(model)unit.modelSpec=model;if(drawers!=null)unit.drawerCount=drawers;
  if(s.fillRole!=null){if(!r.autoFill||!fixedRole(s))return fail(k,'حالة تخصيص الوحدة غير صالحة.','fill-role');unit.fillRole=s.fillRole;}
  if(!choicesOK(s,spec))return fail(k,'هذه الواجهة أو هذا المقبض غير متاحين لنوع الوحدة.','front-options');
  if(!handingOK(s,spec))return fail(k,'اختيار عدد الضلف وجهة المفصلة متاح للخزائن المفصلية فقط.','door-handing');
  if(s.frontStyle!=null)unit.frontStyle=s.frontStyle;if(s.handleStyle!=null)unit.handleStyle=s.handleStyle;
  if(s.doorHanding!=null&&s.doorHanding!=='auto')unit.doorHanding=s.doorHanding;
  if(s.frontFinish!=null)unit.frontFinish=s.frontFinish;
  if(s.frontColor!=null)unit.frontColor=s.frontColor.toLowerCase();
  if(s.detail!=null){
    const detail=s.detail===old?.detail?old.detail:cleanDetail(s.detail);if(!detail)return fail(k,'التقسيم التفصيلي غير صالح.','detail-invalid');
    const m=cabMinimum(detail);if(width<m.w-eps||unitHeight(unit,r)<m.h-eps)return fail(k,'مقاس الوحدة لا يتسع للتقسيم الداخلي المحفوظ.','detail-fit');
    unit.detail=detail;
  }
  if(old&&same(unit,old))return done(k,k,old.id);
  return done(k,{...k,nextId:k.nextId+(old?0:1),units:old?k.units.map(x=>x===old?unit:x):[...k.units,unit]},unit.id);
}
export function availableKitchenSlotsRaw(k,room,s){
  const r=s&&k.runs.find(r=>r.id===s.runId);if(!r||k.units.length>=256)return [];
  const sketch=putUnit(k,room,{...s,id:nextId(k,'unit',s.id),u:r.start});
  if(!sketch.ok)return [];
  const sample=sketch.kitchen.units.at(-1),D=unitDepth(sample,r),ur={...sample,...footprint(room,r,sample.u,sample.width,D),depth:D,supportsWorktop:supportsTop(sample,r),
    tier:r.tier,wall:r.wall,bottom:r.bottom,height:unitHeight(sample,r),cutout:cutFor(room,sample,r),bodyParts:physicalParts(room,r,sample)};
  return fittingStarts(kitchenGeometry(k,room),r,ur,p=>kitchenRunLocal(room,r,p));
}
export function availableKitchenSlots(k,room,s){
  const r=k.runs.find(v=>v.id===s?.runId),base=kitchenEditableSpace(k,r?.id);
  let slots=availableKitchenSlotsRaw(base,room,s);
  const w=s?.width??kitchenUnitSpecs[s?.kind]?.width;
  for(const g of r?.fillGaps||[])slots=slots.flatMap(v=>{
    const lo=g.u-w,hi=g.u+g.width;if(v.end<=lo+eps||v.start>=hi-eps)return [v];
    return [...(v.start<=lo+eps?[{...v,end:Math.max(v.start,lo)}]:[]),...(v.end>=hi-eps?[{start:Math.min(v.end,hi),end:v.end,u:Math.min(v.end,hi)}]:[])];
  });
  return slots;
}
export function addKitchenUnitRaw(k,room,s){
  if(!s||k.units.length>=256)return fail(k,'بلغ المطبخ حدّ الوحدات.');
  const attrs={...s,id:nextId(k,'unit',s.id)},result=guardEdit(k,room,putUnit(k,room,attrs));
  if(result.ok||s.u!=null||!result.conflict)return result;
  // The old convenience path chose the first dimensional gap. If there is
  // no explicit pointer/number, find the first PHYSICALLY valid start too.
  for(const slot of availableKitchenSlotsRaw(k,room,s)){
    const alt=guardEdit(k,room,putUnit(k,room,{...attrs,u:slot.start}));if(alt.ok)return alt;
  }
  return result;
}
const blockedReservation=k=>fail(k,'هذا الموضع متروك فارغًا عمدًا. أعد تعبئة الفراغات المحجوزة في خصائص الصف أولًا.','reserved-space');
export function addUnit(k,room,s){
  const r=k.runs.find(r=>r.id===s?.runId);if(!r?.autoFill){if(s?.fillRole!=null){const {fillRole,...copy}=s;return addKitchenUnitRaw(k,room,copy);}return addKitchenUnitRaw(k,room,s);}
  const base=kitchenEditableSpace(k,r.id),w=s.width??kitchenUnitSpecs[s.kind]?.width;if(!finite(w))return fail(k,'اختر وحدة معروفة.');
  const u=s.u??availableKitchenSlots(k,room,s)[0]?.start;if(u==null)return fail(k,'لا توجد مساحة متاحة لهذا العرض بين الوحدات المخصّصة.','unit-bounds');
  if(heldGap(r,u,w))return blockedReservation(k);
  // A deliberate insertion is an anchor even if pasted from a flexible cabinet.
  const out=addKitchenUnitRaw(base,room,{...s,u,fillRole:'fixed'});return reflow(k,room,out,[r.id]);
}
function changedKindSpec(old,patch){
  const s={...old,...patch,id:old.id};if(s.kind===old.kind)return s;
  const spec=kitchenUnitSpecs[s.kind];if(!spec)return s;
  if(!ownKey(patch,'modelSpec'))delete s.modelSpec;if(s.kind!=='drawers')delete s.drawerCount;
  if(spec.fixedWidth&&patch.width==null)s.width=spec.width;
  if(!spec.handles)delete s.handleStyle;if(!spec.frontStyles)delete s.frontStyle;if(!spec.configurableHanding)delete s.doorHanding;
  if(!spec.editableInterior)delete s.detail;
  if(!ownKey(patch,'interior'))delete s.interior;
  s.open=false;return s;
}
export function updateUnit(k,room,id,patch){
  const old=k.units.find(x=>x.id===id);if(!old||!plain(patch))return fail(k,'لم تعد الوحدة موجودة.');
  const dest=k.runs.find(r=>r.id===(patch.runId??old.runId)),src=k.runs.find(r=>r.id===old.runId);
  const attrs=changedKindSpec(old,patch);
  if(!src?.autoFill&&!dest?.autoFill)return guardEdit(k,room,putUnit(k,room,attrs,old));
  const edits=Object.entries(patch).filter(([p,v])=>!(v==null&&old[p]==null)&&!same(old[p],v)).map(([p])=>p);
  if(!edits.length)return done(k,k,id);
  // Appearance stays with this cabinet, but does not reserve its footprint.
  if(edits.every(p=>p==='open'||fillTypes.includes(p)))return guardEdit(k,room,putUnit(k,room,attrs,old));
  if(!dest)return fail(k,'اختر صفًا صالحًا.');
  const srcDest=[src?.id,dest.id],changesBounds=edits.some(p=>['u','width','runId','kind','doorHanding','modelSpec','drawerCount'].includes(p));
  if(dest.autoFill&&heldGap(dest,attrs.u,attrs.width))return blockedReservation(k);
  if(dest.autoFill)attrs.fillRole='fixed';else delete attrs.fillRole;
  let base=k;
  if(changesBounds)for(const rid of srcDest)base=kitchenEditableSpace(base,rid,id);
  const out=guardEdit(base,room,putUnit(base,room,attrs,old));
  if(!changesBounds)return out;
  return reflow(k,room,out,srcDest);
}
export function pinKitchenFillUnit(k,room,id){const u=k.units.find(x=>x.id===id),r=k.runs.find(r=>r.id===u?.runId);return r?.autoFill?updateUnit(k,room,id,{fillRole:'fixed'}):fail(k,'اختر وحدة من صف ذي تعبئة تلقائية.');}
export function releaseKitchenFillUnit(k,room,id){
  const u=k.units.find(x=>x.id===id),r=k.runs.find(r=>r.id===u?.runId);if(!r?.autoFill)return fail(k,'اختر وحدة من صف ذي تعبئة تلقائية.');
  if(u.fillRole==='auto')return done(k,k,id);
  // Releasing explicitly permits the solver to replace this unit (including its custom interior).
  const base={...k,units:k.units.filter(v=>v.id!==id)},out=reflow(k,room,done(k,base,id),[r.id]);
  return out.ok?{...out,id:out.kitchen.units.find(x=>x.id===id)?.id??out.kitchen.units.find(x=>x.runId===r.id&&x.u<=u.u+eps&&x.u+x.width>u.u+eps)?.id??null}:out;
}
export function restoreKitchenFillGaps(k,room,id){
  const row=k.runs.find(r=>r.id===id);if(!row?.autoFill)return fail(k,'اختر صفًا ذا تعبئة تلقائية.');if(!row.fillGaps?.length)return done(k,k,id);
  const {fillGaps,...clean}=row,next={...k,runs:k.runs.map(r=>r===row?clean:r)};return reflow(k,room,done(k,next,id),[id]);
}
/** Inspector and global library use the same persistent model operations.
 * The UI may instead arm point placement for a unit without a destination. */
export function applyKitchenCatalogEntry(k,room,entry,selection,options={}){
  if(!entry||typeof entry.id!=='string')return fail(k,'اختر عيّنة أو وحدة من مكتبة الاستوديو.');
  const u=selection?.kind==='unit'?k.units.find(x=>x.id===selection.id):null,
    r=k.runs.find(x=>x.id===(options.runId??u?.runId??(selection?.kind==='run'?selection.id:null)));
  if(entry.section==='unit'){
    if(!r)return fail(k,'اختر صفًا أو انقر على موضع في الرسم أولًا.','select-run');
    return addUnit(k,room,{runId:r.id,kind:entry.id,...(options.u!=null?{u:options.u}:{}),...(options.width!=null?{width:options.width}:{})});
  }
  if(entry.section==='worktop'){
    if(!r||r.tier!=='base')return fail(k,'اختر صفًا أرضيًا لسطح العمل.','select-base');
    return updateRun(k,room,r.id,{worktopFinish:entry.id,worktopColor:null});
  }
  if(!u)return fail(k,'اختر الوحدة التي تريد تطبيق هذا الاختيار عليها.','select-unit');
  if(entry.section==='front')return updateUnit(k,room,u.id,{frontFinish:entry.id,frontColor:null});
  if(entry.section==='front-style')return updateUnit(k,room,u.id,{frontStyle:entry.id});
  if(entry.section==='handle')return updateUnit(k,room,u.id,{handleStyle:entry.id});
  return fail(k,'قسم المكتبة غير معروف.');
}
function featureRecord(s,room){
  if(!plain(s)||!validID(s.id)||!featureKind(s.kind)||!wallOK(s.wall))return null;
  const spec=kitchenFeatureSpecs[s.kind],height=s.height??(['column','shaft'].includes(s.kind)?room.height:spec.height),f={id:s.id,kind:s.kind,wall:s.wall,u:s.u,width:s.width??spec.width,depth:s.depth??spec.depth,
    bottom:s.bottom??(s.kind==='beam'?Math.max(0,room.height-height):spec.bottom),height};
  if(s.kind==='window'&&s.glazing!=null){
    if(!['clear','frosted'].includes(s.glazing))return null;f.glazing=s.glazing;
  }
  if(['window','door'].includes(s.kind)){
    for(const [key,choices] of [['hinge',['left','right']],['swing',s.kind==='window'?['fixed','in','out','sliding']:['in','out','sliding']],['parking',['within','before','after']]]){
      if(s[key]!=null){if(!choices.includes(s[key]))return null;f[key]=s[key];}
    }
    for(const key of ['leafWidth','hingeInset','parkDepth']){
      if(s[key]==null)continue;
      if(!span(s[key],key==='hingeInset'?0:.1,key==='parkDepth'?300:f.width))return null;f[key]=s[key];
    }
    if(f.leafWidth!=null&&f.hingeInset!=null&&f.leafWidth+f.hingeInset>f.width+eps)return null;
  }
  if(['door','window'].includes(s.kind)&&s.adjacent!=null){
    if(!['corridor','yard','lightwell','laundry','outdoors'].includes(s.adjacent))return null;f.adjacent=s.adjacent;
  }
  return span(f.u,0,1700)&&span(f.width,1,500)&&span(f.depth,1,500)&&span(f.bottom,0,600)&&span(f.height,1,600)?f:null;
}
function putFeature(k,input,s,old=null){
  const room=kitchenRoom(input),f=featureRecord(s,room);
  if(!f)return fail(k,'أدخل نوعًا وموضعًا ومقاسات صحيحة للعنصر الثابت.');
  if(!architectureWall(room,f.wall))return fail(k,'هذا الجدار غير موجود في شكل الغرفة الحالي.','missing-wall');
  if(old&&same(old,f))return done(k,k,f.id);
  return done(k,{...k,nextId:k.nextId+(old?0:1),features:old?k.features.map(x=>x===old?f:x):[...k.features,f]},f.id);
}
/** Candidate solid features only invalidate rows close enough to their actual wall
    footprint (including inward door sweep). Existing fixtures/rows elsewhere remain untouched. */
function featureReflow(k,room,out,old,fresh){
  if(!out.ok||!out.changed||!room)return guardEdit(k,room,out);
  const features=[old,fresh].filter(f=>f&&solidFeature(f.kind));
  if(!features.length)return guardEdit(k,room,out);
  const ids=k.runs.filter(r=>r.autoFill&&features.some(f=>{
    const openReach=f.kind==='door'&&f.swing==='in'?f.width:f.depth;
    // The worktop sits just above a base row; open floor drawers may reach farther than its depth.
    const overlap=Math.min(r.bottom+r.height+(r.tier==='base'?6:0),f.bottom+f.height)-Math.max(r.bottom,f.bottom)>eps;
    if(!overlap)return false;
    const a=kitchenRunPolygon(room,r,r.start,r.end-r.start,r.depth+Math.max(60,...k.units.filter(u=>u.runId===r.id).map(u=>u.width))),b=kitchenRunPolygon(room,{wall:f.wall},f.u,f.width,Math.max(f.depth,openReach));
    return convexIntersection(a,b).length>0;
  })).map(r=>r.id);
  if(!ids.length)return guardEdit(k,room,out);
  let naked=out.kitchen;for(const id of ids)naked=kitchenEditableSpace(naked,id);
  return reflow(k,room,{...out,kitchen:naked},ids);
}
export function addFeature(k,room,s){if(!s||k.features.length>=64)return fail(k,'بلغ المطبخ حدّ العناصر الثابتة.');const out=putFeature(k,room,{...s,id:nextId(k,'feature',s.id)});return featureReflow(k,room,out,null,out.ok?out.kitchen.features.at(-1):null);}
export function updateFeature(k,room,id,patch){const old=k.features.find(x=>x.id===id);if(!old||!plain(patch))return fail(k,'لم يعد العنصر موجودًا.');const out=putFeature(k,room,{...old,...patch,id},old);return featureReflow(k,room,out,old,out.ok?out.kitchen.features.find(f=>f.id===id):null);}
export function removeKitchenItem(k,id,room){
  if(!mark(k,id))return fail(k,'العنصر المحدد غير موجود.');
  const u=k.units.find(u=>u.id===id),row=k.runs.find(r=>r.id===(u?.runId??id));
  if(row?.autoFill&&u){
    if(!room)return fail(k,'يلزم مرجع الغرفة لإعادة تعبئة الصف.');
    const gaps=[...(row.fillGaps||[]),{u:u.u,width:u.width}].sort((a,b)=>a.u-b.u),merged=[];
    for(const g of gaps){const prev=merged.at(-1);if(prev&&g.u<=prev.u+prev.width+eps)prev.width=Math.max(prev.u+prev.width,g.u+g.width)-prev.u;else merged.push({...g});}
    const next={...k,units:k.units.filter(x=>x!==u),runs:k.runs.map(r=>r===row?{...r,fillGaps:merged}:r)};return reflow(k,room,done(k,next,id),[row.id]);
  }
  if(row?.autoFill&&row.id===id&&!k.units.some(u=>u.runId===id&&u.fillRole!=='auto'))return done(k,{...k,runs:k.runs.filter(x=>x!==row),units:k.units.filter(u=>u.runId!==id)},id);
  if(k.runs.some(x=>x.id===id)&&k.units.some(x=>x.runId===id))return fail(k,'الامتداد يحتوي وحدات. انقلها أو احذفها أولًا.','occupied-range');
  const out=done(k,{...k,runs:k.runs.filter(x=>x.id!==id),units:k.units.filter(x=>x.id!==id),features:k.features.filter(x=>x.id!==id)},id),f=k.features.find(f=>f.id===id);
  return f&&room?featureReflow(k,room,out,f,null):out;
}

function gapAround(run,units,u){const others=units.filter(v=>v.runId===run.id&&v.id!==u.id);
  return {before:u.u-Math.max(run.start,...others.filter(v=>v.u+v.width<=u.u+eps).map(v=>v.u+v.width)),
    after:Math.min(run.end,...others.filter(v=>v.u>=u.u+u.width-eps).map(v=>v.u))-(u.u+u.width)};
}
function cutFor(room,u,r){
  if(u.kind!=='sink'&&u.kind!=='hob')return null;
  const sink=u.kind==='sink',w=Math.min(u.width*.78,sink?55:58),nominal=Math.min(r.depth*.73,sink?41:48),start=u.u+(u.width-w)/2;
  let d=nominal,inset=(r.depth-d)/2,sinkFitting;
  if(sink){
    // Reserve solid stone for the actual rim and mixer flange, even on a
    // shallow custom run. Keep the centred cut when the original deck fits.
    const tapRadius=Math.min(1.48,w*.041),foot=2*tapRadius,gap=.24,lip=value=>Math.min(1.1,w*.045,value*.045);
    d=Math.min(nominal,r.depth-2*lip(nominal)-2*foot-3*gap);
    const rim=lip(d),tapBack=rim+foot+gap;
    inset=Math.max((r.depth-d)/2,tapBack+foot+gap);
    sinkFitting={rim,tapRadius,tapBack};
  }
  return {id:'hole:'+u.id,unitId:u.id,runId:r.id,wall:r.wall,kind:u.kind,u:start,width:w,depth:d,offset:inset,...(sinkFitting?{sinkFitting}:{}),...footprint(room,r,start,w,d,inset),bottom:r.bottom+r.height,height:(r.worktopThicknessMm??40)/10};
}
// Two poses of the same physical panels. Hinges lie on the outer front
// corners of the closed faces. At 90° each slab is only its own thickness
// across u; do not use the empty span between the doors as a collision body.
function sideHinges(room,u,r,support){
  if(kitchenUnitSpecs[u.kind].opening!=='side-hinge')return [];
  const spec=kitchenUnitSpecs[u.kind],choice=spec.configurableHanding?u.doorHanding:null,
    count=choice==='pair'?2:choice==='left'||choice==='right'?1:spec.leaves??(u.width>=68?2:1),
    slot=u.width/count,gap=Math.min(.48,u.width*.015),leafWidth=slot-2*gap,
    thickness=Math.min(1.65,r.depth*.12),caseHeight=unitHeight(u,r),toe=support?.applicable?Math.min(caseHeight,support.bodyClearMm/10):r.bottom<1?Math.min(9,caseHeight*.12):0,
    bottom=r.bottom+toe+gap,height=caseHeight-toe-2*gap;
  return Array.from({length:count},(_,index)=>{
    const left=index===0&&choice!=='right',hingeSide=left?'left':'right',lo=u.u+index*slot+gap,hingeU=left?lo:lo+leafWidth,
      hingeD=r.depth,hinge=kitchenRunPoint(room,r,hingeU,hingeD),angle=left?90:-90;
    const leaf={id:'leaf:'+u.id+':'+index,unitId:u.id,runId:r.id,wall:r.wall,kind:'hinged-door',index,hingeSide,
      hinge,hingeU,hingeD,leafWidth,thickness,bottom,height};
    function pose(start,width,offset,depth,angle,freeEdge){
      return {...leaf,u:start,width,offset,depth,angle,freeEdge,...footprint(room,r,start,width,depth,offset)};
    }
    const closed=pose(lo,leafWidth,hingeD-thickness,thickness,0,kitchenRunPoint(room,r,left?lo+leafWidth:lo,hingeD));
    const opened=pose(left?hingeU:hingeU-thickness,thickness,hingeD,leafWidth,angle,kitchenRunPoint(room,r,hingeU,hingeD+leafWidth));
    return {...leaf,angle,closed,opened};
  });
}
function deviceOpening(room,u,r,support){
  if(!u.open||!kitchenUnitSpecs[u.kind].openable)return null;
  const kind=['drawers','pullout'].includes(u.kind)?'drawer':'door',reach=kind==='drawer'?Math.min(48,r.depth*.8):Math.min(58,r.height*.75);
  const lift=support?.applicable?support.bodyClearMm/10:null,drawerBase=lift??8;
  const inset=Math.min(1.1,u.width*.035),shape=footprint(room,r,u.u+inset,u.width-inset*2,reach,r.depth);
  return {id:'open:'+u.id,kind,unitId:u.id,runId:r.id,...shape,wall:r.wall,u:u.u+inset,width:u.width-2*inset,depth:reach,offset:r.depth,
    bottom:r.bottom+(u.kind==='oven-tower'?82:u.kind==='oven'?18:drawerBase),height:u.kind==='pullout'?(lift==null?Math.max(12,r.height-13):Math.max(1,r.height-drawerBase-5)):u.kind==='drawers'?Math.min(23,(r.height-drawerBase)/(u.drawerCount||3)):4};
}
const center=r=>({x:r.x+r.w/2,z:r.z+r.d/2});
const overlapY=(a,b)=>({bottom:Math.max(a.bottom,b.bottom),height:Math.min(a.bottom+a.height,b.bottom+b.height)-Math.max(a.bottom,b.bottom)});
const outOfRoom=(s,r)=>s.rect.x< -eps||s.rect.z< -eps||s.rect.x+s.rect.w>r.width+eps||s.rect.z+s.rect.d>r.length+eps||s.bottom< -eps||s.bottom+s.height>r.height+eps;
const conflictText={
  'open-open':'تتداخل القطعتان عند فتحهما معًا.','open-body':'يمتد الجزء المفتوح داخل جسم وحدة أخرى.',
  'open-feature':'يصطدم الجزء المفتوح بعنصر ثابت.','body-body':'يتداخل جسما وحدتين على الارتفاع نفسه.',
  'body-feature':'تتداخل الوحدة مع عنصر معماري ثابت.','top-feature':'يتقاطع سطح العمل مع عنصر معماري ثابت.',
  'run-overlap':'يتداخل امتدادان على الارتفاع نفسه.','outside-room':'يتجاوز العنصر حدود الغرفة.','open-outside':'يتجاوز الجزء المفتوح حدود الغرفة.'
};
const makeLabel=x=>kitchenUnitSpecs[x.kind]?.label||kitchenFeatureSpecs[x.kind]?.label||(x.tier==='upper'?'صف علوي':x.tier==='base'?'صف أرضي':'سطح العمل');
export function kitchenGeometry(k,input){
  const room=kitchenRoom(input),runs=k.runs.map(r=>({...r,...footprint(room,r,r.start,r.end-r.start,r.depth),gaps:freeIntervals(r,k.units),worktop:null}));
  const by=new Map(runs.map(r=>[r.id,r])),features=k.features.map(f=>({...f,label:makeLabel(f),...footprint(room,f,f.u,f.width,f.depth,f.planningOffset??0)}));
  const surveyRoom=input?.workshop?input:input?.room||room,workshop=surveyRoom?.workshop,catalog=readWorkshopCatalog(workshop);
  const hasSupports=workshop?.baseSupport||catalog?.baseSupport;
  const units=k.units.map(u=>{
    const host=by.get(u.runId),D=unitDepth(u,host),H=unitHeight(u,host),r=D===host.depth&&H===host.height?host:{...host,depth:D,height:H},shape=footprint(room,r,u.u,u.width,D),
      baseSupport=(input?.fitout||input?.room?.fitout)?.units?.[u.id]??(hasSupports?resolveUnitSupport({room:surveyRoom,kitchen:k},catalog,{...u,height:H,depth:D},r):null),doorLeaves=sideHinges(room,u,r,baseSupport),
      openParts=!u.open?[]:doorLeaves.length?doorLeaves.map(leaf=>leaf.opened):[deviceOpening(room,u,r,baseSupport)].filter(Boolean),
      openPart=openParts.length===1?openParts[0]:null,cutout=cutFor(room,u,r);
    let nearestDrain=null,nearestWater=null,windowId=null;
    if(u.kind==='sink'){
      const a=center(cutout.rect);
      for(const feature of features){
        if(feature.kind==='window'&&feature.wall===r.wall&&feature.bottom>=r.bottom+r.height-eps&&u.u+u.width/2>=feature.u&&u.u+u.width/2<=feature.u+feature.width)windowId=feature.id;
        if(!['drain','water'].includes(feature.kind))continue;
        const b=center(feature.rect),distance=Math.hypot(a.x-b.x,a.z-b.z),v={id:feature.id,distance};
        if(feature.kind==='drain'&&(!nearestDrain||distance<nearestDrain.distance))nearestDrain=v;
        if(feature.kind==='water'&&(!nearestWater||distance<nearestWater.distance))nearestWater=v;
      }
    }
    return {...u,...(baseSupport?{baseSupport}:{}),wall:r.wall,tier:r.tier,label:makeLabel(u),supportsWorktop:supportsTop(u,r),...shape,depth:r.depth,bottom:r.bottom,height:unitHeight(u,r),bodyParts:physicalParts(room,r,u),doorLeaves,openParts,openPart,openRect:openPart?.rect||null,cutout,nearestDrain,nearestWater,windowId,clearance:gapAround(r,k.units,u)};
  });
  const cutouts=units.map(u=>u.cutout).filter(Boolean),worktops=[];
  for(const r of runs){
    if(r.tier!=='base')continue;
    const bases=units.filter(u=>u.runId===r.id&&u.supportsWorktop).sort((a,b)=>a.u-b.u),parts=[];
    const push=(start,end)=>{if(end-start<=eps)return;
      const shape=footprint(room,r,start,end-start,r.depth);
      const top={id:'top:'+r.id+':'+parts.length,runId:r.id,wall:r.wall,tier:r.tier,start,end,depth:r.depth,...shape,bottom:r.bottom+r.height,height:(r.worktopThicknessMm??40)/10,
        ...(r.worktopFinish?{worktopFinish:r.worktopFinish}:{}),...(r.worktopColor?{worktopColor:r.worktopColor}:{}),
        holes:cutouts.filter(h=>h.runId===r.id&&h.u>=start-eps&&h.u+h.width<=end+eps)};
      parts.push(top);worktops.push(top);
    };
    // Only touching supported boxes share a slab. The drawn run is a guide;
    // neither an empty bay, a tall appliance nor a corner is a solid slab.
    let start=null,end=null;
    for(const u of bases){
      if(start===null){start=u.u;end=u.u+u.width;}
      else if(u.u<=end+eps)end=Math.max(end,u.u+u.width);
      else{push(start,end);start=u.u;end=u.u+u.width;}
    }
    if(start!==null)push(start,end);
    r.worktop=parts.length===1?parts[0]:null;r.worktops=parts;
  }
  const conflicts=[],conflictMap=new Map();
  function record(type,items,polygon,y,polygons=[polygon],partIds=items.map(x=>x.id)){
    const ids=items.map(x=>x.id),id=type+':'+ids.slice().sort().join('+');
    const patches=polygons.map(poly=>({polygon:poly,...y,partIds}));
    const old=conflictMap.get(id);
    if(old){old.patches.push(...patches);old.polygons.push(...polygons);old.rect=polygonBounds(old.polygons.flat());return;}
    const conflict={id,type,kind:type,ids,rect:polygonBounds(polygons.flat()),polygon,polygons:[...polygons],patches,...y,label:items.map(makeLabel).join(' / ')+': '+conflictText[type]};
    conflicts.push(conflict);conflictMap.set(id,conflict);
  }
  function collide(type,a,sa,b,sb){
    if(!intersectBand(sa,sb))return;const polygon=convexIntersection(sa.polygon,sb.polygon);
    if(polygon.length)record(type,[a,b],polygon,overlapY(sa,sb),[polygon],[sa.id,sb.id]);
  }
  for(let i=0;i<units.length;i++){
    const a=units[i];for(let j=i+1;j<units.length;j++){
      const b=units[j];
      for(const ap of a.openParts){for(const bb of b.bodyParts??[b])collide('open-body',a,ap,b,bb);
        for(const bp of b.openParts)collide('open-open',a,ap,b,bp);}
      for(const bp of b.openParts)for(const ab of a.bodyParts??[a])collide('open-body',b,bp,a,ab);
    }
    for(const f of features.filter(f=>solidFeature(f.kind))){
      for(const ap of a.openParts)collide('open-feature',a,ap,f,f);
    }
  }
  const architecture=roomArchitecture(room);
  function exterior(type,o,s){if(!outOfRoom(s,room)&&!architecture.cut&&!architecture.measured)return;
    const pieces=s.bottom< -eps||s.bottom+s.height>room.height+eps?[s.polygon]:[...outsidePieces(s.polygon,room),...architecture.excluded.map(e=>convexIntersection(s.polygon,e)).filter(p=>p.length)];
    if(pieces.length)record(type,[o],pieces[0],{bottom:s.bottom,height:s.height},pieces,[s.id]);
  }
  for(const o of units)for(const ap of o.openParts)exterior('open-outside',o,ap);
  const corners=input?.workshop?.corners||input?.room?.workshop?.corners;
  const ws=input?.workshop||input?.room?.workshop,wallAccessories=[];
  if(ws?.options)for(const f of k.features){const opts=ws.options[f.wall],v=f.kind==='heater'?opts?.heaters?.[f.id]:f.kind==='window'?opts?.curtains?.[f.id]:null;if(!v)continue;
   const a=wallAssembly(room,f,v,catalog);for(const b of a?.bodies||[])if(b.w>0&&b.h>0&&b.d>0)wallAccessories.push({...b,polygon:volumePolygon(room,b)});
  }
  if(catalog?.linearKits)for(const wall of Object.keys(ws.options||{})){
   for(const b of lightBodies({room:{...room,workshop:ws},kitchen:k},wall,catalog))wallAccessories.push({...b,polygon:volumePolygon(room,b)});
  }
  const geometry={wallAccessories,room,architecture,runs,units,features,cutouts,worktops,cornerBodies:corners?cornerSolids(room,corners,catalog,input?.workshop?.finishes?.cornerFronts||input?.room?.workshop?.finishes?.cornerFronts):[],conflicts,gaps:runs.flatMap(r=>r.gaps.map(g=>({...g,runId:r.id})))};
  const key=roomKey(room),entry=physicalCache.get(k),hard=entry?.key===key?entry.hits:closedPlacementConflicts(geometry);
  physicalCache.set(k,{key,hits:hard});geometry.hardConflicts=hard;
  geometry.conflicts=[...hard,...conflicts];return geometry;
}
const physicalCache=new WeakMap(),roomKey=r=>roomArchitecture(r).key+(r.sitePoints?.length?'|'+JSON.stringify(r.sitePoints):'');
export function hardKitchenConflicts(k,input){
  const room=kitchenRoom(input),entry=physicalCache.get(k);return entry?.key===roomKey(room)?entry.hits:kitchenGeometry(k,room).hardConflicts;
}
function changeGuard(before,bRoom,after,aRoom){
  const proposed=hardKitchenConflicts(after,aRoom);
  if(!proposed.length)return done(before,after,null);
  const previous=new Map((before?hardKitchenConflicts(before,bRoom):[]).map(c=>[c.stableKey,c]));
  const blocked=proposed.filter(c=>{const prev=previous.get(c.stableKey);
    return !prev||c.measure>prev.measure+1e-7+Number.EPSILON*100*Math.max(1,c.measure,prev.measure);
  });
  if(!blocked.length)return done(before,after,null);
  const c=blocked[0];
  return {...fail(before,c.label,c.type),conflict:c,conflicts:blocked,candidate:after,constraint:'hard-placement'};
}
/** The schema reader remains deliberately permissive about old collisions.
 * A PROJECT change, including a room size change with the same kitchen
 * object, must additionally pass this check before save/history is updated. */
export function validateKitchenChange(before,beforeRoom,after,afterRoom){
  const survey=validateKitchenRoomArchitecture(afterRoom);if(!survey.ok)return fail(before,survey.reason,'invalid-room');
  const lost=[...(Array.isArray(after?.runs)?after.runs:[]),...(Array.isArray(after?.features)?after.features:[])].find(x=>x?.wall&&wallOK(x.wall)&&!architectureWall(afterRoom,x.wall));
  if(lost)return {...fail(before,'لا يمكن إزالة '+architectureWallLabel(lost.wall)+' قبل نقل أو حذف العناصر المثبتة عليه.','missing-wall'),attemptedId:lost.id,wall:lost.wall};
  if(!validateKitchen(after,afterRoom))return fail(before,'بنية المطبخ المقترح غير صالحة.','invalid-kitchen');
  const out=changeGuard(before,beforeRoom,after,afterRoom);
  if(out.ok&&roomKey(kitchenRoom(beforeRoom))!==roomKey(kitchenRoom(afterRoom)))out.changed=true;
  return out;
}
// Survey items describe the building; the proposed units that intersect them
// still need correction when designing or releasing the kitchen.
export function surveyDesignConflicts(kitchen,room,surveyFeatureIds){
  const ids=new Set(surveyFeatureIds);
  const features=new Set(kitchen.features.filter(f=>ids.has(f.id)).map(f=>f.id));
  if(!features.size||!kitchen.units.length)return [];
  const units=new Set(kitchen.units.map(u=>u.id));
  return hardKitchenConflicts(kitchen,room).filter(c=>{
    const [a,b]=c.ids;
    if(c.type==='door-swing')return features.has(a)&&units.has(b);
    return (c.type==='body-feature'||c.type==='top-feature')&&units.has(a)&&features.has(b);
  });
}
export function validateSurveyFeatureChange(before,beforeRoom,after,afterRoom,surveyFeatureIds,{restoreArchive=false}={}){
  const checked=validateKitchenChange(before,beforeRoom,after,afterRoom);
  if(!checked.ok&&checked.constraint!=='hard-placement')return checked;
  // This exception belongs to measurements, never to moving a cabinet/run
  // or changing the room envelope in the same operation. A validated archive
  // restores its own cabinets and measured building as a complete document.
  if(!checked.ok&&!restoreArchive&&(!before||roomKey(kitchenRoom(beforeRoom))!==roomKey(kitchenRoom(afterRoom))||
      (before.units!==after.units&&!same(before.units,after.units))||
      (before.runs!==after.runs&&!same(before.runs,after.runs))))return checked;
  const designConflicts=surveyDesignConflicts(after,afterRoom,surveyFeatureIds);
  if(checked.ok)return {...checked,designConflicts};
  const designKeys=new Set(designConflicts.map(c=>c.stableKey));
  const conflicts=checked.conflicts.filter(c=>!designKeys.has(c.stableKey)),conflict=conflicts[0];
  if(!conflict)return {...done(before,after,null),designConflicts};
  let reason=conflict.label;
  if(conflict.type==='opening-service'){
    const [openingId,serviceId]=conflict.ids;
    const opening=after.features.find(f=>f.id===openingId),service=after.features.find(f=>f.id===serviceId);
    const what=service.kind==='vent'?'فتحة التهوية':kitchenFeatureSpecs[service.kind].label;
    reason='تتداخل حدود '+what+' المقاسة مع فتحة '+(opening.kind==='window'?'الشباك':'الباب')+'. راجع موضعهما وارتفاعهما على الجدار.';
  }
  return {...checked,reason,code:conflict.type,conflict,conflicts};
}
function guardEdit(before,room,result){
  if(!result.ok||!result.changed)return result;
  const out=changeGuard(before,room,result.kitchen,room);
  if(out.ok)return result;
  if(out.code==='body-body'){
    const [a,b]=out.conflict.ids.map(id=>result.kitchen.units.find(u=>u.id===id));
    if(a&&b&&a.runId===b.runId)out.code='unit-overlap';
  }
  return {...out,attemptedId:result.id};
}
/** Suggest only a measured position, never apply it automatically. Test
 * candidate moves using the same physical geometry as the drawing: all
 * extents remain open, no lost width, no new interference introduced. */
export function suggestKitchenFix(k,input,conflictId){
  const g=kitchenGeometry(k,input),c=g.conflicts.find(c=>c.id===(conflictId?.id||conflictId));
  if(!c?.type.startsWith('open-'))return null;
  const known=new Set(g.conflicts.map(q=>q.id)),candidates=[];
  for(const u of g.units.filter(u=>c.ids.includes(u.id))){
    const r=g.runs.find(q=>q.id===u.runId);
    for(const gap of freeIntervals(r,k.units,u.id)){
      const lo=gap.start,hi=gap.end-u.width;if(hi<lo-eps)continue;
      const opts=new Set([lo,hi]);for(let p=Math.ceil(lo/2)*2;p<hi;p+=2)opts.add(p);
      for(const n of opts)if(Math.abs(n-u.u)>eps)candidates.push({unitId:u.id,runId:r.id,u:n,diff:Math.abs(n-u.u)});
    }
  }
  for(const p of candidates.sort((a,b)=>a.diff-b.diff)){
    const updated=updateUnit(k,input,p.unitId,{u:p.u});if(!updated.ok)continue;
    const cs=kitchenGeometry(updated.kitchen,input).conflicts;
    if(!cs.some(q=>q.id===c.id||!known.has(q.id)))return {...p,reason:`انقل ${makeLabel(k.units.find(u=>u.id===p.unitId))} إلى ${num(p.u)} سم من بداية ${isFreeKitchenRun(k.runs.find(r=>r.id===p.runId))?'الجزيرة':'جدارها'}؛ يزول التعارض في وضع الفتح.`};
  }
  return null;
}

/** Bounded schema validation. A valid saved design can outgrow a changed
 * room: keep its authored dimensions and report that through geometry,
 * rather than "fixing" the document or losing it on reload. */
export function validateKitchen(v,input){
  if(!plain(v)||v.version!==1||!Number.isSafeInteger(v.nextId)||!span(v.nextId,1,999999999)||!Array.isArray(v.runs)||v.runs.length>48||!Array.isArray(v.units)||v.units.length>256||!Array.isArray(v.features)||v.features.length>64)return null;
  const ids=new Set(),unique=id=>validID(id)&&!ids.has(id)&&(ids.add(id),true);
  const k={version:1,nextId:v.nextId,runs:[],units:[],features:[]};
  for(const r of v.runs){if(!validRun(r)||!unique(r.id)||(input&&r.wall&&!architectureWall(input,r.wall)))return null;
    const fields=['id','wall','tier','start','end','depth','bottom','height',...(isFreeKitchenRun(r)?['placement','x','z','angle','length']:[]),...(r.worktopFinish!=null?['worktopFinish']:[])];
    const row=Object.assign(Object.fromEntries(fields.map(p=>[p,r[p]])),fillAttrs(r));if(r.worktopThicknessMm!=null)row.worktopThicknessMm=r.worktopThicknessMm;if(r.worktopColor!=null)row.worktopColor=r.worktopColor.toLowerCase();k.runs.push(row);}
  for(const u of v.units){
    if(!plain(u)||!unique(u.id)||!unitKind(u.kind)||!span(u.u,0,1700)||!span(u.width,20,240)||typeof u.open!=='boolean'||(u.open&&!kitchenUnitSpecs[u.kind].openable)||!materialOK(kitchenFrontFinishes,u.frontFinish)||!tintOK(u.frontColor)||!choicesOK(u,kitchenUnitSpecs[u.kind])||!handingOK(u,kitchenUnitSpecs[u.kind]))return null;
    const r=k.runs.find(r=>r.id===u.runId),inside=interior(u.interior);if(!r||!unitAllowed(u.kind,r)||!inside||!within({start:u.u,end:u.u+u.width},r))return null;
    const item={id:u.id,runId:u.runId,kind:u.kind,u:u.u,width:u.width,open:u.open,interior:inside};
    if(u.modelSpec!=null){const model=cleanDeviceModel(u.modelSpec,u.kind);if(!model||Math.abs(model.widthMm-u.width*10)>eps)return null;item.modelSpec=model;}
    if(u.drawerCount!=null){if(u.kind!=='drawers'||!Number.isInteger(u.drawerCount)||!span(u.drawerCount,1,8))return null;item.drawerCount=u.drawerCount;}
    if(u.fillRole!=null){if(!r.autoFill||!fixedRole(u))return null;item.fillRole=u.fillRole;}
    if(r.autoFill&&heldGap(r,u.u,u.width))return null;
    if(u.frontStyle!=null)item.frontStyle=u.frontStyle;if(u.handleStyle!=null)item.handleStyle=u.handleStyle;
    if(u.doorHanding!=null&&u.doorHanding!=='auto')item.doorHanding=u.doorHanding;
    if(u.frontFinish!=null)item.frontFinish=u.frontFinish;
    if(u.frontColor!=null)item.frontColor=u.frontColor.toLowerCase();
    if(u.detail!=null){const d=cleanDetail(u.detail);if(!d)return null;const m=cabMinimum(d);if(u.width<m.w-eps||unitHeight(u,r)<m.h-eps)return null;item.detail=d;}
    k.units.push(item);
  }
  for(const f of v.features){
    if(!plain(f)||!unique(f.id)||!['u','width','depth','bottom','height'].every(key=>ownKey(f,key)))return null;
    const clean=featureRecord(f,kitchenRoom(input));if(!clean||(input&&!architectureWall(input,f.wall)))return null;k.features.push(clean);
  }
  return k;
}
export function createKitchen(input,preset='demo'){
  let k={version:1,nextId:1,runs:[],units:[],features:[]};if(preset==='empty')return k;
  const room=kitchenRoom(input),W=room.width,A=room.length,H=room.height;
  const add=(fn,obj)=>{const r=fn(k,room,obj);if(r.ok)k=r.kitchen;};
  if(W<90||A<90||H<100)return k;
  const end=Math.min(W,350);
  add(addRun,{id:'run-back',wall:'back',tier:'base',start:0,end});
  if(A>=130)add(addRun,{id:'run-left',wall:'left',tier:'base',start:Math.min(35,A-120),end:A});
  const sinkU=W>=285?190:Math.max(0,end-80),sinkW=Math.min(80,end);
  add(addUnit,{id:'unit-sink',kind:'sink',runId:'run-back',u:sinkU,width:sinkW});
  add(addUnit,{id:'unit-dishwasher',kind:'dishwasher',runId:'run-back',u:65,width:60});
  add(addUnit,{id:'unit-storage',kind:'storage',runId:'run-back',u:0,width:65});
  if(sinkU-125>=20)add(addUnit,{id:'unit-prep',kind:'storage',runId:'run-back',u:125,width:sinkU-125});
  add(addUnit,{id:'unit-hob',kind:'hob',runId:'run-back',u:sinkU+sinkW,width:60});
  add(addUnit,{id:'unit-drawers',kind:'drawers',runId:'run-left',u:A-132,width:50});
  add(addUnit,{id:'unit-corner-side',kind:'storage',runId:'run-left',u:A-82,width:22});
  add(addUnit,{id:'unit-left-storage',kind:'storage',runId:'run-left',u:35,width:50});
  if(H>=215&&end>=155){
    add(addRun,{id:'run-upper',wall:'back',tier:'upper',start:15,end:Math.min(150,end)});
    add(addUnit,{id:'unit-upper',kind:'storage',runId:'run-upper',u:25,width:70});
  }
  const x=sinkU+sinkW/2;
  if(H>=200)add(addFeature,{id:'feature-window',kind:'window',wall:'back',u:Math.max(0,x-45),width:Math.min(90,W-Math.max(0,x-45)),height:Math.min(105,H-100)});
  add(addFeature,{id:'feature-water',kind:'water',wall:'back',u:x-10});
  add(addFeature,{id:'feature-drain',kind:'drain',wall:'back',u:x+3});
  if(W>=345)add(addFeature,{id:'feature-electric',kind:'electric',wall:'back',u:326});
  return k;
}

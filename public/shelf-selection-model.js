import {ownKey} from './kitchen-safe-keys.js';
// Scoped structural editing for the shelf planner. Every rectangle and
// divider coordinate is in cm relative to the top-left of the wall. A grid
// belongs to exactly one target. An action never falls back to its parent.
import {SHELF_LIMITS as L,partitionLimits,contentIds,cellRects,rootPartition,partitionLayout,partitionMinimum,singlePartition,
  partitionSplitCheck,splitPartition,checkPartitionRemoval,removePartition,shiftPartition,totalPartitionNodes,
  asScopedPlan,isScopedTarget,splitBand,splitBandAt,splitBandCheck,dividerRemovalCheck,removeDivider,shiftDivider,setContent} from './shelf-model.js';

const axisOK=a=>a==='col'||a==='row';
const pureTarget=t=>t.key==null?{kind:t.kind}:{kind:t.kind,key:t.key};
const sameTarget=(a,b)=>a?.kind===b?.kind&&(a?.key??null)===(b?.key??null);
const rectOf=r=>({x:r.x,y:r.y,w:r.w,h:r.h});
const wallRect=p=>({x:0,y:0,w:p.wall.w,h:p.wall.h});
const arNumbers=new Intl.NumberFormat('ar-SA',{numberingSystem:'arab',maximumFractionDigits:1});
const arabic=n=>arNumbers.format(n);
const fail=(reason,code,extra={})=>({ok:false,reason,code,...extra});
const unknown=()=>fail('هذا التحديد لم يعد موجودًا. اختر نطاقًا من الرسم.','invalid-target');
const badAxis=()=>fail('اتجاه الفاصل غير صالح.','invalid-axis');
function partLabel(g,c,r){
  const nc=g.cols.length+1,nr=g.rows.length+1;
  if(nr===1&&nc===2)return c===0?'الجزء الأيسر':'الجزء الأيمن';
  if(nc===1&&nr===2)return r===0?'الجزء العلوي':'الجزء السفلي';
  if(nr===1)return `الجزء في العمود ${arabic(c+1)} من اليسار`;
  if(nc===1)return `الجزء في الصف ${arabic(r+1)} من الأعلى`;
  return `الجزء في الصف ${arabic(r+1)} والعمود ${arabic(c+1)}`;
}

// Internal groups and leaves are both addressable. /n is the persistent
// child ID in its own grid, not a row-major index liable to change on insert.
function locate(p,target){
  if(!isScopedTarget(p,target))return null;
  const t=pureTarget(target);
  if(t.kind==='wall')return {...t,rect:wallRect(p),grid:p.wallGrid||null,depth:0,label:'الجدار كاملًا',wall:true};
  if(t.kind==='cabinet')return {...t,rect:rectOf(p.cab),grid:rootPartition(p),depth:0,label:'الدولاب كله',wall:false};
  const [base,...path]=t.key.split('/'),wall=t.kind==='zone';let rect,grid,content,col=null,row=null,label;
  if(wall){rect=wallRect(p);grid=p.wallGrid;content='empty';label='منطقة الجدار';}
  else{const cell=cellRects(p).find(c=>c.key===base);if(!cell)return null;rect=rectOf(cell);col=cell.col;row=cell.row;grid=p.cellGrids?.[base]||null;content=p.cells[base];label=`الخانة: صف ${arabic(row+1)}، عمود ${arabic(col+1)}`;}
  let localCol=col,localRow=row;
  for(const id of path){const item=partitionLayout(grid,rect,wall).children.find(c=>c.node.id===Number(id));if(!item)return null;label+=` · ${partLabel(grid,item.col,item.row)}`;rect=rectOf(item);grid=item.node.grid||null;content=item.node.content||'empty';localCol=item.col;localRow=item.row;}
  return {...t,rect,grid,content,col,row,localCol,localRow,label,depth:path.length,wall};
}
export function targetInfo(plan,target){const r=locate(plan,target);if(!r)return null;const {grid,wall,rect,...rest}=r;return {...rest,...rect,rect:{...rect},leaf:!grid||(!grid.cols.length&&!grid.rows.length),colCount:(grid?.cols.length??0)+1,rowCount:(grid?.rows.length??0)+1,content:r.kind==='cell'&&!grid?r.content||'empty':null};}
export function selectedTarget(plan){return plan.selection&&isScopedTarget(plan,plan.selection)?pureTarget(plan.selection):{kind:'cell',key:plan.selectedCell||'0:0'};}
export function selectTarget(plan,target){if(!isScopedTarget(plan,target))return plan;if((!plan.selection||isScopedTarget(plan,plan.selection))&&sameTarget(selectedTarget(plan),target))return plan;const p=asScopedPlan(plan),sel=pureTarget(target);return {...p,selection:sel,selectedCell:sel.kind==='cell'?sel.key.split('/')[0]:p.selectedCell};}
export function targetParent(plan,target){
  if(!isScopedTarget(plan,target)||target.kind==='wall')return null;
  if(target.kind==='cabinet')return {kind:'wall'};
  const path=target.key.split('/');if(path.length===1)return {kind:'cabinet'};
  path.pop();return target.kind==='zone'&&path.length===1?{kind:'wall'}:{kind:target.kind,key:path.join('/')};
}
export function contentFor(plan,key){const r=locate(plan,{kind:'cell',key});return r&&!r.grid?r.content||'empty':'empty';}

function walkGrid(g,box,prefix,wall,depth,base,output){
  const layout=partitionLayout(g,box,wall),kind=wall?'zone':'cell',owner=wall&&prefix==='wall'?{kind:'wall'}:{kind,key:prefix};
  if(output.dividers)for(const d of layout.dividers)output.dividers.push({...d,id:`${kind}:${prefix}:${d.axis}:${d.index}`,kind:wall?'wall':'cabinet',owner,depth,key:prefix});
  for(const child of layout.children){const key=`${prefix}/${child.node.id}`,rect=rectOf(child);
    if(child.node.grid)walkGrid(child.node.grid,rect,key,wall,depth+1,base,output);
    else if(output.leaves)output.leaves.push({kind,key,parentKey:prefix,depth:depth+1,col:base?.col??child.col,row:base?.row??child.row,localCol:child.col,localRow:child.row,...rect,content:child.node.content||'empty'});
  }
}
export function scopedCells(plan){const leaves=[];for(const r of cellRects(plan)){const g=plan.cellGrids?.[r.key];if(g)walkGrid(g,r,r.key,false,0,r,{leaves});else leaves.push({...r,kind:'cell',depth:0,parentKey:null,localCol:r.col,localRow:r.row,content:plan.cells[r.key]||'empty'});}return leaves;}
export function wallZones(plan){const leaves=[];if(plan.wallGrid)walkGrid(plan.wallGrid,wallRect(plan),'wall',true,0,null,{leaves});return leaves;}
export function scopedDividers(plan){const dividers=[];
  if(plan.wallGrid)walkGrid(plan.wallGrid,wallRect(plan),'wall',true,0,null,{dividers});
  const baseLayout=partitionLayout(rootPartition(plan),plan.cab,false,L.frame);
  for(const d of baseLayout.dividers)dividers.push({...d,id:`cabinet:${d.axis}:${d.index}`,kind:'cabinet',owner:{kind:'cabinet'},depth:0});
  for(const cell of cellRects(plan)){const g=plan.cellGrids?.[cell.key];if(g)walkGrid(g,cell,cell.key,false,0,cell,{dividers});}return dividers;
}

function updateAt(g,ids,entry){const [id,...rest]=ids,children=g.children.map(child=>child.id!==Number(id)?child:rest.length?{...child,grid:updateAt(child.grid,rest,entry)}:{id:child.id,...(child.finish?{finish:child.finish}:{}),...entry});return {...g,children};}
function replace(p,target,entry){
  const plan=asScopedPlan(p);
  if(target.kind==='wall')return {...plan,wallGrid:entry.grid||null};
  const [base,...ids]=target.key.split('/');
  if(target.kind==='zone')return {...plan,wallGrid:updateAt(plan.wallGrid,ids,entry)};
  const cellGrids={...plan.cellGrids},cells={...plan.cells};
  if(ids.length)cellGrids[base]=updateAt(cellGrids[base],ids,entry);
  else if(entry.grid){cellGrids[base]=entry.grid;cells[base]='empty';}
  else{delete cellGrids[base];cells[base]=entry.content||'empty';}
  return {...plan,cellGrids,cells,...(!ids.length&&entry.finish?{bayFinishes:{...plan.bayFinishes,[base]:entry.finish}}:{})};
}
function collapse(g){if(g.cols.length||g.rows.length)return {grid:g};const only=g.children[0];return {...(only.grid?{grid:only.grid}:{content:only.content||'empty'}),...(only.finish?{finish:only.finish}:{})};}
function finish(before,after,t){if(before===after)return {ok:false,plan:before,target:t,reason:'لم يتغير التصميم.'};return {ok:true,plan:selectTarget(after,t),target:pureTarget(t),reason:''};}
export function setScopedContent(plan,key,id){
  if(!contentIds.includes(id))return plan;const t={kind:'cell',key},info=locate(plan,t);if(!info||info.grid||info.content===id)return plan;
  if(!key.includes('/'))return setContent(plan,key,id);
  return replace(plan,t,{content:id});
}
export function splitTargetCheck(plan,target,axis){
  const r=locate(plan,target);if(!r)return unknown();if(!axisOK(axis))return badAxis();
  if(r.depth>=partitionLimits.maxDepth)return fail('بلغت الحد الأقصى لعمق التقسيم داخل هذا النطاق.','depth-limit');
  const cabinet=r.kind==='cabinet',g=r.grid||singlePartition(r.content||'empty'),col=axis==='col';
  const extra=cabinet?0:(r.grid?(col?g.rows:g.cols).length+1:2);
  if(totalPartitionNodes(plan)+extra>partitionLimits.maxNodes)return fail('بلغ المخطط حد عدد الأجزاء المحفوظة.','node-limit');
  const choices=[];let last=null;
  for(let i=0;i<=(col?g.cols:g.rows).length;i++){
    const ck=partitionSplitCheck(g,r.rect,axis,i,r.wall,cabinet?L.frame:0);last=ck;if(ck.ok)choices.push(ck);
  }
  if(!choices.length)return last||fail('لا توجد مساحة للتقسيم.','band-too-small');
  choices.sort((a,b)=>b.size-a.size||a.index-b.index);const ck=choices[0];return {ok:true,reason:'',index:ck.index,cm:ck.cm};
}
export function splitTarget(plan,target,axis){
  const ck=splitTargetCheck(plan,target,axis);if(!ck.ok)return {...ck,plan,target};
  if(target.kind==='cabinet')return finish(plan,splitBand(plan,axis,ck.index),target);
  const r=locate(plan,target),g=r.grid||singlePartition(r.content||'empty'),next=splitPartition(g,r.rect,axis,ck.index,r.wall);
  if(!next.ok)return {...next,plan,target};return finish(plan,replace(plan,target,{grid:next.grid}),target);
}
export function removalTargetCheck(plan,target,axis,options={}){
  const r=locate(plan,target);if(!r)return unknown();if(!axisOK(axis))return badAxis();
  if(!r.grid)return fail('لا يوجد فاصل داخلي في هذا التحديد. لن تُحذف حافته أو فواصل الخانات المجاورة.','no-internal-divider',{conflicts:[],canForce:false});
  const cuts=axis==='col'?r.grid.cols:r.grid.rows,index=options?.index??(cuts.length-1);
  const ck=target.kind==='cabinet'?dividerRemovalCheck(plan,axis,index):checkPartitionRemoval(r.grid,axis,index);
  if(ck.conflicts?.length&&target.kind!=='cabinet'){const prefix=target.kind==='wall'?'wall':target.key;return {...ck,index,conflicts:ck.conflicts.map(x=>({...x,keepKey:`${prefix}/${x.keepId}`,removeKey:`${prefix}/${x.removeId}`}))};}
  return {...ck,index};
}
export function removeTargetDivider(plan,target,axis,options={}){
  const ck=removalTargetCheck(plan,target,axis,options);if(!ck.ok&&!(ck.canForce&&options?.allowContentMerge===true))return {...ck,plan,target};
  if(target.kind==='cabinet')return finish(plan,removeDivider(plan,axis,ck.index,options),target);
  const r=locate(plan,target),layout=partitionLayout(r.grid,r.rect,r.wall),result=removePartition({...r.grid,cols:layout.cols,rows:layout.rows},axis,ck.index,options);if(!result.ok)return {...result,plan,target};
  return finish(plan,replace(plan,target,collapse(result.grid)),target);
}
export function moveScopedDivider(plan,id,cmFromWallOrigin){
  if(typeof id!=='string'||!Number.isFinite(cmFromWallOrigin))return plan;
  const d=scopedDividers(plan).find(d=>d.id===id);if(!d)return plan;
  if(d.owner.kind==='cabinet')return shiftDivider(plan,d.axis,d.index,cmFromWallOrigin);
  const r=locate(plan,d.owner),g=shiftPartition(r.grid,r.rect,d.axis,d.index,cmFromWallOrigin,r.wall);return g===r.grid?plan:replace(plan,d.owner,{grid:g});
}

// Reach is a relation between ONE selected area and ONE actual divider, not
// ownership transfer. A boundary can be inherited from any real ancestor.
// The long coordinate is y for vertical boards and x for horizontal boards.
const edgeEpsilon=1e-7;
const edgeScenes=new WeakMap();
const edgeKey=t=>`${t.kind}|${t.key??''}`;
function edgeScene(plan){
  if(!plan||typeof plan!=='object'||!plan.wall||!plan.cab)return null;
  let s=edgeScenes.get(plan);if(!s){s={dividers:new Map(scopedDividers(plan).map(d=>[d.id,d])),targets:new Map(),limits:new Map()};edgeScenes.set(plan,s);}return s;
}
function currentEdge(scene,input){
  if(!scene)return null;const id=typeof input==='string'?input:input?.id,d=scene.dividers.get(id);if(!d)return null;
  // A stale descriptor must not silently move the board that later occupied
  // its index. Passing an ID explicitly requests the CURRENT board with it.
  if(input&&typeof input==='object'){
    if(input.owner&&!sameTarget(input.owner,d.owner))return null;
    for(const k of ['kind','axis','index'])if(ownKey(input,k)&&input[k]!==d[k])return null;
    for(const k of ['x','y','w','h','cm'])if(ownKey(input,k)&&(!Number.isFinite(input[k])||Math.abs(input[k]-d[k])>edgeEpsilon))return null;
  }return d;
}
function edgeTarget(plan,scene,t){
  if(!t||typeof t!=='object'||!['cell','zone','cabinet','wall'].includes(t.kind))return null;
  if((t.kind==='cabinet'||t.kind==='wall')?t.key!=null:(typeof t.key!=='string'||!t.key))return null;
  const key=edgeKey(t);if(scene.targets.has(key))return scene.targets.get(key);
  const info=locate(plan,t);if(!info)return null;const ancestors=new Set();
  for(let a=targetParent(plan,t);a;a=targetParent(plan,a))ancestors.add(edgeKey(a));
  const found={info,ancestors};scene.targets.set(key,found);return found;
}
function visibleEdgePieces(plan,d,start,end){
  if(end-start<=edgeEpsilon)return [];
  if(d.kind!=='wall')return [{start,end}];
  // The cabinet foreground occludes planning lines. Never bridge the hidden
  // middle by turning the two visible pieces into one interactive strip.
  const c=plan.cab,v=d.axis==='col',cross0=v?c.x:c.y,cross1=cross0+(v?c.w:c.h);
  if(d.cm<cross0-edgeEpsilon||d.cm>cross1+edgeEpsilon)return [{start,end}];
  const hidden0=v?c.y:c.x,hidden1=hidden0+(v?c.h:c.w);
  if(hidden1<=start+edgeEpsilon||hidden0>=end-edgeEpsilon)return [{start,end}];
  return [{start,end:Math.min(end,hidden0)},{start:Math.max(start,hidden1),end}].filter(s=>s.end-s.start>edgeEpsilon);
}
/** Returns null for frames, unrelated branches/layers, hidden lines and point
 * contact. `segments` is the complete list of visible reachable portions.
 * `start`/`end` describe its longest single portion (never an occluded span).
 * For wood, the selected clear rectangle must meet the correct BOARD FACE,
 * not merely be near its centre; wall planning lines have zero thickness.
 */
export function dividerReach(plan,target,divider){
  const scene=edgeScene(plan),d=currentEdge(scene,divider);if(!d)return null;
  const resolved=edgeTarget(plan,scene,target);if(!resolved)return null;
  const {info,ancestors}=resolved,r=info.rect,v=d.axis==='col';
  if((d.kind==='wall')!==info.wall)return null;
  let relation='owned',side=null;
  if(!sameTarget(d.owner,target)){
    if(!['cell','zone'].includes(info.kind)||!ancestors.has(edgeKey(d.owner)))return null;
    const a=v?r.x:r.y,b=a+(v?r.w:r.h),face0=v?d.x:d.y,face1=face0+(v?d.w:d.h);
    if(Math.abs(a-face1)<=edgeEpsilon)side=v?'left':'top';
    else if(Math.abs(b-face0)<=edgeEpsilon)side=v?'right':'bottom';
    else return null;relation='boundary';
  }
  const d0=v?d.y:d.x,d1=d0+(v?d.h:d.w),r0=v?r.y:r.x,r1=r0+(v?r.h:r.w);
  const segments=visibleEdgePieces(plan,d,Math.max(d0,r0),Math.min(d1,r1));if(!segments.length)return null;
  const longest=segments.reduce((best,s)=>s.end-s.start>best.end-best.start?s:best);
  return {relation,side,axis:d.axis,dividerId:d.id,owner:pureTarget(d.owner),start:longest.start,end:longest.end,segments};
}

function edgeMotionLimits(plan,scene,d){
  let result=scene.limits.get(d.id);if(result)return result;
  const owner=locate(plan,d.owner);if(!owner?.grid)return null;
  const wall=owner.wall,edge=d.owner.kind==='cabinet'?L.frame:0,layout=partitionLayout(owner.grid,owner.rect,wall,edge),v=d.axis==='col',i=d.index;
  const m=v?layout.m.ws:layout.m.hs,t=wall?0:L.divider;
  const before=layout.children.find(c=>(v?c.col:c.row)===i),after=layout.children.find(c=>(v?c.col:c.row)===i+1);
  if(!before||!after)return null;
  // Same neighbour bounds and recursive minima used by shiftPartition and
  // shiftDivider. The selected descendant's own 14 cm is NOT necessarily the
  // limiting width or height of either band in the divider owner's grid.
  result={minCm:(v?before.x:before.y)+m[i]+t/2,maxCm:(v?after.x+after.w:after.y+after.h)-m[i+1]-t/2,
    minimumBefore:m[i],minimumAfter:m[i+1]};scene.limits.set(d.id,result);return result;
}
/** Observe the real owning-divider move. Optionally pass the pointer preview
 * already calculated by moveScopedDivider(base,id,requestedCm). No selection
 * is changed. An unrelated/stale preview is refused instead of reporting a
 * different board's coordinate. `reason` is a stop message only when clamped.
 */
export function dividerDragStatus(plan,target,divider,requestedCm,nextPlan=undefined){
  const scene=edgeScene(plan),d=currentEdge(scene,divider),reach=d?dividerReach(plan,target,d):null;
  if(!d||!reach)return {ok:false,clamped:false,code:'unreachable-divider',reason:'لا يوجد فاصل مشترك ظاهر في هذه الحافة من التحديد.'};
  if(!Number.isFinite(requestedCm))return {ok:false,clamped:false,code:'invalid-point',reason:'موضع السحب غير صالح.'};
  const bounds=edgeMotionLimits(plan,scene,d);if(!bounds)return {ok:false,clamped:false,code:'invalid-divider',reason:'حدود الفاصل غير متاحة.'};
  const next=nextPlan===undefined?moveScopedDivider(plan,d.id,requestedCm):nextPlan,actual=currentEdge(edgeScene(next),d.id);
  const expected=Math.min(bounds.maxCm,Math.max(bounds.minCm,requestedCm));
  const driftTolerance=1e-8*Math.max(plan.wall.w,plan.wall.h)+edgeEpsilon;
  if(!actual||actual.axis!==d.axis||!sameTarget(actual.owner,d.owner)||Math.abs(actual.cm-expected)>driftTolerance)
    return {ok:false,clamped:false,code:'stale-preview',reason:'لا تطابق معاينة السحب هذا الفاصل في حالته الحالية.'};
  const atLimit=requestedCm<bounds.minCm-edgeEpsilon?'min':requestedCm>bounds.maxCm+edgeEpsilon?'max':null;
  const which=atLimit==='min'?(d.axis==='col'?'الأيسر':'العلوي'):(d.axis==='col'?'الأيمن':'السفلي');
  const amount=atLimit==='min'?bounds.minimumBefore:bounds.minimumAfter;
  const reason=atLimit?`توقّف الفاصل عند ${arabic(actual.cm)} سم من ${d.axis==='col'?'يسار':'أعلى'} الجدار؛ يحتاج الحيّز ${which} إلى ${arabic(amount)} سم على الأقل${amount>L.minInterior+edgeEpsilon?' لحفظ تقسيماته الداخلية':''}.`:'';
  return {ok:true,clamped:!!atLimit,atLimit,requestedCm,actualCm:actual.cm,changed:Math.abs(actual.cm-d.cm)>edgeEpsilon,
    relation:reach.relation,side:reach.side,owner:pureTarget(d.owner),target:pureTarget(target),dividerId:d.id,...bounds,reason};
}

// Direct placement. `p` is the actual pointer in centimetres on the wall.
// A wood board/frame is not a compartment; a wall planning line is likewise
// not a zone. Perpendicular boards can cross the resulting full-length cut,
// but a pointer placed ON an existing divider of that layer is ambiguous.
const dropEpsilon=1e-8;
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const insideClear=(p,r)=>p.x>r.x+dropEpsilon&&p.y>r.y+dropEpsilon&&p.x<r.x+r.w-dropEpsilon&&p.y<r.y+r.h-dropEpsilon;
function childHit(grid,rect,p,wall,edge=0){return partitionLayout(grid,rect,wall,edge).children.find(c=>insideClear(p,c))||null;}
function clearDescendant(hit,p,wall){
  let current=hit;while(current?.node.grid)current=childHit(current.node.grid,current,p,wall);return !!current;
}
function dividerLine(r,target,axis,cm,index){
  const edge=target.kind==='cabinet'?L.frame:0,box=r.rect,col=axis==='col';
  return {axis,cm,index,owner:pureTarget(target),kind:r.wall?'wall':'cabinet',thickness:r.wall?0:L.divider,
    x1:col?cm:box.x+edge,y1:col?box.y+edge:cm,x2:col?cm:box.x+box.w-edge,y2:col?box.y+box.h-edge:cm};
}
function inspectDividerDrop(plan,target,axis,p){
  const empty={target,axis,index:null,cm:null,preview:null,label:'',changed:false};
  const refuse=(failure,more={})=>({out:{...empty,...more,...failure}});
  const r=locate(plan,target);if(!r)return refuse(unknown());if(!axisOK(axis))return refuse(badAxis());
  if(!finitePoint(p))return refuse(fail('موضع المؤشر غير صالح.','invalid-point'));
  if(!insideClear(p,r.rect))return refuse(fail('أفلت داخل حدود النطاق المحدد نفسه.','outside-target'));
  const cabinet=target.kind==='cabinet',edge=cabinet?L.frame:0,col=axis==='col',cm=col?p.x:p.y;
  const g=r.grid||singlePartition(r.content||'empty'),hit=childHit(g,r.rect,p,r.wall,edge),index=hit?(col?hit.col:hit.row):null;
  const label=(r.wall?(col?'حد رأسي':'حد أفقي'):(col?'فاصل رأسي':'رف أفقي'))+' داخل '+r.label;
  const data={target:pureTarget(target),axis,cm,index,label,preview:dividerLine(r,target,axis,cm,index),changed:false};
  if(!hit||!clearDescendant(hit,p,r.wall))return refuse(fail(r.wall?'المؤشر فوق حدّ تخطيط قائم. اختر نقطة داخل المنطقة.':'المؤشر فوق لوح أو إطار قائم. اختر نقطة داخل الفراغ الصافي.','on-divider'),data);
  if(r.depth>=partitionLimits.maxDepth)return refuse(fail('بلغ هذا النطاق أقصى عمق للتقسيم.','depth-limit'),data);
  const extra=cabinet?0:(r.grid?(col?g.rows:g.cols).length+1:2);
  if(totalPartitionNodes(plan)+extra>partitionLimits.maxNodes)return refuse(fail('بلغ المخطط حد عدد الأجزاء المحفوظة.','node-limit'),data);
  const ck=partitionSplitCheck(g,r.rect,axis,index,r.wall,edge,cm);
  if(!ck.ok)return refuse(ck,data);
  // The clamp inside the shared checker accounts only for floating-point
  // noise (< 1e-8 cm). The preview must describe the exact eventual board.
  data.cm=ck.cm;data.preview=dividerLine(r,target,axis,ck.cm,index);
  return {out:{...data,ok:true,reason:'',minCm:ck.minCm,maxCm:ck.maxCm},r,g,edge};
}
export function planDividerDrop(plan,target,axis,p){return inspectDividerDrop(plan,target,axis,p).out;}
export const previewDividerDrop=planDividerDrop;
export function commitDividerDrop(plan,target,axis,p){
  const inspected=inspectDividerDrop(plan,target,axis,p),out=inspected.out;
  if(!out.ok)return {...out,plan,target,changed:false};
  const {r,g,edge}=inspected;let next;
  if(target.kind==='cabinet')next=splitBandAt(plan,axis,out.index,out.cm);
  else{const applied=splitPartition(g,r.rect,axis,out.index,r.wall,edge,out.cm);if(!applied.ok)return {...out,...applied,ok:false,plan,target,changed:false};next=replace(plan,target,{grid:applied.grid});}
  if(next===plan)return {...out,ok:false,reason:'تعذر إدراج الفاصل في الموضع المحدد.',plan,target,changed:false};
  return {...out,plan:selectTarget(next,target),target:pureTarget(target),changed:true};
}

// Geometry hit-test for a content drop: descend exactly one branch to an
// actual leaf. Never snap to the nearest cell, select an internal parent,
// accept cabinet frame/boards, or fall back to the previous selection.
function physicalLeafAt(plan,p){
  const base=cellRects(plan).find(r=>insideClear(p,r));if(!base)return null;
  let key=base.key,parentKey=null,box=rectOf(base),depth=0,g=plan.cellGrids?.[key],localCol=base.col,localRow=base.row,content=plan.cells[key]||'empty';
  while(g){const child=childHit(g,box,p,false);if(!child)return null;parentKey=key;key+=`/${child.node.id}`;box=rectOf(child);depth++;localCol=child.col;localRow=child.row;g=child.node.grid;content=child.node.content||'empty';}
  return {kind:'cell',key,parentKey,depth,col:base.col,row:base.row,localCol,localRow,...box,content};
}
export function planContentDrop(plan,source,p){
  const out={ok:false,reason:'',operation:null,effect:null,changed:false,replaces:false,fromKey:null,toKey:null,content:null,previousContent:null,source:null,cell:null,target:null,label:''};
  const refuse=(reason,code)=>({...out,reason,code});
  if(!source||typeof source!=='object'||Array.isArray(source))return refuse('مصدر القطعة غير صالح.','invalid-source');
  const palette=ownKey(source,'content'),existing=ownKey(source,'fromKey');
  if(palette===existing)return refuse('حدد قطعة من الأدوات أو قطعة موجودة، وليس المصدرين معًا.','invalid-source');
  if(palette){if(!contentIds.includes(source.content))return refuse('نوع المحتوى غير معروف.','invalid-content');out.content=source.content;out.source={content:source.content};}
  else{
    const origin=locate(plan,{kind:'cell',key:source.fromKey});
    if(!origin||origin.grid)return refuse('القطعة الأصلية يجب أن تكون داخل خانة نهائية موجودة.','invalid-source-cell');
    if(!origin.content||origin.content==='empty')return refuse('الخانة الأصلية فارغة.','empty-source');
    out.fromKey=source.fromKey;out.content=origin.content;out.source={fromKey:source.fromKey};
  }
  if(!finitePoint(p))return refuse('موضع المؤشر غير صالح.','invalid-point');
  if(!insideClear(p,plan.cab))return refuse('اسحب القطعة إلى خانة داخل الدولاب.','outside-cabinet');
  const dest=physicalLeafAt(plan,p);if(!dest)return refuse('أفلت داخل فراغ الخانة، لا فوق الإطار أو الفاصل.','on-board');
  out.cell=dest;out.toKey=dest.key;out.target={kind:'cell',key:dest.key};out.previousContent=dest.content;
  if(out.content===dest.content||out.fromKey===dest.key)return {...out,ok:true,operation:'noop',effect:'noop',label:out.fromKey===dest.key?'القطعة في خانتها الأصلية.':'المحتوى مطابق؛ لا يوجد تغيير.'};
  if(palette){const occupied=dest.content!=='empty',clear=out.content==='empty';return {...out,ok:true,operation:'set',effect:clear?'clear':occupied?'replace':'assign',replaces:occupied,changed:true,label:clear?'إفراغ هذه الخانة.':occupied?'استبدال المحتوى الحالي بالقطعة الجديدة.':'وضع القطعة في الخانة الفارغة.'};}
  const swap=dest.content!=='empty';return {...out,ok:true,operation:swap?'swap':'move',effect:swap?'swap':'move',changed:true,label:swap?'تبادل القطعتين بين الخانتين.':'نقل القطعة وإفراغ خانتها الأصلية.'};
}
export const previewContentDrop=planContentDrop;
export function commitContentDrop(plan,source,p){
  const out=planContentDrop(plan,source,p);if(!out.ok||!out.changed)return {...out,plan,target:selectedTarget(plan),changed:false};
  let next=plan;if(out.fromKey!==null)next=setScopedContent(next,out.fromKey,out.previousContent);
  next=setScopedContent(next,out.toKey,out.content);
  return {...out,plan:selectTarget(next,out.target),changed:true};
}

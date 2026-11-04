import {ownKey} from './kitchen-safe-keys.js';
// Wall coordinates and all public lengths are centimetres, measured from the
// wall's top-left corner. Divider fractions locate the centre of the board,
// relative to the cabinet's OUTER width/height. cellRects returns clear space.
import {getRoom,roomWallSize,readRoomRecord,updateRoom} from './shelf-room-model.js';
export const SHELF_LIMITS = Object.freeze({
  minInterior:14, frame:2, divider:2, minWallW:60, minWallH:60,
  maxWallW:1200, maxWallH:600, maxCols:12, maxRows:12
});
export const limits=SHELF_LIMITS;
export const shelfDepthLimits=Object.freeze({min:5,max:150,initial:36});
export const shelfDepth=plan=>plan.depth??shelfDepthLimits.initial;
export function evaluateShelfDepth(plan,depth){
  if(!Number.isFinite(depth)||depth<shelfDepthLimits.min||depth>shelfDepthLimits.max)
    return {ok:false,code:'depth-range',reason:'أدخل عمقًا بين ٥ و١٥٠ سم.'};
  if(plan.room){
    const limit=roomWallSize(plan,getRoom(plan).attachedWall).depth;
    if(depth>limit+1e-8)return {ok:false,code:'cabinet-depth',reason:`أقصى عمق متاح حتى الجدار المقابل ${num(limit)} سم.`};
  }
  return {ok:true,depth,reason:''};
}
export function setShelfDepth(plan,depth){
  return evaluateShelfDepth(plan,depth).ok&&depth!==shelfDepth(plan)?{...plan,depth}:plan;
}
export const contentIds=Object.freeze(['empty','books','boxes','plant','vase']);
export const finishIds=Object.freeze(['oak','walnut','ivory']);
export const wallColorIds=Object.freeze(['sand','sage','stone']);
export const presetIds=Object.freeze(['library','display','empty']);
// Physical screen sizes are intentionally independent of the current opening.
// A later edit can make the object obstructed; a save must not shrink or drop it.
export const sizedScreenLimits=Object.freeze({min:.1,max:1200});
export function readSizedScreen(v){
  if(!v||typeof v!=='object'||Array.isArray(v)||v.kind!=='screen')return null;
  const {w,h,centerX,bottomY}=v,m=sizedScreenLimits;
  if(![w,h,centerX,bottomY].every(Number.isFinite)||w<m.min||h<m.min||w>m.max||h>m.max||
    centerX<0||centerX>SHELF_LIMITS.maxWallW||bottomY<0||bottomY>SHELF_LIMITS.maxWallH)return null;
  return {kind:'screen',w,h,centerX,bottomY};
}
const L=SHELF_LIMITS, EPS=1e-8;
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const finite=Number.isFinite;
const near=(a,b)=>Math.abs(a-b)<EPS;
const eqList=(a,b)=>a.length===b.length&&a.every((v,i)=>near(v,b[i]));
const point=p=>p&&finite(p.x)&&finite(p.y);
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const isAxis=axis=>axis==='col'||axis==='row';
const good=(extra={})=>({ok:true,reason:'',...extra});
const fail=(reason,code,extra={})=>({ok:false,reason,code,...extra});
const num=n=>new Intl.NumberFormat('ar',{maximumFractionDigits:2}).format(n);
const axisParts=(p,a)=>a==='col'?{cuts:p.cols,span:p.cab.w,start:p.cab.x,max:L.maxCols,field:'cols'}:{cuts:p.rows,span:p.cab.h,start:p.cab.y,max:L.maxRows,field:'rows'};
const minSpan=n=>2*L.frame+(n-1)*L.divider+n*L.minInterior;
export const cellKey=(col,row)=>`${col}:${row}`;

// V2 is an optional extension. Old valid v1 JSON remains a v1 plan until a
// scoped selection or partition is actually edited. Each local grid owns its
// dividers and its children; stable child IDs are local to that owner.
export const partitionLimits=Object.freeze({maxDepth:6,maxNodes:768,minZone:14});
const leafMin=wall=>wall?partitionLimits.minZone:L.minInterior;
export function singlePartition(content='empty'){return {cols:[],rows:[],children:[{id:0,content}],nextId:1};}
export function rootPartition(p){const children=[];for(let r=0;r<=p.rows.length;r++)for(let c=0;c<=p.cols.length;c++){const key=cellKey(c,r),id=children.length,g=p.cellGrids?.[key],node=g?{id,grid:g}:{id,content:p.cells[key]||'empty'};if(p.bayFinishes?.[key])node.finish=p.bayFinishes[key];children.push(node);}return {cols:p.cols,rows:p.rows,children,nextId:children.length};}
export function partitionMinimum(g,wall=false,edge=0){
  const nc=g.cols.length+1,nr=g.rows.length+1,t=wall?0:L.divider,mi=leafMin(wall),ws=Array(nc).fill(mi),hs=Array(nr).fill(mi);
  g.children.forEach((child,i)=>{if(!child.grid)return;const m=partitionMinimum(child.grid,wall);ws[i%nc]=Math.max(ws[i%nc],m.w);hs[Math.floor(i/nc)]=Math.max(hs[Math.floor(i/nc)],m.h);});
  return {ws,hs,w:2*edge+g.cols.length*t+ws.reduce((a,b)=>a+b,0),h:2*edge+g.rows.length*t+hs.reduce((a,b)=>a+b,0)};
}
function pb(cuts,span,i,t,edge){const start=i?cuts[i-1]*span+t/2:edge,end=i===cuts.length?span-edge:cuts[i]*span-t/2;return {start,end,size:end-start};}
function sizedCuts(cuts,span,mins,t,edge){
  if(!cuts.length||mins.every((m,i)=>pb(cuts,span,i,t,edge).size>=m-EPS))return cuts;
  const free=Math.max(0,span-2*edge-cuts.length*t-mins.reduce((a,b)=>a+b,0));
  const weights=mins.map((m,i)=>Math.max(0,pb(cuts,span,i,t,edge).size-m)),sum=weights.reduce((a,b)=>a+b,0),out=[];
  let at=edge;for(let i=0;i<cuts.length;i++){at+=mins[i]+free*(sum>EPS?weights[i]/sum:1/mins.length);out.push((at+t/2)/span);at+=t;}return out;
}
export function partitionLayout(g,rect,wall=false,edge=0){
  const m=partitionMinimum(g,wall,edge),t=wall?0:L.divider,cols=sizedCuts(g.cols,rect.w,m.ws,t,edge),rows=sizedCuts(g.rows,rect.h,m.hs,t,edge);
  const nc=cols.length+1,children=g.children.map((node,i)=>{const col=i%nc,row=Math.floor(i/nc),bx=pb(cols,rect.w,col,t,edge),by=pb(rows,rect.h,row,t,edge);return {node,col,row,x:rect.x+bx.start,y:rect.y+by.start,w:bx.size,h:by.size};});
  const dividers=[];cols.forEach((f,index)=>{const cm=rect.x+f*rect.w;dividers.push({axis:'col',index,cm,x:cm-t/2,y:rect.y+edge,w:t,h:rect.h-2*edge});});
  rows.forEach((f,index)=>{const cm=rect.y+f*rect.h;dividers.push({axis:'row',index,cm,x:rect.x+edge,y:cm-t/2,w:rect.w-2*edge,h:t});});
  return {cols,rows,children,dividers,m};
}
export function partitionNodeCount(g){return g?g.children.reduce((n,c)=>n+1+(c.grid?partitionNodeCount(c.grid):0),0):0;}
export function totalPartitionNodes(p){return Object.values(p.cellGrids||{}).reduce((n,g)=>n+partitionNodeCount(g),partitionNodeCount(p.wallGrid))+Object.values(p.room?.layers||{}).reduce((n,w)=>n+partitionNodeCount(w.grid),0);}
// When a wall-space cm is supplied this is an exact-placement check. The
// normal button-based split still chooses the midpoint. A drag never borrows
// a different band or silently clamps a distant pointer to a valid position.
export function partitionSplitCheck(g,rect,axis,index,wall=false,edge=0,requestedCm=undefined){
  if(!isAxis(axis))return fail('اتجاه التقسيم غير صالح.','invalid-axis');
  const layout=partitionLayout(g,rect,wall,edge),col=axis==='col',cuts=col?layout.cols:layout.rows,span=col?rect.w:rect.h,t=wall?0:L.divider,mm=col?layout.m.ws:layout.m.hs,mi=leafMin(wall);
  if(!Number.isInteger(index)||index<0||index>cuts.length)return fail('اختر جزءًا صالحًا داخل التحديد.','invalid-band');
  if(cuts.length+1>=(col?L.maxCols:L.maxRows))return fail('بلغ النطاق الحد الأقصى من الصفوف أو الأعمدة.','band-limit');
  if(g.nextId+(col?g.rows.length+1:g.cols.length+1)>10000000)return fail('بلغ هذا النطاق حد معرّفات الأجزاء.','id-limit');
  const b=pb(cuts,span,index,t,edge),lo=b.start+mm[index]+t/2,hi=b.end-mi-t/2;
  if(hi<lo-EPS)return fail(`لا يتّسع الجزء للتقسيم مع حفظ خلوصه وتقسيماته الداخلية. يحتاج ${num(mm[index]+mi+t)} سم على الأقل.`,'band-too-small');
  if(requestedCm!==undefined&&!finite(requestedCm))return fail('موضع مركز الفاصل غير صالح.','invalid-point');
  const origin=col?rect.x:rect.y,requested=requestedCm===undefined?null:requestedCm-origin;
  if(requested!==null&&(requested<lo-EPS||requested>hi+EPS))return fail(`هذا الموضع لا يترك خلوصًا كافيًا. ضع المركز بين ${num(origin+lo)} و${num(origin+hi)} سم من ${col?'يسار':'أعلى'} الجدار داخل الحزمة نفسها.`,'requested-clearance',{minCm:origin+lo,maxCm:origin+hi});
  const local=clamp(requested===null?(b.start+b.end)/2:requested,lo,hi);return good({index,fraction:local/span,cm:origin+local,minCm:origin+lo,maxCm:origin+hi,size:b.size,layout});
}
export function splitPartition(g,rect,axis,index,wall=false,edge=0,requestedCm=undefined){
  const ck=partitionSplitCheck(g,rect,axis,index,wall,edge,requestedCm);if(!ck.ok)return ck;
  const col=axis==='col',cols=[...ck.layout.cols],rows=[...ck.layout.rows],oldN=g.cols.length+1;
  (col?cols:rows).splice(index,0,ck.fraction);const children=[];let nextId=g.nextId;
  for(let r=0;r<=rows.length;r++)for(let c=0;c<=cols.length;c++){
    if((col&&c===index+1)||(!col&&r===index+1)){
      const part={id:nextId++,content:'empty'},original=g.children[(col?r:index)*oldN+(col?index:c)];
      if(!wall&&original.finish)part.finish=original.finish;
      children.push(part);
    }
    else children.push(g.children[(r-(!col&&r>index+1?1:0))*oldN+c-(col&&c>index+1?1:0)]);
  }
  return good({grid:{cols,rows,children,nextId}});
}
export function checkPartitionRemoval(g,axis,index){
  const conflicts=[];if(!isAxis(axis)||!Number.isInteger(index)||index<0||index>=(axis==='col'?g.cols:g.rows).length)return fail('لا يوجد فاصل داخلي بهذا الاتجاه في النطاق المحدد.','invalid-divider',{conflicts,canForce:false});
  const nc=g.cols.length+1,col=axis==='col',n=col?g.rows.length+1:nc;
  for(let i=0;i<n;i++){
    const c=col?index:i,r=col?i:index,a=g.children[r*nc+c],b=g.children[r*nc+c+(col?1:nc)];
    if(a.grid&&(b.grid||b.content!=='empty')||b.grid&&(a.grid||a.content!=='empty'))return fail('لا يمكن إزالة هذا الفاصل دون فقد تقسيمات أو محتوى داخلية. أفرغ الطرف الآخر أو ادمج التقسيم الداخلي أولًا.','nested-conflict',{conflicts:[],canForce:false});
    if(!a.grid&&!b.grid&&a.content!=='empty'&&b.content!=='empty')conflicts.push({keepKey:cellKey(c,r),removeKey:cellKey(c+(col?1:0),r+(col?0:1)),keepId:a.id,removeId:b.id,keepContent:a.content,removeContent:b.content});
  }
  return conflicts.length?fail(`يتعارض محتوى ${num(conflicts.length)} زوج من الخانات. التأكيد يبقي محتوى الجانب ${col?'الأيسر':'العلوي'}.`,'content-conflict',{conflicts,canForce:true}):good({conflicts,canForce:false});
}
export function removePartition(g,axis,index,options={}){
  const ck=checkPartitionRemoval(g,axis,index);if(!ck.ok&&!(ck.canForce&&options?.allowContentMerge===true))return ck;
  const col=axis==='col',cols=[...g.cols],rows=[...g.rows],nc=g.cols.length+1; (col?cols:rows).splice(index,1);const children=[];
  for(let r=0;r<=rows.length;r++)for(let c=0;c<=cols.length;c++){
    const old=(r+(!col&&r>index?1:0))*nc+c+(col&&c>index?1:0);let child=g.children[old];
    if((col?c:r)===index){const other=g.children[old+(col?1:nc)];
      if(!child.grid&&child.content==='empty'&&(other.grid||other.content!=='empty'))child={...other,id:child.id};
      else if(!child.grid&&child.content==='empty'&&!child.finish&&other.finish)child={...child,finish:other.finish};
    }
    children.push(child);
  }
  return good({grid:{cols,rows,children,nextId:g.nextId}});
}
export function shiftPartition(g,rect,axis,index,cm,wall=false,edge=0){
  if(!isAxis(axis)||!finite(cm))return g;const layout=partitionLayout(g,rect,wall,edge),col=axis==='col',cuts=col?layout.cols:layout.rows,span=col?rect.w:rect.h,m=col?layout.m.ws:layout.m.hs,t=wall?0:L.divider;
  if(!Number.isInteger(index)||index<0||index>=cuts.length)return g;
  const lo=pb(cuts,span,index,t,edge).start+m[index]+t/2,hi=pb(cuts,span,index+1,t,edge).end-m[index+1]-t/2;
  const f=clamp(cm-(col?rect.x:rect.y),lo,hi)/span;if(hi<lo-EPS||near(f,cuts[index]))return g;
  const after=[...cuts];after[index]=f;return {...g,cols:col?after:layout.cols,rows:col?layout.rows:after};
}
export function isScopedTarget(p,target){
  if(!plain(target))return false;if(target.kind==='wall'||target.kind==='cabinet')return target.key==null;
  if(!['zone','cell'].includes(target.kind)||typeof target.key!=='string'||target.key.length>120)return false;
  const [base,...path]=target.key.split('/');if(path.length>partitionLimits.maxDepth||path.some(v=>!/^\d{1,7}$/.test(v)||String(Number(v))!==v))return false;
  if(target.kind==='zone'&&(base!=='wall'||!path.length))return false;
  if(target.kind==='cell'&&!indexFor(p,base))return false;
  let g=target.kind==='zone'?p.wallGrid:p.cellGrids?.[base];for(const id of path){const child=g?.children.find(c=>c.id===Number(id));if(!child)return false;g=child.grid;}return true;
}
export function asScopedPlan(p){return p.version===2?p:{...p,version:2,cellGrids:{},wallGrid:null,selection:{kind:'cell',key:p.selectedCell}};}
function useRootGrid(p,g,axis,index,delta){
  const cellGrids={},cells={},finishes={};const n=g.cols.length+1;g.children.forEach((ch,i)=>{const key=cellKey(i%n,Math.floor(i/n));cells[key]=ch.grid?'empty':ch.content;if(ch.grid)cellGrids[key]=ch.grid;if(ch.finish)finishes[key]=ch.finish;});
  function rekey(key){const [base,...path]=key.split('/');let [c,r]=base.split(':').map(Number);if(axis==='col'&&c>index)c+=delta;if(axis==='row'&&r>index)r+=delta;return [cellKey(c,r),...path].join('/');}
  let next={...p,cols:g.cols,rows:g.rows,cells,cellGrids,selectedCell:rekey(p.selectedCell)};
  if(Object.keys(finishes).length)next.bayFinishes=finishes;else delete next.bayFinishes;
  if(p.selection?.kind==='cell'){let t={kind:'cell',key:rekey(p.selection.key)};if(!isScopedTarget(next,t))t={kind:'cell',key:t.key.split('/')[0]};next.selection=t;}return next;
}

function indexFor(plan,key){
  if(typeof key!=='string'||key.length>7||!/^\d{1,2}:\d{1,2}$/.test(key))return null;
  const [col,row]=key.split(':').map(Number);
  return col<=plan.cols.length&&row<=plan.rows.length&&cellKey(col,row)===key?{col,row}:null;
}
export function selectedIndices(plan){return indexFor(plan,plan.selectedCell)||{col:0,row:0};}
export function cabMinimum(plan){if(plan.cellGrids&&Object.keys(plan.cellGrids).length){const {w,h}=partitionMinimum(rootPartition(plan),false,L.frame);return {w,h};}return {w:minSpan(plan.cols.length+1),h:minSpan(plan.rows.length+1)};}
export function wallMinimum(plan){const m=cabMinimum(plan),zones=plan.wallGrid?partitionMinimum(plan.wallGrid,true):{w:0,h:0};return {w:Math.max(L.minWallW,m.w,zones.w),h:Math.max(L.minWallH,m.h,zones.h)};}

function band(cuts,span,index){
  const start=index===0?L.frame:cuts[index-1]*span+L.divider/2;
  const end=index===cuts.length?span-L.frame:cuts[index]*span-L.divider/2;
  return {start,end,size:end-start};
}
function proportionsFit(cuts,span){
  if(span+EPS<minSpan(cuts.length+1))return false;
  return Array.from({length:cuts.length+1},(_,i)=>band(cuts,span,i).size).every(v=>v>=L.minInterior-EPS);
}
// Preserve fractional positions on resize when they fit. Otherwise keep each
// clear band >= minInterior and distribute the remaining space in proportion
// to requested surplus widths. This never drops a compartment or its contents.
function fitCuts(cuts,span){
  if(!cuts.length||proportionsFit(cuts,span))return cuts;
  const n=cuts.length+1,free=Math.max(0,span-minSpan(n));
  const weights=Array.from({length:n},(_,i)=>Math.max(0,band(cuts,span,i).size-L.minInterior));
  const total=weights.reduce((a,b)=>a+b,0),out=[];
  let p=L.frame;
  for(let i=0;i<n-1;i++){
    p+=L.minInterior+free*(total>EPS?weights[i]/total:1/n);
    out.push((p+L.divider/2)/span);p+=L.divider;
  }
  return out;
}
function emptyCells(cols,rows){const out={};for(let r=0;r<=rows.length;r++)for(let c=0;c<=cols.length;c++)out[cellKey(c,r)]='empty';return out;}
function sameRect(a,b){return ['x','y','w','h'].every(k=>near(a[k],b[k]));}
function putGeometry(plan,cab,wall=plan.wall){
  if(sameRect(plan.cab,cab)&&near(wall.w,plan.wall.w)&&near(wall.h,plan.wall.h))return plan;
  if(plan.cellGrids&&Object.keys(plan.cellGrids).length){const layout=partitionLayout(rootPartition(plan),cab,false,L.frame);return {...plan,wall,cab,cols:layout.cols,rows:layout.rows};}
  return {...plan,wall,cab,cols:fitCuts(plan.cols,cab.w),rows:fitCuts(plan.rows,cab.h)};
}
export function cellRects(plan){
  const out=[];
  for(let row=0;row<=plan.rows.length;row++){
    const y=band(plan.rows,plan.cab.h,row);
    for(let col=0;col<=plan.cols.length;col++){
      const x=band(plan.cols,plan.cab.w,col);
      out.push({key:cellKey(col,row),col,row,x:plan.cab.x+x.start,y:plan.cab.y+y.start,w:x.size,h:y.size});
    }
  }
  return out;
}

function patchValues(patch,keys){return plain(patch)&&keys.some(k=>ownKey(patch,k))&&keys.every(k=>!ownKey(patch,k)||finite(patch[k]));}
export function evaluateWall(plan,patch){
  if(!patchValues(patch,['w','h']))return fail('أدخل عرضًا وارتفاعًا صالحين بالسنتيمتر.','invalid-dimensions');
  if(plan.room){
    const id=getRoom(plan).attachedWall,col=id==='left'||id==='right'?'length':'width';
    const r=updateRoom(plan,{[col]:patch.w??plan.wall.w,height:patch.h??plan.wall.h});
    return r.ok?{ok:true,reason:r.reason,wall:r.plan.wall,roomResult:r,clamped:r.clamped}:fail(r.reason,r.code);
  }
  const w=patch.w??plan.wall.w,h=patch.h??plan.wall.h,m=wallMinimum(plan);
  if(w<m.w-EPS||h<m.h-EPS)return fail(`الحد الأدنى للجدار مع الشبكة الحالية ${num(m.w)} × ${num(m.h)} سم.`,'wall-too-small');
  if(w>L.maxWallW||h>L.maxWallH)return fail(`أقصى أبعاد مسموحة للجدار ${num(L.maxWallW)} × ${num(L.maxWallH)} سم.`,'wall-too-large');
  return good({wall:{w,h}});
}
export function updateWall(plan,patch){
  const result=evaluateWall(plan,patch);if(!result.ok)return plan;
  if(result.roomResult)return result.roomResult.plan;
  const wall=result.wall,w=Math.min(plan.cab.w,wall.w),h=Math.min(plan.cab.h,wall.h);
  return putGeometry(plan,{w,h,x:clamp(plan.cab.x,0,wall.w-w),y:clamp(plan.cab.y,0,wall.h-h)},wall);
}
export function evaluateCab(plan,patch){
  if(!patchValues(patch,['x','y','w','h']))return fail('أدخل موضعًا أو أبعادًا رقمية صالحة.','invalid-geometry');
  const {wall}=plan,m=cabMinimum(plan),w=patch.w??plan.cab.w,h=patch.h??plan.cab.h;
  if(w<m.w-EPS||h<m.h-EPS)return fail(`تحتاج الخزانة الحالية إلى ${num(m.w)} × ${num(m.h)} سم على الأقل لحفظ خاناتها.`,'cab-too-small');
  if(w>wall.w+EPS||h>wall.h+EPS)return fail('يجب ألا تتجاوز أبعاد الخزانة أبعاد الجدار.','cab-too-large');
  const ww=Math.min(w,wall.w),hh=Math.min(h,wall.h);
  return good({rect:{w:ww,h:hh,x:clamp(patch.x??plan.cab.x,0,wall.w-ww),y:clamp(patch.y??plan.cab.y,0,wall.h-hh)}});
}
export function updateCab(plan,patch){const r=evaluateCab(plan,patch);return r.ok?putGeometry(plan,r.rect):plan;}
export function evaluateDraw(plan,a,b){
  if(!point(a)||!point(b))return fail('موضع بداية الرسم أو نهايته غير صالح.','invalid-point',{rect:null});
  const x1=clamp(Math.min(a.x,b.x),0,plan.wall.w),x2=clamp(Math.max(a.x,b.x),0,plan.wall.w);
  const y1=clamp(Math.min(a.y,b.y),0,plan.wall.h),y2=clamp(Math.max(a.y,b.y),0,plan.wall.h);
  const rect={x:x1,y:y1,w:x2-x1,h:y2-y1},m=cabMinimum(plan);
  if(rect.w<m.w-EPS||rect.h<m.h-EPS)return fail(`المستطيل أصغر من ${num(m.w)} × ${num(m.h)} سم اللازمة لهذه الشبكة. ارسم مساحة أكبر أو قلّل التقسيمات.`,'draw-too-small',{rect});
  return good({rect});
}
export function drawCab(plan,a,b){const r=evaluateDraw(plan,a,b);return r.ok?putGeometry(plan,r.rect):plan;}
export function moveCab(plan,dx,dy){
  if(!finite(dx)||!finite(dy))return plan;
  return putGeometry(plan,{...plan.cab,x:clamp(plan.cab.x+dx,0,plan.wall.w-plan.cab.w),y:clamp(plan.cab.y+dy,0,plan.wall.h-plan.cab.h)});
}
export function resizeCab(plan,corner,p){
  if(!['nw','ne','sw','se'].includes(corner)||!point(p))return plan;
  const west=corner[1]==='w',north=corner[0]==='n',cab=plan.cab,m=cabMinimum(plan);
  const anchorX=west?cab.x+cab.w:cab.x,anchorY=north?cab.y+cab.h:cab.y;
  const x=west?clamp(p.x,0,anchorX-m.w):clamp(p.x,anchorX+m.w,plan.wall.w);
  const y=north?clamp(p.y,0,anchorY-m.h):clamp(p.y,anchorY+m.h,plan.wall.h);
  return putGeometry(plan,{x:Math.min(x,anchorX),y:Math.min(y,anchorY),w:Math.abs(x-anchorX),h:Math.abs(y-anchorY)});
}
export function shiftDivider(plan,axis,index,cmFromWallOrigin){
  if(!isAxis(axis)||!Number.isInteger(index)||!finite(cmFromWallOrigin))return plan;
  if(plan.version===2){const g=rootPartition(plan),after=shiftPartition(g,plan.cab,axis,index,cmFromWallOrigin,false,L.frame);return g===after?plan:{...plan,cols:after.cols,rows:after.rows};}
  const {cuts,span,start,field}=axisParts(plan,axis);
  if(index<0||index>=cuts.length)return plan;
  const low=band(cuts,span,index).start+L.minInterior+L.divider/2;
  const high=band(cuts,span,index+1).end-L.minInterior-L.divider/2;
  if(high<low-EPS)return plan;
  const f=clamp(cmFromWallOrigin-start,low,high)/span;
  if(near(f,cuts[index]))return plan;
  const next=[...cuts];next[index]=f;return {...plan,[field]:next};
}
export function splitBandCheck(plan,axis,index){
  if(plan.version===2){if(totalPartitionNodes(plan)>=partitionLimits.maxNodes)return fail('بلغ المخطط حد التقسيمات.','node-limit');return partitionSplitCheck(rootPartition(plan),plan.cab,axis,index,false,L.frame);}
  if(!isAxis(axis)||!Number.isInteger(index))return fail('حدّد خانة صالحة أولًا.','invalid-band');
  const {cuts,span,start,max}=axisParts(plan,axis);
  if(index<0||index>cuts.length)return fail('الخانة المطلوبة غير موجودة.','invalid-band');
  if(cuts.length+1>=max)return fail(`الحد الأقصى ${num(max)} ${axis==='col'?'عمودًا':'صفًا'}.`,'band-limit');
  const b=band(cuts,span,index),needed=2*L.minInterior+L.divider;
  if(b.size<needed-EPS)return fail(`يلزم خلوص ${num(needed)} سم على الأقل لتقسيم ${axis==='col'?'هذا العمود':'هذا الصف'} إلى خانتين مع فاصل.`,'band-too-small');
  const cut=(b.start+b.end)/2;
  return good({fraction:cut/span,cm:start+cut});
}
export function splitBand(plan,axis,index){
  const r=splitBandCheck(plan,axis,index);if(!r.ok)return plan;
  if(plan.version===2){const after=splitPartition(rootPartition(plan),plan.cab,axis,index,false,L.frame);return after.ok?useRootGrid(plan,after.grid,axis,index,1):plan;}
  const {cuts,field}=axisParts(plan,axis),next=[...cuts];next.splice(index,0,r.fraction);
  const layout={...plan,[field]:next};const cells=emptyCells(layout.cols,layout.rows);
  const rekey=(c,row)=>cellKey(axis==='col'&&c>index?c+1:c,axis==='row'&&row>index?row+1:row);
  for(let row=0;row<=plan.rows.length;row++)for(let c=0;c<=plan.cols.length;c++)cells[rekey(c,row)]=plan.cells[cellKey(c,row)]??'empty';
  const selected=selectedIndices(plan);return {...layout,cells,selectedCell:rekey(selected.col,selected.row)};
}
// Reuse stable child/content remapping from the ordinary scoped grid split,
// but insert the ORIGINAL cut directly at the reviewed coordinate.
export function splitBandAt(plan,axis,index,cm){
  if(!finite(cm))return plan;
  const p=asScopedPlan(plan),after=splitPartition(rootPartition(p),p.cab,axis,index,false,L.frame,cm);
  return after.ok?useRootGrid(p,after.grid,axis,index,1):plan;
}
export function dividerRemovalCheck(plan,axis,index){
  if(plan.version===2)return checkPartitionRemoval(rootPartition(plan),axis,index);
  const conflicts=[];
  if(!isAxis(axis)||!Number.isInteger(index))return fail('حدّد فاصلًا داخليًا صالحًا.','invalid-divider',{conflicts,canForce:false});
  const {cuts}=axisParts(plan,axis);
  if(index<0||index>=cuts.length)return fail('لا يوجد فاصل عند هذه الحافة.','invalid-divider',{conflicts,canForce:false});
  const count=(axis==='col'?plan.rows:plan.cols).length+1;
  for(let n=0;n<count;n++){
    const keepKey=axis==='col'?cellKey(index,n):cellKey(n,index),removeKey=axis==='col'?cellKey(index+1,n):cellKey(n,index+1);
    const keepContent=plan.cells[keepKey]??'empty',removeContent=plan.cells[removeKey]??'empty';
    if(keepContent!=='empty'&&removeContent!=='empty')conflicts.push({keepKey,removeKey,keepContent,removeContent});
  }
  if(conflicts.length)return fail(`يتعارض محتوى ${num(conflicts.length)} ${conflicts.length===1?'زوج من الخانات':'أزواج من الخانات'}. عند تأكيد الدمج سيبقى محتوى الجانب ${axis==='col'?'الأيسر':'العلوي'} في كل زوج متعارض.`,'content-conflict',{conflicts,canForce:true});
  return good({conflicts,canForce:false});
}
export function removeDivider(plan,axis,index,options={}){
  const r=dividerRemovalCheck(plan,axis,index);
  if(!r.ok&&!(r.canForce&&options?.allowContentMerge===true))return plan;
  if(plan.version===2){const after=removePartition(rootPartition(plan),axis,index,options);return after.ok?useRootGrid(plan,after.grid,axis,index,-1):plan;}
  const {cuts,field}=axisParts(plan,axis),next=[...cuts];next.splice(index,1);
  const layout={...plan,[field]:next},cells=emptyCells(layout.cols,layout.rows);
  const rekey=(c,row)=>cellKey(axis==='col'&&c>index?c-1:c,axis==='row'&&row>index?row-1:row);
  // Row-major visits left before right, and upper before lower. An occupied
  // neighbour migrates into an empty survivor; a confirmed collision retains
  // the left/upper item. No stale keys remain after a structural change.
  for(let row=0;row<=plan.rows.length;row++)for(let c=0;c<=plan.cols.length;c++){
    const key=rekey(c,row),value=plan.cells[cellKey(c,row)]??'empty';if(cells[key]==='empty'&&value!=='empty')cells[key]=value;
  }
  const selected=selectedIndices(plan);return {...layout,cells,selectedCell:rekey(selected.col,selected.row)};
}
export function selectCell(plan,key){return indexFor(plan,key)&&(plan.selectedCell!==key||plan.version===2&&(plan.selection?.kind!=='cell'||plan.selection.key!==key))?{...plan,selectedCell:key,...(plan.version===2?{selection:{kind:'cell',key}}:{})}:plan;}
export function setContent(plan,key,id){return indexFor(plan,key)&&!plan.cellGrids?.[key]&&contentIds.includes(id)&&plan.cells[key]!==id?{...plan,cells:{...plan.cells,[key]:id}}:plan;}
export function setFinish(plan,id){return finishIds.includes(id)&&plan.finish!==id?{...plan,finish:id}:plan;}
export function setWallColor(plan,id){return wallColorIds.includes(id)&&plan.wallColor!==id?{...plan,wallColor:id}:plan;}

function presetCuts(span,targetCuts){
  const wanted=targetCuts.length+1;
  let n=wanted;while(n>1&&span<minSpan(n)-EPS)n--;
  return fitCuts(n===wanted?[...targetCuts]:Array.from({length:n-1},(_,i)=>(i+1)/n),span);
}
export function applyPreset(plan,id){
  if(!presetIds.includes(id))return plan;
  const cols=presetCuts(plan.cab.w,id==='library'?[.29,.67]:id==='display'?[.42,.73]:[]);
  const rows=presetCuts(plan.cab.h,id==='library'?[.30,.64]:id==='display'?[.55]:[]);
  const cells=emptyCells(cols,rows),lastCol=cols.length,lastRow=rows.length;
  const add=(c,r,value)=>{const k=cellKey(c,r);if(cells[k]==='empty')cells[k]=value;};
  if(id==='library'){
    add(0,0,'books');add(lastCol,0,'vase');add(Math.floor(lastCol/2),Math.floor(lastRow/2),'plant');add(0,lastRow,'boxes');add(lastCol,lastRow,'books');
  }else if(id==='display'){
    add(0,0,'vase');add(lastCol,0,'plant');add(Math.floor(lastCol/2),lastRow,'books');add(lastCol,lastRow,'boxes');
  }
  const selectedCell=id==='empty'?'0:0':cellKey(Math.floor(lastCol/2),Math.floor(lastRow/2));
  if(!plan.bayFinishes&&!Object.keys(plan.cellGrids||{}).length&&eqList(cols,plan.cols)&&eqList(rows,plan.rows)&&selectedCell===plan.selectedCell&&Object.keys(cells).every(key=>cells[key]===plan.cells[key]))return plan;
  const next={...plan,cols,rows,cells,selectedCell,...(plan.version===2?{cellGrids:{},selection:plan.selection?.kind==='wall'||plan.selection?.kind==='zone'?plan.selection:{kind:'cabinet'}}:{})};
  delete next.bayFinishes;return next;
}
export function createShelfPlan(){
  return applyPreset({version:1,depth:shelfDepthLimits.initial,wall:{w:360,h:260},cab:{x:75,y:55,w:210,h:165},cols:[],rows:[],cells:{'0:0':'empty'},finish:'oak',wallColor:'sand',selectedCell:'0:0'},'library');
}

// For JSON imports: validate before using any coordinate, count, ID or key.
// Whitelist and copy known fields so source object references, extra metadata
// and prototype-affecting keys never enter the editable plan.
export function validatePlan(v){
  if(!plain(v)||(v.version!==undefined&&v.version!==1&&v.version!==2)||!plain(v.wall)||!plain(v.cab)||!plain(v.cells))return null;
  if(v.version!==2&&('cellGrids' in v||'wallGrid' in v||'selection' in v||'bayFinishes' in v||'room' in v))return null;
  const {wall,cab,cols,rows}=v;
  if(!finite(wall.w)||!finite(wall.h)||wall.w<L.minWallW||wall.h<L.minWallH||wall.w>L.maxWallW||wall.h>L.maxWallH)return null;
  if(!['x','y','w','h'].every(k=>finite(cab[k]))||cab.x< -EPS||cab.y< -EPS||cab.w<=0||cab.h<=0||cab.x+cab.w>wall.w+EPS||cab.y+cab.h>wall.h+EPS)return null;
  function validCuts(a,span,max){
    if(!Array.isArray(a)||a.length>=max)return false;
    for(let i=0;i<a.length;i++)if(!finite(a[i])||a[i]<=0||a[i]>=1||(i>0&&a[i]<=a[i-1]))return false;
    return proportionsFit(a,span);
  }
  if(!validCuts(cols,cab.w,L.maxCols)||!validCuts(rows,cab.h,L.maxRows)||!finishIds.includes(v.finish)||!wallColorIds.includes(v.wallColor))return null;
  const ret={version:1,wall:{w:wall.w,h:wall.h},cab:{x:Math.max(0,cab.x),y:Math.max(0,cab.y),w:cab.w,h:cab.h},cols:[...cols],rows:[...rows],cells:emptyCells(cols,rows),finish:v.finish,wallColor:v.wallColor,selectedCell:'0:0'};
  if(v.depth!==undefined){if(!finite(v.depth)||v.depth<shelfDepthLimits.min||v.depth>shelfDepthLimits.max)return null;ret.depth=v.depth;}
  const entries=Object.entries(v.cells);if(entries.length>(cols.length+1)*(rows.length+1))return null;
  for(const [key,value] of entries){if(!indexFor(ret,key)||!contentIds.includes(value))return null;ret.cells[key]=value;}
  if(v.selectedCell!==undefined){if(!indexFor(ret,v.selectedCell))return null;ret.selectedCell=v.selectedCell;}
  if(v.version===2){
    if(!plain(v.cellGrids)||!ownKey(v,'wallGrid')||!plain(v.selection))return null;
    let tally=0;const seen=new WeakSet();
    function readGrid(raw,depth,wall){
      if(depth>=partitionLimits.maxDepth||!plain(raw)||seen.has(raw))return null;seen.add(raw);
      function cutsOK(a,max){return Array.isArray(a)&&a.length<max&&Array.from(a).every((x,i)=>finite(x)&&x>0&&x<1&&(!i||x>a[i-1]));}
      if(!cutsOK(raw.cols,L.maxCols)||!cutsOK(raw.rows,L.maxRows)||(!raw.cols.length&&!raw.rows.length)||!Array.isArray(raw.children)||raw.children.length!==(raw.cols.length+1)*(raw.rows.length+1)||!Number.isSafeInteger(raw.nextId)||raw.nextId<=0||raw.nextId>10000000)return null;
      tally+=raw.children.length;if(tally>partitionLimits.maxNodes)return null;
      const children=[],ids=new Set();for(const child of raw.children){
        if(!plain(child)||!Number.isSafeInteger(child.id)||child.id<0||child.id>=raw.nextId||ids.has(child.id))return null;ids.add(child.id);
        if(ownKey(child,'finish')&&(wall||!finishIds.includes(child.finish)))return null;
        if(ownKey(child,'grid')){if(ownKey(child,'content'))return null;const grid=readGrid(child.grid,depth+1,wall);if(!grid)return null;children.push({id:child.id,grid});}
        else{if(!contentIds.includes(child.content)||(wall&&child.content!=='empty'))return null;children.push({id:child.id,content:child.content});}
        if(child.finish)children[children.length-1].finish=child.finish;
      }return {cols:[...raw.cols],rows:[...raw.rows],children,nextId:raw.nextId};
    }
    ret.version=2;ret.cellGrids={};ret.wallGrid=null;
    if(ownKey(v,'bayFinishes')){
      if(!plain(v.bayFinishes))return null;
      const entries=Object.entries(v.bayFinishes);if(entries.length>(cols.length+1)*(rows.length+1))return null;
      for(const [key,finish] of entries)if(!indexFor(ret,key)||!finishIds.includes(finish))return null;
      if(entries.length)ret.bayFinishes=Object.fromEntries(entries);
    }
    const tops=Object.entries(v.cellGrids);if(tops.length>(cols.length+1)*(rows.length+1))return null;
    for(const [key,value] of tops){if(!indexFor(ret,key)||ret.cells[key]!=='empty')return null;const grid=readGrid(value,0,false);if(!grid)return null;ret.cellGrids[key]=grid;}
    if(v.wallGrid!==null){const grid=readGrid(v.wallGrid,0,true);if(!grid)return null;const m=partitionMinimum(grid,true);if(m.w>wall.w+EPS||m.h>wall.h+EPS)return null;ret.wallGrid=grid;}
    if(ownKey(v,'room')){const room=readRoomRecord(v.room,ret,readGrid);if(!room)return null;ret.room=room;}
    for(const r of cellRects(ret)){const g=ret.cellGrids[r.key];if(g){const m=partitionMinimum(g);if(m.w>r.w+EPS||m.h>r.h+EPS)return null;}}
    if(!isScopedTarget(ret,v.selection))return null;
    ret.selection=v.selection.key==null?{kind:v.selection.kind}:{kind:v.selection.kind,key:v.selection.key};
    if(ret.selection.kind==='cell')ret.selectedCell=ret.selection.key.split('/')[0];
  }
  if(ownKey(v,'sizedObject')){
    const screen=readSizedScreen(v.sizedObject);if(!screen)return null;ret.sizedObject=screen;
  }
  return ret;
}

// Geometry is measured from the wall's top-left. A guide changes only the
// proposed coordinate: scope, identity, minimum openings and model authority
// are still checked by the ordinary placement/move operations.
import {SHELF_LIMITS,partitionLimits,totalPartitionNodes} from './shelf-model.js';
import {scopedCells,scopedDividers,targetInfo,commitDividerDrop,moveScopedDivider,selectTarget,selectedTarget,dividerReach} from './shelf-selection-model.js';
import {inspectPlacement} from './shelf-place.js';
import {groupPlacement} from './shelf-group-insert.js';

const E=1e-6,axisOK=a=>a==='row'||a==='col',finite=Number.isFinite;
const keyOf=t=>t?.kind+':'+(t?.key||''),same=(a,b)=>!!a&&!!b&&keyOf(a)===keyOf(b);
const geoCache=new WeakMap(),layoutCache=new WeakMap();
const fmt=new Intl.NumberFormat('ar',{maximumFractionDigits:2});
function scene(plan){let g=geoCache.get(plan);if(!g){const cells=scopedCells(plan),divs=scopedDividers(plan);g={cells,divs,byKey:new Map(cells.map(c=>[c.key,c])),byId:new Map(divs.map(d=>[d.id,d]))};geoCache.set(plan,g);}return g;}
const value=(p,axis)=>axis==='col'?p.x:p.y;
const setValue=(p,axis,cm)=>axis==='col'?{x:cm,y:p.y}:{x:p.x,y:cm};
const lineSpan=(r,axis)=>axis==='col'?[r.y,r.y+r.h]:[r.x,r.x+r.w];
function center(r,axis){return axis==='col'?r.x+r.w/2:r.y+r.h/2;}
function thresholds(pixel){const p=finite(pixel)&&pixel>0?pixel:1;return {enter:Math.min(6,6*p),exit:Math.min(10,11*p)};}
function candidates(plan,axis,kind,bounds,exceptId){
  const out=[{id:'middle:'+keyOf(bounds),axis,cm:center(bounds,axis),name:'منتصف النطاق',span:lineSpan(bounds,axis),priority:1}];
  for(const d of scene(plan).divs){
    if(d.id===exceptId||d.axis!==axis||d.kind!==kind)continue;
    if(kind==='wall'&&!dividerReach(plan,d.owner,d)?.segments.length)continue;
    out.push({id:d.id,axis,cm:d.cm,name:kind==='wall'?'حدّ جداري موازٍ':axis==='row'?'رفّ موازٍ':'فاصل موازٍ',span:lineSpan(d,axis),priority:0});
  }
  return out;
}
function choose(items,raw,lock,scope,pix,accept){
  const t=thresholds(pix),old=lock?.scope===scope?items.find(v=>v.id===lock.id):null;
  const near=items.filter(v=>Math.abs(v.cm-raw)<=t.enter+E).sort((a,b)=>Math.abs(a.cm-raw)-Math.abs(b.cm-raw)||a.priority-b.priority||a.id.localeCompare(b.id));
  if(old&&Math.abs(old.cm-raw)<=t.exit+E)near.unshift(old);
  for(const c of new Set(near)){const result=accept(c);if(result)return {c,result,lock:{id:c.id,scope}};}
  return null;
}
function guide(chosen,span){const c=chosen.c;return {axis:c.axis,cm:c.cm,reference:c.id,name:c.name,from:Math.min(span[0],c.span[0]),to:Math.max(span[1],c.span[1]),label:'محاذاة مع '+c.name+' عند '+fmt.format(c.cm)+' سم من '+(c.axis==='row'?'أعلى':'يسار')+' الجدار.'};}
export function snapPlacementAt(plan,axis,p,{hit=null,keys=[],lock=null,cmPerPx=1,enabled=true}={}){
  const raw={p,rawP:p,hit,guide:null,lock:null};
  if(!enabled||!axisOK(axis)||!p||!finite(p.x)||!finite(p.y)||hit?.dividerId)return raw;
  const group=Array.isArray(keys)&&keys.length>=2,inspect=q=>group?groupPlacement(plan,keys,axis,q,hit,false):inspectPlacement(plan,axis,q,hit);
  const base=inspect(p);if(!base.ok||!base.target||!base.preview)return raw;
  const bounds=targetInfo(plan,base.target);if(!bounds)return raw;
  const kind=base.preview.kind,scope=axis+'/'+keyOf(base.target)+'/'+(group?keys.join(','):'');
  const choice=choose(candidates(plan,axis,kind,bounds,null),value(p,axis),lock,scope,cmPerPx,c=>{
    const q=setValue(p,axis,c.cm),r=inspect(q);
    return r.ok&&same(base.target,r.target)&&r.source===base.source&&r.preview&&Math.abs(r.preview.cm-c.cm)<E?q:null;
  });
  if(!choice)return raw;
  const l=base.preview,span=axis==='row'?[l.x1,l.x2]:[l.y1,l.y2];
  return {...raw,p:choice.result,guide:guide(choice,span),lock:choice.lock};
}
export function snapDividerAt(plan,id,rawCm,{lock=null,cmPerPx=1,enabled=true}={}){
  const raw={cm:rawCm,guide:null,lock:null},g=scene(plan),d=g.byId.get(id);
  if(!enabled||!d||!finite(rawCm))return raw;
  const bounds=targetInfo(plan,d.owner);if(!bounds)return raw;
  const choice=choose(candidates(plan,d.axis,d.kind,bounds,id),rawCm,lock,id,cmPerPx,c=>{
    const next=moveScopedDivider(plan,id,c.cm),after=scene(next),moved=after.byId.get(id);
    if(!moved||Math.abs(moved.cm-c.cm)>E)return false;
    // A descendant can ride along with the moving cut. A coincident OLD
    // coordinate is not alignment unless the actual preview still lines up.
    const ref=after.byId.get(c.id);return ref?Math.abs(ref.cm-moved.cm)<E:Math.abs(center(targetInfo(next,d.owner),d.axis)-moved.cm)<E;
  });
  return choice?{cm:choice.c.cm,guide:guide(choice,lineSpan(d,d.axis)),lock:choice.lock}:raw;
}

export function distributionCapacity(plan,keys,axis){
  if(!axisOK(axis)||!Array.isArray(keys)||!keys.length||new Set(keys).size!==keys.length)return 0;
  const g=scene(plan);let max=axis==='row'?SHELF_LIMITS.maxRows:SHELF_LIMITS.maxCols;
  for(const k of keys){const c=g.byKey.get(k);if(!c)return 0;const len=axis==='row'?c.h:c.w;max=Math.min(max,Math.floor((len+SHELF_LIMITS.divider+E)/(SHELF_LIMITS.minInterior+SHELF_LIMITS.divider)));}
  return max;
}
// count denotes clear bays (not number of boards); all cuts are owned by
// the original leaf, so the final bay spacing is independent of cut order.
export function equalDistribution(plan,keys,axis,count,apply=false){
  const requested=Array.isArray(keys)?[...keys]:[],none={ok:false,changed:false,plan,keys:requested,axis,count,lines:[],openings:[],boards:0,reason:''};
  if(!Number.isInteger(count)||count<1)return {...none,reason:'اختر عددًا صحيحًا موجبًا للفتحات.'};
  const limit=distributionCapacity(plan,requested,axis);
  if(!limit)return {...none,reason:'اختر خانة نهائية صالحة أو مجموعة خانات.'};
  if(count>limit)return {...none,reason:'لا تتسع كل خانة لهذا العدد؛ أقصى توزيع هنا '+fmt.format(limit)+' فتحات مع سماكة الألواح والخلوص المطلوب.'};
  if(count===1)return {...none,ok:true,openings:requested.map(key=>({key,clear:axis==='row'?scene(plan).byKey.get(key).h:scene(plan).byKey.get(key).w}))};
  let cache=layoutCache.get(plan);if(!cache){cache=new Map();layoutCache.set(plan,cache);}
  const sig=axis+'/'+count+'/'+requested.join(',');let result=cache.get(sig);
  if(!result){
    if(totalPartitionNodes(plan)+requested.length*count>partitionLimits.maxNodes)return {...none,reason:'يتجاوز التوزيع حدّ عدد أجزاء المخطط.'};
    const t=SHELF_LIMITS.divider,lines=[],openings=[];let next=plan;
    for(const key of requested){
      const c=scene(plan).byKey.get(key),owner={kind:'cell',key},v=axis==='col',len=v?c.w:c.h,origin=v?c.x:c.y,clear=(len-(count-1)*t)/count;
      openings.push({key,clear});
      for(let i=1;i<count;i++){
        const cm=origin+i*clear+(i-.5)*t,p=v?{x:cm,y:c.y+c.h/2}:{x:c.x+c.w/2,y:cm},r=commitDividerDrop(next,owner,axis,p);
        if(!r.ok||!r.changed)return {...none,reason:r.reason||'تعذّر إتمام جميع الفواصل؛ بقي المخطط دون تغيير.'};
        next=r.plan;lines.push(r.preview);
      }
    }
    const parents=new Set(requested),produced=scene(next).cells.filter(c=>parents.has(c.parentKey)).map(c=>c.key);
    if(produced.length!==requested.length*count)return {...none,reason:'تعذّر التحقق من جميع الفتحات؛ بقي المخطط دون تغيير.'};
    next=selectTarget(next,selectedTarget(plan));result={...none,ok:true,changed:true,plan:next,keys:produced,lines,openings,boards:lines.length};
    if(cache.size>=16)cache.delete(cache.keys().next().value);cache.set(sig,result);
  }
  return apply?result:{...result,plan,changed:false};
}

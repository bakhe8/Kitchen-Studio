// Copy the topology and relative board positions, not a reference to the
// source grid, its contents or its finishes. All coordinates are wall cm.
import {SHELF_LIMITS as L,partitionLimits,partitionLayout,cellRects,asScopedPlan,totalPartitionNodes,validatePlan} from './shelf-model.js';
import {scopedCells,scopedDividers} from './shelf-selection-model.js';
import {effectiveFinish} from './shelf-group-finish.js';

const E=1e-7, ar=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}),n=v=>ar.format(v);
const cache=new WeakMap(),box=o=>({x:o.x,y:o.y,w:o.w,h:o.h});
const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
const isUnder=(key,base)=>key===base||key.startsWith(base+'/');
const itemLabel={books:'كتب',boxes:'صناديق',plant:'نبتة',vase:'مزهرية',empty:'فارغة'};

function inventory(plan){
  if(cache.has(plan))return cache.get(plan);
  const refs=[],byId=new Map(),leaves=scopedCells(plan),dividers=scopedDividers(plan).filter(d=>d.kind==='cabinet');
  const add=r=>{refs.push(r);byId.set(r.id,r);};
  const bases=cellRects(plan),nr=plan.rows.length+1;
  for(let i=0;i<=plan.cols.length;i++){
    const slots=bases.filter(c=>c.col===i).sort((a,b)=>a.row-b.row),first=slots[0],last=slots.at(-1);
    add({id:'column:'+i,kind:'column',index:i,label:`العمود ${n(i+1)} من اليسار`,rect:{x:first.x,y:first.y,w:first.w,h:last.y+last.h-first.y},slots:slots.map(r=>'cell:'+r.key),split:nr>1||slots.some(r=>plan.cellGrids?.[r.key])});
  }
  function visit(key,r,grid,label,depth){
    add({id:'cell:'+key,kind:'cell',key,label,depth,rect:box(r),grid:grid||null,split:!!grid});
    if(grid)for(const c of partitionLayout(grid,r).children){
      const part=grid.rows.length&&grid.cols.length?`صف ${n(c.row+1)}، عمود ${n(c.col+1)}`:grid.cols.length?`عمود ${n(c.col+1)}`:`صف ${n(c.row+1)}`;
      visit(key+'/'+c.node.id,c,c.node.grid,`${label} / ${part}`,depth+1);
    }
  }
  for(const r of bases)visit(r.key,r,plan.cellGrids?.[r.key],`خانة الصف ${n(r.row+1)}، العمود ${n(r.col+1)}`,0);
  const result={refs,byId,leaves,dividers};cache.set(plan,result);return result;
}
export function layoutCopyRegions(plan){return inventory(plan).refs.map(({id,label,kind,rect,split})=>({id,label,kind,rect:{...rect},split}));}
const idOf=r=>typeof r==='string'?r:r?.id||(r?.kind==='column'?'column:'+r.index:r?.kind==='cell'?'cell:'+r.key:'');
const members=(s,r)=>s.leaves.filter(c=>r.kind==='column'?c.col===r.index:isUnder(c.key,r.key));
function shapeOfGrid(grid,r){
  if(!grid)return null;
  const layout=partitionLayout(grid,r);
  return {cols:[...layout.cols],rows:[...layout.rows],children:layout.children.map(c=>shapeOfGrid(c.node.grid,c))};
}
function shapeOf(s,r){
  if(r.kind==='cell')return shapeOfGrid(r.grid,r.rect);
  const slots=r.slots.map(id=>s.byId.get(id));
  if(slots.length===1)return shapeOf(s,slots[0]);
  const rows=slots.slice(1).map(c=>(c.rect.y-L.divider/2-r.rect.y)/r.rect.h);
  return {cols:[],rows,children:slots.map(c=>shapeOf(s,c))};
}
function sameShape(a,b){
  if(!a||!b)return a===b;
  const eq=(x,y)=>x.length===y.length&&x.every((v,i)=>Math.abs(v-y[i])<=1e-9);
  return eq(a.cols,b.cols)&&eq(a.rows,b.rows)&&a.children.every((child,i)=>sameShape(child,b.children[i]));
}
const stop=(code,reason)=>{throw Object.assign(new Error(reason),{copyCode:code});};

// A cabinet-wide shelf already traverses neighbouring columns. It must NOT
// move or be deleted to fit a copy to one column. Strip the matching rows
// out of the recipe, and perform independent replacements between them.
function destinationJobs(s,dst,shape){
  if(dst.kind==='cell')return [{region:dst,shape}];
  const slots=dst.slots.map(id=>s.byId.get(id));
  if(slots.length===1)return [{region:slots[0],shape}];
  const span=dst.rect.h,top=dst.rect.y;
  const shared=slots.slice(1).map(c=>c.rect.y-L.divider/2);
  const rowCm=shape.rows.map(f=>top+f*span),indexes=shared.map(cm=>rowCm.findIndex(y=>Math.abs(y-cm)<=E));
  if(indexes.some(i=>i<0))stop('shared-shelf','في عمود الوجهة رفّ مشترك يعبر أعمدة أخرى، ولا يتطابق مع موضع رف في المصدر. اختر خانة بين الرفوف كوجهة، أو اختر عمودًا مصدرًا له الرفوف المشتركة نفسها.');
  const ends=[...indexes,shape.rows.length],nc=shape.cols.length+1;let first=0;
  return slots.map((r,i)=>{
    const end=ends[i],rows=rowCm.slice(first,end).map(y=>(y-r.rect.y)/r.rect.h),children=shape.children.slice(first*nc,(end+1)*nc);first=end+1;
    const sliced=(!shape.cols.length&&!rows.length)?children[0]:{cols:shape.cols,rows,children};
    return {region:r,shape:sliced};
  });
}
function idsFor(plan){
  let next=(plan.cols.length+1)*(plan.rows.length+1);
  const walk=g=>{if(!g)return;next=Math.max(next,g.nextId);g.children.forEach(c=>walk(c.grid));};
  Object.values(plan.cellGrids||{}).forEach(walk);walk(plan.wallGrid);
  return ()=>{if(next>=10000000)stop('id-limit','بلغ المخطّط حد معرّفات الأجزاء. لم يُطبّق النسخ.');return next++;};
}
function intervals(cuts,origin,span){
  const edges=cuts.map(f=>origin+f*span),half=L.divider/2;
  return Array.from({length:cuts.length+1},(_,i)=>{const a=i?edges[i-1]+half:origin,b=i<edges.length?edges[i]-half:origin+span;
    if(b-a<L.minInterior-E)stop('clearance',`لا يتّسع مقاس الوجهة لهذه النسب وسماكة الألواح مع خلوص ${n(L.minInterior)} سم لكل فتحة. لم يتغير المخطّط.`);
    return [a,b-a];});
}
function materialize(pattern,r,ownerKey,depth,allocate,leaves,node={}){
  if(!pattern){node.content='empty';leaves.push({...r,key:ownerKey,node});return node;}
  if(depth>=partitionLimits.maxDepth)stop('depth-limit','يتجاوز عمق الفروع المنسوخة حدّ التقسيم داخل هذه الوجهة.');
  const xs=intervals(pattern.cols,r.x,r.w),ys=intervals(pattern.rows,r.y,r.h),children=[];
  for(const [j,[y,h]] of ys.entries())for(const [i,[x,w]] of xs.entries()){
    const id=allocate();children.push(materialize(pattern.children[j*xs.length+i],{x,y,w,h},ownerKey+'/'+id,depth+1,allocate,leaves,{id}));
  }
  node.grid={cols:[...pattern.cols],rows:[...pattern.rows],children,nextId:Math.max(...children.map(c=>c.id))+1};return node;
}
function setRegion(p,key,entry){
  const plan=asScopedPlan(p),[base,...path]=key.split('/'),cellGrids={...plan.cellGrids},cells={...plan.cells};
  if(!path.length){
    if(entry.grid){cellGrids[base]=entry.grid;cells[base]='empty';}else{delete cellGrids[base];cells[base]=entry.content;}
    return {...plan,cellGrids,cells,...(entry.finish?{bayFinishes:{...plan.bayFinishes,[base]:entry.finish}}:{})};
  }
  const write=(g,level)=>({...g,children:g.children.map(c=>String(c.id)!==path[level]?c:level+1<path.length?{...c,grid:write(c.grid,level+1)}:{id:c.id,...(c.finish?{finish:c.finish}:{}),...entry})});
  cellGrids[base]=write(cellGrids[base],0);return {...plan,cellGrids,cells};
}

// Place each existing *destination* object in a different overlapping future
// opening. Augmenting paths avoid deleting an item just because another item
// greedily took its only available slot. No source ornament is duplicated.
function retainItems(old,fresh,removed){
  const occupied=old.filter(c=>c.content!=='empty');
  const candidates=occupied.map(c=>fresh.map((f,i)=>({i,area:overlap(c,f)})).filter(x=>x.area>E).sort((a,b)=>b.area-a.area||a.i-b.i).map(x=>x.i));
  const assigned=Array(fresh.length).fill(-1);
  function claim(i,visited){for(const j of candidates[i]){if(visited.has(j))continue;visited.add(j);if(assigned[j]===-1||claim(assigned[j],visited)){assigned[j]=i;return true;}}return false;}
  const ordered=occupied.map((_,i)=>i).sort((a,b)=>candidates[a].length-candidates[b].length||a-b);
  for(const i of ordered)if(!claim(i,new Set()))removed.push({key:occupied[i].key,content:occupied[i].content});
  for(let j=0;j<assigned.length;j++)if(assigned[j]!==-1)fresh[j].node.content=occupied[assigned[j]].content;
}
function view(plan,s,r){
  const leaves=members(s,r).map(c=>({...box(c),key:c.key,content:c.content,finish:effectiveFinish(plan,c.key)}));
  return {rect:{...r.rect},leaves};
}

/** Source/target ids come from layoutCopyRegions(). Preview returns the input
 * plan. Apply repeats validation and emits one publishable immutable plan. */
export function copyLayout(plan,sourceRef,targetRef,{apply=false,allowDiscard=false}={}){
  const start={ok:false,changed:false,wouldChange:false,plan,keys:[],target:null,reason:'',code:'',removed:[],before:null,after:null,sourceView:null};
  try{
    if(!plan?.cab||!plan?.wall)stop('invalid-plan','لا يوجد مخطّط صالح للنسخ.');
    const s=inventory(plan),src=s.byId.get(idOf(sourceRef)),dst=s.byId.get(idOf(targetRef));
    if(!src||!dst)stop('missing-scope','اختر مصدر التقسيم ووجهته من المخطّط الحالي.');
    start.source={id:src.id,kind:src.kind,label:src.label};start.destination={id:dst.id,kind:dst.kind,label:dst.label};
    start.sourceView=view(plan,s,src);start.before=view(plan,s,dst);
    if(!src.split)stop('plain-source','المصدر لا يحتوي على تقسيم داخلي لنسخه.');
    if(overlap(src.rect,dst.rect)>E)stop('overlap','اختر وجهة منفصلة لا تتداخل مع المصدر، حتى يبقى الأصل كما هو.');
    const pattern=shapeOf(s,src),jobs=destinationJobs(s,dst,pattern),allocate=idsFor(plan);
    let next=plan;const removed=[];
    for(const {region,shape} of jobs){
      if(sameShape(shape,shapeOf(s,region)))continue;
      const old=members(s,region),fresh=[],entry=materialize(shape,region.rect,region.key,region.depth,allocate,fresh),baseFinish=effectiveFinish(plan,region.key);
      retainItems(old,fresh,removed);
      // Keep destination finishes, choosing the largest old overlap per new
      // opening. Never import the source's backing finish or cabinet finish.
      for(const f of fresh){let best=0,finish=baseFinish;for(const c of old){const a=overlap(c,f);if(a>best){best=a;finish=effectiveFinish(plan,c.key);}}if(finish!==baseFinish)f.node.finish=finish;}
      next=setRegion(next,region.key,entry);
    }
    const target={kind:'cell',key:jobs[0].region.key};
    if(next===plan)return {...start,ok:true,code:'unchanged',target,keys:members(s,dst).map(c=>c.key),after:start.before,reason:'للمصدر والوجهة التقسيم نفسه بالفعل.'};
    if(totalPartitionNodes(next)>partitionLimits.maxNodes)stop('node-limit','يتجاوز التقسيم الجديد حدّ أجزاء المخطّط. اختر جزءًا أصغر للنسخ.');
    next={...next,selection:target,selectedCell:target.key.split('/')[0]};
    if(!validatePlan(next))stop('invalid-result','لا تسمح قيود المخطّط بهذه النسخة؛ بقي التصميم دون تغيير.');
    const ns=inventory(next),newDst=ns.byId.get(dst.id),after=view(next,ns,newDst),keys=after.leaves.map(c=>c.key);
    const proposal={...start,target,keys,removed,after,wouldChange:true};
    if(removed.length && allowDiscard!==true)return {...proposal,code:'occupied',reason:`لا تتوافر فتحات متداخلة منفصلة لحفظ ${n(removed.length)} من أغراض الوجهة. انقلها أولًا، أو اسمح بإزالتها صراحةً.`};
    return {...proposal,ok:true,changed:apply===true,plan:apply===true?next:plan,reason:removed.length?`ستُزال ${n(removed.length)} من أغراض الوجهة بعد الاعتماد.`:'ستبقى جميع أغراض الوجهة، ولا تُنسخ محتويات المصدر.'};
  }catch(e){if(!e.copyCode)throw e;return {...start,code:e.copyCode,reason:e.message};}
}

const NS='http://www.w3.org/2000/svg',backing={oak:'#ead8b5',walnut:'#ac8d74',ivory:'#f0efdf'};
function thumbnail(doc,view,title){
  const fig=doc.createElement('figure'),caption=doc.createElement('figcaption');caption.textContent=title;
  const svg=doc.createElementNS(NS,'svg'),r=view.rect;
  svg.setAttribute('viewBox',`${r.x} ${r.y} ${r.w} ${r.h}`);svg.setAttribute('role','img');svg.setAttribute('aria-label',`${title}، ${n(view.leaves.length)} فتحات`);
  const draw=(tag,props)=>{const node=doc.createElementNS(NS,tag);for(const [k,v] of Object.entries(props))node.setAttribute(k,String(v));svg.append(node);return node;};
  draw('rect',{x:r.x,y:r.y,width:r.w,height:r.h,fill:'#987a58'});
  for(const c of view.leaves){
    draw('rect',{x:c.x,y:c.y,width:c.w,height:c.h,fill:backing[c.finish]||backing.oak,stroke:'#927c5f','stroke-width':'.45','vector-effect':'non-scaling-stroke'});
    if(c.content!=='empty'){const v=draw('circle',{cx:c.x+c.w*.5,cy:c.y+c.h*.6,r:Math.min(c.w,c.h)*.10,fill:'#36583e'});const desc=doc.createElementNS(NS,'title');desc.textContent=itemLabel[c.content]||c.content;v.append(desc);}
  }
  fig.append(caption,svg);return fig;
}

/** Mount once in Properties → Presets. onCommit receives exactly one
 * immutable result; the app adds it to its usual undo history. */
export function mountCopyLayout(host,{getPlan,onCommit}={}){
  if(!host?.ownerDocument||typeof getPlan!=='function'||typeof onCommit!=='function')throw new TypeError('mountCopyLayout requires host, getPlan and onCommit');
  const doc=host.ownerDocument,ctrl=new (doc.defaultView?.AbortController||AbortController)(),signal=ctrl.signal;
  const make=(tag,cls,txt)=>{const e=doc.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;};
  const widget=make('details','sp-copy-layout'),summary=make('summary','', 'نسخ تقسيم صممته');widget.dataset.copyWidget='';
  const body=make('div','sp-copy-body'),note=make('p','sp-copy-note','اختر تقسيمًا من هذا الدولاب ووجهة منفصلة. تُنسخ مواضع الرفوف والفواصل بنسبها؛ ويمكن تعديل النسخة دون تغيير المصدر.');
  const picker=(label,attr)=>{const l=make('label','sp-copy-field',label),v=make('select');v.dataset[attr]='';l.append(v);return [l,v];};
  const [sl,source]=picker('انسخ من','copySource'),[tl,dest]=picker('إلى','copyTarget');
  const preview=make('div','sp-copy-review');preview.dataset.copyPreview='';
  const warning=make('p','sp-copy-message');warning.setAttribute('aria-live','polite');
  const allowLabel=make('label','sp-copy-consent'),allow=make('input'),allowText=make('span');allow.type='checkbox';allow.dataset.copyDiscard='';allowLabel.append(allow,allowText);allowLabel.hidden=true;
  const apply=make('button','sp-copy-apply','تطبيق النسخة');apply.type='button';apply.dataset.copyApply='';apply.disabled=true;
  const live=make('p','sp-copy-status');live.setAttribute('role','status');live.setAttribute('aria-live','polite');
  body.append(note,sl,tl,preview,warning,allowLabel,apply,live);widget.append(summary,body);host.append(widget);
  let shown=null,regions=[],dead=false;
  function options(select,list,placeholder,selected){
    const nodes=[make('option','',placeholder)];nodes[0].value='';
    for(const r of list){const e=make('option','',r.label);e.value=r.id;nodes.push(e);}
    select.replaceChildren(...nodes);select.value=list.some(r=>r.id===selected)?selected:'';
  }
  function setDest(prefer){const sr=regions.find(r=>r.id===source.value);options(dest,regions.filter(r=>sr&&overlap(sr.rect,r.rect)<=E),'اختر وجهة النسخة',prefer);dest.disabled=!sr;}
  function paint(){
    preview.replaceChildren();warning.textContent='';apply.disabled=true;allowLabel.hidden=true;
    if(source.value){const inv=inventory(shown),sr=inv.byId.get(source.value);if(sr){const sample=thumbnail(doc,view(shown,inv,sr),'تقسيم المصدر');sample.className='sp-copy-source-sample';preview.append(sample);}}
    if(!source.value||!dest.value){if(!regions.some(r=>r.split))warning.textContent='لم يُنشأ تقسيم داخلي بعد. أضف رفًا أو فاصلًا ثم ارجع إلى النسخ.';else if(source.value&&dest.options.length===1)warning.textContent='لا توجد مساحة منفصلة عن هذا المصدر في التصميم الحالي.';return;}
    const r=copyLayout(shown,source.value,dest.value,{allowDiscard:allow.checked});
    if(r.before&&r.after){const figs=make('div','sp-copy-figures');figs.append(thumbnail(doc,r.before,'الوجهة الآن'),thumbnail(doc,r.after,'بعد النسخ'));preview.append(figs);
      const total=r.before.leaves.filter(c=>c.content!=='empty').length;
      preview.append(make('p','sp-copy-legend',`الفتحات: ${n(r.before.leaves.length)} ← ${n(r.after.leaves.length)}. النقطة تمثّل غرضًا. سيبقى ${n(total-r.removed.length)} من ${n(total)} أغراض الوجهة.`));
      preview.append(make('p','sp-copy-legend','توزّع أغراض الوجهة على فتحات متداخلة مع أماكنها السابقة. لكل فتحة تشطيب الجزء الأكثر تداخلًا معها. لا تتحرك الرفوف المشتركة مع أعمدة أخرى.'));
    }else if(r.sourceView && r.before){const figs=make('div','sp-copy-figures');figs.append(thumbnail(doc,r.sourceView,'المصدر'),thumbnail(doc,r.before,'الوجهة الآن'));preview.append(figs);}
    if(r.removed.length){allowLabel.hidden=false;const counts=new Map();for(const v of r.removed)counts.set(v.content,(counts.get(v.content)||0)+1);
      const names=[...counts].map(([k,v])=>`${itemLabel[k]||k}: ${n(v)}`).join('، ');
      allowText.textContent=`أوافق على إزالة ما لا يمكن إبقاؤه في الوجهة (${names}).`;}
    warning.textContent=r.reason;warning.dataset.valid=String(r.ok);apply.disabled=!r.ok||!r.wouldChange;
  }
  function refresh(force=false){
    if(dead||!widget.open)return;
    const current=getPlan();if(!current||(!force&&shown===current))return;
    const st=source.value,dt=dest.value;shown=current;regions=layoutCopyRegions(current);allow.checked=false;live.textContent='';
    options(source,regions.filter(r=>r.split),'اختر تقسيم المصدر',st);setDest(dt);paint();
  }
  widget.addEventListener('toggle',()=>{if(widget.open)refresh(true);},{signal});
  source.addEventListener('change',()=>{if(shown!==getPlan()){refresh(true);return;}allow.checked=false;live.textContent='';setDest(dest.value);paint();},{signal});
  dest.addEventListener('change',()=>{if(shown!==getPlan()){refresh(true);return;}allow.checked=false;live.textContent='';paint();},{signal});
  allow.addEventListener('change',()=>{if(shown!==getPlan()){refresh(true);return;}live.textContent='';paint();},{signal});
  apply.addEventListener('click',()=>{
    if(dead||apply.disabled)return;
    if(shown!==getPlan()){refresh(true);live.textContent='تغيّر المخطّط. راجع المعاينة المحدَّثة قبل تطبيق النسخة.';return;}
    const result=copyLayout(shown,source.value,dest.value,{apply:true,allowDiscard:allow.checked});
    if(!result.ok||!result.changed){paint();return;}
    onCommit(result);refresh(true);live.textContent='نُسخ التقسيم إلى الوجهة. يمكنك التراجع عن العملية كاملة.';
  },{signal});
  return {refresh,destroy(){if(dead)return;dead=true;ctrl.abort();widget.remove();}};
}

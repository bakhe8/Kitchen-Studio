// Build the real preset recipe inside each selected opening. A recipe is a
// local child grid; it never adds a cut to the cabinet or to a wall zone.
import {applyPreset,presetIds,SHELF_LIMITS,partitionLimits,totalPartitionNodes} from './shelf-model.js';
import {scopedCells,commitDividerDrop,setScopedContent,selectedTarget,selectTarget,targetInfo} from './shelf-selection-model.js';

function patternFor(plan,cell,id){
  // The whole-cabinet recipe reserves two exterior frame faces. Padding our
  // calculation by exactly those faces lets the same density/clearance rule
  // operate on this leaf's *clear* width & height. No extra frame is built.
  const frame=SHELF_LIMITS.frame;
  const w=cell.w+2*frame,h=cell.h+2*frame;
  const provisional={...plan,version:1,cab:{...plan.cab,w,h},cols:[],rows:[],cells:{'0:0':'empty'},cellGrids:{},selectedCell:'0:0'};
  const recipe=applyPreset(provisional,id);
  return {cols:recipe.cols.map(f=>cell.x+f*w-frame),rows:recipe.rows.map(f=>cell.y+f*h-frame),contents:recipe.cells};
}

export function groupPreset(plan,keys,id){
  const original=Array.isArray(keys)||keys instanceof Set?[...keys]:[];
  const base={ok:false,changed:false,plan,keys:original,count:0,reason:''};
  const fail=(code,reason)=>({...base,code,reason});
  if(!plan?.cab||!plan?.wall)return fail('invalid-plan','لا يوجد مخطط صالح لتطبيق النموذج.');
  if(!presetIds.includes(id))return fail('invalid-preset','هذا النموذج غير معروف.');
  const wanted=new Set(original);
  if(wanted.size<2)return fail('not-a-group','حدّد خانتين نهائيتين على الأقل لتطبيق نموذج على المجموعة.');
  const cells=scopedCells(plan).filter(c=>wanted.has(c.key));
  if(cells.length!==wanted.size)return fail('stale-group','تغيّرت الخانات المحدّدة. أعد تحديد المجموعة قبل تطبيق النموذج.');
  const name=c=>targetInfo(plan,{kind:'cell',key:c.key})?.label||'إحدى الخانات';
  const jobs=[];let extra=0;
  for(const c of cells){
    const pattern=patternFor(plan,c,id),splits=pattern.rows.length+pattern.cols.length;
    if(splits&&c.depth>=partitionLimits.maxDepth)return fail('depth-limit',`بلغت ${name(c)} حد عمق التقسيم؛ بقيت المجموعة كما كانت.`);
    if(splits)extra+=(pattern.rows.length+1)*(pattern.cols.length+1);
    jobs.push({c,pattern,splits});
  }
  if(totalPartitionNodes(plan)+extra>partitionLimits.maxNodes)return fail('node-limit','يتجاوز تطبيق النموذج على جميع الخانات حدّ أجزاء المخطط. لم تتغير المجموعة.');
  let next=plan;
  const changedParents=new Set();
  for(const {c,pattern,splits} of jobs){
    if(!splits)continue;
    const owner={kind:'cell',key:c.key};
    // Column cuts go first. Subsequent row cuts use the clear centre of the
    // first column as their orthogonal probe, so a middle divider cannot
    // accidentally intercept the requested full-width local shelf.
    const firstRight=pattern.cols.length?pattern.cols[0]-SHELF_LIMITS.divider/2:c.x+c.w;
    const x=(c.x+firstRight)/2;
    const cuts=[...pattern.cols.map(cm=>['col',{x:cm,y:c.y+c.h/2}]),...pattern.rows.map(cm=>['row',{x,y:cm}])];
    for(const [axis,p] of cuts){
      const r=commitDividerDrop(next,owner,axis,p);
      if(!r.ok||!r.changed)return fail(r.code||'blocked',`تعذّر تطبيق النموذج داخل ${name(c)}: ${r.reason||'لم يُنشأ الفاصل.'} بقي المخطط دون تغيير.`);
      next=r.plan;
    }
    changedParents.add(c.key);
  }
  const byParent=new Map(jobs.map(j=>[j.c.key,j]));
  const resultKeys=[],found=new Map();
  for(const leaf of scopedCells(next)){
    const same=byParent.get(leaf.key),job=same||byParent.get(leaf.parentKey);
    if(!job)continue;
    const slot=same?'0:0':`${leaf.localCol}:${leaf.localRow}`;
    const desired=job.pattern.contents[slot];
    if(desired==null)return fail('invalid-layout','لم تتطابق فتحات النموذج مع الخانات الناتجة؛ بقي المخطط دون تغيير.');
    found.set(job.c.key,(found.get(job.c.key)||0)+1);resultKeys.push(leaf.key);
    if(leaf.content===desired)continue;
    const updated=setScopedContent(next,leaf.key,desired);
    if(updated===next)return fail('content-blocked','تعذّر وضع محتوى إحدى خانات النموذج؛ لم يُعتمد أي تغيير.');
    next=updated;changedParents.add(job.c.key);
  }
  for(const {c,pattern} of jobs)if(found.get(c.key)!==(pattern.rows.length+1)*(pattern.cols.length+1))return fail('selection-migration','تعذّر تتبّع جميع خانات المجموعة؛ بقي المخطط دون تغيير.');
  if(!changedParents.size)return {...base,ok:true,code:'',keys:resultKeys};
  // A structural helper temporarily selects its owner. Preserve the caller's
  // original single-selection anchor; the returned keys carry the real group.
  next=selectTarget(next,selectedTarget(plan));
  return {...base,ok:true,code:'',changed:true,plan:next,keys:resultKeys,count:changedParents.size};
}

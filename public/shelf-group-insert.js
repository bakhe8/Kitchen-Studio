// Insert once per selected *leaf*. The press supplies a fraction of one
// clear opening, not an absolute wall coordinate or a whole-cabinet cut.
import {partitionLimits,totalPartitionNodes} from './shelf-model.js';
import {scopedCells,planDividerDrop,commitDividerDrop,selectTarget,targetInfo} from './shelf-selection-model.js';

const EPS=1e-8;
const numbered=new Intl.NumberFormat('ar-SA');
const scenes=new WeakMap();
function scene(plan){
  let cached=scenes.get(plan);
  if(!cached){
    const cells=scopedCells(plan);
    cached={cells,byKey:new Map(cells.map(cell=>[cell.key,cell])),nodes:totalPartitionNodes(plan)};
    scenes.set(plan,cached);
  }
  return cached;
}
const inClear=(p,r)=>p.x>r.x+EPS&&p.x<r.x+r.w-EPS&&p.y>r.y+EPS&&p.y<r.y+r.h-EPS;

/** Wall coordinates and preview line endpoints are in cm. A failure, even
 * after building a private draft, returns the exact original object and no
 * partial preview. An actual commit is one immutable plan / one undo entry.
 */
export function groupPlacement(plan,keys,axis,p,hit=null,apply=false){
  const original=Array.isArray(keys)||keys instanceof Set?[...keys]:[];
  const base={ok:false,changed:false,plan,keys:original,reason:'',code:'',axis,lines:[],target:null,preview:null,count:0,label:''};
  const fail=(code,reason)=>({...base,code,reason});
  if(!plan?.cab||!plan?.wall)return fail('invalid-plan','لا يوجد مخطط صالح لتقسيم المجموعة.');
  const wanted=new Set(original);
  if(wanted.size<2)return fail('not-a-group','حدّد خانتين نهائيتين على الأقل لإدراج فاصل في كل منهما.');
  if(axis!=='row'&&axis!=='col')return fail('invalid-axis','اختر الاتجاه الأفقي أو الرأسي أولًا.');
  if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y))return fail('invalid-point','اختر نقطة داخل الفراغ الصافي لإحدى الخانات المحدّدة.');
  const s=scene(plan);
  for(const k of wanted)if(!s.byKey.has(k))return fail('stale-group','تغيّرت إحدى الخانات المحدّدة أو لم تعد خانة نهائية. أعد تحديد المجموعة.');
  // A materially hit board or its handle wins over an apparently nearby
  // opening. Conversely a stale scope hint must never expand this group.
  if(hit?.dividerId!=null||['divider','frame','art','content'].includes(hit?.kind))return fail('not-clear','انقر داخل فراغ خانة محدّدة، لا على إطار أو فاصل أو قطعة محتوى.');
  const chosen=s.cells.filter(c=>wanted.has(c.key));
  const master=chosen.find(c=>inClear(p,c));
  if(!master)return fail('outside-group','النقطة خارج الفراغ الصافي للخانات المحدّدة. انقر داخل إحدى خانات المجموعة.');
  const col=axis==='col', ratio=col?(p.x-master.x)/master.w:(p.y-master.y)/master.h;
  const target={kind:'cell',key:master.key};
  // Each leaf acquires exactly two nodes. A per-leaf preflight on the same
  // base cannot by itself detect that the combined write exceeds the limit.
  if(s.nodes+chosen.length*2>partitionLimits.maxNodes)return fail('node-limit','تقسيم كل الخانات المحدّدة يتجاوز حدّ أجزاء المخطط؛ لم يُضف أي فاصل.');
  const entries=[];
  let preview=null;
  for(const c of chosen){
    const owner={kind:'cell',key:c.key};
    // Keep the exact original point on the clicked leaf. Other leaves get
    // the same fraction of their own clear span and an orthogonal midpoint.
    const at=c.key===master.key?{x:p.x,y:p.y}:col?{x:c.x+ratio*c.w,y:c.y+c.h/2}:{x:c.x+c.w/2,y:c.y+ratio*c.h};
    const q=planDividerDrop(plan,owner,axis,at);
    if(!q.ok){const name=targetInfo(plan,owner)?.label||'إحدى الخانات';return fail(q.code||'member-blocked',`تعذّر تقسيم المجموعة عند ${name}: ${q.reason} لم يُضف أي فاصل.`);}
    entries.push({owner,at,line:q.preview});
    if(c.key===master.key)preview=q.preview;
  }
  const success={...base,ok:true,target,preview,lines:entries.map(e=>e.line),count:entries.length,fraction:ratio,
    label:`${col?'فاصل رأسي':'رف أفقي'} في كل خانة محدّدة · عدد الفواصل: ${numbered.format(entries.length)}`};
  if(apply!==true)return success;
  let next=plan;
  for(const {owner,at} of entries){
    const result=commitDividerDrop(next,owner,axis,at);
    if(!result.ok||!result.changed)return fail(result.code||'commit-refused',`لم يُعتمد تقسيم المجموعة. ${result.reason||'تعذّر تطبيق أحد الفواصل.'}`);
    next=result.plan;
  }
  const leaves=scopedCells(next).filter(c=>wanted.has(c.parentKey));
  if(leaves.length!==2*chosen.length)return fail('selection-migration','تعذّر تتبّع الخانات الجديدة؛ لم يُعتمد أي فاصل.');
  return {...success,changed:true,plan:selectTarget(next,target),keys:leaves.map(c=>c.key)};
}

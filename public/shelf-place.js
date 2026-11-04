// Pure hit-to-placement policy. A click supplies the scope; the previously
// selected wall, cabinet or cell is never an input to this decision.
import {SHELF_LIMITS} from './shelf-model.js';
import {scopedCells,wallZones,scopedDividers,targetInfo,planDividerDrop,commitDividerDrop} from './shelf-selection-model.js';

const EPS=1e-8,FRAME=SHELF_LIMITS.frame;
// This inset only moves PERPENDICULAR to the requested cut coordinate. It is
// much smaller than a 14 cm minimum clear bay; it cannot jump to a farther bay.
const INNER_PROBE_CM=.01;
const scenes=new WeakMap();
const validPoint=p=>p!=null&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const copy=p=>({x:p.x,y:p.y});
const within=(p,r)=>p.x>=r.x-EPS&&p.x<=r.x+r.w+EPS&&p.y>=r.y-EPS&&p.y<=r.y+r.h+EPS;
const clear=(p,r)=>p.x>r.x+EPS&&p.x<r.x+r.w-EPS&&p.y>r.y+EPS&&p.y<r.y+r.h-EPS;
const canonical=t=>t==null?null:t.key==null?{kind:t.kind}:{kind:t.kind,key:t.key};
function geometry(plan){let s=scenes.get(plan);if(!s){const dividers=scopedDividers(plan);s={cells:scopedCells(plan),zones:wallZones(plan),dividers,byId:new Map(dividers.map(d=>[d.id,d])),labels:new Map()};scenes.set(plan,s);}return s;}
function scopeName(plan,s,t){if(!t)return '';const key=`${t.kind}:${t.key??''}`;if(!s.labels.has(key))s.labels.set(key,targetInfo(plan,t)?.label||'');return s.labels.get(key);}
function faceOf(p,c){const sides=[];if(p.x<=c.x+FRAME+EPS)sides.push('left');if(p.x>=c.x+c.w-FRAME-EPS)sides.push('right');if(p.y<=c.y+FRAME+EPS)sides.push('top');if(p.y>=c.y+c.h-FRAME-EPS)sides.push('bottom');return sides;}
function nominalTarget(plan,s,p,insideCab){
  if(insideCab){const leaf=s.cells.find(r=>clear(p,r));return leaf&&s.cells.length>1?{kind:'cell',key:leaf.key}:{kind:'cabinet'};}
  const zone=s.zones.find(r=>clear(p,r));return zone?{kind:'zone',key:zone.key}:{kind:'wall'};
}
function rejected(base,reason,code,patch={}){return {...base,...patch,ok:false,reason,code,changed:false};}

/** Resolve a click in wall cm. For a valid frame click `point` is the click,
 * `anchor` lies just inside its adjacent compartment and preview.cm retains
 * exactly point.y (row) or point.x (col). No preview ever produces a plan.
 * hit.target may come from a selection overlay: it cannot enlarge the scope.
 * A reported dividerId (e.g. a wide accessible grip) always blocks insertion.
 */
export function inspectPlacement(plan,axis,p,hit=null){
  const out={ok:false,reason:'',code:'',axis,point:validPoint(p)?copy(p):null,anchor:null,target:null,preview:null,source:'outside',frameSide:null,scopeLabel:'',label:'',cm:null,index:null,changed:false};
  if(!plan?.wall||!plan?.cab)return rejected(out,'لا يوجد مخطط صالح للإدراج.','invalid-plan');
  if(axis!=='col'&&axis!=='row')return rejected(out,'اختر رفًا أفقيًا أو فاصلًا رأسيًا.','invalid-axis');
  if(!validPoint(p))return rejected(out,'موضع النقرة غير صالح.','invalid-point');
  const wb={x:0,y:0,w:plan.wall.w,h:plan.wall.h};if(!within(p,wb))return rejected(out,'انقر داخل الجدار أو الدولاب.','outside-wall');
  const s=geometry(plan),c=plan.cab,insideCab=within(p,c),layer=insideCab?'cabinet':'wall';
  const tapped=hit?.dividerId??(hit?.kind==='divider'?hit.id:null);
  // The visible chart layer controls geometric board hits. A wall line
  // occluded by the cabinet cannot capture an interior click. An explicit
  // divider/grip hit still refuses insertion rather than falling through.
  const board=tapped!=null?s.byId.get(tapped):s.dividers.findLast(d=>d.kind===layer&&within(p,d));
  if(tapped!=null||board){
    const t=board&&board.kind===layer?canonical(board.owner):nominalTarget(plan,s,p,insideCab);
    return rejected(out,board?'النقطة على فاصل أو حدّ قائم؛ انقر داخل الفراغ.':'مقبض الفاصل لم يعد موجودًا؛ اختر نقطة جديدة.',board?'on-divider':'stale-divider',
      {target:t,scopeLabel:scopeName(plan,s,t),source:'divider',dividerId:board?.id??tapped});
  }

  let target,source,frameSide=null,anchor=copy(p);
  if(insideCab){
    const sides=faceOf(p,c);
    if(sides.length){
      target={kind:'cabinet'};source='cabinet-frame';
      const frameState={target,source,scopeLabel:scopeName(plan,s,target)};
      if(sides.length!==1)return rejected(out,'ابتعد عن زاوية الإطار، وانقر جانبًا واحدًا.','frame-corner',frameState);
      frameSide=sides[0];const side=frameSide==='left'||frameSide==='right';
      if((axis==='row')!==side)return rejected(out,axis==='row'?'للرف الكامل، انقر يسار الإطار أو يمينه عند الارتفاع المطلوب.':'للفاصل الكامل، انقر أعلى الإطار أو أسفله عند الموضع المطلوب.','wrong-frame-side',{...frameState,frameSide});
      if(frameSide==='left')anchor.x=c.x+FRAME+INNER_PROBE_CM;
      else if(frameSide==='right')anchor.x=c.x+c.w-FRAME-INNER_PROBE_CM;
      else if(frameSide==='top')anchor.y=c.y+FRAME+INNER_PROBE_CM;
      else anchor.y=c.y+c.h-FRAME-INNER_PROBE_CM;
      // Never hunt across shelves for another orthogonal anchor. A board
      // immediately inside this very face prevents a valid frame insertion.
      if(!s.cells.some(r=>clear(anchor,r)))return rejected(out,'يوجد لوح عند هذا الموضع من الإطار؛ اختر موضعًا آخر.','on-divider',{...frameState,frameSide,anchor});
    }else{
      const leaf=s.cells.find(r=>clear(p,r));
      if(!leaf)return rejected(out,'انقر داخل فراغ الخانة، بعيدًا عن حافتها.','no-clear-cell',{target:{kind:'cabinet'},scopeLabel:'الدولاب كله',source:'cell'});
      if(s.cells.length===1){target={kind:'cabinet'};source='undivided-cabinet';}
      else{target={kind:'cell',key:leaf.key};source='cell';}
    }
  }else{
    const zone=s.zones.find(r=>clear(p,r));target=zone?{kind:'zone',key:zone.key}:{kind:'wall'};source=zone?'zone':'wall';
    if(!clear(p,wb))return rejected(out,'انقر داخل مساحة الجدار، بعيدًا عن حافته.','wall-edge',{target,source,scopeLabel:scopeName(plan,s,target)});
    if(s.zones.length&&!zone)return rejected(out,'اختر نقطة داخل منطقة الجدار، لا على الحدّ بينها وبين جارتها.','on-divider',{target,source,scopeLabel:scopeName(plan,s,target)});
  }
  const placement=planDividerDrop(plan,target,axis,anchor);
  return {...out,...placement,point:copy(p),anchor,target:canonical(target),scopeLabel:scopeName(plan,s,target),source,frameSide,code:placement.code||'',changed:false};
}

/** Re-evaluates the same original click on the supplied plan. Failures retain
 * its exact identity and selection; a committed structural edit is immutable.
 */
export function applyPlacement(plan,axis,p,hit=null){
  const view=inspectPlacement(plan,axis,p,hit);if(!view.ok)return {...view,plan};
  const result=commitDividerDrop(plan,view.target,axis,view.anchor);
  return {...view,...result,point:view.point,anchor:view.anchor,frameSide:view.frameSide,scopeLabel:view.scopeLabel,source:view.source,code:result.code||''};
}

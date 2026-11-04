// Read-only menu descriptions; the caller retains the original point and plan
// revision while the menu is open. Scope changes never move the saved point.
import {scopedCells,scopedDividers,wallZones,targetInfo,targetParent,selectedTarget,
  planDividerDrop,removalTargetCheck,removeTargetDivider} from './shelf-selection-model.js';

const EPS=1e-7,fmt=new Intl.NumberFormat('ar-SA',{numberingSystem:'arab',maximumFractionDigits:1});
const number=n=>fmt.format(n);
const finitePoint=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const within=(p,r)=>p.x>=r.x-EPS&&p.y>=r.y-EPS&&p.x<=r.x+r.w+EPS&&p.y<=r.y+r.h+EPS;
const clean=t=>t.key==null?{kind:t.kind}:{kind:t.kind,key:t.key};
const same=(a,b)=>!!a&&!!b&&a.kind===b.kind&&(a.key??null)===(b.key??null);
const scopeId=t=>`scope:${t.kind}${t.key!=null?':'+t.key:''}`;
const isWall=t=>t?.kind==='wall'||t?.kind==='zone';
const wallBox=plan=>({x:0,y:0,w:plan.wall.w,h:plan.wall.h});
const pointCopy=p=>finitePoint(p)?{x:p.x,y:p.y}:null;

function lineage(plan,start){
  const out=[];let t=start;
  while(t&&targetInfo(plan,t)){
    out.push(clean(t));t=targetParent(plan,t);
  }
  return out;
}
function scopeRows(plan,chain,active){return chain.map(t=>({id:scopeId(t),target:clean(t),label:targetInfo(plan,t)?.label||'',active:same(t,active)}));}
function requestedTarget(chain,requested){return chain.find(t=>same(t,requested))||null;}
function dividerText(plan,d){
  const wall=d.kind==='wall',col=d.axis==='col';
  const name=wall?(col?'الحدّ الرأسي':'الحدّ الأفقي'):(col?'الفاصل الرأسي':'الرفّ الأفقي');
  const position=`رقم ${number(d.index+1)} ${col?'من اليسار':'من الأعلى'}`;
  const owner=targetInfo(plan,d.owner)?.label||'';
  return {name,position,owner,title:`${name} ${position} · ${owner}`};
}
function findDivider(plan,id){return typeof id==='string'?scopedDividers(plan).find(d=>d.id===id)||null:null;}
function missingDivider(){return {ok:false,code:'invalid-divider',reason:'هذا الفاصل غير موجود في التصميم الحالي.',canForce:false,conflicts:[]};}

// Resolves to the named board's actual owner and exact index. Never use the
// owner's default (usually last) divider for a point-specific operation.
export function checkRemovalAt(plan,dividerId){
  const d=findDivider(plan,dividerId);if(!d)return missingDivider();
  const check=removalTargetCheck(plan,d.owner,d.axis,{index:d.index});
  return {...check,id:d.id,dividerId:d.id,owner:clean(d.owner),target:clean(d.owner),axis:d.axis,index:d.index,cm:d.cm,title:dividerText(plan,d).title};
}
export function removalAt(plan,dividerId,allow=false){
  const check=checkRemovalAt(plan,dividerId),accepted=allow===true||allow?.allowContentMerge===true;
  if(!check.ok&&!(check.canForce&&accepted))return {...check,plan,target:check.target||selectedTarget(plan),changed:false};
  const applied=removeTargetDivider(plan,check.owner,check.axis,{index:check.index,allowContentMerge:accepted});
  return {...check,...applied,changed:applied.ok&&applied.plan!==plan};
}

function empty(title,p,code){return {kind:'none',title,code,point:pointCopy(p),target:null,hitTarget:null,insertLabel:'',scopes:[],actions:[],divider:null};}
function explicitOverride(hit,active,options){
  // Optional fourth-argument flags are intentionally NOT used: on a NEW
  // point, a selected wall must never capture a click through the cabinet.
  return options?.scopeOverride||hit?.scopeOverride||(options?.explicitScope===true?active:null);
}
function materialContext(plan,d,p,override){
  const chain=lineage(plan,d.owner),active=requestedTarget(chain,override)||chain[0];
  const text=dividerText(plan,d),rm=checkRemovalAt(plan,d.id),own=same(active,d.owner),canConfirm=rm.canForce===true;
  const reason=!own?'هذه الإزالة تخصّ '+text.owner+'؛ اختر نطاق الفاصل لإزالته.':rm.ok?'':rm.reason;
  return {kind:'divider',title:text.title,point:pointCopy(p),target:clean(active),hitTarget:clean(d.owner),insertLabel:'',scopes:scopeRows(plan,chain,active),
    divider:{...d,owner:clean(d.owner),title:text.title,ordinal:d.index+1},dividerId:d.id,
    moveHint:`اسحب مقبض ${text.name} لتحريكه داخل ${text.owner}. مركزه عند ${number(d.cm)} سم ${d.axis==='col'?'من يسار الجدار':'من أعلى الجدار'}.`,
    actions:[{id:'remove-divider',type:'remove',label:`إزالة ${text.name} ${text.position}`,disabled:!own||(!rm.ok&&!canConfirm),reason,
      target:clean(d.owner),dividerId:d.id,axis:d.axis,index:d.index,needsConfirmation:canConfirm,canForce:canConfirm,conflicts:rm.conflicts||[]}]
  };
}

/** Build a menu for an observed canvas hit and wall-space point in cm.
 * hit = {target:{kind,key?},dividerId?}; no DOM or mutation is involved.
 * An override is only for a deliberate scope choice in this SAME open menu:
 * pointContext(p, hit, storedPoint, active, {scopeOverride:chosenTarget}).
 * Ordinary clicks/secondary clicks omit it. New hits then choose the visible
 * leaf unless the active target is an applicable visible ancestor.
 */
export function pointContext(plan,hit,p,activeTarget,options={}){
  if(!finitePoint(p))return empty('موضع النقطة غير صالح.',p,'invalid-point');
  if(!within(p,wallBox(plan)))return empty('النقطة خارج مساحة الجدار.',p,'outside-wall');
  const insideCabinet=within(p,plan.cab),dividers=scopedDividers(plan),override=explicitOverride(hit,activeTarget,options);
  // The canvas may hit a grip whose accessible hit box is larger than the
  // wooden board: explicit divider IDs are authoritative even off centre.
  const explicitId=hit?.dividerId??(hit?.kind==='divider'?hit.id:null);
  if(explicitId!=null){
    const d=dividers.find(v=>v.id===explicitId);
    if(!d)return empty('الفاصل الذي نقرت عليه لم يعد موجودًا.',p,'invalid-divider');
    if(d.kind!=='wall'||!insideCabinet)return materialContext(plan,d,p,override);
    // A hidden planning line must not supply a destructive action through
    // the cabinet foreground. Resolve the visible location below instead.
  }
  // Exact physical intersections (not nearest-line snapping) also protect a
  // click reported without a grip ID. Later rendered boards are foremost.
  const layer=insideCabinet?'cabinet':'wall';
  const board=dividers.filter(d=>d.kind===layer&&within(p,d)).at(-1);
  if(board)return materialContext(plan,board,p,override);

  const hint=hit?.target||(hit?.kind==='art'||hit?.kind==='content'?{kind:'cell',key:hit.key??hit.cellKey}:hit);
  let picked,frame=false;
  if(insideCabinet){
    const leaf=scopedCells(plan).find(r=>within(p,r));
    if(leaf)picked={kind:'cell',key:leaf.key};else{picked={kind:'cabinet'};frame=true;}
  }else{
    const z=wallZones(plan).find(r=>within(p,r));
    picked=z?{kind:'zone',key:z.key}:{kind:'wall'};
    // A click on the thin outer wall border deliberately selects the full
    // wall. An ordinary blank point in a visible zone still starts at it.
    if(hint?.kind==='wall'&&Math.min(Math.abs(p.x),Math.abs(p.y),Math.abs(plan.wall.w-p.x),Math.abs(plan.wall.h-p.y))<=EPS)picked={kind:'wall'};
  }
  const chain=lineage(plan,picked);
  if(!chain.length)return empty('لا يوجد نطاق صالح عند هذه النقطة.',p,'invalid-target');
  const deliberate=requestedTarget(chain,override),candidate=requestedTarget(chain,activeTarget);
  const active=deliberate||(!insideCabinet||!isWall(candidate)?candidate:null)||chain[0];
  const behind=insideCabinet&&isWall(active),scopeLabel=targetInfo(plan,active).label;
  const ctx={kind:frame?'frame':'point',title:frame?'إطار الدولاب':targetInfo(plan,picked).label,point:pointCopy(p),hitTarget:clean(picked),target:clean(active),
    insertLabel:scopeLabel,scopes:scopeRows(plan,chain,active),actions:[],divider:null,occluded:behind};
  if(frame){ctx.hint='هذا إطار الدولاب. انقر داخل الفراغ الذي تريد تقسيمه.';return ctx;}
  for(const axis of ['row','col']){
    const wall=isWall(active),name=wall?(axis==='row'?'حدّ تخطيط أفقي هنا':'حدّ تخطيط رأسي هنا'):(axis==='row'?'رف أفقي هنا':'فاصل رأسي هنا');
    const r=behind?{ok:false,code:'occluded-wall',reason:'هذه النقطة من الجدار محجوبة بالدولاب. انقر جزءًا ظاهرًا من الجدار لإدراج حدّ تخطيط.'}:planDividerDrop(plan,active,axis,p);
    ctx.actions.push({id:`insert-${axis}`,type:'insert',label:name,disabled:!r.ok,reason:r.ok?'':r.reason,code:r.code||'',target:clean(active),axis,preview:r.preview||null,index:r.index??null,cm:r.cm??null});
  }
  return ctx;
}

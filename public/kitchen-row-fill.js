import {checkWallPairRow,wallPairSpans} from './kitchen-wall-pair-fit.js';
// Single-run completion, in the same local centimetres and physical geometry as
// manual placement. Only generated units in the chosen row may be redistributed.
import {kitchenGeometry,kitchenRoom,kitchenRunLocal,kitchenRunPolygon,kitchenUnitSpecs,validateKitchenChange} from './kitchen-model.js';
import {fittingStarts} from './kitchen-placement.js';
import {polygonBounds} from './kitchen-oriented.js';
import {creationDefaults} from './kitchen-defaults-calculations.js';

const eps=1e-7,min=20,probeWidth=.001,near=(a,b)=>Math.abs(a-b)<eps;
const rounded=n=>Math.round(n*1e9)/1e9,fmt=n=>new Intl.NumberFormat('ar',{maximumFractionDigits:2}).format(n);
const fail=(k,id,reason,code='row-fill')=>({ok:false,changed:false,kitchen:k,id,reason,code,clamped:false});
const sameSpan=(a,b)=>near(a.u,b.u)&&near(a.width,b.width);
function subtract(spans,r){
  const out=[];for(const a of spans){if(r.end<=a.start+eps||r.start>=a.end-eps){out.push(a);continue;}
    if(r.start>a.start+eps)out.push({start:a.start,end:r.start});if(r.end<a.end-eps)out.push({start:r.end,end:a.end});}
  return out;
}
function openGeometry(k,room){
  const units=k.units.map(u=>kitchenUnitSpecs[u.kind].openable&&!u.open?{...u,open:true}:u);
  return kitchenGeometry({...k,units},room);
}
export function legalRowSpans(k,room,run,reserved=[]){
  // A thin probe obtains the legal *spans*, including recesses narrower than
  // the model's 20 cm minimum. They are reported rather than made into cabinets.
  const g=openGeometry(k,room),w=probeWidth,u=run.start,polygon=kitchenRunPolygon(room,run,u,w,run.depth);
  const proto={id:'probe',kind:'storage',u,width:w,depth:run.depth,height:run.height,bottom:run.bottom,
    tier:run.tier,wall:run.wall,runId:run.id,polygon,rect:polygonBounds(polygon),supportsWorktop:run.tier==='base'};
  // Preserve each existing front's modeled open envelope where the prospective
  // closed cabinet would intrude. No need to simulate simultaneously open doors.
  const sweeps=g.units.flatMap(v=>v.openParts.map((p,i)=>({...p,id:'opening:'+v.id+':'+i,kind:'column'})));
  let spans=fittingStarts({...g,features:[...g.features,...sweeps]},run,proto,p=>kitchenRunLocal(room,run,p))
    .map(s=>({start:rounded(Math.max(run.start,s.start)),end:rounded(Math.min(run.end,s.end+w))}));
  // Include the full dimensional range of a fixed appliance even if its
  // physical body (e.g. an upper hood) is narrower at some heights.
  for(const v of [...k.units.filter(u=>u.runId===run.id),...reserved])spans=subtract(spans,{start:v.u,end:v.u+v.width});
  if(room.workshop?.wallPairs)spans=wallPairSpans({room,kitchen:k},run,spans.map(s=>({startMm:s.start*10,endMm:s.end*10}))).map(s=>({start:s.startMm/10,end:s.endMm/10}));
  return spans;
}
// Keep whole unaffected cabinets when possible, then fill remaining pieces.
// Standard cabinets prefer 60 cm; the last is made to measure. Never fabricate
// a 5–10 cm cabinet or describe an empty sliver as a manufactured filler.
function partition(span,old,target,keep=true){
  let cursor=span.start;const out=[];
  const split=(s,e)=>{const w=e-s;if(w<min-eps)return;
    const n=Math.max(1,Math.floor((w+eps)/target)),rem=rounded(w-n*target);
    const count=w<target?n:rem>=min-eps?n+1:n;
    for(let i=0;i<count;i++){const u=rounded(s+i*target),width=rounded(i===count-1?e-u:target);out.push({u,width});}};
  if(keep)for(const prev of old){const end=prev.u+prev.width;
    if(prev.u<cursor-eps||end>span.end+eps)continue;
    const left=prev.u-cursor,right=span.end-end;
    if((left>eps&&left<min-eps)||(right>eps&&right<min-eps))continue;
    split(cursor,prev.u);out.push({u:prev.u,width:prev.width,old:prev});cursor=end;
  }
  split(cursor,span.end);return out;
}
const containsID=(k,id)=>k.units.some(u=>u.id===id)||k.runs.some(r=>r.id===id)||k.features.some(f=>f.id===id);
function build(k,run,old,plans,defaults){
  const taken=new Set(plans.filter(p=>p.old).map(p=>p.old.id)),adopted=new Set(),made=[];let seq=k.nextId;
  for(const p of plans){
    let prev=p.old;if(!prev){
      // Reuse a genuine surviving portion of the same cabinet; don't assign
      // the identity of a removed unit to an unrelated location.
      let score=eps;for(const q of old){if(taken.has(q.id)||adopted.has(q.id))continue;
        const overlap=Math.min(p.u+p.width,q.u+q.width)-Math.max(p.u,q.u);if(overlap>score){score=overlap;prev=q;}}
    }
    if(prev){adopted.add(prev.id);made.push(sameSpan(p,prev)?prev:{...prev,u:p.u,width:p.width});continue;}
    let id;do{id='unit-'+seq++;}while(containsID(k,id)||old.some(x=>x.id===id));
    const unit={id,runId:run.id,kind:'storage',u:p.u,width:p.width,open:false,interior:{shelves:1,dividers:0},fillRole:'auto'};
    for(const key of ['frontFinish','frontStyle','handleStyle','frontColor'])if(defaults[key])unit[key]=defaults[key];made.push(unit);
  }
  return {units:made,nextId:seq};
}
const openBlock=c=>['open-body','open-feature','open-outside'].includes(c.type);
export function chooseRowOpenings(k,room,editable,anchorsChanged=new Set()){
  // Existing unrelated problems remain visible in the inspector. Every
  // generated unit and every edited anchor must be individually usable.
  const hits=candidate=>openGeometry(candidate,room).conflicts.filter(c=>openBlock(c)&&
    c.ids.some(id=>editable.has(id)||anchorsChanged.has(id)));
  let next=k,issues=hits(next);
  for(const id of new Set(issues.map(c=>c.ids[0]))){
    if(!editable.has(id))continue;
    for(const hand of ['pair','left','right']){
      const u=next.units.find(x=>x.id===id);if(!u||u.doorHanding===hand)continue;
      const draft={...next,units:next.units.map(x=>x.id===id?{...x,doorHanding:hand}:x)},res=hits(draft);
      if(!res.some(c=>c.ids[0]===id)){next=draft;issues=res;break;}
    }
  }
  return issues.length?{ok:false,issue:issues[0]}:{ok:true,kitchen:next};
}
export function fillKitchenRow(k,room,runId,options={}){
  const original=k,run=k?.runs?.find(r=>r.id===runId);
  if(!run)return fail(k,runId,'اختر صفًا موجودًا لتعبئته.','missing-run');
  const base=options.previousKitchen||k,here=k.units.filter(u=>u.runId===runId),anchors=here.filter(u=>u.fillRole!=='auto');
  const keep=k.units.filter(u=>u.runId!==runId||u.fillRole!=='auto'),otherIds=new Set(keep.map(u=>u.id));
  const old=base.units.filter(u=>u.runId===runId&&u.fillRole==='auto'&&!otherIds.has(u.id)).sort((a,b)=>a.u-b.u);
  const reserved=Array.isArray(run.fillGaps)?run.fillGaps:[],reservedCm=reserved.reduce((s,a)=>s+a.width,0);
  if(reserved.some(v=>!Number.isFinite(v.u)||!Number.isFinite(v.width)||v.width<=0||v.u<run.start-eps||v.u+v.width>run.end+eps||
    anchors.some(a=>Math.min(a.u+a.width,v.u+v.width)-Math.max(a.u,v.u)>eps)))return fail(k,runId,'الموضع يتقاطع مع فراغ محجوز. حرّر الفراغ أو غيّر موضع الوحدة.','reserved-gap');
  const core={...k,units:keep},spaces=legalRowSpans(core,room.workshop?.wallPairs?room:kitchenRoom(room),run,reserved),unfilled=spaces.filter(s=>s.end-s.start<min-eps);
  const unfilledCm=rounded(unfilled.reduce((s,v)=>s+v.end-v.start,0)),area=spaces.reduce((s,v)=>s+v.end-v.start,0),widths=anchors.reduce((s,u)=>s+u.width,0),
    blockedCm=rounded(Math.max(0,run.end-run.start-widths-reservedCm-area));
  if(!anchors.length&&!reserved.length&&!spaces.some(s=>s.end-s.start>=min-eps))return fail(original,runId,'لا يوجد جزء متصل يتسع لخزانة بعرض ٢٠ سم. راجع الفتحات والعوائق وحدود الصف.','row-unavailable');
  const defaults={...creationDefaults({kitchen:k,room}),...run.fillDefaults,...options.defaults};
  const stamp=Object.fromEntries(['frontFinish','frontStyle','handleStyle','frontColor'].filter(key=>defaults[key]).map(key=>[key,defaults[key]]));
  const managed=run.autoFill===true?run:{...run,autoFill:true,fillDefaults:stamp},runs=k.runs.map(r=>r.id===runId?managed:r);
  const anchorsChanged=new Set(anchors.filter(a=>{const p=base.units.find(x=>x.id===a.id);return !p||p.runId!==a.runId||p.kind!==a.kind||!sameSpan(p,a)||p.doorHanding!==a.doorHanding;}).map(x=>x.id));
  let lastReason='',lastCode='';
  const modeSeen=new Set();
  for(const [target,preserve] of [[60,true],[60,false],[45,false],[30,false]]){
    const proposed=spaces.flatMap(s=>partition(s,old,target,preserve));
    const signature=proposed.map(p=>p.u+'/'+p.width).join(';');if(modeSeen.has(signature))continue;modeSeen.add(signature);
    if(keep.length+proposed.length>256){lastReason='يتجاوز عدد الوحدات حدّ المشروع. قلّل عدد الوحدات أو طول الصف.';lastCode='unit-limit';continue;}
    const {units:built,nextId}=build(core,run,old,proposed,defaults);
    // Reassemble stable document order: untouched rows and unchanged cabinets
    // keep identity and ordering; position is authoritative in the drawing.
    const rem=new Map(built.map(u=>[u.id,u]));const currentMap=new Map(keep.map(u=>[u.id,u]));const ordered=[];
    for(const u of base.units){if(currentMap.has(u.id)){ordered.push(currentMap.get(u.id));currentMap.delete(u.id);}else if(rem.has(u.id)){ordered.push(rem.get(u.id));rem.delete(u.id);}}
    ordered.push(...currentMap.values(),...rem.values());
    let candidate={...k,runs,units:ordered,nextId};
    if(room.workshop?.wallPairs){
      const fit=checkWallPairRow({room,kitchen:candidate},run,candidate.units.filter(u=>u.runId===run.id));
      if(fit.errors.length){lastReason=fit.errors[0];lastCode='wall-pair-fit';continue;}
    }
    const checked=validateKitchenChange(base,room,candidate,room);
    if(!checked.ok){lastReason=checked.reason;lastCode=checked.code;continue;}
    const identical=candidate.runs.length===original.runs.length&&candidate.runs.every((v,i)=>v===original.runs[i])&&candidate.units.length===original.units.length&&candidate.units.every((v,i)=>v===original.units[i])&&candidate.nextId===original.nextId;
    // All simple opening poses in the model are checked individually. A
    // same-result refresh can skip this only if no geometry changed at all.
    if(!identical||base!==original||anchorsChanged.size){
      const accessible=chooseRowOpenings(candidate,room,new Set(built.map(u=>u.id)),anchorsChanged);
      if(!accessible.ok){lastReason='لا تكتمل التعبئة مع إبقاء الواجهات قابلة للفتح: '+accessible.issue.label;lastCode='row-opening';continue;}
      candidate=accessible.kitchen;
    }
    const stats={units:built.length,anchors:anchors.length,totalUnits:anchors.length+built.length,reservedCm:rounded(reservedCm),blockedCm,unfilledCm,
      residuals:unfilled.map(s=>({u:s.start,width:rounded(s.end-s.start)})),filledCm:rounded(widths+built.reduce((s,v)=>s+v.width,0))};
    const reason=unfilledCm?'بقي '+fmt(unfilledCm)+' سم في أجزاء عرض كل منها أقل من ٢٠ سم.':'';
    const unchanged=identical&&candidate.units===ordered;
    return {ok:true,changed:!unchanged,kitchen:unchanged?original:candidate,id:runId,reason,code:'',clamped:false,stats};
  }
  return fail(original,runId,lastReason||'تعذّر ملء الصف دون تغيير وحدة ثابتة أو تجاوز حدوده.',lastCode||'row-fill');
}

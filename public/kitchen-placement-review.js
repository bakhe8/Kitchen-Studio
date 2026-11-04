import {hardKitchenConflicts,kitchenUnitSpecs,kitchenFeatureSpecs} from './kitchen-model.js';
import {roomFaceLabels} from './shelf-room-model.js';

const fmt=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(n);
// Use the stored identities: even two windows with identical positions can
// be selected individually here without moving or deleting either one.
export function mountPlacementReview(trigger,panel,{getDoc,inspect,closeOthers,returnFocus}){
 const section=panel.querySelector('[data-review-items]');let entries=[],lastDoc=null;
 const element=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
 const close=(focus=false)=>{const wasOpen=!panel.hidden;panel.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus&&wasOpen&&!trigger.hidden)(returnFocus?.()||trigger).focus({preventScroll:true});};
 function refresh(){const doc=getDoc();if(doc===lastDoc)return;lastDoc=doc;entries=hardKitchenConflicts(doc.kitchen,doc.room);
  trigger.hidden=!entries.length;trigger.textContent='مراجعة التداخلات ('+fmt(entries.length)+')';if(!entries.length)close();if(!panel.hidden)draw();
 }
 function draw(){const {kitchen}=getDoc();section.replaceChildren();
  const features=kitchen.features.map(obj=>({kind:'feature',obj,name:kitchenFeatureSpecs[obj.kind]?.label||'تجهيز'}));
  const units=kitchen.units.map(obj=>({kind:'unit',obj,name:kitchenUnitSpecs[obj.kind]?.label||'وحدة'}));
  const runs=kitchen.runs.map(obj=>({kind:'run',obj,name:obj.placement==='free'?'جزيرة':obj.tier==='upper'?'صف علوي':'صف سفلي'}));
  const objects=[...features,...units,...runs];
  for(const c of entries){
   const card=element('article','');card.append(element('strong',c.label||'تداخل في الموضع'));
   const ids=c.ids||[];const targets=objects.filter(v=>ids.includes(v.obj.id)||v.kind==='run'&&ids.some(id=>typeof id==='string'&&id.startsWith('top:'+v.obj.id+':')));
   for(const t of targets){
    const {kind,obj,name}=t,group=objects.filter(v=>v.kind===kind&&v.name===name),row=kind==='unit'?kitchen.runs.find(r=>r.id===obj.runId):obj;
    const ordinal=group.length>1?' '+fmt(group.indexOf(t)+1):'',wall=roomFaceLabels[row?.wall]||(row?.placement==='free'?'الجزيرة':'');
    const btn=element('button','تحديد '+name+ordinal);btn.type='button';btn.dataset.reviewTarget=obj.id;btn.dataset.kind=kind;
    const desc=[wall];if(Number.isFinite(obj.u))desc.push('البداية '+fmt(obj.u)+' سم');if(Number.isFinite(obj.bottom))desc.push('عن الأرض '+fmt(obj.bottom)+' سم');
    const line=element('div','');line.append(btn,element('small',desc.filter(Boolean).join(' · ')));card.append(line);
   }section.append(card);
  }
 }
 section.addEventListener('click',e=>{const b=e.target.closest('[data-review-target]');if(!b)return;close();inspect(b.dataset.kind,b.dataset.reviewTarget);});
 panel.querySelector('[data-review-close]').addEventListener('click',()=>close(true));
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close(true);}});
 trigger.addEventListener('click',()=>{if(!panel.hidden){close(true);return;}closeOthers();refresh();draw();panel.hidden=false;trigger.setAttribute('aria-expanded','true');panel.querySelector('[data-review-close]').focus({preventScroll:true});});
 refresh();return {refresh,close};
}

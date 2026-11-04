import {mountWallOptions} from './kitchen-chain-options-ui.js';
import {roomArchitecture} from './kitchen-architecture.js';
export function mountProjectWallOptions(host,{getDoc,apply,focus={}}){
 const walls=roomArchitecture(getDoc().room).walls;
 const label=document.createElement('label');label.textContent='الجدار المقصود';const select=document.createElement('select');
 for(const wall of walls){const o=document.createElement('option');o.value=wall.id;o.textContent=wall.label;select.append(o);}
 const first=focus.wall||getDoc().room.workshop?.activeWall;if(walls.some(w=>w.id===first))select.value=first;
 label.append(select);const pane=document.createElement('div');host.replaceChildren(label,pane);
 const open=()=>{mountWallOptions(pane,{getDoc,apply,wall:select.value});const d=pane.querySelector('details');if(d)d.open=true;};
 select.addEventListener('change',open);open();
 const feature=getDoc().kitchen.features.find(f=>f.id===focus.featureId&&f.wall===select.value);
 const key=feature?.kind==='window'?'curtains/'+feature.id+'/state':feature?.kind==='heater'?'heaters/'+feature.id+'/state':focus.op;
 const lighting=focus.lighting&&pane.querySelector('[data-wall-lights]');
 const segment=lighting&&focus.sectionId&&[...lighting.querySelectorAll('[data-light-segment]')].find(v=>v.dataset.lightSegment===focus.sectionId);
 const control=lighting?(segment||lighting).querySelector('select,input,button'):key&&[...pane.querySelectorAll('[data-op]')].find(v=>v.dataset.op===key&&(v.type!=='radio'||v.checked));
 if(control){for(let p=control.closest('details');p;p=p.parentElement?.closest('details'))p.open=true;
  control.focus({preventScroll:true});control.scrollIntoView?.({block:'nearest'});}
 return ()=>select.removeEventListener('change',open);
}

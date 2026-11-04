import assert from 'node:assert/strict';
import {createShelfPlan,validatePlan} from '../public/shelf-model.js';
import {splitTarget,scopedCells,scopedDividers,contentFor} from '../public/shelf-selection-model.js';
import {groupFinish,effectiveFinish} from '../public/shelf-group-finish.js';
const module=await import('../public/kitchen-scoped-interior-ui.js').catch(()=>({}));
assert.equal(typeof module.mountScopedInterior,'function','An isolated scoped interior mount must be available');
const {mountScopedInterior}=module;
let storageTouches=0;for(const key of ['localStorage','sessionStorage'])Object.defineProperty(globalThis,key,{configurable:true,get(){storageTouches++;throw Error('Scoped interior must never read the old device project');}});
const frames=new Map();let frame=0;globalThis.requestAnimationFrame=fn=>(frames.set(++frame,fn),frame);globalThis.cancelAnimationFrame=id=>frames.delete(id);
const nodes=new Map(),captures=new Set();
class Host{
 constructor(selector){this.selector=selector;this.dataset={};this.attributes={};this.handlers=new Map();this.style={setProperty(){},removeProperty(){}};this.innerHTML='';this.value='';this.hidden=false;}
 setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}removeAttribute(k){delete this.attributes[k];}toggleAttribute(k,v){if(v)this.setAttribute(k,'');else this.removeAttribute(k);}
 addEventListener(type,fn,{signal}={}){if(!this.handlers.has(type))this.handlers.set(type,[]);this.handlers.get(type).push(fn);signal?.addEventListener('abort',()=>this.handlers.set(type,(this.handlers.get(type)||[]).filter(f=>f!==fn)),{once:true});}
 async send(type,e){for(const fn of [...(this.handlers.get(type)||[])])await fn(e);}
 querySelector(s){if(!nodes.has(s))nodes.set(s,new Host(s));return nodes.get(s);}querySelectorAll(){return [];}closest(s){return s.split(',').includes(this.selector)?this:null;}contains(){return true;}remove(){}replaceChildren(){this.innerHTML='';}focus(){}
 setPointerCapture(id){captures.add(id);}hasPointerCapture(id){return captures.has(id);}releasePointerCapture(id){captures.delete(id);}
 getBoundingClientRect(){return {left:0,top:0,right:880,bottom:660,width:880,height:660};}
 createSVGPoint(){return {x:0,y:0,matrixTransform(m){return {x:m.a*this.x+m.e,y:m.d*this.y+m.f};}};}
 getScreenCTM(){const [x,y,w,h]=(this.getAttribute('viewBox')||'0 0 360 260').split(' ').map(Number),s=Math.min(880/w,660/h),e=(880-s*w)/2-x*s,f=(660-s*h)/2-y*s;return {a:s,b:0,d:s,e,f,inverse:()=>({a:1/s,d:1/s,e:-e/s,f:-f/s})};}
}
globalThis.window=new Host('window');globalThis.document=new Host('document');
const host=new Host('host'),svg=host.querySelector('[data-shelf-board]');document.elementFromPoint=()=>svg;
const base=splitTarget(createShelfPlan(),{kind:'cell',key:'1:1'},'row').plan;
const original=groupFinish(groupFinish(base,['1:1/0'],'walnut').plan,['2:2'],'ivory').plan;
assert(validatePlan(original));const before=structuredClone(original);
function freeze(x){if(x&&typeof x==='object'){Object.freeze(x);Object.values(x).forEach(freeze);}}freeze(original);
const notices=[],saves=[];let fail=true,closeCount=0;
const ui=mountScopedInterior(host,{unitId:'unit-1',label:'دولاب قائم',plan:original,role:'factory',tell:t=>notices.push(t),onClose:()=>closeCount++,onSave:async p=>{saves.push(structuredClone(p));if(fail)throw Error('تعذّر الاتصال؛ المسودة باقية');return {ok:true};}});
const click=op=>host.send('click',{target:{dataset:{siOp:op},closest(){return this;}},preventDefault(){}});
const change=(field,value)=>host.send('change',{target:{dataset:{siField:field},value:String(value)}});
const submit=(kind,values={})=>host.send('submit',{target:{dataset:{siForm:kind},elements:{namedItem:k=>({value:String(values[k]??'')})}},preventDefault(){}});
assert.equal(ui.hasPending(),false);assert(host.innerHTML.includes('data-si-canvas'));assert(host.innerHTML.includes('اعتماد التصنيع'));
// Dispatch an actual pointer click to the real canvas, using its SVG matrix.
await click('insert');const cell=scopedCells(before).find(c=>c.key==='0:0'),matrix=svg.getScreenCTM(),point={x:(cell.x+cell.w/2)*matrix.a+matrix.e,y:(cell.y+cell.h/2)*matrix.d+matrix.f};
const pointer=(type,buttons)=>({target:svg,clientX:point.x,clientY:point.y,isPrimary:true,buttons,button:0,pointerType:'mouse',pointerId:42,preventDefault(){},composedPath:()=>[svg]});
await svg.send('pointerdown',pointer('pointerdown',1));await window.send('pointerup',pointer('pointerup',0));assert(ui.hasPending(),'A real pointer click inserts a scoped partition');await click('save');assert.equal(scopedCells(saves.at(-1)).length,scopedCells(before).length+1);await click('undo');assert.equal(ui.hasPending(),false);await click('select');saves.length=0;
await change('cell','1:1/0');await click('add-col');assert(ui.hasPending());await click('save');
assert(ui.hasPending(),'Failed async save keeps the exact draft editable');assert(notices.some(t=>t.includes('تعذّر الاتصال')));
assert.equal(saves.length,1);const split=saves.at(-1);assert(validatePlan(split));assert(split.cellGrids['1:1'].children.find(x=>x.id===0).grid);
assert.equal(effectiveFinish(split,'2:2'),'ivory');assert.equal(effectiveFinish(split,'1:1/0/0'),'walnut');assert.deepEqual(original,before,'Nested server plan is immutable');
await click('undo');assert.equal(ui.hasPending(),false);await click('redo');assert(ui.hasPending());await click('save');assert.deepEqual(saves.at(-1),split,'Redo restores the entire nested plan');
const divider=scopedDividers(split).find(d=>d.owner.key==='1:1/0');assert(divider);
await change('divider',divider.id);await submit('position',{position:divider.cm-split.cab.x+2});await click('save');assert.notDeepEqual(saves.at(-1).cellGrids,split.cellGrids);
assert.deepEqual(saves.at(-1).cab,before.cab);assert.deepEqual(saves.at(-1).wall,before.wall);assert.equal(saves.at(-1).depth,before.depth);
const placed=scopedDividers(saves.at(-1)).find(d=>d.id===divider.id),countBeforeRetry=saves.length;await host.send('input',{target:{form:{dataset:{siForm:'position'}}}});await submit('position',{position:placed.cm-split.cab.x});await click('save');assert.equal(saves.length,countBeforeRetry+1,'Applying an unchanged numeric position does not strand the existing layout draft behind an input-dirty guard');
await change('cell','1:1/0/0');await change('content','boxes');await click('save');assert.equal(contentFor(saves.at(-1),'1:1/0/0'),'boxes');
const count=scopedCells(saves.at(-1)).length;await change('cell','0:0');await submit('equal',{axis:'row',count:2});await click('save');assert.equal(scopedCells(saves.at(-1)).length,count+1);
assert.equal(effectiveFinish(saves.at(-1),'2:2'),'ivory');assert.equal(contentFor(saves.at(-1),'1:1/0/0'),'boxes');
await change('divider',divider.id);await click('remove');await click('save');const remaining=scopedDividers(saves.at(-1));assert(!remaining.some(d=>d.id===divider.id),'Selected nested divider is removed without rebuilding the cabinet');
fail=false;await click('save');assert.equal(ui.hasPending(),false,'Only confirmed save advances the clean baseline');const saved=saves.at(-1);assert(validatePlan(saved));assert.deepEqual(original,before);assert.equal(storageTouches,0);
await click('undo');assert(ui.hasPending(),'Undo after a successful save becomes a new draft');await click('close');assert.equal(closeCount,0);await click('cancel-confirm');assert.equal(closeCount,0);await click('close');await click('confirm-close');assert.equal(closeCount,1);
ui.destroy();const prior=saves.length;await click('save');assert.equal(saves.length,prior);assert.equal(ui.hasPending(),false);
nodes.clear();const invalid=new Host('invalid');const locked=mountScopedInterior(invalid,{unitId:'broken',plan:{...before,cellGrids:{broken:{}}},role:'rep',onSave:()=>{throw Error('Must not save invalid plan');}});assert(invalid.innerHTML.includes('تعذّر فتح'));assert(!invalid.innerHTML.includes('data-si-canvas'));assert.equal(locked.hasPending(),false);locked.destroy();
nodes.clear();const denied=new Host('denied'),readOnly=mountScopedInterior(denied,{unitId:'unit-1',plan:before,role:'store',onSave:()=>{throw Error('Wrong role');}});assert(!denied.innerHTML.includes('data-si-canvas'));readOnly.destroy();
nodes.clear();const delayedHost=new Host('delayed');let resolveSave,delayedCalls=0;const delayed=mountScopedInterior(delayedHost,{unitId:'unit-2',plan:before,role:'rep',onSave:async()=>{delayedCalls++;return new Promise(resolve=>resolveSave=resolve);}});
const press=op=>delayedHost.send('click',{target:{dataset:{siOp:op},closest(){return this;}},preventDefault(){}});await press('add-col');const saving=press('save');assert(delayed.hasPending());await press('add-row');await press('save');assert.equal(delayedCalls,1,'Busy editor ignores duplicate saves and edits');delayed.destroy();resolveSave({ok:true});await saving;assert.equal(delayed.hasPending(),false);assert.equal(delayedHost.innerHTML,'','Late confirmed save never restores a disposed editor');assert.equal(storageTouches,0);
nodes.clear();const recoveryHost=new Host('recovery');let recoveredSaved;
const recovery=mountScopedInterior(recoveryHost,{unitId:'unit-1',plan:before,draftPlan:split,role:'rep',onSave:async plan=>{recoveredSaved=plan;return {ok:true};}});
assert(recovery.hasPending(),'Restored operation plan is compared against authoritative saved baseline');await recoveryHost.send('click',{target:{dataset:{siOp:'save'},closest(){return this;}},preventDefault(){}});assert.deepEqual(recoveredSaved,split);assert.equal(recovery.hasPending(),false);recovery.destroy();
nodes.clear();const mismatchHost=new Host('recovery-mismatch'),wrongBounds={...split,cab:{...split.cab,w:split.cab.w+20}};
const mismatch=mountScopedInterior(mismatchHost,{unitId:'unit-1',plan:before,draftPlan:wrongBounds,role:'rep',onSave:()=>{throw Error('Cannot apply old draft to changed geometry');}});assert.equal(mismatch.hasPending(),false);mismatch.destroy();
console.log('PASS: isolated mounted real shelf canvas preserves nested plans/finishes, edits partitions/content, undo/redo, failed-save retention, recovery against saved baseline, geometry locks, invalid/role lock, and no old device cache access.');

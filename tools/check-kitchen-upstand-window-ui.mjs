import assert from 'node:assert/strict';
import {mountUpstandWindowEditor} from '../public/kitchen-upstand-window-ui.js';
import {worktopUpstandTakeoff} from '../public/kitchen-worktop-upstand.js';

class View{
 markup='';nodes=new Map();kids=[];
 set innerHTML(v){this.markup=v;}get innerHTML(){return this.markup;}
 append(n){this.kids.push(n);}replaceChildren(...kids){this.kids=kids;}remove(){this.removed=true;}
 focus(){}
 querySelector(q){if(!this.nodes.has(q))this.nodes.set(q,new View());return this.nodes.get(q);}
}
globalThis.document={createElement:()=>new View()};
const cat={approved:true,items:[]},ws={upstand:{choice:{mode:'supplier',material:'حجر',minCutHeightMm:40,heightMm:100,thicknessMm:20},walls:{}}};
const run={id:'r',wall:'back',tier:'base',start:20,end:220,depth:60,height:86,bottom:0,worktopThicknessMm:40};
const win=(id,u,bottom)=>({id,kind:'window',wall:'back',u,width:40,bottom,height:100,depth:4});
const project=()=>({room:{width:400,height:280,length:400,workshop:structuredClone(ws)},kitchen:{runs:[run],units:[{id:'a',kind:'storage',u:20,width:200,runId:'r'}],features:[win('left',30,96),win('right',120,96)]}});
let doc=project(),writes=0,savedKey='',messages=[],fail=false;
function mount(windowId,onStrip){
 const host=new View(),take=worktopUpstandTakeoff(doc,cat);
 const ctrl=mountUpstandWindowEditor(host,{getDoc:()=>doc,apply:d=>{if(fail)return {ok:false,reason:'تعذّر الحفظ'};doc=d;writes++;return {ok:true};},tell:v=>messages.push(v),
  focus:{wall:'back',windowId},take,snapshot:doc,catalog:cat,onStrip,onSave:key=>{savedKey=key;}});
 const v=host.kids[0].kids[0];
 function btn(k,data={}){
  let b={dataset:data,closest(q){return q==='button'||q==='[data-window-pick]'&&k==='pick'?b:null;},hasAttribute:n=>n==='data-window-'+k};
  v.onclick({target:b});
 }
 function field(k,value,type='text'){
  const t={dataset:{windowInput:k},value,checked:value,tagName:type==='select'?'SELECT':'INPUT',type,hasAttribute:()=>false};
  if(type==='text')v.oninput({target:t});else v.onchange({target:t});
 }
 const submit=()=>v.onsubmit({preventDefault(){},stopPropagation(){},target:{matches:()=>true}});
 return {host,ctrl,v,btn,field,submit,kind:k=>btn('kind',{windowKind:k}),info:()=>v.querySelector('[data-window-result]').textContent,saving:()=>v.querySelector('[data-window-save]')};
}
let picked;
let ui=mount('right',s=>{picked=s;});
const drawn=ui.v.querySelector('[data-window-elevation]').innerHTML;
const index=drawn.match(/data-window-strip="(\d+)"/)[1];
const strip={closest:q=>q==='[data-window-strip]'?{dataset:{windowStrip:index}}:null};
ui.v.onclick({target:strip});
assert.deepEqual(picked.ref,worktopUpstandTakeoff(doc,cat).segments[Number(index)].ref);
picked=null;let prevented=false;
ui.v.onkeydown({target:strip,key:'Enter',preventDefault(){prevented=true;}});
assert.ok(picked&&prevented);assert.equal(writes,0);
assert.match(ui.v.innerHTML,/data-window-kind="gap"/);
assert.match(ui.v.querySelector('[data-window-elevation]').innerHTML,/data-window-pick="back\/right\/900".*data-window-highlight="true"/);
assert(!ui.v.innerHTML.includes('عمق الامتداد من حافة'));
ui.kind('step');assert(ui.ctrl.hasDraft());assert.match(ui.v.querySelector('[data-window-elevation]').innerHTML,/data-window-envelope/);
assert.equal(ui.saving().textContent,'حفظ الطلب بانتظار التحقق');
ui.btn('pick',{windowPick:'back/left/900'});assert.match(messages.at(-1),/احفظ/);
ui.field('clearance','٥');ui.field('ref','QA-FT1');ui.field('motion','٥٣');ui.field('checked',true,'checkbox');
assert.match(ui.info(),/٤٨ مم/);ui.field('similar',true,'checkbox');assert.match(ui.info(),/٢ من الشبابيك/);
fail=true;ui.submit();assert.equal(writes,0);assert(ui.ctrl.hasDraft());
fail=false;ui.submit();assert.equal(writes,1);assert.equal(savedKey,'back/right/900');
let result=worktopUpstandTakeoff(doc,cat),one=result.windows.find(w=>w.windowId==='right'),two=result.windows.find(w=>w.windowId==='left');
assert.equal(one.effectiveHeightMm,48);assert.equal(two.choice.kind,'step');assert.equal(two.choice.reference,undefined);assert.equal(two.status,'pending');
ui.ctrl.destroy();
ui=mount('right');ui.field('height','٦٠');assert(ui.saving().disabled);ui.submit();assert.equal(writes,1);
ui.btn('discard');assert(!ui.ctrl.hasDraft());ui.kind('gap');doc=structuredClone(doc);ui.submit();assert.equal(writes,1);assert.match(messages.at(-1),/تغيّر/);ui.ctrl.destroy();
doc=project();doc.kitchen.features[0].bottom=90;ui=mount('left');assert.match(ui.v.innerHTML,/data-window-kind="step"[^>]* disabled/);
ui.field('sill',true,'checkbox');assert.match(ui.v.innerHTML,/عمق الامتداد من حافة/);assert.match(ui.v.innerHTML,/data-window-kind="gap" aria-pressed="true"/);
ui.field('depth','٨٠');ui.field('length','٣٢٠');ui.field('inset','١٥');ui.field('sillRef','QA-Sill');ui.field('material','رخام');
ui.field('thickness','٢٠');ui.field('verified',true,'checkbox');ui.submit();assert.equal(writes,2);
result=worktopUpstandTakeoff(doc,cat);assert.equal(result.sills.length,1);assert.equal(result.sills[0].lengthMm,320);
ui.ctrl.destroy();
const absent=new View();mountUpstandWindowEditor(absent,{getDoc:()=>doc,snapshot:doc,apply:()=>{throw Error('read only');},catalog:cat,take:result,focus:{wall:'back',windowId:'retired'}});
assert.match(absent.kids[0].innerHTML,/لا يوجد مقطع/);assert.doesNotMatch(absent.kids[0].innerHTML,/data-window-form/);
console.log('Mounted window treatments on tablet: targeted frame, draft geometry, Arabic dimensions, independent survey proof, protected switching, no invalid or stale writes, flush sill opt-in.');

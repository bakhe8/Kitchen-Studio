import assert from 'node:assert/strict';

let mountDesignerPrecision;
try{({mountDesignerPrecision}=await import('../public/kitchen-designer-precision.js'));}
catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
assert.equal(typeof mountDesignerPrecision,'function','the designer needs a precision controller that feeds its existing width preview');

class Surface{
 listeners=new Map();
 addEventListener(type,fn,options){const list=this.listeners.get(type)||[];list.push({fn,capture:options===true||options?.capture});this.listeners.set(type,list);}
 removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(item=>item.fn!==fn));}
 fire(type,props={}){
  const event={type,pointerId:7,pointerType:'mouse',button:0,isPrimary:true,clientX:100,clientY:50,
   preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.immediateStopped=true;},...props};
  for(const {fn} of [...(this.listeners.get(type)||[])].sort((a,b)=>Number(b.capture)-Number(a.capture))){if(event.immediateStopped)break;fn(event);}
  return event;
 }
 count(){return [...this.listeners.values()].reduce((n,list)=>n+list.length,0);}
}
function fixture(){
 const win=new Surface(),host=new Surface(),scope={},preview=[];
 let enabled=true,inScope=true,editing=false,cancelled=0,step=1,submits=0;
 const input={value:'٦٠٠',isConnected:true,disabled:false,readOnly:false,
  matches:selector=>selector==='input[name="widthMm"]',
  closest:selector=>selector==='.designer-studio'?(inScope?scope:null):selector==='input,button,select,textarea,a,[contenteditable="true"]'?input:null};
 const label={control:input,
  closest:selector=>selector==='.pd-editlabel label'||selector==='label'?label:selector==='.designer-studio'?scope:null,
  setPointerCapture(id){this.captured=id;},hasPointerCapture(id){return this.captured===id;},releasePointerCapture(){delete this.captured;}};
 host.ownerDocument={defaultView:win};host.contains=node=>node===input&&input.isConnected||node===label;
 host.addEventListener('submit',()=>submits++);
 const controller=mountDesignerPrecision(host,{onInput:target=>preview.push(target.value),canEdit:()=>enabled,stepMm:()=>step,isEditing:()=>editing,onCancel:()=>cancelled++});
 const key=(key,extra={})=>host.fire('keydown',{target:input,key,...extra});
 const pointer=(type,x=100,extra={})=>host.fire(type,{target:label,clientX:x,...extra});
 return {win,host,input,label,controller,preview,key,pointer,get cancelled(){return cancelled;},get submits(){return submits;},set enabled(value){enabled=value;},set inScope(value){inScope=value;},set editing(value){editing=value;},set step(value){step=value;}};
}

const f=fixture();
assert(f.key('ArrowUp').defaultPrevented);assert.equal(f.input.value,'601');assert.equal(f.preview.at(-1),'601');
f.key('ArrowDown',{shiftKey:true});assert.equal(f.input.value,'591');
f.input.value='۶۰۰';f.key('ArrowUp');assert.equal(f.input.value,'601');
f.input.value='٠';f.key('ArrowDown');assert.equal(f.input.value,'-1','domain limits remain the parent preview responsibility');
f.step=50;f.input.value='600';f.key('ArrowUp');assert.equal(f.input.value,'650');
f.key('ArrowDown',{shiftKey:true});assert.equal(f.input.value,'150');
f.step=1;
for(const raw of ['', '   ', 'غير صالح', '١٢٫٥', '١٢٬٣', '٤٠٠ ٩٠٠', '9007199254740992']){
 f.input.value=raw;const before=f.preview.length;
 assert(!f.key('ArrowUp').defaultPrevented);f.pointer('pointerdown');f.pointer('pointermove',120);f.pointer('pointerup',120);
 assert.equal(f.input.value,raw);assert.equal(f.preview.length,before,'invalid/blank/non-integer input cannot start precision editing');
}
f.input.value='600';
for(const extra of [{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true}])assert(!f.key('ArrowUp',extra).defaultPrevented);
assert(!f.key('z',{ctrlKey:true}).defaultPrevented);assert(!f.key('z',{metaKey:true}).defaultPrevented);
assert(!f.key('Enter').defaultPrevented,'normal form submission keys remain with their owner');
f.enabled=false;assert(!f.key('ArrowUp').defaultPrevented);f.pointer('pointerdown');f.pointer('pointermove',120);f.pointer('pointerup',120);assert.equal(f.input.value,'600');f.enabled=true;
f.inScope=false;assert(!f.key('ArrowUp').defaultPrevented);f.pointer('pointerdown');f.pointer('pointermove',120);f.pointer('pointerup',120);assert.equal(f.input.value,'600');f.inScope=true;
f.input.readOnly=true;assert(!f.key('ArrowUp').defaultPrevented);f.input.readOnly=false;
f.input.disabled=true;assert(!f.key('ArrowUp').defaultPrevented);f.input.disabled=false;
for(const step of [0,-1,.1,NaN]){f.step=step;assert(!f.key('ArrowUp').defaultPrevented);}f.step=1;

const beforeDirect=f.preview.length;
f.host.fire('pointerdown',{target:f.input});f.host.fire('pointermove',{target:f.input,clientX:130});f.host.fire('pointerup',{target:f.input,clientX:130});
assert.equal(f.preview.length,beforeDirect,'input pointer gestures retain native text selection');
assert(!f.pointer('pointerdown').defaultPrevented);f.pointer('pointermove',104.9);f.pointer('pointerup',104.9);
assert.equal(f.input.value,'600');assert(!f.host.fire('click',{target:f.label}).defaultPrevented,'an ordinary label click keeps default input focus');
f.pointer('pointerdown');assert(f.pointer('pointermove',105).defaultPrevented);assert.equal(f.input.value,'605');
f.pointer('pointermove',112.2);assert.equal(f.input.value,'612');f.pointer('pointerup',112.2);
assert.equal(f.preview.at(-1),'612');assert.equal(f.submits,0);
assert(f.host.fire('click',{target:f.label}).defaultPrevented);assert(!f.host.fire('click',{target:f.label}).defaultPrevented);
f.step=25;f.pointer('pointerdown');f.pointer('pointermove',105.4);assert.equal(f.input.value,'737','fractional pixels still produce whole factory increments');f.pointer('pointercancel');assert.equal(f.input.value,'612');f.step=1;
f.pointer('pointerdown',100,{pointerType:'touch'});f.pointer('pointermove',106,{pointerType:'touch',shiftKey:true});assert.equal(f.input.value,'672');
f.pointer('pointerup',106,{pointerType:'touch',shiftKey:true});assert.equal(f.submits,0,'touch release leaves a preview, never submits it');

for(const end of ['pointercancel','lostpointercapture','escape','blur','second-pointer','stale']){
 f.input.value='٦٧٢';f.pointer('pointerdown');f.pointer('pointermove',115);assert.equal(f.input.value,'687');
 if(end==='escape'){assert(f.key('Escape').defaultPrevented);assert.equal(f.cancelled,0,'scrub cancellation restores an existing typed preview instead of discarding it');}
 else if(end==='blur')f.win.fire('blur');
 else if(end==='second-pointer')f.pointer('pointerdown',150,{pointerId:8,isPrimary:false});
 else if(end==='stale'){f.enabled=false;f.pointer('pointermove',120);f.enabled=true;}
 else f.pointer(end);
 assert.equal(f.input.value,'٦٧٢',end+' restores the original raw text');assert.equal(f.preview.at(-1),'٦٧٢');
 f.pointer('pointerup',120);assert.equal(f.input.value,'٦٧٢');assert.equal(f.label.captured,undefined);
}
f.pointer('pointerdown');f.pointer('pointermove',110,{pointerId:8});assert.equal(f.input.value,'٦٧٢');f.pointer('pointercancel');
f.pointer('pointerdown');f.pointer('pointermove',110);f.key('ArrowUp');assert.equal(f.input.value,'673','a nudge ends an active scrub before stepping from its restored value');
assert(!f.key('Escape').defaultPrevented);f.editing=true;assert(f.key('Escape').defaultPrevented);assert.equal(f.cancelled,1);
f.editing=false;f.input.value='٦٧٣';f.pointer('pointerdown');f.pointer('pointermove',110);
f.controller.destroy();assert.equal(f.input.value,'٦٧٣');assert.equal(f.preview.at(-1),'٦٧٣');
assert.equal(f.host.count(),1,'only the external submit listener remains');assert.equal(f.win.count(),0);assert.equal(f.submits,0);
f.controller.destroy();
console.log('Designer precision: integer Arabic/Persian values, factory-step arrows/scrubbing, opt-in scope, native text gestures, exact interruption rollback, preview cancellation and listener cleanup without submit/save.');

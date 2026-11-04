import {assistNumber} from './kitchen-measurement-identity.js';

// The designer owns preview identity, factory validation and committing. This
// controller edits only its width textbox and reports through the normal input
// path. A cancelled scrub restores even a previously typed, unapplied value.
export function mountDesignerPrecision(host,{onInput,canEdit=()=>true,stepMm=()=>1,isEditing=()=>false,onCancel=()=>{}}){
 let drag=null,suppressed=null;
 const editable=input=>input?.matches?.('input[name="widthMm"]')&&input.closest?.('.designer-studio')&&host.contains(input)&&!input.disabled&&!input.readOnly&&canEdit(input);
 const stepFor=input=>{const step=stepMm(input);return Number.isSafeInteger(step)&&step>0?step:null;};
 const stop=e=>{e.preventDefault?.();e.stopImmediatePropagation?.();};
 function write(input,value){
  if(!Number.isSafeInteger(value))return false;
  const raw=String(value);if(input.value!==raw){input.value=raw;onInput(input);}return true;
 }
 function finish(cancel=false){
  const state=drag;if(!state)return;
  drag=null;
  if(cancel&&state.moved){state.input.value=state.raw;onInput(state.input);}
  if(state.moved)suppressed={label:state.label,input:state.input,until:Date.now()+700};
  try{if(state.label.hasPointerCapture?.(state.id))state.label.releasePointerCapture(state.id);}catch{/* detached label */}
 }
 function keydown(e){
  if(e.isComposing)return;
  if(e.key==='Escape'&&drag){finish(true);stop(e);return;}
  const input=e.target;if(!editable(input))return;
  if(e.key==='Escape'&&isEditing(input)){stop(e);onCancel(input);return;}
  if(!['ArrowUp','ArrowDown'].includes(e.key)||e.ctrlKey||e.metaKey||e.altKey)return;
  if(drag)finish(true);
  const value=assistNumber(input.value),step=stepFor(input);
  if(!Number.isSafeInteger(value)||!step)return;
  if(write(input,value+(e.key==='ArrowUp'?1:-1)*step*(e.shiftKey?10:1)))stop(e);
 }
 function down(e){
  suppressed=null;
  if(drag){if(e.pointerId!==drag.id)finish(true);return;}
  if(e.button!==0||e.isPrimary===false||e.ctrlKey||e.metaKey||e.altKey||e.target?.closest?.('input,button,select,textarea,a,[contenteditable="true"]'))return;
  const label=e.target?.closest?.('.pd-editlabel label');if(!label)return;
  const input=label.control||label.closest?.('.pd-dimform')?.querySelector?.('input[name="widthMm"]');
  if(!editable(input)||label.closest?.('.designer-studio')!==input.closest('.designer-studio')||!Number.isFinite(e.clientX))return;
  const value=assistNumber(input.value),step=stepFor(input);if(!Number.isSafeInteger(value)||!step)return;
  drag={input,label,value,step,raw:input.value,id:e.pointerId,x:e.clientX,moved:false};
  try{label.setPointerCapture?.(e.pointerId);}catch{/* pointer already ended */}
 }
 function move(e){
  if(!drag||drag.id!==e.pointerId)return;
  if(!editable(drag.input)||e.type==='pointermove'&&e.buttons!=null&&e.buttons!==1){finish(true);return;}
  const delta=e.clientX-drag.x;if(!Number.isFinite(delta)||!drag.moved&&Math.abs(delta)<5)return;
  const pixels=Math.sign(delta)*Math.round(Math.abs(delta));
  drag.moved=true;write(drag.input,drag.value+pixels*drag.step*(e.shiftKey?10:1));stop(e);
 }
 function up(e){
  if(!drag||drag.id!==e.pointerId)return;
  move(e);const moved=drag?.moved;finish();if(moved)stop(e);
 }
 function cancel(e){if(drag?.id===e.pointerId)finish(true);}
 function lost(e){if(drag?.id===e.pointerId&&e.target===drag.label)finish(true);}
 function click(e){
  if(!suppressed||Date.now()>suppressed.until)return;
  if(e.target===suppressed.input||e.target?.closest?.('label')===suppressed.label){suppressed=null;stop(e);}
 }
 const events={keydown,pointerdown:down,pointermove:move,pointerup:up,pointercancel:cancel,lostpointercapture:lost,click};
 for(const [type,fn] of Object.entries(events))host.addEventListener(type,fn,true);
 const win=host.ownerDocument?.defaultView,blur=()=>finish(true);win?.addEventListener?.('blur',blur);
 return {cancel:()=>finish(true),destroy(){finish(true);suppressed=null;for(const [type,fn] of Object.entries(events))host.removeEventListener(type,fn,true);win?.removeEventListener?.('blur',blur);}};
}

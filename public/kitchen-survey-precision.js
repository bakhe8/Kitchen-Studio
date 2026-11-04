import {assistNumber} from './kitchen-measurement-identity.js';

// Precision changes feed the owner's normal field-input path. A drag only
// changes its provisional value; the owner's existing confirmation still wins.
export function mountSurveyPrecision(host,{onInput,beginScrub,canEdit=()=>true}){
 let drag=null,suppressed=null;
 const clean=n=>Math.round(n*1e6)/1e6;
 const usable=input=>input?.closest?.('.sv-notebook')&&host.contains(input)&&!input.disabled&&!input.readOnly&&canEdit(input);
 const stop=e=>{e.preventDefault?.();e.stopImmediatePropagation?.();};
 function write(input,value){
  if(!Number.isFinite(value))return false;
  input.value=String(clean(value));onInput(input);return true;
 }
 function release(state){
  try{if(state.label.hasPointerCapture?.(state.id))state.label.releasePointerCapture(state.id);}catch{/* detached label */}
 }
 function finish(cancel=false){
  const state=drag;if(!state)return;
  drag=null;
  if(cancel&&state.moved)state.restore();
  if(state.moved)suppressed={label:state.label,input:state.input,id:state.id,until:Date.now()+700};
  release(state);
 }
 function keydown(e){
  if(e.isComposing)return false;
  if(e.key==='Escape'&&drag){finish(true);stop(e);return true;}
  const input=e.target;
  if(!['ArrowUp','ArrowDown'].includes(e.key)||e.ctrlKey||e.metaKey||e.altKey||!input?.hasAttribute?.('data-ink-value')||!usable(input))return false;
  if(drag)finish(true);
  const value=assistNumber(input.value);
  if(!Number.isFinite(value))return false;
  if(!write(input,value+(e.key==='ArrowUp'?1:-1)*(e.shiftKey?10:1)))return false;
  stop(e);return true;
 }
 function down(e){
  suppressed=null;
  if(drag){if(e.pointerId!==drag.id)finish(true);return;}
  if(e.button!==0||e.isPrimary===false||e.ctrlKey||e.metaKey||e.altKey||e.target?.closest?.('input,button,select,textarea,a'))return;
  const label=e.target?.closest?.('label'),input=label?.querySelector?.('[data-ink-value]');
  if(!usable(input)||!Number.isFinite(e.clientX))return;
  const value=assistNumber(input.value);if(!Number.isFinite(value))return;
  const restore=beginScrub(input);if(typeof restore!=='function')return;
  drag={label,input,value,restore,id:e.pointerId,x:e.clientX,moved:false};
  try{label.setPointerCapture?.(e.pointerId);}catch{/* pointer may already have ended */}
 }
 function move(e){
  if(!drag||e.pointerId!==drag.id)return;
  if(!usable(drag.input)){finish(true);return;}
  if(!Number.isFinite(e.clientX))return;
  const delta=e.clientX-drag.x;
  if(!drag.moved&&Math.abs(delta)<5)return;
  drag.moved=true;
  write(drag.input,drag.value+delta*(e.shiftKey?.1:1));stop(e);
 }
 function up(e){
  if(!drag||e.pointerId!==drag.id)return;
  move(e);const moved=drag?.moved;finish();if(moved)stop(e);
 }
 function cancel(e){if(drag?.id===e.pointerId)finish(true);}
 function lost(e){if(drag?.id===e.pointerId&&e.target===drag.label)finish(true);}
 function click(e){
  const state=suppressed;
  if(!state||Date.now()>state.until)return;
  if(e.target===state.input||e.target?.closest?.('label')===state.label){suppressed=null;stop(e);}
 }
 const events={pointerdown:down,pointermove:move,pointerup:up,pointercancel:cancel,lostpointercapture:lost,click};
 for(const [type,fn] of Object.entries(events))host.addEventListener(type,fn,true);
 const win=host.ownerDocument?.defaultView,blur=()=>finish(true);win?.addEventListener?.('blur',blur);
 return {keydown,cancel:()=>finish(true),destroy(){finish(true);suppressed=null;for(const [type,fn] of Object.entries(events))host.removeEventListener(type,fn,true);win?.removeEventListener?.('blur',blur);}};
}

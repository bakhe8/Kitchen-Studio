// One primary pointer draws on the measured face. Pixel positions are schematic;
// the caller owns exact values, confirmation and writing to the survey.
import {horizontalWallInkStroke} from './kitchen-wall-ink-model.js';
import {suggestWallOpening} from './kitchen-wall-ink-recognition.js';

const ns='http://www.w3.org/2000/svg';
const arabic=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:0});
const points=new Set(['water','drain','electric','gas','vent']);
const markers=new Set(['start','stop','corner']);
const pen=kind=>kind==='auto'||kind==='pen';
const bounded=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const approx=n=>arabic.format(Math.round(n/10)*10);

function plateBounds(svg){
 const d=svg.dataset,left=Number(d.inkLeft),top=Number(d.inkTop);
 const width=Number(d.inkWidth),height=Number(d.inkHeight),wall=Number(d.inkWallMm),ceiling=Number(d.inkHeightMm);
 if(!Number.isFinite(left+top+width+height+wall+ceiling)||Math.min(width,height,wall,ceiling)<=0)return null;
 return {left,top,width,height,wall,ceiling};
}

// Use the actual rendered viewBox transform. Screen-to-client subtraction alone
// is wrong when the SVG is letterboxed, scrolled or scaled by an ancestor.
export function wallInkPoint(svg,clientX,clientY,clampOutside=false){
 const b=plateBounds(svg),matrix=svg.getScreenCTM?.();
 if(!b||!matrix||!Number.isFinite(clientX+clientY))return null;
 const p=svg.createSVGPoint();p.x=clientX;p.y=clientY;
 let q;try{q=p.matrixTransform(matrix.inverse());}catch{return null;}
 if(!Number.isFinite(q.x+q.y))return null;
 const u=(q.x-b.left)/b.width,v=1-(q.y-b.top)/b.height,eps=1e-7;
 if(!clampOutside&&(u< -eps||u>1+eps||v< -eps||v>1+eps))return null;
 return {xMm:bounded(u,0,1)*b.wall,zMm:bounded(v,0,1)*b.ceiling};
}

function add(layer,tag,props,text){
 const el=layer.ownerDocument.createElementNS(ns,tag);
 for(const [k,v] of Object.entries(props))el.setAttribute(k,v);
 if(text!==undefined)el.textContent=text;
 layer.append(el);return el;
}
function ghost(stroke){
 const {svg,layer,start,end,dragged,kind}=stroke,b=plateBounds(svg);
 if(!b)return;
 const X=x=>b.left+x*b.width/b.wall,Y=z=>b.top+b.height-z*b.height/b.ceiling;
 const guessed=pen(kind)&&dragged?suggestWallOpening(start,end,b.ceiling):kind;
 layer.replaceChildren();
 const cross=(x,y)=>add(layer,'path',{class:'w-ink-cross',d:`M${x-7} ${y}h14 M${x} ${y-7}v14`});
 const guideline=(x,y,dx,dy)=>add(layer,'path',{class:'w-ink-guide',d:`M${x} ${y}l${dx} ${dy}`});
 let label='';
 if(dragged&&!points.has(guessed)&&!markers.has(guessed)){
  const left=Math.min(start.xMm,end.xMm),right=Math.max(start.xMm,end.xMm);
  const top=Math.max(start.zMm,end.zMm),low=Math.min(start.zMm,end.zMm),bottom=guessed==='door'?0:low;
  const snap=(v,max)=>Math.min(max,Math.round(v/10)*10);
  const width=snap(right,b.wall)-snap(left,b.wall),high=snap(top,b.ceiling);
  const level=horizontalWallInkStroke(width,snap(low,b.ceiling),high),vertical=width<10&&!level;
  if(vertical){
   add(layer,'path',{class:'w-ink-cross',d:`M${X(left)} ${Y(bottom)}V${Y(top)}`});
   for(const y of [Y(bottom),Y(top)])add(layer,'path',{class:'w-ink-cross',d:`M${X(left)-4} ${y}h8`});
  }else if(level){
   // A sideways stroke supplies only the width. Its proposed height comes
   // from the editable preset, not a 0-mm measurement from this line.
   add(layer,'path',{class:'w-ink-cross',d:`M${X(left)} ${Y(top)} H${X(right)}`});
   for(const x of [X(left),X(right)])add(layer,'path',{class:'w-ink-cross',d:`M${x} ${Y(top)-4}v8`});
  }else add(layer,'rect',{class:'w-ink-preview',x:X(left),y:Y(top),width:X(right)-X(left),height:Y(bottom)-Y(top)});
  for(const x of [X(left),X(right)])guideline(x,Y(top),0,Y(0)-Y(top));
  const name=pen(kind)?(guessed==='door'?'باب':'شباك')+' · ':'';
  const height=high-snap(bottom,b.ceiling);
  label=name+(vertical?'ارتفاع ≈ '+arabic.format(height):level?'عرض ≈ '+arabic.format(width):'≈ '+arabic.format(width)+' × '+arabic.format(height))+' مم';
 }else{
  const x=X(end.xMm),y=Y(end.zMm);
  guideline(b.left,y,x-b.left,0);guideline(x,y,0,Y(0)-y);cross(x,y);
  if(markers.has(guessed))guideline(x,b.top,0,b.height);
  label='≈ '+approx(end.xMm)+' مم من الركن';
 }
 const caption=add(layer,'text',{class:'w-ink-caption',x:b.left+b.width/2,y:b.top-8,'text-anchor':'middle',direction:'rtl'},label);
 caption.setAttribute('aria-hidden','true');
}

// Moving an existing reading adjusts only one actual tape measure. Openings
// measured from the opposite corner have a reversed far-edge datum.
function adjustment(s){
 const {row}=s.hit,dx=s.end.xMm-s.start.xMm,dz=s.end.zMm-s.start.zMm;
 const vertical=s.key?['heightMm','bottomMm'].includes(s.key):
   !markers.has(row.kind)&&row.kind!=='door'&&Math.abs(dz)>Math.abs(dx);
 const key=s.key||(vertical?'bottomMm':'gapMm'),opposite=key==='frameDistance'&&row.frameRead?.method==='opposite';
 const old=key==='frameDistance'?row.frameRead?.distanceMm:row[key];
 if(!Number.isFinite(old))return null;
 const delta=Math.round((vertical?dz:dx)*(opposite?-1:1)/10)*10;
 return {key,old,value:old+delta};
}
function movement(s){
 return {dx:Math.round((s.end.xMm-s.start.xMm)/10)*10,
  dz:markers.has(s.hit.row.kind)||s.hit.row.kind==='door'?0:Math.round((s.end.zMm-s.start.zMm)/10)*10};
}
function adjustGhost(s){
 const a=adjustment(s);if(!a)return;
 const {row,stationMm,widthMm}=s.hit,b=plateBounds(s.svg);
 const X=x=>b.left+x*b.width/b.wall,Y=z=>b.top+b.height-z*b.height/b.ceiling;
 const move=s.moving?movement(s):null,change=a.value-a.old,start=stationMm+(move?move.dx:a.key==='gapMm'?change:0);
 const width=move?widthMm:widthMm+(a.key==='frameDistance'&&row.frameRead?.method==='opposite'?-change:
   ['frameDistance','widthMm'].includes(a.key)?change:a.key==='gapMm'&&row.frameRead?-change:0);
 const bottom=(row.bottomMm||0)+(move?move.dz:a.key==='bottomMm'?change:0),height=(row.heightMm||0)+(!move&&a.key==='heightMm'?change:0);
 s.layer.replaceChildren();
 if(points.has(row.kind)){
  add(s.layer,'circle',{class:'w-ink-preview',cx:X(start),cy:Y(bottom),r:5});
 }else if(markers.has(row.kind)){
  add(s.layer,'path',{class:'w-ink-cross',d:`M${X(start)} ${b.top}v${b.height}`});
 }else if(Number.isFinite(width)&&width>0&&height>0){
  add(s.layer,'rect',{class:'w-ink-preview',x:X(start),y:Y(bottom+height),width:width*b.width/b.wall,height:height*b.height/b.ceiling});
 }
 const labels={gapMm:'المسافة',widthMm:'العرض',heightMm:'الارتفاع',bottomMm:points.has(row.kind)?'ارتفاع المركز':'ارتفاع الأسفل',frameDistance:'قياس البرواز'};
 const x=bounded(X(s.end.xMm),b.left+b.width*.2,b.left+b.width*.8),y=bounded(Y(s.end.zMm)-12,b.top+15,b.top+b.height-3);
 add(s.layer,'text',{class:'w-ink-caption',x,y,'text-anchor':'middle',direction:'rtl'},move?'الموضع ≈ '+arabic.format(start)+' مم':labels[a.key]+' ≈ '+arabic.format(a.value)+' مم');
}
export function mountWallInkGestures(host,{getTool,onGesture,readHit,onAdjust,onMove,onResize,allowBlank}){
 let stroke=null,blockClick=null;
 function cancel(){
  const s=stroke;if(!s)return;
  stroke=null;s.layer?.remove();
  try{if(s.svg.hasPointerCapture?.(s.id))s.svg.releasePointerCapture(s.id);}catch{/* Finished or detached. */}
 }
 function capture(s){try{s.svg.setPointerCapture(s.id);}catch{/* Mouse without capture still works inside the sheet. */}}
 function down(e){
  blockClick=null;
  if(stroke){if(e.pointerId!==stroke.id&&e.pointerType==='touch')cancel();return;}
  if(e.isPrimary===false||e.button!==0)return;
  const kind=getTool(),svg=e.target.closest?.('svg.survey-wall-sheet');
  if(!kind||!svg||!host.contains(svg)||host.querySelector?.('[data-pair-editor]')||e.target.closest('[data-survey-pair]')||e.target.closest('[data-ink-edit]'))return;
  const item=e.target.closest('[data-chain-hit]'),dimension=e.target.closest('[data-chain-focus]');
  const existing=!!item&&!!(readHit||pen(kind)||dimension);
  if(!existing&&allowBlank&&!allowBlank())return;
  const token=item?.dataset?.chainHit;
  const hit=existing?readHit?.(String(token).startsWith('cad:')?token:Number(token)):null;
  if(dimension&&!hit||existing&&readHit&&!hit)return;
  const start=wallInkPoint(svg,e.clientX,e.clientY,!!dimension);if(!start)return;
  const layer=add(svg,'g',{'data-wall-ink-ghost':'','aria-hidden':'true','pointer-events':'none'});
  stroke={svg,layer,id:e.pointerId,kind,start,end:start,existing,hit,moving:!!(hit&&!dimension&&onMove),resizing:!!dimension?.hasAttribute?.('data-size-grip'),key:dimension?.dataset?.chainFocus,dragged:false,clientX:e.clientX,clientY:e.clientY};
  // Browsers can retarget the click to the capturing element. Delay capture on
  // a saved item until the pointer actually draws, preserving its normal click.
  if(!existing){capture(stroke);e.preventDefault();ghost(stroke);}
 }
 function update(s,e){
  if(!host.contains(s.svg)||getTool()!==s.kind){cancel();return false;}
  const end=wallInkPoint(s.svg,e.clientX,e.clientY,true);
  if(!end){cancel();return false;}
  // Classification is in CSS pixels and is independent of wall size or zoom.
  if(!s.dragged&&Math.hypot(e.clientX-s.clientX,e.clientY-s.clientY)>=6){
   s.dragged=true;
   if(s.existing)capture(s);
  }
  s.end=end;return true;
 }
 function move(e){
  const s=stroke;if(!s||s.id!==e.pointerId||!update(s,e))return;
  if(!s.existing||s.dragged){e.preventDefault();if(s.hit)adjustGhost(s);else ghost(s);}
 }
 function up(e){
  const s=stroke;if(!s||s.id!==e.pointerId||!update(s,e))return;
  cancel();
  if(s.existing&&!s.dragged)return;
  e.preventDefault();blockClick={id:e.pointerId,expires:Date.now()+600};
  if(s.moving){const {dx,dz}=movement(s);if(dx||dz)onMove(s.hit,dx,dz);return;}
  if(s.hit){
   const a=adjustment(s);
   if(a&&a.old!==a.value){if(s.resizing&&onResize)onResize(s.hit,a.key,a.value);else onAdjust?.(s.hit,a.key,a.value);}
   return;
  }
  onGesture({kind:s.kind,start:s.start,end:s.end,dragged:s.dragged,tap:!s.dragged});
 }
 function lost(e){
  const s=stroke;if(!s||s.id!==e.pointerId)return;
  // Touch implicitly captures the original shape. Transferring capture to the
  // SVG for a drag can dispatch a loss on that old child, not on the sheet.
  if(e.type==='lostpointercapture'&&e.target!==s.svg&&s.svg.hasPointerCapture?.(s.id))return;
  cancel();
 }
 function key(e){
  if(e.key==='Escape'&&stroke){cancel();e.preventDefault();e.stopPropagation();}
 }
 function click(e){
  if(!blockClick||e.detail===0||Date.now()>blockClick.expires)return;
  if(e.pointerId!=null&&e.pointerId!==blockClick.id&&e.pointerId!==-1)return;
  blockClick=null;e.stopImmediatePropagation();e.preventDefault();
 }
 function leave(e){const s=stroke;if(s&&e.pointerId===s.id&&!s.svg.hasPointerCapture?.(s.id))cancel();}
 host.addEventListener('pointerdown',down);host.addEventListener('pointermove',move);host.addEventListener('pointerup',up);
 host.addEventListener('pointercancel',lost);host.addEventListener('lostpointercapture',lost);
 host.addEventListener('pointerleave',leave);host.addEventListener('keydown',key,true);host.addEventListener('click',click,true);
 const dispose=()=>{
  cancel();blockClick=null;
  host.removeEventListener('pointerdown',down);host.removeEventListener('pointermove',move);host.removeEventListener('pointerup',up);
  host.removeEventListener('pointercancel',lost);host.removeEventListener('lostpointercapture',lost);
  host.removeEventListener('pointerleave',leave);host.removeEventListener('keydown',key,true);host.removeEventListener('click',click,true);
 };
 dispose.cancel=cancel;dispose.inProgress=()=>!!stroke;
 return dispose;
}

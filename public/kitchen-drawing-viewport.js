// The camera changes only the SVG viewBox. Hit testing, rulers and drag handles
// continue to use the same inverse screen transform as the visible drawing.
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const center=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function screenPoint(svg,x,y){
 try{
  const matrix=svg.getScreenCTM?.();if(!matrix)return null;
  const p=svg.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(matrix.inverse());
  return Number.isFinite(q.x+q.y)?q:null;
 }catch{return null;}
}
function readBox(v){
 const a=Array.isArray(v)?v:String(v??'').trim().split(/[\s,]+/).map(Number);
 return a.length===4&&a.every(Number.isFinite)&&a[2]>0&&a[3]>0?a:null;
}
export function mountDrawingViewport(host,{getSvg,cancelGesture=()=>{},canNavigate=()=>true,onZoom=()=>{},onViewChange=()=>{}}){
 const win=host.ownerDocument?.defaultView,cleanup=[],touches=new Map();
 let base,viewKey,svg,lastBox='',camera={zoom:1,x:.5,y:.5},pan=null,pinch=null,ignoreTouch=false,blockClickUntil=0;
 function on(node,type,fn,options){node?.addEventListener?.(type,fn,options);cleanup.push(()=>node?.removeEventListener?.(type,fn,options));}
 function display(){
  if(!base||!svg)return;
  const [x,y,w,h]=base,W=w/camera.zoom,H=h/camera.zoom;
  lastBox=[x+w*camera.x-W/2,y+h*camera.y-H/2,W,H].join(' ');
  svg.setAttribute('viewBox',lastBox);
  onViewChange();
 }
 function sync(node,box,key){
  if(node&&node===svg&&key===viewKey&&String(box)===lastBox)return;
  const next=readBox(box);if(!node||!next)return;
  if(!node.hasAttribute?.('tabindex')&&node.getAttribute?.('tabindex')==null)node.setAttribute('tabindex','0');
  if(key!==viewKey){cancelNavigation();camera={zoom:1,x:.5,y:.5};viewKey=key;}
  svg=node;base=next;display();
 }
 function reset(){const changed=camera.zoom!==1;camera={zoom:1,x:.5,y:.5};display();if(changed)onZoom(1);}
 function centerOn(anchor,at,zoom){
  if(!base||!anchor||!at)return;
  const [x,y,w,h]=base,current=camera.zoom;
  const ratio=current/zoom;
  camera={zoom,x:clamp((anchor.x-x)/w-((at.x-x)/w-camera.x)*ratio,-.25,1.25),
   y:clamp((anchor.y-y)/h-((at.y-y)/h-camera.y)*ratio,-.25,1.25)};
  display();if(zoom!==current)onZoom(zoom);
 }
 function zoomBy(factor,anchor){
  if(!base||!Number.isFinite(factor)||factor<=0)return;
  const p=anchor||{x:base[0]+camera.x*base[2],y:base[1]+camera.y*base[3]};
  centerOn(p,p,clamp(camera.zoom*factor,.5,12));
 }
 function inside(e){return svg&&getSvg()===svg&&(svg===e.target||svg.contains?.(e.target));}
 function stop(e){e.preventDefault?.();e.stopImmediatePropagation?.();}
 function wheel(e){
  if(!inside(e)||!canNavigate()||pan||pinch||e.ctrlKey||e.metaKey||e.altKey||!Number.isFinite(e.deltaY)||!e.deltaY)return;
  const p=screenPoint(svg,e.clientX,e.clientY);if(!p)return;
  const d=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?(svg.getBoundingClientRect?.().height||400):1);
  stop(e);zoomBy(Math.exp(clamp(-d*.002,-1,1)),p);
 }
 function capture(id){try{host.setPointerCapture?.(id);}catch{/* pointer already ended */}}
 function release(id){try{if(host.hasPointerCapture?.(id))host.releasePointerCapture(id);}catch{/* detached host */}}
 function cancelNavigation(){
  const ids=[...touches.keys()];if(pan)ids.push(pan.id);
  pan=null;pinch=null;ignoreTouch=false;touches.clear();if(svg?.dataset)delete svg.dataset.drawingPanning;
  ids.forEach(release);
 }
 function down(e){
  if(!inside(e))return;
  blockClickUntil=0;
  if(e.pointerType==='touch'){
   touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(touches.size===1)return;
   if(touches.size!==2||ignoreTouch){stop(e);return;}
   cancelGesture();if(!canNavigate())return;
   const [a,b]=touches.values(),mid=center(a,b),anchor=screenPoint(svg,mid.x,mid.y);
   if(!anchor)return;
   pinch={anchor,span:Math.max(1,distance(a,b)),zoom:camera.zoom};ignoreTouch=true;
   touches.forEach((_,id)=>capture(id));stop(e);return;
  }
  if(e.button!==1||e.ctrlKey||e.metaKey||e.altKey||!canNavigate())return;
  const anchor=screenPoint(svg,e.clientX,e.clientY);if(!anchor)return;
  cancelGesture();pan={id:e.pointerId,anchor};capture(e.pointerId);
  if(svg.dataset)svg.dataset.drawingPanning='true';stop(e);
 }
 function move(e){
  if(pan?.id===e.pointerId){
   if(!(e.buttons&4)){cancelNavigation();return;}
   centerOn(pan.anchor,screenPoint(svg,e.clientX,e.clientY),camera.zoom);stop(e);return;
  }
  if(!touches.has(e.pointerId))return;
  touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(!ignoreTouch)return;
  stop(e);
  if(!pinch||touches.size!==2)return;
  const [a,b]=touches.values(),mid=center(a,b),at=screenPoint(svg,mid.x,mid.y);
  centerOn(pinch.anchor,at,clamp(pinch.zoom*distance(a,b)/pinch.span,.5,12));
 }
 function end(e){
  if(pan?.id===e.pointerId){cancelNavigation();stop(e);return;}
  if(!touches.delete(e.pointerId))return;
  if(ignoreTouch){
   pinch=null;blockClickUntil=Date.now()+700;release(e.pointerId);stop(e);
   if(!touches.size)ignoreTouch=false;
  }
 }
 function lost(e){if(e.target===host&&(pan?.id===e.pointerId||ignoreTouch&&touches.has(e.pointerId))&&!host.hasPointerCapture?.(e.pointerId))end(e);}
 on(host,'wheel',wheel,{capture:true,passive:false});on(host,'pointerdown',down,true);
 on(host,'pointermove',move,true);on(host,'pointerup',end,true);on(host,'pointercancel',end,true);on(host,'lostpointercapture',lost,true);
 // An untouched finger without capture can leave the surface before it lifts.
 on(win,'pointerup',e=>{if(!ignoreTouch)touches.delete(e.pointerId);});
 on(win,'pointercancel',e=>{if(!ignoreTouch)touches.delete(e.pointerId);});
 on(host,'keydown',e=>{
  if(e.target!==svg||e.ctrlKey||e.metaKey||e.altKey||!canNavigate())return;
  if(e.key==='+'||e.key==='=')zoomBy(1.3);else if(e.key==='-')zoomBy(1/1.3);else if(e.key==='0'||e.key==='٠')reset();else return;
  stop(e);
 },true);
 on(host,'click',e=>{
  if(blockClickUntil&&Date.now()<blockClickUntil&&e.detail!==0){blockClickUntil=0;stop(e);}
 },true);
 on(host,'auxclick',e=>{if(e.button===1&&inside(e))stop(e);},true);
 on(win,'blur',cancelNavigation);
 function restoreCamera(saved){
  if(!base||!saved||![saved.zoom,saved.x,saved.y].every(Number.isFinite))return;
  camera={zoom:clamp(saved.zoom,.5,12),x:clamp(saved.x,-.25,1.25),y:clamp(saved.y,-.25,1.25)};
  display();onZoom(camera.zoom);
 }
 return {sync,reset,zoomBy,readCamera:()=>({...camera}),restoreCamera,destroy(){cancelNavigation();cleanup.forEach(f=>f());}};
}

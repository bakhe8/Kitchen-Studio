// Direct manipulation of the survey *draft*. Geometry remains in centimetres;
// the form's apply operation, and all validation of the finished room, live
// with its caller. This module never replaces the SVG that owns pointer capture.
import {roomArchitecture} from './kitchen-architecture.js';
const NS='http://www.w3.org/2000/svg',mm=n=>Math.round(n*10),fmt=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2});
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(x,hi));
export function surveyHandleGeometry(room,width=room.architecture?.cut?.width,depth=room.architecture?.cut?.depth){
 const c=room.architecture?.cut;if(!c||!['notch','chamfer','taper'].includes(c.kind)||!Number.isFinite(width))return null;
 const W=room.width,L=room.length,sx=c.corner.endsWith('-left')?1:-1,sz=c.corner.startsWith('back-')?1:-1,x=sx===1?0:W,z=sz===1?0:L;
 const val=(n,max)=>clamp(mm(n),1,Math.floor((max-.1+1e-8)*10))/10;
 width=val(width,W);depth=c.kind==='taper'?L:val(depth,L);
 return {width,depth,sx,sz,widthAt:{x:x+width*sx,z},depthAt:c.kind==='taper'?null:{x,z:z+depth*sz}};
}
const bindings=new WeakMap();
export function wireSurveySketch(host,{room,onDraft=()=>{},onFinish=()=>{}}={}){
 const empty={destroy(){}},svg=host?.matches?.('svg')?host:host?.querySelector?.('svg.survey-sketch')||host?.querySelector?.('svg');
 if(!svg)return empty;bindings.get(svg)?.destroy();let state=room&&surveyHandleGeometry(room);if(!state)return empty;
 const rect=svg.querySelector('[data-survey-envelope]')||svg.querySelector('rect[x][y][width][height]'),outline=svg.querySelector('[data-survey-outline]')||svg.querySelector('polygon'),area=svg.querySelector('[data-survey-area]')||svg.querySelector('text[font-weight="bold"]');
 if(!rect||!outline||!svg.ownerDocument?.createElementNS)return empty;
 const ox=Number(rect.getAttribute('x')),oz=Number(rect.getAttribute('y')),sx=Number(rect.getAttribute('width'))/room.width,sz=Number(rect.getAttribute('height'))/room.length;
 if(!(sx>0&&sz>0))return empty;
 const c=room.architecture.cut,doc=svg.ownerDocument,win=doc.defaultView,origRole=svg.getAttribute('role'),format=(v)=>fmt.format(mm(v))+' مم',axes=state.depthAt?['width','depth']:['width'],parts={};
 const project=p=>[ox+p.x*sx,oz+p.z*sz],el=(tag,attrs,parent)=>{const n=doc.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));parent.appendChild(n);return n;};
 const local=e=>{const m=svg.getScreenCTM?.();if(!m)return null;const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;try{const q=p.matrixTransform(m.inverse());return Number.isFinite(q.x+q.y)?q:null;}catch{return null;}};
 const root=el('g',{'data-survey-handles':'',role:'group','aria-label':'اسحب المقابض لضبط مقاس القطع، أو استخدم حقول المقاسات.'},svg);
 svg.setAttribute('role','group');
 const listeners=[];function listen(node,k,fn,opt){node?.addEventListener(k,fn,opt);listeners.push(()=>node?.removeEventListener(k,fn,opt));}
 let live=null,dead=false;
 const nameOf=ax=>ax==='width'?(c.kind==='taper'?'فرق العرض بين الطرفين':'عرض قطع الركن'):'عمق قطع الركن';
 for(const ax of axes){
  const g=el('g',{'data-survey-handle':ax,role:'slider',tabindex:0,'aria-label':nameOf(ax),'aria-orientation':ax==='width'?'horizontal':'vertical','aria-valuemin':'1','aria-valuemax':Math.floor(((ax==='width'?room.width:room.length)-.1+1e-8)*10),style:'touch-action:none;cursor:'+(ax==='width'?'ew-resize':'ns-resize')},root);
  const title=el('title',{},g);title.textContent='اسحب لتعديل '+nameOf(ax);
  const stem=el('line',{stroke:'#315e52','stroke-width':1.45,'pointer-events':'none'},g),center=el('circle',{r:2.5,fill:'#ffffff',stroke:'#236957','stroke-width':1.3,'pointer-events':'none'},g);
  const knob=el('g',{},g);el('circle',{r:13.5,fill:'transparent'},knob);el('circle',{r:7.3,fill:'#226657',stroke:'#fffdf2','stroke-width':1.8},knob);
  el('path',{d:ax==='width'?'M-4 0H4M-4 0l1.8-1.9m-1.8 1.9 1.8 1.9M4 0 2.2-1.9M4 0 2.2 1.9':'M0 -4V4M0 -4l-1.9 1.8M0 -4l1.9 1.8M0 4-1.9 2.2M0 4l1.9-1.8',fill:'none',stroke:'#fff','stroke-width':1.2,'stroke-linejoin':'round','stroke-linecap':'round','pointer-events':'none'},knob);
  parts[ax]={g,knob,center,stem};
 }
 function paint(shape=true){
  if(shape){
   const next={...room,architecture:{...room.architecture,cut:{...c,width:state.width,depth:state.depth}}},a=roomArchitecture(next);
   outline.setAttribute('points',a.polygon.map(p=>project(p).join(',')).join(' '));if(area)area.textContent=fmt.format(a.area/10000)+' م²';
  }
  for(const ax of axes){const {g,knob,stem,center}=parts[ax],[x,y]=project(state[ax+'At']),gx=x-(ax==='depth'?state.sx*12:0),gy=y-(ax==='width'?state.sz*12:0);
   knob.setAttribute('transform','translate('+gx+' '+gy+')');center.setAttribute('cx',x);center.setAttribute('cy',y);stem.setAttribute('x1',x);stem.setAttribute('y1',y);stem.setAttribute('x2',gx);stem.setAttribute('y2',gy);
   g.setAttribute('aria-valuenow',mm(state[ax]));g.setAttribute('aria-valuetext',format(state[ax]));
  }
 }
 const put=(w,d)=>{const next=surveyHandleGeometry(room,w,d);if(!next||next.width===state.width&&next.depth===state.depth)return false;state=next;paint();onDraft(state.width,state.depth);return true;};
 function release(cancel){
  if(!live)return;const old=live;live=null;try{if(svg.hasPointerCapture?.(old.id))svg.releasePointerCapture(old.id);}catch{}
  if(cancel)put(old.width,old.depth);else if(old.width!==state.width||old.depth!==state.depth)onFinish(state.width,state.depth);
 }
 function change(e){if(!live||e.pointerId!==live.id)return;const p=local(e);if(!p)return;
  if(live.axis==='width')put(live.width+(p.x-live.point.x)/sx*state.sx,live.depth);
  else put(live.width,live.depth+(p.y-live.point.y)/sz*state.sz);
 }
 listen(root,'pointerdown',e=>{
  if(dead||live||e.isPrimary===false||e.button!==0)return;const g=e.target.closest?.('[data-survey-handle]'),axis=g?.getAttribute('data-survey-handle'),p=local(e);if(!axes.includes(axis)||!p)return;
  e.preventDefault();e.stopPropagation();live={id:e.pointerId,point:p,axis,width:state.width,depth:state.depth};try{svg.setPointerCapture(e.pointerId);}catch{live=null;return;}
 });
 listen(svg,'pointermove',e=>{if(!live||live.id!==e.pointerId)return;if(e.pointerType==='mouse'&&e.buttons!==1){release(true);return;}e.preventDefault();change(e);});
 listen(svg,'pointerup',e=>{if(!live||live.id!==e.pointerId)return;e.preventDefault();if(e.button!==0||e.buttons){release(true);return;}change(e);release(false);});
 for(const evt of ['pointercancel','lostpointercapture'])listen(svg,evt,e=>{if(live&&live.id===e.pointerId)release(true);});
 listen(win,'blur',()=>release(true));
 listen(svg,'keydown',e=>{
  if(e.key==='Escape'&&live){e.preventDefault();e.stopPropagation();release(true);return;}
  if(live)return;const ax=e.target.closest?.('[data-survey-handle]')?.getAttribute('data-survey-handle');if(!axes.includes(ax))return;
  const delta={ArrowUp:.1,ArrowRight:.1,ArrowDown:-.1,ArrowLeft:-.1}[e.key],M=ax==='width'?room.width:room.length;
  if(delta===undefined&&e.key!=='Home'&&e.key!=='End')return;e.preventDefault();e.stopPropagation();
  const v=e.key==='Home'?.1:e.key==='End'?M-.1:state[ax]+delta;
  if(put(ax==='width'?v:state.width,ax==='depth'?v:state.depth)){const focused=doc.activeElement;onFinish(state.width,state.depth);if(focused===parts[ax].g&&!focused.isConnected)host.querySelector?.('[data-survey-handle="'+ax+'"]')?.focus?.({preventScroll:true});}
 });
 paint(false);
 const api={destroy(){if(dead)return;dead=true;release(true);listeners.forEach(fn=>fn());root.remove();if(origRole===null)svg.removeAttribute('role');else svg.setAttribute('role',origRole);bindings.delete(svg);}};bindings.set(svg,api);return api;
}

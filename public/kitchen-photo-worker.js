// This same cooperative loop also works without Web Workers. Never keep a prior
// camera's buffers alive after closing or replacing the photographic session.
import {buildPhotoBVH,createPhotoFrame,renderPhotoRows,resolvePhotoFrame} from './kitchen-photo-trace.js';
const yieldToHost=()=>new Promise(resolve=>setTimeout(resolve,0));
// Tracing is the only slow part and every pixel of a pass is independent. When the page has started tracing threads (kitchen-photo-crew.js) and handed this
// worker a MessagePort for each, the rows of every pass are traced by those threads while this one merges and filters. Any failure, or no threads at all,
// falls back to the single-thread loop below. The picture is deterministic for a given thread count. A different count changes a fraction of a percent of
// the values by a few levels, because the lazily built light caches depend on the order rows are traced in; it never changes what the picture shows.
export function workersFromPorts(ports){
 const list=[...ports];
 return ()=>{
  const port=list.shift();if(!port)return null;
  const w={onmessage:null,onerror:null,onmessageerror:null,postMessage:(m,t)=>port.postMessage(m,t),terminate:()=>{try{port.close();}catch{/* already closed */}}};
  port.onmessage=e=>w.onmessage?.(e);port.onmessageerror=()=>w.onmessageerror?.();return w;
 };
}
export async function photograph(scene,opts,send,alive=()=>true,spawn=null){
 const threads=opts.threads??0;
 if(spawn&&threads>=2&&opts.width*opts.height>=(opts.parallelMinPixels??100000)){
  try{if(await photographParallel(scene,opts,send,alive,spawn,threads))return;}catch{/* the single-thread loop takes over */}
 }
 return photographSequential(scene,opts,send,alive);
}
async function photographParallel(scene,opts,send,alive,spawn,threads){
 const W=opts.width,H=opts.height,samples=opts.samples,workers=[],strips=[];
 for(let y=0;y<H;y+=8)strips.push([y,Math.min(y+8,H)]);
 const share=Array.from({length:threads},(_,t)=>strips.filter((_,k)=>k%threads===t)); // interleaved, so every thread carries a similar load
 const colour=new Float32Array(W*H*3),guide=new Float32Array(W*H*4),parts=new Map(),queue=[];
 let waiter=null,failure=null,watchdog=0,received=0,said=0,ahead=0;
 const crash=e=>{failure??=e;if(waiter){const w=waiter;waiter=null;w.reject(failure);}};
 const arm=()=>{clearTimeout(watchdog);watchdog=setTimeout(()=>crash(Error('photo threads stalled')),60000);};
 const push=m=>{arm();if(waiter){const w=waiter;waiter=null;w.resolve(m);}else queue.push(m);};
 const take=()=>failure?Promise.reject(failure):queue.length?Promise.resolve(queue.shift()):new Promise((resolve,reject)=>{waiter={resolve,reject};});
 const dispatch=pass=>workers.forEach((w,t)=>w.postMessage({type:'strips',pass,strips:share[t]}));
 try{
  for(let t=0;t<threads;t++){
   const w=spawn();if(!w)throw Error('no workers');workers.push(w);
   w.onmessage=e=>push(e.data);w.onerror=e=>crash(Error(e?.message||'photo thread failed'));w.onmessageerror=()=>crash(Error('photo thread message failed'));
   w.postMessage({type:'init',scene,width:W,height:H,opts});
  }
  arm();
  for(;ahead<Math.min(2,samples);ahead++)dispatch(ahead); // two passes in flight keep the threads busy while this one is filtered
  // The quick preview is traced here while the threads build their copies of the scene and start the first pass.
  const tree=buildPhotoBVH(scene),thumbW=Math.min(W,256),thumbH=Math.round(H*thumbW/W),thumb=createPhotoFrame(tree,thumbW,thumbH,opts);
  for(let y=0;y<thumbH&&alive();y+=12){renderPhotoRows(thumb,0,y,Math.min(y+12,thumbH),false);await yieldToHost();}
  if(!alive())return true;
  send({type:'preview',width:thumbW,height:thumbH,pixels:resolvePhotoFrame(thumb,1)});
  for(let pass=0;pass<samples;pass++){
   while((parts.get(pass)?.length||0)<strips.length){
    const m=await take();if(!alive())return true;
    if(m.type==='error')throw Error(m.error);
    if(m.type!=='strip')continue;
    if(!parts.has(m.pass))parts.set(m.pass,[]);
    parts.get(m.pass).push(m);received++;
    if(Date.now()-said>120){said=Date.now();send({type:'progress',pass:pass+1,fraction:received/(strips.length*samples)});}
   }
   for(const part of parts.get(pass)){
    const a=part.y0*W*3;for(let j=0;j<part.color.length;j++)colour[a+j]+=part.color[j];
    if(pass===0)guide.set(part.guide,part.y0*W*4);
   }
   parts.delete(pass);
   if(ahead<samples)dispatch(ahead++);
   send({type:'frame',width:W,height:H,pass:pass+1,samples,pixels:resolvePhotoFrame({width:W,height:H,acc:colour,guide},pass+1)});
   await yieldToHost();
  }
  if(alive())send({type:'done'});
  return true;
 }finally{
  clearTimeout(watchdog);for(const w of workers){try{w.terminate();}catch{/* already gone */}}
 }
}
async function photographSequential(scene,opts,send,alive){const tree=buildPhotoBVH(scene),W=opts.width,H=opts.height,thumbW=Math.min(W,256),thumbH=Math.round(H*thumbW/W);let f=createPhotoFrame(tree,thumbW,thumbH,opts);
 for(let y=0;y<thumbH&&alive();y+=12){renderPhotoRows(f,0,y,Math.min(y+12,thumbH),false);await yieldToHost();}if(!alive())return;send({type:'preview',width:thumbW,height:thumbH,pixels:resolvePhotoFrame(f,1)});f=createPhotoFrame(tree,W,H,opts);
 for(let pass=0;pass<opts.samples&&alive();pass++){
  let y=0;while(y<H&&alive()){const stop=performance.now()+32;do{const end=Math.min(y+2,H);renderPhotoRows(f,pass,y,end,false);y=end;}while(y<H&&performance.now()<stop);send({type:'progress',pass:pass+1,fraction:(pass+y/H)/opts.samples});await yieldToHost();}
  if(!alive())return;const msg={type:'frame',width:W,height:H,pass:pass+1,samples:opts.samples,pixels:resolvePhotoFrame(f,pass+1)};send(msg);await yieldToHost();}
 if(alive())send({type:'done'});}
if(typeof WorkerGlobalScope!=='undefined'&&self instanceof WorkerGlobalScope){let version=0;self.onmessage=ev=>{const n=++version;if(ev.data.type!=='render')return;photograph(ev.data.scene,{...ev.data.opts,threads:ev.data.ports?.length||1},m=>self.postMessage(m,m.pixels?[m.pixels.buffer]:[]),()=>n===version,workersFromPorts(ev.data.ports||[])).catch(err=>self.postMessage({type:'error',error:String(err?.message||err)}));};}

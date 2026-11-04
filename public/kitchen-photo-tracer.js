// One tracing thread of the photograph. The page starts several of these (kitchen-photo-crew.js) and hands the coordinator (kitchen-photo-worker.js) one
// MessagePort per thread: the coordinator gives each thread the scene once, then strips of rows, and merges what comes back. A thread keeps no finished
// picture. The strip handler is a plain function, so it also runs under node's worker_threads in the checks.
import {buildPhotoBVH,createPhotoFrame,renderPhotoRows} from './kitchen-photo-trace.js';
export function createTracer(post){
 let frame=null;
 return function handle(msg){
  if(msg.type==='init'){frame=createPhotoFrame(buildPhotoBVH(msg.scene),msg.width,msg.height,msg.opts);return;}
  if(msg.type!=='strips'||!frame)throw Error('photo tracer: strips before init');
  const {width:w,acc,guide}=frame,{pass}=msg;
  for(const [y0,y1] of msg.strips){
   acc.fill(0,y0*w*3,y1*w*3); // the coordinator adds the passes up, so each strip carries only this pass
   renderPhotoRows(frame,pass,y0,y1,false);
   const color=acc.slice(y0*w*3,y1*w*3),edge=pass===0?guide.slice(y0*w*4,y1*w*4):null;
   post({type:'strip',pass,y0,y1,color,guide:edge},edge?[color.buffer,edge.buffer]:[color.buffer]);
  }
 };
}
// Serve the coordinator over a MessagePort (a browser MessagePort, or node's, which has the same onmessage / postMessage shape).
export function attachTracer(port){
 const handle=createTracer((message,transfer)=>port.postMessage(message,transfer));
 port.onmessage=e=>{try{handle(e.data);}catch(err){port.postMessage({type:'error',error:String(err?.message||err)});}};
 return port;
}
if(typeof WorkerGlobalScope!=='undefined'&&self instanceof WorkerGlobalScope){
 self.onmessage=e=>{if(e.data?.type==='attach'&&e.ports?.[0])attachTracer(e.ports[0]);};
 self.postMessage({type:'ready'}); // the page counts this thread only once it has said so
}

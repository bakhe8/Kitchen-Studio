// Node stand-in for kitchen-photo-tracer.js running in a browser Worker. Used by check-kitchen-photo-threads.mjs; not a check itself.
// It answers either directly (messages sent straight to this thread) or, like the browser, over a MessagePort that is attached first.
import {parentPort} from 'node:worker_threads';
import {createTracer,attachTracer} from '../public/kitchen-photo-tracer.js';
const handle=createTracer((message,transfer)=>parentPort.postMessage(message,transfer));
parentPort.on('message',m=>{
 if(m?.type==='attach'&&m.port){attachTracer(m.port);return;}
 try{handle(m);}catch(err){parentPort.postMessage({type:'error',error:String(err?.message||err)});}
});

// Starts the tracing threads for one photograph. The page starts them, not the coordinator worker: a worker cannot always start workers of its own (an
// embedded browser here refused), while the page always can. A thread is counted only after it has loaded and said it is ready; with fewer than two,
// or none, the photograph is traced on the single-thread path exactly as before.
export const crewSize=(opts,cores=globalThis.navigator?.hardwareConcurrency||0)=>opts.width*opts.height>=100000&&cores>=4?Math.min(6,cores-1):0;
export async function startTracerCrew(opts,{size=crewSize(opts),wait=4000,url=new URL('./kitchen-photo-tracer.js',import.meta.url)}={}){
 const crew={workers:[],ports:[],stop(){for(const w of crew.workers){try{w.terminate();}catch{/* already gone */}}crew.workers=[];crew.ports=[];}};
 if(size<2||typeof Worker!=='function'||typeof MessageChannel!=='function')return crew;
 try{
  const started=await Promise.all(Array.from({length:size},()=>new Promise(resolve=>{
   let w;try{w=new Worker(url,{type:'module'});}catch{resolve(null);return;}
   const timer=setTimeout(()=>{try{w.terminate();}catch{/* already gone */}resolve(null);},wait);
   w.onmessage=e=>{if(e.data?.type==='ready'){clearTimeout(timer);w.onmessage=null;w.onerror=null;resolve(w);}};
   w.onerror=()=>{clearTimeout(timer);try{w.terminate();}catch{/* already gone */}resolve(null);};
  })));
  const live=started.filter(Boolean);
  if(live.length<2){for(const w of live)w.terminate();return crew;}
  for(const w of live){const link=new MessageChannel();w.postMessage({type:'attach'},[link.port1]);crew.workers.push(w);crew.ports.push(link.port2);}
 }catch{crew.stop();}
 return crew;
}

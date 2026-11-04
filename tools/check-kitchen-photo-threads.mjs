import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Worker as Thread} from 'node:worker_threads';
import {createKitchen} from '../public/kitchen-model.js';
import {createShelfPlan} from '../public/shelf-model.js';
import {buildPhotoScene} from '../public/kitchen-photo-scene.js';
import {photograph,workersFromPorts} from '../public/kitchen-photo-worker.js';
import {startTracerCrew,crewSize} from '../public/kitchen-photo-crew.js';
// The photograph is traced by several threads and merged by the coordinator. The picture must show the same thing as the single-thread one, be
// repeatable for a given thread count, stop cleanly when cancelled, and never break when workers are missing or fail.
const digest=b=>createHash('sha256').update(b).digest('hex').slice(0,16);
const room=createShelfPlan(),scene=buildPhotoScene(room,createKitchen(room));
const opts={width:160,height:100,samples:2,lighting:'daylight',framing:'interior',yaw:26,pitch:14,fov:60,parallelMinPixels:1};
let started=0,stopped=0;
// a browser-Worker-shaped wrapper over a node thread running the real tracer module
const spawnThreads=()=>{
 const t=new Thread(new URL('./photo-tracer-thread.mjs',import.meta.url)),w={onmessage:null,onerror:null,postMessage:(m,x)=>t.postMessage(m,x),terminate:()=>{stopped++;return t.terminate();}};
 started++;t.on('message',data=>w.onmessage?.({data}));t.on('error',e=>w.onerror?.({message:e.message}));return w;
};
const run=async(extra,spawn,alive=()=>true)=>{const out=[];await photograph(scene,{...opts,...extra},m=>out.push(m),alive,spawn);return out;};
const frames=m=>m.filter(x=>x.type==='frame'),kinds=m=>m.filter(x=>x.type!=='progress').map(x=>x.type+(x.pass?':'+x.pass:''));
const diff=(a,b)=>{let sum=0,max=0,n=0;const count=a.length/4*3;for(let i=0;i<a.length;i++){if(i%4===3)continue;const d=Math.abs(a[i]-b[i]);sum+=d;if(d>max)max=d;if(d)n++;}return {mean:sum/count,max,share:n/count};};

const single=await run({threads:1},null);
assert.deepEqual(kinds(single),['preview','frame:1','frame:2','done']);

// 1. four threads: the same messages, the same picture to within a few levels, and every thread is stopped afterwards
const four=await run({threads:4},spawnThreads);
assert.deepEqual(kinds(four),kinds(single));assert.equal(started,4);assert.equal(stopped,4,'all threads are stopped when the photograph ends');
for(let i=0;i<2;i++){assert.equal(frames(four)[i].width,160);assert.equal(frames(four)[i].samples,2);}
const near=diff(frames(single).at(-1).pixels,frames(four).at(-1).pixels);
assert(near.mean<.5&&near.max<=64&&near.share<.2,'multi-thread picture drifted from the single-thread one: '+JSON.stringify(near));
assert.notEqual(digest(frames(four).at(-1).pixels),digest(frames(four)[0].pixels),'later passes refine the picture');

// 2. repeatable for a given thread count; another count gives a picture that is just as close
const again=await run({threads:4},spawnThreads);
assert.deepEqual(frames(again).map(f=>digest(f.pixels)),frames(four).map(f=>digest(f.pixels)),'same thread count, same pictures');
const three=await run({threads:3},spawnThreads),other=diff(frames(four).at(-1).pixels,frames(three).at(-1).pixels);
assert(other.mean<.5&&other.max<=64,'a different thread count stays close: '+JSON.stringify(other));

// 3. below the size threshold the single-thread loop is used and no thread is started
const before=started;await run({threads:4,parallelMinPixels:1e9},spawnThreads);assert.equal(started,before);

// 4. cancelling after the first frame stops everything: no more frames, no "done", every thread stopped
{
 const base=started,baseStopped=stopped;let seen=0;const out=[];
 await photograph(scene,{...opts,threads:3,samples:5},m=>{out.push(m);if(m.type==='frame')seen++;},()=>seen<1,spawnThreads);
 assert.equal(frames(out).length,1);assert(!out.some(m=>m.type==='done'));assert.equal(started-base,3);assert.equal(stopped-baseStopped,3);
}

// 5. no workers at all, or a worker that cannot be created: the single-thread loop gives exactly the single-thread picture
for(const broken of [()=>null,()=>{throw Error('Worker is not allowed here');}]){
 const out=await run({threads:4},broken);
 assert.deepEqual(frames(out).map(f=>digest(f.pixels)),frames(single).map(f=>digest(f.pixels)),'fallback is the single-thread path, bit for bit');assert.equal(out.at(-1).type,'done');
}

// 6. a thread that fails half way (it answers the first strips, then reports an error): the single-thread loop takes over and finishes the picture
{
 let n=0;const flaky=()=>{
  if(++n<3)return spawnThreads();
  const w={onmessage:null,onerror:null,terminate(){stopped++;},postMessage(m){if(m.type==='strips')queueMicrotask(()=>w.onmessage?.({data:{type:'error',error:'boom'}}));}};started++;return w;
 };
 const base=started,baseStopped=stopped,out=await run({threads:4},flaky);
 assert.deepEqual(frames(out).slice(-2).map(f=>digest(f.pixels)),frames(single).map(f=>digest(f.pixels)),'after the failure the picture is the single-thread one');
 assert.equal(out.at(-1).type,'done');assert.equal(started-base,stopped-baseStopped,'every thread that was started is stopped, including the failed one');
}
// 7. the topology the browser uses: the page starts the tracing threads and hands the coordinator one MessagePort for each
{
 const threads=[],ports=[];
 for(let i=0;i<3;i++){const t=new Thread(new URL('./photo-tracer-thread.mjs',import.meta.url)),link=new MessageChannel();t.postMessage({type:'attach',port:link.port1},[link.port1]);threads.push(t);ports.push(link.port2);}
 try{
  const out=[];await photograph(scene,{...opts,threads:3},m=>out.push(m),()=>true,workersFromPorts(ports));
  assert.deepEqual(kinds(out),kinds(single));
  const flat=diff(frames(single).at(-1).pixels,frames(out).at(-1).pixels);assert(flat.mean<.5&&flat.max<=64,'port-connected threads stay close: '+JSON.stringify(flat));
 }finally{for(const t of threads)await t.terminate();}
}

// 8. the page-side crew: a thread counts only once it says it is ready; fewer than two means no crew and the single-thread path
{
 class FakeWorker{
  static plan=[];
  constructor(){this.mode=FakeWorker.plan.shift()??'ready';this.sent=[];this.stopped=false;setTimeout(()=>{if(this.mode==='ready')this.onmessage?.({data:{type:'ready'}});if(this.mode==='error')this.onerror?.({});},2);}
  postMessage(m){this.sent.push(m);}
  terminate(){this.stopped=true;}
 }
 const real=globalThis.Worker;globalThis.Worker=FakeWorker;
 try{
  FakeWorker.plan=['ready','ready','ready','ready'];
  let crew=await startTracerCrew({width:640,height:400},{size:4,wait:80}),ws=[...crew.workers];
  assert.equal(crew.workers.length,4);assert.equal(crew.ports.length,4);assert(ws.every(w=>w.sent[0].type==='attach'),'each ready thread is sent its port');
  for(const p of crew.ports)p.close();crew.stop();assert(ws.every(w=>w.stopped)&&crew.workers.length===0,'stop() ends every thread');
  FakeWorker.plan=['ready','error','silent','ready'];
  crew=await startTracerCrew({width:640,height:400},{size:4,wait:80});assert.equal(crew.workers.length,2,'a thread that failed or never answered is left out');
  for(const p of crew.ports)p.close();crew.stop();
  FakeWorker.plan=['ready','error','error','silent'];
  crew=await startTracerCrew({width:640,height:400},{size:4,wait:80});assert.equal(crew.workers.length,0,'one ready thread is not a crew');assert.equal(crew.ports.length,0);
  assert.equal((await startTracerCrew({width:640,height:400},{size:1})).workers.length,0);
  globalThis.Worker=undefined;assert.equal((await startTracerCrew({width:640,height:400},{size:4})).workers.length,0,'no Worker in this browser');
 }finally{globalThis.Worker=real;}
 assert.equal(crewSize({width:640,height:400},16),6);assert.equal(crewSize({width:640,height:400},4),3);assert.equal(crewSize({width:640,height:400},2),0);assert.equal(crewSize({width:200,height:120},16),0,'small frames do not need a crew');
}
console.log('PASS: multi-thread photograph - same messages and picture within '+JSON.stringify({mean:+near.mean.toFixed(4),max:near.max})+' of single-thread, repeatable, cancels cleanly, falls back to single-thread when workers are missing or fail.');

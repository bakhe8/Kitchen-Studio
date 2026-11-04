// Isolated review fixture: real API handlers and domain validators, synthetic
// identities, migrated in-memory SQLite and exact in-memory object bytes.
// No production authentication, cloud storage or existing browser origin is used.
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,readdir,stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {makeProductionReadyFixture} from '../tools/fixture-kitchen-production-ready.mjs';
import {approvalState} from '../public/kitchen-workshop-state.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const actors=['owner','factory','viewer','outside'];
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.ico':'image/x-icon'};
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const bytesOf=async value=>typeof value==='string'?new TextEncoder().encode(value):value instanceof ArrayBuffer?new Uint8Array(value):ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength).slice():new Uint8Array(await new Response(value).arrayBuffer());

export async function createDeliveryReviewFixture({origin='http://127.0.0.1:8766'}={}){
 const db=new DatabaseSync(':memory:'),ids=new AsyncLocalStorage(),blobs=new Map(),globalKey='__deliveryReview_'+randomUUID().replaceAll('-','');
 for(const file of (await readdir(resolve(root,'drizzle'))).filter(p=>p.endsWith('.sql')).sort())db.exec(await readFile(resolve(root,'drizzle',file),'utf8'));
 const prepare=(sql,values=[])=>({bind(...v){return prepare(sql,v);},first(){return db.prepare(sql).get(...values);},all(){return {results:db.prepare(sql).all(...values)};},run(){return {meta:{changes:db.prepare(sql).run(...values).changes}};}});
 const bucket={async put(key,value){const bytes=await bytesOf(value);if(!blobs.has(key))blobs.set(key,bytes.slice());},async head(key){const bytes=blobs.get(key);return bytes?{etag:createHash('sha256').update(bytes).digest('hex'),size:bytes.byteLength}:null;},async get(key){const bytes=blobs.get(key);if(!bytes)return null;return {...await this.head(key),body:bytes.slice(),arrayBuffer:async()=>bytes.slice().buffer,json:async()=>JSON.parse(new TextDecoder().decode(bytes))};}};
 const env={DB:{prepare,batch(statements){db.exec('BEGIN');try{const values=statements.map(s=>s.run());db.exec('COMMIT');return values;}catch(error){db.exec('ROLLBACK');throw error;}}},BUCKET:bucket};
 globalThis[globalKey]={env,auth:()=>ids.getStore()||null};
 // Use the owning export list, but compile current sources without regenerating
 // lib/generated-shop-domain.mjs while other agents run the normal API checks.
 const prepareSource=await readFile(resolve(root,'scripts/prepare-shop-domain.mjs'),'utf8');
 const domainSource=prepareSource.match(/contents:`([\s\S]*?)`,resolveDir/);
 assert(domainSource,'prepare-shop-domain export source must remain recognizable');
 const plugin={name:'delivery-review-bindings',setup(b){
  b.onResolve({filter:/^(cloudflare:workers|.*chatgpt-auth)$/},a=>({path:a.path,namespace:'review-binding'}));
  b.onLoad({filter:/.*/,namespace:'review-binding'},a=>({contents:a.path==='cloudflare:workers'?`export const env=globalThis[${JSON.stringify(globalKey)}].env;`:`export const getChatGPTUser=globalThis[${JSON.stringify(globalKey)}].auth;`}));
  b.onResolve({filter:/generated-shop-domain\.mjs$/},()=>({path:'domain',namespace:'review-domain'}));
  b.onLoad({filter:/.*/,namespace:'review-domain'},()=>({contents:domainSource[1],resolveDir:root,loader:'js'}));
 }};
 const loadRoute=async path=>{const output=await build({absWorkingDir:root,entryPoints:[path],bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent',plugins:[plugin]});return import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));};
 let routes;
 try{const [projects,jobs]=await Promise.all([loadRoute('app/api/projects/route.ts'),loadRoute('app/api/jobs/route.ts')]);routes={'/api/projects':projects,'/api/jobs':jobs};}catch(error){delete globalThis[globalKey];db.close();throw error;}
 const identity=name=>actors.includes(name)?{userId:'delivery-review-'+name,email:name+'@delivery-review.example.test',displayName:'Fixture '+name,fullName:'Fixture '+name}:null;
 const call=(actor,path,query={},body)=>{
  const url=new URL(path,origin);url.search=new URLSearchParams(query).toString();
  const request=new Request(url,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Request':'1',Origin:origin},body:JSON.stringify(body)});
  return dispatch(actor,request);
 };
 const dispatch=(actor,request)=>ids.run(identity(actor),()=>{const route=routes[new URL(request.url).pathname],handler=route?.[request.method];return handler?handler(request):json({error:'Fixture route unavailable.'},404);});
 const must=async(response,status)=>{const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;};
 const projectId=randomUUID(),doc=await makeProductionReadyFixture(),archive={type:'kitchen-studio',version:2,design:doc,fieldFiles:[],photos:{}};
 for(const actor of actors)await must(await call(actor,'/api/projects'),200);
 await must(await call('owner','/api/projects',{id:projectId,expected:0,request:randomUUID(),name:'اختبار محلي — تسليم واستلام المطبخ'},archive),201);
 for(const role of ['factory','viewer'])await must(await call('owner','/api/projects',{id:projectId,action:'share'},{email:role+'@delivery-review.example.test',role}),200);
 const state=await approvalState(doc),issued=await must(await call('owner','/api/projects',{id:projectId,action:'release',revision:1,review:state.keys.release},{}),200);
 const receipt='full:'+issued.receipt.design_key;
 const job=await must(await call('owner','/api/jobs',{id:projectId,receipt}),200);
 assert(job.units.length>=2,'review fixture needs independently addressable units');
 const [packedUnit,qcUnit]=job.units;
 const seedEvent=(actor,unit,action,expected,data)=>call(actor,'/api/jobs',{id:projectId,receipt,request:randomUUID()},{action,unit:unit.id,expected,...data});
 const tolerances=unit=>Object.fromEntries(unit.checks.map(check=>[check.key,check.unit==='قطعة'?0:Math.min(1,check.maxTolerance??1,check.nominal)]));
 for(const unit of [packedUnit,qcUnit])await must(await seedEvent('owner',unit,'plan',0,{reference:'SYNTHETIC-QA-TOLERANCES',tolerances:tolerances(unit)}),201);
 await must(await seedEvent('factory',packedUnit,'qc',1,{actual:Object.fromEntries(packedUnit.checks.map(check=>[check.key,check.nominal])),note:'Synthetic fixture measurements at nominal values.'}),201);
 await must(await seedEvent('factory',packedUnit,'pack',2,{note:'Synthetic fixture packaging; no real shipment.'}),201);
 const seed={testOnly:true,origin,projectId,receipt,revision:1,packedUnitId:packedUnit.id,qcUnitId:qcUnit.id,unitIds:job.units.map(unit=>unit.id),browserUrl:origin+'/index.html?panel=workshop&step=tracking'};
 const snapshot=()=>({seed,events:db.prepare('SELECT unit,seq,action,state,receipt,revision,actor,payload FROM studio_job_events WHERE project=? ORDER BY unit,seq').all(projectId).map(e=>({...e,data:JSON.parse(e.payload),payload:undefined})),versions:db.prepare('SELECT revision,digest FROM studio_versions WHERE project_id=? ORDER BY revision').all(projectId)});
 let fault=null,closed=false;
 const handle=async request=>{
  const url=new URL(request.url),cookie=request.headers.get('cookie')||'',actor=cookie.match(/(?:^|;\s*)delivery_review_actor=([a-z]+)/)?.[1]||'owner';
  if(url.pathname==='/__fixture/status')return json(snapshot());
  if(url.pathname==='/__fixture/actor'){
   const name=url.searchParams.get('name');if(!actors.includes(name))return json({error:'Unknown fixture identity.'},400);
   return new Response(null,{status:303,headers:{Location:seed.browserUrl,'Set-Cookie':'delivery_review_actor='+name+'; Path=/; SameSite=Strict; HttpOnly','Cache-Control':'no-store'}});
  }
  if(url.pathname==='/__fixture/fault'&&request.method==='POST'){
   const value=await request.json();if(!['fail-next-job','drop-next-job-response','delay-next-job','clear'].includes(value.mode))return json({error:'Unknown deterministic fault.'},400);
   fault=value.mode==='clear'?null:value;return json({armed:fault});
  }
  if(url.pathname==='/__fixture')return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><title>Isolated delivery review</title><body><h1>Synthetic local delivery fixture</h1><p>Real API handlers; in-memory data. Nothing is sent to a cloud service.</p><p>'+actors.map(name=>'<a href="/__fixture/actor?name='+name+'">'+name+'</a>').join(' · ')+'</p><p><a href="'+seed.browserUrl+'">Open actual tracking UI</a> · <a href="/__fixture/status">Inspect saved fixture events</a></p><pre>'+JSON.stringify(seed,null,2)+'</pre></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  if(routes[url.pathname]){
   const armed=url.pathname==='/api/jobs'&&request.method==='POST'?fault:null;if(armed)fault=null;
   if(armed?.mode==='fail-next-job')return json({error:'Synthetic transient save failure. Retry the unchanged draft.'},503);
   if(armed?.mode==='delay-next-job')await new Promise(resolve=>setTimeout(resolve,Math.min(5000,Math.max(1,Number(armed.ms)||250))));
   const response=await dispatch(actor,request);
   if(armed?.mode==='drop-next-job-response'&&response.ok)return json({error:'Synthetic response loss after the event was saved. Retry the unchanged draft.'},503);
   return response;
  }
  const publicRoot=resolve(root,'public'),path=resolve(publicRoot,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(path!==publicRoot&&!path.startsWith(publicRoot+sep))return json({error:'Outside fixture public directory.'},403);
  try{if(!(await stat(path)).isFile())return json({error:'Not found.'},404);return new Response(await readFile(path),{headers:{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'}});}catch{return json({error:'Not found.'},404);}
 };
 return {seed,doc,call,dispatch,handle,snapshot,db,env,close(){if(!closed){closed=true;delete globalThis[globalKey];db.close();}}};
}

export async function serveDeliveryReview({port=8766}={}){
 const origin='http://127.0.0.1:'+port,fixture=await createDeliveryReviewFixture({origin});
 const server=createServer(async(req,res)=>{
  try{
   if(!['127.0.0.1','::ffff:127.0.0.1','::1'].includes(req.socket.remoteAddress)){res.writeHead(403);res.end();return;}
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const body=Buffer.concat(chunks),request=new Request(new URL(req.url,origin),{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body})});
   const response=await fixture.handle(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
  }catch(error){console.error(error);res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Isolated fixture server failure.'}));}
 });
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});}catch(error){fixture.close();throw error;}
 return {fixture,server,async close(){await new Promise(resolve=>server.close(resolve));fixture.close();}};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.includes('--check')){const fixture=await createDeliveryReviewFixture();console.log(JSON.stringify(fixture.snapshot(),null,2));fixture.close();}
 else{const arg=process.argv.find(a=>a.startsWith('--port=')),running=await serveDeliveryReview({port:arg?Number(arg.slice(7)):8766});console.log('ISOLATED DELIVERY REVIEW '+JSON.stringify(running.fixture.seed));console.log('Fixture controls: '+running.fixture.seed.origin+'/__fixture');for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>void running.close().then(()=>process.exit(0)));}
}

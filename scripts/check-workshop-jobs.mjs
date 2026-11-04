import {confirmFixtureFitout} from '../tools/fixture-kitchen-fitout.mjs';
import {build} from 'esbuild';
import {DatabaseSync} from 'node:sqlite';import {AsyncLocalStorage} from 'node:async_hooks';import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {prepareShopDomain} from './prepare-shop-domain.mjs';
import {makeChainExample} from '../public/kitchen-chain-model.js';import {planWorkshopRow} from '../public/kitchen-production-row.js';
import {certifyInstallDependency} from '../public/kitchen-install-readiness.js';
import {acceptPattern} from '../public/kitchen-surface-pattern.js';
import {kitchenGeometry} from '../public/kitchen-model.js';
import {seedCatalog} from '../public/kitchen-workshop-factory.js';
import {serviceTickets,serviceWarranty} from '../public/kitchen-maintenance-domain.js';
await prepareShopDomain();
const root=fileURLToPath(new URL('../',import.meta.url)),db=new DatabaseSync(':memory:'),ids=new AsyncLocalStorage(),files=new Map();
for(const f of (await readdir(root+'drizzle')).filter(s=>s.endsWith('.sql')).sort())db.exec(await readFile(root+'drizzle/'+f,'utf8'));
const wrap=(s,p=[])=>({bind(...v){return wrap(s,v);},run:()=>({meta:{changes:db.prepare(s).run(...p).changes}}),first:()=>db.prepare(s).get(...p),all:()=>({results:db.prepare(s).all(...p)})});
globalThis.__shopJobs={get:()=>ids.getStore(),env:{DB:{prepare:wrap},BUCKET:{reads:{get:0,head:0},
 tag(k){const t=JSON.stringify(files.get(k));let h=0;for(let i=0;i<t.length;i++)h=(h*31+t.charCodeAt(i))|0;return {etag:t.length+':'+h,size:t.length};},
 async head(k){this.reads.head++;return files.has(k)?this.tag(k):null;},
 async get(k){this.reads.get++;if(!files.has(k))return null;return {...this.tag(k),async arrayBuffer(){return new TextEncoder().encode(JSON.stringify(files.get(k))).buffer;}};}}}};
const code=await build({absWorkingDir:root,entryPoints:['app/api/jobs/route.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'job-tests',setup(b){b.onResolve({filter:/^(cloudflare:workers|.*chatgpt-auth)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='cloudflare:workers'?'export const env=globalThis.__shopJobs.env;':'export const getChatGPTUser=globalThis.__shopJobs.get;'}));}}]});
const {GET,POST}=await import('data:text/javascript;base64,'+Buffer.from(code.outputFiles[0].text).toString('base64'));
const pid=crypto.randomUUID(),key='a'.repeat(64),receipt='full:'+key;
const use=(u,query,body,headers={})=>ids.run(u&&{userId:u,displayName:'person-'+u,email:u+'@example.test'},()=>{const r=new Request('https://studio.test/api/jobs?'+new URLSearchParams({id:pid,...query}),body?{method:'POST',headers:{'X-Studio-Request':'1',Origin:'https://studio.test',...headers},body:JSON.stringify(body)}:{});return body?POST(r):GET(r);});
db.prepare('INSERT INTO studio_projects VALUES(?,?)').run(pid,'owner');for(const role of ['editor','viewer','factory'])db.prepare('INSERT INTO studio_access VALUES(?,?,?)').run(pid,role,role);
assert.equal((await use('editor',{})).status,403);assert.equal((await use('viewer',{})).status,403);assert.equal((await use(null,{})).status,401);assert.equal((await use('outsider',{})).status,404);assert.deepEqual((await(await use('factory',{})).json()).receipts,[]);
const room=makeChainExample();const run=planWorkshopRow(room,{wall:'back',tier:'base',startMm:1300,endMm:4300,rice:false,dishwasher:false,sink:false});
assert(run.ok,run.reason);run.doc.room.workshop.catalog??=seedCatalog();confirmFixtureFitout(run.doc);
const unit=run.doc.kitchen.units[0].id,dep={id:'receipt-fridge',unitId:unit,kind:'receipt',phase:'install',name:'استلام الجهاز',trade:'المالك',due:'2026-10-31',planRef:'PO-demo',model:'Model-Q',checks:[{label:'العرض',target:750,tolerance:2}]};
run.doc.room.workshop.installReadiness={routes:[],dependencies:[dep]};
const version=async(doc,rev)=>{
 const record={type:'kitchen-studio',version:2,design:doc},serialized=JSON.stringify(record),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serialized))),b=>b.toString(16).padStart(2,'0')).join('');
 files.set('kitchen-projects/'+pid+'/'+digest+'.json',record);
 db.prepare('INSERT INTO studio_versions(project_id,revision,request_id,actor,name,digest,bytes,updated) VALUES(?,?,?,?,?,?,?,?)').run(pid,rev,crypto.randomUUID(),'owner','sample',digest,new TextEncoder().encode(serialized).length,'2026-10-31');return digest;
};
await version(run.doc,1);
const stored={type:'kitchen-studio',version:2,design:run.doc};const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(stored)))),v=>v.toString(16).padStart(2,'0')).join('');files.set('kitchen-projects/'+pid+'/'+digest+'.json',stored);
const call=(user,a,expected,m,request=crypto.randomUUID())=>use(user,{receipt,request},{action:a,unit,expected,...m});
assert.equal((await call('owner','plan',0,{reference:'ref',tolerances:{}})).status,409);
db.prepare('INSERT INTO studio_releases(project_id,revision,issuer,digest,design_key,total_minor,issued) VALUES(?,?,?,?,?,?,?)').run(pid,1,'owner',digest,key,500,'2026-10-31');
let job=await(await use('factory',{receipt})).json();const sample=job.units.find(u=>u.id===unit);assert(sample);assert.equal(job.revision,1);
const tolerance={reference:'factory-Q-7',tolerances:Object.fromEntries(sample.checks.map(m=>[m.key,1]))};
assert.equal((await call('factory','plan',0,tolerance)).status,403);assert.equal((await call('viewer','pack',0,{note:'x'})).status,403);
assert.equal((await call('owner','pack',0,{note:'premature'})).status,409);assert.equal((await call('owner','plan',0,tolerance)).status,201);
const good=Object.fromEntries(sample.checks.map(m=>[m.key,m.nominal])),wrong={...good,[sample.checks[0].key]:sample.checks[0].nominal+2};
let result=await call('factory','qc',1,{actual:wrong,note:'measured'});assert.equal((await result.json()).state,'planned');
assert.equal((await call('factory','pack',2,{note:'early'})).status,409);
assert.equal((await call('factory','qc',2,{actual:good,note:'reworked and measured'})).status,201);
const idem=crypto.randomUUID(),pack={note:'box three'};assert.equal((await call('factory','pack',3,pack,idem)).status,201);assert.equal((await call('factory','pack',3,pack,idem)).status,200);
assert.equal((await call('factory','pack',4,pack)).status,409);const install={location:'wall A',note:'installed'};
assert.equal((await call('factory','install',4,install)).status,422);
const dropped=structuredClone(run.doc);dropped.room.workshop.installReadiness.dependencies=[];await version(dropped,2);
assert.equal((await call('factory','install',4,install)).status,422);
const done=structuredClone(run.doc);const certify=model=>certifyInstallDependency(done,dep,{by:'فني',ref:'استلام ميداني',date:'2026-10-31',actual:[750],model}).record;
done.room.workshop.installReadiness.dependencies=[certify('Model-K')];await version(structuredClone(done),3);
assert.equal((await call('factory','install',4,install)).status,422);
done.room.workshop.installReadiness.dependencies=[certify('Model-Q')];await version(done,4);
assert.equal((await call('factory','install',4,install)).status,201);
assert.equal((await call('factory','accept',5,{customer:'A',note:'checked'})).status,403);assert.equal((await call('owner','accept',5,{customer:'A',note:'checked'})).status,201);
job=await(await use('owner',{receipt})).json();assert.equal(job.events.at(-1).actor,undefined);assert.equal(job.events.at(-1).who,'person-owner');assert.equal(job.events.at(-1).state,'accepted');assert.equal(job.events.filter(e=>e.action==='pack').length,1);assert.equal(job.events.find(e=>e.action==='qc').data.passed,false);
assert.equal(job.events.find(e=>e.action==='install').data.siteRevision,4);
{
 const safe=await(await use('factory',{receipt})).json(),text=JSON.stringify(safe);
 for(const privateValue of ['person-owner','factory-Q-7','reworked and measured','box three','wall A','checked'])assert(!text.includes(privateValue),'factory result excludes private event value '+privateValue);
 assert.deepEqual(safe.events.at(-1).data,{});assert(safe.events.every(e=>!('who' in e)&&!('note' in e.data)&&!('customer' in e.data)));assert(safe.events.find(e=>e.action==='plan').data.tolerances);
 assert.equal((await use('factory',{receipt,action:'unrecognized'})).status,400);
 const bucket=globalThis.__shopJobs.env.BUCKET,head=bucket.head;
 bucket.head=async function(...args){db.prepare('UPDATE studio_access SET role=? WHERE project_id=? AND member=?').run('rep',pid,'factory');return head.apply(this,args);};
 try{assert.equal((await use('factory',{receipt})).status,404,'read checks the role again after immutable snapshot access');}finally{bucket.head=head;db.prepare('UPDATE studio_access SET role=? WHERE project_id=? AND member=?').run('factory',pid,'factory');}
}
// New scoped factory shares operate the shop; store and rep shares cannot use
// this endpoint to bypass their gateway. Legacy editor and viewer roles now require reassignment.
{
 for(const role of ['store','rep'])db.prepare('INSERT INTO studio_access VALUES(?,?,?)').run(pid,role,role);
 for(const role of ['store','rep']){
  assert.equal((await call(role,'qc',6,{actual:good,note:'not my gateway'})).status,403);
  assert.equal((await call(role,'plan',6,tolerance)).status,403);
 }
 assert.equal((await call('factory','plan',6,tolerance)).status,403);
 assert.equal((await call('factory','accept',6,{customer:'A',note:'not owner'})).status,403);
 const other=job.units.find(u=>u.id!==unit);assert(other);
 const act=(who,action,expected,values)=>use(who,{receipt,request:crypto.randomUUID()},{unit:other.id,action,expected,...values});
 const plan={reference:'factory-Q-8',tolerances:Object.fromEntries(other.checks.map(m=>[m.key,1]))};
 const readings={actual:Object.fromEntries(other.checks.map(m=>[m.key,m.nominal])),note:'scoped inspection'};
 assert.equal((await act('owner','plan',0,plan)).status,201);
 const bucket=globalThis.__shopJobs.env.BUCKET,head=bucket.head;
 for(const changed of ['editor',null]){
  bucket.head=async function(...args){
   if(changed)db.prepare('UPDATE studio_access SET role=? WHERE project_id=? AND member=?').run(changed,pid,'factory');
   else db.prepare('DELETE FROM studio_access WHERE project_id=? AND member=?').run(pid,'factory');
   return head.apply(this,args);
  };
  try{assert.equal((await act('factory','qc',1,readings)).status,409);}finally{bucket.head=head;}
  assert.equal(db.prepare('SELECT MAX(seq) n FROM studio_job_events WHERE project=? AND unit=?').get(pid,other.id).n,1);
  db.prepare('INSERT INTO studio_access VALUES(?,?,?) ON CONFLICT(project_id,member) DO UPDATE SET role=excluded.role').run(pid,'factory','factory');
 }
 assert.equal((await act('factory','qc',1,readings)).status,201);
 assert.equal((await act('factory','pack',2,{note:'factory package'})).status,201);
 assert.equal((await act('factory','install',3,{note:'factory installation',location:'wall B'})).status,201);
 assert.equal((await act('owner','accept',4,{note:'owner acceptance',customer:'A'})).status,201);
}
console.log('Scoped job ACL: factory QC/packing/install, owner planning/acceptance, legacy editor/viewer data lockout and exact-role/revoke races verified.');
{
 const snapshot=await(await use('owner',{receipt})).json();
 const available=snapshot.units.filter(u=>!db.prepare('SELECT 1 FROM studio_job_events WHERE project=? AND unit=?').get(pid,u.id));assert(available.length>=2);
 const [target,peer]=available,send=(who,u,action,expected,values={},request=crypto.randomUUID())=>use(who,{receipt,request},{unit:u.id,action,expected,...values});
 const observation={text:'Shared TEST blocking scratch',severity:'blocking',anchor:{kind:'front',x:.3,y:.6}};
 assert.equal((await send('owner',target,'observe',0,{observation})).status,409,'observations require actual packing or installation');
 assert.equal(snapshot.subject,'owner');assert.equal((await(await use('factory',{})).json()).subject,'factory');
 for(const u of [target,peer]){
  assert.equal((await send('owner',u,'plan',0,{reference:'PRIVATE inspection reference',tolerances:Object.fromEntries(u.checks.map(c=>[c.key,c.unit==='قطعة'?0:1]))})).status,201);
  assert.equal((await send('factory',u,'qc',1,{actual:Object.fromEntries(u.checks.map(c=>[c.key,c.nominal])),note:'PRIVATE quality note'})).status,201);
  assert.equal((await send('factory',u,'pack',2,{note:'PRIVATE packing note'})).status,201);
 }
 for(const anchor of [{kind:'front',x:-.1,y:.5},{kind:'front',x:1.01,y:.5},{kind:'front',x:'0.3',y:.5},{kind:'front',x:.3,y:.5,unit:peer.id},{kind:'check',key:'outside-this-unit'}]){
  assert.equal((await send('factory',target,'observe',3,{observation:{...observation,anchor}})).status,422);
 }
 for(const value of [{...observation,id:'forged-id'},{...observation,severity:'critical'},{...observation,text:'x'.repeat(501)},{...observation,text:''}])assert.equal((await send('factory',target,'observe',3,{observation:value})).status,422);
 assert.equal((await send('factory',target,'observe',3,{observation,state:'installed'})).status,422,'annotation cannot overpost a state');
 for(const role of ['rep','store','viewer','editor'])assert.equal((await send(role,target,'observe',3,{observation})).status,403);
 const mismatchedBody={unit:peer.id,action:'observe',expected:3,observation};
 assert.equal((await use('factory',{receipt,request:crypto.randomUUID()},mismatchedBody,{'X-Studio-Subject':'owner'})).status,403,'an account switch cannot submit a previous subject draft');
 assert.equal(db.prepare('SELECT MAX(seq) n FROM studio_job_events WHERE project=? AND unit=?').get(pid,peer.id).n,3);
 const bucket=globalThis.__shopJobs.env.BUCKET,head=bucket.head;
 bucket.head=async function(...args){db.prepare('UPDATE studio_access SET role=? WHERE project_id=? AND member=?').run('rep',pid,'factory');return head.apply(this,args);};
 try{assert.equal((await send('factory',peer,'observe',3,{observation})).status,409,'live access is checked by the event insert');}
 finally{bucket.head=head;db.prepare('UPDATE studio_access SET role=? WHERE project_id=? AND member=?').run('factory',pid,'factory');}
 assert.equal(db.prepare('SELECT MAX(seq) n FROM studio_job_events WHERE project=? AND unit=?').get(pid,peer.id).n,3);
 const rid=crypto.randomUUID();assert.equal((await send('factory',target,'observe',3,{observation},rid)).status,201);
 const replayBody={unit:target.id,action:'observe',expected:3,observation};
 assert.equal((await use('factory',{receipt,request:rid},replayBody,{'X-Studio-Subject':'owner'})).status,403,'subject mismatch is rejected before idempotent replay');
 assert.equal((await use('factory',{receipt,request:rid},replayBody,{'X-Studio-Subject':'factory'})).status,200,'the authenticated subject can safely replay');
 assert.equal((await send('factory',target,'observe',3,{observation},rid)).status,200,'same request safely replays');
 assert.equal((await send('owner',target,'observe',3,{observation},rid)).status,409,'another actor cannot replay an observation request');
 assert.equal((await send('factory',target,'observe',3,{observation:{...observation,text:'changed'}},rid)).status,409);
 assert.equal((await send('factory',target,'observe',3,{observation})).status,409,'stale unit sequence cannot append');
 const infoId=crypto.randomUUID(),info={text:'Shared TEST informational check',severity:'info',anchor:{kind:'check',key:target.checks[0].key}};
 assert.equal((await send('owner',target,'observe',4,{observation:info},infoId)).status,201);
 assert.equal((await send('factory',target,'install',5,{location:'PRIVATE installed location',note:'PRIVATE install note'})).status,422,'blocking observation prevents installation');
 assert.equal((await send('factory',peer,'resolve',3,{observationId:rid,note:'wrong unit'})).status,422);
 assert.equal((await send('factory',target,'resolve',5,{observationId:'missing-observation-id',note:'unknown'})).status,422);
 assert.equal((await send('factory',target,'resolve',5,{observationId:rid,note:''})).status,422);
 assert.equal((await send('factory',target,'resolve',5,{observationId:rid,note:'x'.repeat(501)})).status,422);
 const resolutionId=crypto.randomUUID(),resolution={observationId:rid,note:'Shared TEST repair verified'};
 assert.equal((await send('factory',target,'resolve',5,resolution,resolutionId)).status,201);
 assert.equal((await send('factory',target,'resolve',5,resolution,resolutionId)).status,200);
 assert.equal((await send('owner',target,'resolve',6,resolution)).status,422,'resolved observations cannot be rewritten');
 assert.equal((await send('factory',target,'install',6,{location:'PRIVATE installed location',note:'PRIVATE install note'})).status,201);
 const afterId=crypto.randomUUID();assert.equal((await send('owner',target,'observe',7,{observation:{...observation,text:'Shared TEST installed defect'}},afterId)).status,201);
 assert.equal((await send('owner',target,'accept',8,{customer:'PRIVATE customer',note:'PRIVATE acceptance note'})).status,422,'blocking observation prevents acceptance');
 assert.equal((await send('factory',target,'resolve',8,{observationId:afterId,note:'Shared TEST installation repaired'})).status,201);
 assert.equal((await send('factory',target,'accept',9,{customer:'PRIVATE customer',note:'PRIVATE acceptance note'})).status,403);
 assert.equal((await send('owner',target,'accept',9,{customer:'PRIVATE customer',note:'PRIVATE acceptance note'})).status,201,'informational observations do not block acceptance');
 assert.equal((await send('owner',target,'observe',10,{observation})).status,409);
 assert.equal((await send('factory',target,'resolve',10,{observationId:infoId,note:'too late'})).status,409);
 const view=await(await use('factory',{receipt})).json(),history=view.events.filter(e=>e.unit===target.id),serialized=JSON.stringify(view);
 assert.equal(view.subject,'factory');assert.equal(history.find(e=>e.action==='observe').data.observation.id,rid);
 assert.deepEqual(history.filter(e=>['observe','resolve'].includes(e.action)).map(e=>e.state),['packed','packed','packed','installed','installed']);
 for(const phrase of [observation.text,info.text,resolution.note,'Shared TEST installed defect','Shared TEST installation repaired'])assert(serialized.includes(phrase),'technical annotation shared: '+phrase);
 for(const phrase of ['PRIVATE inspection reference','PRIVATE quality note','PRIVATE packing note','PRIVATE installed location','PRIVATE install note','PRIVATE customer','PRIVATE acceptance note'])assert(!serialized.includes(phrase),'historical private prose remains excluded: '+phrase);
 assert.equal(history.at(-1).state,'accepted');assert.equal(db.prepare('SELECT COUNT(*) n FROM studio_job_events WHERE project=? AND unit=?').get(pid,target.id).n,10);
}
console.log('Delivery observations: receipt-unit anchors, shared technical notes, immutable resolution, blocking install/accept gates, preserved states, ACL, subject binding and retry/conflict controls.');
{
 const RealDate=Date;let now='2026-12-31T23:30:00Z';
 globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return RealDate.parse(now);}};
 try{
  const current=await(await use('owner',{receipt})).json();assert.equal(current.serverNow,'2026-12-31T23:30:00.000Z');
  const accepted=current.units.filter(u=>current.events.filter(e=>e.unit===u.id).at(-1)?.state==='accepted'),[primary,other]=accepted;assert(primary&&other);
  const untouched=current.units.find(u=>!current.events.some(e=>e.unit===u.id));assert(untouched);
  const seq=u=>db.prepare('SELECT COALESCE(MAX(seq),0) n FROM studio_job_events WHERE project=? AND unit=?').get(pid,u.id).n;
  const send=(who,u,action,values={},request=crypto.randomUUID(),expected=seq(u),headers={'X-Studio-Subject':who})=>use(who,{receipt,request},{action,unit:u.id,expected,...values},headers);
  const oldHandover=db.prepare("SELECT * FROM studio_job_events WHERE project=? AND unit=? AND action='accept'").get(pid,primary.id),original=JSON.stringify(oldHandover);
  const terms={reference:'TEST WARRANTY 2026',provider:'TEST provider',startsOn:'2026-01-01',endsOn:'2026-12-31',coverage:'TEST documented repair coverage',exclusions:''};
  const ticket={title:'TEST service hinge',description:'TEST door condition after handover',priority:'urgent',anchor:{kind:'front',x:.2,y:.7}};
  assert.equal((await send('owner',untouched,'service-open',{ticket})).status,409);
  assert.equal((await send('owner',untouched,'warranty-record',{terms})).status,409);
  for(const role of ['rep','store','viewer','editor'])assert.equal((await send(role,primary,'service-open',{ticket})).status,403);
  assert.equal((await send('factory',primary,'warranty-record',{terms})).status,403);
  assert.equal((await send('owner',primary,'service-open',{ticket,handoverSeq:99})).status,422);
  assert.equal((await send('owner',primary,'service-open',{ticket:{...ticket,anchor:{kind:'check',key:'foreign-check'}}})).status,422);
  const ticketId=crypto.randomUUID(),openingExpected=seq(primary),opening=await send('factory',primary,'service-open',{ticket},ticketId,openingExpected);assert.equal(opening.status,201);assert.equal((await opening.json()).state,'accepted');
  assert.equal((await send('factory',primary,'service-open',{ticket},ticketId,openingExpected)).status,200);
  assert.equal((await send('factory',primary,'service-open',{ticket:{...ticket,title:'changed'}},ticketId,openingExpected)).status,409);
  assert.equal((await send('factory',primary,'service-open',{ticket},ticketId,openingExpected,{'X-Studio-Subject':'owner'})).status,403);
  const review={ticketId,diagnosis:'TEST inspected hinge',coverage:'covered',reference:'TEST manual coverage decision'};
  assert.equal((await send('factory',primary,'service-review',review)).status,403);
  assert.equal((await send('owner',primary,'service-review',review)).status,422,'no warranty must not imply coverage');
  assert.equal((await send('owner',primary,'service-close',{ticketId,customer:'A',note:'too early'})).status,409);
  assert.equal((await send('owner',primary,'service-review',{...review,coverage:'outside'})).status,201);
  assert.equal((await send('factory',primary,'service-repair',{ticketId,work:'TEST adjustment',verification:''})).status,422);
  assert.equal((await send('factory',primary,'service-repair',{ticketId,work:'TEST adjustment',verification:'TEST repeated opening'})).status,201);
  assert.equal((await send('factory',primary,'service-reopen',{ticketId,reason:'TEST still noisy'})).status,201,'repaired may reopen without pretending to be customer accepted');
  for(const value of [{...terms,startsOn:'2026-02-30'},{...terms,endsOn:'2025-12-31'},{...terms,coverage:''},{...terms,automatic:true}])assert.equal((await send('owner',primary,'warranty-record',{terms:value})).status,422);
  assert.equal((await send('owner',primary,'warranty-record',{terms})).status,201);
  // Owner-only service decisions remain protected if ownership changes while
  // the immutable receipt is being loaded, after the early role check passed.
  const bucket=globalThis.__shopJobs.env.BUCKET,head=bucket.head,priorSeq=seq(primary);
  bucket.head=async function(...args){db.prepare('UPDATE studio_projects SET owner=? WHERE id=?').run('replacement-owner',pid);db.prepare('INSERT INTO studio_access VALUES(?,?,?)').run(pid,'owner','factory');return head.apply(this,args);};
  try{assert.equal((await send('owner',primary,'service-review',review)).status,409);}
  finally{bucket.head=head;db.prepare('UPDATE studio_projects SET owner=? WHERE id=?').run('owner',pid);db.prepare('DELETE FROM studio_access WHERE project_id=? AND member=?').run(pid,'owner');}
  assert.equal(seq(primary),priorSeq);
  assert.equal((await send('owner',primary,'service-review',review)).status,201);
  const read=async who=>(await(await use(who,{receipt})).json()).events,firstReview=serviceTickets((await read('owner')).filter(e=>e.unit===primary.id))[0].review;
  assert.equal(firstReview.warranty.reference,terms.reference);assert.equal(firstReview.warranty.endsOn,'2026-12-31');
  assert.equal((await send('owner',primary,'warranty-record',{terms:{...terms,reference:'TEST later warranty',coverage:'TEST revised text'}})).status,201);
  assert.deepEqual(serviceTickets((await read('owner')).filter(e=>e.unit===primary.id))[0].review,firstReview);
  assert.equal((await send('factory',primary,'service-repair',{ticketId,work:'TEST replaced hinge',verification:'TEST 20 cycles'})).status,201);
  assert.equal((await send('factory',primary,'service-close',{ticketId,customer:'PRIVATE service customer',note:'PRIVATE service closure'})).status,403);
  assert.equal((await send('owner',primary,'service-close',{ticketId,customer:'PRIVATE service customer',note:'PRIVATE service closure'})).status,201);
  now='2027-01-01T00:30:00Z';assert.equal((await send('factory',primary,'service-reopen',{ticketId,reason:'TEST recurrence next day'})).status,201);
  assert.equal((await send('owner',primary,'service-review',review)).status,422,'new cycle after expiry cannot inherit first-cycle coverage');
  assert.equal((await send('owner',primary,'service-review',{...review,coverage:'goodwill'})).status,201);
  assert.equal((await send('factory',other,'service-repair',{ticketId,work:'wrong unit',verification:'wrong unit'})).status,422);
  const sameSeq=seq(primary),ids=[crypto.randomUUID(),crypto.randomUUID()],concurrent=await Promise.all(ids.map(id=>send('factory',primary,'service-open',{ticket:{...ticket,title:'TEST second ticket'}},id,sameSeq)));
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409]);
  assert.equal((await send('owner',primary,'service-repair',{ticketId,work:'stale',verification:'stale'},crypto.randomUUID(),sameSeq)).status,409);
  const otherId=crypto.randomUUID();assert.equal((await send('factory',other,'service-open',{ticket:{...ticket,anchor:{kind:'check',key:other.checks[0].key}}},otherId)).status,201);
  assert.equal((await send('owner',other,'service-review',{...review,ticketId:otherId,coverage:'outside'})).status,201);
  const own=await read('owner'),safe=await read('factory'),primaryEvents=own.filter(e=>e.unit===primary.id),tickets=serviceTickets(primaryEvents),serviceEvents=primaryEvents.filter(e=>e.action==='warranty-record'||e.action.startsWith('service-'));
  assert.equal(tickets.length,2);assert.equal(tickets[0].status,'reviewed');assert.equal(tickets[1].status,'open');assert.equal(tickets[0].handoverSeq,oldHandover.seq);assert.equal(tickets[0].openedAt,'2026-12-31T23:30:00.000Z');assert.equal(tickets[0].cycleOpenedAt,'2027-01-01T00:30:00.000Z');assert(tickets[0].history.some(e=>e.action==='service-close'));assert(serviceEvents.every(e=>e.state==='accepted'));
  assert.equal(serviceWarranty(own.filter(e=>e.unit===other.id)),null);assert.equal(serviceTickets(own.filter(e=>e.unit===other.id))[0].review.warranty,null);
  assert.equal(JSON.stringify(db.prepare("SELECT * FROM studio_job_events WHERE project=? AND unit=? AND action='accept'").get(pid,primary.id)),original);
  const safeText=JSON.stringify(safe);for(const shared of [ticket.description,terms.provider,'TEST 20 cycles','TEST recurrence next day','TEST manual coverage decision'])assert(safeText.includes(shared));
  for(const secret of ['PRIVATE service customer','PRIVATE service closure',oldHandover.actor_name])assert(!safeText.includes(secret));
  const closure=safe.find(e=>e.unit===primary.id&&e.action==='service-close');assert.deepEqual(closure.data,{ticketId,status:'closed'});assert.equal(serviceTickets(safe.filter(e=>e.unit===primary.id))[0].status,'reviewed');
 }finally{globalThis.Date=RealDate;}
}
console.log('Maintenance: accepted receipt custody, manual warranty and UTC cycle coverage, independent tickets, role races, privacy, replay/subject/CAS and immutable handover/history.');
assert.equal((await use('factory',{receipt,action:'surface-dxf',unit})).status,422);
assert.equal((await use('factory',{receipt,action:'surface-dxf',unit:'other-user-unit'})).status,404);
const proposed=structuredClone(run.doc);proposed.room.workshop.catalog=seedCatalog();proposed.room.workshop.catalog.terms.worktop='include';
const slab=kitchenGeometry(proposed.kitchen,proposed.room).worktops[0],len=(slab.end-slab.start)*10,depth=slab.depth*10;
const cut=acceptPattern(proposed,slab,{source:'الموقع',datum:'الركن',materialRef:'Slab A',limitRef:'Factory chart A',levelRef:'رفع بعد التركيب',inspector:'الفني',date:'2026-10-31',fitToleranceMm:2,edgeGapMm:10,webMm:10,thicknessMm:slab.height*10,outer:[[0,0],[len,0],[len,depth],[0,depth]],holes:[]});
assert(cut.ok,cut.reason);const slabDigest=await version(cut.doc,5),slabKey='e'.repeat(64),slabId='surface:'+slab.id,slabReceipt='full:'+slabKey;
db.prepare('INSERT INTO studio_releases(project_id,revision,issuer,digest,design_key,total_minor,issued,scope_json) VALUES(?,?,?,?,?,?,?,?)').run(pid,5,'owner',slabDigest,slabKey,450,'2026-11-01',JSON.stringify([slabId]));
await version(proposed,6);
const exported=await use('factory',{receipt:slabReceipt,action:'surface-dxf',unit:slabId});assert.equal(exported.status,200);assert.match(exported.headers.get('content-type'),/dxf/);assert.match(await exported.text(),/LWPOLYLINE/);
assert.equal((await(await use('factory',{receipt:slabReceipt})).json()).units[0].downloadableCut,true);
assert.equal((await use('outsider',{receipt:slabReceipt,action:'surface-dxf',unit:slabId})).status,404);
{
 const slabUnit=(await(await use('owner',{receipt:slabReceipt})).json()).units[0];
 const post=(who,action,expected,values,request=crypto.randomUUID())=>use(who,{receipt:slabReceipt,request},{unit:slabId,action,expected,...values});
 assert.equal((await post('owner','plan',0,{reference:'TEST surface checks',tolerances:Object.fromEntries(slabUnit.checks.map(c=>[c.key,0]))})).status,201);
 assert.equal((await post('factory','qc',1,{actual:Object.fromEntries(slabUnit.checks.map(c=>[c.key,c.nominal])),note:'PRIVATE surface QC'})).status,201);
 assert.equal((await post('factory','pack',2,{note:'PRIVATE surface packing'})).status,201);
 const observation={text:'TEST surface edge note',severity:'info',anchor:{kind:'front',x:.5,y:.5}};
 assert.equal((await post('factory','observe',3,{observation})).status,422,'surface dimensions are not an invented cabinet front');
 observation.anchor={kind:'check',key:slabUnit.checks[0].key};
 const concurrent=await Promise.all([post('owner','observe',3,{observation}),post('factory','observe',3,{observation})]);
 assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409],'only one observation consumes the expected sequence');
 assert.equal((await(await use('owner',{receipt:slabReceipt})).json()).events.at(-1).data.observation.anchor.key,slabUnit.checks[0].key);
}
{ // A receipt page is read for every inspection reading and every download. The snapshot behind it is content-addressed, so a verified one is not downloaded again.
 const reads=globalThis.__shopJobs.env.BUCKET.reads,before={...reads};
 const pages=[];for(let i=0;i<3;i++){const r=await use('factory',{receipt:slabReceipt});assert.equal(r.status,200);pages.push(await r.json());}
 const stable=page=>{const {serverNow,...snapshot}=page;assert(Number.isFinite(Date.parse(serverNow)));return snapshot;};
 assert.deepEqual(stable(pages[1]),stable(pages[0]));assert.deepEqual(stable(pages[2]),stable(pages[0]),'a cached receipt is identical apart from the fresh authoritative server clock');
 assert.equal(reads.get-before.get,0,'no repeat download of an unchanged snapshot');assert.equal(reads.head-before.head,3,'one cheap existence/etag check per request');
}
const batchKey='b'.repeat(64);db.prepare('INSERT INTO studio_batches(project_id,revision,design_key,unit_ids,issuer,digest,material_minor,issued) VALUES(?,?,?,?,?,?,?,?)').run(pid,2,batchKey,JSON.stringify([unit]),'owner',digest,20,'2026-10-31'); 
const duplicate=await use('owner',{receipt:'batch:'+batchKey,request:crypto.randomUUID()},{unit,expected:0,action:'plan',...tolerance});assert.equal(duplicate.status,409);
const remainder='c'.repeat(64),remaining=run.doc.kitchen.units.at(-1).id;
db.prepare('INSERT INTO studio_releases(project_id,revision,issuer,digest,design_key,total_minor,issued,scope_json) VALUES(?,?,?,?,?,?,?,?)').run(pid,3,'owner',digest,remainder,99,'2026-11-01',JSON.stringify([remaining]));
const remainderJob=await(await use('factory',{receipt:'full:'+remainder})).json();
assert.deepEqual(remainderJob.units.map(u=>u.id),[remaining]);assert.equal(remainderJob.events.length,0);
files.set('kitchen-projects/'+pid+'/'+digest+'.json',{...stored,design:{...stored.design,unexpected:true}});
assert.equal((await use('factory',{receipt})).status,503);
console.log('Receipt-bound shop tracking: immutable archived nominal checks; failed QA retained and packaging blocked, accepted remeasure, printable unique packing identity, installation, separate owner acceptance, outsider/viewer/editor and duplicate/retry controls.');
const {approveScribe}=await import('../public/kitchen-wall-scribe.js');
const scribeDoc=structuredClone(run.doc),scribeCat=seedCatalog(),endUnit=scribeDoc.kitchen.units.toSorted((a,b)=>a.u-b.u).at(-1).id;
scribeCat.scribePolicies={PL:{name:'طرف وزرة',reference:'Drawing B',sku:'BODY-6',grain:'horizontal',minimumBlankMm:30,maxStripMm:1200,minimumLipMm:10,roughAllowanceMm:2,spacingMm:100,cutToleranceMm:.4,minGapMm:1,targetGapMm:2,maxGapMm:3}};
scribeDoc.room.workshop.catalog=scribeCat;
const traced=approveScribe(scribeDoc,'back',{unitId:endUnit,against:'right',side:'end',kind:'plinth',recipe:'PL',plinthHeightMm:120,insetMm:120,accuracyMm:.3,reference:'Field-S',reviewer:'Tech',linearVerified:true,stations:[[0,1],[60,-2],[120,1]]},scribeCat);
assert(traced.ok,traced.reason);
const sd=await version(traced.doc,9),sk='9'.repeat(64),sr='full:'+sk;
db.prepare('INSERT INTO studio_releases(project_id,revision,issuer,digest,design_key,total_minor,issued,scope_json) VALUES(?,?,?,?,?,?,?,?)').run(pid,9,'owner',sd,sk,340,'2026-11-01',JSON.stringify([endUnit]));
const savedJob=(await(await use('factory',{receipt:sr})).json()).units[0],shape=savedJob.scribes[0].id;
const dxfQuery={receipt:sr,unit:endUnit,shape,action:'scribe-dxf'};
assert.match(await(await use('factory',dxfQuery)).text(),/FINISHED_SCRIBE/);
assert.equal((await use('outsider',dxfQuery)).status,404);assert.equal((await use('factory',{...dxfQuery,unit})).status,404);assert.equal((await use('factory',{...dxfQuery,shape:'different'})).status,422);
const sc=savedJob.checks.filter(f=>f.maxTolerance!=null);assert.equal(sc.length,3);assert.equal(sc[0].maxTolerance,.4);
const tolerances=Object.fromEntries(savedJob.checks.map(f=>[f.key,.3])),tPlan=(v)=>use('owner',{receipt:sr,request:crypto.randomUUID()},{action:'plan',unit:endUnit,expected:0,reference:'QC-PL',tolerances:v});
assert.equal((await tPlan({...tolerances,[sc[0].key]:1})).status,422);
assert.equal((await tPlan(tolerances)).status,201);
console.log('Saved scribe DXF checked against ACL, scope and shape of the actual issued unit; inspection may tighten but never exceed the factory contour tolerance.');

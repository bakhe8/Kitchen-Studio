import {confirmFixtureFitout} from '../tools/fixture-kitchen-fitout.mjs';
import {build} from 'esbuild';
import {prepareShopDomain} from './prepare-shop-domain.mjs';
await prepareShopDomain();
import {DatabaseSync} from 'node:sqlite';
import {AsyncLocalStorage} from 'node:async_hooks';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url)),db=new DatabaseSync(':memory:'),users=new AsyncLocalStorage(),blobs=new Map();
for(const file of (await readdir(root+'drizzle')).filter(p=>p.endsWith('.sql')).sort())db.exec(await readFile(root+'drizzle/'+file,'utf8'));
const prepare=(query,values=[])=>({
 bind(...v){return prepare(query,v);},first(){return db.prepare(query).get(...values);},
 all(){return {results:db.prepare(query).all(...values)};},run(){return {meta:{changes:db.prepare(query).run(...values).changes}};}
});
globalThis.__kitchenSyncFixture={auth:()=>users.getStore(),env:{DB:{prepare,batch(statements){db.exec('BEGIN');try{const r=statements.map(s=>s.run());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}},BUCKET:{async get(k){return blobs.has(k)?{body:blobs.get(k),arrayBuffer:async()=>Uint8Array.from(blobs.get(k)).buffer,json:async()=>JSON.parse(new TextDecoder().decode(blobs.get(k)))}:null;},async put(k,v){if(!blobs.has(k))blobs.set(k,v.slice());}}}};
const bundle=await build({absWorkingDir:root,entryPoints:['app/api/projects/route.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'fixture-auth-bindings',setup(b){
 b.onResolve({filter:/^(cloudflare:workers|.*chatgpt-auth)$/},a=>({path:a.path,namespace:'sync-fixture'}));
 b.onLoad({filter:/.*/,namespace:'sync-fixture'},a=>({contents:a.path==='cloudflare:workers'?'export const env=globalThis.__kitchenSyncFixture.env;':'export const getChatGPTUser=globalThis.__kitchenSyncFixture.auth;'}));
}}]});
const {GET,POST}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const id=crypto.randomUUID(),actor=name=>name?{userId:'id-'+name,email:name+'@example.test'}:null;
function call(name,args={},body){
 const url='https://kitchen.test/api/projects?'+new URLSearchParams(args);
 const request=new Request(url,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Request':'1',Origin:'https://kitchen.test'},body:typeof body==='string'?body:JSON.stringify(body)});
 return users.run(actor(name),()=>body===undefined?GET(request):POST(request));
}
const {createKitchen}=await import('../public/kitchen-model.js');
const archive=n=>({type:'kitchen-studio',version:2,design:{room:{width:500,length:500,height:280,name:'Rev '+n},kitchen:createKitchen({width:500,length:500,height:280},'empty')},fieldFiles:[],photos:{}});
const save=(name,expected,request,which=expected)=>call(name,{id,expected,request,name:'Example'},archive(which));
const a=crypto.randomUUID(),b=crypto.randomUUID();
assert.equal((await call(null)).status,401);
// A D1 outage must reach the sync panel as JSON it can show, not as the empty 500 the platform would send.
{const fixture=globalThis.__kitchenSyncFixture,realDb=fixture.env.DB,realError=console.error;
 fixture.env.DB={prepare(){throw Error('D1 unavailable');},batch(){throw Error('D1 unavailable');}};console.error=()=>{};
 try{const down=await call('owner');assert.equal(down.status,503);assert.match(down.headers.get('content-type'),/json/);assert.ok((await down.json()).error);}
 finally{fixture.env.DB=realDb;console.error=realError;}}
for(const name of ['owner','viewer','editor','outside'])assert.equal((await call(name)).status,200);
assert.equal((await save('owner',0,a)).status,201);
db.prepare('UPDATE studio_versions SET request_digest=NULL WHERE project_id=?').run(id);
assert.equal((await save('owner',0,a)).status,200);
assert.equal((await save('owner',0,a,42)).status,409);
assert.equal((await call('outside',{id})).status,404);
assert.equal((await save('outside',0,b)).status,404);
const invite=(who,to,role)=>call(who,{id,action:'share'},{email:to+'@example.test',role});
assert.equal((await invite('owner','viewer','viewer')).status,200);
assert.equal((await invite('owner','editor','editor')).status,200);
assert.equal((await call('viewer',{id})).status,403,'legacy shares require a scoped assignment before data is returned');
assert.equal((await save('viewer',1,b)).status,403);
assert.equal((await invite('editor','outside','editor')).status,403);
assert.equal((await save('editor',1,b)).status,403,'legacy editor cannot upload a full archive');
const results=await Promise.all([save('owner',1,crypto.randomUUID(),10),save('owner',1,crypto.randomUUID(),20)]);
assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
assert.equal((await save('owner',1,b)).status,409);
assert.equal((await call('editor',{id,revision:'1'})).status,403);
assert.equal((await(await call('owner',{id,revision:'1'})).json()).design.room.name,'Rev 0');
assert.equal((await(await call('owner',{id,action:'versions'})).json()).versions.length,2);
assert.equal((await call('owner',{id,action:'revoke'},{email:'editor@example.test'})).status,200);
assert.equal((await call('editor',{id})).status,404);
assert.equal((await call('owner',{id,action:'members'})).status,200);
assert.equal((await call('viewer',{id,action:'members'})).status,403);
assert.equal((await invite('owner','unknown','editor')).status,400);
assert.equal((await call('owner',{id,expected:2,name:'Example',request:b},'{}')).status,400);
console.log('Project sync validated with migrated SQLite, role enforcement, same-body retries, 409 conflict, concurrent save, immutable historical R2 contents, lists and revocation.');

// The local workstation stamp is independent from a shop release deposited by the owner.
const rel=(who,revision,project=id)=>call(who,{id:project,action:'release',revision},'{}');
assert.equal((await rel('viewer',2)).status,403);
assert.equal((await rel('owner',1)).status,409);
assert.equal((await rel('owner',2)).status,422);
const {makeChainExample,readChainRange,attestChain}=await import('../public/kitchen-chain-model.js');
const {planWorkshopRow}=await import('../public/kitchen-production-row.js');
const {seedCatalog,getFactoryCatalog}=await import('../public/kitchen-workshop-factory.js');
const {normalizeWorkshopCatalogs}=await import('../public/kitchen-catalog-records.js');
const {approvalState}=await import('../public/kitchen-workshop-state.js');
const {cleanIdea}=await import('../public/kitchen-ideas.js');
const demo=makeChainExample(),cat=seedCatalog();cat.approved=true;
cat.items.forEach(i=>{i.price=10;});Object.assign(cat.terms,{labor:0,installation:0,delivery:0,marginPct:0,taxPct:0});
demo.room.workshop.catalog=cat;
demo.room.workshop.chains.back=attestChain(demo,'back',demo.room.workshop.chains.back,{name:'QA',reference:'Field survey 01'}).chain;
const drawing=planWorkshopRow(demo,{...readChainRange(demo,'back'),tier:'base',wanted:{rice:false,sink:false,dishwasher:false}});
assert.equal(drawing.ok,true,drawing.reason);
const signed=cleanIdea(confirmFixtureFitout(drawing.doc)),stamps={};signed.room.workshop.approvals=stamps;
for(const k of ['structure','customer']){
 const state=await approvalState(signed);stamps[k]={key:state.keys[k],date:new Date().toISOString(),name:'Facility QA'};
}
const pid=crypto.randomUUID(),payload={...archive(50),design:signed},saved=await call('owner',{id:pid,expected:0,request:crypto.randomUUID(),name:'Fixture'},payload);
assert.equal(saved.status,201);
assert.equal((await call('owner',{id:pid,action:'release',revision:1,review:'stale-local'},'{}')).status,409);
const minted=await rel('owner',1,pid),mintResult=await minted.json();assert.equal(minted.status,200,JSON.stringify(mintResult));assert.ok(mintResult.receipt.design_key&&mintResult.receipt.total_minor>0);
assert.deepEqual((await(await rel('owner',1,pid)).json()).receipt,mintResult.receipt);
await call('owner',{id:pid,action:'share'},{email:'editor@example.test',role:'editor'});
const fake=structuredClone(payload);fake.design.room.workshop.storeCatalog.items[0].price=12;
assert.equal((await call('editor',{id:pid,expected:1,request:crypto.randomUUID(),name:'Faked price'},fake)).status,403);
for(const [record,edit] of [
 ['storeCatalog',r=>{r.approved=false;}],
 ['factoryRecipes',r=>{r.families.storage.recipe[0].count++;}],
 ['factoryRecipes',r=>{r.approved=false;}],
 ['pricingTerms',r=>{r.terms.delivery=20;}],
 ['pricingTerms',r=>{r.approved=false;}],
]){
 const changed=structuredClone(payload);edit(changed.design.room.workshop[record]);
 assert.equal((await call('editor',{id:pid,expected:1,request:crypto.randomUUID(),name:'Protected '+record},changed)).status,403,'Editors cannot change '+record+' contents or approvals');
}
const reference=structuredClone(payload);reference.design.room.workshop.referenceOrder={orderNo:'A-17',toleranceMm:1,lines:[],approval:{stamp:'a'.repeat(64),reviewer:'QA',date:'2026-11-01'}};
assert.equal((await call('editor',{id:pid,expected:1,request:crypto.randomUUID(),name:'Forged reference signoff'},reference)).status,403);
const forged=structuredClone(payload);forged.design.room.workshop.approvals.release={key:'forged'};
assert.equal((await call('editor',{id:pid,expected:1,request:crypto.randomUUID(),name:'Forged'},forged)).status,403);
const change=structuredClone(payload);change.design.room.name='Customer copy';
assert.equal((await call('editor',{id:pid,expected:1,request:crypto.randomUUID(),name:'Customer copy'},change)).status,403);
assert.equal((await call('owner',{id:pid,expected:1,request:crypto.randomUUID(),name:'Customer copy'},change)).status,200);
assert.equal((await call('editor',{id:pid,action:'receipt',revision:1})).status,403);
assert.equal((await(await call('owner',{id:pid,action:'receipt',revision:2})).json()).receipt,null);
assert.deepEqual((await(await call('owner',{id:pid,action:'receipt',revision:1})).json()).receipt,mintResult.receipt);
console.log('Owner-only factory release revalidates stored CAD, customer fingerprints, measured survey and live pricing; blocks invalid, stale and editor-issued releases, retains immutable receipt for the issued revision and protects the owner catalog.');

// An old archive and its separated representation grant exactly the same rights.
// Owner migration preserves old projects; legacy sharing no longer grants data.
{
 const legacy=structuredClone(payload),w=legacy.design.room.workshop;
 w.catalog=getFactoryCatalog(legacy.design);for(const key of ['storeCatalog','factoryRecipes','pricingTerms','catalogMeta'])delete w[key];
 const oldId=crypto.randomUUID();
 assert.equal((await call('owner',{id:oldId,expected:0,request:crypto.randomUUID(),name:'Legacy record'},legacy)).status,201);
 await call('owner',{id:oldId,action:'share'},{email:'editor@example.test',role:'editor'});
 const split=structuredClone(legacy);split.design.room.workshop=normalizeWorkshopCatalogs(split.design.room.workshop);
 assert.equal((await call('editor',{id:oldId,expected:1,request:crypto.randomUUID(),name:'Equivalent separated record'},split)).status,403);
 assert.equal((await call('owner',{id:oldId,expected:1,request:crypto.randomUUID(),name:'Equivalent separated record'},split)).status,200);
 const edited=structuredClone(split);edited.design.room.workshop.pricingTerms.terms.delivery=1;
 assert.equal((await call('editor',{id:oldId,expected:2,request:crypto.randomUUID(),name:'Unapproved pricing edit'},edited)).status,403);
}

// Owner approval writes are recorded with the authenticated actor. Legacy and
// scoped shares cannot read the private approval log or grant final approval.
{
 const ap=crypto.randomUUID(),log=async(who='owner')=>(await(await call(who,{id:ap,action:'approvals'})).json()).approvals;
 assert.equal((await call('owner',{id:ap,expected:0,request:crypto.randomUUID(),name:'Approval log'},payload)).status,201);
 const first=await log();
 assert.deepEqual(first.map(e=>e.kind+(e.subject?':'+e.subject:'')).sort(),['chain:back','customer','structure'],'stamps present in the first revision are recorded');
 assert(first.every(e=>e.actor_name==='owner@example.test'&&e.revision===1&&e.recorded.endsWith('Z')),'the session identity and the server clock, not the typed name');
 assert.equal(first.find(e=>e.kind==='chain').detail,'Field survey 01');
 await call('owner',{id:ap,action:'share'},{email:'editor@example.test',role:'editor'});
 await call('owner',{id:ap,action:'share'},{email:'viewer@example.test',role:'viewer'});
 const same=structuredClone(payload);same.design.room.name='Unchanged stamps';
 assert.equal((await call('editor',{id:ap,expected:1,request:crypto.randomUUID(),name:'Rename'},same)).status,403);
 assert.equal((await call('owner',{id:ap,expected:1,request:crypto.randomUUID(),name:'Rename'},same)).status,200);
 assert.equal((await log()).length,3,'an unchanged stamp is not recorded again');
 // A typed customer name never replaces the authenticated actor in the log.
 const approve=structuredClone(same);approve.design.room.workshop.approvals.customer={...approve.design.room.workshop.approvals.customer,name:'العميل أحمد'};
 const request=crypto.randomUUID(),sent=()=>call('owner',{id:ap,expected:2,request,name:'Customer approval'},approve);
 assert.equal((await sent()).status,200);
 const after=await log();assert.equal(after.length,4);
 const typed=after.find(e=>e.stamp_name==='العميل أحمد');
 assert.equal(typed.actor_name,'owner@example.test');assert.equal(typed.revision,3);assert.equal(typed.kind,'customer');
 assert.equal((await sent()).status,200);assert.equal((await log()).length,4,'a retry of the same save neither fails nor duplicates');
 assert.equal((await call('viewer',{id:ap,action:'approvals'})).status,403);assert.equal((await call('outside',{id:ap,action:'approvals'})).status,404);
 // a failure of the log itself must never lose a saved revision
 const realError=console.error;console.error=()=>{};db.exec('ALTER TABLE studio_approvals RENAME TO studio_approvals_off');
 try{
  const other=structuredClone(approve);other.design.room.workshop.approvals.customer={...other.design.room.workshop.approvals.customer,name:'اسم آخر'};
  assert.equal((await call('owner',{id:ap,expected:3,request:crypto.randomUUID(),name:'Log table missing'},other)).status,200);
 }finally{db.exec('ALTER TABLE studio_approvals_off RENAME TO studio_approvals');console.error=realError;}
 assert.equal((await(await call('owner',{id:ap,action:'versions'})).json()).versions.length,4);
 assert.equal((await log()).length,4,'the revision saved while the log was down is simply not logged');
}
console.log('Approval log: stamps and technician attestations are recorded from the session with the server clock; unchanged stamps, retries and a missing log table are all safe.');

// A release for a subset reserves just those manufacturing lines. Unresolved
// evidence on its neighbour must neither certify that neighbour nor veto it.
const {batchReleaseState,releaseConcerns}=await import('../public/kitchen-workshop-state.js');
const {upsertFieldRecord}=await import('../public/kitchen-field-model.js');
const staged=structuredClone(signed);
const ids=staged.kitchen.units.map(u=>u.id);
const hold=upsertFieldRecord(staged.room,{id:'hold-left',inputCode:'SITE-17',itemId:ids[0],property:'عرض تركيب',unit:'مم',valueType:'number',value:570,verification:'conflict',source:'أداتان',execution:'required'});
assert(hold.ok);staged.room=hold.room;
assert((await approvalState(staged)).valid.customer,'technical note does not revoke unchanged sale');
assert(releaseConcerns(staged,await approvalState(staged)).some(v=>v.includes('hold-left')));
const blocked=await batchReleaseState(staged,[ids[0]]);assert(blocked.issues.some(v=>v.includes('hold-left')));
const part=await batchReleaseState(staged,[ids[1]]);assert.deepEqual(part.issues,[]);assert(part.quote.materialValue>0&&part.quote.total===null);
const second=await batchReleaseState(staged,[ids[2]]);assert.deepEqual(second.issues,[]);
const p2=crypto.randomUUID();
const stagedPayload={...archive(51),design:staged};
assert.equal((await call('owner',{id:p2,expected:0,request:crypto.randomUUID(),name:'Staged'},stagedPayload)).status,201);
const dispatch=(name,part,unitIds=part.scope.unitIds,review=part.key,rev=1)=>call(name,{id:p2,action:'batch',revision:rev,review},{unitIds});
assert.equal((await dispatch('owner',blocked)).status,422);
assert.equal((await dispatch('owner',part,part.scope.unitIds,'a'.repeat(64))).status,409);
await call('owner',{id:p2,action:'share'},{email:'viewer@example.test',role:'viewer'});
assert.equal((await dispatch('viewer',part)).status,403);
const duplicate=await Promise.all([dispatch('owner',part),dispatch('owner',part)]);
const receipts=await Promise.all(duplicate.map(async r=>{assert.equal(r.status,200);return (await r.json()).receipt;}));
assert.deepEqual(receipts[0],receipts[1]);assert.equal(receipts[0].material_minor,Math.round(part.quote.materialValue*100));
const overlap=await batchReleaseState(staged,[ids[1],ids[2]]);
assert.equal((await dispatch('owner',overlap)).status,409);assert.equal((await dispatch('owner',second)).status,200);
assert.equal((await (await call('owner',{id:p2,action:'batches'})).json()).batches.length,2);
assert.equal((await dispatch('owner',part,[ids[1],ids[1]])).status,422);
assert.equal((await rel('owner',1,p2)).status,422);
console.log('Scoped production: exact sale retained, conflict blocks only affected units, scoped material cost, stale proof, reader rejected, truly idempotent double click and overlapping orders blocked.');

// Older completed orders must not be duplicated by splitting the same job.
const already=await batchReleaseState(signed,[ids[1]]);
assert.equal((await call('owner',{id:pid,action:'batch',revision:2,review:already.key},{unitIds:[ids[1]]})).status,409);

// A subsequent clean revision completes only the unissued units, and never
// reorders an already cut unit whose geometry or purchased components changed.
const fixed=structuredClone(stagedPayload);fixed.design.room.fieldRegister.records[0].verification='measured';
assert.equal((await call('owner',{id:p2,expected:1,request:crypto.randomUUID(),name:'Field resolved'},fixed)).status,200);
const fixedState=await approvalState(fixed.design),remaining=ids.filter(i=>!part.scope.unitIds.includes(i)&&!second.scope.unitIds.includes(i)).sort();
const finish=(list)=>call('owner',{id:p2,revision:2,action:'remainder',review:fixedState.keys.release},{remaining:list});
assert.equal((await rel('owner',2,p2)).status,409);assert.equal((await finish(ids)).status,409);
const completion=await finish(remaining),result=await completion.json();
assert.equal(completion.status,200,JSON.stringify(result));assert.deepEqual(JSON.parse(result.receipt.scope_json),remaining);
const retry=await finish(remaining);assert.deepEqual((await retry.json()).receipt,result.receipt);
console.log('Remainder: actual current revision, strictly unissued set, a single completion receipt, original contract total distinguished from dispatched scope.');

// A valid-looking JSON stored under the wrong content address cannot create a
// shop receipt; a later malformed upload cannot displace a usable version.
const badProject=crypto.randomUUID(),source={...archive(57),design:structuredClone(signed)};
assert.equal((await call('owner',{id:badProject,expected:0,request:crypto.randomUUID(),name:'Test checksum'},source)).status,201);
const storedKey=[...blobs.keys()].find(k=>k.includes(badProject));const blob=blobs.get(storedKey);
const modified=JSON.parse(new TextDecoder().decode(blob));modified.design.room.name='Substituted snapshot';
blobs.set(storedKey,new TextEncoder().encode(JSON.stringify(modified)));
assert.equal((await rel('owner',1,badProject)).status,422);blobs.set(storedKey,blob);
const invalid=structuredClone(source);invalid.design.room.width=-1;
assert.equal((await call('owner',{id:badProject,expected:1,request:crypto.randomUUID(),name:'Reject bad archive'},invalid)).status,400);
assert.equal((await (await call('owner',{id:badProject,action:'versions'})).json()).versions.length,1);

// Scoped reads and edits never carry a full archive or disclose commercial data.
{
 const scoped=crypto.randomUUID(),roles=['store','factory','rep'];let current=structuredClone(payload),revision=1;
 current.design.room.name='PRIVATE-PROJECT-NAME';current.design.room.workshop.pricingTerms.terms.delivery=876543;
 for(const role of roles)await call(role);
 assert.equal((await call('owner',{id:scoped,expected:0,request:crypto.randomUUID(),name:'PRIVATE-LIST-NAME'},current)).status,201);
 const {projectView}=await import('../public/kitchen-project-scope.js');
 const edit=(role,next,baseRevision=revision)=>({type:'kitchen-project-edit',version:1,scopeVersion:2,baseRevision,editable:projectView(role,next,{id:scoped,revision:baseRevision,subject:'id-'+role}).editable});
 const send=(role,next,rid=crypto.randomUUID(),base=revision)=>call(role,{id:scoped,action:'patch',expected:base,request:rid},next);
 for(const role of roles){
  assert.equal((await call('owner',{id:scoped,action:'share'},{email:role+'@example.test',role})).status,200);
  assert.deepEqual(await(await call(role,{id:scoped,action:'access'})).json(),{id:scoped,role,revision,subject:'id-'+role,scopeVersion:2,requiresRoleAssignment:false});
  const snapshot=await call(role,{id:scoped});assert.equal(snapshot.status,200);assert.equal(snapshot.headers.get('X-Studio-Role'),role);assert.equal(snapshot.headers.get('X-Studio-Subject'),'id-'+role);
  assert.equal(snapshot.headers.get('X-Studio-Revision'),'1');const view=await snapshot.json();assert.equal(view.type,'kitchen-project-view');assert.equal(view.design,undefined);assert(!JSON.stringify(view).includes('876543'));
  assert.equal((await call(role,{id:scoped,action:'share'},{email:'outside@example.test',role:'rep'})).status,403);
  for(const action of ['receipt','approvals','members','batches'])assert.equal((await call(role,{id:scoped,action})).status,403);
  assert.equal((await rel(role,1,scoped)).status,403);
  assert.equal((await send(role,current)).status,403,'full archives are rejected even if edits otherwise would be owned');
  const list=await(await call(role)).json();assert(!JSON.stringify(list).includes('PRIVATE-LIST-NAME'));
  const history=await(await call(role,{id:scoped,action:'versions'})).json();assert(!JSON.stringify(history).includes('PRIVATE-LIST-NAME'));assert(!('bytes' in history.versions[0]));
  const old=await(await call(role,{id:scoped,revision:1})).json();assert.equal(old.type,'kitchen-project-view');assert(!JSON.stringify(old).includes('876543'));
  const malicious=edit(role,current);malicious.editable.pricingTerms=current.design.room.workshop.pricingTerms;assert.equal((await send(role,malicious)).status,403);
 }
 assert.equal((await call('owner',{id:scoped,action:'unrecognized'})).status,400);
 assert.deepEqual(await(await call('store',{action:'session'})).json(),{subject:'id-store'});assert.equal((await call(null,{action:'session'})).status,401);
 const bucket=globalThis.__kitchenSyncFixture.env.BUCKET,read=bucket.get;
 bucket.get=async()=>{throw Error('access metadata must not download a snapshot');};
 try{assert.equal((await call('store',{id:scoped,action:'access'})).status,200);}finally{bucket.get=read;}
 const hidden=structuredClone(current.design.room.workshop.pricingTerms);
 let firstRequest,firstEdit;
 for(const [role,change] of [
  ['store',n=>{n.editable.storeCatalog.items[0].price+=1;}],
  ['factory',n=>{n.editable.factoryRecipes.families.storage.recipe[0].count++;n.editable.factoryRecipes.approved=false;}],
  ['rep',n=>{n.editable.room.name='Site visit change';}],
 ]){
  const next=edit(role,current);change(next);const rid=crypto.randomUUID(),response=await send(role,next,rid);
  assert.equal(response.status,200,role+': '+await response.clone().text());const view=await response.json();assert.equal(view.type,'kitchen-project-view');assert(!JSON.stringify(view).includes('876543'));revision++;
  current=await(await call('owner',{id:scoped})).json();assert.deepEqual(current.design.room.workshop.pricingTerms,hidden,'a scoped edit preserves hidden pricing exactly');
  if(role==='store'){firstRequest=rid;firstEdit=next;}
 }
 const retry=await send('store',firstEdit,firstRequest,1);assert.equal(retry.status,200);const latest=await retry.json();assert.equal(latest.project.revision,revision,'a scoped retry returns current data rather than an old full archive');assert(!JSON.stringify(latest).includes('876543'));
 assert.equal((await send('factory',firstEdit,firstRequest,1)).status,409,'request ids are bound to the authenticated actor');
 const changed=structuredClone(firstEdit);changed.editable.storeCatalog.items[0].price++;assert.equal((await send('store',changed,firstRequest,1)).status,409);
 const originalPut=bucket.put;
 for(const nextRole of ['factory',null]){
  const next=edit('store',current);next.editable.storeCatalog.items[0].price++;
  bucket.put=async(...args)=>{if(nextRole)db.prepare('UPDATE studio_access SET role=? WHERE project_id=? AND member=?').run(nextRole,scoped,'id-store');else db.prepare('DELETE FROM studio_access WHERE project_id=? AND member=?').run(scoped,'id-store');return originalPut(...args);};
  try{assert.equal((await send('store',next)).status,nextRole?403:404);}finally{bucket.put=originalPut;}
  assert.equal(db.prepare('SELECT MAX(revision) n FROM studio_versions WHERE project_id=?').get(scoped).n,revision);
  await call('owner',{id:scoped,action:'share'},{email:'store@example.test',role:'store'});
 }
 for(const nextRole of ['factory',null]){
  bucket.get=async(...args)=>{const result=await read(...args);if(nextRole)db.prepare('UPDATE studio_access SET role=? WHERE project_id=? AND member=?').run(nextRole,scoped,'id-store');else db.prepare('DELETE FROM studio_access WHERE project_id=? AND member=?').run(scoped,'id-store');return result;};
  try{assert.equal((await call('store',{id:scoped})).status,404,'role changes during R2 read never release the previous scope');}finally{bucket.get=read;}
  await call('owner',{id:scoped,action:'share'},{email:'store@example.test',role:'store'});
 }
 const preview=await call('rep',{id:scoped,action:'design-preview',expected:revision},{walls:['back'],sink:false,dishwasher:false,rice:false});
 assert([200,422].includes(preview.status));const previewText=await preview.text();assert(!previewText.includes('876543'));assert(!previewText.includes('pricingTerms'));assert(!previewText.includes('quote'));assert(!previewText.includes('recipe'));
 assert.equal((await call('store',{id:scoped,action:'design-preview',expected:revision},{walls:['back'],sink:false,dishwasher:false,rice:false})).status,403);
 assert.equal((await call('rep',{id:scoped,action:'design-preview',expected:revision},{walls:['back'],sink:false,dishwasher:false,rice:false,limit:10000})).status,400);
 const own=crypto.randomUUID();assert.equal((await call('store',{id:own,expected:0,request:crypto.randomUUID(),name:'Own project'},archive(1))).status,201);
 assert.equal((await(await call('store',{id:own,action:'access'})).json()).role,'owner');
 assert.equal((await call('outside',{id:scoped,action:'access'})).status,404);
 // A typed valid customer stamp without owner server attestation is not a sale authorization.
 const saleId=crypto.randomUUID();assert.equal((await call('owner',{id:saleId,expected:0,request:crypto.randomUUID(),name:'Sale'},payload)).status,201);
 await call('owner',{id:saleId,action:'share'},{email:'rep@example.test',role:'rep'});
 const saleView=await(await call('rep',{id:saleId})).json();assert.equal(saleView.approvedSale.status,'approved');assert.equal(saleView.approvedSale.totalMinor,Math.round((await approvalState(payload.design)).quote.total*100));
 db.prepare("UPDATE studio_approvals SET actor='id-editor' WHERE project_id=?").run(saleId);
 const pending=await(await call('rep',{id:saleId})).json();assert.deepEqual(pending.approvedSale,{status:'pending'});
}
console.log('Scoped confidentiality: safe DTOs/history/lists, no full uploads, exact hidden-data preservation, actor-bound retries, current safe retry views, read/write revocation races, owner-only sale authorization and bounded server-only design preview verified.');

// Known-success preview exercises the actual planning path, safe projection and
// subsequent ordinary scoped save rather than accepting a generic refusal.
{
 const {makeVisitExample}=await import('../tools/fixture-kitchen-visit-example.mjs');
 const plannedId=crypto.randomUUID(),doc=cleanIdea(makeVisitExample());
 doc.room.workshop.pricingTerms.terms.delivery=876543;doc.room.workshop.storeCatalog.items[0].price=765432;
 doc.room.workshop.factoryRecipes.families.storage.recipe[0].label='SECRET_RECIPE_FORMULA';
 const source={...archive(70),design:doc};
 assert.equal((await call('owner',{id:plannedId,expected:0,request:crypto.randomUUID(),name:'Private preview project'},source)).status,201);
 await call('owner',{id:plannedId,action:'share'},{email:'rep@example.test',role:'rep'});
 const preview=await call('rep',{id:plannedId,action:'design-preview',expected:1},{walls:['back'],sink:true,dishwasher:true,rice:true});
 assert.equal(preview.status,200,await preview.clone().text());const data=await preview.json();assert.equal(data.type,'kitchen-design-choices');assert(data.choices.length>0&&data.choices.length<=3);
 assert.deepEqual(data.access,{role:'rep',subject:'id-rep',scopeVersion:2});
 for(const secret of ['876543','765432','SECRET_RECIPE_FORMULA','pricingTerms','factoryRecipes','quote'])assert(!JSON.stringify(data).includes(secret),'preview never discloses '+secret);
 assert(data.choices[0].editable.kitchen.units.length>0);
 const selected={type:'kitchen-project-edit',version:1,scopeVersion:2,baseRevision:1,editable:data.choices[0].editable};
 const saved=await call('rep',{id:plannedId,action:'patch',expected:1,request:crypto.randomUUID()},selected);assert.equal(saved.status,200,await saved.clone().text());
 const owner=await(await call('owner',{id:plannedId})).json();assert(owner.design.kitchen.units.length>0);assert.deepEqual(owner.design.room.workshop.pricingTerms,source.design.room.workshop.pricingTerms);assert.equal(owner.design.room.workshop.factoryRecipes.families.storage.recipe[0].label,'SECRET_RECIPE_FORMULA');
}
console.log('Real successful design preview: bounded choices contain only rep editable data; selected choice saves through ordinary scoped merge while private pricing and recipe text remain intact.');

// Preview/apply must calculate on verified full data, while neither publishing
// hidden fields nor accepting the client preview as write authority.
{
 const {operationFixture}=await import('../tools/check-kitchen-project-operations.mjs');
 const {archive:full,unitId}=operationFixture(),project=crypto.randomUUID();
 assert.equal((await call('owner',{id:project,expected:0,request:crypto.randomUUID(),name:'Private drawer order'},full)).status,201);
 for(const role of ['rep','factory','store'])await call('owner',{id:project,action:'share'},{email:role+'@example.test',role});
 let revision=1;
 const command=(operation,review)=>({type:'kitchen-project-operation',version:1,baseRevision:revision,operation,...(review?{review}:{})});
 const preview=(who,operation)=>call(who,{id:project,action:'operation-preview',expected:revision},command(operation));
 const apply=(who,body,rid=crypto.randomUUID(),expected=revision)=>call(who,{id:project,action:'operation-apply',expected,request:rid},body);
 const benchResponse=await preview('factory',{kind:'workbench.read'});assert.equal(benchResponse.status,200,await benchResponse.clone().text());
 const bench=await benchResponse.json();assert.equal(bench.access.scopeVersion,2);assert(bench.result.drawers.some(d=>d.unitId===unitId));assert.equal(bench.review,null);
 for(const secret of ['987.65','876.54','SECRET-CUSTOMER-OBJECT','SECRET-SUPPLIER-REFERENCE','SECRET-FACTORY-RECIPE'])assert(!JSON.stringify(bench).includes(secret),secret);
 assert.equal((await preview('store',{kind:'workbench.read'})).status,403);
 const readOnly=await apply('factory',command({kind:'workbench.read'}));assert.equal(readOnly.status,422);
 const opened=await(await preview('factory',{kind:'interior.open',unitId})).json();
 const plan=structuredClone(opened.result.plan);plan.cells['0:0']='boxes';const operation={kind:'interior.set',unitId,plan};
 const checked=await(await preview('factory',operation)).json();assert.match(checked.review,/^[a-f0-9]{64}$/);
 assert.equal((await apply('factory',command(operation))).status,409);
 assert.equal((await apply('rep',command(operation,checked.review))).status,409,'review bound to authenticated subject and role');
 const requestId=crypto.randomUUID(),body=command(operation,checked.review),saved=await apply('factory',body,requestId);assert.equal(saved.status,200,await saved.clone().text());revision++;
 const safe=await saved.json();assert.equal(safe.project.revision,revision);assert(!JSON.stringify(safe).includes('987.65'));
 const owner=await(await call('owner',{id:project})).json();assert.equal(owner.design.kitchen.units.find(u=>u.id===unitId).detail.cells['0:0'],'boxes');assert.deepEqual(owner.design.room,full.design.room);
 const retry=await apply('factory',body,requestId,1);assert.equal(retry.status,200);assert.equal((await retry.json()).project.revision,2);
 const altered=structuredClone(body);altered.operation.plan.cells['0:0']='books';assert.equal((await apply('factory',altered,requestId,1)).status,409);
 assert.equal((await apply('factory',body,crypto.randomUUID(),1)).status,409);
 const updated=await(await preview('factory',{kind:'interior.open',unitId})).json(),nextPlan=structuredClone(updated.result.plan);nextPlan.cells['0:0']='plant';
 const nextOp={kind:'interior.set',unitId,plan:nextPlan},nextPreview=await(await preview('factory',nextOp)).json();
 const bucket=globalThis.__kitchenSyncFixture.env.BUCKET,read=bucket.get,put=bucket.put;
 bucket.get=async(...args)=>{const value=await read(...args);db.prepare("UPDATE studio_access SET role='rep' WHERE project_id=? AND member='id-factory'").run(project);return value;};
 try{assert.equal((await preview('factory',{kind:'workbench.read'})).status,404);}finally{bucket.get=read;}
 await call('owner',{id:project,action:'share'},{email:'factory@example.test',role:'factory'});
 bucket.put=async(...args)=>{db.prepare("UPDATE studio_access SET role='rep' WHERE project_id=? AND member='id-factory'").run(project);return put(...args);};
 try{assert.equal((await apply('factory',command(nextOp,nextPreview.review))).status,403);}finally{bucket.put=put;}
 assert.equal(db.prepare('SELECT MAX(revision) n FROM studio_versions WHERE project_id=?').get(project).n,2);
 const switched=await apply('factory',body,requestId,1);assert.equal(switched.status,200);const switchedView=await switched.json();assert.equal(switchedView.access.role,'rep');assert(!JSON.stringify(switchedView).includes('SECRET-FACTORY-RECIPE'));
 const oldView=await(await call('rep',{id:project,revision:1})).json();assert(!JSON.stringify(oldView).includes('SECRET-FACTORY-MEASUREMENT'));
 const oldEdit={type:'kitchen-project-edit',version:1,baseRevision:revision,editable:switchedView.editable};assert.equal((await call('rep',{id:project,action:'patch',expected:revision,request:crypto.randomUUID()},oldEdit)).status,403);
}
console.log('Server operations: real previews/apply, missing/foreign/stale reviews, immutable source, secret-safe responses, actor-bound idempotency, exact-role read/write races and legacy edit scope rejection.');

{
 const {operationFixture}=await import('../tools/check-kitchen-project-operations.mjs'),{archive:source}=operationFixture(),project=crypto.randomUUID();
 assert.equal((await call('owner',{id:project,expected:0,request:crypto.randomUUID(),name:'Packing operation'},source)).status,201);
 await call('owner',{id:project,action:'share'},{email:'rep@example.test',role:'rep'});
 const command=operation=>({type:'kitchen-project-operation',version:1,baseRevision:1,operation});
 const proposed=await call('rep',{id:project,action:'operation-preview',expected:1},command({kind:'packing.propose',preserve:true}));assert.equal(proposed.status,200,await proposed.clone().text());
 const result=await proposed.json();assert.equal(result.result.status,'ready');assert.equal(result.result.slots.length,1);assert.equal(result.result.selection[0].sku,'SLIDE');
 for(const secret of ['987.65','876.54','SECRET-SUPPLIER','SECRET-FACTORY','SECRET-BAY'])assert(!JSON.stringify(result).includes(secret),secret);
 const body=command({kind:'packing.accept',preserve:true,reference:'Customer meeting'}),preview=await call('rep',{id:project,action:'operation-preview',expected:1},body);assert.equal(preview.status,200);body.review=(await preview.json()).review;
 const accepted=await call('rep',{id:project,action:'operation-apply',expected:1,request:crypto.randomUUID()},body);assert.equal(accepted.status,200,await accepted.clone().text());
 const owner=await(await call('owner',{id:project})).json();assert.equal(owner.design.room.workshop.clientUsage.pack.accepted.slots.length,1);assert.deepEqual(owner.design.room.workshop.storeCatalog,source.design.room.workshop.storeCatalog);assert.deepEqual(owner.design.room.workshop.factoryRecipes,source.design.room.workshop.factoryRecipes);assert.deepEqual(owner.design.room.workshop.pricingTerms,source.design.room.workshop.pricingTerms);assert.equal(owner.design.room.workshop.approvals,undefined);
}
console.log('Server packing: known-success technical proposal and reviewed acceptance persist real slots, preserve all three hidden records and grant no owner approval.');

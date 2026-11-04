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
let beforeRead=null;
const prepare=(query,values=[])=>({
 bind(...v){return prepare(query,v);},first(){beforeRead?.(query,values);return db.prepare(query).get(...values);},
 all(){return {results:db.prepare(query).all(...values)};},run(){return {meta:{changes:db.prepare(query).run(...values).changes}};}
});
globalThis.__kitchenSyncFixture={auth:()=>users.getStore(),env:{DB:{prepare,batch(statements){db.exec('BEGIN');try{const r=statements.map(s=>s.run());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}},BUCKET:{async get(k){return blobs.has(k)?{body:blobs.get(k),arrayBuffer:async()=>Uint8Array.from(blobs.get(k)).buffer,json:async()=>JSON.parse(new TextDecoder().decode(blobs.get(k)))}:null;},async put(k,v){if(!blobs.has(k))blobs.set(k,v.slice());}}}};
const bundle=await build({absWorkingDir:root,entryPoints:['app/api/inventory/route.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'fixture-auth-bindings',setup(b){
 b.onResolve({filter:/^(cloudflare:workers|.*chatgpt-auth)$/},a=>({path:a.path,namespace:'sync-fixture'}));
 b.onLoad({filter:/.*/,namespace:'sync-fixture'},a=>({contents:a.path==='cloudflare:workers'?'export const env=globalThis.__kitchenSyncFixture.env;':'export const getChatGPTUser=globalThis.__kitchenSyncFixture.auth;'}));
}}]});
const {GET,POST}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const catalogId=crypto.randomUUID(),p=crypto.randomUUID(),q=crypto.randomUUID(),r=crypto.randomUUID();
function call(who,params={},body){
 const url='https://example.test/api/inventory?'+new URLSearchParams({id:catalogId,...params}),req=new Request(url,body?{method:'POST',headers:{'X-Studio-Request':'1','Content-Type':'application/json',Origin:'https://example.test'},body:JSON.stringify(body)}:{});
 return users.run(who?{userId:who,email:who+'@example.test'}:null,()=>body?POST(req):GET(req));
}
const {makeChainExample,attestChain,readChainRange}=await import('../public/kitchen-chain-model.js');
const {planWorkshopRow}=await import('../public/kitchen-production-row.js');
const {seedCatalog}=await import('../public/kitchen-workshop-factory.js');
const {installTeamCatalog,catalogFingerprint,encodePortableCatalog}=await import('../public/kitchen-factory-template.js');
const {approvalState,batchReleaseState}=await import('../public/kitchen-workshop-state.js');
const cat=seedCatalog();cat.approved=true;cat.items.find(x=>x.sku==='AL-20').offcuts=[{ref:'مختبر',count:2,lengthMm:1200,widthMm:0}];for(const i of cat.items)i.price=50;
Object.assign(cat.terms,{labor:0,installation:0,delivery:0,marginPct:0,taxPct:0});
cat.items.push({...cat.items.find(i=>i.kind==='panel'),sku:'QA-STONE',name:'لوح اختبار النعلة',stockLengthMm:6000,thicknessMm:20});
cat.upstandProfiles=[{id:'QA-EDGE',reference:'اختبار الحصر',sku:'QA-STONE',heightMm:80}];
const templateDoc=makeChainExample();templateDoc.room.workshop.catalog=cat;confirmFixtureFitout(templateDoc);
const pin={id:catalogId,version:1,digest:catalogFingerprint(cat)},cpath='catalog.json';
const now=new Date().toISOString(),utf=v=>new TextEncoder().encode(JSON.stringify(v)),sql=(s,...args)=>db.prepare(s).run(...args);
blobs.set(cpath,utf(cat));sql('insert into studio_catalogs values(?,?)',catalogId,'factory');sql('insert into studio_catalog_readers(catalog,reader) values(?,?)',catalogId,'rep');
sql('insert into studio_catalog_versions(catalog,version,request_id,name,digest,object_key,created) values(?,?,?,?,?,?,?)',catalogId,1,'pub','Catalog',pin.digest,cpath,now);
let d=installTeamCatalog(makeChainExample(),pin,cat);
d.room.workshop.chains.back=attestChain(d,'back',d.room.workshop.chains.back,{name:'Factory test',reference:'Site survey'}).chain;
d=planWorkshopRow(d,{...readChainRange(d,'back'),tier:'base',wanted:{}}).doc;
confirmFixtureFitout(d);d.room.workshop.upstand={choice:{mode:'factory',profileId:'QA-EDGE'},walls:{}};
const stamps=d.room.workshop.approvals={};for(const k of ['structure','customer']){const state=await approvalState(d);stamps[k]={key:state.keys[k],date:now,name:'Reviewed'};}
const checked=(await import('../public/kitchen-ideas.js')).cleanIdea(d),full=await approvalState(checked);
const ids=checked.kitchen.units.map(u=>u.id),batch=await batchReleaseState(checked,[ids[0]]);
const bytes=utf({design:checked}),digest=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');
for(const project of [p,q,r]){
 sql('insert into studio_projects values(?,?)',project,'rep');sql('insert into studio_access values(?,?,?)',project,'factory','store');
 sql('insert into studio_versions(project_id,revision,request_id,actor,name,digest,bytes,updated) values(?,?,?,?,?,?,?,?)',project,1,'save','rep','Design',digest,bytes.length,now);
 sql('insert into studio_releases values(?,?,?,?,?,?,?,?)',project,1,'rep',digest,full.keys.release,123,now,project===r?JSON.stringify([ids.at(-1)]):null);
 sql('insert into studio_batches(project_id,revision,design_key,unit_ids,issuer,digest,material_minor,issued) values(?,?,?,?,?,?,?,?)',project,1,batch.key,JSON.stringify([ids[0]]),'rep',digest,123,now);
 blobs.set('kitchen-projects/'+project+'/'+digest+'.json',bytes);
}
const cmd=(action,add={})=>({action,request:crypto.randomUUID(),note:'في المستند INV/001',...add});
const reserve=(project,scope='whole')=>cmd('reserve',{project,revision:1,scope}),go=(b,who='factory')=>call(who,{},b);
assert.equal((await call(null)).status,401);assert.equal((await call('other')).status,403);assert.equal((await call('rep')).status,403);
// Existing publications are flat; new publications store independent records.
// Neither format may hide physical SKUs or change their stock identity.
const legacyPublished=blobs.get(cpath),splitPublished=utf(encodePortableCatalog(cat));
const legacyStock=await(await call('factory')).json();
blobs.set(cpath,splitPublished);
const splitStockResponse=await call('factory');assert.equal(splitStockResponse.status,200,await splitStockResponse.clone().text());
assert.deepEqual((await splitStockResponse.json()).stocks,legacyStock.stocks,'separated publications preserve every physical stock definition');
assert(legacyStock.stocks.length>0);
blobs.set(cpath,utf({type:'kitchen-catalog-records',version:1,storeCatalog:encodePortableCatalog(cat).storeCatalog}));
assert.equal((await call('factory')).status,503,'an incomplete published record fails closed rather than showing empty stock');
blobs.set(cpath,splitPublished);
assert.equal((await go(reserve(p),'rep')).status,403);
const preview=await go(cmd('preview',{project:p,revision:1,scope:'whole'}));assert.equal(preview.status,200);const {lines,units:fullStockScope}=await preview.json();assert.ok(fullStockScope.includes('upstand:back'));assert.ok(lines.some(l=>l.name.includes('لوح اختبار النعلة')));assert.ok(lines.length>1);assert.ok(lines.some(l=>l.name.includes('باقي مختبر')&&l.qty===2));assert.ok(lines.every(l=>l.free===null));
assert.equal((await go(reserve(p))).status,409);assert.equal(db.prepare("select count(*) as n from studio_stock_events").get().n,0);
for(const [i,l] of lines.entries()){
 if(i===lines.length-1)break;
 if(i===0)blobs.set(cpath,legacyPublished);
 const count=cmd('count',{key:l.key,physical:l.qty,expected:null}),counted=await go(count);
 assert.equal(counted.status,201,JSON.stringify([l,await counted.text()]));
 blobs.set(cpath,splitPublished);
 assert.equal((await go(count)).status,200);
}
assert.equal((await go(reserve(p))).status,409,'no partial reservation when last SKU not counted');
assert.equal(db.prepare("select count(*) as n from studio_stock_events where kind='reserve'").get().n,0);
const last=lines.at(-1);assert.equal((await go(cmd('count',{key:last.key,physical:last.qty,expected:null}))).status,201);
const first=reserve(p),second=reserve(q),race=await Promise.all([go(first),go(second)]);assert.deepEqual(race.map(x=>x.status).sort(),[201,409]);
const win=race[0].status===201?first:second;assert.equal((await go(win)).status,200);assert.equal((await go(cmd('count',{key:last.key,physical:0,expected:last.qty}))).status,409);
const cancelled=cmd('cancel',{reservation:win.request});assert.equal((await go(cancelled)).status,201);assert.equal((await go(cancelled)).status,200);assert.equal((await go(cmd('consume',{reservation:win.request}))).status,409);
const whole=reserve(p);assert.equal((await go(whole)).status,201);assert.equal((await go(reserve(p,batch.key))).status,409);const used=cmd('consume',{reservation:whole.request});assert.equal((await go(used)).status,201);assert.equal((await go(used)).status,200);assert.equal((await go(cmd('cancel',{reservation:whole.request}))).status,409);
const after=await(await call('factory')).json();assert.ok(after.stocks.filter(s=>s.physical!==null).every(s=>s.physical===0&&s.held===0));
const remain=await(await go(cmd('preview',{project:r,revision:1,scope:'whole'}))).json();assert.deepEqual(remain.units,[ids.at(-1)]);assert.ok(remain.lines.reduce((a,v)=>a+v.qty,0)<lines.reduce((a,v)=>a+v.qty,0));
sql('delete from studio_access where project_id=? and member=?',q,'factory');assert.equal((await go(reserve(q))).status,403);
console.log('Shared stock: actual issued-scope BOM, restrict catalog-owner/project access, unknown ≠ zero, all-SKU parallel reservation, idempotent retries, release vs consumption, overlap, scoped remainder and revoked ACL verified.');

// Reorder policy and partial deliveries operate on a published physical SKU.
// A purchase order or estimate by itself cannot turn into inventory.
sql('insert into studio_access values(?,?,?)',q,'factory','store');
const demand=(await(await go(cmd('preview',{project:q,revision:1,scope:'whole'}))).json()).lines;
const wanted=demand.find(l=>l.free===0&&JSON.parse(l.key)[7]==='');
assert(wanted);
const stockView=async()=>await(await call('factory')).json();
const policy={supplier:'مصنع المورد',vendorSku:'SV-442',pack:4,minimumPacks:2,reorder:2,target:5};
const pr=(a,extra={})=>cmd(a,{project:q,revision:1,scope:'whole',key:wanted.key,...extra});
assert.equal((await go(pr('propose'))).status,422);
let inv=await stockView();const set=cmd('policy',{version:1,key:wanted.key,stamp:inv.procurementStamp,policy});
assert.equal((await go(set,'rep')).status,403);
assert.equal((await go({...set,policy:{...policy,pack:0}})).status,400);
assert.equal((await go(set)).status,201);assert.equal((await go(set)).status,200);
assert.equal((await go(pr('propose',{project:p}))).status,409,'consumed stock cannot be procured a second time');
assert.equal((await go(pr('propose',{key:'fabricated'}))).status,422);
const viewProposal=async u=>{const r=await go(pr('propose',u));assert.equal(r.status,200,await r.clone().text());return (await r.json()).proposal;};
const v=await viewProposal({});assert.equal(v.demand,wanted.qty);assert.equal(v.quantity,Math.max(2,Math.ceil((5+wanted.qty)/4))*4);
const ord=pr('purchase',{quantity:v.quantity,stamp:v.stamp,note:'PO-400'}),dup=pr('purchase',{quantity:v.quantity,stamp:v.stamp,note:'PO-401'});
const racePo=await Promise.all([go(ord),go(dup)]);assert.deepEqual(racePo.map(r=>r.status).sort(),[201,409]);
const accepted=racePo[0].status===201?ord:dup;
assert.equal((await go(accepted)).status,200);
assert.equal((await go({...accepted,note:'different'})).status,409);
inv=await stockView();assert.equal(inv.stocks.find(s=>s.key===wanted.key).physical,0);assert.equal(inv.procurement.orders[0].open,v.quantity);
assert.equal((await viewProposal({})).quantity,0);
const receive=(quantity,note)=>cmd('delivery',{order:accepted.request,quantity,note});
assert.equal((await go(receive(v.quantity+1,'GRN-x'))).status,409);
const part=receive(2,'GRN-001');assert.equal((await go(part,'rep')).status,403);assert.equal((await go(part)).status,201);
assert.equal((await go(part)).status,200);assert.equal((await go(receive(2,'grn-001'))).status,409);
inv=await stockView();assert.equal(inv.stocks.find(s=>s.key===wanted.key).physical,2);assert.equal(inv.procurement.orders[0].open,v.quantity-2);
const rival=await viewProposal({project:r});assert.equal(rival.committed,v.demand);
const rr=await call('rep');assert.equal((await rr.json()).procurement,undefined);
const finishA=receive(v.quantity-2,'GRN-002'),finishB=receive(v.quantity-2,'GRN-003');
const both=await Promise.all([go(finishA),go(finishB)]);assert.deepEqual(both.map(r=>r.status).sort(),[201,409]);
inv=await stockView();assert.equal(inv.stocks.find(s=>s.key===wanted.key).physical,v.quantity);assert.equal(inv.procurement.orders.filter(o=>o.open>0).length,0);assert(inv.procurement.orders[0].protected);
const setNext=cmd('policy',{version:1,key:wanted.key,stamp:inv.procurementStamp,policy:{...policy,reorder:100,target:120}});assert.equal((await go(setNext)).status,201);
const propNext=await viewProposal({}),next=pr('purchase',{quantity:propNext.quantity,stamp:propNext.stamp,note:'PO-450'});
assert.equal((await go(next)).status,201);const closed=cmd('po-close',{order:next.request,note:'المورد نفد منه اللون'});
assert.equal((await go(closed)).status,201);assert.equal((await go(closed)).status,200);
assert.equal((await go(receive(1,'GRN-400'))).status,409);
assert.equal((await go(cmd('delivery',{order:next.request,quantity:1,note:'GRN-401'}))).status,409);
assert.equal((await stockView()).stocks.find(s=>s.key===wanted.key).physical,v.quantity);
// Placing part of this project's released quantities on hold moves them out
// of outstanding purchase demand instead of deducting them a second time.
const workBatch=(await(await go(cmd('preview',{project:q,revision:1,scope:batch.key}))).json()).lines;
for(const l of workBatch){
 const item=(await stockView()).stocks.find(s=>s.key===l.key);
 if(item.free<l.qty)assert.equal((await go(cmd('count',{key:l.key,physical:item.held+l.qty,expected:item.physical}))).status,201);
}
const taken=reserve(q,batch.key);assert.equal((await go(taken)).status,201);
assert.equal((await viewProposal({project:r})).committed,Math.max(0,v.demand-(workBatch.find(l=>l.key===wanted.key)?.qty||0)));
assert.equal((await go(cmd('cancel',{reservation:taken.request}))).status,201);
const done=cmd('po-close',{order:accepted.request,note:'العميل ألغى الاحتياج بعد التوريد'});assert.equal((await go(done)).status,201);assert.equal((await viewProposal({project:r})).committed,0);
console.log('Issued-scope reorder per measured SKU, owner policy and supplier pack/minimum, pooled incoming with protected commitments, stale duplicate POs, physical stock after partial receipts only, retries, duplicate delivery docs, overdelivery, parallel arrivals, closure and permissions verified.');

// Catalog custody and project access are independent permissions. The SQL must
// recheck both roles after loading the immutable release or catalog object.
{
 sql('INSERT INTO studio_catalog_readers(catalog,reader,role) VALUES(?,?,?)',catalogId,'store-worker','store');
 sql('INSERT INTO studio_catalog_readers(catalog,reader,role) VALUES(?,?,?)',catalogId,'factory-worker','factory');
 sql('INSERT INTO studio_access VALUES(?,?,?)',q,'project-only','store');
 const current=await stockView(),item=current.stocks.find(s=>s.key===wanted.key);
 const count=()=>cmd('count',{key:item.key,physical:item.physical,expected:item.physical});
 assert.equal((await go(count(),'project-only')).status,403,'project store role cannot grant catalog access');
 assert.equal((await go(count(),'factory-worker')).status,403,'factory catalog role cannot move stock');
 assert.equal((await go(count(),'rep')).status,403,'legacy catalog reader stays read-only');
 const delegated=await(await call('store-worker')).json();assert.equal(delegated.role,'store');assert(delegated.procurement);
 assert.deepEqual(delegated.reservations,[]);assert.deepEqual(delegated.procurement.orders,[],'catalog stock authority does not disclose an unshared project purchase order');
 assert.equal((await call('factory-worker')).status,403,'factory cannot read stock balances');
 assert.equal((await call('factory',{action:'unknown'})).status,400);
 assert.equal((await go(count(),'store-worker')).status,201,'catalog store role can reconcile stock');
 assert.equal((await go(reserve(q,batch.key),'store-worker')).status,403,'stock authority cannot read an unshared project');
 sql('INSERT INTO studio_access VALUES(?,?,?)',q,'store-worker','store');
 const bucket=globalThis.__kitchenSyncFixture.env.BUCKET,get=bucket.get;
 bucket.get=async(...args)=>{const file=await get(...args);sql('UPDATE studio_catalog_readers SET role=? WHERE catalog=? AND reader=?','factory',catalogId,'store-worker');return file;};
 try{assert.equal((await call('store-worker')).status,403,'read rechecks catalog custody after R2');}finally{bucket.get=get;sql('UPDATE studio_catalog_readers SET role=? WHERE catalog=? AND reader=?','store',catalogId,'store-worker');}
 const rows=()=>db.prepare('SELECT COUNT(*) n FROM studio_stock_events').get().n;
 for(const action of ['count','policy']){
  const before=rows(),view=await stockView();
  const body=action==='count'?count():cmd('policy',{version:1,key:wanted.key,stamp:view.procurementStamp,policy});
  bucket.get=async(...args)=>{const file=await get(...args);sql('UPDATE studio_catalog_readers SET role=? WHERE catalog=? AND reader=?','factory',catalogId,'store-worker');return file;};
  try{assert.equal((await go(body,'store-worker')).status,409,action+' must recheck catalog role at commit');}finally{bucket.get=get;}
  assert.equal(rows(),before);sql('UPDATE studio_catalog_readers SET role=? WHERE catalog=? AND reader=?','store',catalogId,'store-worker');
 }
 for(const nextRole of ['factory',null]){
  const before=rows();
  bucket.get=async(...args)=>{
   const file=await get(...args);
   if(args[0].startsWith('kitchen-projects/')){
    if(nextRole)sql('UPDATE studio_access SET role=? WHERE project_id=? AND member=?',nextRole,q,'store-worker');
    else sql('DELETE FROM studio_access WHERE project_id=? AND member=?',q,'store-worker');
   }
   return file;
  };
  try{assert.equal((await go(reserve(q,batch.key),'store-worker')).status,409,'receipt write must recheck exact project role');}finally{bucket.get=get;}
  assert.equal(rows(),before);
  sql('INSERT INTO studio_access VALUES(?,?,?) ON CONFLICT(project_id,member) DO UPDATE SET role=excluded.role',q,'store-worker','store');
 }
 const reservation=reserve(q,batch.key);assert.equal((await go(reservation,'store-worker')).status,201);
 assert.equal((await go(cmd('cancel',{reservation:reservation.request}),'store-worker')).status,201);
 const view=await stockView();assert.equal((await go(cmd('policy',{version:1,key:wanted.key,stamp:view.procurementStamp,policy}),'store-worker')).status,201);
 assert.equal((await go(pr('propose'),'store-worker')).status,200);
 for(const revoked of ['catalog','project']){
  let projectReads=0,fired=false;
  beforeRead=(query,values)=>{
   if(!values.includes('store-worker'))return;
   const separate=query.includes('MAX(v.revision)')&&++projectReads===2;
   const combined=query.startsWith('SELECT 1 FROM studio_catalogs')&&query.includes('AND EXISTS(')&&query.includes('studio_projects p');
   if(!fired&&(separate||combined)){fired=true;sql(revoked==='catalog'?'UPDATE studio_catalog_readers SET role=? WHERE catalog=? AND reader=?':'UPDATE studio_access SET role=? WHERE project_id=? AND member=?','factory',revoked==='catalog'?catalogId:q,'store-worker');}
  };
  try{assert.equal((await go(pr('propose'),'store-worker')).status,403,'a proposal uses one final read of both independent authorities');assert(fired);}finally{beforeRead=null;sql('UPDATE studio_catalog_readers SET role=? WHERE catalog=? AND reader=?','store',catalogId,'store-worker');sql('UPDATE studio_access SET role=? WHERE project_id=? AND member=?','store',q,'store-worker');}
 }
}
console.log('Scoped inventory ACL: independent catalog/project permissions, store counts/policies/reservations, protected readers/factory roles and exact resource-role/revoke races verified.');

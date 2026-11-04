import {build} from 'esbuild';
import {DatabaseSync} from 'node:sqlite';
import {AsyncLocalStorage} from 'node:async_hooks';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {prepareShopDomain} from './prepare-shop-domain.mjs';
import {seedCatalog,buildFactoryQuote} from '../public/kitchen-workshop-factory.js';
import {installTeamCatalog,catalogFingerprint,encodePortableCatalog,decodePortableCatalog,portableFactoryCatalog} from '../public/kitchen-factory-template.js';
import {catalogRecordStates} from '../public/kitchen-catalog-records.js';
import {catalogView} from '../public/kitchen-project-scope.js';
import {factorySpecialTargets,reviewSpecial} from '../public/kitchen-workshop-factory-special.js';
import {makeChainExample} from '../public/kitchen-chain-model.js';
import {readWallOptions,applyWallOptions,buildUpperRows} from '../public/kitchen-chain-options.js';
await prepareShopDomain();
const root=fileURLToPath(new URL('../',import.meta.url)),db=new DatabaseSync(':memory:'),users=new AsyncLocalStorage(),objects=new Map();
for(const f of (await readdir(root+'drizzle')).filter(s=>s.endsWith('.sql')).sort()){
 if(f==='0008_catalog_access_roles.sql')db.prepare('INSERT INTO studio_catalog_readers(catalog,reader) VALUES(?,?)').run('migration-fixture','existing-reader');
 db.exec(await readFile(root+'drizzle/'+f,'utf8'));
 if(f==='0008_catalog_access_roles.sql'){
  assert.equal(db.prepare('SELECT role FROM studio_catalog_readers WHERE catalog=?').get('migration-fixture').role,'reader','existing catalog shares remain read-only');
  db.prepare('INSERT INTO studio_catalog_readers(catalog,reader) VALUES(?,?)').run('migration-fixture','default-reader');
  assert.equal(db.prepare('SELECT role FROM studio_catalog_readers WHERE reader=?').get('default-reader').role,'reader','old writers that omit role retain the reader default');
  db.prepare('DELETE FROM studio_catalog_readers WHERE catalog=?').run('migration-fixture');
 }
}
const query=(sql,vals=[])=>({bind(...v){return query(sql,v);},run(){return {meta:{changes:db.prepare(sql).run(...vals).changes}};},first(){return db.prepare(sql).get(...vals);},all(){return {results:db.prepare(sql).all(...vals)};}});
globalThis.__teams={getUser:()=>users.getStore(),env:{DB:{prepare:query,batch(stmts){db.exec('BEGIN');try{const res=stmts.map(s=>s.run());db.exec('COMMIT');return res;}catch(e){db.exec('ROLLBACK');throw e;}}},
 BUCKET:{async put(k,v){objects.set(k,v);},async get(k){return objects.has(k)?{async json(){return JSON.parse(objects.get(k));}}:null;}}}};
const bundle=await build({absWorkingDir:root,entryPoints:['app/api/catalogs/route.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'bound-identity',setup(b){
 b.onResolve({filter:/^(cloudflare:workers|.*chatgpt-auth)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='cloudflare:workers'?'export const env=globalThis.__teams.env;':'export const getChatGPTUser=globalThis.__teams.getUser;'}));}}]});
const {GET,POST}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const invoke=(u,params={},body)=>users.run(u?{userId:u,email:u+'@example.test'}:null,()=>{const request=new Request('https://studio.test/api/catalogs?'+new URLSearchParams(params),body===undefined?{}:{method:'POST',headers:{'X-Studio-Request':'1',Origin:'https://studio.test'},body:JSON.stringify(body)});return body===undefined?GET(request):POST(request);});
const id=crypto.randomUUID(),rid=crypto.randomUUID(),tpl=seedCatalog();tpl.approved=true;
tpl.upstandProfiles=[{id:'QA-STONE',sku:'BODY-6',heightMm:50,reference:'Fixture supplier profile'}];
assert.equal((await invoke(null)).status,401);await invoke('engineer');await invoke('rep');
const draft=makeChainExample(),o=readWallOptions(draft,'back');o.cornice={enabled:true,heightMm:50,projectionMm:50,returns:false,reviewed:true};const d=buildUpperRows(applyWallOptions(draft,'back',o).doc,'back').doc;const target=factorySpecialTargets(d).find(t=>t.kind==='cornice');
tpl.specials={[target.id]:reviewSpecial(target,{reviewer:'Test',measurement:'private M-20',drawing:'private drawing',instructions:'do not transfer',lines:[{sku:'PULL',label:'قطعة',count:1,operation:'تثبيت'}]},tpl.items)};
const publish=(u,request,expected,v)=>invoke(u,{id,action:'publish',expected,request},v);
assert.equal((await publish('engineer',rid,0,tpl)).status,201);
db.prepare('UPDATE studio_catalog_versions SET request_digest=NULL WHERE catalog=?').run(id);
assert.equal((await publish('engineer',rid,0,tpl)).status,200);
assert.equal((await invoke('rep',{id})).status,404);assert.equal((await invoke('rep')).status,200);
assert.equal((await invoke('engineer',{id,action:'share'},{email:'rep@example.test'})).status,200);
assert.equal((await invoke('rep',{id})).status,403,'legacy readers cannot download a full catalog');const first=await(await invoke('engineer',{id})).json();assert.equal(first.version,1);assert.deepEqual(first.catalog.specials,{});assert.equal(first.catalog.teamSource,undefined);
const adopted=installTeamCatalog(d,{id,version:1,digest:first.digest},first.catalogRecords);assert.ok(adopted);assert.deepEqual(adopted.room.workshop.catalog.upstandProfiles,tpl.upstandProfiles);assert.equal(adopted.room.workshop.catalog.teamSource.version,1);
assert.equal((await publish('rep',crypto.randomUUID(),1,tpl)).status,403);
const edited=structuredClone(tpl);edited.items[0].price=18;
const parallel=await Promise.all([publish('engineer',crypto.randomUUID(),1,edited),publish('engineer',crypto.randomUUID(),1,edited)]);
assert.deepEqual(parallel.map(x=>x.status).sort(),[200,409]);
assert.equal((await(await invoke('engineer',{id,version:1})).json()).digest,first.digest);assert.equal(adopted.room.workshop.catalog.items[0].price,null);
const second=await(await invoke('engineer',{id})).json();const revised=installTeamCatalog(adopted,{id,version:2,digest:second.digest},second.catalogRecords);
assert.equal(revised.room.workshop.catalog.items[0].price,18);assert.equal(revised.room.workshop.catalog.layoutRevision,adopted.room.workshop.catalog.layoutRevision);
assert.equal(catalogFingerprint(revised.room.workshop.catalog),second.digest);
const withDraft=structuredClone(adopted);withDraft.room.workshop.factoryRecipes.approved=false;withDraft.room.workshop.factoryRecipes.specials=tpl.specials;
const merged=installTeamCatalog(withDraft,{id,version:2,digest:second.digest},second.catalogRecords);
assert.deepEqual(merged.room.workshop.catalog.specials,withDraft.room.workshop.factoryRecipes.specials);assert.equal(merged.room.workshop.catalog.approved,false);
assert.equal(catalogFingerprint(merged.room.workshop.catalog),second.digest);
assert.equal(await(await invoke('rep',{id,action:'members'})).status,403);assert.equal((await invoke('engineer',{id,action:'revoke'},{email:'rep@example.test'})).status,200);
assert.equal((await invoke('rep',{id,version:1})).status,404);
const negative=structuredClone(d);negative.room.workshop.catalog=tpl;negative.room.workshop.finishes={frontSku:'FACE-6-W'};negative.kitchen.units[0].frontColor='#ff0000';
assert.match(buildFactoryQuote(negative).issues.join(' '),/لون/);

// Old blobs retain their old fingerprints and are readable through the same API.
{
 const row=db.prepare('SELECT object_key FROM studio_catalog_versions WHERE catalog=? AND version=1').get(id),prior=objects.get(row.object_key);
 objects.set(row.object_key,JSON.stringify(portableFactoryCatalog(tpl)));
 const legacy=await(await invoke('engineer',{id,version:1})).json();
 assert.equal(legacy.digest,first.digest);assert.equal(catalogFingerprint(legacy.catalogRecords),first.digest);
 assert(installTeamCatalog(d,{id,version:1,digest:legacy.digest},legacy.catalogRecords));
 objects.set(row.object_key,prior);
}
// Record approvals are transported independently. Approval-only publications
// retain their historical content fingerprint without overwriting old payloads.
{
 const separateId=crypto.randomUUID(),request=crypto.randomUUID(),model=encodePortableCatalog(tpl);
 model.storeCatalog.approved=false;model.pricingTerms.approved=false;
 const post=(expected,rid,value)=>invoke('engineer',{id:separateId,action:'publish',expected,request:rid},value);
 assert.equal((await post(0,request,model)).status,201);
 const old=await(await invoke('engineer',{id:separateId,version:1})).json();
 assert.deepEqual(catalogRecordStates(decodePortableCatalog(old.catalogRecords)),{store:{revision:1,approved:false},factory:{revision:1,approved:true},pricing:{revision:1,approved:false}});
 const installed=installTeamCatalog(d,{id:separateId,version:1,digest:old.digest},old.catalogRecords);
 assert.equal(installed.room.workshop.storeCatalog.approved,false);assert.equal(installed.room.workshop.pricingTerms.approved,false);
 const approved=structuredClone(model);approved.storeCatalog.approved=true;approved.pricingTerms.approved=true;
 assert.equal((await post(0,request,approved)).status,409,'same request cannot substitute record approvals');
 assert.equal((await post(1,crypto.randomUUID(),approved)).status,200);
 const latest=await(await invoke('engineer',{id:separateId})).json(),earlier=await(await invoke('engineer',{id:separateId,version:1})).json();
 assert.equal(latest.digest,old.digest,'historical content fingerprints remain approval-neutral');
 assert.equal(latest.catalogRecords.storeCatalog.approved,true);assert.equal(earlier.catalogRecords.storeCatalog.approved,false,'old published approvals are immutable');
 assert.equal(new Set(db.prepare('SELECT object_key FROM studio_catalog_versions WHERE catalog=?').all(separateId).map(r=>r.object_key)).size,2);
}
console.log('Team catalogs validated on migrated SQLite: owner publication, idempotent & concurrent revisions, independent project pins, protected readers, revocation, no project sheets leaked, commercial-only update preserves row geometry and mismatched drawn front colour detected.');

// Catalog ACL is a separate resource: scoped writers can publish only their
// own record, and losing/changing that role during object upload prevents commit.
{
 const scoped=crypto.randomUUID();let current=encodePortableCatalog(tpl),version=1;
 current.pricingTerms.terms.delivery=876543;current.storeCatalog.items[0].price=765432;
 const post=(who,value)=>invoke(who,{id:scoped,action:'publish',expected:version,request:crypto.randomUUID()},value);
 const owned=(who,value)=>({type:'kitchen-catalog-edit',version:1,baseVersion:version,editable:catalogView(who.slice(8),value,{id:scoped,version,subject:who}).editable});
 assert.equal((await invoke('engineer',{id:scoped,action:'publish',expected:0,request:crypto.randomUUID()},current)).status,201);
 for(const role of ['store','factory']){
  await invoke('catalog-'+role);
  assert.equal((await invoke('engineer',{id:scoped,action:'share'},{email:'catalog-'+role+'@example.test',role})).status,200);
  const safe=await(await invoke('catalog-'+role,{id:scoped})).json();assert.equal(safe.type,'kitchen-catalog-view');assert.equal(safe.access.role,role);assert(!JSON.stringify(safe).includes('876543'));if(role==='factory')assert(!JSON.stringify(safe).includes('765432'));
  assert.equal((await(await invoke('catalog-'+role)).json()).catalogs.find(c=>c.id===scoped).role,role);
  assert.equal((await invoke('catalog-'+role,{id:scoped,action:'share'},{email:'rep@example.test',role:'store'})).status,403);
 }
 assert.deepEqual((await(await invoke('engineer',{id:scoped,action:'members'})).json()).members,[{email:'catalog-factory@example.test',role:'factory'},{email:'catalog-store@example.test',role:'store'}]);
 for(const [who,record,change] of [
  ['catalog-store','factoryRecipes',r=>{r.families.storage.recipe[0].count++;}],
  ['catalog-factory','storeCatalog',r=>{r.items[0].price=66;}],
  ['catalog-store','pricingTerms',r=>{r.terms.delivery=66;}],
  ['catalog-factory','pricingTerms',r=>{r.approved=false;}],
 ]){
  const next=structuredClone(current);change(next[record]);assert.equal((await post(who,next)).status,403,who+' cannot edit '+record);
 }
 for(const [who,change] of [
  ['catalog-store',c=>{c.storeCatalog.items[0].price=12;}],
  ['catalog-factory',c=>{c.factoryRecipes.families.storage.recipe[0].count++;}],
 ]){
  const next=structuredClone(current);change(next);const response=await post(who,owned(who,next));
  assert.equal(response.status,200,await response.clone().text());const safe=await response.json();assert.equal(safe.type,'kitchen-catalog-view');assert(!JSON.stringify(safe).includes('876543'));version++;current=(await(await invoke('engineer',{id:scoped})).json()).catalogRecords;assert.equal(current.pricingTerms.terms.delivery,876543);
 }
 const bucket=globalThis.__teams.env.BUCKET,put=bucket.put;
 for(const role of ['factory',null]){
  const next=structuredClone(current);next.storeCatalog.items[0].price++;
  bucket.put=async(...args)=>{
   if(role)db.prepare('UPDATE studio_catalog_readers SET role=? WHERE catalog=? AND reader=?').run(role,scoped,'catalog-store');
   else db.prepare('DELETE FROM studio_catalog_readers WHERE catalog=? AND reader=?').run(scoped,'catalog-store');
   return put(...args);
  };
  try{assert.equal((await post('catalog-store',owned('catalog-store',next))).status,404);}finally{bucket.put=put;}
  assert.equal(db.prepare('SELECT MAX(version) n FROM studio_catalog_versions WHERE catalog=?').get(scoped).n,version);
  await invoke('engineer',{id:scoped,action:'share'},{email:'catalog-store@example.test',role:'store'});
 }
 assert.equal((await invoke('engineer',{id:scoped,action:'share'},{email:'rep@example.test',role:'owner'})).status,400);
 for(const role of ['store','factory']){
  const history=await(await invoke('catalog-'+role,{id:scoped,action:'versions'})).json();assert(history.versions.every(v=>!('digest' in v)));
  const historical=await(await invoke('catalog-'+role,{id:scoped,version:1})).json();assert.equal(historical.type,'kitchen-catalog-view');assert(!JSON.stringify(historical).includes('876543'));
  const attack=owned('catalog-'+role,current);attack.editable.pricingTerms=current.pricingTerms;assert.equal((await post('catalog-'+role,attack)).status,403);
 }
 const request=crypto.randomUUID(),body=owned('catalog-store',current),args={id:scoped,action:'publish',expected:version,request};
 assert.equal((await invoke('catalog-store',args,body)).status,200);version++;
 assert.equal((await(await invoke('catalog-store',args,body)).json()).catalog.version,version);
 assert.equal((await invoke('catalog-factory',args,body)).status,409,'retry is bound to its actor');
 current=(await(await invoke('engineer',{id:scoped})).json()).catalogRecords;
 const technical=owned('catalog-store',current),used=current.factoryRecipes.families.storage.recipe[0].sku,item=technical.editable.storeCatalog.items.find(i=>i.sku===used);assert(item);item.thicknessMm+=1;
 const changed=await post('catalog-store',technical);assert.equal(changed.status,200,await changed.clone().text());version++;
 current=(await(await invoke('engineer',{id:scoped})).json()).catalogRecords;assert.equal(current.factoryRecipes.approved,false,'store technical publication invalidates factory approval without blocking review');
 const review=await(await invoke('catalog-factory',{id:scoped})).json();assert.equal(review.context.materials.find(i=>i.sku===used).thicknessMm,item.thicknessMm);assert.equal(review.editable.factoryRecipes.approved,false);
 const forged=owned('catalog-store',current);forged.editable.factoryRecipes={...current.factoryRecipes,approved:true};assert.equal((await post('catalog-store',forged)).status,403);
 review.editable.factoryRecipes.approved=true;const approved=await post('catalog-factory',{type:'kitchen-catalog-edit',version:1,baseVersion:version,editable:review.editable});assert.equal(approved.status,200,await approved.clone().text());version++;
 assert.equal((await(await invoke('engineer',{id:scoped})).json()).catalogRecords.factoryRecipes.approved,true);
 const get=bucket.get;bucket.get=async(...args)=>{const file=await get(...args);db.prepare('UPDATE studio_catalog_readers SET role=? WHERE catalog=? AND reader=?').run('factory',scoped,'catalog-store');return file;};
 try{assert.equal((await invoke('catalog-store',{id:scoped})).status,404,'read permissions rechecked after R2');}finally{bucket.get=get;}
 const personal=crypto.randomUUID();assert.equal((await invoke('catalog-store',{id:personal,action:'publish',expected:0,request:crypto.randomUUID()},tpl)).status,201);
 assert.equal((await(await invoke('catalog-store',{id:personal})).json()).role,'owner');
}
console.log('Catalog ACL: additive reader-default migration, role-bearing sharing/read metadata, scoped publication, protected commercial terms and exact-role/revoke races verified.');

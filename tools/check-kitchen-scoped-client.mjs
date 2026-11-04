import assert from 'node:assert/strict';
import {checkedScopedProjectView,checkedScopedCatalogView,createScopedProjectClient,scopedStorageKey,sharedProjectTarget,bootstrapSharedWorkspace} from '../public/kitchen-scoped-client.js';
class Store{constructor(){this.values=new Map();}getItem(k){return this.values.get(k)??null;}setItem(k,v){this.values.set(k,String(v));}removeItem(k){this.values.delete(k);}}
const id='11111111-2222-3333-4444-555555555555',other='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const view=(subject='account-a',role='store',revision=1)=>({type:'kitchen-project-view',version:1,project:{id,revision},access:{subject,role,scopeVersion:2},editable:role==='store'?{storeCatalog:{name:'My stock',items:[{sku:'owned',price:25}]}}:role==='factory'?{factoryRecipes:{families:{}},workshop:{},fieldRegister:{version:1,records:[]},defaults:{baseRows:[],overrides:[]},fieldFiles:[]}:{room:{width:400,length:360,height:280},kitchen:{units:[]},workshop:{},fieldRegister:{version:1,records:[]},defaults:{baseRows:[],overrides:[]},photos:{},fieldFiles:[]},context:role==='store'?{}:role==='factory'?{geometry:{room:{},kitchen:{}},materials:[]}:{materials:[],families:{}},...(role==='rep'?{approvedSale:{status:'pending'}}:{})});
const json=(data,status=200,headers={})=>Response.json(data,{status,headers});
assert.deepEqual(checkedScopedProjectView(view()),view());
for(const invalid of [{type:'kitchen-studio',version:2,design:{}},{...view(),design:{}},{...view(),access:{...view().access,role:'owner'}},{...view(),access:{...view().access,role:'editor'}},{...view(),version:2},{...view('account-a','rep'),approvedSale:{status:'pending',totalMinor:0}},{...view('account-a','rep'),approvedSale:{status:'approved',totalMinor:100,currency:'SAR',revision:1,tax:5}}])assert.throws(()=>checkedScopedProjectView(invalid));
const local=new Store(),session=new Store();local.setItem('atlas-kitchen:project:v1',JSON.stringify({room:{projectId:'K-0123456789ABCDEF'},secret:'preserved full archive'}));local.setItem('kitchen-workshop:access:v1',JSON.stringify({'K-0123456789ABCDEF':{id,revision:1}}));
const beforeLocal=[...local.values];assert.equal(sharedProjectTarget({url:'https://studio.test/',store:local,session}).id,id);assert.equal(sharedProjectTarget({url:'https://studio.test/?shared='+other,store:local,session}).id,other);assert.equal(sharedProjectTarget({url:'https://studio.test/?projects=shared',store:local,session}).selector,true);
let served=view(),subject='account-a',posts=[],transitions=[];
const fetcher=async(url,options={})=>{const q=new URL(url,'https://studio.test').searchParams;
 if(q.get('action')==='session')return json({subject});
 if(q.get('action')==='access')return json({id,revision:served.project.revision,...served.access});
 if(options.method==='POST'){posts.push(JSON.parse(options.body));assert.equal(q.get('action'),'patch');assert.equal(q.get('expected'),String(served.project.revision));served={...served,project:{id,revision:served.project.revision+1},editable:JSON.parse(options.body).editable};return json({id,revision:served.project.revision});}
 return json(served);
};
const client=createScopedProjectClient({fetcher,storage:session,onTransition:s=>transitions.push(s.status)});
await client.load(id);const edit=structuredClone(served.editable);edit.storeCatalog.items[0].price=30;client.remember(edit);const key=scopedStorageKey(served);assert(session.getItem(key));
assert.equal((await client.revalidate()).changed,false);assert.equal(client.draftFor(served).view.editable.storeCatalog.items[0].price,30,'Same-scope refresh preserves the draft.');
const saved=await client.save(edit);assert.equal(saved.project.revision,2);assert.deepEqual(posts,[{type:'kitchen-project-edit',version:1,scopeVersion:2,baseRevision:1,editable:edit}]);assert.equal(session.getItem(key),null);assert.deepEqual([...local.values],beforeLocal,'Scoped transport never saves or archives the full local document.');
client.remember(edit);served={...served,project:{id,revision:3}};await assert.rejects(client.save(edit),e=>e.status===409);assert(client.draftFor(served).conflict);assert.equal(posts.length,1,'A stale draft is never merged client-side over hidden data.');
subject='account-b';served=view(subject,'factory',3);const changed=await client.revalidate();assert(changed.changed);assert.equal(changed.view.access.subject,subject);assert.notEqual(scopedStorageKey(changed.view),key);assert.equal(client.draftFor(changed.view),null);assert(session.getItem(key),'Previous account draft is retained in its own partition.');
served={...served,access:{...served.access,role:'viewer'}};await assert.rejects(client.revalidate());assert.equal(client.getView(),null);assert.equal(transitions.at(-1),'locked');client.dispose();

// A response from a previous project request cannot win after a later load.
let resolveOld;const delayed=new Promise(resolve=>resolveOld=resolve);let calls=0;
const race=createScopedProjectClient({storage:new Store(),fetcher:async(url)=>{const q=new URL(url,'https://studio.test').searchParams;if(q.get('action')==='session')return json({subject:'account-a'});calls++;if(q.get('id')===id)return delayed;return json({...view(),project:{id:other,revision:1}});}});
const first=race.load(id);while(!calls)await new Promise(r=>setImmediate(r));const second=await race.load(other);resolveOld(json(view()));await assert.rejects(first);assert.equal(race.getView().project.id,second.project.id);race.dispose();
const leak=createScopedProjectClient({storage:new Store(),fetcher:async url=>new URL(url,'https://studio.test').searchParams.get('action')==='session'?json({subject:'account-a'}):json({type:'kitchen-studio',version:2,design:{secret:true}},200,{'X-Studio-Role':'rep','X-Studio-Subject':'account-a','X-Studio-Revision':'1'})});await assert.rejects(leak.load(id));assert.equal(leak.getView(),null);leak.dispose();
// Design choices contain editable geometry only and remain bound to the exact
// account, role and source revision used for the server computation.
let rep=view('account-a','rep'),previewBody;
const previews=createScopedProjectClient({storage:new Store(),fetcher:async(url,options={})=>{const q=new URL(url,'https://studio.test').searchParams;
 if(q.get('action')==='session')return json({subject:'account-a'});
 if(q.get('action')==='access')return json({id,revision:1,...rep.access});
 if(q.get('action')==='design-preview'){previewBody=JSON.parse(options.body);return json({type:'kitchen-design-choices',version:1,project:rep.project,access:rep.access,choices:[{editable:rep.editable}]});}
 return json(rep);
}});await previews.load(id);const choiceOptions={walls:['back'],sink:true,dishwasher:false,rice:false};assert.equal((await previews.previewDesign(choiceOptions)).choices.length,1);assert.deepEqual(previewBody,choiceOptions);previews.dispose();
let catalog={type:'kitchen-catalog-view',version:1,catalog:{id:other,version:1},access:{role:'store',subject:'account-a',scopeVersion:1},editable:{storeCatalog:{name:'Scoped stock',items:[]}},context:{}},catalogUpload;
assert(checkedScopedCatalogView(catalog));assert.throws(()=>checkedScopedCatalogView({...catalog,catalogRecords:{secret:true}}));
const catalogs=createScopedProjectClient({storage:new Store(),fetcher:async(url,options={})=>{const route=new URL(url,'https://studio.test'),q=route.searchParams;
 if(q.get('action')==='session')return json({subject:'account-a'});
 if(route.pathname==='/api/projects')return json(q.get('action')==='access'?{id,revision:1,...view().access}:view());
 if(options.method==='POST'){catalogUpload=JSON.parse(options.body);assert.equal(q.get('action'),'publish');catalog={...catalog,catalog:{id:other,version:2},editable:catalogUpload.editable};return json(catalog);}
 if(!q.get('id'))return json({catalogs:[{id:other,name:'Scoped stock',version:1,role:'store'}]});return json(catalog);
}});await catalogs.load(id);assert.equal((await catalogs.listCatalogs()).length,1);const own=await catalogs.loadCatalog(other),updated={storeCatalog:{...own.editable.storeCatalog,name:'Updated stock'}};assert.equal((await catalogs.saveCatalog(own,updated)).catalog.version,2);assert.deepEqual(catalogUpload,{type:'kitchen-catalog-edit',version:1,baseVersion:1,editable:updated});catalogs.dispose();

// Booting a known shared cache selects the DTO workspace before any legacy
// editor is imported, and never installs the old full archive into that view.
class Element{constructor(){this.childNodes=[];this.hidden=false;this.style={};}replaceChildren(...nodes){this.childNodes=nodes;}append(...nodes){this.childNodes.push(...nodes);}remove(){}}
const legacyNode=new Element();legacyNode.textContent='Previously stored owner surface';
const dom={body:new Element(),documentElement:new Element(),visibilityState:'visible',listeners:{},createElement(){return new Element();},addEventListener(type,fn){this.listeners[type]=fn;}};dom.body.append(legacyNode);
const navigation=[],win={location:{assign:url=>navigation.push(url),replace:url=>navigation.push(url),reload:()=>navigation.push('reload')},listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}};
globalThis.location={href:'https://studio.test/?shared='+id};globalThis.localStorage=local;globalThis.sessionStorage=session;
let mountedView,unmounted=0,active=view();const bootFetch=async url=>{const q=new URL(url,'https://studio.test').searchParams;return json(q.get('action')==='session'?{subject:active.access.subject}:q.get('action')==='access'?{id,revision:active.project.revision,...active.access}:active);};
assert.equal(await bootstrapSharedWorkspace({window:win,document:dom,fetcher:bootFetch,mount(host,options){mountedView=options.view;return ()=>unmounted++;}}),true);
assert.equal(mountedView.type,'kitchen-project-view');assert(!JSON.stringify(mountedView).includes('preserved full archive'));assert.deepEqual([...local.values],beforeLocal);assert(!dom.body.childNodes.includes(legacyNode));
await win.listeners.focus();assert.equal(unmounted,0,'An unchanged access check retains the current form.');
active=view('account-b','factory');await win.listeners.focus();assert.equal(unmounted,1);assert.equal(mountedView.access.subject,'account-b');
assert.equal(await bootstrapSharedWorkspace({unit:true,window:win,document:dom,fetcher:bootFetch}),true);assert(navigation.at(-1).includes('?shared='+id));assert.deepEqual([...local.values],beforeLocal);
local.setItem('kitchen-workshop:access:v1',JSON.stringify({'K-0123456789ABCDEF':{id,revision:1,subject:'previous-owner'}}));const foreignCache=[...local.values];
const ownerBoot=async url=>new URL(url,'https://studio.test').searchParams.get('action')==='session'?json({subject:'new-owner'}):json({type:'kitchen-studio',version:2,design:{}},200,{'X-Studio-Role':'owner','X-Studio-Subject':'new-owner','X-Studio-Revision':'1'});
assert.equal(await bootstrapSharedWorkspace({window:win,document:dom,fetcher:ownerBoot,mount(){assert.fail('A foreign cached owner archive must not mount.');}}),true);
assert(dom.body.childNodes[0].childNodes.some(node=>node.textContent?.includes('حساب آخر')));assert.deepEqual([...local.values],foreignCache,'A foreign unsynced full cache stays intact for its owner recovery.');

// A rejected save must never leave bootstrap's host hidden after disposing the
// workspace. Validation failures retain the form only after a fresh scope check.
for(const [status,changeAccount] of [[403,false],[400,false],[422,false],[422,true]]){
 const failureStore=new Store();let controls,disposed=0,activeSubject='account-a',accessReads=0;
 const failureFetch=async(url,options={})=>{const q=new URL(url,'https://studio.test').searchParams;
  if(q.get('action')==='session')return json({subject:activeSubject});
  if(q.get('action')==='access'){accessReads++;return json({id,revision:1,subject:activeSubject,role:'store',scopeVersion:2});}
  if(options.method==='POST'){if(changeAccount)activeSubject='account-b';return json({error:'Rejected owned record '+status},status);}
  return json(view());
 };
 await bootstrapSharedWorkspace({window:win,document:dom,storage:failureStore,fetcher:failureFetch,mount(host,options){controls=options;return ()=>disposed++;}});
 const ownEdit=structuredClone(view().editable);ownEdit.storeCatalog.items[0].price=999;
 await assert.rejects(controls.save(ownEdit),e=>e.status===status);
 const workspace=dom.body.childNodes[0];assert.equal(workspace.hidden,false,'Failure recovery is visible.');
 assert.equal(JSON.parse(failureStore.getItem(scopedStorageKey(view()))).view.editable.storeCatalog.items[0].price,999,'The owned draft remains recoverable.');
 if(status===403||changeAccount){assert.equal(disposed,1);assert(workspace.childNodes.some(node=>node.textContent==='إعادة التحقق'));assert(workspace.childNodes.some(node=>node.textContent==='مشاريع الحساب'));assert(workspace.childNodes.some(node=>node.textContent?.includes('Rejected owned record')));}
 else{assert.equal(disposed,0,'Validation failure keeps the same mounted form.');assert.equal(accessReads,2,'Permission is verified again after validation failure.');}
}

// Check the actual shared projection producer, not just hand-built mock DTOs.
const [{projectView,catalogView},{makeChainExample},{seedCatalog}]=await Promise.all([import('../public/kitchen-project-scope.js'),import('../public/kitchen-chain-model.js'),import('../public/kitchen-workshop-factory.js')]);
const full=makeChainExample();full.room.workshop.catalog=seedCatalog();const archive={type:'kitchen-studio',version:2,design:full,photos:{},fieldFiles:[]};
for(const role of ['store','factory','rep'])assert(checkedScopedProjectView(projectView(role,archive,{id,revision:1,subject:'account-a',approvedSale:{status:'approved',totalMinor:123450,currency:'SAR',revision:1}})));
for(const role of ['viewer','editor']){
 const legacyView=projectView(role,archive,{id,revision:1,subject:'account-a'}),legacyClient=createScopedProjectClient({storage:new Store(),fetcher:async url=>new URL(url,'https://studio.test').searchParams.get('action')==='session'?json({subject:'account-a'}):json(legacyView)});
 await assert.rejects(legacyClient.load(id),error=>error.status===403&&error.message==='يلزم أن يعيّن المالك دور العمل لهذا المشروع.');assert.equal(legacyClient.getView(),null);legacyClient.dispose();
}
for(const role of ['store','factory'])assert(checkedScopedCatalogView(catalogView(role,seedCatalog(),{id,version:1,subject:'account-a'})));
const {encodePortableCatalog,portableFactoryCatalog}=await import('../public/kitchen-factory-template.js');
let ownerCatalog={id:other,version:1,role:'owner',subject:'account-a',scopeVersion:1,catalog:portableFactoryCatalog(seedCatalog()),catalogRecords:encodePortableCatalog(seedCatalog())},ownerWrites=[],ownerReads=0;
const ownerCatalogClient=createScopedProjectClient({storage:new Store(),fetcher:async(url,options={})=>{const route=new URL(url,'https://studio.test'),q=route.searchParams;
 if(q.get('action')==='session')return json({subject:'account-a'});
 if(route.pathname==='/api/projects')return json(q.get('action')==='access'?{id,revision:1,...view().access}:view());
 if(options.method==='POST'){ownerWrites.push(JSON.parse(options.body));ownerCatalog={...ownerCatalog,version:2,catalogRecords:ownerWrites.at(-1)};return json({id:other,version:2});}
 ownerReads++;return ownerCatalog?json(ownerCatalog):json({error:'Catalog revoked'},403);
}});await ownerCatalogClient.load(id);const ownerLoaded=await ownerCatalogClient.loadCatalog(other),ownerEdited=structuredClone(ownerLoaded.catalogRecords);ownerEdited.storeCatalog.name='Owned catalog';ownerEdited.catalogMeta.name='Owned catalog';assert.equal((await ownerCatalogClient.saveOwnerCatalog(ownerLoaded,ownerEdited)).version,2);assert.deepEqual(ownerWrites,[ownerEdited]);
await assert.rejects(ownerCatalogClient.saveOwnerCatalog({...ownerLoaded,role:'store'},ownerEdited));assert.equal(ownerWrites.length,1,'Project-scoped membership cannot forge independent catalog ownership.');
ownerCatalog={...ownerCatalog,version:3};assert.equal((await ownerCatalogClient.revalidate()).changed,false,'The same catalog authority preserves an unsaved editor even when its version advances.');
ownerCatalog={type:'kitchen-catalog-view',version:1,catalog:{id:other,version:3},access:{role:'store',subject:'account-a',scopeVersion:1},editable:{storeCatalog:{name:'Now scoped',items:[]}},context:{}};
assert.equal((await ownerCatalogClient.revalidate()).changed,true,'Owner-to-store catalog downgrade requires a project remount even though the project role is unchanged.');
assert.equal(ownerCatalogClient.getView().access.role,'store');const readsAfterDowngrade=ownerReads;await ownerCatalogClient.revalidate();assert.equal(ownerReads,readsAfterDowngrade,'Remount clears the obsolete active catalog identity.');
await ownerCatalogClient.loadCatalog(other);ownerCatalog=null;await assert.rejects(ownerCatalogClient.revalidate(),error=>error.status===403);assert.equal(ownerCatalogClient.getView(),null,'Revoked catalog access closes the mounted sensitive surface.');ownerCatalogClient.dispose();
console.log('PASS scoped client: strict DTO types, no full-save path, subject/project/role storage partitions, stale requests/drafts, role revocation, and unauthorized full archive rejection.');

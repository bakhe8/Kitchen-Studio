import assert from 'node:assert/strict';
import {projectView,scopedEditable,mergeProjectEdit,catalogView,mergeCatalogEdit} from '../public/kitchen-project-scope.js';
import {makeFurnishedSaudiRoom} from '../public/kitchen-room-presets.js';
import {seedCatalog} from '../public/kitchen-workshop-factory.js';
import {normalizeWorkshopCatalogs,catalogRecordsFromWorkshop} from '../public/kitchen-catalog-records.js';
import {cleanIdea} from '../public/kitchen-ideas.js';
import {upsertFieldRecord} from '../public/kitchen-field-model.js';
import {getProjectDefaultProfile,setProjectDefault} from '../public/kitchen-defaults-model.js';
import {checkedPortableArchive} from '../public/kitchen-archive-validation.js';
import {createKitchen} from '../public/kitchen-model.js';
import {newChainRow,attestChain,applyChain,readChainRange} from '../public/kitchen-chain-model.js';
import {planWorkshopRow} from '../public/kitchen-production-row.js';
import {readWallOptions} from '../public/kitchen-chain-options.js';

const clone=structuredClone,meta={id:'scope-project-id',revision:9,name:'HIDDEN_META_NAME',subject:'authenticated-member'};
// Financial/inventory sentinels are values, not arbitrary digit substrings in
// public record IDs. Keep prose-secret substring checks separate below.
const purchasingNumbers=[12345.67,4321,9876,8765,7654,31.25,14.75];
function assertNoNumericSentinels(value,sentinels,label,path='view'){
 if(value&&typeof value==='object'){for(const [key,item] of Object.entries(value))assertNoNumericSentinels(item,sentinels,label,path+'.'+key);return;}
 for(const sentinel of sentinels)assert(value!==sentinel&&value!==String(sentinel),label+' leaked purchasing/pricing '+sentinel+' at '+path);
}
assertNoNumericSentinels({id:'fr-00004321-0000-4000-8000-000000000002'},purchasingNumbers,'collision regression');
for(const sentinel of purchasingNumbers)for(const value of [sentinel,String(sentinel)])assert.throws(()=>assertNoNumericSentinels({nested:[{price:value}]},purchasingNumbers,'leak regression'),/leaked purchasing\/pricing/);
const catalog=seedCatalog();catalog.approved=true;catalog.items.forEach(i=>{i.price=12345.67;i.stockUnits=4321;i.specRef='STORE_INTERNAL_REFERENCE';});
Object.assign(catalog.terms,{labor:9876,installation:8765,delivery:7654,marginPct:31.25,taxPct:14.75});
catalog.families.storage.recipe[0].label='FACTORY_FORMULA_SECRET';
catalog.teamSource={id:'01234567-1234-1234-1234-0123456789ab',version:4,digest:'b'.repeat(64)};
let doc=makeFurnishedSaudiRoom('apartment');doc.room.projectId='K-0123456789ABCDEF';doc.room.name='REP_CUSTOMER_SECRET';
doc.room.workshop={...doc.room.workshop,...normalizeWorkshopCatalogs({catalog}),referenceOrder:{orderNo:'FACTORY_ORDER_PRIVATE',toleranceMm:2,materialCost:98765.43,lines:[]},approvals:{structure:{key:'a'.repeat(64),name:'OWNER_SIGNER_PRIVATE',date:'2026-11-03T20:00:00Z'}},versions:[{n:1,date:'2026-11-03T20:00:00Z',name:'OWNER_VERSION_PRIVATE',key:'c'.repeat(64),total:65432.10,reason:'OWNER_CHANGE_REASON',released:false,units:[]}]};
const manufactured=doc.kitchen.units.find(u=>u.kind==='storage'),wallOption=readWallOptions(doc,'back');
doc.room.workshop.rows={[manufactured.runId]:{units:[{id:manufactured.id,family:'storage',startMm:manufactured.u*10,widthMm:manufactured.width*10,locks:{width:false,position:false,usage:false,finish:false},use:'PRIVATE_CUSTOMER_USE',drawerUses:['PRIVATE_DRAWER_CONTENTS']}],warnings:['PRIVATE_CUSTOMER_WARNING'],catalogVersion:'1'}};
doc.room.workshop.finishes={frontSku:'FACE-6-W',units:{[manufactured.id]:{frontSku:'FACE-6-G'}},partDefaults:{body:'BODY-6'}};
doc.room.workshop.chains={back:{source:'field',rows:[{id:'start',kind:'start',gapMm:0},{id:'end',kind:'corner',gapMm:doc.room.width*10}],attestation:{key:'s-'+'d'.repeat(64),name:'PRIVATE_SURVEYOR',reference:'PRIVATE_SURVEY_REFERENCE',date:'2026-11-03T20:00:00Z'}}};
doc.room.workshop.options={back:{...wallOption,profiles:[{id:'ledge-context',type:'ledge',fromMm:0,toMm:100,bottomMm:0,topMm:20,depthMm:300,reference:'PRIVATE_PROFILE_REFERENCE'}],heaters:{heater:{state:'exposed',model:'PRIVATE_HEATER_MODEL',manual:'PRIVATE_HEATER_MANUAL',reviewed:true,leftMm:100,rightMm:100,aboveMm:100,belowMm:100,frontMm:100}},linearLight:{state:'factory',recipe:'light-kit',feeds:[{section:'ls-'+'1'.repeat(24),driver:'driver-a',parent:'driver',length:1000,ref:'PRIVATE_LIGHT_REFERENCE',anchor:'e'.repeat(64)}]},scribes:[{unitId:manufactured.id,recipe:'scribe-kit',against:'left',side:'start',kind:'end',plinthHeightMm:0,insetMm:0,accuracyMm:1,reference:'PRIVATE_SCRIBE_REFERENCE',reviewer:'PRIVATE_SCRIBE_REVIEWER',linearVerified:true,anchor:'f'.repeat(64),stations:[[0,0],[800,0]]}]}};
doc.room.defaults={version:1,base:{...getProjectDefaultProfile(doc),kind:'profile',name:'OWNER_PROFILE_PRIVATE'},overrides:[]};
const price=setProjectDefault(doc,{code:'MFG-09',property:'سعر متر سطح العمل المربع',type:'number',mode:'value',value:45678.90,unit:'ريال/م²'});assert(price.ok);doc={...doc,room:price.room};
const files=[];
function addEvidence(code,id,text,shared=null,itemId='project'){
 const file=shared||{id,data:btoa(text)},ref={id:file.id,name:'Evidence '+code,type:'text/plain',size:atob(file.data).length};
 const result=upsertFieldRecord(doc.room,{id:'fr-4321-'+code+'-'+itemId,inputCode:code,itemId,property:'Evidence '+code,valueType:'file',verification:'documented',notes:code==='MFG-09'?'OWNER_NOTE_PRIVATE':/^(MFG|INS)-/.test(code)?'FACTORY_NOTE_PRIVATE':'REP_NOTE_PRIVATE',attachments:[ref]});assert(result.ok,result.reason);doc={...doc,room:result.room};if(!shared)files.push(file);return file;
}
addEvidence('MFG-09','owner-file','OWNER_FILE_BYTES');addEvidence('MFG-06','factory-file','FACTORY_FILE_BYTES');addEvidence('SITE-03','rep-file','REP_FILE_BYTES');
const shared=addEvidence('DOC-01','shared-file','SHARED_FILE_BYTES',null,'back');addEvidence('INS-01','ignored','',shared);
// A shared image may also have a legacy wall-photo copy; neither read path leaks it.
for(const row of doc.room.fieldRegister.records)for(const a of row.attachments||[])if(a.id==='shared-file')a.type='image/jpeg';
doc.room.photoRefs={back:'asset-shared-file',left:'pic-own-photo'};
doc=cleanIdea(doc);assert(doc);
const archive={type:'kitchen-studio',version:2,design:doc,photos:{back:'data:image/jpeg;base64,'+btoa('PRIVATE_WALL_PHOTO'),left:'data:image/jpeg;base64,'+btoa('REP_WALL_PHOTO')},fieldFiles:files};
checkedPortableArchive(archive);
const fullBefore=JSON.stringify(archive),view=role=>projectView(role,archive,{...meta,approvedSale:{status:'approved',totalMinor:321025,currency:'SAR',revision:9,hidden:'MUST_NOT_COPY'}});
const hiddenEvery=['HIDDEN_META_NAME','OWNER_SIGNER_PRIVATE','OWNER_VERSION_PRIVATE','OWNER_CHANGE_REASON','OWNER_PROFILE_PRIVATE','OWNER_NOTE_PRIVATE','45678.9','98765.43','b'.repeat(64),btoa('OWNER_FILE_BYTES')];
for(const role of ['store','factory','rep']){
 const v=view(role),text=JSON.stringify(v);assert.equal(v.type,'kitchen-project-view');assert.equal(v.access.role,role);
 for(const token of hiddenEvery)assert(!text.includes(token),role+' leaked '+token);
 assert(!text.includes('pricingTerms'));assert(!text.includes('MFG-09'));assert(!text.includes('MUST_NOT_COPY'));
 if(role!=='store'){assertNoNumericSentinels(v,purchasingNumbers,role);assert(!text.includes('STORE_INTERNAL_REFERENCE'),role+' leaked purchasing reference');}
 if(role!=='factory')for(const token of ['FACTORY_FORMULA_SECRET','FACTORY_ORDER_PRIVATE','FACTORY_NOTE_PRIVATE',btoa('FACTORY_FILE_BYTES')])assert(!text.includes(token),role+' leaked factory '+token);
 if(role!=='rep')for(const token of ['REP_CUSTOMER_SECRET','REP_NOTE_PRIVATE',btoa('REP_FILE_BYTES'),btoa('REP_WALL_PHOTO'),'321025'])assert(!text.includes(token),role+' leaked representative '+token);
 assert(!text.includes(btoa('SHARED_FILE_BYTES')));assert(!text.includes(btoa('PRIVATE_WALL_PHOTO')));
 const edit={type:'kitchen-project-edit',version:1,scopeVersion:2,baseRevision:9,editable:v.editable},saved=mergeProjectEdit(role,archive,edit,{expectedRevision:9});assert(saved.ok,saved.reason);assert.equal(JSON.stringify(saved.archive),fullBefore,role+' no-op preserves exact full archive');
}
assert.equal(view('rep').approvedSale.totalMinor,321025);assert.deepEqual(projectView('rep',archive,meta).approvedSale,{status:'pending'});
const operational=view('factory').context.geometry.workshop;
assert.equal(operational.rows[manufactured.runId].units[0].family,'storage');assert.equal(operational.finishes.units[manufactured.id].frontSku,'FACE-6-G');assert.equal(operational.chains.back.rows[1].gapMm,doc.room.width*10);assert.equal(operational.options.back.profiles[0].topMm,20);
const contextText=JSON.stringify(operational);for(const token of ['PRIVATE_','attestation','reference','reviewer','kitProof','anchor','drawerUses','warnings','"use"'])assert(!contextText.includes(token),'Operational context leaked '+token);
assert(!saveFactoryContext());
function saveFactoryContext(){const packet={type:'kitchen-project-edit',version:1,scopeVersion:2,baseRevision:9,editable:clone(view('factory').editable)};packet.editable.workshop.rows=operational.rows;return mergeProjectEdit('factory',archive,packet,{expectedRevision:9}).ok;}
assert.deepEqual(projectView('rep',archive,{...meta,approvedSale:{status:'approved',totalMinor:321025,currency:'SAR',revision:8}}).approvedSale,{status:'pending'},'Stale owner amount is not an approval for the projected revision');
for(const role of ['editor','viewer','reader','unknown',null]){const v=view(role);assert.deepEqual(v.editable,{});assert.deepEqual(v.context,{});assert.equal(v.access.status,'assign-role-required');assert(!JSON.stringify(v).includes('SECRET'));assert.equal(mergeProjectEdit(role,archive,{type:'kitchen-project-edit',version:1,scopeVersion:2,baseRevision:9,editable:{}},{expectedRevision:9}).ok,false);}
assert.throws(()=>projectView('owner',archive,meta));
function edit(role,change){const e={type:'kitchen-project-edit',version:1,scopeVersion:2,baseRevision:9,editable:clone(view(role).editable)};change?.(e.editable,e);return e;}
const save=(role,e)=>mergeProjectEdit(role,archive,e,{expectedRevision:9});
for(const role of ['store','factory','rep']){
 assert(!save(role,edit(role,(_,e)=>e.context={})).ok,'Context overpost denied');
 assert(!save(role,edit(role,(_,e)=>e.role='owner')).ok,'Role spoof denied');
 assert(!save(role,edit(role,(_,e)=>e.baseRevision=8)).ok,'Historical write denied');
 assert(!save(role,edit(role,s=>s.pricingTerms={})).ok,'Foreign slice denied');
 assert(!save(role,edit(role,s=>delete s[Object.keys(s)[0]])).ok,'Missing owned slice denied');
 assert(!save(role,{...archive,baseRevision:9}).ok,'Archive is not scoped edit');
}
const store=save('store',edit('store',s=>{s.storeCatalog.items[0].price+=1;s.storeCatalog.approved=false;}));assert(store.ok,store.reason);checkedPortableArchive(store.archive);
assert.deepEqual(store.archive.design.kitchen,doc.kitchen);assert.deepEqual(store.archive.design.room.fieldRegister,doc.room.fieldRegister);assert.deepEqual(store.archive.design.room.workshop.factoryRecipes,doc.room.workshop.factoryRecipes);assert.deepEqual(store.archive.design.room.workshop.pricingTerms,doc.room.workshop.pricingTerms);assert.deepEqual(store.archive.fieldFiles,archive.fieldFiles);
const technical=save('store',edit('store',s=>{s.storeCatalog.items[0].thicknessMm+=1;s.storeCatalog.approved=false;}));assert(technical.ok,technical.reason);assert.equal(technical.archive.design.room.workshop.factoryRecipes.approved,false,'Store technical dependency invalidates factory approval');
const factory=save('factory',edit('factory',s=>{s.factoryRecipes.families.storage.recipe[0].count+=1;s.factoryRecipes.approved=false;}));assert(factory.ok,factory.reason);checkedPortableArchive(factory.archive);
assert.deepEqual(factory.archive.design.room.workshop.storeCatalog,doc.room.workshop.storeCatalog);assert.deepEqual(factory.archive.design.room.workshop.pricingTerms,doc.room.workshop.pricingTerms);assert.deepEqual(factory.archive.design.room.workshop.referenceOrder,doc.room.workshop.referenceOrder);assert.deepEqual(factory.archive.design.kitchen,doc.kitchen);
assert(!save('factory',edit('factory',s=>s.workshop.referenceOrder.materialCost=0)).ok);
assert(!save('factory',edit('factory',s=>s.factoryRecipes.families.storage.secretAdmin='x')).ok);
const rep=save('rep',edit('rep',s=>s.room.name='Updated site name'));assert(rep.ok,rep.reason);checkedPortableArchive(rep.archive);
assert.deepEqual(rep.archive.design.room.workshop,doc.room.workshop);assert.deepEqual(rep.archive.design.room.fieldRegister,doc.room.fieldRegister);assert.deepEqual(rep.archive.design.room.defaults,doc.room.defaults);assert.deepEqual(rep.archive.fieldFiles,archive.fieldFiles);assert.deepEqual(rep.archive.photos,archive.photos);assert.deepEqual(rep.archive.design.room.photoRefs,doc.room.photoRefs);
assert(!save('rep',edit('rep',s=>s.room.workshop={})).ok);assert(!save('rep',edit('rep',s=>s.room.ownerOverride=true)).ok);
assert(!save('rep',edit('rep',s=>s.fieldRegister.records[0].admin=true)).ok);
assert(!save('rep',edit('rep',s=>s.defaults.overrides.push({code:'MFG-09',property:'Owner rate',itemId:'',type:'number',unit:'SAR',mode:'value',value:1}))).ok);
for(const role of ['factory','rep']){
 assert(!save(role,edit(role,s=>s.fieldFiles.push({id:'owner-file',data:btoa('ATTACK')}))).ok);
 assert(!save(role,edit(role,s=>s.fieldFiles.push({id:'shared-file',data:btoa('ATTACK')}))).ok);
 assert(!save(role,edit(role,s=>s.fieldRegister.records[0].attachments.push({id:'owner-file',name:'Claimed',type:'text/plain',size:16}))).ok);
 const ownId=role==='rep'?'rep-file':'factory-file';const changed=save(role,edit(role,s=>{const f=s.fieldFiles.find(f=>f.id===ownId);f.data=btoa(atob(f.data).replace(/./g,'X'));}));assert(changed.ok,changed.reason);checkedPortableArchive(changed.archive);
}
assert(!save('rep',edit('rep',s=>s.photos.back='data:image/jpeg;base64,QUJD')).ok);
const dropped=save('rep',edit('rep',s=>{s.fieldRegister.records=s.fieldRegister.records.filter(r=>!r.attachments.some(a=>a.id==='rep-file'));s.fieldFiles=s.fieldFiles.filter(f=>f.id!=='rep-file');}));assert(dropped.ok,dropped.reason);checkedPortableArchive(dropped.archive);assert(dropped.archive.fieldFiles.some(f=>f.id==='shared-file'));assert(dropped.archive.fieldFiles.some(f=>f.id==='owner-file'));
const sharedRow=doc.room.fieldRegister.records.find(r=>r.inputCode==='DOC-01');const updatedShared=save('rep',edit('rep',s=>s.fieldRegister.records.find(r=>r.id===sharedRow.id).notes='Updated owned note'));assert(updatedShared.ok,updatedShared.reason);assert.deepEqual(updatedShared.archive.design.room.fieldRegister.records.find(r=>r.id===sharedRow.id).attachments,sharedRow.attachments,'Hidden references survive an ordinary own-row edit');checkedPortableArchive(updatedShared.archive);
assert.equal(JSON.stringify(archive),fullBefore,'Projection and merges never mutate the server baseline');

const portable={type:'kitchen-catalog-records',version:1,...catalogRecordsFromWorkshop(doc.room.workshop)};
for(const role of ['store','factory']){
 const v=catalogView(role,portable,{id:'catalog-id',version:3,subject:meta.subject}),text=JSON.stringify(v);assert(!text.includes('pricingTerms'));assert(!text.includes('marginPct'));
 if(role==='store')assert(!text.includes('FACTORY_FORMULA_SECRET'));else assert(!text.includes('12345.67'));
 const own=clone(v.editable);if(role==='store')own.storeCatalog.items[0].price+=2;else own.factoryRecipes.families.storage.recipe[0].count+=2;
 const out=mergeCatalogEdit(role,portable,{type:'kitchen-catalog-edit',version:1,baseVersion:3,editable:own},{expectedVersion:3});assert(out.ok,out.reason);assert.deepEqual(out.catalog.pricingTerms,portable.pricingTerms);
 assert(!mergeCatalogEdit(role,portable,{type:'kitchen-catalog-edit',version:1,baseVersion:2,editable:own},{expectedVersion:3}).ok);
}

// A real factory corner operation can legitimately replan rows; the server
// derives that geometry rather than accepting client geometry or private fields.
const room={width:500,length:500,height:280};let cornerDoc={room:{...room,workshop:normalizeWorkshopCatalogs({catalog:seedCatalog()})},kitchen:createKitchen(room,'empty')};
for(const wall of ['back','left']){const chain={source:'field',rows:[{...newChainRow('corner','tip'),gapMm:5000}]},proof=attestChain(cornerDoc,wall,chain,{name:'Rep',reference:'Site'});assert(proof.ok);const out=applyChain(cornerDoc,wall,proof.chain);assert(out.ok);cornerDoc=out.doc;}
const planned=planWorkshopRow(cornerDoc,{...readChainRange(cornerDoc,'back'),tier:'base',wanted:{rice:false,sink:false,dishwasher:false}});assert(planned.ok,planned.reason);cornerDoc=cleanIdea(planned.doc);
const cornerArchive={type:'kitchen-studio',version:2,design:cornerDoc,photos:{},fieldFiles:[]},cornerEdit={type:'kitchen-project-edit',version:1,scopeVersion:2,baseRevision:1,editable:scopedEditable('factory',cornerArchive)};
cornerEdit.editable.workshop.corners={'back+left':{a:'back',b:'left',tall:false,base:{aMm:900,bMm:900,inside:'shelves',access:'a',sku:''}}};
const cornerSaved=mergeProjectEdit('factory',cornerArchive,cornerEdit,{expectedRevision:1});assert(cornerSaved.ok,cornerSaved.reason);checkedPortableArchive(cornerSaved.archive);assert.notDeepEqual(cornerSaved.archive.design.kitchen,cornerDoc.kitchen);
const empty=clone(archive);for(const k of ['storeCatalog','factoryRecipes','pricingTerms','catalogMeta'])delete empty.design.room.workshop[k];
const emptyView=projectView('store',empty,meta);assert.equal(emptyView.editable.storeCatalog,null);const bootstrap=mergeProjectEdit('store',empty,{type:'kitchen-project-edit',version:1,scopeVersion:2,baseRevision:9,editable:{storeCatalog:view('store').editable.storeCatalog}},{expectedRevision:9});assert(!bootstrap.ok,'Scoped readers cannot invent hidden seed records');
assert.equal(projectView('rep',empty,meta).editable.room.width,empty.design.room.width,'No-catalog survey is still usable');
console.log('PASS: role-confidential project/catalog DTOs, sentinel exclusion, closed legacy reads, complete owned-slice merges, hidden-data preservation, attachment custody, real derived corner replay and revision/overpost defenses.');

import assert from 'node:assert/strict';
import {operationFixture} from './check-kitchen-project-operations.mjs';
import {executeProjectOperation as execute} from '../public/kitchen-scoped-operations.js';
import {factorySpecialTargets,reviewSpecial,specialParts} from '../public/kitchen-workshop-factory-special.js';
import {readWorkshopCatalog} from '../public/kitchen-catalog-view.js';
import {projectView,mergeProjectEdit,catalogView,mergeCatalogEdit} from '../public/kitchen-project-scope.js';
import {scopeWidgetDocument,scopeCatalogForWidget,scopeRecordFromCatalog} from '../public/kitchen-scope-widgets.js';
import {catalogRecordsFromWorkshop} from '../public/kitchen-catalog-records.js';
import {checkedPortableArchive} from '../public/kitchen-archive-validation.js';
const {archive,unitId}=operationFixture(),meta={id:'scoped-special-project-0001',subject:'factory-user',expectedRevision:4};
const run=(role,operation,source=archive,other={})=>execute(role,source,{type:'kitchen-project-operation',version:1,baseRevision:4,operation},{...meta,subject:role+'-user',...other});
const opened=run('factory',{kind:'interior.open',unitId});assert(opened.ok);
const plan=structuredClone(opened.result.plan);plan.cells['0:0']='boxes';
const interior=run('factory',{kind:'interior.set',unitId,plan});assert(interior.ok);const source=interior.archive;
const real=factorySpecialTargets(source.design).find(t=>t.id==='inside:'+unitId),redacted=factorySpecialTargets(scopeWidgetDocument(projectView('factory',source,{id:meta.id,revision:4,subject:'factory-user'}))).find(t=>t.id===real.id);
assert(real&&redacted);assert.notEqual(redacted.signature,real.signature,'Reproduce the integration blocker: a redacted widget cannot stamp full-project geometry.');
const inspect=run('factory',{kind:'special.open',targetId:real.id},source);assert(inspect.ok,inspect.reason);
assert.equal(inspect.result.targetId,real.id);assert.equal(inspect.result.draft,null);assert.equal(inspect.result.targets.find(t=>t.id===real.id).current,false);
const raw=JSON.stringify(inspect.result);for(const secret of ['signature','materialKey','987.65','876.54','SECRET-SUPPLIER','SECRET-FACTORY','SECRET-CUSTOMER'])assert(!raw.includes(secret),secret);
const draft={reviewer:'Factory reviewer',measurement:'Measured drawing 7',drawing:'Sheet INS-7',instructions:'Machine and fit as sheet INS-7',lines:[{sku:'AL-20',label:'Internal shelf crossrail',count:2,a:460,b:null,operation:'Square cut'}]};
const checked=run('factory',{kind:'special.review',targetId:real.id,draft},source);assert(checked.ok,checked.reason);assert(checked.mutates&&checked.review);
const before=source.design.room.workshop,after=checked.archive.design.room.workshop,sheet=after.factoryRecipes.specials[real.id];
assert.equal(sheet.signature,real.signature);assert.deepEqual(sheet,reviewSpecial(real,draft,readWorkshopCatalog(before).items));
assert.equal(after.factoryRecipes.revision,before.factoryRecipes.revision+1);assert.equal(after.factoryRecipes.approved,false);assert.deepEqual(after.storeCatalog,before.storeCatalog);assert.deepEqual(after.pricingTerms,before.pricingTerms);assert.deepEqual(checked.archive.design.kitchen,source.design.kitchen);
assert.deepEqual(after.factoryRecipes.families,before.factoryRecipes.families);assert.deepEqual(after.approvals,before.approvals);assert.equal(after.catalogMeta.layoutRevision,before.catalogMeta.layoutRevision);
assert.equal(checked.result.targets.find(t=>t.id===real.id).current,true);assert.deepEqual(checked.result.draft,draft);
const issues=[],releaseIssues=[],parts=specialParts(real,readWorkshopCatalog(after),issues,releaseIssues,checked.archive.design);assert(parts?.length);assert.deepEqual(issues,[]);
for(const role of ['rep','store','owner','viewer','editor'])for(const operation of [{kind:'special.open',targetId:real.id},{kind:'special.review',targetId:real.id,draft}])assert.equal(run(role,operation,source).ok,false,role);
for(const bad of [{...draft,signature:real.signature},{...draft,lines:[{...draft.lines[0],materialKey:'a'.repeat(64)}]},{...draft,pricingTerms:{delivery:0}}])assert.equal(run('factory',{kind:'special.review',targetId:real.id,draft:bad},source).ok,false);
assert.equal(run('factory',{kind:'special.review',targetId:'inside:missing',draft},source).ok,false);
const moved=structuredClone(checked.archive);moved.design.room.workshop.chains.right.attestation={key:'s-'+'a'.repeat(64),name:'PRIVATE-SURVEYOR',reference:'PRIVATE-SURVEY-REFERENCE',date:'2026-11-04T00:00:00.000Z'};
const stale=run('factory',{kind:'special.open',targetId:real.id},moved);assert(stale.ok);assert.equal(stale.result.targets.find(t=>t.id===real.id).current,false);assert(!JSON.stringify(stale.result).includes('PRIVATE-SURVEY'));
assert.equal(run('factory',{kind:'special.review',targetId:real.id,draft},source,{expectedRevision:5}).ok,false,'An old operation envelope cannot run against a newer version.');
const reread=run('factory',{kind:'special.open',targetId:real.id},checked.archive);assert(reread.ok);assert.deepEqual(reread.result.draft,draft);
assert.equal(JSON.stringify(source).includes('INS-7'),false,'Review must never mutate the verified source.');

// A reviewed sheet contains proof of the full, private project. General project
// views use an empty sheet slot; only special.open exposes its safe own draft.
const stored=structuredClone(checked.archive);stored.design.room.workshop.factoryRecipes.specials['inside:legacy-sheet']=structuredClone(sheet);
const storedBefore=JSON.stringify(stored),savedSheets=structuredClone(stored.design.room.workshop.factoryRecipes.specials);
const scoped=projectView('factory',stored,{id:meta.id,revision:4,subject:'factory-user'});
assert.deepEqual(scoped.editable.factoryRecipes.specials,{},'General factory DTOs do not transport server-owned special sheets.');
for(const token of ['signature','materialKey',sheet.signature,sheet.lines[0].materialKey])assert(!JSON.stringify(scoped).includes(token),'Project view leaked '+token);
const packet=(edit={},archive=stored)=>({type:'kitchen-project-edit',version:1,scopeVersion:2,baseRevision:4,editable:{...structuredClone(projectView('factory',archive,{id:meta.id,revision:4,subject:'factory-user'}).editable),...edit}});
const merge=(edit,archive=stored)=>mergeProjectEdit('factory',archive,edit,{expectedRevision:4});
const unchanged=merge(packet());assert(unchanged.ok,unchanged.reason);assert.equal(JSON.stringify(unchanged.archive),storedBefore,'A no-op preserves every byte of the canonical project.');
const approve=packet();approve.editable.factoryRecipes.approved=true;
const approved=merge(approve);assert(approved.ok,approved.reason);assert.equal(approved.archive.design.room.workshop.factoryRecipes.approved,true);assert.deepEqual(approved.archive.design.room.workshop.factoryRecipes.specials,savedSheets,'Approving the factory record preserves current and legacy sheet proofs.');checkedPortableArchive(approved.archive);
const widgetCatalog=scopeCatalogForWidget(scoped);widgetCatalog.families.storage.recipe[0].count+=1;
const editedRecord=scopeRecordFromCatalog(scoped,widgetCatalog),edited=merge(packet({factoryRecipes:editedRecord}));assert(edited.ok,edited.reason);checkedPortableArchive(edited.archive);
assert.deepEqual(edited.archive.design.room.workshop.factoryRecipes.specials,savedSheets,'The actual recipe widget roundtrip preserves hidden sheets.');
assert.equal(edited.archive.design.room.workshop.factoryRecipes.families.storage.recipe[0].count,stored.design.room.workshop.factoryRecipes.families.storage.recipe[0].count+1);
assert.deepEqual(edited.archive.design.room.workshop.storeCatalog,stored.design.room.workshop.storeCatalog);assert.deepEqual(edited.archive.design.room.workshop.pricingTerms,stored.design.room.workshop.pricingTerms);
const approvedNoop=merge(packet({},approved.archive),approved.archive);assert(approvedNoop.ok,approvedNoop.reason);assert.equal(JSON.stringify(approvedNoop.archive),JSON.stringify(approved.archive),'Approved no-op cannot revoke approval or restamp proofs.');
for(const payload of [savedSheets,{[real.id]:draft},{[real.id]:{...sheet,instructions:'Forged generic edit'}},{'inside:new-sheet':sheet},null]){
 const bad=packet();bad.editable.factoryRecipes.specials=structuredClone(payload);assert(!merge(bad).ok,'Generic PATCH cannot submit, change, delete or fabricate special sheets.');
}
const omitted=packet();delete omitted.editable.factoryRecipes.specials;assert(!merge(omitted).ok,'Omitting the protected slot must not erase sheets.');
const legacy=structuredClone(stored),legacyWorkshop=legacy.design.room.workshop,flat=structuredClone(readWorkshopCatalog(legacyWorkshop));
for(const key of ['storeCatalog','factoryRecipes','pricingTerms','catalogMeta'])delete legacyWorkshop[key];legacyWorkshop.catalog=flat;
const legacyNoop=merge(packet({},legacy),legacy);assert(legacyNoop.ok,legacyNoop.reason);assert.equal(JSON.stringify(legacyNoop.archive),JSON.stringify(legacy),'An old flat project survives a no-op without migration or proof loss.');
const legacyApproval=packet({},legacy);legacyApproval.editable.factoryRecipes.approved=true;
const legacySaved=merge(legacyApproval,legacy);assert(legacySaved.ok,legacySaved.reason);checkedPortableArchive(legacySaved.archive);assert.deepEqual(readWorkshopCatalog(legacySaved.archive.design.room.workshop).specials,savedSheets);
// Team catalog publications have their separate legacy contract; tightening a
// project-only command must not silently delete or redact their stored sheets.
const portable={type:'kitchen-catalog-records',version:1,...catalogRecordsFromWorkshop(stored.design.room.workshop)};
const catalogScoped=catalogView('factory',portable,{id:'special-template',version:3,subject:'factory-user'});assert.deepEqual(catalogScoped.editable.factoryRecipes.specials,savedSheets);
catalogScoped.editable.factoryRecipes.families.storage.recipe[0].count+=2;
const catalogSaved=mergeCatalogEdit('factory',portable,{type:'kitchen-catalog-edit',version:1,baseVersion:3,editable:catalogScoped.editable},{expectedVersion:3});assert(catalogSaved.ok,catalogSaved.reason);assert.deepEqual(catalogSaved.catalog.factoryRecipes.specials,savedSheets);
assert.equal(JSON.stringify(stored),storedBefore,'Projection and merge never alter the verified source.');
console.log('Scoped special sheets: full/redacted mismatch reproduced; server-derived target and material proofs, safe views, factory-only exact updates, stale target/revision and forged proof rejection.');

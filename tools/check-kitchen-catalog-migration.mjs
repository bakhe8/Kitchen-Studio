import assert from 'node:assert/strict';
import {seedCatalog,cleanCatalog,getFactoryCatalog} from '../public/kitchen-workshop-factory.js';
import {catalogRecordsFromWorkshop,catalogRecordStates,normalizeWorkshopCatalogs} from '../public/kitchen-catalog-records.js';
import {portableFactoryCatalog,catalogFingerprint,encodePortableCatalog,decodePortableCatalog,installTeamCatalog,installPortableCatalog} from '../public/kitchen-factory-template.js';
import {offlineDigest} from '../public/kitchen-workshop-revision.js';

const legacy=seedCatalog();legacy.approved=true;legacy.revision=7;legacy.layoutRevision=3;
legacy.items.forEach(i=>{i.price=10;});Object.assign(legacy.terms,{labor:0,installation:0,delivery:0,marginPct:0,taxPct:0});
legacy.teamSource={id:'11111111-1111-1111-1111-111111111111',version:4,digest:'a'.repeat(64)};
// This is the published v1 algorithm, intentionally independent of the new
// encoder. Existing server pins must continue to recognize the same contents.
const {teamSource,specials,revision,layoutRevision,...values}=cleanCatalog(legacy);
const historical={...values,revision:1,layoutRevision:1,specials:{}};
const oldDigest=offlineDigest(new TextEncoder().encode(JSON.stringify({...historical,approved:true})));
assert.deepEqual(portableFactoryCatalog(legacy),historical);assert.equal(catalogFingerprint(legacy),oldDigest);
const split=normalizeWorkshopCatalogs({catalog:legacy}),before=JSON.stringify(split);
const wire=encodePortableCatalog(split);assert(wire);assert.equal(JSON.stringify(split),before,'encoding cannot edit the project');
assert.equal(catalogFingerprint(wire),oldDigest);assert.equal(catalogFingerprint(JSON.parse(JSON.stringify(split))),oldDigest);
assert.equal(wire.catalogMeta.teamSource,undefined);assert.deepEqual(wire.factoryRecipes.specials,{});
assert.deepEqual(catalogRecordStates(decodePortableCatalog(wire)),{store:{revision:1,approved:true},factory:{revision:1,approved:true},pricing:{revision:1,approved:true}});
assert.deepEqual(portableFactoryCatalog(wire),historical);

const mixed=structuredClone(wire);mixed.storeCatalog.approved=false;mixed.pricingTerms.approved=false;
const restored=decodePortableCatalog(JSON.parse(JSON.stringify(mixed)));
assert.equal(restored.catalog.approved,true);assert.equal(restored.storeCatalog.approved,false);assert.equal(restored.pricingTerms.approved,false);
assert.deepEqual(encodePortableCatalog(restored),mixed,'all independent approvals survive a JSON round trip');
assert.equal(catalogFingerprint(mixed),oldDigest,'a technical approval override retains legacy fingerprint semantics');
const factoryDraft=structuredClone(mixed);factoryDraft.factoryRecipes.approved=false;
assert.equal(catalogFingerprint(factoryDraft),oldDigest);assert.equal(decodePortableCatalog(factoryDraft).catalog.approved,false);
const price=structuredClone(mixed);price.storeCatalog.items[0].price=11;assert.notEqual(catalogFingerprint(price),oldDigest);
const terms=structuredClone(mixed);terms.pricingTerms.terms.delivery=1;assert.notEqual(catalogFingerprint(terms),oldDigest);
const recipe=structuredClone(mixed);recipe.factoryRecipes.families.storage.recipe[0].count++;assert.notEqual(catalogFingerprint(recipe),oldDigest);
const numbered=structuredClone(mixed);for(const key of ['storeCatalog','factoryRecipes','pricingTerms'])numbered[key].revision=99;
numbered.catalogMeta.revision=100;numbered.catalogMeta.layoutRevision=50;assert.equal(catalogFingerprint(numbered),oldDigest);
assert.deepEqual(encodePortableCatalog(numbered),mixed,'project ordinals are not transported as template identity');

for(const invalid of [null,{},[],{type:'other',version:1,...catalogRecordsFromWorkshop(split)},{...wire,version:2},{storeCatalog:wire.storeCatalog}])assert.equal(decodePortableCatalog(invalid),null);
const dual={...wire,catalog:{...legacy,name:'conflicting'}};assert.equal(decodePortableCatalog(dual),null,'conflicting old and new content must fail closed');
const plain={room:{width:500,length:500,height:280},kitchen:{units:[],runs:[],features:[]}};
const source={id:'22222222-2222-2222-2222-222222222222',version:3,digest:oldDigest};
const adopted=installTeamCatalog(plain,source,mixed);assert(adopted);assert.equal(adopted.room.workshop.storeCatalog.approved,false);assert.equal(adopted.room.workshop.pricingTerms.approved,false);
assert.equal(getFactoryCatalog(adopted).teamSource.digest,oldDigest);assert.equal(catalogFingerprint(adopted.room.workshop),oldDigest);
assert.equal(installTeamCatalog(plain,{...source,digest:'b'.repeat(64)},mixed),null);
assert.equal(installTeamCatalog(plain,source,factoryDraft),null,'an unapproved factory template still cannot be applied');
assert(installTeamCatalog(plain,source,legacy),'already published flat v1 templates remain applicable');
const importedDraft=installPortableCatalog(adopted,factoryDraft);assert(importedDraft,'file imports may contain a draft factory');
assert.deepEqual(catalogRecordStates(importedDraft.room.workshop),{store:{revision:1,approved:false},factory:{revision:1,approved:false},pricing:{revision:1,approved:false}});
assert.equal(getFactoryCatalog(importedDraft).teamSource,undefined,'a local file import unpins the team source');
console.log('Catalog migration: legacy published fingerprint parity, split portable approval retention, immutable encoding, project-field exclusion, content-sensitive identity, draft/malformed rejection and old/new team installs.');

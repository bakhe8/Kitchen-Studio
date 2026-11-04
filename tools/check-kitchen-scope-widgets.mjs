import assert from 'node:assert/strict';
import {projectView,mergeProjectEdit} from '../public/kitchen-project-scope.js';
import {newSurveyProject} from '../public/kitchen-project.js';
import {seedCatalog} from '../public/kitchen-workshop-factory.js';
import {normalizeWorkshopCatalogs} from '../public/kitchen-catalog-records.js';
import {scopeWidgetDocument,scopeEditableFromWidget,scopeCatalogForWidget,scopeRecordFromCatalog,scopeWidgetId,approvedSaleHTML} from '../public/kitchen-scope-widgets.js';
const doc=newSurveyProject({widthMm:4000,lengthMm:3600,heightMm:2800,name:'Private customer'}, {getItem:()=>null});
const cat=seedCatalog();cat.items.forEach(i=>i.price=12345);cat.terms.marginPct=79;doc.room.workshop=normalizeWorkshopCatalogs({catalog:cat});
cat.items.find(i=>i.sku==='SLIDE').runnerSpec={reference:'PRIVATE STORE RUNNER SPEC',minWidthMm:300,maxWidthMm:900,minDepthMm:400,maxDepthMm:700,minGapMm:10,maxGapMm:20,travelMm:450,movingKg:60};doc.room.workshop=normalizeWorkshopCatalogs({catalog:cat});
const archive={type:'kitchen-project',version:1,design:doc,photos:{},fieldFiles:[]},meta={id:'11111111-2222-3333-4444-555555555555',revision:1,subject:'actor-one'};
for(const role of ['store','factory','rep']){
 const view=projectView(role,archive,meta),widget=scopeWidgetDocument(view),round=scopeEditableFromWidget(view,widget);
 assert.deepEqual(round,view.editable,role+' widget round trip preserves owned data without installing a full archive');
 const other=structuredClone(view);other.access.subject='actor-two';assert.notEqual(scopeWidgetId(view),scopeWidgetId(other));
 if(role!=='store'){assert(!JSON.stringify(widget).includes('12345'));assert(!JSON.stringify(widget).includes('"marginPct":79'));}
 if(role==='store'){
  const c=scopeCatalogForWidget(view);assert.deepEqual(c.families,{},'Store editor has no invented or real factory recipe');
  Object.assign(c.items[0],{price:55,colorHex:'',specRef:'',sectionWidthMm:null,gaugeMm:null,grooveWidthMm:null,grooveDepthMm:null,massKgM2:null,leadDays:null});const record=scopeRecordFromCatalog(view,c);
  const out=mergeProjectEdit(role,archive,{type:'kitchen-project-edit',version:1,scopeVersion:2,baseRevision:1,editable:{storeCatalog:record}},{expectedRevision:1});
  assert(out.ok,out.reason);assert.equal(out.archive.design.room.workshop.pricingTerms.terms.marginPct,79);
 }
 if(role==='factory'){
  assert(!JSON.stringify(widget).includes('Private customer'));
  assert(!JSON.stringify(widget).includes('PRIVATE STORE RUNNER SPEC'));
  const c=scopeCatalogForWidget(view);c.families.storage.recipe[0].count=3;const editable=structuredClone(view.editable);editable.factoryRecipes=scopeRecordFromCatalog(view,c);
  const merged=mergeProjectEdit(role,archive,{type:'kitchen-project-edit',version:1,scopeVersion:2,baseRevision:1,editable},{expectedRevision:1});assert(merged.ok,merged.reason);assert.equal(merged.archive.design.room.workshop.storeCatalog.items.find(i=>i.sku==='SLIDE').runnerSpec.reference,'PRIVATE STORE RUNNER SPEC');
  widget.room.workshop.pricingTerms={terms:{taxPct:88}};
  assert(!JSON.stringify(scopeEditableFromWidget(view,widget)).includes('taxPct'));
 }
 if(role==='rep')assert.equal(scopeCatalogForWidget(view),null,'Rep never receives or synthesizes a factory catalog');
}
assert(!approvedSaleHTML({status:'pending',totalMinor:991199}).includes('991199'));
assert(approvedSaleHTML({status:'approved',totalMinor:100000,currency:'SAR',revision:2}).includes('سعر البيع النهائي'));
assert(!approvedSaleHTML({status:'approved',totalMinor:'<script>',revision:2}).includes('<script>'));
console.log('PASS: transient widget own-data round trips, account partition IDs, no invented rep/store recipes, hidden-data-preserving store edit, and approved-only sale rendering.');

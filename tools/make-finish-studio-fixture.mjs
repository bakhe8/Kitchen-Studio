// Local browser-review fixture only. All catalog prices and catalog approval
// flags below are synthetic test data; no project/site/customer approval is made.
// The exported room measurements, recorded survey and complete CAD are preserved.
// Usage: node tools/make-finish-studio-fixture.mjs [path-to-export.json]
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkedPortableArchive} from '../public/kitchen-archive-validation.js';
import {getFactoryCatalog,cleanCatalog,buildFactoryQuote} from '../public/kitchen-workshop-factory.js';
import {reconcileWorkshopCatalogs,approveWorkshopCatalogRecord,normalizeWorkshopCatalogs,catalogRecordStates} from '../public/kitchen-catalog-records.js';
import {approvalState} from '../public/kitchen-workshop-state.js';
import {finishMembers} from '../public/kitchen-finish-parts.js';
import {reviewFinishPreview} from '../public/kitchen-finish-preview.js';
import {surveyNotebookSummary} from '../public/kitchen-survey-notebook-model.js';

const input=process.argv[2]||'C:/Users/Bakheet/Downloads/اختبار دفتر الموقع — تكامل-مطبخ (2).json';
const destination=new URL('../docs/kitchen-studio/finish-studio-review/input-project.json',import.meta.url);
const inputText=await readFile(input,'utf8'),archive=JSON.parse(inputText);
const checked=checkedPortableArchive(archive);assert(checked.doc,'source export is valid');
const source=archive.design,doc=structuredClone(source),sourceSha256=createHash('sha256').update(inputText).digest('hex');
const nextId='K-'+createHash('sha256').update('finish-studio-review-v1:'+sourceSha256).digest('hex').slice(0,16).toUpperCase();
assert.notEqual(nextId,source.room.projectId,'the review project has its own identity');
doc.room.name='اختبار التشطيب — رحلة التكامل';doc.room.projectId=nextId;

const catalog=structuredClone(getFactoryCatalog(doc));
catalog.name='كتالوج اختبار التشطيب';catalog.approved=false;
for(const item of catalog.items){
 item.price=item.kind==='panel'?100:item.kind==='bar'?20:10;
 item.stockUnits=1000;item.available=true;
}
const item=sku=>{const value=catalog.items.find(i=>i.sku===sku);assert(value,'required base SKU '+sku);return value;};
item('FACE-6-G').price=150;
const variants=[
 {...item('FACE-6-W'),sku:'FACE-6-NAVY',name:'واجهة كحلية — عينة اختبار',color:'كحلي',colorHex:'#263e56',price:220},
 {...item('BODY-6'),sku:'BODY-BLUE',name:'لوح جسم أزرق — عينة اختبار',color:'أزرق',colorHex:'#15658a',price:135},
 {...item('PULL'),sku:'PULL-BRASS',name:'يد نحاسية — عينة اختبار',color:'نحاسي',colorHex:'#b57132',price:28},
 {...item('FACE-6-W'),sku:'FACE-8-INVALID',name:'واجهة ٨ مم — لاختبار رفض السماكة',color:'أحمر اختباري',colorHex:'#994333',thicknessMm:8,price:200}
];
for(const variant of variants){const index=catalog.items.findIndex(i=>i.sku===variant.sku);if(index<0)catalog.items.push(variant);else catalog.items[index]=variant;}
const alternatives=(source,labels,skus)=>({source,labels,skus:[source,...skus],mode:'matching',reference:'TEST ONLY — finish-studio integration fixture v1'});
for(const key of ['storage','upperStorage']){
 const family=catalog.families[key];assert(family,'base/upper factory family exists');
 family.frontSkus=[...new Set([...(family.frontSkus||[]),'FACE-6-W','FACE-6-G','FACE-6-NAVY','FACE-8-INVALID'])];
 family.finishSlots={...family.finishSlots,
  body:alternatives('BODY-6',['جانب جسم','قاعدة جسم'],['BODY-BLUE']),
  handle:alternatives('PULL',['يد'],['PULL-BRASS'])};
}
Object.assign(catalog.terms,{worktop:'separate',labor:120,delivery:50,installation:180,marginPct:10,taxPct:15});
assert(cleanCatalog(catalog),'all test choices form a valid catalog; incompatibility is checked per chosen unit');
const originalWorkshop=doc.room.workshop;
doc.room.workshop=reconcileWorkshopCatalogs({...originalWorkshop,catalog},originalWorkshop);
assert(doc.room.workshop,'install through the actual catalog reconciliation API');
for(const role of ['store','factory','pricing']){
 doc.room.workshop=approveWorkshopCatalogRecord(doc.room.workshop,role);
 assert(doc.room.workshop,'test catalog approval for '+role);
}
doc.room.workshop=normalizeWorkshopCatalogs(doc.room.workshop);assert(doc.room.workshop);
assert(Object.values(catalogRecordStates(doc.room.workshop)).every(record=>record.approved));

// A catalog fixture never manufactures a human structure/customer signature.
// Preserve only source approvals that remain valid against the exact candidate.
const state=await approvalState(doc),approvals={...doc.room.workshop.approvals},removedApprovals=[];
for(const stage of ['structure','customer','release'])if(approvals[stage]&&!state.valid[stage]){delete approvals[stage];removedApprovals.push(stage);}
if(Object.keys(approvals).length)doc.room.workshop.approvals=approvals;else delete doc.room.workshop.approvals;
assert(!(await approvalState(doc)).valid.structure,'the browser reviewer must approve this new test catalog in the UI');

// Preserve the source survey, CAD, defaults and every unrelated workshop field.
const omit=(object,keys)=>Object.fromEntries(Object.entries(object).filter(([key])=>!keys.includes(key)));
assert.deepEqual(doc.kitchen,source.kitchen);
assert.deepEqual(omit(doc.room,['name','projectId','workshop']),omit(source.room,['name','projectId','workshop']));
const catalogKeys=['catalog','storeCatalog','factoryRecipes','pricingTerms','catalogMeta','approvals'];
assert.deepEqual(omit(doc.room.workshop,catalogKeys),omit(source.room.workshop,catalogKeys));
for(const wall of Object.keys(source.room.workshop.chains||{}))assert.equal(surveyNotebookSummary(doc,wall).proofValid,surveyNotebookSummary(source,wall).proofValid,'unchanged wall proof: '+wall);

const quote=buildFactoryQuote(doc);assert.deepEqual(quote.issues,[]);assert.deepEqual(quote.machineIssues,[]);
assert(quote.complete&&Number.isFinite(quote.total),'synthetic test prices provide a complete quote');
const actualCatalog=getFactoryCatalog(doc),members=finishMembers(doc,actualCatalog),baseUnit=members.find(u=>u.family==='storage'),upperUnit=members.find(u=>u.family==='upperStorage');
assert(baseUnit&&upperUnit,'both unit families are present in the real export');
const previews={};
for(const [key,part,sku] of [['navy','front','FACE-6-NAVY'],['warm','front','FACE-6-G'],['body','body','BODY-BLUE'],['handle','handle','PULL-BRASS']]){
 const preview=reviewFinishPreview(doc,actualCatalog,{scope:baseUnit.id,part,sku});
 previews[key]={scope:baseUnit.id,part,sku,total:preview.total,delta:preview.delta,materialValue:preview.materialValue,materialDelta:preview.materialDelta,scopedMaterialValue:preview.scopedMaterialValue};
}
reviewFinishPreview(doc,actualCatalog,{scope:upperUnit.id,part:'body',sku:'BODY-BLUE'});
reviewFinishPreview(doc,actualCatalog,{scope:upperUnit.id,part:'handle',sku:'PULL-BRASS'});
assert.throws(()=>reviewFinishPreview(doc,actualCatalog,{scope:baseUnit.id,part:'front',sku:'FACE-8-INVALID'}),/سماكة|تعشيق|خلوص/);
assert.deepEqual(doc.kitchen,source.kitchen,'all preview checks are pure');

const output={...archive,design:doc,fixture:{testOnly:true,purpose:'اختبار محلي للتشطيب؛ جميع الأسعار واعتمادات الكتالوج بيانات تجريبية وليست عرضًا تجاريًا أو اعتماد مشروع.',sourceFile:basename(input),sourceProjectId:source.room.projectId,sourceSha256,syntheticCatalog:true,syntheticPrices:true,removedApprovals,preserved:'قياسات الغرفة وقراءات الجدران وتوثيقها وCAD والصفوف دون تغيير'}};
const roundTrip=checkedPortableArchive(JSON.parse(JSON.stringify(output)));
assert.deepEqual(roundTrip.doc.kitchen,source.kitchen,'actual import codec preserves every CAD field');
assert.deepEqual(roundTrip.doc.room.workshop.chains,source.room.workshop.chains);
assert.deepEqual(roundTrip.photos,archive.photos);
assert.equal(await readFile(input,'utf8'),inputText,'the original export is untouched');
await mkdir(new URL('.',destination),{recursive:true});
await writeFile(destination,JSON.stringify(output,null,2)+'\n','utf8');
console.log(JSON.stringify({output:fileURLToPath(destination),testOnly:true,projectId:nextId,name:doc.room.name,
 roomMm:{width:doc.room.width*10,length:doc.room.length*10,height:doc.room.height*10},units:doc.kitchen.units.length,
 primaryUnit:baseUnit.id,upperUnit:upperUnit.id,removedApprovals,catalog:actualCatalog.name,
 quote:{total:quote.total,materialValue:quote.materialValue,complete:quote.complete,ready:quote.ready,releaseIssues:quote.releaseIssues,fitoutPending:quote.fitoutPending},previews},null,2));

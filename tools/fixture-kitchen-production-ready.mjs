// Synthetic machining evidence for automated UI checks. These machine limits,
// measurements and signatures are fixtures, never an actual production order.
import assert from 'node:assert/strict';
import {makeQuoteReadyFixture} from './fixture-kitchen-quote-ready.mjs';
import {getFactoryCatalog,buildFactoryQuote,cleanCatalog} from '../public/kitchen-workshop-factory.js';
import {reconcileWorkshopCatalogs,approveWorkshopCatalogRecord,catalogRecordStates} from '../public/kitchen-catalog-records.js';
import {approvalState,releaseConcerns} from '../public/kitchen-workshop-state.js';
import {recordCustomerVersion} from '../public/kitchen-design-versions.js';
import {cleanIdea} from '../public/kitchen-ideas.js';

export const productionFixtureProjectId='K-70726F6475637431';
export async function makeProductionReadyFixture({structureApproved=true,customerApproved=true,projectId=productionFixtureProjectId}={}){
 assert(!customerApproved||structureApproved,'a customer-approved fixture requires structure approval');
 let doc=await makeQuoteReadyFixture({structureApproved:false,projectId});
 doc.room.name='اختبار مراجعة التصنيع — تشغيل مشترك وإفراج الورشة';
 const before=doc.room.workshop,catalog=structuredClone(getFactoryCatalog(doc));
 catalog.machining={strict:false,machines:[{
  id:'CNC-1',name:'ماكينة اختبار CNC-1',datum:'QA fixture A — panel start corner',skus:['BODY-6'],ops:['drill'],
  maxLength:1800,maxWidth:900,maxThickness:8,minTolerance:.2,clampMargin:12,maxAngle:90,minBendRadius:45,setupMin:15,dailyMin:450
 }]};
 const line=catalog.families.storage.recipe.find(part=>part.sku==='BODY-6');assert(line);
 line.operations=[{kind:'drill',machine:'CNC-1',reference:'QA-CNC-DRILL-01',tolerance:.3,
  xFrom:'start',yFrom:'start',x:40,y:35,diameter:7,depth:5,length:0,width:0,angle:0,radius:0,minutes:2}];
 const clean=cleanCatalog(catalog);assert(clean,'synthetic machining definition passes the real catalog validator');
 const changed=reconcileWorkshopCatalogs({...before,catalog:clean},before);assert(changed);
 const approved=approveWorkshopCatalogRecord(changed,'factory');assert(approved);doc.room.workshop=approved;
 doc=cleanIdea(JSON.parse(JSON.stringify(doc)));assert(doc,'machining fixture survives the normal project validator');
 delete doc.room.workshop.approvals;delete doc.room.workshop.versions;
 if(structureApproved){const state=await approvalState(doc);doc.room.workshop.approvals={structure:{key:state.keys.structure,name:'QA synthetic structure reviewer',date:'2026-11-04T00:00:00.000Z'}};}
 if(customerApproved){const made=recordCustomerVersion({doc,state:await approvalState(doc),name:'QA synthetic customer'});assert(made.ok,made.reason);doc=made.doc;}
 const quote=buildFactoryQuote(doc),state=await approvalState(doc),records=catalogRecordStates(doc.room.workshop);
 assert(quote.ready&&quote.complete,quote.issues.concat(quote.releaseIssues).join(' / '));assert.equal(quote.total,1060);
 assert(quote.operations.length>1,'shared storage recipe produces operations on multiple real units');assert(quote.operations.every(op=>op.ok));
 assert(records.factory.approved&&records.store.approved&&records.pricing.approved);
 assert.equal(state.valid.structure,structureApproved);assert.equal(state.valid.customer,customerApproved);assert(!state.valid.release);
 if(customerApproved)assert.deepEqual(releaseConcerns(doc,state),[]);
 return doc;
}

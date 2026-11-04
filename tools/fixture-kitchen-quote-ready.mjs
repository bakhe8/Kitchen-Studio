// Entirely synthetic five-metre order, suitable for actual quote/sign UI tests.
// Survey references and factory rules below are test evidence, never a human
// measurement, commercial offer, or customer/manufacturing approval.
import assert from 'node:assert/strict';
import {makeChainExample,attestChain,readChainRange} from '../public/kitchen-chain-model.js';
import {planWorkshopRow} from '../public/kitchen-production-row.js';
import {seedCatalog,buildFactoryQuote} from '../public/kitchen-workshop-factory.js';
import {approvalState} from '../public/kitchen-workshop-state.js';
import {cleanIdea} from '../public/kitchen-ideas.js';
import {confirmFixtureFitout} from './fixture-kitchen-fitout.mjs';

export const quoteFixtureProjectId='K-71756F7465537475';
export async function makeQuoteReadyFixture({structureApproved=false,projectId=quoteFixtureProjectId}={}){
 const survey=makeChainExample(),catalog=seedCatalog();
 catalog.name='كتالوج اختبار عرض التكلفة — أسعار افتراضية';catalog.approved=true;
 for(const item of catalog.items){item.price=item.kind==='panel'?100:10;item.stockUnits=0;item.available=true;}
 Object.assign(catalog.terms,{worktop:'separate',labor:100,installation:50,delivery:20,marginPct:0,taxPct:0});
 survey.room.workshop.catalog=catalog;
 for(const wall of ['back','right']){
  const signed=attestChain(survey,wall,survey.room.workshop.chains[wall],{name:'اختبار آلي — ليس رفعًا بشريًا',reference:'QUOTE-TEST-5000'});
  assert(signed.ok,signed.reason);survey.room.workshop.chains[wall]=signed.chain;
 }
 const made=planWorkshopRow(survey,{...readChainRange(survey,'back'),tier:'base',wanted:{sink:true,rice:false,dishwasher:false}});
 assert(made.ok,made.reason);
 let doc=cleanIdea(JSON.parse(JSON.stringify(made.doc)));assert(doc);
 confirmFixtureFitout(doc);
 doc.room.name='اختبار عرض التكلفة — رحلة الحفظ وموافقة العميل';doc.room.projectId=projectId;
 doc=cleanIdea(JSON.parse(JSON.stringify(doc)));assert(doc,'fixture survives the normal project validator');
 delete doc.room.workshop.approvals;delete doc.room.workshop.versions;
 const quote=buildFactoryQuote(doc);assert(quote.complete&&quote.ready);assert.equal(quote.total,1060);assert(!quote.fitoutPending?.length);
 const state=await approvalState(doc);assert.equal(state.designReview,null);
 if(structureApproved)doc.room.workshop.approvals={structure:{key:state.keys.structure,name:'QA structure fixture',date:'2026-11-04T00:00:00.000Z'}};
 assert(!(await approvalState(doc)).valid.customer);
 return doc;
}

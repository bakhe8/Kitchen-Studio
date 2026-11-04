import {confirmFixtureFitout} from './fixture-kitchen-fitout.mjs';
// Golden workshop ticket. All stock rates/recipes here are a fixture.
// Widths and cutting dimensions below were worked out independently from
// the chain's clear lengths and this particular 20 mm factory system.
import assert from 'node:assert/strict';
import {makeChainExample,attestChain,readChainRange} from '../public/kitchen-chain-model.js';
import {planWorkshopRow} from '../public/kitchen-production-row.js';
import {seedCatalog} from '../public/kitchen-workshop-factory.js';
import {approvalState,releaseConcerns,batchReleaseState} from '../public/kitchen-workshop-state.js';
import {bindMeasureCheck} from '../public/kitchen-measure-fit.js';
import {cleanIdea} from '../public/kitchen-ideas.js';

const survey=makeChainExample(),catalog=seedCatalog();catalog.approved=true;
for(const item of catalog.items)item.price=item.kind==='panel'?100:10;
Object.assign(catalog.terms,{worktop:'separate',labor:100,installation:50,delivery:20,marginPct:0,taxPct:0});
survey.room.workshop.catalog=catalog;
for(const wall of ['back','right']){
 const chains=survey.room.workshop.chains;chains[wall]=attestChain(survey,wall,chains[wall],{name:'فني الاختبار',reference:'QA-5000'}).chain;
}
const range=readChainRange(survey,'back');
assert.deepEqual(range.baseSpans,[{startMm:1300,endMm:4300}]);
assert.deepEqual(range.upperSpans,[{startMm:1300,endMm:2000},{startMm:3200,endMm:4300}]);
const generated=planWorkshopRow(survey,{...range,tier:'base',wanted:{sink:true,rice:false,dishwasher:false}});assert(generated.ok,generated.reason);
let doc=cleanIdea(JSON.parse(JSON.stringify(generated.doc)));assert(doc);
confirmFixtureFitout(doc);
const units=generated.row.units;
assert.deepEqual(units.map(u=>u.widthMm),[550,550,500,500,900]);
assert.equal(units.at(-1).startMm,3400);assert.equal(units.at(-1).family,'sink');
const sign=async stage=>{const state=await approvalState(doc);doc.room.workshop.approvals={...doc.room.workshop.approvals,[stage]:{key:state.keys[stage],name:'اختبار آلي',date:'2026-10-31'}};};
await sign('structure');await sign('customer');
let state=await approvalState(doc);assert.deepEqual(releaseConcerns(doc,state),[]);
const {pieces,purchases,subtotal,total}=state.quote,uid=units[0].id;
const piecesOf=sku=>pieces.filter(p=>p.unitId===uid&&p.sku===sku).map(p=>[p.a,p.b,p.count]);
assert.deepEqual(piecesOf('AL-20'),[[860,null,4],[510,null,4],[560,null,4]]);
assert.deepEqual(piecesOf('FACE-6-W'),[[820,510,1]]);
assert.deepEqual(Object.fromEntries(purchases.map(p=>[p.sku,p.qty])),{'AL-20':7,'BODY-6':4,'FACE-6-W':2,EDGE:4,HINGE:12,PULL:6});
assert.equal(subtotal,890);assert.equal(total,1060);
const fit={id:'opening',target:uid,axis:'width',reference:'مقطع 01',toleranceMm:1,allowanceMm:2,readings:[{station:'الأمام',instrument:'laser',mm:553}]};
doc.room.workshop.measureFit={instruments:[{id:'laser',label:'الأداة',spec:'مواصفة نموذج الاختبار',fixedMm:1,perMetreMm:0}],checks:[bindMeasureCheck(doc,fit)]};
doc=cleanIdea(JSON.parse(JSON.stringify(doc)));state=await approvalState(doc);assert(state.valid.customer);
assert(releaseConcerns(doc,state).length);assert((await batchReleaseState(doc,[uid])).issues.length);
assert.deepEqual((await batchReleaseState(doc,[units[1].id])).issues,[]);
doc.room.workshop.measureFit.checks[0].readings[0].mm=554;
assert.deepEqual(releaseConcerns(doc,await approvalState(doc)),[]);await sign('release');assert((await approvalState(doc)).valid.release);
console.log('5×5, two doors/window: 3,000 mm net base, 700+1,100 mm uppers, sink at 3,400, hand-derived 510 mm rail / 820×510 face; 890 + 170 SAR fixture; uncertain 553 mm holds its body only, 554 mm clears whole issued version.');

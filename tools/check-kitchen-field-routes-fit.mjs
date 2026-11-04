import assert from 'node:assert/strict';
import {makeChainExample,readChainRange} from '../public/kitchen-chain-model.js';
import {planWorkshopRow} from '../public/kitchen-production-row.js';
import {kitchenRunPoint} from '../public/kitchen-model.js';
import {bindMeasureCheck,cleanMeasureFit,evaluateMeasureFit} from '../public/kitchen-measure-fit.js';
import {attestPipeRoute,cleanPipeRoutes,evaluatePipeRoutes} from '../public/kitchen-pipe-routes.js';

const input=makeChainExample();
const plan=planWorkshopRow(input,{...readChainRange(input,'back'),tier:'base',wanted:{sink:true,dishwasher:true,rice:true}});
assert(plan.ok,plan.reason);
const baseline=plan.doc,unit=baseline.kitchen.units.find(u=>u.kind==='sink'),other=baseline.kitchen.units.find(u=>u.kind==='dishwasher');
const unitScope={unitIds:[unit.id],walls:['back']},otherScope={unitIds:[other.id],walls:['right']};
const tool={id:'laser',label:'laser 2 mm',spec:'spec 1',fixedMm:2,perMetreMm:0};
const read=(station,mm)=>({station,instrument:'laser',mm});
function fit(check,doc=baseline,scope=unitScope){
 const copy=structuredClone(doc);
 const bound=bindMeasureCheck(baseline,check);assert(bound);
 const measureFit=cleanMeasureFit({instruments:[tool],checks:[bound]});
 assert(measureFit);
 copy.room.workshop.measureFit=measureFit;
 return evaluateMeasureFit(copy,scope);
}
const width={id:'fit-sink',axis:'width',target:unit.id,reference:'W-1',toleranceMm:2,allowanceMm:5,
 readings:[read('top',908),read('top',910),read('base',940)]};
let result=fit(width).results[0];
assert.deepEqual([result.nominalMm,result.neededMm,result.availableMin,result.availableMax,result.status],[900,907,908,910,'ok']);
assert.equal(fit({...width,readings:[read('joint',910),read('joint',920)]}).results[0].status,'hold','nonintersecting observations at the same station require a new survey');
assert.equal(fit({...width,readings:[read('A',909),read('B',920)]}).results[0].status,'ok','different stations may disagree');
assert.equal(fit({...width,readings:[read('A',905),read('B',940)]}).results[0].status,'hold');
assert.equal(fit({...width,readings:[read('A',904),read('B',940)]}).results[0].status,'short');
assert.equal(fit({...width,allowanceMm:15}).results[0].neededMm,917);
assert.equal(fit({...width,allowanceMm:15}).results[0].status,'short');
const bigger=structuredClone(baseline);
bigger.kitchen.units.find(u=>u.id===unit.id).width+=1;
assert.equal(fit(width,bigger).results[0].neededMm,917);
assert.equal(fit(width,bigger).results[0].status,'short','a change to the CAD host recomputes fit');
assert.deepEqual(fit(width,baseline,otherScope),{issues:[],results:[]});
const movedUnit=structuredClone(baseline);movedUnit.kitchen.units.find(u=>u.id===unit.id).u-=5;
assert.equal(fit(width,movedUnit).results[0].status,'hold','translating the opening requires new evidence even when the measured width is still ample');
const raised=structuredClone(baseline);raised.kitchen.runs.find(r=>r.id===unit.runId).bottom+=10;
assert.equal(fit(width,raised).results[0].status,'hold');
const closure={id:'wall-end',axis:'closure',target:'back',reference:'floor datum W1 to W2',chainInstrument:'laser',
 toleranceMm:16,allowanceMm:0,readings:[read('whole-wall',5000),read('whole-wall',5002)]};
result=fit(closure).results[0];
assert.deepEqual([result.status,result.lengthMm,result.worstMm],['ok',5000,16],'summed uncertainties apply to the independent positives and frame-outside spans, zero service markers add no physical length');
assert.equal(fit({...closure,toleranceMm:15}).results[0].status,'hold');
assert.equal(fit({...closure,readings:[read('full',5000),read('full',5010)]}).results[0].status,'hold');
assert.equal(fit({...closure,readings:[read('end-A',5000),read('end-B',5010)]}).results[0].status,'hold','both independent whole-wall measurements must describe the same length');
const changedWall=structuredClone(baseline);changedWall.room.width+=10;
assert.equal(fit(closure,changedWall).results[0].status,'hold','independent evidence from old end datum must not clear the new wall');
const noEnd=structuredClone(baseline);noEnd.room.workshop.chains.back.rows.pop();
assert.equal(fit(closure,noEnd).results[0].status,'hold');
assert.deepEqual(fit(closure,baseline,otherScope).results,[]);

const run=baseline.kitchen.runs.find(r=>r.id===unit.runId);
const point=(u,y,d)=>{const {x,z}=kitchenRunPoint(baseline.room,run,u,d);return [10*x,y,10*z];};
const drain=baseline.kitchen.features.find(f=>f.kind==='drain');
const start=point(375,650,40),mid=point(377,490,20),out=point(drain.u+drain.width/2,350,1);
const route={id:'r-1',unitId:unit.id,featureId:drain.id,kind:'gravity',source:'survey-1',manual:'spec-1',reviewer:'site engineer',pipeMm:50,minPipeMm:50,maxRunMm:5000,datumToleranceMm:2,
 minSlopePct:2,points:[start,mid,out],fittings:[null]};
const fixtures=structuredClone(baseline);
const vent={...drain,id:'V-1',kind:'vent'};fixtures.kitchen.features.push(vent);
function routed(raw,doc=fixtures){
 const site=structuredClone(doc);assert(cleanPipeRoutes([raw]));
 const attested=attestPipeRoute(site,raw);assert(attested);
 site.room.workshop.pipeRoutes=[attested];return site;
}
const gravity=routed(route);
assert.deepEqual(evaluatePipeRoutes(gravity,unitScope).issues,[]);
const uphill=routed({...route,points:[start,point(377,700,20),out]});
const adverse=evaluatePipeRoutes(uphill,unitScope);
assert.equal(adverse.results[0].segments[0].fallMm,-50);
assert(adverse.issues.some(msg=>msg.includes('المقطع 1')),'overall drop cannot conceal a locally adverse fall');
assert.deepEqual(evaluatePipeRoutes(uphill,otherScope),{issues:[],results:[]});
const duct={...route,kind:'duct',featureId:vent.id};
const missingFitting=evaluatePipeRoutes(routed(duct),unitScope);assert(missingFitting.issues.some(msg=>msg.includes('المكافئ')));
const goodDuct=evaluatePipeRoutes(routed({...duct,fittings:[650]}),unitScope);
assert.deepEqual(goodDuct.issues,[]);assert(Math.abs(goodDuct.results[0].equivalentMm-goodDuct.results[0].developedMm-650)<0.002);
const limit=goodDuct.results[0].equivalentMm-20;
assert(evaluatePipeRoutes(routed({...duct,fittings:[650],maxRunMm:limit}),unitScope).issues.some(msg=>msg.includes('20 مم')));
assert(!cleanPipeRoutes([{...duct,manual:''}]),'equivalent fitting lengths require a model reference');
const pumped={...route,kind:'pumped',points:[start,point(377,1300,20),out],maxHeadMm:600,fittings:[300]};
const lift=evaluatePipeRoutes(routed(pumped),unitScope);assert.equal(lift.results[0].peakMm,650);assert(lift.issues.some(msg=>msg.includes('الرفع')));
assert.deepEqual(evaluatePipeRoutes(routed({...pumped,maxHeadMm:650}),unitScope).issues,[]);
const shifted=structuredClone(gravity);shifted.kitchen.features.find(f=>f.id===drain.id).u+=4;
assert(evaluatePipeRoutes(shifted,unitScope).issues.some(msg=>msg.includes('تغيّر')));
assert.deepEqual(evaluatePipeRoutes(shifted,otherScope).issues,[]);
const swapped=structuredClone(gravity);swapped.room.workshop.pipeRoutes[0].unitId=other.id;
assert(evaluatePipeRoutes(swapped,otherScope).issues.some(msg=>msg.includes('تغيّر')),'an old attestation cannot be rebound to another unit');
const changedOther=structuredClone(gravity);changedOther.kitchen.units.find(u=>u.id===other.id).width-=1;
assert.deepEqual(evaluatePipeRoutes(changedOther,unitScope).issues,[]);
console.log('Measured 5 m room through real row planning: station uncertainty bands, opening/allowance edits, independent repeated frame-edge closure, local gravity fall, duct fittings/equivalent run, pump peak lift, scope and stale/rebound attestations.');

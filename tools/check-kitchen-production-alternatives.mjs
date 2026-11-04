import assert from 'node:assert/strict';
import {applyChain,attestChain,readChainRange} from '../public/kitchen-chain-model.js';
import {compareKitchenLayouts} from '../public/kitchen-production-alternatives.js';
import {createKitchen} from '../public/kitchen-model.js';
import {planWorkshopRow} from '../public/kitchen-production-row.js';
import {getFactoryCatalog} from '../public/kitchen-workshop-factory.js';
let room={width:500,length:500,height:280},d={room,kitchen:createKitchen(room,'empty')};
const layout={rows:[{id:'start',kind:'start',gapMm:1000},{id:'water',kind:'water',gapMm:1600,widthMm:40,heightMm:40,bottomMm:500,depthMm:40},{id:'drain',kind:'drain',gapMm:0,widthMm:40,heightMm:40,bottomMm:250,depthMm:40},{id:'end',kind:'stop',gapMm:1400}]};
for(const w of ['back','front']){
 const r=attestChain(d,w,layout,{name:'رفع',reference:'الموقع'});assert.ok(r.ok);d=applyChain(d,w,r.chain).doc;
}
const opts={walls:['back','front'],wanted:{sink:true,rice:true,dishwasher:true},preference:'distance'},original=JSON.stringify(d);
const choices=await compareKitchenLayouts(d,opts);assert.ok(choices.candidates.length>=2,choices.reasons.join(' | '));
assert.equal(new Set(choices.candidates.map(c=>c.key)).size,choices.candidates.length);
assert.ok(choices.candidates.every(c=>c.doc.kitchen.runs.length===2&&!c.provisional&&c.price===null&&c.cuts>0));
assert.equal(JSON.stringify(d),original);assert.ok(choices.candidates[0].serviceDistanceMm<=choices.candidates[1].serviceDistanceMm);
const old=choices.candidates[0].doc,locks=old.kitchen.units.filter(u=>u.kind==='sink'||u.kind==='dishwasher');
const next=await compareKitchenLayouts(old,opts);assert.ok(next.candidates.length);
for(const c of next.candidates)for(const u of locks){
 const item=c.doc.kitchen.units.find(x=>x.id===u.id);assert.ok(item);assert.equal(item.u,u.u);assert.equal(item.runId,u.runId);assert.equal(item.width,u.width);
}
const noUtilities={...d,kitchen:{...d.kitchen,features:[]}};assert.equal((await compareKitchenLayouts(noUtilities,opts)).candidates.length,0);
let calls=0;assert.equal((await compareKitchenLayouts(d,opts,async()=>{calls++;},()=>calls>1)).cancelled,true);
const service=structuredClone(d);service.room.workshop.serviceZones={zones:[{id:'s1',kind:'access',service:'valve',wall:'back',startMm:1000,endMm:1400,bottomMm:0,topMm:800,depthMm:700,ref:'ميداني',name:'محبس'}],mounts:{}};
const rg=readChainRange(service,'back');assert.deepEqual(rg.baseSpans,[{startMm:1400,endMm:4000}]);assert.deepEqual(rg.upperSpans,[{startMm:1000,endMm:4000}]);
const row=planWorkshopRow(service,{...rg,tier:'base'});assert.ok(row.ok,row.reason);assert.ok(row.row.units.every(u=>u.startMm>=1400));
const cat=getFactoryCatalog(d);cat.items.forEach(i=>{i.price=0;});Object.assign(cat.terms,{labor:0,installation:0,delivery:0,marginPct:0,taxPct:0});
d={...d,room:{...d.room,workshop:{...d.room.workshop,catalog:cat}}};
const priced=await compareKitchenLayouts(d,{...opts,wanted:{sink:true,dishwasher:false,rice:false},preference:'price'});assert.ok(priced.candidates.length);assert.equal(priced.candidates[0].price,0);
console.log('Multiwall trials preserve originals and pins, distinguish actual vs unknown price, try genuinely different layouts, respect source geometry and cancel stale search. Measured access zones block base only.');

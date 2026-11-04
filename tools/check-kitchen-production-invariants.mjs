import assert from 'node:assert/strict';
import {createKitchen,addFeature,kitchenGeometry,validateKitchen} from '../public/kitchen-model.js';
import {planWorkshopRow} from '../public/kitchen-production-row.js';
import {buildFactoryQuote,seedCatalog} from '../public/kitchen-workshop-factory.js';
import {cleanIdea} from '../public/kitchen-ideas.js';
let generated=0,rejected=0,changed=0;
for(const length of [1375,1600,2450,3000,4250])for(const tier of ['base','upper'])for(const mask of [0,1,2,3,5,7])for(const window of [false,true]){
 const room={width:500,length:470,height:275,colors:{}},catalog=seedCatalog();
 const doc={room,kitchen:createKitchen(room,'empty')};room.workshop={catalog};
 const x=350,win={id:'frame',kind:'window',wall:'back',u:105,width:60,bottom:120,height:85,depth:4};
 if(window){const f=addFeature(doc.kitchen,room,win);assert.ok(f.ok);doc.kitchen=f.kitchen;}
 const before=JSON.stringify(doc);
 const r=planWorkshopRow(doc,{wall:'back',startMm:x,endMm:x+length,tier,wanted:tier==='base'?{rice:!!(mask&1),dishwasher:!!(mask&2),sink:!!(mask&4)}:{rice:false,dishwasher:false,sink:false},riceMode:'bags'});
 assert.equal(JSON.stringify(doc),before,'no partial in-place mutation, even for a failed search');
 if(!r.ok){rejected++;assert.equal(r.doc,doc);assert(r.reason);continue;}
 generated++;const units=r.row.units,byId=new Map(r.doc.kitchen.units.map(u=>[u.id,u]));
 assert.equal(new Set(units.map(u=>u.id)).size,units.length);
 let last=x;for(const u of units){assert(u.startMm>=last&&u.startMm+u.widthMm<=x+length);last=u.startMm+u.widthMm;
  if(window&&tier==='upper')assert(u.startMm+u.widthMm<=1050||u.startMm>=1650);
  const family=catalog.families[tier==='upper'?'upperStorage':u.family];assert(u.widthMm>=family.minMm&&u.widthMm<=family.maxMm);assert.equal((u.widthMm-family.minMm)%family.stepMm,0);
  assert.equal(Math.round(10*byId.get(u.id).width),u.widthMm);
 }
 assert(validateKitchen(r.doc.kitchen,r.doc.room));assert.equal(kitchenGeometry(r.doc.kitchen,r.doc.room).conflicts.length,0);
 const reload=cleanIdea(JSON.parse(JSON.stringify(r.doc)));assert(reload);
 const again=planWorkshopRow(reload,{runId:r.runId});assert(again.ok,again.reason);assert.deepEqual(again.row.units,units);
 const bill=buildFactoryQuote(reload),subset=buildFactoryQuote(reload,{unitIds:[units[0].id]});
 assert(bill.total===null&&subset.total===null,'unknown price must never be zero');assert(subset.pieces.every(p=>p.unitId===units[0].id));
 for(const p of bill.pieces){assert(Number.isInteger(p.count)&&p.count>0);if(p.a!=null)assert(p.a>0);if(p.b!=null)assert(p.b>0);}
 const candidate=units.find(u=>u.family==='storage');if(!candidate)continue;
 const patch=planWorkshopRow(reload,{runId:r.runId,edits:{[candidate.id]:{widthMm:candidate.widthMm+50}}});
 if(patch.ok){changed++;assert.equal(patch.row.units.find(u=>u.id===candidate.id).widthMm,candidate.widthMm+50);}else assert.equal(patch.doc,reload);
}
assert(generated>20&&rejected>10&&changed>3);console.log('120 varying room/row/catalog scenarios:',{generated,rejected,changed},'identity, exact units, extents, physical fit, local rollback, reopen and pricing checked.');

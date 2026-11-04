import assert from 'node:assert/strict';
import {makeChainExample,readChainRange} from '../public/kitchen-chain-model.js';
import {planWorkshopRow,rowModelIssues} from '../public/kitchen-production-row.js';
import {seedCatalog,cleanCatalog,buildFactoryQuote} from '../public/kitchen-workshop-factory.js';
import {cleanIdea} from '../public/kitchen-ideas.js';
import {kitchenGeometry,validateKitchen} from '../public/kitchen-model.js';
const flow=makeChainExample(),cat=seedCatalog();
function variant(id,base,kind,extra){
 cat.families[id]={...structuredClone(cat.families[base]),label:id,base,cadKind:kind,reference:'Factory recipe R1',...extra};
}
variant('custom-drawer','storage','drawers',{minMm:400,maxMm:950,stepMm:50});
variant('custom-fridge','storage','fridge',{minMm:650,maxMm:950,stepMm:50,customerBay:true,recipe:[],minHeightMm:1700,maxHeightMm:2200,heightStepMm:10,minDepthMm:500,maxDepthMm:800,depthStepMm:10});
variant('custom-filler','storage','open-shelf',{minMm:300,maxMm:800,stepMm:50});
variant('custom-slim-washer','dishwasher','dishwasher',{minMm:450,maxMm:450,stepMm:1,customerBay:true,recipe:[]});
assert(cleanCatalog(cat));flow.room.workshop.catalog=cat;
const route={...readChainRange(flow,'back'),tier:'base',wanted:{rice:false,sink:false,dishwasher:false}};
const number=(doc,u)=>doc.kitchen.units.find(n=>n.id===u.id);
const plan=(doc,query)=>{const x=planWorkshopRow(doc,query);assert(x.ok,x.reason);return x;};
// Use right wall for a tall unit; no window there. Pantry door excludes first 1400 mm.
const req={wall:'right',tier:'base',startMm:1500,endMm:4500,fillerRecipeId:'custom-filler',additions:[
 {recipeId:'custom-fridge',modelSpec:{model:'F735',manual:'F735 §3',widthMm:750,heightMm:1880,depthMm:730}},
 {recipeId:'custom-drawer',widthMm:650,drawerCount:5,use:'قدور'}
]};
const created=plan(flow,req),doc=created.doc,cs=created.row.units;
const fridge=cs.find(v=>v.recipeId==='custom-fridge'),drawers=cs.find(v=>v.recipeId==='custom-drawer');
assert(fridge&&drawers&&cs.filter(v=>v.recipeId==='custom-filler').length>0);
const geo=kitchenGeometry(doc.kitchen,doc.room),g=geo.units.find(u=>u.id===fridge.id);
assert.deepEqual([g.kind,g.width,g.height,g.depth],['fridge',75,188,73]);
assert.equal(number(doc,drawers).drawerCount,5);assert(validateKitchen(doc.kitchen,doc.room));
const bill=buildFactoryQuote(doc);assert.ok(bill.customerBays.includes(fridge.id));assert.equal(bill.pieces.some(p=>p.unitId===fridge.id),false);
assert(rowModelIssues(doc).some(m=>m.includes(fridge.id)));
const reload=cleanIdea(doc);assert(reload);const retried=plan(reload,{runId:created.runId});
assert.deepEqual(retried.row,created.row);
const uses=['توابل','شاي','مناشف','قدور','صحون'];
const edited=plan(reload,{runId:created.runId,edits:{[drawers.id]:{drawerUses:uses,locks:{usage:false}}}});
assert.deepEqual(edited.row.units.find(x=>x.id===drawers.id).drawerUses,uses);
const bad=planWorkshopRow(edited.doc,{runId:created.runId,edits:{[drawers.id]:{drawerCount:4}}});assert.equal(bad.ok,false);assert.equal(bad.doc,edited.doc);
const unsuitable=planWorkshopRow(flow,{...req,additions:[{...req.additions[0],modelSpec:{...req.additions[0].modelSpec,heightMm:1881}}]});assert(!unsuitable.ok);assert.equal(unsuitable.doc,flow);
const dishwasher=plan(flow,{...route,additions:[{recipeId:'custom-slim-washer',widthMm:450}]});assert.equal(dishwasher.row.units.find(i=>i.recipeId==='custom-slim-washer').widthMm,450);
const throughUI=plan(flow,{...route,wanted:{...route.wanted,dishwasher:true},widths:{dishwasher:600},additions:[{recipeId:'custom-slim-washer',widthMm:450}]});assert.equal(throughUI.row.units.filter(i=>i.family==='dishwasher').length,1);
assert.equal(plan(throughUI.doc,{runId:throughUI.runId,wanted:{dishwasher:true},widths:{dishwasher:600}}).row.units.find(i=>i.family==='dishwasher').widthMm,450);
const first=created.row.units.filter(x=>x.recipeId==='custom-filler')[0];
const unknown=planWorkshopRow(doc,{runId:created.runId,edits:{[first.id]:{recipeId:'custom-not-in-catalog'}}});assert(!unknown.ok&&unknown.doc===doc);
console.log('Published variants from real row through CAD, same-recipe reopen/ID stability, programmable drawer count/uses, physical W/D/H fridge from manual, 450mm dishwasher, forbidden height step, zero charged customer appliance, pending on-site fit.');

import assert from 'node:assert/strict';
import {makeVisitExample} from './fixture-kitchen-visit-example.mjs';
import {proposeWholeKitchen} from '../public/kitchen-whole-plan.js';
import {previewKitchenWidthChange} from '../public/kitchen-proposal-change.js';
import {readChainRange,newChainRow,applyChain} from '../public/kitchen-chain-model.js';
import {readWallOptions,applyWallOptions} from '../public/kitchen-chain-options.js';
import {updateDecisionReview} from '../public/kitchen-project-decisions.js';
import {applyWorkshopCorner} from '../public/kitchen-production-row.js';
import {saveApplianceRequest,applianceIntakeStatus} from '../public/kitchen-appliance-intake.js';
import {evaluateApplianceFit} from '../public/kitchen-appliance-fit.js';
import {pantryRequests} from '../public/kitchen-pantry-brief.js';
import {buildFactoryQuote} from '../public/kitchen-workshop-factory.js';
import {kitchenGeometry} from '../public/kitchen-model.js';
import {approvalState,releaseConcerns} from '../public/kitchen-workshop-state.js';
import {cleanIdea} from '../public/kitchen-ideas.js';

function ok(r){assert(r.ok,r.reason||JSON.stringify(r.questions));return r;}
function reopen(d){const next=cleanIdea(JSON.parse(JSON.stringify(d)));assert(next);return next;}
function base(d,wall){
 const runs=d.kitchen.runs.filter(r=>r.tier==='base'&&r.wall===wall);
 return runs.flatMap(r=>d.room.workshop.rows?.[r.id]?.units||[]).sort((a,b)=>a.startMm-b.startMm);
}
const dimensions=u=>[u.startMm,u.widthMm];
function uppers(d,wall){
 return d.kitchen.runs.filter(r=>r.wall===wall&&r.tier==='upper')
   .map(r=>[r.start*10,r.end*10,r.bottom*10,r.height*10,r.depth*10]).sort((a,b)=>a[0]-b[0]);
}
const purchaseQty=q=>Object.fromEntries(q.purchases.map(p=>[p.sku,p.qty]));
const cuts=(q,id,sku,label)=>q.pieces.filter(p=>p.unitId===id&&p.sku===sku&&p.label===label).map(p=>[p.a,p.b,p.count]);
const opts={walls:['back'],wanted:{sink:true},pause:()=>Promise.resolve()};
const fixture=makeVisitExample(),original=JSON.stringify(fixture);
assert.deepEqual(fixture.kitchen.units,[]);
assert.equal(fixture.room.width*10,5000);assert.equal(fixture.room.length*10,5000);
assert.equal(fixture.kitchen.features.filter(f=>f.kind==='door').length,2);assert.equal(fixture.kitchen.features.filter(f=>f.kind==='window').length,1);
const back=readChainRange(fixture,'back');
assert.deepEqual(back.baseSpans,[{startMm:1300,endMm:4300}]);
assert.deepEqual(back.upperSpans,[{startMm:1300,endMm:2000},{startMm:3200,endMm:4300}]);
const next=ok(await proposeWholeKitchen(fixture)); // use the same saved wall/requests as the rep
assert.equal(JSON.stringify(fixture),original,'no geometry or approval changes before selecting a proposal');
assert(next.candidates.length>=2);
assert(next.candidates.every(c=>Number.isFinite(c.total)&&c.provisional));
assert.equal(new Set(next.candidates.map(v=>v.key)).size,next.candidates.length);
const priced=next.candidates[0],d=reopen(priced.doc),ws=d.room.workshop,units=base(d,'back');
assert(d.kitchen.runs.every(r=>r.wall==='back'),'pantry door on measured right wall is not consent for cabinets on that wall');
assert.deepEqual(units.map(u=>[u.family,...dimensions(u)]),[
 ['rice',1300,600],['storage',1900,900],['dishwasher',2800,600],['sink',3400,900]]);
assert.deepEqual(uppers(d,'back'),[[1300,2000,1450,700,350],[3200,4300,1450,700,350]]);
assert.deepEqual(d.kitchen.features,fixture.kitchen.features);
assert.equal(kitchenGeometry(d.kitchen,d.room).conflicts.filter(c=>c.hard).length,0);
const [rice,storage,washer,sink]=units;
const req=ws.applianceIntake[0];assert(applianceIntakeStatus(d,req).ok);
assert.equal(req.host,washer.id);assert.equal(req.body.width,598);assert.equal(req.space.width,600);
assert.deepEqual(pantryRequests(d).map(v=>[v.mode,v.amountKg,v.packageKg]),[['bags',20,5]]);
assert.equal(ws.applianceFit.devices.length,1);
assert(evaluateApplianceFit(d).issues.length);
assert.deepEqual(ws.approvals||{},{});assert(!ws.chains.back.attestation);assert(!ws.applianceFit.devices[0].proof);
const state=await approvalState(d);
assert(!state.valid.release);assert(releaseConcerns(d,state).length>0);
const q=buildFactoryQuote(d);assert(q.customerBays.includes(washer.id));assert(!q.pieces.some(p=>p.unitId===washer.id||p.sku==='RICE-BIN'));
assert.deepEqual(cuts(q,rice.id,'FACE-6-W','حشوة واجهة'),[[246.667,560,3]]);
assert.deepEqual(cuts(q,storage.id,'AL-20','عارضة جسم'),[[860,null,4]]);
assert.deepEqual(purchaseQty(q),{'AL-20':8,'BODY-6':3,'FACE-6-W':2,EDGE:6,'UP-HANGER':3,HINGE:16,PULL:11,SLIDE:3});
assert.equal(q.subtotal,970);assert.equal(q.total,1140);assert.equal(priced.quote.total,1140);
const beforeChange=JSON.stringify(d),change=ok(previewKitchenWidthChange(d,rice.id,100));assert.equal(JSON.stringify(d),beforeChange);
const after=reopen(change.doc),changed=base(after,'back'),afterQuote=buildFactoryQuote(after);
assert.deepEqual(changed.map(u=>[u.id,...dimensions(u)]),[[rice.id,1300,700],[storage.id,2000,800],[washer.id,2800,600],[sink.id,3400,900]]);
const upperUnits=doc=>doc.kitchen.units.filter(u=>doc.kitchen.runs.find(r=>r.id===u.runId)?.tier==='upper');
assert.deepEqual(upperUnits(after),upperUnits(d));assert.deepEqual(uppers(after,'back'),uppers(d,'back'));
assert.deepEqual(after.room.workshop.applianceFit,d.room.workshop.applianceFit);assert.deepEqual(after.room.fieldRegister,d.room.fieldRegister);
assert.deepEqual(change.donors.map(v=>[v.unitId,v.amountMm]),[[storage.id,100]]);
assert.deepEqual(cuts(afterQuote,rice.id,'FACE-6-W','حشوة واجهة'),[[246.667,660,3]]);
assert.deepEqual(cuts(afterQuote,storage.id,'AL-20','عارضة جسم'),[[760,null,4]]);
assert.deepEqual(purchaseQty(afterQuote),purchaseQty(q));
assert.deepEqual([change.price.beforeSar,change.price.afterSar,change.price.deltaSar],[1140,1140,0]);
const proposedAgain=ok(await proposeWholeKitchen(after,opts));
for(const c of proposedAgain.candidates){
 const fresh=base(c.doc,'back');assert.equal(fresh.find(v=>v.id===rice.id)?.widthMm,700);
 assert.equal(fresh.filter(v=>v.family==='rice').length,1);assert.equal(fresh.filter(v=>v.family==='dishwasher').length,1);
 assert.equal(fresh.find(v=>v.id===washer.id)?.startMm,2800);assert.equal(fresh.find(v=>v.id===sink.id)?.startMm,3400);
}
const locked=structuredClone(d);base(locked,'back').find(v=>v.id===storage.id).locks.width=true;
const lockedBefore=JSON.stringify(locked),denied=previewKitchenWidthChange(locked,rice.id,100);assert(!denied.ok);
assert.equal(denied.doc,locked);assert.equal(JSON.stringify(locked),lockedBefore);
const personallyLocked=structuredClone(d),lockedTarget=base(personallyLocked,'back').find(v=>v.id===rice.id);lockedTarget.locks.width=true;
const explicit=ok(previewKitchenWidthChange(personallyLocked,rice.id,100,{explicitUserChange:true,inputKind:'number'}));
assert.equal(base(explicit.doc,'back').find(v=>v.id===rice.id).locks.width,true,'an explicit edit updates the personal value while retaining its width lock');
assert.equal(base(explicit.doc,'back').find(v=>v.id===storage.id).widthMm,800,'the same donor policy applies to a personally locked target');
const unpriced=structuredClone(d);unpriced.room.workshop.storeCatalog.items.find(i=>i.sku==='AL-20').price=null;
const estimate=ok(previewKitchenWidthChange(unpriced,rice.id,100));assert.equal(estimate.price.deltaSar,null);

// An additional surveyed wall includes the pantry door; reserve a real front/right
// corner there before trying the fridge and the other required functions together.
let two=makeVisitExample();
// The owner requests cabinets after the pantry door. The 600 mm wall
// in front of its near jamb belongs to the entrance, not this row.
const rightChain=structuredClone(two.room.workshop.chains.right);
rightChain.rows.splice(1,0,{...newChainRow('start','after-pantry'),gapMm:0},
 {...newChainRow('stop','corner-clearance'),from:'origin',gapMm:3850});
Object.assign(rightChain.rows.at(-1),{from:'origin',gapMm:5000});
two=ok(applyChain(two,'right',rightChain)).doc;
const cat=two.room.workshop.catalog;
cat.families['custom-fridge']={...structuredClone(cat.families.storage),label:'حيز الثلاجة التجريبية',base:'storage',cadKind:'fridge',
 reference:'DEMO-FR-BAY',customerBay:true,recipe:[],minMm:650,maxMm:950,stepMm:50};
for(const [sku,name] of [['CNR-KIT','طقم تجميع ركن'],['SHELF-KIT','طقم تثبيت رف']]){
 cat.items.push({...cat.items.find(i=>i.sku==='PULL'),sku,name});
}
cat.cornerRecipes={demo:{label:'ركن تجريبي',reference:'DEMO-90',tier:'base',bodySku:'BODY-6',shelfSku:'BODY-6',frontSku:'FACE-6-W',edgeSku:'EDGE',hingeSku:'HINGE',handleSku:'PULL',bodyKit:'CNR-KIT',shelfKit:'SHELF-KIT',revealMm:2,shelfSetbackMm:15,edgeBuildMm:1,maxSpanMm:1300,maxDoorWidthMm:620,maxDoorHeightMm:900,hingesPerDoor:3}};
two=ok(applyWorkshopCorner(two,'front+right',{a:'front',b:'right',tall:false,base:{aMm:1050,bMm:950,access:'a',inside:'shelves',sku:'',
 body:{depthAMm:550,depthBMm:500,bottomMm:0,heightMm:800,reference:'DEMO-CNR'},
 build:{recipe:'demo',mode:'connected',through:'a',arms:{a:{use:'القدور',shelves:[290]},b:{use:'المؤن',shelves:[360]}}}}})).doc;
const rightOptions=readWallOptions(two,'right');rightOptions.mode='none';rightOptions.decisions={upper:true};
two=ok(applyWallOptions(two,'right',rightOptions)).doc;
two=ok(updateDecisionReview(two,{active:true,walls:['back','right']})).doc;
two=ok(saveApplianceRequest(two,{id:'owner-fridge',name:'ثلاجة المالك',kind:'fridge',model:'DEMO-F740',manual:'DEMO-F1',placement:'bay',wall:'right',
 recipe:'custom-fridge',host:'',body:{width:740,height:1850,depth:680},space:{width:750,height:1900,depth:735}})).doc;
const twoBefore=JSON.stringify(two);
const multi=ok(await proposeWholeKitchen(two,{...opts,walls:['back','right']}));
assert.equal(JSON.stringify(two),twoBefore);
const chosen=reopen(multi.candidates[0].doc),lower=base(chosen,'right');
assert(lower.length);assert.deepEqual(uppers(chosen,'right'),[]);assert.deepEqual(uppers(chosen,'back'),uppers(d,'back'));
const fridge=chosen.room.workshop.applianceIntake.find(r=>r.id==='owner-fridge');assert(applianceIntakeStatus(chosen,fridge).ok);assert(lower.some(u=>u.id===fridge.host&&u.widthMm===750));
assert(chosen.kitchen.runs.every(r=>['back','right'].includes(r.wall)));
assert(lower.every(u=>u.startMm>=1400&&u.startMm+u.widthMm<=3850),'pantry outside frame 600..1400 and corner 4050..5000 stay reserved');
assert.equal(chosen.kitchen.units.filter(u=>u.kind==='sink').length,1);
assert(base(chosen,'back').some(u=>u.family==='sink'&&u.startMm<=3800&&u.startMm+u.widthMm>=3800));
assert.deepEqual(chosen.room.workshop.corners,two.room.workshop.corners);
const cornerId='corner:front+right:base',cornerQuote=buildFactoryQuote(chosen);
assert(cornerQuote.pieces.some(p=>p.unitId===cornerId&&p.sku==='CNR-KIT'&&p.count===1));assert(cornerQuote.customerBays.includes(fridge.host));
assert.equal(kitchenGeometry(chosen.kitchen,chosen.room).conflicts.filter(c=>c.hard).length,0);
// Each 750 mm bay fits individually; four cannot simultaneously occupy
// the only 2450 mm contiguous interval on the customer's selected right wall.
let crowded=structuredClone(two);
const fridgeInput=crowded.room.workshop.applianceIntake.find(r=>r.id==='owner-fridge');
for(let i=2;i<=4;i++)crowded=ok(saveApplianceRequest(crowded,{...fridgeInput,id:'fridge-'+i,name:'ثلاجة '+i})).doc;
const crowdedBefore=JSON.stringify(crowded),refused=await proposeWholeKitchen(crowded,{...opts,walls:['back','right']});
assert(!refused.ok);assert.equal(JSON.stringify(crowded),crowdedBefore);assert.equal(refused.doc,crowded);
console.log('5×5 from empty CAD to lower+upper rows: rice 600, storage 900, owned DW 600, plumbed sink 900; two framed doors, 700+1100 upper. Rice +100 => storage −100; face blank 560→660, storage rail 860→760, purchase ticket stays 1140 example SAR. Two-wall selected fridge, retained corner; four incompatible bays leave project untouched.');

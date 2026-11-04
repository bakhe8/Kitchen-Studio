import assert from 'node:assert/strict';
import {createKitchen,kitchenGeometry} from '../public/kitchen-model.js';
import {applyChain,attestChain,makeChainExample,surveyedDesignWalls} from '../public/kitchen-chain-model.js';
import {compareKitchenLayouts} from '../public/kitchen-production-alternatives.js';
import {buildUpperRows} from '../public/kitchen-chain-options.js';
import {seedCatalog,buildFactoryQuote} from '../public/kitchen-workshop-factory.js';
import {saveApplianceRequest,planIntakeReservations} from '../public/kitchen-appliance-intake.js';
import {proposeWholeKitchen,reviewWholeProposal} from '../public/kitchen-whole-plan.js';
import {cleanIdea} from '../public/kitchen-ideas.js';

const room={width:500,length:500,height:280};let d={room,kitchen:createKitchen(room,'empty')};
for(const [wall,gap,last] of [['back',600,900],['front',600,2400]]){
 const rows=[{kind:'start',id:'a',gapMm:1000},...(wall==='back'?[
  {kind:'water',id:'water',gapMm:gap,widthMm:40,depthMm:40,heightMm:40,bottomMm:500},{kind:'drain',id:'drain',gapMm:0,widthMm:40,depthMm:40,heightMm:40,bottomMm:250}]:[{kind:'stop',id:'stop',gapMm:gap+last}]),
 ...(wall==='back'?[{kind:'stop',id:'stop',gapMm:last}]:[])];
 const measured=attestChain(d,wall,{rows},{name:'Fixture',reference:'measured 5×5'});assert(measured.ok);d=applyChain(d,wall,measured.chain).doc;
}
const cat=seedCatalog();cat.approved=true;cat.items.forEach(i=>i.price=i.kind==='piece'?5:10);Object.assign(cat.terms,{labor:0,installation:0,delivery:0,marginPct:0,taxPct:0,worktop:'separate'});
cat.families['custom-fridge']={...cat.families.storage,base:'storage',label:'حيز',cadKind:'fridge',customerBay:true,reference:'test',recipe:[],minMm:700,maxMm:1000,stepMm:50};
d.room.workshop.catalog=cat;
const req={id:'cold',name:'الثلاجة',kind:'fridge',model:'TEST-1',manual:'test data sheet',placement:'bay',wall:'',host:'',recipe:'custom-fridge',body:{width:850,height:1800,depth:650},space:{width:900,height:1900,depth:700}};
d=saveApplianceRequest(d,req).doc;const walls=['back','front'],original=JSON.stringify(d);
const legacy=await planIntakeReservations(d,{ids:['cold'],walls});assert(legacy.ok);assert.equal(legacy.placed[0].wall,'back','first device reservation alone fits on the wet wall');
const whole=await proposeWholeKitchen(d,{walls,wanted:{sink:true}});assert(whole.ok,whole.reason);
for(const c of whole.candidates){
 const fridge=c.placements.find(v=>v.id==='cold');assert.equal(fridge.wall,'front');
 const sink=c.doc.kitchen.units.find(u=>u.kind==='sink');assert.equal(c.doc.kitchen.runs.find(r=>r.id===sink.runId).wall,'back');
 const actual=kitchenGeometry(c.doc.kitchen,c.doc.room);assert(!actual.conflicts.length);
 const u=actual.units.find(v=>v.id===fridge.host);assert(actual.runs.filter(r=>r.wall==='front'&&r.tier==='upper').every(r=>r.end<=u.u||r.start>=u.u+u.width));
 assert.equal(c.total,buildFactoryQuote(c.doc).total);assert(c.total>0);
 assert.equal(c.doc.room.workshop.applianceFit.devices.find(d=>d.host===u.id).siteRef,'','no field verification was invented');
 assert(cleanIdea(c.doc));assert.deepEqual(c.questions,reviewWholeProposal(c.doc,walls));
}
assert.equal(JSON.stringify(d),original);const limited=await proposeWholeKitchen(d,{walls,limit:1,wanted:{sink:true}});assert(!limited.ok&&limited.truncated&&limited.doc===d);
let cancel=false;const stopped=await proposeWholeKitchen(d,{walls,pause:async()=>{cancel=true;},cancel:()=>cancel});assert(stopped.cancelled&&stopped.doc===d&&!stopped.candidates.length);
const budget=structuredClone(d);budget.room.workshop.layoutBrief={mode:'fixed',capSar:0,extraSar:0,scope:'all',weights:{contract:5},reference:'test strict cap'};
const denied=await proposeWholeKitchen(budget,{walls});assert(!denied.ok&&denied.doc===budget);assert(denied.questions.some(q=>q.step==='quote'));
const doors=makeChainExample(),clear=await proposeWholeKitchen(doors,{walls:['back','right'],wanted:{sink:true,rice:true,dishwasher:true},riceMode:'bags'});
assert(clear.ok,clear.reason);const safe=clear.candidates.find(x=>x.clearances.length);
assert(safe);for(const gap of safe.clearances){const run=safe.doc.kitchen.runs.find(r=>r.wall===gap.wall&&r.tier==='base');assert(run.fillGaps.some(v=>v.u*10===gap.startMm&&(v.u+v.width)*10===gap.endMm));}
console.log('Bounded joint search recovers from individually feasible but globally obstructive fridge reservation, carves upper around tall body, full price and budget, persistence, cancellation and explicated empty storage frontage.');

const emptyVisit={room,kitchen:createKitchen(room,'empty')};
const partialRows=[{kind:'window',id:'first-window',gapMm:1000,widthMm:600,heightMm:800,bottomMm:1000,depthMm:60}];
const partial=applyChain(emptyVisit,'back',{rows:partialRows}).doc;
assert.deepEqual(surveyedDesignWalls(partial),[]);
const earlyAlternatives=await compareKitchenLayouts(partial,{walls:['back'],wanted:{}});
assert(!earlyAlternatives.candidates.length&&!earlyAlternatives.tried);assert.match(earlyAlternatives.reasons[0],/رفع/);
assert(!buildUpperRows(partial,'back').ok,'the wall-options shortcut cannot fill the top row before the measured endpoint');
const tooEarly=await proposeWholeKitchen(partial,{walls:['back']});
assert(!tooEarly.ok&&!tooEarly.tried&&tooEarly.doc===partial);assert.equal(tooEarly.questions[0].step,'survey');assert.equal(tooEarly.questions[0].focus.wall,'back');
const complete=applyChain(partial,'back',{rows:[...partialRows,{kind:'stop',id:'end',from:'origin',gapMm:3400}]}).doc;
assert.deepEqual(surveyedDesignWalls(complete),['back']);
const later=await proposeWholeKitchen(complete,{wanted:{sink:false},limit:6});
assert(later.ok,later.reason);
assert(later.candidates.every(c=>c.doc.kitchen.runs.every(r=>r.wall==='back'&&r.end<=340)));
assert(!partial.kitchen.runs.length&&!complete.kitchen.runs.length,'the wall measurement and proposal alone never install cabinets');
console.log('A partial window survey cannot generate a layout. Saving the cabinet endpoint unlocks only its wall; the proposal remains a preview.');

import assert from 'node:assert/strict';
import {makeWallInkProposal,confirmWallInk} from '../public/kitchen-wall-ink-model.js';
import {newChainRow,resolveChain,applyChain,makeChainExample,attestChain,siteReleaseIssues} from '../public/kitchen-chain-model.js';
import {createKitchen,addRun,addUnit} from '../public/kitchen-model.js';

const room={width:500,length:420,height:280},wall='back',empty={source:'drawing',rows:[]};
const p=(xMm,zMm)=>({xMm,zMm});
function propose(chain,kind,gesture={},ctx={room,wall}){
 const result=makeWallInkProposal({...ctx,chain,kind,...gesture});assert(result.ok,result.reason);return result;
}
function accept(chain,proposal,values={},ctx={room,wall}){
 const result=confirmWallInk({...ctx,chain,proposal,values});assert(result.ok,result.reason);return result;
}
const model=structuredClone(empty),door=propose(empty,'door',{start:p(1296,57),end:p(404,2047),dragged:true});
assert.deepEqual([door.row.gapMm,door.row.widthMm,door.row.bottomMm,door.row.heightMm],[400,900,0,2050]);
assert.deepEqual(empty,model); // A drag has no persistent or draft effect yet.
const one=accept(empty,door).chain;
const window=propose(one,'window',{start:p(1996,1001),end:p(3202,2001),tap:false});
assert.deepEqual([window.row.gapMm,window.row.widthMm,window.row.bottomMm,window.row.heightMm],[700,1200,1000,1000]);
assert.equal(window.referenceKind,'door');assert.equal(window.datumMm,1300);
const exact=accept(one,window,{widthMm:'١٬١٩٥'}),two=exact.chain;
assert.equal(exact.feature.width,119.5);assert.equal(exact.readings.at(-1).nextMm,3195);
const tap=propose(two,'water',{start:p(3401,497),tap:true});
assert.deepEqual([tap.row.gapMm,tap.row.bottomMm,tap.referenceKind],[205,500,'window']);
const water=accept(two,tap),three=water.chain;
assert.equal(water.feature.u*10+water.feature.width*5,3400);assert.equal(water.feature.bottom*10+water.feature.height*5,500);
const repeat=propose(three,'window',{start:p(3501,510),tap:true});
assert.equal(repeat.preset,'repeat');assert.equal(repeat.row.widthMm,1195);assert.equal(repeat.row.heightMm,1000);
assert.deepEqual(repeat.inferredFields,['widthMm','heightMm']);
const line=propose(one,'window',{start:p(2100,900),end:p(3200,905),dragged:true});
assert.equal(line.row.heightMm,newChainRow('window','a').heightMm);assert.equal(line.row.widthMm,1100);
assert.equal(propose(three,'window',{typed:true}).row.gapMm,null);
assert.equal(propose(three,'window',{typed:true}).row.widthMm,null);
assert.equal(confirmWallInk({room,wall,chain:one,proposal:window,values:{gapMm:'-30'}}).ok,false);
assert.equal(confirmWallInk({room,wall,chain:one,proposal:window,values:{widthMm:'--'}}).ok,false);
assert.equal(confirmWallInk({room,wall,chain:two,proposal:window}).ok,false,'stale draft');
assert.equal(confirmWallInk({room:{...room,height:290},wall,chain:one,proposal:window}).ok,false,'stale wall');
assert.equal(makeWallInkProposal({room,wall,chain:empty,kind:'door',start:p(-1,0),end:p(500,2000),dragged:true}).ok,false);
const measure=propose(three,'corner',{start:p(5000,0),tap:true});assert.equal(measure.row.gapMm,null);
assert.equal(confirmWallInk({room,wall,chain:three,proposal:measure}).ok,false);
assert.equal(confirmWallInk({room,wall,chain:three,proposal:measure,values:{gapMm:1610}}).ok,false);
const closed=accept(three,measure,{gapMm:1600}).chain;
const before=resolveChain(room,wall,closed);
const follow=propose(closed,'electric',{start:p(2411,2300),tap:true});
assert.equal(follow.referenceKind,null);const extra=accept(closed,follow);
assert(extra.geometry.closed);assert(!('attestation' in extra.chain));
for(const r of before.readings)assert.deepEqual(extra.readings.find(v=>v.id===r.id),r);
for(const f of before.features)assert.deepEqual(extra.geometry.features.find(v=>v.id===f.id),f);
assert.deepEqual(extra.chain.rows.at(-1),closed.rows.at(-1));assert.equal(closed.rows[0].from,undefined);
assert(extra.row.id!==closed.rows[0].id);
const clippedRoom={...room,architecture:{cut:{kind:'notch',corner:'back-left',width:80,depth:70}}};
const k=propose(empty,'water',{start:p(100,700),tap:true},{room:clippedRoom,wall});
assert.equal(accept(empty,k,{}, {room:clippedRoom,wall}).feature.u,87); // 800 mm wall offset + 100 mm station - 30 mm outlet radius.
const attestedDoc=makeChainExample(),c=attestedDoc.room.workshop.chains.back;
const proof=attestChain(attestedDoc,'back',c,{name:'مختبر',reference:'قياس'});assert(proof.ok);
const ad=applyChain(attestedDoc,'back',proof.chain).doc;
const changed=accept(proof.chain,propose(proof.chain,'electric',{start:p(2200,2230),tap:true},{room:ad.room,wall}),{}, {room:ad.room,wall});
const resultDoc=applyChain(ad,wall,changed.chain);assert(resultDoc.ok,resultDoc.reason);
assert(siteReleaseIssues(resultDoc.doc,{walls:['back']}).some(s=>s.includes('تأكيد الفني')));
let kitchen=createKitchen(room,'empty');kitchen=addRun(kitchen,room,{id:'line',wall,tier:'base',start:0,end:100}).kitchen;
kitchen=addUnit(kitchen,room,{id:'fixed',runId:'line',kind:'storage',u:0,width:90}).kitchen;
assert.equal(confirmWallInk({room,wall,chain:empty,proposal:door,doc:{room,kitchen}}).ok,true,'a field reading may reveal a conflict in the cabinet design');
console.log('Wall ink: pure reversible drafts, bidirectional strokes, exact Arabic field correction, centre datums, tap repeats, independent physical closure, immutable existing readings, stale proof, clipped walls, CAD collision.');

const {stageWallInkBatch}=await import('../public/kitchen-wall-ink-model.js');
const batchItems=[{proposal:door},{proposal:window,values:{widthMm:'١٬١٩٥'}},{proposal:tap}];
let writes=0;
function submit(strokes,overrides={}){
 const result=stageWallInkBatch({room,wall,chain:empty,items:strokes,...overrides});
 if(result.ok)writes++;
 return result;
}
const all=submit(batchItems,{doc:{room,kitchen:createKitchen(room,'empty')}});
assert(all.ok,all.reason);
assert.equal(writes,1);
assert.deepEqual(all.chain,three);assert.equal(all.items.length,3);
assert.deepEqual(all.readings.map(r=>[r.refMm,r.nextMm]),[[400,1300],[2000,3195],[3400,3400]]);
assert.deepEqual(empty,model);
const bad=submit([...batchItems.slice(0,2),{proposal:tap,values:{bottomMm:7000}}]);
assert.equal(bad.ok,false);assert.equal(bad.failedIndex,2);assert.equal(bad.chain,undefined);
const moved=submit([{proposal:door,values:{widthMm:950}},...batchItems.slice(1)]);
assert.equal(moved.ok,false);assert.equal(moved.failedIndex,1);assert.equal(moved.chain,undefined);
assert.equal(submit(batchItems,{room:{...room,height:275}}).ok,false);
assert.equal(submit(batchItems,{doc:{room,kitchen}}).ok,true);
assert.equal(writes,2);assert.deepEqual(empty,model);
console.log('Batch: two drafted openings and one service accepted together; height and datum errors preserve the old draft; cabinet design conflicts allow the on-site record.');

// Correcting a stamp to a more distant measured station must not leave the
// water/electric readings in the inverse order of their physical positions.
const correctedStart={source:'drawing',rows:[
 {id:'p1',kind:'door',gapMm:400,widthMm:900,bottomMm:0,heightMm:2050,depthMm:100},
 {id:'p2',kind:'window',gapMm:700,widthMm:1200,bottomMm:1000,heightMm:1000,depthMm:100},
 {id:'p3',kind:'water',from:'origin',gapMm:3500,widthMm:80,bottomMm:550,heightMm:80,depthMm:100}
]};
const sketchStation=makeWallInkProposal({room,wall,chain:correctedStart,kind:'electric',start:{xMm:2050,zMm:1400},tap:true});
assert.equal(sketchStation.independent,true);
const movedStation=confirmWallInk({room,wall,chain:correctedStart,proposal:sketchStation,values:{gapMm:3800,bottomMm:750}});
assert(movedStation.ok,movedStation.reason);
assert.deepEqual(movedStation.readings.map(x=>x.refMm),[400,2000,3500,3800]);
assert.equal(movedStation.row.from,'origin');

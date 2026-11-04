import assert from 'node:assert/strict';
import {cleanUpstandSpec,setUpstandSeamChoice,setUpstandWindowChoice,worktopUpstandTakeoff} from '../public/kitchen-worktop-upstand.js';
const stock={sku:'F',kind:'panel',name:'حجر اختبار',stockLengthMm:1150,stockWidthMm:1600,kerfMm:3,thicknessMm:20};
const cat={approved:true,items:[stock],upstandProfiles:[{id:'P',reference:'P-file',sku:'F',heightMm:100,minCutHeightMm:40}]};
const room={width:500,length:450,height:290,workshop:{upstand:{choice:{mode:'factory',profileId:'P'},walls:{}}}};
const run={id:'r',tier:'base',wall:'back',start:10,end:230,bottom:0,height:86,depth:60,worktopThicknessMm:40};
const doc={room,kitchen:{runs:[run],units:[{id:'a',runId:'r',kind:'storage',u:10,width:110},{id:'b',runId:'r',kind:'storage',u:120,width:110}],
 features:[{wall:'back',id:'w',kind:'window',u:45,width:55,height:100,bottom:96,depth:4}]}};
const t=worktopUpstandTakeoff(doc,cat),k=t.windows[0].key;
assert.deepEqual(t.seamRequests,[]);
const w=setUpstandWindowChoice(doc,cat,k,{kind:'uniform',clearanceMm:5,reference:'field',operationChecked:true});
const seam=w.take.seamRequests[0],key=seam.key;
assert.equal(seam.lengthMm,2200);assert.equal(seam.fromMm,100);assert.equal(seam.toMm,2300);assert.equal(seam.status,'pending');
assert(w.take.issues.some(i=>i.includes('وصل')));assert.equal(w.take.pieces.filter(x=>x.family==='upstand').length,0);
const joint=(stationsMm,reference='رسم وصل الورشة')=>({stationsMm,reference});
assert.equal(setUpstandSeamChoice(w.doc,cat,key,joint([1000])).ok,false); // second cut 1300
assert.equal(setUpstandSeamChoice(w.doc,cat,key,joint([1200],'')).ok,false);
assert.equal(setUpstandSeamChoice(w.doc,cat,key,joint([100,1200])).ok,false);
assert.equal(setUpstandSeamChoice(w.doc,cat,key,joint([1200,1190])).ok,false);
assert.equal(setUpstandSeamChoice(w.doc,cat,key,joint([1248])).ok,false); // exactly 2 mm remain, 3-mm saw
const sliced=setUpstandSeamChoice(w.doc,cat,key,joint([1250]));
assert(sliced.ok,sliced.reason);
assert.equal(sliced.take.windows[0].status,'resolved');assert.equal(sliced.take.seamRequests[0].status,'resolved');
assert.equal(sliced.take.segments.filter(x=>x.wall==='back').length,1,'visual strip continuous');
assert.deepEqual(sliced.take.pieces.filter(p=>p.family==='upstand').map(p=>[p.a,p.b,p.fromMm,p.toMm,p.jointReference]),[[1150,55,100,1250,'رسم وصل الورشة'],[1050,55,1250,2300,'رسم وصل الورشة']]);
assert.deepEqual(cleanUpstandSpec(JSON.parse(JSON.stringify(sliced.doc.room.workshop.upstand))),sliced.doc.room.workshop.upstand);
const price={...cat,items:[{...stock,price:600}]};assert.equal(worktopUpstandTakeoff(sliced.doc,price).seamRequests[0].status,'resolved');
const newStock={...cat,items:[{...stock,stockLengthMm:1100}]};
assert.equal(worktopUpstandTakeoff(sliced.doc,newStock).seamRequests[0].status,'stale');
assert(!worktopUpstandTakeoff(sliced.doc,newStock).pieces.some(p=>p.family==='upstand'));
const larger={...cat,items:[{...stock,stockLengthMm:3200}]};
assert.deepEqual(worktopUpstandTakeoff(sliced.doc,larger).orphanSeams,[key]);
const cleared=setUpstandSeamChoice(sliced.doc,larger,key,null);
assert(cleared.ok);assert.deepEqual(cleared.take.orphanSeams,[]);
assert.deepEqual(cleared.take.pieces.filter(p=>p.family==='upstand').map(p=>p.a),[2200]);
const unrelated={...doc,kitchen:{...doc.kitchen,features:[]}};assert.deepEqual(worktopUpstandTakeoff(unrelated,cat).seamRequests,[]);
const external={...w.doc,room:{...w.doc.room,workshop:{upstand:{choice:{mode:'supplier',heightMm:100,thicknessMm:20,material:'رخام المورّد'},walls:{}}}}};
assert.deepEqual(worktopUpstandTakeoff(external,cat).seamRequests,[]);
console.log('Window-affected continuous stone: no guessed joints, final station and kerf-safe per-cut stock, stale source and isolated legacy/supplier scopes verified.');

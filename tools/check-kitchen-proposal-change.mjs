import assert from 'node:assert/strict';
import {makeChainExample,readChainRange} from '../public/kitchen-chain-model.js';
import {planWorkshopRow} from '../public/kitchen-production-row.js';
import {buildFactoryQuote,seedCatalog} from '../public/kitchen-workshop-factory.js';
import {createKitchen,addRun,addKitchenUnitRaw} from '../public/kitchen-model.js';
import {cleanIdea} from '../public/kitchen-ideas.js';
import {approvalState} from '../public/kitchen-workshop-state.js';
import {riceSiteKey,currentRiceWarnings} from '../public/kitchen-production-row-rice.js';
import {describeProposalChange,previewKitchenWidthChange} from '../public/kitchen-proposal-change.js';

const doc=makeChainExample(),catalog=seedCatalog();catalog.approved=true;
for(const item of catalog.items)item.price=item.kind==='panel'?100:10;
Object.assign(catalog.terms,{worktop:'separate',labor:100,installation:50,delivery:20,marginPct:0,taxPct:0});
doc.room.workshop.catalog=catalog;
const result=planWorkshopRow(doc,{...readChainRange(doc,'back'),tier:'base',wanted:{sink:true,rice:true,dishwasher:true},riceMode:'bags'});
assert(result.ok,result.reason);
const src=result.doc,run=src.kitchen.runs[0],row=src.room.workshop.rows[run.id];
const [rice,donor,dw,sink]=row.units;
assert.deepEqual(row.units.map(e=>[e.family,e.startMm,e.widthMm]),[['rice',1300,600],['storage',1900,900],['dishwasher',2800,600],['sink',3400,900]]);
const current=src.kitchen.units.find(u=>u.id===rice.id);
row.riceChecks={[rice.id]:{mode:'bags',amountKg:20,packageKg:5,packagingKg:.2,drawerKg:5,
 ratingBasis:'moving',loadKg:50,sku:'SLIDE',manual:'Test spec',source:'Field ticket',layers:'one',
 pack:{w:200,d:200,h:100},inside:{w:530,d:500,h:180},signature:riceSiteKey(src,run,current,rice)}};
for(const phase of ['structure','customer','release']){const state=await approvalState(src);src.room.workshop.approvals={...src.room.workshop.approvals,[phase]:{key:state.keys[phase],name:'QA',date:'2026-10-31'}};}
const baseline=JSON.stringify(src),orig=cleanIdea(JSON.parse(baseline));assert(orig);
const change=previewKitchenWidthChange(orig,rice.id,100);assert(change.ok,change.reason);
assert.equal(JSON.stringify(src),baseline);
assert.deepEqual(change.changes.map(c=>[c.unitId,c.beforeStartMm,c.afterStartMm,c.beforeWidthMm,c.afterWidthMm]),[[rice.id,1300,1300,600,700],[donor.id,1900,2000,900,800]]);
assert.deepEqual(change.donors.map(d=>[d.unitId,d.amountMm]),[[donor.id,100]]);
assert.deepEqual(change.protectedUnits.map(p=>p.unitId),[dw.id,sink.id]);
assert.equal(change.changes[0].inside.beforeMm,530);assert.equal(change.changes[0].inside.afterMm,null);
assert.equal(change.changes[0].frontBeforeMm,600);assert.equal(change.changes[0].frontAfterMm,700);
const face=change.cutChanges.find(c=>c.unitId===rice.id&&c.sku==='FACE-6-W');assert.equal(face.before[0].b,560);assert.equal(face.after[0].b,660);
assert(currentRiceWarnings(change.doc,run,change.doc.room.workshop.rows[run.id]).some(e=>e.includes('بعد فحص الحمولة')));
assert(!(await approvalState(change.doc)).valid.structure);
assert.deepEqual(change.price,{beforeSar:840,afterSar:740,deltaSar:-100});
assert.deepEqual(describeProposalChange(orig,cleanIdea(JSON.parse(JSON.stringify(change.doc)))).price,change.price);
const reversed=previewKitchenWidthChange(change.doc,rice.id,-100);assert(reversed.ok,reversed.reason);assert.equal(reversed.price.deltaSar,100);
assert.deepEqual(reversed.doc.kitchen.units,orig.kitchen.units);
assert.deepEqual(reversed.doc.room.workshop.rows,orig.room.workshop.rows);
const zero=structuredClone(orig);zero.room.workshop.storeCatalog.items.forEach(i=>i.price=0);
assert.deepEqual(previewKitchenWidthChange(zero,rice.id,100).price,{beforeSar:170,afterSar:170,deltaSar:0});
zero.room.workshop.storeCatalog.items[0].price=null;assert.equal(previewKitchenWidthChange(zero,rice.id,100).price.deltaSar,null);
for(const step of [0,-1000,55,10.5,Infinity]){const q=previewKitchenWidthChange(orig,rice.id,step);assert(!q.ok);assert.equal(q.doc,orig);}
assert(!previewKitchenWidthChange(orig,dw.id,50).ok);assert(!previewKitchenWidthChange(orig,sink.id,50).ok);

function setup(values){
 const room={width:500,length:500,height:275},cat=structuredClone(catalog);
 let start=0;
 const cells=values.map(([name,width,flags={},gap=0])=>{
  start+=gap;const b={id:name,kind:name==='target'?'drawers':'storage',runId:'R',width:width/10,u:start/10};
  start+=width;return {b,w:{id:name,family:b.kind==='drawers'?'rice':'storage',startMm:b.u*10,widthMm:width,locks:{width:false,position:false,usage:false,finish:false,...flags},...(b.kind==='drawers'?{riceMode:'bags'}:{})}};
 });
 const begun=addRun(createKitchen(room,'empty'),room,{id:'R',tier:'base',wall:'back',start:0,end:start/10,bottom:0,depth:60,height:86});
 assert(begun.ok,begun.reason);let k=begun.kitchen;
 for(const x of cells){const out=addKitchenUnitRaw(k,room,x.b);assert(out.ok,out.reason);k=out.kitchen;}
 room.workshop={rows:{R:{catalogVersion:String(cat.layoutRevision),warnings:[],units:cells.map(p=>p.w)}},catalog:cat};
 const proj=cleanIdea({room,kitchen:k});assert(proj);assert(buildFactoryQuote(proj).complete);return proj;
}
const both=setup([['left',250,{position:true}],['target',600],['right',250]]);
const split=previewKitchenWidthChange(both,'target',100);assert(split.ok,split.reason);
assert.deepEqual(split.donors.map(d=>[d.unitId,d.amountMm]),[['left',50],['right',50]]);
assert.equal(split.changes.find(c=>c.unitId==='left').deltaStartMm,0);
const relay=setup([['target',600],['keep-width',500,{width:true}],['near',450],['far',800]]);
const take=previewKitchenWidthChange(relay,'target',100);assert(take.ok,take.reason);
assert.deepEqual(take.donors.map(d=>d.unitId),['near']);assert.equal(take.changes.find(c=>c.unitId==='keep-width').deltaWidthMm,0);
assert(!take.changes.some(c=>c.unitId==='far'));
const gap=setup([['target',600],['across',900,{},50]]);
const impossible=previewKitchenWidthChange(gap,'target',100);assert(!impossible.ok);assert.equal(impossible.doc,gap);assert.match(impossible.reason,/100.*مم/);
const locked=setup([['target',600],['pinned',600,{position:true}],['far',600]]);assert(!previewKitchenWidthChange(locked,'target',100).ok);
const custom=setup([['target',600],['inside',600]]);custom.room.workshop.rows.R.units[1].use='قدور طويلة';
assert(!previewKitchenWidthChange(custom,'target',100).ok);custom.room.workshop.rows.R.units[0].locks.width=true;
assert.match(previewKitchenWidthChange(custom,'target',100).reason,/مثبّت/);
console.log('Local proposal edits: 600→700 and 900→800; pinned sink/DW fixed, rice fronts 560→660, measured 530 not reused, approvals expire; priced −100 / +100 / 0 vs unknown, two-sided donation, locked-width relay, explicit gap, custom interior and rollback.');

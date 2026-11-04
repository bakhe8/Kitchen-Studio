import assert from 'node:assert/strict';
import {setCornerFront} from '../public/kitchen-corner-finishes.js';
import {approvalState,releaseConcerns} from '../public/kitchen-workshop-state.js';
import {applyWorkshopCorner} from '../public/kitchen-production-row.js';
import {cleanCornerBuild,cornerAssembly} from '../public/kitchen-corner-carcass.js';
import {cleanProductionCorners,cornerMotionIssues} from '../public/kitchen-production-row-corners.js';
import {attestChain,applyChain,newChainRow,siteReleaseIssues} from '../public/kitchen-chain-model.js';
import {buildFactoryQuote,cleanCatalog,seedCatalog} from '../public/kitchen-workshop-factory.js';
import {createKitchen,kitchenGeometry} from '../public/kitchen-model.js';
import {portableFactoryCatalog} from '../public/kitchen-factory-template.js';
import {manufacturingKeys,orderHandoffUnits} from '../public/kitchen-order-domain.js';
import {cleanIdea} from '../public/kitchen-ideas.js';
import {scenePlan} from '../public/kitchen-project.js';
import {getKitchenPhotoMesh} from '../public/kitchen-render.js';
const room={width:500,height:280,length:500},catalog=seedCatalog();
catalog.items.push(...[['CORNER-KIT','طقم تجميع الركن'],['SHELF-BRACKETS','طقم حوامل الرف']].map(([sku,name])=>({...catalog.items.find(i=>i.sku==='PULL'),sku,name})));
const recipe={frontSkus:['FACE-6-G'],label:'زاوية ألواح معتمدة',reference:'F90-A revision 3 fixture',tier:'base',
 bodySku:'BODY-6',frontSku:'FACE-6-W',shelfSku:'BODY-6',edgeSku:'EDGE',hingeSku:'HINGE',handleSku:'PULL',bodyKit:'CORNER-KIT',shelfKit:'SHELF-BRACKETS',
 revealMm:2,shelfSetbackMm:15,edgeBuildMm:1,maxSpanMm:1300,maxDoorWidthMm:620,maxDoorHeightMm:900,hingesPerDoor:3};
catalog.cornerRecipes={B90:recipe,U90:{...recipe,tier:'upper'},T90:{...recipe,tier:'tall',maxDoorHeightMm:2400}};
catalog.items.find(i=>i.sku==='FACE-6-G').colorHex='#72614c';catalog.approved=true;for(const i of catalog.items){i.price=i.sku==='HINGE'?15:i.sku==='FACE-6-G'?25:5;i.stockUnits=999;}
Object.assign(catalog.terms,{labor:0,installation:0,delivery:0,marginPct:0,taxPct:0});
assert(cleanCatalog(catalog));assert.deepEqual(portableFactoryCatalog(catalog).cornerRecipes,catalog.cornerRecipes);
const invalid=structuredClone(catalog);invalid.cornerRecipes.B90.bodySku='HINGE';assert.equal(cleanCatalog(invalid),null);
let doc={room:{...room,workshop:{catalog}},kitchen:createKitchen(room,'empty')};
for(const wall of ['back','left']){
 const raw={source:'field',rows:[{...newChainRow('corner','tip'),gapMm:5000}]};
 const surveyed=attestChain(doc,wall,raw,{name:'QA',reference:'survey'});assert(surveyed.ok,surveyed.reason);
 const saved=applyChain(doc,wall,surveyed.chain);assert(saved.ok,saved.reason);doc=saved.doc;
}
const body={depthAMm:550,depthBMm:500,bottomMm:0,heightMm:800,reference:'Site A'};
const build={recipe:'B90',mode:'connected',through:'a',arms:{a:{use:'لأواني العميل',shelves:[200,450]},b:{use:'للضيافة',shelves:[360]}}};
const base={aMm:1050,bMm:950,inside:'shelves',access:'a',sku:'',body,build};
const make=(base,upper=null,tall=false)=>{const x=applyWorkshopCorner(doc,'back+left',{a:'back',b:'left',tall,base,...(upper?{upper}:{})});assert(x.ok,x.reason);return x.doc;};
const one=make(base),fresh=cleanIdea(JSON.parse(JSON.stringify(one)));assert(fresh);
const solid=d=>kitchenGeometry(d.kitchen,d.room).cornerBodies[0];
const q=buildFactoryQuote(fresh),s=solid(fresh),count=(q,sku)=>q.pieces.filter(p=>p.sku===sku).reduce((x,p)=>x+p.count,0);
assert.deepEqual(q.issues,[]);assert.deepEqual(q.releaseIssues,[]);assert.deepEqual(cornerMotionIssues(fresh),[]);
assert.equal(s.groupCount,1);assert.equal(s.panels.filter(p=>p.tag==='shelf').length,3);assert.equal(s.doorSweeps.length,1);
assert.equal(q.pieces.filter(p=>p.cornerCut?.tag==='joint').length,0);assert.equal(count(q,'HINGE'),3);assert.equal(count(q,'PULL'),1);
const door=q.pieces.find(p=>p.cornerCut?.tag==='door');assert.deepEqual([door.a,door.b],[794,544]); // H 800 - 2x2 reveal - 2x1 edge; W 1050-500-2x2-2x1.
const target='corner:back+left:base';
assert(orderHandoffUnits(fresh).some(x=>x.id===target&&x.checks.length));assert(manufacturingKeys(fresh)[target]);
assert(getKitchenPhotoMesh(scenePlan(fresh.room),fresh.kitchen).faces.some(f=>f.id===target&&f.tag==='corner-shelf'));
const both=make({...base,access:'both'});const bq=buildFactoryQuote(both);assert(bq.ready);assert.equal(count(bq,'HINGE'),6);assert.equal(solid(both).groupCount,1);assert(bq.total>q.total);
const divided=make({...base,access:'both',build:{...build,mode:'split'}});
const sq=buildFactoryQuote(divided);assert.deepEqual(sq.issues,[]);assert.equal(solid(divided).groupCount,2);assert.equal(count(sq,'CORNER-KIT'),2);
assert.equal(sq.pieces.filter(p=>p.cornerCut?.tag==='joint').length,2);assert.equal(count(sq,'HINGE'),6);assert.notEqual(manufacturingKeys(divided)[target],manufacturingKeys(both)[target]);
assert(sq.pieces.some(p=>p.cornerCut?.side==='b'&&p.cornerCut?.y0===360));
const moved=make({...base,access:'both',build:{...build,mode:'split',arms:{...build.arms,b:{use:'للضيافة',shelves:[390]}}}});
assert.notEqual(manufacturingKeys(divided)[target],manufacturingKeys(moved)[target],'same cut rectangles with a different fixing height must not be interchangeable');
const switched=make({...base,access:'b',build:{...build,through:'b'}});
assert.equal(buildFactoryQuote(switched).ready,true);assert.equal(solid(switched).panels.filter(p=>p.tag==='door')[0].side,'b');
const bad=make({...base,build:{...build,mode:'split'}});assert(buildFactoryQuote(bad).issues.some(t=>t.includes('صندوق مغلق')));
const blind=make({...base,build:{...build,mode:'split',arms:{...build.arms,b:{use:'',shelves:[]}}}});assert(buildFactoryQuote(blind).ready);
const badShelves=make({...base,build:{...build,arms:{...build.arms,a:{use:'رف',shelves:[310,312]}}}});assert(buildFactoryQuote(badShelves).issues.some(x=>x.includes('رف')));
assert.equal(cleanCornerBuild({...build,through:'guess'}),null);
const unpriced=structuredClone(both);unpriced.room.workshop.catalog.items.find(i=>i.sku==='HINGE').price=null;assert.equal(buildFactoryQuote(unpriced).total,null);
const upper={...base,build:{...build,recipe:'U90',arms:{a:{use:'قهوة',shelves:[300]},b:{use:'',shelves:[]}}},body:{...body,bottomMm:1500,heightMm:650}};
const separate=make(base,upper);assert.equal(kitchenGeometry(separate.kitchen,separate.room).cornerBodies.length,2);
assert(buildFactoryQuote(separate).pieces.some(p=>p.unitId.endsWith('upper')&&p.cornerCut?.y0===300));
const full={...base,build:{...build,recipe:'T90'},body:{...body,heightMm:2300}};const high=make(full,full,true);
assert.deepEqual([...new Set(buildFactoryQuote(high).pieces.map(p=>p.unitId))],['corner:back+left:tall']);
assert(!cleanProductionCorners({'back+left':{a:'back',b:'left',tall:true,base,upper}}));
assert(cornerAssembly(base,'base',catalog,false).issues.length);
const unverified=structuredClone(both);delete unverified.room.workshop.chains.left.attestation;
assert(siteReleaseIssues(unverified).length);assert(buildFactoryQuote(unverified).releaseIssues.length);
const colored=setCornerFront(both,catalog,target,'FACE-6-G'),reopen=cleanIdea(JSON.parse(JSON.stringify(colored)));assert(reopen?.room.workshop.finishes.cornerFronts[target]);
const cq=buildFactoryQuote(reopen);assert(cq.pieces.filter(p=>p.cornerCut?.tag==='door').every(p=>p.sku==='FACE-6-G'));assert(cq.total>bq.total);
const sample=(d)=>getKitchenPhotoMesh(scenePlan(d.room),d.kitchen).faces.find(p=>p.tag==='corner-door');
assert.equal(sample(reopen).color,'#72614c');
assert.notEqual(sample(both).color,sample(reopen).color);
const oldState=await approvalState(both),newState=await approvalState(reopen);assert.equal(oldState.keys.structure,newState.keys.structure);assert.notEqual(oldState.keys.customer,newState.keys.customer);
assert.throws(()=>setCornerFront(both,catalog,target,'BODY-6'));
const removed=applyWorkshopCorner(reopen,'back+left',null);assert(removed.ok);assert(!removed.doc.room.workshop.finishes.cornerFronts);
const steel=structuredClone(catalog);steel.items.find(i=>i.sku==='FACE-6-G').thicknessMm=8;assert.equal(cleanCatalog(steel),null);
assert(orderHandoffUnits(reopen).find(x=>x.id===target).checks.some(c=>c.nominal===450&&c.key.startsWith('corner-shelf-')));

console.log('One connected body vs two complete carcasses, independent one/two fronts; separate shelf elevations, fixed blind wing, live CAD, quote, immutable per-panel operation/assembly and approval, bottom-only/two tiers/full height, exact front/hinge cut and field gates verified.');

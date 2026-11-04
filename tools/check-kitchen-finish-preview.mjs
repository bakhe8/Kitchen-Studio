import assert from 'node:assert/strict';
import {reviewFinishPreview,reviewFinishCandidate} from '../public/kitchen-finish-preview.js';
import {makeVisitExample} from './fixture-kitchen-visit-example.mjs';
import {proposeWholeKitchen} from '../public/kitchen-whole-plan.js';
import {getFactoryCatalog,buildFactoryQuote,cleanCatalog,seedCatalog} from '../public/kitchen-workshop-factory.js';
import {finishMembers,setFacePanel} from '../public/kitchen-finish-parts.js';
import {setCornerFront} from '../public/kitchen-corner-finishes.js';
import {createKitchen} from '../public/kitchen-model.js';
import {applyWorkshopCorner} from '../public/kitchen-production-row.js';
import {newChainRow,attestChain,applyChain} from '../public/kitchen-chain-model.js';

const generated=await proposeWholeKitchen(makeVisitExample(),{walls:['back']});assert(generated.ok,generated.reason);
const base=generated.candidates[0].doc;
const fixture=()=>{
 const doc=structuredClone(base),raw=doc.room.workshop.catalog;
 const unit=finishMembers(doc,getFactoryCatalog(doc)).find(u=>u.family==='storage');assert(unit);
 return {doc,raw,id:unit.id,cat:()=>getFactoryCatalog(doc)};
};
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}
let groups=0;
function test(name,run){run();groups++;console.log('PASS '+name);}

test('front preview is pure and quotes actual project purchase and sale differences',()=>{
 const f=fixture();f.raw.items.find(i=>i.sku==='FACE-6-G').price=170;
 const before=JSON.stringify(f.doc),catalog=freeze(f.cat());freeze(f.doc);
 const out=reviewFinishPreview(f.doc,catalog,{scope:f.id,part:'front',sku:'FACE-6-G'});
 const old=buildFactoryQuote(f.doc),next=buildFactoryQuote(out.doc);
 assert.equal(out.doc.room.workshop.finishes.units[f.id].frontSku,'FACE-6-G');
 assert.equal(out.doc.kitchen.units.find(u=>u.id===f.id).frontColor,'#c5aa87');
 assert.equal(out.delta,Math.round((next.total-old.total)*100)/100);
 assert.equal(out.materialValue,next.materialValue);assert.equal(out.previousMaterialValue,old.materialValue);
 assert.equal(out.materialDelta,Math.round((next.materialValue-old.materialValue)*100)/100);
 assert.equal(out.total,next.total);assert.equal(out.previousTotal,old.total);
 assert.equal(JSON.stringify(f.doc),before);assert.notEqual(out.doc,f.doc);
 assert.deepEqual(reviewFinishCandidate(f.doc,out.doc,catalog,{scope:f.id,sku:'FACE-6-G'}).doc,out.doc);
});

test('new incompatible front thickness is rejected before it reaches project save',()=>{
 const f=fixture();f.raw.items.find(i=>i.sku==='FACE-6-G').thicknessMm=8;
 const before=JSON.stringify(f.doc);
 assert.throws(()=>reviewFinishPreview(f.doc,f.cat(),{scope:f.id,part:'front',sku:'FACE-6-G'}),/سماكة|تعشيق|خلوص/);
 assert.equal(JSON.stringify(f.doc),before);
});

test('front availability, factory alternatives and exact selection identities are enforced',()=>{
 const f=fixture();f.raw.items.find(i=>i.sku==='FACE-6-G').available=false;
 f.raw.items.find(i=>i.sku==='FACE-6-G').stockUnits=0;
 assert.throws(()=>reviewFinishPreview(f.doc,f.cat(),{scope:f.id,part:'front',sku:'FACE-6-G'}),/صنف|متاح/);
 assert.throws(()=>reviewFinishPreview(f.doc,f.cat(),{scope:'missing',part:'front',sku:'FACE-6-W'}),/الوحدة|النطاق/);
 assert.throws(()=>reviewFinishPreview(f.doc,f.cat(),{scope:f.id,part:'invented',sku:'PULL'}),/جزء|قطعة|تشطيب/);
 f.raw.families.storage.frontSkus=['FACE-6-W'];f.raw.items.find(i=>i.sku==='FACE-6-G').available=true;
 assert.throws(()=>reviewFinishPreview(f.doc,f.cat(),{scope:f.id,part:'front',sku:'FACE-6-G'}),/بدائل|معتمد/);
});

test('a discontinued front must cover existing project demand as well as the new unit',()=>{
 const f=fixture(),item=f.raw.items.find(i=>i.sku==='FACE-6-G');
 Object.assign(item,{available:false,stockUnits:1,stockLengthMm:1000,stockWidthMm:1000});
 const other=finishMembers(f.doc,f.cat()).find(u=>u.id!==f.id&&u.family==='sink');assert(other);
 const old=setFacePanel(f.doc,f.cat(),other.id,item.sku);
 const unchecked=setFacePanel(old,getFactoryCatalog(old),f.id,item.sku);
 assert(buildFactoryQuote(unchecked).purchases.find(p=>p.sku===item.sku).qty>1,'fixture needs more sheets than remaining stock');
 assert.throws(()=>reviewFinishPreview(old,getFactoryCatalog(old),{scope:f.id,part:'front',sku:item.sku}),/المخزون|توريد/);
 const detached=structuredClone(getFactoryCatalog(old));Object.assign(detached.items.find(i=>i.sku===item.sku),{available:true,stockUnits:100});
 assert.throws(()=>reviewFinishPreview(old,detached,{scope:f.id,part:'front',sku:item.sku}),/المخزون|توريد/,'a display catalog cannot override the saved project stock');
});

function withParts(){
 const f=fixture(),raw=f.raw,original=sku=>raw.items.find(i=>i.sku===sku);
 raw.items.push({...original('BODY-6'),sku:'BODY-BLUE',name:'لوح أزرق',colorHex:'#15658a',price:130},
  {...original('PULL'),sku:'PULL-BRASS',name:'يد نحاسية',colorHex:'#b57132',price:35},
  {...original('HINGE'),sku:'HINGE-X',name:'مفصلة بديلة',price:25});
 const family=raw.families.storage;
 const slot=(source,labels,skus)=>({source,labels,skus:[source,...skus],mode:'matching',reference:'verified fixture factory alternatives'});
 family.finishSlots={body:slot('BODY-6',['جانب جسم','قاعدة جسم'],['BODY-BLUE']),handle:slot('PULL',['يد'],['PULL-BRASS'])};
 const hinge=family.recipe.find(l=>l.sku==='HINGE');
 hinge.hardwareRule={group:'مفصلة',metric:'frontWidth',min:50,max:1000,priority:1,reference:'fixture hardware guide'};
 family.recipe.push({...hinge,sku:'HINGE-X',hardwareRule:{...hinge.hardwareRule,priority:2}});
 assert(cleanCatalog(raw));return f;
}
test('published body and handle choices use their real slots, parts and prices',()=>{
 const f=withParts(),before=JSON.stringify(f.doc);
 const body=reviewFinishPreview(f.doc,f.cat(),{scope:f.id,part:'body',sku:'BODY-BLUE'});
 assert(buildFactoryQuote(body.doc).pieces.some(p=>p.unitId===f.id&&p.sku==='BODY-BLUE'));
 const handle=reviewFinishPreview(body.doc,getFactoryCatalog(body.doc),{scope:f.id,part:'handle',sku:'PULL-BRASS'});
 assert(buildFactoryQuote(handle.doc).pieces.some(p=>p.unitId===f.id&&p.sku==='PULL-BRASS'));
 assert.throws(()=>reviewFinishPreview(f.doc,f.cat(),{scope:f.id,part:'handle',sku:'BODY-BLUE'}),/معتمد|متاح/);
 const reset=reviewFinishPreview(handle.doc,getFactoryCatalog(handle.doc),{scope:f.id,part:'handle',sku:null});
 assert(!reset.doc.room.workshop.finishes.partUnits[f.id].handle);
 assert.equal(JSON.stringify(f.doc),before);
});

test('handle preview binds the actual drilling pattern and refuses machining errors',()=>{
 const f=withParts(),pattern={machine:'driller',reference:'handle 96',tolerance:.1,xFrom:'start',yFrom:'start',x:45,y:60,diameter:4,depth:5,pitch:96,axis:'x'};
 f.raw.machining={strict:false,machines:[{id:'driller',name:'مثقاب',datum:'يسار من أسفل',skus:['FACE-6-W','FACE-6-G'],ops:['drill'],maxLength:5000,maxWidth:2000,maxThickness:60,minTolerance:.05,clampMargin:5,maxAngle:85,minBendRadius:0}]};
 f.raw.families.storage.finishSlots.handle.drilling={target:'حشوة واجهة',models:{PULL:pattern,'PULL-BRASS':{...pattern,pitch:128,reference:'handle 128'}}};
 assert(cleanCatalog(f.raw));
 const out=reviewFinishPreview(f.doc,f.cat(),{scope:f.id,part:'handle',sku:'PULL-BRASS'});
 assert.deepEqual(buildFactoryQuote(out.doc,{unitIds:[f.id]}).operations.filter(o=>o.reference==='handle 128').map(o=>o.x),[45,173]);
 f.raw.families.storage.finishSlots.handle.drilling.models['PULL-BRASS'].pitch=1000;
 assert.throws(()=>reviewFinishPreview(f.doc,f.cat(),{scope:f.id,part:'handle',sku:'PULL-BRASS'}),/حافة|الماسك|لوح/);
});

test('load-rated mechanisms are qualified and returned without mutating the project',()=>{
 const f=withParts(),before=JSON.stringify(f.doc);
 const out=reviewFinishPreview(f.doc,f.cat(),{scope:f.id,part:'mechanisms',group:'مفصلة',sku:'HINGE-X'});
 assert(buildFactoryQuote(out.doc,{unitIds:[f.id]}).pieces.some(p=>p.sku==='HINGE-X'&&p.pinnedHardware));
 assert.equal(JSON.stringify(f.doc),before);
 assert.throws(()=>reviewFinishPreview(f.doc,f.cat(),{scope:'all',part:'mechanisms',group:'مفصلة',sku:'HINGE-X'}),/وحدة|نطاق/);
 assert.throws(()=>reviewFinishPreview(f.doc,f.cat(),{scope:f.id,part:'mechanisms',group:'missing',sku:'HINGE-X'}),/عتاد|مسموح|مجموعة/);
});

test('unknown prices remain null and starter front policy is preserved',()=>{
 const f=fixture();f.raw.items.find(i=>i.sku==='FACE-6-G').price=null;f.raw.approved=false;
 const out=reviewFinishPreview(f.doc,f.cat(),{scope:f.id,part:'front',sku:'FACE-6-G'});
 assert.equal(out.delta,null);assert.equal(out.total,null);assert.equal(out.materialValue,null);assert.equal(out.materialDelta,null);
 assert(Number.isFinite(out.previousTotal));assert(!JSON.stringify(out).includes('NaN'));
});

test('prices come from the project catalog and cross-project candidates are refused',()=>{
 const f=fixture(),wrong=structuredClone(f.cat());wrong.items[0].price+=1;
 const out=reviewFinishPreview(f.doc,wrong,{scope:f.id,part:'front',sku:'FACE-6-G'});
 assert.equal(out.total,buildFactoryQuote(out.doc).total,'a detached presentation catalog cannot invent the project price');
 assert.throws(()=>reviewFinishPreview(f.doc,{...wrong,items:[]},{scope:f.id,part:'front',sku:'FACE-6-G'}),/كتالوج/);
 const other=structuredClone(f.doc);other.room.projectId='K-1111111111111111';
 assert.throws(()=>reviewFinishCandidate(f.doc,other,f.cat(),{scope:f.id,sku:'FACE-6-W'}),/المشروع/);
});

test('new full-project errors are caught even when outside the selected unit scope',()=>{
 const f=fixture(),after=structuredClone(setFacePanel(f.doc,f.cat(),f.id,'FACE-6-G'));
 const other=after.kitchen.units.find(u=>u.id!==f.id&&u.kind==='drawers');assert(other);other.width+=1;
 assert.throws(()=>reviewFinishCandidate(f.doc,after,f.cat(),{scope:f.id,sku:'FACE-6-G'}),/مقاس|موقع|وصف الصف/);
});

test('corner candidates use real full-project quote without inventing a CAD unit',()=>{
 const room={width:500,height:280,length:500},catalog=seedCatalog();
 const item=sku=>catalog.items.find(i=>i.sku===sku);
 catalog.items.push(...['CORNER-KIT','SHELF-BRACKETS'].map(sku=>({...item('PULL'),sku,name:sku})));
 catalog.cornerRecipes={B90:{frontSkus:['FACE-6-G'],label:'ركن',reference:'factory corner fixture',tier:'base',bodySku:'BODY-6',frontSku:'FACE-6-W',shelfSku:'BODY-6',edgeSku:'EDGE',hingeSku:'HINGE',handleSku:'PULL',bodyKit:'CORNER-KIT',shelfKit:'SHELF-BRACKETS',revealMm:2,shelfSetbackMm:15,edgeBuildMm:1,maxSpanMm:1300,maxDoorWidthMm:620,maxDoorHeightMm:900,hingesPerDoor:3}};
 catalog.approved=true;for(const i of catalog.items){i.price=i.sku==='FACE-6-G'?25:5;i.stockUnits=100;}
 Object.assign(catalog.terms,{worktop:'separate',labor:0,installation:0,delivery:0,marginPct:0,taxPct:0});
 let doc={room:{...room,workshop:{catalog}},kitchen:createKitchen(room,'empty')};
 for(const wall of ['back','left']){const signed=attestChain(doc,wall,{source:'field',rows:[{...newChainRow('corner','tip'),gapMm:5000}]},{name:'QA',reference:'survey'});assert(signed.ok,signed.reason);const saved=applyChain(doc,wall,signed.chain);assert(saved.ok,saved.reason);doc=saved.doc;}
 const made=applyWorkshopCorner(doc,'back+left',{a:'back',b:'left',tall:false,base:{aMm:1050,bMm:950,inside:'shelves',access:'a',sku:'',body:{depthAMm:550,depthBMm:500,bottomMm:0,heightMm:800,reference:'Site A'},build:{recipe:'B90',mode:'connected',through:'a',arms:{a:{use:'أواني',shelves:[200,450]},b:{use:'ضيافة',shelves:[360]}}}}});assert(made.ok,made.reason);
 const scope='corner:back+left:base',next=setCornerFront(made.doc,catalog,scope,'FACE-6-G');
 const out=reviewFinishCandidate(made.doc,next,catalog,{scope,sku:'FACE-6-G'});
 assert(out.delta>0);assert.equal(out.doc,next);assert.equal(out.scopedMaterialValue,null,'corner pricing is not misrepresented as an unsupported rectangular-unit scope');
 const direct=reviewFinishPreview(made.doc,catalog,{scope,part:'corner',sku:'FACE-6-G'});
 assert.deepEqual(direct.doc,next);assert.equal(direct.delta,out.delta);
});
console.log('Kitchen finish preview: '+groups+' transaction groups passed.');

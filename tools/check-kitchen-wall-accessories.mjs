import assert from 'node:assert/strict';
import {makeChainExample,readChainRange,attestChain,applyChain,chainFromDrawing} from '../public/kitchen-chain-model.js';
import {applyWallOptions,buildUpperRows,readWallOptions,wallOptionTakeoff,wallUpperBands} from '../public/kitchen-chain-options.js';
import {cleanCatalog,seedCatalog,buildFactoryQuote} from '../public/kitchen-workshop-factory.js';
import {portableFactoryCatalog} from '../public/kitchen-factory-template.js';
import {wallAssembly,wallAccessoryApproval} from '../public/kitchen-wall-accessory.js';
import {addFeature,kitchenGeometry,addRun,addUnit} from '../public/kitchen-model.js';
import {planWorkshopRow} from '../public/kitchen-production-row.js';
import {orderHandoffUnits} from '../public/kitchen-order-domain.js';
import {getKitchenPhotoMesh} from '../public/kitchen-render.js';
import {elevationSheet} from '../public/kitchen-sheet.js';
import {scenePlan} from '../public/kitchen-project.js';
import {cleanIdea} from '../public/kitchen-ideas.js';

let doc=makeChainExample();const raw=seedCatalog();for(const i of raw.items){i.price=10;i.stockUnits=100;}
Object.assign(raw.terms,{worktop:'separate',labor:0,installation:0,delivery:0,marginPct:0,taxPct:0});raw.approved=true;
const cloth={...raw.items.find(i=>i.sku==='BODY-6'),sku:'CLOTH',name:'لفافة قماش',stockWidthMm:4000,colorHex:'#7856a3',thicknessMm:1};
raw.items.push(cloth);
const track={kind:'track',label:'مجرى تجريبي',reference:'SUP-CUR-7',minWidth:100,maxWidth:4000,maxHeight:3000,projection:85,headHeight:50,railDeduct:10,clothDeduct:40,hem:100,fullness:2,parked:140,fixPitch:500,rail:'AL-20',cloth:'CLOTH',fixing:'UP-HANGER'};
const guard={kind:'heater',model:'WH-Q2',label:'غطاء تجريبي',reference:'FAC-24',permission:'Synthetic WH-Q2 cover manual',minWidth:200,maxWidth:1200,maxHeight:2200,innerGap:40,lift:60,pull:180,edgeBand:15,ventMin:30000,faceFreePct:20,clipCount:4,mountCount:6,sides:'BODY-6',face:'FACE-6-G',clips:'PULL',mount:'UP-HANGER'};
raw.wallAccessories={CUR:track,GA:guard};raw.wallRates.curtain=999;const cat=cleanCatalog(raw);assert(cat);assert.deepEqual(portableFactoryCatalog(cat).wallAccessories,cat.wallAccessories);
assert.equal(cleanCatalog({...cat,wallAccessories:{...cat.wallAccessories,CUR:{...track,cloth:'SLIDE'}}}),null);
doc.room.workshop.catalog=cat;
function attest(d,wall){const ch=chainFromDrawing(d,wall),att=attestChain(d,wall,ch,{name:'QA',reference:'مسح معتمد'});assert(att.ok,att.reason);const a=applyChain(d,wall,att.chain);assert(a.ok,a.reason);return a.doc;}
const window=doc.kitchen.features.find(f=>f.kind==='window');
const base=planWorkshopRow(doc,{...readChainRange(doc,'back'),tier:'base',wanted:{rice:false,sink:true,dishwasher:false}});assert(base.ok,base.reason);doc=base.doc;
const o=structuredClone(readWallOptions(doc,'back')),set=(d,w,s)=>{const a=applyWallOptions(d,w,s);assert(a.ok,a.reason);return a.doc;};
o.curtains[window.id]={state:'factory',type:'track',leftMm:110,rightMm:90,aboveMm:100,dropMm:1100,projectionMm:85,pose:'closed',recipe:'CUR'};
doc=set(doc,'back',o);
const a=wallAssembly(doc.room,window,o.curtains[window.id],cat),wc=a.pieces;assert.equal(wc[0].a,1390);assert.equal(wc[1].a,1150);assert.equal(wc[1].b,2720);assert.equal(wc[2].count,4);
const q=buildFactoryQuote(doc);assert.equal(q.pieces.filter(p=>p.family==='curtain').length,3);assert.equal(q.extras.find(x=>x.kind==='curtain').inMaterials,true);assert.equal(q.extras.find(x=>x.kind==='curtain').cost,0);
const geo=kitchenGeometry(doc.kitchen,doc.room);assert.equal(geo.wallAccessories.find(x=>x.role==='curtain-cloth').w,1400);
assert(elevationSheet(doc,'back',true).includes('data-sheet-accessory="curtain-cloth"'));assert(getKitchenPhotoMesh(scenePlan(doc.room),doc.kitchen).faces.some(f=>f.face==='curtain-cloth'||f.name==='curtain-cloth'||f.detail==='curtain-cloth'||JSON.stringify(f).includes('curtain-cloth')));
const pose=structuredClone(o);pose.curtains[window.id].pose='parked';const parked=set(doc,'back',pose);
assert.equal(kitchenGeometry(parked.kitchen,parked.room).wallAccessories.find(x=>x.role==='curtain-cloth').w,140);assert.deepEqual(buildFactoryQuote(parked).pieces,q.pieces);
assert.equal(cleanIdea(JSON.parse(JSON.stringify(parked))).room.workshop.options.back.curtains[window.id].recipe,'CUR');
const narrow=structuredClone(doc);narrow.room.workshop.catalog.wallAccessories.CUR.maxWidth=1000;assert(buildFactoryQuote(narrow).issues.some(s=>s.includes('مجال')||s.includes('حدود موديل')));
for(const state of ['none','existing','external']){const opt=structuredClone(o);const v=opt.curtains[window.id];v.state=state;delete v.recipe;delete v.pose;const other=set(doc,'back',opt);assert(!buildFactoryQuote(other).pieces.some(p=>p.family==='curtain'));assert.equal(kitchenGeometry(other.kitchen,other.room).wallAccessories.length,state==='none'?0:2);}
const inward=structuredClone(doc),f=inward.kitchen.features.find(x=>x.id===window.id);f.swing='in';f.hinge='left';f.hingeInset=0;f.leafWidth=f.width;
assert(wallOptionTakeoff(inward,'back').pending.some(x=>x.includes('تجميعها')));

let h=addFeature(doc.kitchen,doc.room,{id:'heater-q',kind:'heater',wall:'left',u:170,width:40,bottom:155,height:55,depth:32});assert(h.ok,h.reason);doc={...doc,kitchen:h.kitchen};doc=attest(doc,'left');
const y=doc.kitchen.features.find(f=>f.kind==='heater'),ho=structuredClone(readWallOptions(doc,'left'));
ho.heaters[y.id]={state:'cover',model:'WH-Q2',manual:'WH-Q2 Rev A',reviewed:true,leftMm:50,rightMm:50,aboveMm:60,belowMm:60,frontMm:140,recipe:'GA'};
ho.heaters[y.id].kitProof=wallAccessoryApproval(doc.room,doc.kitchen,'left',y.id,cat,ho);doc=set(doc,'left',ho);
const sh=wallAssembly(doc.room,y,ho.heaters[y.id],cat);assert.deepEqual(sh.pieces.map(p=>[p.a,p.b,p.count]),[[670,360,2],[670,512,1],[null,null,4],[null,null,6]]);
assert.equal(sh.ventMm2,(500-30)*(670-30)*.2);assert.deepEqual(wallOptionTakeoff(doc,'left').pending,[]);
assert.equal(buildFactoryQuote(doc).pieces.filter(p=>p.family==='heater-cover').length,4);
assert(orderHandoffUnits(doc).some(v=>v.id==='wall:left:heater-cover:'+y.id&&v.checks.some(c=>c.nominal===512)));
const service=structuredClone(doc);service.room.workshop.catalog.wallAccessories.GA.ventMin=100000;assert(buildFactoryQuote(service).issues.some(s=>s.includes('التهوية')));
const revised=structuredClone(doc);revised.room.workshop.catalog.wallAccessories.GA.pull=190;assert(wallOptionTakeoff(revised,'left').pending.some(s=>s.includes('بعد أي تغيير')));
const blocked=structuredClone(doc);blocked.kitchen.features.push({id:'cover-beam',kind:'beam',wall:'left',u:170,width:15,depth:60,height:5,bottom:218});assert(wallOptionTakeoff(blocked,'left').pending.some(s=>s.includes('مسار فك')&&s.includes('cover-beam')));
const exposed=structuredClone(ho);exposed.heaters[y.id].state='exposed';delete exposed.heaters[y.id].recipe;delete exposed.heaters[y.id].kitProof;
const open=set(doc,'left',exposed);assert(!buildFactoryQuote(open).pieces.some(p=>p.family==='heater-cover'));assert(!kitchenGeometry(open.kitchen,open.room).wallAccessories.some(s=>s.role==='cover-face'));

let basic=makeChainExample();const upper=structuredClone(readWallOptions(basic,'back'));upper.mode='tall';upper.decisions={upper:true,cornice:true};basic=set(basic,'back',upper);const built=buildUpperRows(basic,'back');assert(built.ok,built.reason);
const disable=structuredClone(upper);disable.mode='none';const off=set(built.doc,'back',disable);assert.deepEqual(wallUpperBands(off,'back'),[]);assert(readChainRange(off,'back').baseSpans.length>0);assert(wallOptionTakeoff(off,'back').pending.length);
const cleared=buildUpperRows(off,'back');assert(cleared.ok,cleared.reason);assert.equal(cleared.doc.kitchen.runs.filter(r=>r.id.startsWith('wup-back-')).length,0);assert.deepEqual(wallOptionTakeoff(cleared.doc,'back').pending,[]);
assert(!planWorkshopRow(cleared.doc,{wall:'back',tier:'upper',startMm:1300,endMm:2000}).ok);
const saved=structuredClone(off);saved.kitchen.units[0].fillRole='fixed';assert(!buildUpperRows(saved,'back').ok);assert(saved.kitchen.units.length);
console.log('Measured wall accessories: curtain fabric (1,150 × 2,720), 1,390 rail, four mounts, geometry/elevation and parked swing; optional/external excluded; model-specific removable heater panels, vent area and extraction collision, QC/pinning; no-upper honors protected work.');
const enhanced=structuredClone(cat);enhanced.wallAccessories.CUR.extras=[
 {label:'محرك النظام',rule:'fixed',value:1,sku:'PULL'},
 {label:'عربة المجرى',rule:'pitch',value:100,sku:'UP-HANGER'},
 {label:'قطاع سفلي',rule:'span',value:-24,sku:'AL-20'}];
const extras=wallAssembly(doc.room,window,o.curtains[window.id],cleanCatalog(enhanced)).pieces.slice(-3);
assert.deepEqual(extras.map(p=>[p.sku,p.count,p.a]),[['PULL',1,null],['UP-HANGER',15,null],['AL-20',1,1376]]);
assert.equal(cleanCatalog({...cat,wallAccessories:{CUR:{...track,extras:[{label:'bad',rule:'fixed',value:.5,sku:'PULL'}]}}}),null);
const closeBody=structuredClone(doc);
closeBody.kitchen.runs.push({id:'narrow-bay',tier:'upper',wall:'left',start:140,end:240,bottom:188,height:32,depth:40});
closeBody.kitchen.units.push({id:'hits-cover',kind:'storage',runId:'narrow-bay',u:166,width:55,open:false});
assert(buildFactoryQuote(closeBody,{unitIds:['hits-cover']}).releaseIssues.some(s=>s.includes('hits-cover')));
assert(!buildFactoryQuote(closeBody,{unitIds:[doc.kitchen.units[0].id]}).releaseIssues.some(s=>s.includes('hits-cover')));
console.log('Supplier extras feed the kit and stock: fixed drive, 15 gliders and 1,376 mm bottom rail; scoped cabinet release detects overlap with the neighboring hood.');

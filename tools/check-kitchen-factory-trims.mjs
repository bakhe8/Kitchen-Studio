import assert from 'node:assert/strict';
import {makeChainExample,applyChain,newChainRow,readChainRange} from '../public/kitchen-chain-model.js';
import {readWallOptions,applyWallOptions,buildUpperRows,cleanChainOptions} from '../public/kitchen-chain-options.js';
import {createKitchen} from '../public/kitchen-model.js';
import {cleanCatalog,seedCatalog,buildFactoryQuote} from '../public/kitchen-workshop-factory.js';
import {makeTrimPieces} from '../public/kitchen-factory-trims.js';
import {remainderStockRequirements,manufacturingKeys} from '../public/kitchen-order-domain.js';
import {machiningSheet} from '../public/kitchen-machining.js';
import {portableFactoryCatalog} from '../public/kitchen-factory-template.js';
const cat=seedCatalog();cat.approved=true;
cat.items.push({...cat.items[0],sku:'CROWN50',sectionWidthMm:50,thicknessMm:60});
for(const i of cat.items){i.stockUnits=100;i.price=10;}
Object.assign(cat.terms,{labor:0,installation:0,delivery:0,marginPct:0,taxPct:0});
cat.trims={C60:{kind:'cornice',label:'كورنيش خمسين',sku:'CROWN50',reference:'C60 r4',heightMm:60,projectionMm:50},
 F10:{kind:'filler',label:'قفلة مصنعة',sku:'BODY-6',reference:'F10 r3',minWidthMm:100,maxWidthMm:1020,jointGapMm:3,grain:'length'}};
const c=cleanCatalog(cat);assert.ok(c);assert.deepEqual(portableFactoryCatalog(c).trims,c.trims);
assert.equal(cleanCatalog({...c,trims:{wrong:{...c.trims.C60,sku:'BODY-6'}}}),null);
function options(doc,wall,mode,start,end){
 const o=structuredClone(readWallOptions(doc,wall));Object.assign(o,{mode,heightMm:600,bottomMm:1500,depthMm:350,headMm:20});
 o.cornice={enabled:true,heightMm:60,projectionMm:50,returns:true,reviewed:true};
 o.factoryTrim={cornice:{recipe:'C60',start,end},...(mode==='filler'?{filler:{recipe:'F10'}}:{})};
 const q=applyWallOptions(doc,wall,o);assert(q.ok,q.reason);return q.doc;
}
let d=makeChainExample();for(const chain of Object.values(d.room.workshop.chains))chain.source='field';
d.room.workshop.catalog=c;
d=options(d,'back','filler','square','return');const made=buildUpperRows(d,'back');assert(made.ok,made.reason);d=made.doc;
assert.deepEqual(cleanChainOptions(d.room.workshop.options),d.room.workshop.options);
let q=buildFactoryQuote(d);assert(q.ready,[...q.issues,...q.releaseIssues].join('/'));
const crown='wall:back:cornice',filler='wall:back:filler';
const trims=q.pieces.filter(p=>p.unitId===crown),panels=q.pieces.filter(p=>p.unitId===filler);
assert(trims.filter(x=>x.label.includes('واجهة')).length===2);
assert.equal(trims.filter(x=>x.label.includes('رَدّة')).length,3);
assert(trims.filter(x=>x.label.includes('رَدّة')).every(x=>x.a===400&&x.datumLengthMm===350));
assert.equal(q.extras.find(x=>x.kind==='cornice').quantity,trims.reduce((n,x)=>n+x.datumLengthMm,0)/1000);
assert.equal(q.extras.find(x=>x.kind==='filler').inMaterials,true);
assert(q.extras.every(x=>x.cost===0));
const spans=readChainRange(d,'back').fillerSpans;
assert.equal(panels.reduce((n,p)=>n+p.a,0)+(panels.length-spans.length)*3,spans.reduce((n,s)=>n+s.endMm-s.startMm,0));
assert(panels.every(p=>p.a<=1020&&p.b===620));
assert.equal(q.extras.find(x=>x.kind==='filler').quantity,panels.reduce((n,p)=>n+p.a*p.b,0)/1e6);
assert.deepEqual(remainderStockRequirements(d,[crown]).purchases.map(p=>p.sku),['CROWN50']);
const routed=structuredClone(d),routing=routed.room.workshop.catalog;
routing.machining={strict:true,machines:[{id:'trimSaw',name:'منشار',datum:'الحافة الخلفية',skus:['CROWN50','BODY-6'],ops:['miter','size'],maxLength:6000,maxWidth:1300,maxThickness:60,minTolerance:.01,clampMargin:0,maxAngle:45,minBendRadius:0,setupMin:10,dailyMin:400}]};
for(const t of Object.values(routing.trims))t.route={machine:'trimSaw',tolerance:.1,minutes:2};
assert.ok(cleanCatalog(routing));const trimParts=buildFactoryQuote(routed).pieces.filter(p=>[crown,filler].includes(p.unitId));
const sheet=machiningSheet(trimParts,routing);assert.deepEqual(sheet.issues,[]);assert.equal(sheet.unrouted.length,0);
assert.equal(sheet.operations.length,2*trims.length+panels.length);
routing.machining.machines[0].maxAngle=40;assert.match(machiningSheet(trimParts,routing).issues.join(' '),/الزاوية/);
const noField=structuredClone(d);noField.room.workshop.chains.back.source='example';
assert(makeTrimPieces(noField,'back','cornice',c).releaseIssues.length);
const dirty=structuredClone(d);dirty.room.workshop.catalog.items.find(i=>i.sku==='CROWN50').sectionWidthMm=40;
assert.match(buildFactoryQuote(dirty).issues.join(' '),/القطاع|قطاع/);
const overhead=structuredClone(d);overhead.room.workshop.options.back.profiles=[{id:'trim-only',type:'ceiling',fromMm:3500,toMm:3700,bottomMm:2110,topMm:2160,depthMm:600,reference:'Survey r2'}];
assert(!readChainRange(overhead,'back').corniceSpans.some(s=>s.startMm<3700&&s.endMm>3500));
assert(readChainRange(overhead,'back').upperBandSpans.at(-1).some(s=>s.startMm<3700&&s.endMm>3500));
const changed=structuredClone(d);changed.room.workshop.options.back.factoryTrim.cornice.end='square';
assert.notEqual(manufacturingKeys(d,q)[crown],manufacturingKeys(changed,buildFactoryQuote(changed))[crown]);
const external=structuredClone(d);external.room.workshop.options.back.fillerBy='external';
assert(!buildFactoryQuote(external).pieces.some(p=>p.unitId===filler));
const long=structuredClone(d);long.room.workshop.catalog.trims.F10.grain='across';
assert(buildFactoryQuote(long).pieces.filter(p=>p.unitId===filler).every(p=>p.a===620&&p.b<=1020));
// Two perpendicular wall faces have their own local origins; intersect projected
// cabinet fronts in world space rather than blindly mitring at wall station 5000.
const room={width:500,length:500,height:280};let combo={room,kitchen:createKitchen(room,'empty')};
for(const wall of ['back','right']){
 const next=applyChain(combo,wall,{source:'field',rows:[newChainRow('start','begin'),{...newChainRow('stop','finish'),gapMm:5000},newChainRow('corner','end')]});
 assert(next.ok,next.reason);combo=options(next.doc,wall,'tall',wall==='right'?'join':'square',wall==='back'?'join':'square');
}
const joined=(w)=>makeTrimPieces(combo,w,'cornice',c);
let left=joined('back'),right=joined('right');assert.deepEqual(left.issues,[]);assert.deepEqual(right.issues,[]);
assert.equal(left.pieces[0].datumLengthMm,4650);assert.equal(right.pieces[0].datumLengthMm,4650);
assert.equal(left.pieces[0].ends.endDeg,-45);assert.equal(right.pieces[0].ends.startDeg,45);
const level=structuredClone(combo);level.room.workshop.options.right.mode='gap';
assert.match(makeTrimPieces(level,'back','cornice',c).issues.join(' '),/مناسيب/);
combo.room.workshop.options.right.factoryTrim.cornice.start='return';
assert.match(joined('back').issues.join(' '),/المقابل/);
console.log('Factory trim templates round-trip. Window breaks, three real exposed returns, cross-wall face intersection, reciprocal signed mitres, actual raw overhead, grain and panel gaps, external supply and isolated remainder stock verified.');

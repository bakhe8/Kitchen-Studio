import assert from 'node:assert/strict';
import {createKitchen,addUnit,addRun,addFeature,availableKitchenSlots,applyKitchenCatalogEntry,updateUnit,kitchenGeometry,validateKitchen} from '../public/kitchen-model.js';
import {studioCatalogEntries,kitchenUnitSpecs,kitchenUnitAllowed} from '../public/kitchen-catalog.js';
import {kitchenFrontFinishes,kitchenWorktopFinishes} from '../public/kitchen-materials.js';
import {scenePlan} from '../public/kitchen-project.js';
import {renderKitchenRoom} from '../public/kitchen-render.js';
import {copyKitchenUnit} from '../public/kitchen-creative-model.js';
import {cleanIdea} from '../public/kitchen-ideas.js';

const room={width:360,length:300,height:260},plan=scenePlan(room),ok=r=>{assert(r.ok,r.reason);return r.kitchen;};
const select={kind:'unit',id:'obj'},row={kind:'run',id:'r'},table=studioCatalogEntries();
assert.equal(new Set(table.map(e=>e.section+':'+e.id)).size,table.length);
assert.equal(studioCatalogEntries({query:'مجمّد'}).some(e=>e.section==='unit'&&e.id==='freezer'),true);
assert.equal(studioCatalogEntries({section:'worktop',query:'رخام أخضر'})[0]?.id,'verde');
assert(studioCatalogEntries({section:'front',family:'wood'}).every(e=>e.texture==='wood'&&e.roughness>0&&e.patternCm>0));
assert(studioCatalogEntries({section:'unit',tier:'upper'}).every(e=>kitchenUnitAllowed(e.id,'upper')));
for(const map of [kitchenFrontFinishes,kitchenWorktopFinishes]){
  assert(Object.keys(map).length>=20);
  for(const name of ['wood','stone','marble','quartz','paint','metal','porcelain'])assert(Object.values(map).some(v=>v.family===name),name);
  for(const m of Object.values(map))assert(/^#[\da-f]{6}$/i.test(m.color)&&/^#[\da-f]{6}$/i.test(m.ink)&&m.roughness>=0&&m.roughness<=1&&m.metalness>=0&&m.metalness<=1&&m.patternCm>0);
}
const blank=tier=>ok(addRun(createKitchen(plan,'empty'),plan,{id:'r',tier,wall:'back',start:10,end:300}));
const record=(p,kind,props={})=>ok(addUnit(p,plan,{kind,id:'obj',runId:'r',u:55,...props}));
const tags=(k,pitch=18)=>new Set([...renderKitchenRoom(plan,{kitchen:k,mode:'cutaway',yaw:24,pitch}).html
  .matchAll(/data-kitchen-3d-id="obj"[^>]*?data-kitchen-face="([^"]+)"/g)].map(m=>m[1]));
const expect={
  fridge:[90,190,65,0,'fridge-glass-shelf'],
  freezer:[60,178,62,0,'freezer-bin'],
  'oven-tower':[60,210,60,0,'tower-open-glass-door'],
  hood:[90,60,32,0,'hood-chimney'],
  'open-shelf':[60,86,60,1,'open-shelf-board'],
  'bottle-rack':[40,86,60,1,'bottle-neck'],
  pullout:[30,86,60,1,'pullout-gallery']
};
for(const [kind,[w,h,d,tops,part]] of Object.entries(expect)){
  const tier=kind==='hood'?'upper':'base',spec=kitchenUnitSpecs[kind],k=record(blank(tier),kind,{open:!!spec.openable});
  const geometry=kitchenGeometry(k,plan),u=geometry.units[0];assert.deepEqual([u.width,u.height,u.depth],[w,h,d]);
  assert.equal(geometry.worktops.length,tops);assert.equal(geometry.hardConflicts.length,0);
  assert.equal(u.openParts.length,spec.openable?(kind==='fridge'?2:1):0);assert(tags(k).has(part),'Missing solid '+kind+': '+part);
  if(spec.fixedWidth)assert.equal(updateUnit(k,plan,u.id,{width:w+1}).code,'fixed-width');
  assert.deepEqual(validateKitchen(JSON.parse(JSON.stringify(k)),plan),k);
  assert.deepEqual(cleanIdea({room,kitchen:k}).kitchen,k);
  const copy=copyKitchenUnit(k,plan,'obj','r',160);assert(copy.ok,copy.reason);
  assert.equal(copy.kitchen.units.at(-1).kind,kind);assert.notEqual(copy.kitchen.units.at(-1).id,u.id);assert(!copy.kitchen.units.at(-1).open);
}
assert(!addUnit(blank('base'),plan,{kind:'hood',runId:'r'}).ok);assert(!addUnit(blank('upper'),plan,{kind:'fridge',runId:'r'}).ok);
for(const kind of ['open-shelf','bottle-rack'])assert(kitchenUnitAllowed(kind,'upper')&&kitchenUnitAllowed(kind,'base'));
const base=record(blank('base'),'storage'),first=JSON.stringify(base);
let k=ok(applyKitchenCatalogEntry(base,plan,{section:'front',id:'teak'},select));
k=ok(applyKitchenCatalogEntry(k,plan,{section:'worktop',id:'carrara'},select));
k=ok(applyKitchenCatalogEntry(k,plan,{section:'front-style',id:'fluted'},select));
k=ok(applyKitchenCatalogEntry(k,plan,{section:'handle',id:'knob'},select));
assert.equal(k.units[0].frontFinish,'teak');assert.equal(k.runs[0].worktopFinish,'carrara');assert.equal(k.units[0].frontStyle,'fluted');assert.equal(k.units[0].handleStyle,'knob');
assert(tags(k).has('front-flute')&&tags(k).has('knob'),'options must appear on the real render mesh');
const framed=ok(updateUnit(k,plan,'obj',{frontStyle:'framed',handleStyle:'bar'}));
assert(tags(framed).has('front-rail')&&tags(framed).has('bar-handle'));
const flat=ok(updateUnit(k,plan,'obj',{frontStyle:'flat',handleStyle:'handleless'})),flatTags=tags(flat);
assert(flatTags.has('recessed-grip')&&!flatTags.has('front-rail')&&!flatTags.has('front-flute')&&!flatTags.has('knob'));
const dup=copyKitchenUnit(k,plan,'obj','r',160);assert(dup.ok);assert.equal(dup.kitchen.units.at(-1).frontStyle,'fluted');
assert.deepEqual(validateKitchen(k,plan),k);
assert.equal(JSON.stringify(base),first);
const restored=ok(updateUnit(k,plan,'obj',{frontStyle:null,handleStyle:null}));assert(!Object.hasOwn(restored.units[0],'frontStyle')&&!Object.hasOwn(restored.units[0],'handleStyle'));
for(const bad of [{frontStyle:'random'},{handleStyle:'url(#xyz)'}]){
  assert.equal(updateUnit(k,plan,'obj',bad).kitchen,k);
  const doc=structuredClone(k);Object.assign(doc.units[0],bad);assert.equal(validateKitchen(doc,plan),null);
}
assert(!applyKitchenCatalogEntry(base,plan,{section:'handle',id:'bar'},row).ok);
assert(!updateUnit(record(blank('upper'),'hood'),plan,'obj',{handleStyle:'bar'}).ok);
const fromLibrary=applyKitchenCatalogEntry(blank('upper'),plan,{section:'unit',id:'hood'},row,{u:55});assert(fromLibrary.ok);
assert.equal(fromLibrary.kitchen.units[0].kind,'hood');assert.equal(fromLibrary.kitchen.units[0].u,55);
const noGhost=ok(addUnit(record(blank('base'),'fridge'),plan,{kind:'storage',runId:'r',u:145,width:60}));
assert.deepEqual(kitchenGeometry(noGhost,plan).worktops.map(t=>[t.start,t.end]),[[145,205]]);
const short={width:360,length:300,height:150},shortRun=ok(addRun(createKitchen(short,'empty'),short,{id:'r',wall:'back',tier:'base',start:0,end:270}));
const blocked=addUnit(shortRun,short,{kind:'fridge',runId:'r',u:60});assert(!blocked.ok&&blocked.kitchen===shortRun);
// A window beside the narrow chimney is clear, even though the rectangular
// catalogue envelope overlaps it. Lowering that same opening onto the broad
// canopy is physically blocked. Test both orders and slot recommendations.
const upper=blank('upper'),hood=record(upper,'hood');
const highWin={id:'w',kind:'window',wall:'back',u:58,width:15,bottom:170,height:20};
const beside=addFeature(hood,plan,highWin);assert(beside.ok,beside.reason);
const atCanopy=addFeature(hood,plan,{...highWin,bottom:149,height:5});assert.equal(atCanopy.code,'body-feature');
const atChimney=addFeature(hood,plan,{...highWin,u:97});assert.equal(atChimney.code,'body-feature');
const beforeHood=ok(addFeature(upper,plan,highWin));assert(addUnit(beforeHood,plan,{kind:'hood',u:55,runId:'r'}).ok);
assert(availableKitchenSlots(beforeHood,plan,{kind:'hood',runId:'r'}).some(g=>g.start<=55&&55<=g.end));
console.log('Studio catalog: searchable cabinet/equipment and material families, actual sizes, independent physical meshes, tier/clearance/worktop constraints, style application, independent copies and safe snapshot persistence passed.');

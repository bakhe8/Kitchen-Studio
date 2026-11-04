// Regression checks for the 2026-11 deep audit: array-valued enums, prototype-named ids and recipes, and a measured
// upstand edge that sits a hair off the wall plane (the strip silently disappeared from the quote).
import assert from 'node:assert/strict';
import {ownKey,inheritedName} from '../public/kitchen-safe-keys.js';
import {createKitchen,addRun,addUnit,validateKitchen,kitchenGeometry} from '../public/kitchen-model.js';
import {makeChainExample} from '../public/kitchen-chain-model.js';
import {upsertFieldRecord} from '../public/kitchen-field-model.js';
import {recordReleaseIssues} from '../public/kitchen-field-release.js';
import {readWallOptions,applyWallOptions} from '../public/kitchen-chain-options.js';
import {seedCatalog,buildFactoryQuote} from '../public/kitchen-workshop-factory.js';
import {acceptPattern} from '../public/kitchen-surface-pattern.js';

// 1. Key guards. Object.hasOwn(table,['x']) is true because the array stringifies to 'x'.
assert.equal(ownKey({a:1},'a'),true);
assert.equal(ownKey({a:1},['a']),false,'an array must not pass as the key it stringifies to');
assert.equal(ownKey({a:1},{toString:()=>'a'}),false);
assert.equal(ownKey({a:1},'toString'),false);
for(const name of ['constructor','toString','valueOf','hasOwnProperty','isPrototypeOf','__proto__','prototype'])assert.equal(inheritedName(name),true,name);
for(const name of ['run-1','fr','unit-3','base'])assert.equal(inheritedName(name),false,name);
assert.equal(inheritedName(['constructor']),false);

// 2. A field record whose state is an array used to be stored as typed, then read as "not a conflict" by the release gate.
{
 const doc=makeChainExample();
 const record={id:'hold-1',inputCode:'SITE-17',itemId:'room',property:'عرض تركيب',unit:'مم',valueType:'number',value:570,source:'أداتان',execution:'required',shopCritical:true};
 const save=extra=>upsertFieldRecord(doc.room,{...record,verification:'conflict',...extra});
 const blocking=save({});assert(blocking.ok,blocking.reason);
 assert.equal(recordReleaseIssues({...doc,room:blocking.room}).length,1,'a recorded conflict blocks release');
 for(const bad of [{verification:['conflict']},{verification:['measured']},{execution:['excluded']},{flexibility:['fixed']},{verification:{conflict:true}}])
  assert.equal(save(bad).ok,false,'array/object enum values are refused: '+JSON.stringify(bad));
}

// 3. Ids that name inherited Object members resolve to functions in plain-object tables (rows[runId].units, catalog[recipe]).
{
 const room={width:500,length:500,height:280},base=createKitchen(room,'empty');
 const run=addRun(base,room,{id:'run-1',wall:'back',tier:'base',start:0,end:300});assert(run.ok,run.reason);
 assert(addUnit(run.kitchen,room,{id:'cab-1',kind:'storage',runId:'run-1',u:0,width:60}).ok,'control: an ordinary id is accepted');
 for(const id of ['constructor','toString','valueOf','hasOwnProperty','prototype']){
  assert.equal(addRun(base,room,{id,wall:'back',tier:'base',start:0,end:300}).ok,false,'run '+id);
  assert.equal(addUnit(run.kitchen,room,{id,kind:'storage',runId:'run-1',u:0,width:60}).ok,false,'unit '+id);
  const imported=structuredClone(run.kitchen);imported.runs[0].id=id;
  assert.equal(validateKitchen(imported,room),null,'an imported kitchen whose run is called '+id);
 }
 // a lighting recipe named toString used to resolve to Object.prototype.toString, so the quote read "complete" with no lights
 const d=makeChainExample(),options=readWallOptions(d,'back');
 const withRecipe=recipe=>applyWallOptions(d,'back',{...options,linearLight:{state:'factory',recipe,feeds:[]}});
 for(const recipe of ['toString','valueOf','hasOwnProperty'])assert.equal(withRecipe(recipe).ok,false,'lighting recipe '+recipe);
}

// 4. A measured upstand template edge sits within the inspector's fit tolerance of the wall, never exactly on it.
{
 const book=seedCatalog();
 book.items.push({...book.items.find(i=>i.kind==='panel'),sku:'STONE',name:'حجر العميل',kind:'panel',thicknessMm:20,stockLengthMm:3200,stockWidthMm:1600,role:'body',price:300,kerfMm:3,stockUnits:1});
 book.upstandProfiles=[{id:'U1',sku:'STONE',heightMm:100,reference:'رسم المصنع ١'}];book.approved=true;
 const upstand=(backEdgeMm,fitToleranceMm)=>{
  const run={id:'r',wall:'back',tier:'base',start:0,end:500,depth:60,height:80,bottom:6,worktopThicknessMm:40};
  const units=[['a','storage',0,90],['b','storage',90,90]].map(([id,kind,u,width])=>({id,kind,u,width,runId:'r'}));
  const project={room:{width:500,length:500,height:290,workshop:{upstand:{choice:{mode:'factory',profileId:'U1'},walls:{}}}},kitchen:{runs:[run],units,features:[]}};
  project.room.workshop.catalog=structuredClone(book);
  project.room.workshop.rows={r:{units:units.map(u=>({id:u.id,startMm:u.u*10,widthMm:u.width*10,family:'storage'})),catalogVersion:'1',warnings:[]}};
  const top=kitchenGeometry(project.kitchen,project.room).worktops[0];
  const accepted=acceptPattern(project,top,{source:'s',datum:'rear left',materialRef:'STONE',limitRef:'f',levelRef:'i',inspector:'x',date:'2026-10-28',
   fitToleranceMm,edgeGapMm:1,webMm:10,thicknessMm:40,outer:[[0,backEdgeMm],[1800,backEdgeMm],[1800,600],[0,600]],holes:[]});
  assert(accepted.ok,accepted.reason);
  const quote=buildFactoryQuote(accepted.doc);
  return {pieces:quote.pieces.filter(p=>p.family==='upstand').length,issues:quote.issues.length};
 };
 const exact=upstand(0,1);assert.equal(exact.pieces,2,'back strip and left strip');
 for(const offset of [0.0005,0.4,1])assert.deepEqual(upstand(offset,1),exact,'a measured edge '+offset+' mm off the wall plane still meets the wall');
 assert.equal(upstand(8,30).pieces,2,'within the contact cap');
 assert.equal(upstand(12,30).pieces,1,'an edge 12 mm off the wall is a real gap, not contact');
}
console.log('Audit regressions: array-valued enums refused, inherited-name ids and recipes refused, measured upstand edges keep their strip.');

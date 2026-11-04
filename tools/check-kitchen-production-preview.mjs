import assert from 'node:assert/strict';
import {productionPieceSource,reviewProductionPreview} from '../public/kitchen-production-preview.js';
import {makeQuoteReadyFixture} from './fixture-kitchen-quote-ready.mjs';
import {buildFactoryQuote,getFactoryCatalog,cleanCatalog} from '../public/kitchen-workshop-factory.js';
import {catalogRecordStates,normalizeWorkshopCatalogs} from '../public/kitchen-catalog-records.js';
import {machiningSheet,cleanPartOperations} from '../public/kitchen-machining.js';
import {approvalState} from '../public/kitchen-workshop-state.js';
import {manufacturingKeys} from '../public/kitchen-order-domain.js';
import {authorizeProjectChange} from '../public/kitchen-access-policy.js';
import {setFacePanel} from '../public/kitchen-finish-parts.js';
import {factorySpecialTargets,reviewSpecial} from '../public/kitchen-workshop-factory-special.js';
import {readWallOptions,applyWallOptions} from '../public/kitchen-chain-options.js';
import {saveProject,openKitchenProject,commitProject,undoProject,redoProject,storedKitchenProject} from '../public/kitchen-project.js';
import {worktopUpstandTakeoff,setUpstandWindowChoice} from '../public/kitchen-worktop-upstand.js';
import {createKitchen} from '../public/kitchen-model.js';
import {applyChain,newChainRow,readChainRange,attestChain} from '../public/kitchen-chain-model.js';
import {planWorkshopRow,applyWorkshopCorner} from '../public/kitchen-production-row.js';
import {approveScribe,scribeDatum} from '../public/kitchen-wall-scribe.js';
import {mountScribes} from '../public/kitchen-wall-scribe-ui.js';

const base=await makeQuoteReadyFixture(),clone=v=>structuredClone(v);
const operation={kind:'drill',machine:'CNC-1',reference:'TEST ONLY drill drawing',tolerance:.3,xFrom:'start',yFrom:'start',x:40,y:35,diameter:4,depth:3,length:0,width:0,angle:0,radius:0,minutes:2};
const machine={id:'CNC-1',name:'Test router',datum:'Test bottom left datum',skus:['BODY-6','FACE-6-W','FACE-6-G'],ops:['drill','mill','size','miter','bend'],maxLength:2000,maxWidth:1000,maxThickness:20,minTolerance:.2,clampMargin:5,maxAngle:90,minBendRadius:10,setupMin:15,dailyMin:450};
function fixture(withOperation=true){
 const doc=clone(base),factory=doc.room.workshop.factoryRecipes;
 factory.machining={strict:false,machines:[clone(machine)]};
 const line=factory.families.storage.recipe.find(l=>l.label==='قاعدة جسم');
 if(withOperation)line.operations=[clone(operation)];
 doc.room.workshop=normalizeWorkshopCatalogs(doc.room.workshop);assert(doc.room.workshop);
 assert.deepEqual(buildFactoryQuote(doc).machineIssues,[]);return doc;
}
const index=(doc,predicate=p=>p.family==='storage'&&p.label==='قاعدة جسم')=>buildFactoryQuote(doc).pieces.findIndex(predicate);
const command=(doc,op=operation,operationIndex=0,pieceIndex=index(doc))=>({pieceIndex,operationIndex,operation:op});
function freeze(v){if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
let groups=0;async function test(name,run){await run();groups++;console.log('PASS '+name);}

await test('actual recipe provenance resolves uniquely and cannot expose mutable source operations',()=>{
 const doc=fixture(),q=buildFactoryQuote(doc),i=index(doc),source=productionPieceSource(doc,i,q),raw=getFactoryCatalog(doc).families.storage.recipe;
 assert(source.editable,source.reason);assert.equal(source.family,'storage');assert.equal(source.line,raw.findIndex(l=>l.label==='قاعدة جسم'));
 assert.equal(source.label,q.pieces[i].label);assert.equal(source.reason,'');assert.deepEqual(source.operations,cleanPartOperations([operation]));
 source.operations[0].x=999;assert.equal(getFactoryCatalog(doc).families.storage.recipe[source.line].operations[0].x,40);
 assert.equal(productionPieceSource(doc,-1,q).editable,false);assert.equal(productionPieceSource(doc,1.5,q).editable,false);
 assert.equal(productionPieceSource(doc,100000,q).editable,false);
 assert.equal(productionPieceSource(doc,0,buildFactoryQuote(doc,{unitIds:[doc.kitchen.units[0].id]})).editable,false);
 const piece=index(doc,p=>p.kind==='piece');assert.equal(productionPieceSource(doc,piece,q).editable,false);
});

await test('operation preview is immutable and changes all real pieces using the shared recipe',()=>{
 const doc=fixture(),before=JSON.stringify(doc),old=buildFactoryQuote(doc),i=index(doc),source=productionPieceSource(doc,i),nextOp={...operation,x:60,minutes:3};freeze(doc);
 const out=reviewProductionPreview(doc,command(doc,nextOp)),q=buildFactoryQuote(out.doc);
 assert(out.changed);assert.notEqual(out.doc,doc);assert.equal(JSON.stringify(doc),before);
 assert.deepEqual(out.previousQuote,old);assert.deepEqual(out.quote,q);assert.equal(out.source.family,source.family);assert.equal(out.source.line,source.line);
 assert.deepEqual(out.operation,cleanPartOperations([nextOp])[0]);
 assert.deepEqual(out.affectedUnitIds,doc.kitchen.units.filter(u=>u.kind==='storage').map(u=>u.id));
 assert.equal(out.affectedPieceIndices.length,4);
 for(const at of out.affectedPieceIndices){assert.equal(q.pieces[at].label,'قاعدة جسم');assert.equal(q.pieces[at].operations[0].x,60);}
 assert(q.operations.filter(o=>out.affectedUnitIds.includes(o.unitId)).every(o=>o.ok&&o.x===60));
 assert.deepEqual(out.doc.kitchen,doc.kitchen);assert.deepEqual(out.doc.room.workshop.chains,doc.room.workshop.chains);
 assert.equal(q.total,old.total,'operation instructions do not invent machining charges');
});

await test('replacement, append and no-op preserve exact source identity and operation bounds',()=>{
 const doc=fixture(),noop=reviewProductionPreview(doc,command(doc));assert.equal(noop.doc,doc);assert.equal(noop.changed,false);
 const fresh=fixture(false),added=reviewProductionPreview(fresh,command(fresh));assert(added.changed);assert.equal(added.source.operations.length,0);
 const appended=reviewProductionPreview(doc,command(doc,{...operation,x:80,reference:'TEST second operation'},1));
 assert.equal(getFactoryCatalog(appended.doc).families.storage.recipe[appended.source.line].operations.length,2);
 for(const operationIndex of [-1,1.2,2,99])assert.throws(()=>reviewProductionPreview(doc,command(doc,operation,operationIndex)),Error);
 for(const op of [null,{},[],{...operation,x:'40'},{...operation,depth:NaN},{...operation,tolerance:0},{...operation,minutes:-1},{...operation,minutes:1441},{...operation,approved:true}])assert.throws(()=>reviewProductionPreview(doc,command(doc,op)),Error);
 for(const pieceIndex of [-1,1.5,9999])assert.throws(()=>reviewProductionPreview(doc,command(doc,operation,0,pieceIndex)),Error);
 assert.throws(()=>reviewProductionPreview(doc,{...command(doc),factoryRecipes:{}}),Error);
});

await test('a selected wide part cannot introduce an invalid operation on narrower peers',()=>{
 const doc=fixture(),i=index(doc),q=buildFactoryQuote(doc),op={...operation,x:480};
 assert(machiningSheet([{...q.pieces[i],operations:[op]}],getFactoryCatalog(doc)).operations[0].ok,'selected panel is wide enough');
 assert(q.pieces.some(p=>p.family==='storage'&&p.label==='قاعدة جسم'&&p.a<480));
 assert.throws(()=>reviewProductionPreview(doc,command(doc,op)),/حافة|الماسك|تشغيل/);
});

await test('repeated baseline error text cannot hide an invalid appended operation',()=>{
 const doc=fixture(),line=doc.room.workshop.factoryRecipes.families.storage.recipe.find(l=>l.label==='قاعدة جسم');line.operations[0].x=480;
 const before=buildFactoryQuote(doc);assert(before.machineIssues.length);
 const candidate=clone(doc);candidate.room.workshop.factoryRecipes.families.storage.recipe.find(l=>l.label==='قاعدة جسم').operations.push({...operation,x:490});
 assert.deepEqual(buildFactoryQuote(candidate).machineIssues,before.machineIssues,'the unsafe extra operation has only duplicate error text');
 assert.throws(()=>reviewProductionPreview(doc,command(doc,{...operation,x:490},1)),/حافة|الماسك|تشغيل/);
 const fixed=reviewProductionPreview(doc,command(doc));assert.deepEqual(fixed.quote.machineIssues,[]);
});

await test('actual material and machine constraints reject bad assignments and require external evidence',()=>{
 const doc=fixture();
 for(const op of [{...operation,machine:'missing'},{...operation,tolerance:.1},{...operation,depth:7},{...operation,x:1},{...operation,kind:'mill',length:100,width:100},{...operation,kind:'size',length:510,width:560},{...operation,machine:'external',provider:'',confirmation:''}]){
  assert.throws(()=>reviewProductionPreview(doc,command(doc,op)),Error);
 }
 const wrong=fixture();wrong.room.workshop.factoryRecipes.machining.machines[0].skus=['FACE-6-W'];
 assert.throws(()=>reviewProductionPreview(wrong,command(wrong,{...operation,x:50})),/معتمدة|تشغيل/);
 const tooSmall=fixture();tooSmall.room.workshop.factoryRecipes.machining.machines[0].maxLength=400;
 assert.throws(()=>reviewProductionPreview(tooSmall,command(tooSmall,{...operation,x:50})),/غلاف|تشغيل/);
 const external={...operation,machine:'external',provider:'Test subcontractor',confirmation:'TEST ONLY acceptance',leadDays:2};
 const out=reviewProductionPreview(doc,command(doc,external));assert(out.quote.operations.filter(o=>o.part==='قاعدة جسم').every(o=>o.ok&&o.machine==='external'));
});

await test('duplicate recipe lines and generated handle drilling are never mistaken for editable recipe operations',()=>{
 const duplicate=fixture(),recipe=duplicate.room.workshop.factoryRecipes.families.storage.recipe;recipe.push(clone(recipe.find(l=>l.label==='قاعدة جسم')));
 assert.equal(productionPieceSource(duplicate,index(duplicate)).editable,false);assert.throws(()=>reviewProductionPreview(duplicate,command(duplicate,{...operation,x:60})),/مصدر|متعدد|مطابقة/);
 const generated=fixture(),f=generated.room.workshop.factoryRecipes.families.storage;
 f.finishSlots={handle:{source:'PULL',labels:['يد'],skus:['PULL'],mode:'matching',reference:'TEST handle source',drilling:{target:'حشوة واجهة',models:{PULL:{machine:'CNC-1',reference:'TEST generated handle holes',tolerance:.3,xFrom:'start',yFrom:'start',x:45,y:60,diameter:4,depth:3,pitch:96,axis:'x'}}}}};
 assert(cleanCatalog(getFactoryCatalog(generated)));
 const q=buildFactoryQuote(generated),front=q.pieces.findIndex(p=>p.family==='storage'&&p.label==='حشوة واجهة');assert(q.pieces[front].operations.length===2);
 const source=productionPieceSource(generated,front,q);assert.equal(source.editable,false);assert.match(source.reason,/مولّد|تخريم|تشطيب/);
 assert.throws(()=>reviewProductionPreview(generated,command(generated,operation,0,front)),/مولّد|تخريم|تشطيب/);
});

await test('selected front SKU overrides still resolve the original recipe line when no operation is generated',()=>{
 let doc=fixture(),cat=getFactoryCatalog(doc),id=doc.kitchen.units.find(u=>u.kind==='storage').id;
 doc=setFacePanel(doc,cat,id,'FACE-6-G');
 const i=index(doc,p=>p.unitId===id&&p.sku==='FACE-6-G');assert(i>=0);
 const source=productionPieceSource(doc,i);assert(source.editable,source.reason);assert.equal(source.family,'storage');
 const out=reviewProductionPreview(doc,command(doc,operation,0,i));assert.equal(out.affectedUnitIds.length,4);
 assert(out.quote.operations.some(o=>o.unitId===id&&o.sku==='FACE-6-G'&&o.ok));
 assert(out.quote.operations.some(o=>o.unitId!==id&&o.sku==='FACE-6-W'&&o.ok));
});

await test('a real special sheet edits only its own line and preserves its measured signature',()=>{
 let doc=fixture();const options=readWallOptions(doc,'back');options.mode='two';options.cornice={enabled:true,heightMm:45,projectionMm:65,returns:true,reviewed:true};
 const applied=applyWallOptions(doc,'back',options);assert(applied.ok,applied.reason);doc=applied.doc;
 const target=factorySpecialTargets(doc).find(t=>t.kind==='cornice');assert(target);
 const sheet=reviewSpecial(target,{reviewer:'TEST reviewer',measurement:'TEST measured sheet',drawing:'TEST drawing',instructions:'TEST assembly instructions',lines:[{sku:'BODY-6',label:'TEST cornice part',a:400,b:200,count:2,operation:'TEST cut instructions'}]},getFactoryCatalog(doc).items);assert(sheet);
 doc.room.workshop.factoryRecipes.specials[target.id]=sheet;
 const i=index(doc,p=>p.unitId===target.id),source=productionPieceSource(doc,i);assert(source.editable,source.reason);assert.equal(source.specialId,target.id);assert.equal(source.line,0);
 assert.equal(source.step,'wallOptions');assert.deepEqual(source.focus,{wall:'back',op:'cornice/enabled'});
 const out=reviewProductionPreview(doc,command(doc,operation,0,i));
 assert.deepEqual(out.affectedUnitIds,[target.id]);assert.equal(out.affectedPieceIndices.length,1);
 assert.equal(out.doc.room.workshop.factoryRecipes.specials[target.id].signature,sheet.signature);
 assert.deepEqual(out.doc.room.workshop.factoryRecipes.families,doc.room.workshop.factoryRecipes.families);
 assert(out.quote.operations.some(o=>o.unitId===target.id&&o.ok));
});

await test('real generated support and stone pieces open their owning assembly without enabling inline edits',()=>{
 const doc=fixture(),ws=doc.room.workshop,items=ws.storeCatalog.items;
 items.push({...items.find(i=>i.sku==='HINGE'),sku:'TEST-LEG',name:'TEST leg'},
  {...items.find(i=>i.sku==='AL-20'),sku:'TEST-APRON',name:'TEST apron',sectionWidthMm:80,stockLengthMm:3000});
 ws.factoryRecipes.baseSupport={rules:{test:{family:'storage',mode:'legs',site:'any',default:true,minWidthMm:200,maxWidthMm:900,bodyClearMm:80,apron:'test',count:4,sku:'TEST-LEG',supply:'assembly',reference:'TEST base drawing',label:'TEST support'}},aprons:{test:{sku:'TEST-APRON',label:'TEST apron',heightMm:80,thicknessMm:3,insetMm:40,reference:'TEST apron drawing',fixing:'separate',clipSku:'HINGE',clipsPerUnit:2}}};
 ws.factoryRecipes.upstandProfiles=[{id:'TEST-STONE',sku:'BODY-6',heightMm:100,reference:'TEST stone drawing'}];
 ws.upstand={choice:{mode:'factory',profileId:'TEST-STONE'},walls:{}};
 const q=buildFactoryQuote(doc);assert(worktopUpstandTakeoff(doc,getFactoryCatalog(doc)).pieces.length);
 for(const family of ['baseSupport','baseApron','upstand']){
  const i=q.pieces.findIndex(p=>p.family===family);assert(i>=0,family+' actual quote piece');
  const p=q.pieces[i],source=productionPieceSource(doc,i,q);assert.equal(source.editable,false);assert.equal(source.step,'assembly');
  assert.deepEqual(source.focus,family==='upstand'?{section:'stone',wall:p.runId}:{section:'base',runId:p.runId,unitId:p.unitId});
  assert.throws(()=>reviewProductionPreview(doc,{pieceIndex:i,operationIndex:0,operation}),Error);
 }
});

await test('a real reviewed horizontal sill opens the exact window decision',()=>{
 const catalog=clone(getFactoryCatalog(fixture()));catalog.upstandProfiles=[{id:'TEST-STONE',sku:'BODY-6',heightMm:100,reference:'TEST stone profile'}];
 const run={id:'r',wall:'back',tier:'base',start:10,end:230,depth:60,height:86,bottom:0,worktopThicknessMm:40};
 const doc={room:{width:380,length:360,height:290,workshop:{catalog,upstand:{choice:{mode:'factory',profileId:'TEST-STONE'},walls:{}}}},kitchen:{runs:[run],units:[{id:'a',runId:'r',kind:'storage',u:10,width:100},{id:'b',runId:'r',kind:'storage',u:110,width:120}],features:[{id:'window-B',kind:'window',wall:'back',u:100,width:75,bottom:90,height:80,depth:4,swing:'in',hinge:'right',leafWidth:71,hingeInset:2}]}};
 const window=worktopUpstandTakeoff(doc,catalog).windows.find(w=>w.windowId==='window-B');assert(window);
 const made=setUpstandWindowChoice(doc,catalog,window.key,{kind:'gap',sill:{mode:'factory',sku:'BODY-6',depthMm:65,lengthMm:685,insetStartMm:30,reference:'TEST sill measurement',verified:true}});assert(made.ok,made.reason);
 const q=buildFactoryQuote(made.doc),at=q.pieces.findIndex(p=>p.family==='windowSill');assert(at>=0,'actual full quote includes the reviewed sill');
 const source=productionPieceSource(made.doc,at,q);assert.equal(source.editable,false);assert.equal(source.step,'assembly');assert.deepEqual(source.focus,{section:'stone',wall:'back',windowId:'window-B'});
});

function surveyedEmpty(catalog,{gap=false}={}){
 const room={width:500,length:500,height:280};let doc={room:{...room,workshop:{catalog}},kitchen:createKitchen(room,'empty')};
 for(const wall of ['back','left','right']){
  const mk=(kind,id,gapMm)=>({...newChainRow(kind,id),gapMm});
  const raw={source:'field',rows:gap&&wall==='back'?[mk('start','start',50),mk('stop','stop',4900),mk('corner','end',50)]:[mk('corner','end',5000)]};
  const signed=attestChain(doc,wall,raw,{name:'TEST surveyor',reference:'TEST drawing'});assert(signed.ok,signed.reason);
  const out=applyChain(doc,wall,signed.chain);assert(out.ok,out.reason);doc=out.doc;
 }return doc;
}
await test('actual scribe source selects only its exact stored measurements in the owning trims editor',()=>{
 const cat=clone(getFactoryCatalog(fixture()));
 cat.scribePolicies={FJ:{name:'TEST scribe',reference:'TEST-FJ',grain:'vertical',sku:'BODY-6',minimumBlankMm:45,minimumLipMm:15,maxStripMm:100,roughAllowanceMm:2,spacingMm:300,cutToleranceMm:.4,minGapMm:1,targetGapMm:2,maxGapMm:3,machine:'traceCut'}};
 cat.machining.machines.push({...machine,id:'traceCut',ops:['size','scribe'],maxLength:4000,maxWidth:2000,maxThickness:60,minTolerance:.1,clampMargin:0});
 assert(cleanCatalog(cat));let doc=surveyedEmpty(cat,{gap:true});
 const planned=planWorkshopRow(doc,{...readChainRange(doc,'back'),tier:'base',wanted:{}});assert(planned.ok,planned.reason);doc=planned.doc;
 const first=doc.kitchen.units.toSorted((a,b)=>a.u-b.u)[0];
 const draft={unitId:first.id,against:'left',recipe:'FJ',kind:'end',side:'start',plinthHeightMm:0,insetMm:0,accuracyMm:.5,reference:'TEST focused trace',reviewer:'TEST reviewer',linearVerified:true};
 const datum=scribeDatum(doc,'back',draft,cat);assert(datum.ok,datum.reason);
 const saved=approveScribe(doc,'back',{...draft,stations:[[0,2],[200,-4],[400,3],[600,1],[datum.span,0]]},cat);assert(saved.ok,saved.reason);doc=saved.doc;
 const q=buildFactoryQuote(doc),at=q.pieces.findIndex(p=>p.scribe);assert(at>=0);const source=productionPieceSource(doc,at,q);
 assert.equal(source.editable,false);assert.equal(source.step,'factory');assert.deepEqual(source.focus,{tab:'trims',unitId:first.id,wall:'back',anchor:q.pieces[at].scribe.anchor});
 const mount=focus=>{const host={innerHTML:'',querySelector(){return null;}};mountScribes(host,{getDoc:()=>doc,read:()=>getFactoryCatalog(doc),apply(){throw Error('mount cannot save');},update(){throw Error('mount cannot update');},download(){},focus});return host.innerHTML;};
 const html=mount(source.focus);assert.match(html,/value="TEST focused trace"/);assert.match(html,/0, 2\n200, -4/);
 assert(!mount({...source.focus,anchor:'0'.repeat(64)}).includes('value="TEST focused trace"'),'stale anchor does not silently open another row');
 assert(!mount({...source.focus,wall:'right'}).includes('value="TEST focused trace"'),'wrong wall cannot select the matching unit row');
 doc.room.workshop.options.back.scribes.push(clone(doc.room.workshop.options.back.scribes[0]));
 assert(!mount(source.focus).includes('value="TEST focused trace"'),'ambiguous identity cannot silently select the first row');
});

await test('real generated corner parts open their exact corner rather than a coincidentally named family',()=>{
 const cat=clone(getFactoryCatalog(fixture()));cat.items.push(...['TEST-CORNER-KIT','TEST-SHELF-KIT'].map(sku=>({...cat.items.find(i=>i.sku==='PULL'),sku,name:sku})));
 cat.cornerRecipes={B90:{frontSkus:['FACE-6-G'],label:'TEST corner',reference:'TEST corner drawing',tier:'base',bodySku:'BODY-6',frontSku:'FACE-6-W',shelfSku:'BODY-6',edgeSku:'EDGE',hingeSku:'HINGE',handleSku:'PULL',bodyKit:'TEST-CORNER-KIT',shelfKit:'TEST-SHELF-KIT',revealMm:2,shelfSetbackMm:15,edgeBuildMm:1,maxSpanMm:1300,maxDoorWidthMm:620,maxDoorHeightMm:900,hingesPerDoor:3}};
 assert(cleanCatalog(cat));const empty=surveyedEmpty(cat),base={aMm:1050,bMm:950,inside:'shelves',access:'a',sku:'',body:{depthAMm:550,depthBMm:500,bottomMm:0,heightMm:800,reference:'TEST site'},build:{recipe:'B90',mode:'connected',through:'a',arms:{a:{use:'TEST A',shelves:[200,450]},b:{use:'TEST B',shelves:[360]}}}};
 const made=applyWorkshopCorner(empty,'back+left',{a:'back',b:'left',tall:false,base});assert(made.ok,made.reason);
 const q=buildFactoryQuote(made.doc),at=q.pieces.findIndex(p=>p.cornerCut);assert(at>=0);
 const source=productionPieceSource(made.doc,at,q);assert.equal(source.editable,false);assert.equal(source.step,'corner');assert.deepEqual(source.focus,{joint:'back+left'});
});

await test('factory ownership, independent approvals and physical manufacturing keys follow real domain edits',async()=>{
 let doc=fixture();for(const kind of ['structure','customer','release']){
  const state=await approvalState(doc);doc.room.workshop.approvals={...doc.room.workshop.approvals,[kind]:{key:state.keys[kind],name:'TEST ONLY '+kind,date:'2026-11-04T00:00:00.000Z'}};
 }
 const before=await approvalState(doc);assert(before.valid.release);
 const out=reviewProductionPreview(doc,command(doc,{...operation,x:60})),after=await approvalState(out.doc);
 const oldRecords=catalogRecordStates(doc.room.workshop),records=catalogRecordStates(out.doc.room.workshop);
 assert.equal(records.factory.revision,oldRecords.factory.revision+1);assert.equal(records.factory.approved,false);
 assert.deepEqual(records.store,oldRecords.store);assert.deepEqual(records.pricing,oldRecords.pricing);
 assert.equal(out.doc.room.workshop.catalogMeta.layoutRevision,doc.room.workshop.catalogMeta.layoutRevision);
 assert.equal(after.valid.structure,false);assert.equal(after.valid.customer,false);assert.equal(after.valid.release,false);
 assert.deepEqual(out.doc.room.workshop.approvals,doc.room.workshop.approvals);
 const oldKeys=manufacturingKeys(doc),newKeys=manufacturingKeys(out.doc);
 for(const id of out.affectedUnitIds)assert.notEqual(newKeys[id],oldKeys[id]);
 for(const id of Object.keys(oldKeys).filter(id=>!out.affectedUnitIds.includes(id)))assert.equal(newKeys[id],oldKeys[id]);
 assert(authorizeProjectChange('factory',{design:doc},{design:out.doc}).ok);
 assert.equal(authorizeProjectChange('rep',{design:doc},{design:out.doc}).ok,false);
 assert.equal(authorizeProjectChange('store',{design:doc},{design:out.doc}).ok,false);
});

await test('unrelated existing machine problems do not prevent a valid source correction',()=>{
 const doc=fixture(),sink=doc.room.workshop.factoryRecipes.families.sink.recipe.find(l=>l.sku==='BODY-6');sink.operations=[{...operation,x:1}];
 const q=buildFactoryQuote(doc);assert(q.machineIssues.length);
 const out=reviewProductionPreview(doc,command(doc,{...operation,x:60}));assert.deepEqual(out.quote.machineIssues,q.machineIssues);
 const broken=fixture();broken.room.workshop.storeCatalog.items[0].price=-1;
 assert.equal(productionPieceSource(broken,0).editable,false);assert.throws(()=>reviewProductionPreview(broken,command(doc)),/كتالوج|سجل/);
});

class Store {constructor(){this.data=new Map();this.fail=false;}get length(){return this.data.size;}key(i){return [...this.data.keys()][i]??null;}getItem(k){return this.data.get(k)??null;}setItem(k,v){if(this.fail)throw Error('Storage denied');this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
await test('real project save/reopen/undo/redo preserve operation instructions and independent record ownership',()=>{
 assert(saveProject(fixture()));const before=openKitchenProject(),out=reviewProductionPreview(before,command(before,{...operation,x:60}));
 const saved=commitProject(before,out.doc);assert(saved.ok&&saved.saved,saved.reason);
 assert.deepEqual(buildFactoryQuote(storedKitchenProject()),out.quote);
 const undone=undoProject(saved.next);assert(undone?.saved);assert.equal(buildFactoryQuote(undone.next).operations.find(o=>o.part==='قاعدة جسم').x,40);
 const redone=redoProject(undone.next);assert(redone?.saved);assert.deepEqual(buildFactoryQuote(redone.next),out.quote);
 const oldText=localStorage.getItem('atlas-kitchen:project:v1'),next=reviewProductionPreview(redone.next,command(redone.next,{...operation,x:80}));localStorage.fail=true;
 const failed=commitProject(redone.next,next.doc);assert.equal(failed.ok,false);assert.equal(localStorage.getItem('atlas-kitchen:project:v1'),oldText);localStorage.fail=false;
 const current=openKitchenProject(),pending=reviewProductionPreview(current,command(current,{...operation,x:80}));localStorage.setItem('atlas-kitchen:project:v1',localStorage.getItem('atlas-kitchen:project:v1')+' ');
 assert.equal(commitProject(current,pending.doc).code,'stale-project');assert.equal(buildFactoryQuote(storedKitchenProject()).operations.find(o=>o.part==='قاعدة جسم').x,60);
});

console.log(`Production preview: ${groups} groups passed.`);

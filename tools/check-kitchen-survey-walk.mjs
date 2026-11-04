import {hasLegacySampleLayout} from '../public/kitchen-preset-recovery.js';
import {makeFurnishedSaudiRoom} from '../public/kitchen-room-presets.js';
// Mount the same sequential visit controller used by the browser. A wall
//'s position in the tour is independent of the customer's cabinet scope.
import assert from 'node:assert/strict';
import {commitProject,newSurveyProject,restoreProject,saveProject,undoProject} from '../public/kitchen-project.js';
import {mountOutlineWallEntry} from '../public/kitchen-outline-wall-entry.js';
import {mountChainStep} from '../public/kitchen-chain-ui.js';
import {readChainRange} from '../public/kitchen-chain-model.js';
import {roomArchitecture} from '../public/kitchen-architecture.js';

class View {
  html='';handlers={};nodes=new Map();
  set innerHTML(v){this.html=v;}
  get innerHTML(){return this.html;}
  querySelector(q){
    if(!/^\[data-(?:survey-elevation|chain-summary|chain-notice|chain-state|chain-position=|chain-prop=|chain-map)/.test(q))return null;
    if(!this.nodes.has(q))this.nodes.set(q,{textContent:'',innerHTML:'',classList:{toggle(){}},querySelector(){return null;},focus:()=>this.focus=q,select(){},scrollIntoView(){}});
    return this.nodes.get(q);
  }
  addEventListener(name,handler){this.handlers[name]=handler;}
  removeEventListener(name){delete this.handlers[name];}
  event(type,dataset={},attrs=[],value=''){
    const target={tagName:type==='click'?'BUTTON':type==='input'?'INPUT':'SELECT',dataset,value,closest:()=>target,hasAttribute:a=>attrs.includes(a)};
    this.handlers[type]({target});
  }
  select(wall){this.event('click',{surveyWallId:wall});}
  act(action){this.event('click',{chainAct:action});}
  add(k){this.event('click',{addReading:k},['data-add-reading']);}
  input(k,v){this.event('input',{chainProp:k},[],v);}
  sign(attr,v){this.event('input',{},[attr],v);}
}
const view=new View(),route=[];
globalThis.requestAnimationFrame=fn=>{queueMicrotask(fn);return 1;};globalThis.cancelAnimationFrame=()=>{};
let doc=newSurveyProject({widthMm:5000,lengthMm:4700,heightMm:2800,name:'قياس'}, {getItem(){return null;}});
let writes=0,decline=false;
const api={getDoc:()=>doc,apply:next=>{
  if(decline)return {ok:false,reason:'تعذّر الحفظ'};
  writes++;doc=next;return {ok:true,saved:true};
},onAdvance:(...a)=>route.push(a)};
let control=mountChainStep(view,api);
view.act('tools');assert.doesNotMatch(view.html,/data-chain-act="demo"/);
view.act('demo');view.act('demo-apply');assert.equal(writes,0);
view.act('tools');
assert.match(view.html,/الجدار ١ من ٤/);
assert.deepEqual(control.commandContext(),{wall:'back'});
view.select('right');assert.deepEqual(control.commandContext(),{wall:'right'});view.add('corner');assert.match(view.html,/data-chain-prop="gapMm" value=""/);
view.input('gapMm','٤٦٩٩');view.select('back');
view.add('door');view.add('window');
assert.equal(view.focus,'[data-chain-prop="gapMm"]');assert.doesNotMatch(view.html,/data-chain-row="1"/);
view.input('gapMm','٤٠٠');view.add('window');assert.equal(view.focus,'[data-chain-prop="widthMm"]');
assert.doesNotMatch(view.html,/data-chain-row="1"/);view.input('widthMm','٩٠٠');
view.add('window');view.input('gapMm','٧٠٠');view.input('widthMm','١٢٠٠');
view.event('click',{chainHit:'0',chainFocus:'widthMm'});assert.equal(view.focus,'[data-chain-prop="widthMm"]');
view.add('water');assert.match(view.html,/من الطرف الخارجي البعيد للشباك إلى مركز مخرج الماء/);
view.input('gapMm','٢٠٠');view.add('stop');view.input('gapMm','٣٠٠');
view.add('corner');view.input('gapMm','١٢٩٠');await Promise.resolve();
view.act('next-wall');assert.equal(writes,0);assert.match(view.querySelector('[data-chain-notice]').textContent,/إغلاق/);
view.input('gapMm','١٣٠٠');await Promise.resolve();
decline=true;view.act('next-wall');assert.equal(writes,0);assert.match(view.html,/الجدار ١ من ٤/);
decline=false;view.act('next-wall');assert.equal(writes,1);
assert.match(view.html,/الجدار ٢ من ٤/);assert.match(view.html,/data-chain-prop="gapMm" value="4699"/);
assert.equal(doc.room.workshop.activeWall,'right');assert(!doc.room.workshop.chains.right);
const range=readChainRange(doc,'back');assert(range.closed);assert.equal(range.endMm,3700);
assert.deepEqual(range.readings.map(r=>[r.kind,r.refMm,r.nextMm]),[['door',400,1300],['window',2000,3200],['water',3400,3400],['stop',3700,3700],['corner',5000,5000]]);
assert.equal(doc.room.workshop.chains.back.attestation,undefined);
view.input('gapMm','٤٧٠٠');await Promise.resolve();view.act('next-wall');
assert.equal(writes,2);assert.match(view.html,/الجدار ٣ من ٤/);
assert.deepEqual(doc.room.workshop.chains.right.rows.map(r=>r.kind),['corner']);assert.equal(doc.room.workshop.activeWall,'front');
view.act('next-wall');assert.equal(writes,2);assert.match(view.html,/الجدار ٤ من ٤/);
view.act('next-wall');assert.match(view.html,/مراجعة رفع الجدران/);assert.deepEqual(control.commandContext(),{});assert.match(view.html,/إغلاق الركن مطابق/);
view.act('finish-walk');assert.deepEqual(route.pop(),['decisions',{chooseWalls:true}]);
assert.equal(doc.room.workshop.decisionReview,undefined);
view.select('right');view.act('tools');view.act('proof');view.sign('data-chain-technician','فني');
view.act('next-wall');assert.match(view.html,/الجدار ٢ من ٤/);assert.equal(writes,2);
view.act('discard-proof');view.act('next-wall');assert.match(view.html,/الجدار ٣ من ٤/);
control.destroy();control=mountChainStep(view,api);assert.match(view.html,/الجدار ٣ من ٤/);
control.destroy();

const polygon=structuredClone(doc);delete polygon.room.workshop;polygon.kitchen.features=[];
polygon.room.architecture={wallThickness:20,cut:{kind:'notch',corner:'back-right',width:70,depth:80}};
const walls=roomArchitecture(polygon.room).walls;
assert(walls.length>4);doc=polygon;control=mountChainStep(view,api);
for(let i=0;i<walls.length;i++){
 assert.match(view.html,new RegExp('value="'+walls[i].id+'" selected'));
 view.act('next-wall');
}
assert.match(view.html,/مراجعة رفع الجدران/);assert.match(view.html,/data-chain-act="finish-walk"[^>]*disabled/);
assert.equal(writes,2);view.act('finish-walk');assert.equal(route.length,0);
control.destroy();
console.log('Ordered perimeter follows rectangular and return walls, measures frame/centre/stop/corner separately, persists strict single-wall progress, retains other unfinished readings, skips without phantom walls or approvals, routes explicit cabinet scope.');

const child=new View(),baseChain={source:'drawing',rows:[]},childSaves=[];
let childCloses=0;
const childApi={
 lengthMm:5000,heightMm:2800,chain:baseChain,wallLabel:'الجدار ١',
 onSave:value=>{childSaves.push(value);},onClose:()=>childCloses++
};
const localEntry=mountOutlineWallEntry(child,childApi);
assert.match(child.html,/الجدار ١/);
assert.doesNotMatch(child.html,/data-chain-act="(?:next-wall|options|demo|attest|tools|review|save|finish-walk)"/);
assert.doesNotMatch(child.html,/data-chain-wall|data-chain-map/);
child.add('door');child.input('gapMm','٤٠٠');child.input('widthMm','٩٠٠');
child.add('water');child.input('gapMm','٧٠٠');await Promise.resolve();
child.act('close-face');assert.equal(childCloses,0);assert.match(child.html,/تجاهل تعديلات هذا الجدار/);
child.act('stay');
child.add('corner');child.input('gapMm','٢٩٩٩');await Promise.resolve();
child.act('save-face');assert.equal(childSaves.length,0);assert.match(child.querySelector('[data-chain-notice]').textContent,/إغلاق/);
child.input('gapMm','٣٠٠٠');await Promise.resolve();child.act('save-face');
assert.equal(childSaves.length,1);assert.equal(childSaves[0].source,'drawing');
assert.deepEqual(childSaves[0].rows.map(r=>[r.kind,r.gapMm]),[['door',400],['water',700],['corner',3000]]);
assert(!childSaves[0].rows.some(r=>r.featureId));assert(!childSaves[0].attestation);
assert.deepEqual(baseChain,{source:'drawing',rows:[]});assert.equal(writes,2);
child.select(0); // Map selection is unavailable in this isolated face.
child.event('click',{chainRow:'0'});child.act('reading-details');child.input('gapMm','٤٠١');await Promise.resolve();
assert.equal(localEntry.requestLeave(()=>childCloses++),false);
child.act('leave-discard');assert.equal(childCloses,1);assert.equal(childSaves.length,1);
localEntry();assert.deepEqual(child.handlers,{});
const shortWall=mountOutlineWallEntry(child,{...childApi,lengthMm:450});
child.add('corner');child.input('gapMm','٤٥٠');await Promise.resolve();child.act('save-face');assert.equal(childSaves.at(-1).rows[0].gapMm,450);
shortWall();
doc=polygon;const review=mountChainStep(view,{...api,focus:{review:true}});assert.match(view.html,/مراجعة رفع الجدران/);review.destroy();
console.log('Pre-closure single-wall plane retains physical mm including short returns, never writes CAD or field approval, checks typed corner, explicitly guards unsaved readings and supports final review without a second tour.');

// A later CAD drawing must not vanish from a wall which already has readings.
const {addFeature}=await import('../public/kitchen-model.js');
doc=newSurveyProject({widthMm:5000,lengthMm:4700,heightMm:2800,name:'جدار مختلط'}, {getItem(){return null;}});
const mixed=()=>view.querySelector('[data-survey-elevation]').innerHTML;
control=mountChainStep(view,api);
view.add('water');view.input('gapMm','٤٠٠');view.act('save');
control.destroy();
for(const spec of [{kind:'window',id:'window-from-cad',wall:'back',u:200,width:90,bottom:100,height:100},
  {kind:'electric',id:'socket-from-cad',wall:'back',u:330,width:8,bottom:95,height:10},
  {kind:'door',id:'other-wall-only',wall:'right',u:20,width:80,height:200}]){
 const a=addFeature(doc.kitchen,doc.room,spec);assert(a.ok,a.reason);doc={...doc,kitchen:a.kitchen};
}
control=mountChainStep(view,api);
assert(mixed().includes('data-cad-reference="window-from-cad"'),'unlinked window on measured wall is drawn as an independent reference');
assert(mixed().includes('data-cad-reference="socket-from-cad"'));assert(!mixed().includes('other-wall-only'));
assert.equal((mixed().match(/class="wsheet-item/g)||[]).length,1);
assert.equal((mixed().match(/data-cad-reference=/g)||[]).length,2);
assert.deepEqual(doc.room.workshop.chains.back.rows.map(r=>r.kind),['water']);
view.add('stop');view.input('gapMm','٢٥٠٠');view.act('save');control.destroy();
const storage=new Map();globalThis.localStorage={setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)??null};
assert(saveProject(doc));doc=restoreProject();control=mountChainStep(view,api);
assert(mixed().includes('data-cad-reference="window-from-cad"')&&mixed().includes('data-cad-reference="socket-from-cad"'));
assert.deepEqual(doc.room.workshop.chains.back.rows.map(r=>r.kind),['water','stop']);
assert.equal(doc.kitchen.features.filter(f=>f.id==='window-from-cad').length,1);
assert.equal(doc.kitchen.features.filter(f=>f.id==='socket-from-cad').length,1);
view.select('right');assert.match(view.html,/استخدام عناصر الرسم للرفع/);
view.add('water');assert(mixed().includes('data-cad-reference="other-wall-only"'),'original CAD door stays visible while typing the first manual reading');
view.input('gapMm','١٥٠٠');view.act('save');assert.deepEqual(doc.room.workshop.chains.right.rows.map(r=>r.kind),['water']);
assert(mixed().includes('data-cad-reference="other-wall-only"'));
control.destroy();
console.log('Measured and CAD-only items share the wall paper without duplication, cross-wall leakage or implicit adoption after saving and reopening.');

// Older indoor templates never recorded that they had supplied the units.
// Offer one explicitly confirmed transaction only for the unchanged matching furniture.
globalThis.sessionStorage={getItem:k=>storage.get('session:'+k)??null,setItem:(k,v)=>storage.set('session:'+k,v)};
doc=makeFurnishedSaudiRoom('villa');saveProject(doc);doc=restoreProject();
assert(hasLegacySampleLayout(doc));
const authored=structuredClone(doc);authored.kitchen.units[0].frontColor='#616253';assert(!hasLegacySampleLayout(authored));
assert(!hasLegacySampleLayout({...doc,room:{...doc.room,workshop:{approvals:{}}}}));
assert(!hasLegacySampleLayout({...doc,room:{...doc.room,fieldRegister:{records:[{itemId:doc.kitchen.units[0].id}]}}}));
let saves=0;
const legacyApi={getDoc:()=>doc,apply:next=>{const r=commitProject(doc,next);if(r.changed&&r.saved){saves++;doc=next;}return r;}};
control=mountChainStep(view,legacyApi);view.act('tools');assert.match(view.html,/بدء الرفع بدون دواليب المثال/);
view.act('adopt');view.event('click',{chainRow:'0'});view.act('reading-details');view.input('gapMm','٢٧٤٠');await Promise.resolve();
view.act('recover-layout');assert.equal(saves,0);assert.doesNotMatch(view.html,/data-chain-act="recover-confirm"/);
view.act('save');assert.equal(saves,1);
assert.doesNotMatch(view.querySelector('[data-chain-summary]').innerHTML,/sv-design-note/);
const bef=structuredClone(doc);assert.equal(bef.kitchen.features.find(f=>f.kind==='window').u,274);
view.act('recover-layout');assert.match(view.html,/data-chain-act="recover-confirm"/);view.act('cancel');view.act('recover-confirm');assert.equal(saves,1);
view.act('recover-layout');view.act('recover-confirm');assert.equal(saves,2);assert.deepEqual(doc.kitchen.runs,[]);assert.deepEqual(doc.kitchen.units,[]);
assert.deepEqual(doc.room,bef.room);assert.deepEqual(doc.kitchen.features,bef.kitchen.features);assert.equal(doc.kitchen.nextId,bef.kitchen.nextId);
view.act('tools');assert.doesNotMatch(view.html,/data-chain-act="recover-layout"/);
const fromDisk=restoreProject();assert(!fromDisk.kitchen.units.length);assert.equal(fromDisk.kitchen.features.find(f=>f.kind==='window').u,274);
const undone=undoProject(fromDisk);assert(undone.saved);assert.deepEqual(undone.next.kitchen,bef.kitchen);assert.deepEqual(undone.next.room.workshop.chains,bef.room.workshop.chains);
control.destroy();
console.log('Existing furnished villa: unfinished measurement guarded, edited and linked layouts excluded, exact survey and opening preserved on explicit removal and reload, original cabinets recoverable in one undo.');

import assert from 'node:assert/strict';
import {traceWallWalk,wallsFromVertices} from '../public/kitchen-outline-walk.js';
import {readPerimeterDraft,clearPerimeterDraft,openPerimeterDraftSession} from '../public/kitchen-perimeter-draft.js';
import {parseMeasuredOutline} from '../public/kitchen-measured-outline.js';
import {roomArchitecture} from '../public/kitchen-architecture.js';
import {newChainRow,readChainRange} from '../public/kitchen-chain-model.js';
import {outlineSurveyDocument,mountMeasuredOutline} from '../public/kitchen-measured-outline-ui.js';

// Web Locks (navigator.locks) is what stops a second open tab from writing over the perimeter checkpoint.
// Node 22 ships no implementation, so without this stand-in the check fails on the supported runtime (engines >= 22.13)
// for a reason that has nothing to do with the product. Browsers in a secure context provide the real thing.
if(!globalThis.navigator?.locks){const held=new Set();Object.defineProperty(globalThis.navigator,'locks',{configurable:true,value:{
 async request(name,options,callback){if(typeof options==='function'){callback=options;options={};}
  if(held.has(name)){if(options.ifAvailable)return callback(null);throw Error('lock shim: only ifAvailable requests are supported');}
  held.add(name);try{return await callback({name,mode:'exclusive'});}finally{held.delete(name);}}}});}

const list=(...entries)=>entries.map(([length,direction,angle])=>({length,direction,angle}));
const rectangle=list(['٥٠٠٠','right'],['٤١٠٠','front'],['٥٠٠٠','left'],['٤١٠٠','back']);
const meta={unit:'mm',reference:'رفع ميداني تجريبي',heightMm:2800};
const parsed=rows=>{const t=traceWallWalk(rows);assert(t.closed,t.reason);return parseMeasuredOutline({...meta,vertices:t.vertices});};
assert.deepEqual(roomArchitecture(parsed(rectangle).room).walls.map(w=>w.length),[500,410,500,410]);
const near=traceWallWalk([...rectangle.slice(0,3),{direction:'back',length:'٤٠٩٩٫٩'}]);
assert(!near.closed&&near.complete&&near.vertices.length===0);assert(Math.abs(near.residualMm-.1)<1e-9);
const gap=traceWallWalk(rectangle.slice(0,3));assert(!gap.closed);assert.equal(gap.residualMm,4100);assert.equal(gap.points.length,4);
assert(!traceWallWalk(list([5000,''],[4100,'front'])).complete);
assert(!traceWallWalk(list([800,'bearing',''],[900,'front'])).complete);
assert(!traceWallWalk(list([800,'bearing','٣٦١'],[900,'front'])).complete);
const rotatedStart=list([4100,'front'],[5000,'left'],[4100,'back'],[5000,'right']);
assert.deepEqual(parsed(rotatedStart).room.architecture.outline.vertices[0],{id:'poly-01',x:500,z:0});
const oblique=list([4000,'right'],[Math.SQRT2*1000,'bearing','٤٥'],[3000,'front'],[5000,'left'],[4000,'back']);
const polygon=parsed(oblique);assert(polygon.ok,polygon.reason);
const restored=wallsFromVertices(polygon.room.architecture.outline.vertices);
assert.equal(restored[1].direction,'bearing');assert(Math.abs(Number(restored[1].angle)-45)<1e-8);
const again=parsed(restored);assert(again.ok);
const notch=list([5000,'right'],[4200,'front'],[1800,'left'],[1200,'back'],[1100,'left'],[1200,'front'],[2100,'left'],[4200,'back']);
assert.equal(roomArchitecture(parsed(notch).room).walls.length,8);
assert.equal(parsed(list([4100,'front'],[5000,'right'],[4100,'back'],[5000,'left'])).ok,false);
assert.equal(parsed(list([5000,'right'],[4100,'front'],[5000,'left'],[1000,'back'],[3100,'back'])).ok,false);


// Surveying the first physical leg needs no second leg or polygon. These are
// local readings returned by an interim face and only merged into final geometry here.
const firstFace={lengthMm:5000,heightMm:2800,chain:{source:'drawing',rows:[
 {...newChainRow('door','door1'),gapMm:400,widthMm:900,swing:'out',hinge:'left'},
 {...newChainRow('electric','e1'),gapMm:300,bottomMm:1150},
 {...newChainRow('corner','corner1'),gapMm:3400}
]}};
const room=parsed(rectangle).room,visits=new Map([['poly-01',firstFace]]);
const loaded=outlineSurveyDocument(room,visits);assert(loaded.ok,loaded.reason);
assert(!loaded.allEntered);assert.equal(loaded.doc.room.workshop.activeWall,'poly-02');assert.equal(loaded.doc.kitchen.features.length,2);
const actual=readChainRange(loaded.doc,'poly-01');assert.deepEqual(actual.readings.map(r=>[r.kind,r.refMm,r.nextMm]),[['door',400,1300],['electric',1600,1600],['corner',5000,5000]]);
assert(!room.workshop);assert(!loaded.doc.room.workshop.chains['poly-02']);assert.equal(loaded.doc.room.workshop.chains['poly-01'].attestation,undefined);
for(const id of ['poly-02','poly-03','poly-04']){
 const len=roomArchitecture(room).walls.find(w=>w.id===id).length*10;
 visits.set(id,{lengthMm:len,heightMm:2800,chain:{source:'drawing',rows:[{...newChainRow('corner','c'),gapMm:len}]}});
}
const complete=outlineSurveyDocument(room,visits);assert(complete.ok&&complete.allEntered);assert.equal(complete.doc.room.workshop.activeWall,'poly-01');
const invalid=new Map(visits);invalid.set('poly-02',{...firstFace,lengthMm:2410});
const blocked=outlineSurveyDocument(room,invalid);assert(!blocked.ok&&!blocked.doc&&!room.workshop);
invalid.set('poly-02',{...firstFace,lengthMm:4100});assert(!outlineSurveyDocument(room,invalid).ok);

const nodes=new Map(),events={};
function node(key){
 if(!nodes.has(key))nodes.set(key,{value:'',innerHTML:'',textContent:'',disabled:false,replaceChildren(){this.innerHTML='';},focus(){},
    hasAttribute(s){return key===s;},matches(s){return s.split(',').includes('['+key+']');},closest(s){return s==='button'?this:null;},setAttribute(){}});
 return nodes.get(key);
}
const host={innerHTML:'',querySelector(sel){return node(sel.slice(1,-1));},querySelectorAll(){return [];},addEventListener(k,fn){events[k]=fn;}};
let calls=0,arrived='',saveResult={ok:true,saved:false},submitted=null;
const memory=new Map(),store={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
const turn=()=>new Promise(resolve=>setTimeout(resolve,0));
const initialOptions={initial:true,draftStore:store,getDoc:()=>null,apply:async d=>{calls++;submitted=d;return saveResult;},onAdvance:key=>{arrived=key;}};
let dispose=mountMeasuredOutline(host,initialOptions);await turn();
assert(host.innerHTML.includes('data-poly-h inputmode="decimal" autocomplete="off" dir="ltr" value=""'));
assert(!host.innerHTML.includes('ملء مثال حدود متعددة'));
const click=key=>events.click({target:node(key)});
const faceHost=node('data-poly-wall-editor'),faceEvents={};
Object.assign(faceHost,{querySelector:()=>null,addEventListener:(k,fn)=>{faceEvents[k]=fn;},removeEventListener:k=>{delete faceEvents[k];}});
globalThis.requestAnimationFrame=()=>0;globalThis.cancelAnimationFrame=()=>{};
const faceTrigger=(event,dataset,attrs=[],value='')=>{
 const t={tagName:event==='click'?'BUTTON':'INPUT',dataset,value,closest:()=>t,hasAttribute:attr=>attrs.includes(attr)};
 return faceEvents[event]({target:t});
};
const legButton=(k,i)=>{
 const t={hasAttribute:s=>k===s,closest:s=>s==='button'?t:s==='[data-poly-index]'?{dataset:{polyIndex:String(i)}}:null};
 return events.click({target:t});
};
const dataChange=(i,key,value)=>{const t=node(key);t.value=value;t.closest=s=>s==='[data-poly-index]'?{dataset:{polyIndex:String(i)}}:null;
 if(key==='data-poly-heading')return events.change({target:t});return events.input({target:t});};
await click('data-poly-use');assert.equal(calls,0);
node('data-poly-ref').value=meta.reference;node('data-poly-h').value='٢٨٠٠';
for(const [i,row] of rectangle.entries()){
 if(i)await click('data-poly-add');
 dataChange(i,'data-poly-length',row.length);await dataChange(i,'data-poly-heading',row.direction);
 if(i===0){
  assert(!node('data-poly-legs').innerHTML.includes('data-poly-index="1"'),'second wall does not exist');
  assert.match(node('data-poly-sketch').innerHTML,/data-poly-leg-id="poly-01"/);
  const hit={dataset:{polyLegId:'poly-01'},closest:q=>q==='[data-poly-leg-id]'?hit:null};
  node('data-poly-h').value='';let requestedHeight=false;
  node('data-poly-h').focus=()=>{requestedHeight=true;};
  await events.click({target:hit});assert(requestedHeight);assert(!faceEvents.click,'missing ceiling opens its real input');
  node('data-poly-h').value='٢٨٠٠';
  await events.click({target:hit});assert.equal(node('data-poly-subview').hidden,false);
  faceTrigger('click',{addReading:'door'},['data-add-reading']);
  faceTrigger('input',{chainProp:'gapMm'},[],'٤٠٠');faceTrigger('input',{chainProp:'widthMm'},[],'٩٠٠');
  let left=false;assert.equal(dispose.requestLeave(()=>{left=true;}),false,'dirty face blocks exiting perimeter');assert(!left);
  faceTrigger('click',{chainAct:'stay'});faceTrigger('click',{chainAct:'save-face'});assert(!left);
  assert.equal(node('data-poly-subview').hidden,true);assert.equal(calls,0);
  await turn();const saved=readPerimeterDraft(store);assert(saved?.revision);assert.equal(saved.data.rows.length,1);assert.equal(saved.data.surveys['poly-01'].chain.rows[0].widthMm,900);
  assert.equal(saved.data.height,'٢٨٠٠');assert.equal(saved.data.reference,meta.reference);
  const contender=openPerimeterDraftSession(store);contender.write({...saved.data,reference:'تنازع محاكى'});
  for(let attempt=0;attempt<5&&!contender.blocked;attempt++)await turn();
  assert(contender.blocked);assert.equal(readPerimeterDraft(store).data.reference,meta.reference);
  assert(!await clearPerimeterDraft(store,saved.revision),'another open owner controls the checkpoint');contender.close();
  dispose();await turn();node('data-poly-h').value='';node('data-poly-ref').value='';
  dispose=mountMeasuredOutline(host,initialOptions);await turn();
  assert.equal(node('data-poly-h').value,'٢٨٠٠');assert.equal(node('data-poly-ref').value,meta.reference);assert.equal(calls,0);
  assert(node('data-poly-legs').innerHTML.includes('data-poly-index="0"')&&!node('data-poly-legs').innerHTML.includes('data-poly-index="1"'));
  const changeMode=node('data-poly-mode');changeMode.dataset={polyMode:'coords'};await click('data-poly-mode');assert(node('data-poly-tip').textContent.includes('قراءات مرتبطة'));assert.equal(node('data-poly-walk').hidden,false);
  await legButton('data-poly-remove',0);assert(node('data-poly-delete-guard').innerHTML.includes('حذف الجدار وقراءاته'));await click('data-poly-keep');
 }
}
await click('data-poly-preview');assert(node('data-poly-view').innerHTML.includes('حفظ المحيط ومتابعة الرفع'));
assert.equal(calls,0);
await click('data-poly-use');assert.equal(calls,1);assert.equal(arrived,'');assert(readPerimeterDraft(store),'failed persistence retains checkpoint');assert.equal(submitted.kitchen.units.length,0);assert.deepEqual(submitted.kitchen.features.map(f=>[f.kind,f.wall,f.u,f.width]),[['door','poly-01',40,90]]);
dataChange(3,'data-poly-length','٤٠٩٥');await click('data-poly-use');assert.equal(calls,1);
await click('data-poly-preview');assert(node('data-poly-tip').textContent.includes('فرق الإغلاق ٥ مم'));assert(!node('data-poly-view').innerHTML);
dataChange(3,'data-poly-length','٤١٠٠');await click('data-poly-preview');saveResult={ok:true,saved:true};await click('data-poly-use');assert.equal(arrived,'survey');assert.equal(readPerimeterDraft(store),null,'only successful project creation clears the perimeter');
dispose();await turn();
const normal=mountMeasuredOutline(host,{getDoc:()=>loaded.doc,apply:()=>{throw Error('changing focus must not apply a new outline');}});
let activeLength=false;node('data-poly-index="1"] [data-poly-length').focus=()=>{activeLength=true;};
const leg={dataset:{polyLegId:'poly-02'},closest:q=>q==='[data-poly-leg-id]'?leg:null};
await events.keydown({target:leg,key:'Enter',preventDefault(){}});assert(activeLength,'current-project room design opens the length field of the actual leg, not a temporary face');
normal();
memory.set('kitchen-studio:perimeter-visit:v1','{bad');const invalidRecord=openPerimeterDraftSession(store);
assert(!invalidRecord.data&&invalidRecord.status.includes('لم تُستبدل'));assert(!invalidRecord.write({}));assert.equal(memory.get('kitchen-studio:perimeter-visit:v1'),'{bad');invalidRecord.close();

console.log('Ordered measured wall vectors, explicit bearing, no implicit closing wall, fractional field discrepancy, concave geometry/IDs/clockwise validation; mounted initial flow saves and advances only on confirmed persistence.');

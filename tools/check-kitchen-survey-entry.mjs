import assert from 'node:assert/strict';
import {makeChainExample,newChainRow} from '../public/kitchen-chain-model.js';
import {mountChainStep,prepareSurveySave} from '../public/kitchen-chain-ui.js';

const original=makeChainExample(),originalSnapshot=JSON.stringify(original);
const {back,right}=original.room.workshop.chains;
const revised=structuredClone(back);revised.rows[2].depthMm=45;
const invalid=structuredClone(right);invalid.rows[1].gapMm+=10;
const failed=prepareSurveySave(original,[['back',revised],['right',invalid]]);
assert.equal(failed.ok,false);assert.equal(failed.wall,'right');assert.equal(failed.doc,original);
assert.equal(JSON.stringify(original),originalSnapshot,'invalid second wall leaves both walls unchanged');
const drop={rows:[{...newChainRow('corner','end'),gapMm:5000}]};
assert.equal(prepareSurveySave(original,[['right',drop]]).requires,'remove');
const allowed=prepareSurveySave(original,[['right',drop]],{remove:new Set(['right'])});
assert.equal(allowed.ok,true);assert.equal(allowed.doc.kitchen.features.filter(f=>f.wall==='right').length,0);
const changedCAD=structuredClone(original);changedCAD.kitchen.features.find(f=>f.kind==='window').depth+=1;
assert.equal(prepareSurveySave(changedCAD,[['back',revised]]).requires,'restore');
assert.equal(prepareSurveySave(changedCAD,[['back',revised]],{restore:new Set(['back'])}).ok,true);

class Host {
 listeners=new Map();nodes=new Map();innerHTML='';
 querySelector(key){
  if(!/\[data-(?:survey-elevation|chain-summary|chain-notice|chain-state|chain-position=)/.test(key))return null;
  if(!this.nodes.has(key))this.nodes.set(key,{querySelector(){return null;},classList:{toggle(){}},textContent:'',innerHTML:''});
  return this.nodes.get(key);
 }
 addEventListener(key,listener){this.listeners.set(key,listener);}
 removeEventListener(key){this.listeners.delete(key);}
 emit(key,dataset={},attrs=[],value=''){
  const target={tagName:key==='change'?'SELECT':key==='click'?'BUTTON':'INPUT',dataset,value,closest:()=>target,hasAttribute:a=>attrs.includes(a)};
  this.listeners.get(key)({target});
 }
 select(i){this.emit('click',{chainRow:String(i)});}
 action(a){this.emit('click',{chainAct:a});}
 add(k){this.emit('click',{addReading:k},['data-add-reading']);}
 wall(id){this.emit('change',{},['data-chain-wall'],id);}
 input(k,v){this.emit('input',{chainProp:k},[],v);}
}
globalThis.requestAnimationFrame=fn=>{queueMicrotask(fn);return 1;};globalThis.cancelAnimationFrame=()=>{};
let project=original;const writes=[];let leaves=0;
const host=new Host(),ui=mountChainStep(host,{getDoc:()=>project,apply:d=>{writes.push(d);project=d;return {ok:true,saved:true};},focus:{wall:'back'}});
assert.doesNotMatch(host.innerHTML,/data-chain-prop=/,'no wall-length form list on entry');
assert.equal((host.innerHTML.match(/data-chain-row=/g)||[]).length,7);
assert.match(host.querySelector('[data-survey-elevation]').innerHTML,/data-survey-ref-mm="2000" data-survey-end-mm="3200"/);
assert.match(host.querySelector('[data-chain-summary]').innerHTML,/٣٬٠٠٠/,'free lower span computed from measured frames');
assert.match(host.querySelector('[data-chain-state]').textContent,/المثال/);
host.select(2);
const inspector=()=>host.innerHTML.match(/<section class="sv-ink-editor sv-ink-object"[\s\S]*?<\/section>/)?.[0];
const listedWindow=inspector();assert.match(listedWindow,/عرض البرواز كاملًا/);
assert.doesNotMatch(host.innerHTML,/data-ink-manual open/,'reading list opens the on-sheet properties');
host.emit('click',{chainHit:'2'});assert.equal(inspector(),listedWindow,'drawing and reading list expose identical measurements');
host.emit('input',{inkValue:'widthMm'},['data-ink-value'],'١٢٠١');host.action('reading-details');
assert.match(host.querySelector('[data-chain-notice]').textContent,/ثبّت القياسات/,'advanced editor cannot discard an unsaved measurement');
host.emit('input',{inkValue:'widthMm'},['data-ink-value'],'١٢٠٠');host.action('reading-details');
assert.match(host.innerHTML,/data-extra-fields open/,'advanced detail opens only on request');
host.input('depthMm','٤٥');await Promise.resolve();
host.wall('right');host.select(1);host.action('reading-details');host.input('gapMm','٣٦١٠');await Promise.resolve();
host.action('save');assert.equal(writes.length,0,'one bad closure cannot partially commit a different wall');
assert.match(host.querySelector('[data-chain-notice]').textContent,/إغلاق/);
host.input('gapMm','٣٦٠٠');await Promise.resolve();host.wall('back');assert.match(host.innerHTML,/data-chain-prop="depthMm" value="45"/);
assert.equal(ui.requestLeave(()=>leaves++),false);assert.match(host.innerHTML,/leave-discard/);
host.action('stay');assert.equal(leaves,0);assert.match(host.innerHTML,/data-chain-prop="depthMm" value="45"/);
assert.equal(ui.requestLeave(()=>leaves++),false);host.action('leave-save');assert.equal(leaves,1);assert.equal(writes.length,1);
assert.equal(project.room.workshop.chains.back.rows[2].depthMm,45);assert.equal(project.kitchen.features.find(f=>f.kind==='window').depth,4.5);
host.wall('left');host.add('door');assert.match(host.innerHTML,/من ركن البداية إلى الطرف الخارجي الأول للباب/);
host.input('gapMm','٤٠٠');host.input('widthMm','٩٠٠');await Promise.resolve();host.add('window');assert.match(host.innerHTML,/من الطرف الخارجي البعيد للباب إلى الطرف الخارجي الأول للشباك/);
host.input('gapMm','٧٠٠');host.input('widthMm','١٢٠٠');
host.action('services');assert.match(host.innerHTML,/data-add-reading="water"/);host.add('water');assert.match(host.innerHTML,/إلى مركز مخرج الماء/);host.input('gapMm','٢٠٠');
host.add('stop');assert.match(host.innerHTML,/نهاية الدواليب/);assert.equal(ui.requestLeave(()=>leaves++),false);host.action('leave-discard');assert.equal(leaves,2);assert.equal(writes.length,1);
host.wall('back');host.action('tools');host.action('proof');host.emit('input',{},['data-chain-technician'],'فهد');
assert.equal(ui.requestLeave(()=>leaves++),false);assert.match(host.innerHTML,/review-proof/);host.action('review-proof');assert.match(host.innerHTML,/فهد/);
host.emit('input',{},['data-chain-reference'],'زيارة ٤١');host.action('attest');assert.equal(writes.length,2);
assert.match(host.querySelector('[data-chain-state]').textContent,/موثّق/);assert.equal(ui.requestLeave(()=>leaves++),true);assert.equal(leaves,2);
ui.destroy();assert.equal(host.listeners.size,0);
console.log('Contextual wall entry, casing and service references, Arabic measurements, atomic multi-wall saves, removal and stale CAD confirmations, draft navigation, and explicit field attestation.');

const fromPlan=structuredClone(original);delete fromPlan.room.workshop.chains;
const projectedHost=new Host();
const fromPlanUI=mountChainStep(projectedHost,{getDoc:()=>fromPlan,apply(){throw Error('selecting a CAD reference cannot write measurements');},focus:{wall:'back'}});
assert.match(projectedHost.html??projectedHost.innerHTML,/استخدام عناصر الرسم للرفع/);
projectedHost.emit('click',{chainHit:'1',chainFocus:'bottomMm'});
assert.equal(fromPlanUI.requestLeave(()=>{}),true,'a tap on a projected opening does not adopt other CAD measurements or dirty the wall');
projectedHost.action('adopt');assert.match(projectedHost.innerHTML,/data-chain-row="1" aria-pressed="true"/);
assert.equal(fromPlanUI.requestLeave(()=>{}),false);fromPlanUI.destroy();

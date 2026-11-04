// Exercise the production survey controller. A paper stroke, typed ribbon,
// undo and exit must all feed the one wall draft without bypassing its save.
import assert from 'node:assert/strict';
import {newSurveyProject} from '../public/kitchen-project.js';
import {mountChainStep} from '../public/kitchen-chain-ui.js';
import {mountOutlineWallEntry} from '../public/kitchen-outline-wall-entry.js';
import {readChainRange} from '../public/kitchen-chain-model.js';
import {makeFurnishedSaudiRoom} from '../public/kitchen-room-presets.js';
import {addFeature} from '../public/kitchen-model.js';

const store={getItem(){return null;}};
let doc=newSurveyProject({widthMm:5000,lengthMm:4200,heightMm:2800,name:'اختبار الرسم'},store);
let writes=0,leaves=0;
function svgNode(){return {setAttribute(){},append(){},remove(){},replaceChildren(){},ownerDocument};}
const ownerDocument={createElementNS(){return svgNode();}};
const svg={...svgNode(),dataset:{inkLeft:'0',inkTop:'0',inkWidth:'500',inkHeight:'280',inkWallMm:'5000',inkHeightMm:'2800'},
 getScreenCTM:()=>({inverse:()=>({})}),createSVGPoint:()=>({x:0,y:0,matrixTransform(){return this;}}),
 setPointerCapture(){},hasPointerCapture(){return false;}};
const fields=new Map(),listeners=new Map();
const host={innerHTML:'',contains:el=>el===svg,
 querySelector(q){
  if(!/^\[data-(?:survey-elevation|chain-summary|chain-notice|chain-state|chain-position=|chain-prop=|chain-map|ink-existing|ink-value=|ink-error)/.test(q))return null;
  if(!fields.has(q))fields.set(q,{querySelector(){return null;},classList:{toggle(){}},textContent:'',innerHTML:'',focus(){},select(){},scrollIntoView(){}});
  return fields.get(q);
 },addEventListener(type,fn,capture=false){const list=listeners.get(type)||[];list.push({fn,capture});listeners.set(type,list);},
 removeEventListener(type,fn){listeners.set(type,listeners.get(type).filter(l=>l.fn!==fn));}};
const target=(dataset={},value='')=>({dataset,value,hasAttribute(k){const attr=k.slice(5).replace(/-([a-z])/g,(_,s)=>s.toUpperCase());return Object.hasOwn(this.dataset,attr);},
 closest(q){return q.startsWith('button,')?this:null;}});
function fire(type,src,more={}){
 const e={target:src,preventDefault(){},stopPropagation(){},stopImmediatePropagation(){this.stop=true;},...more};
 for(const l of listeners.get(type)||[]){if(e.stop)break;l.fn(e);}
}
function stroke(x1,z1,x2=x1,z2=z1){
 const hit={closest(s){return s==='svg.survey-wall-sheet'?svg:null;}};
 const ev=(type,x,z)=>fire(type,hit,{clientX:x/10,clientY:(2800-z)/10,pointerId:11,isPrimary:true,pointerType:'pen',button:0});
 ev('pointerdown',x1,z1);ev('pointermove',x2,z2);ev('pointerup',x2,z2);
}
function click(dataset){fire('click',target(dataset),{detail:0});}
const action=a=>click({inkAction:a}),tool=t=>click({inkTool:t}),control=a=>click({chainAct:a});
const enter=(key,value)=>{const t=target({inkValue:key},value);fire('input',t);fire('keydown',t,{key:'Enter'});};
const ui=mountChainStep(host,{getDoc:()=>doc,apply:d=>(doc=d,writes++,{ok:true,saved:true})});
assert(host.innerHTML.includes('data-ink-tool="pen" aria-pressed="true"'));
stroke(410,500);
assert(host.innerHTML.includes('data-ink-stagebar'),'choosing the mark type must keep its toolbar space');
assert.notEqual(host.querySelector('[data-chain-state]').textContent,'لا توجد قياسات');
action('cancel');
stroke(411,0,1302,2050);
assert(host.innerHTML.includes('data-ink-action="kind-door" aria-pressed="true"'));
assert(host.innerHTML.includes('data-ink-value="gapMm" value="410"'));
assert(!host.innerHTML.includes('data-chain-row="0"'));
control('save');assert.equal(writes,0);
assert.equal(ui.requestLeave(()=>leaves++),false);assert(host.innerHTML.includes('تجاهل الرسم ومتابعة'));action('stay');
enter('gapMm','٤٠٠ ٩٠٠');assert(host.innerHTML.includes('data-chain-row="0"'));assert.equal(writes,0);
stroke(2000,1000,3200,2000);
assert(host.innerHTML.includes('data-ink-action="kind-window" aria-pressed="true"'));action('confirm');
tool('water');stroke(3600,510);
assert(host.innerHTML.includes('data-ink-value="bottomMm" value="510"'));action('confirm');
action('undo');assert(!host.innerHTML.includes('data-chain-row="2"'));
stroke(3600,510);action('confirm');control('save');assert.equal(writes,1);
const chain=doc.room.workshop.chains.back;
assert.deepEqual(chain.rows.map(r=>[r.kind,r.gapMm]),[['door',400],['window',700],['water',400]]);
assert.equal(chain.rows[0].widthMm,900);assert.equal(chain.rows[1].widthMm,1200);assert.equal(chain.rows[2].bottomMm,510);assert(!chain.attestation);
assert.deepEqual(readChainRange(doc,'back').readings.map(r=>r.refMm),[400,2000,3600]);
click({chainHit:'0',chainFocus:'widthMm'});assert(host.innerHTML.includes('sv-ink-existing'));enter('widthMm','٨٥٠');
control('save');assert.equal(doc.room.workshop.chains.back.rows[0].widthMm,850);
tool('window');action('type');enter('gapMm','٥٠٠٠ ٩٠٠');assert(host.innerHTML.includes('data-ink-action="confirm"'));assert.equal(writes,2);
assert.equal(ui.requestLeave(()=>leaves++),false);action('discard-leave');assert.equal(leaves,1);
ui.destroy();assert([...listeners.values()].every(list=>list.length===0));
// Three marks on the same sheet. No per-mark confirmation, adopt or undoable
// CAD mutation is allowed until the single check across the entire sequence.
const blank=newSurveyProject({widthMm:5000,lengthMm:4200,heightMm:2800,name:'ورقة'},store);
doc=blank;
const sheet=mountChainStep(host,{getDoc:()=>doc,apply:d=>(doc=d,writes++,{ok:true,saved:true})});
stroke(400,0,1300,2050);stroke(2000,1000,3200,2000);
assert(host.innerHTML.includes('تثبيت القياسات (٢)'));
const width=target({inkValue:'widthMm'},'٨٠٠٠');fire('input',width);
tool('water');stroke(3600,510);
assert(!host.innerHTML.includes('تثبيت القياسات (٣)'),'invalid second mark cannot accept a third');
width.value='١٢٠٠';fire('input',width);stroke(3600,510);
assert(host.innerHTML.includes('تثبيت القياسات (٣)'));
assert.equal(sheet.requestLeave(()=>leaves++),false);action('stay');
action('cancel');assert(host.innerHTML.includes('تثبيت القياسات (٢)'));
assert(!host.innerHTML.includes('data-chain-row="0"'));
stroke(3600,510);action('confirm');assert(host.innerHTML.includes('data-chain-row="2"'));assert.equal(doc,blank);
control('save');assert.equal(writes,3);
assert.deepEqual(doc.room.workshop.chains.back.rows.map(r=>[r.kind,r.gapMm]),[['door',400],['window',700],['water',400]]);
// Browser paste can split both live inputs and still dispatch the Enter key on
// the original focused gap textbox. The pair already supplied is sufficient.
tool('window');action('type');
const gap=target({inkValue:'gapMm'},'');fire('paste',gap,{clipboardData:{getData(){return '١٠٠ ٤٥٠';}}});
assert.equal(host.querySelector('[data-ink-value="widthMm"]').value,'450');
gap.value='100';fire('input',gap);fire('keydown',gap,{key:'Enter'});
assert(!host.innerHTML.includes('data-ink-action="confirm"'));
assert(host.innerHTML.includes('data-chain-row="3"'));sheet.destroy();
let faceSaved=null;
const outline=mountOutlineWallEntry(host,{lengthMm:5000,heightMm:2800,wallLabel:'جدار جديد',onSave:c=>{faceSaved=c;return {ok:true};},onClose(){}});
tool('door');
fire('keydown',target({inkTool:'door'}),{key:'٤'});
assert.equal(host.querySelector('[data-ink-value="gapMm"]').value,'٤','first digit starts a tape reading with the current tool');
enter('gapMm','٤٠٠ ٩٠٠');control('save-face');
assert.deepEqual(faceSaved.rows.map(r=>[r.kind,r.gapMm,r.widthMm]),[['door',400,900]]);
assert.equal(faceSaved.attestation,undefined);assert.equal(writes,3,'outline marking never writes the saved CAD');
outline();
console.log('Mounted pen and point gestures, opening classification, provisional save/exit guard, Arabic direct pair, confirmed-only readings, undo, station and centre height, anchored dimension edits and cleanup.');

const {makeChainExample,linkedReadingIndex}=await import('../public/kitchen-chain-model.js');
doc=makeChainExample();const measured=doc.kitchen.features.find(f=>f.kind==='window'),index=linkedReadingIndex(doc.room,measured);
let focusHits=0;host.querySelector('[data-chain-prop="bottomMm"]').focus=()=>focusHits++;
const correction=mountChainStep(host,{getDoc:()=>doc,apply:d=>(doc=d,writes++,{ok:true,saved:true}),focus:{wall:measured.wall,featureId:measured.id}});
assert.match(host.innerHTML,new RegExp('data-chain-row="'+index+'" aria-pressed="true"'));
assert.match(host.innerHTML,/data-chain-prop="bottomMm" value="1150"/);assert.equal(focusHits,1);
globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
const changed=target({chainProp:'bottomMm'},'1160');
fire('input',changed);control('save');
assert.equal(doc.kitchen.features.find(f=>f.id===measured.id).bottom,116);
assert.equal(doc.room.workshop.chains.back.rows[index].bottomMm,1160);assert(readChainRange(doc,'back'));
correction.destroy();
console.log('CAD correction deep link opens the measured window row and sill field, then commits 1150→1160 mm to both CAD and the validated measurement chain.');

doc=makeChainExample();const original=doc,feature=doc.kitchen.features.find(f=>f.kind==='window');
const idx=linkedReadingIndex(doc.room,feature),targetRow=doc.room.workshop.chains[feature.wall].rows[idx];
const direct=mountChainStep(host,{getDoc:()=>doc,apply:d=>(doc=d,{ok:true,saved:true}),focus:{wall:feature.wall}});
function dragWindow(){
 const hit={dataset:{chainHit:String(idx)},closest(s){return s==='svg.survey-wall-sheet'?svg:s==='[data-chain-hit]'?this:null;}};
 for(const [type,clientY] of [['pointerdown',145],['pointermove',135],['pointerup',135]]){
  fire(type,hit,{clientX:220,clientY,pointerId:12,isPrimary:true,pointerType:'mouse',buttons:type==='pointerup'?0:1,button:0});
 }
}
dragWindow();assert.equal(doc,original);assert.match(host.innerHTML,/اقتراح السحب/);assert.match(host.innerHTML,/data-ink-value="bottomMm"[^>]*value="1250"/);
action('cancel');assert.equal(doc.room.workshop.chains.back.rows[idx].bottomMm,1150);
dragWindow();action('confirm');assert.equal(doc,original);control('save');
const corrected=doc.room.workshop.chains[feature.wall].rows[idx];
assert.equal(corrected.id,targetRow.id);assert.equal(corrected.bottomMm,1250);assert.equal(doc.kitchen.features.find(f=>f.id===feature.id).bottom,125);
assert.equal(doc.kitchen.features.length,original.kitchen.features.length);assert(readChainRange(doc,feature.wall));direct.destroy();
console.log('Dragging a surveyed window to a higher level drafts the change, cancellation restores it, confirm + save updates the same frame and reading once.');

// Mount the real paper, menu and zoom against a screen-transformed SVG. A
// context-menu placement must map through the current view, not CSS pixels.
let menu=null,box=[0,0,500,280];
function menuItem(){return {children:[],style:{},setAttribute(){},append(...v){this.children.push(...v);},
 addEventListener(type,fn){this[type]=fn;},focus(){},remove(){if(menu===this)menu=null;},getBoundingClientRect(){return {width:220,height:210};}};}
const documentEvents={};
host.ownerDocument={defaultView:{},createElement:menuItem,body:{append(node){menu=node;}},
 addEventListener(type,fn){(documentEvents[type]??=[]).push(fn);},removeEventListener(type,fn){documentEvents[type]=documentEvents[type].filter(f=>f!==fn);}};
const picture=host.querySelector('[data-survey-elevation]');
Object.defineProperty(picture,'innerHTML',{set(){box=[0,0,500,280];},configurable:true});
picture.querySelector=s=>s==='svg.survey-wall-sheet'?svg:null;
Object.assign(svg,{isConnected:true,getAttribute:key=>key==='viewBox'?box.join(' '):null,
 setAttribute(k,v){if(k==='viewBox')box=v.split(' ').map(Number);},contains:v=>v===svg||v?.svg===svg,
 getBoundingClientRect(){return {left:0,top:0,width:500,height:280};},
 querySelector(){return null;},insertAdjacentHTML(){},focus(){},closest:s=>s==='svg.survey-wall-sheet'?svg:null,
 createSVGPoint:()=>({x:0,y:0,matrixTransform(){return {x:box[0]+this.x*box[2]/500,y:box[1]+this.y*box[3]/280};}})});
const startRoom=newSurveyProject({widthMm:5000,lengthMm:4200,heightMm:2800,name:'لوحة'},store);
doc=startRoom;
const paper=mountChainStep(host,{getDoc:()=>doc,apply:d=>(doc=d,{ok:true,saved:true})});
function at(type,t,x,y,props={}){fire(type,t,{clientX:x,clientY:y,pointerId:27,pointerType:'mouse',isPrimary:true,button:2,...props});}
function chooseMenu(label){const choice=menu?.children.find(x=>x.textContent===label);assert(choice,'menu missing '+label);choice.click();}
at('wheel',svg,250,150,{deltaMode:0,deltaY:-175});assert(box[2]<500&&Math.abs(box[0]+box[2]/2-250)<1e-8);
tool('gas');at('contextmenu',svg,250,150);
assert(menu.children.some(n=>n.textContent==='إضافة مخرج غاز'));
assert(!menu.children.some(n=>n.textContent==='إضافة شباك'));
chooseMenu('إضافة مخرج غاز');assert.equal(doc,startRoom);
at('contextmenu',svg,250,150);
assert(!menu.children.some(n=>n.textContent?.startsWith('إضافة')));
chooseMenu('إلغاء الرسم');assert.equal(doc,startRoom);
tool('pen');at('contextmenu',svg,250,150);chooseMenu('إضافة مخرج ماء');
assert.match(host.innerHTML,/data-ink-value="gapMm" value="2500"/);assert.match(host.innerHTML,/data-ink-value="bottomMm" value="1300"/);
assert.equal(doc,startRoom);action('confirm');control('save');assert.equal(doc.room.workshop.chains.back.rows[0].kind,'water');
action('fit');assert.deepEqual(box,[0,0,500,280]);action('zoom-in');assert(box[2]<500);action('fit');
const water={svg,dataset:{chainHit:'0'},closest(s){return s==='svg.survey-wall-sheet'?svg:s==='[data-chain-hit]'?this:null;}};
const frozen=doc;
tool('water');at('pointerdown',water,250,150,{pointerType:'touch',button:0});
await new Promise(done=>setTimeout(done,570));
chooseMenu('تصحيح ارتفاع المركز');
assert.match(host.innerHTML,/data-ink-existing[^>]*value="1300"/);
action('cancel');assert.equal(doc,frozen);
// Some browsers dispatch their native long-press contextmenu against the
// capturing SVG rather than against the water outlet originally held.
at('pointerdown',water,250,150,{pointerType:'pen',button:0});
at('contextmenu',svg,250,150,{pointerType:'pen',button:2});
chooseMenu('تصحيح ارتفاع المركز');assert.match(host.innerHTML,/data-ink-existing[^>]*value="1300"/);
action('cancel');assert.equal(doc,frozen);
const waterHeight={svg,dataset:{chainHit:'0',chainFocus:'bottomMm'},closest:water.closest};
at('contextmenu',waterHeight,250,150);assert(menu.children.some(n=>n.textContent==='تصحيح ارتفاع المركز'));
assert(!menu.children.some(n=>n.textContent==='تصحيح المسافة من المرجع'),'a centre-height dimension does not offer a station edit');
chooseMenu('تصحيح ارتفاع المركز');assert(!host.innerHTML.includes('data-ink-tool="window"'),'placement tools disappear while correcting a measured height');action('cancel');
click({addReading:'window'});at('contextmenu',svg,300,140);
assert(menu.children.some(n=>n.textContent==='إكمال القياس الناقص'));
assert(!menu.children.some(n=>n.textContent?.startsWith('إضافة')));chooseMenu('إكمال القياس الناقص');
assert.match(host.innerHTML,/data-chain-prop="gapMm" value=""/);assert.equal(doc,frozen);
paper.destroy();assert.equal(menu,null);assert(documentEvents.pointerdown.length===0);
console.log('Mounted survey: wheel zoom keeps the clicked water station and elevation, numeric actions + fit work on the tablet, long press with an active placement tool selects the original reading without adding another.');

// Check the actual provisional SVG inserted after pointerup, not just the form.
let overlay='',committedSheet='';
Object.defineProperty(picture,'innerHTML',{set(html){committedSheet=html;overlay='';box=[0,0,500,280];},configurable:true});
svg.insertAdjacentHTML=(where,html)=>{assert.equal(where,'beforeend');overlay=html;};
svg.querySelector=selector=>selector==='[data-ink-preview]'&&overlay?{remove(){overlay='';}}:null;
doc=startRoom;const inkWrites=[];
const visible=mountChainStep(host,{getDoc:()=>doc,apply:d=>(inkWrites.push(d),doc=d,{ok:true,saved:true})});
stroke(950,1200);
assert.match(overlay,/data-ink-cue="choose"/,'the pen location stays visible after a tap, until its type is chosen');
action('kind-window');assert.match(overlay,/sv-ink-current-shape/);
action('cancel');
tool('window');stroke(4700,2200,4920,2200);
assert.match(overlay,/data-ink-cue="bounds"/,'a horizontal window whose default height crosses the ceiling stays visible');
assert.match(host.innerHTML,/data-ink-value="heightMm" value="1000"/);
action('confirm');assert.equal(doc,startRoom);assert.match(host.innerHTML,/data-ink-action="confirm"/);
fire('input',target({inkValue:'heightMm'},'400'));assert.match(overlay,/sv-ink-current-shape/);
assert(!overlay.includes('data-ink-cue="bounds"'));
action('confirm');control('save');assert.equal(inkWrites.length,1);
assert.match(committedSheet,/data-chain-hit="0"/);
assert.equal(doc.kitchen.features[0].height,40);
tool('door');stroke(1000,0,1000,2010);
assert.match(host.innerHTML,/data-ink-value="heightMm" value="2010"/,'vertical door stroke supplies height and keeps editable preset width');
assert.match(overlay,/sv-ink-current-shape/);action('cancel');
click({chainHit:'0',chainFocus:'bottomMm'});fire('input',target({inkValue:'bottomMm'},'1900'));
assert.match(overlay,/data-ink-cue="correction"/,'the proposed change stays on the paper beside its exact reading');
action('cancel');assert.equal(overlay,'');assert.equal(inkWrites.length,1);
visible.destroy();
console.log('Survey rendering: released pen anchor, clipped provisional frame with recoverable dimensions, vertical drag, edited existing frame, save and cancel.');

// Moving the surveyed window in the villa crosses the *designed* hood. Keep the
// real reading and the planned cabinet independently visible to the two stages.
doc=makeFurnishedSaudiRoom('villa');
// An authored cabinet finish distinguishes this real remeasurement from the unchanged legacy room sample.
doc.kitchen.units[0]={...doc.kitchen.units[0],frontColor:'#714920'};
const actualVent=addFeature(doc.kitchen,doc.room,{id:'onsite-extract',kind:'vent',wall:'back',u:330,width:24,bottom:235,height:24});
assert(actualVent.ok);doc={...doc,kitchen:actualVent.kitchen};
let puts=0,reviewTarget;
const villaApi={getDoc:()=>doc,apply:d=>(puts++,doc=d,{ok:true,saved:true}),onAdvance:(route,focus)=>{reviewTarget={route,focus};}};
let villa=mountChainStep(host,villaApi);
control('adopt');control('save');
click({chainHit:'0',chainFocus:'gapMm'});enter('gapMm','٢٧٤٠');
const reminder=()=>host.querySelector('[data-chain-summary]').innerHTML;
assert.match(reminder(),/جهاز شفاط الطبخ في التصميم/);
assert.equal((reminder().match(/sv-design-note/g)||[]).length,1);
assert.doesNotMatch(reminder(),/غيّر الموضع|انقل التوصيلة|فتحة تهوية الشفاط/);
assert.match(host.innerHTML,/فتحة تهوية الشفاط/);
control('save');assert.equal(puts,2);assert.equal(doc.kitchen.features.find(f=>f.kind==='window').u,274);
assert.equal(doc.kitchen.features.find(f=>f.id==='onsite-extract').u,330);
villa.destroy();villa=mountChainStep(host,villaApi);assert.match(reminder(),/جهاز شفاط الطبخ في التصميم/);
const affected=doc.kitchen.units.find(u=>u.kind==='hood');
assert(reminder().includes('data-design-unit="'+affected.id+'"'));
click({chainAct:'design-review',designUnit:affected.id});assert.deepEqual(reviewTarget,{route:'placement',focus:{unitId:affected.id}});
click({surveyWallId:'right'});control('adopt');assert.match(host.innerHTML,/فتحة تهوية الشفاط/);
assert.doesNotMatch(reminder(),/sv-design-note/,'another wall should not inherit the hood warning');
click({surveyWallId:'back'});click({chainHit:'0',chainFocus:'gapMm'});enter('gapMm','١٦٥٠');
assert.doesNotMatch(reminder(),/sv-design-note/,'returning the window to the clear span removes the reminder');
villa.destroy();
console.log('Villa window correction 1650→2740 mm keeps the high wall vent in place and shows one actionable design-hood reminder after confirming, saving and reopening.');

// Select the proposed villa window directly, then the CAD water symbol on
// a mixed sheet. Only a confirmed item becomes a reading, using its original ID.
const {makeSaudiRoom}=await import('../public/kitchen-room-presets.js');
doc=makeSaudiRoom('villa');
const beforeSite=structuredClone(doc),originalWindow=doc.kitchen.features.find(f=>f.kind==='window');
const originalWater=doc.kitchen.features.find(f=>f.kind==='water');
let directWrites=0;
const siteApi={getDoc:()=>doc,apply:d=>(directWrites++,doc=d,{ok:true,saved:true})};
const primary=mountChainStep(host,siteApi);
assert.match(host.innerHTML,/sv-ink-tools sv-ink-stagebar/,'the unadopted canvas already reserves its inspector and toolbar lanes');
click({chainHit:'0'});
assert.match(host.innerHTML,/خصائص العنصر على الجدار/);
assert.match(host.innerHTML,/data-ink-value="gapMm"[^>]*value="1650"/);
assert.match(host.innerHTML,/data-ink-value="widthMm"[^>]*value="760"/);
assert.equal(primary.requestLeave(()=>{}),true,'selection alone must not be an unsaved field measurement');
click({chainHit:'0'});
assert.match(host.querySelector('[data-chain-state]').textContent,/من الرسم/);
fire('input',target({inkValue:'gapMm'},'١٩٥٠'));
assert.equal(host.querySelector('[data-chain-state]').textContent,'تعديل بانتظار التطبيق');
fire('input',target({inkValue:'gapMm'},'١٦٥٠'));
assert.match(host.querySelector('[data-chain-state]').textContent,/من الرسم/);
action('cancel');
assert.deepEqual(doc,beforeSite);
const bodyToken=token=>({dataset:{chainHit:token},closest(sel){return sel==='svg.survey-wall-sheet'?svg:sel==='[data-chain-hit]'?this:null;}});
function bodyDrag(token,dx,dz){
 const elem=bodyToken(token);
 for(const [type,x,z] of [['pointerdown',140,100],['pointermove',140+dx,100-dz],['pointerup',140+dx,100-dz]])
  at(type,elem,x,z,{pointerType:'touch',pointerId:16,button:0});
}
bodyDrag('0',20,12);
assert.match(host.innerHTML,/data-ink-value="gapMm"[^>]*value="1850"/);
assert.match(host.innerHTML,/data-ink-value="bottomMm"[^>]*value="1180"/);
// Drag the proposed body again and resize its side grip before accepting.
bodyDrag('0',10,2);
assert.match(host.innerHTML,/data-ink-value="gapMm"[^>]*value="1950"/);
const grip=bodyToken('0');grip.dataset.chainFocus='widthMm';
grip.hasAttribute=key=>key==='data-size-grip';
grip.closest=selector=>selector==='svg.survey-wall-sheet'?svg:['[data-chain-hit]','[data-chain-focus]'].includes(selector)?grip:null;
for(const [type,x] of [['pointerdown',200],['pointermove',205],['pointerup',212]])
 at(type,grip,x,100,{pointerType:'touch',pointerId:18,button:0});
assert.match(host.innerHTML,/data-ink-value="widthMm"[^>]*value="880"/);
assert.equal(directWrites,0);action('confirm');control('save');
assert.equal(doc.room.workshop.chains.back.rows.length,1);
assert.equal(doc.room.workshop.chains.back.rows[0].featureId,originalWindow.id);
assert.equal(doc.room.workshop.chains.back.attestation,undefined);
assert.equal(doc.kitchen.features.find(f=>f.id===originalWindow.id).u,195);
assert.equal(doc.kitchen.features.find(f=>f.id===originalWindow.id).bottom,120);
assert.deepEqual(doc.kitchen.features.find(f=>f.id===originalWater.id),originalWater);
assert(committedSheet.includes('data-chain-hit="cad:'+originalWater.id+'"'));
click({chainHit:'cad:'+originalWater.id});fire('input',target({inkValue:'bottomMm'},'٦٠٠'));
action('confirm');control('save');assert.equal(directWrites,2);
assert.equal(doc.kitchen.features.length,beforeSite.kitchen.features.length);
assert.equal(doc.room.workshop.chains.back.rows.length,2);
const waterBeforeMove=doc.kitchen.features.find(f=>f.id===originalWater.id);
const wIndex=linkedReadingIndex(doc.room,doc.kitchen.features.find(f=>f.id===originalWindow.id));
click({chainHit:String(wIndex)});assert.match(committedSheet,/wsheet-grip/);
fire('input',target({inkValue:'gapMm'},'2150'));action('confirm');control('save');
assert.deepEqual(doc.kitchen.features.find(f=>f.id===originalWater.id),waterBeforeMove);
primary.destroy();
const jump=mountChainStep(host,{...siteApi,focus:{wall:'back',featureId:originalWindow.id,edit:true,stationMm:2240}});
assert.match(host.innerHTML,/data-ink-value="gapMm"[^>]*value="2240"/);
action('cancel');assert.equal(doc.kitchen.features.find(f=>f.id===originalWindow.id).u,215);jump.destroy();
console.log('Single-object wall editing: CAD-only villa tap, two-axis touch move, single adoption, mixed CAD service correction, stable IDs and neighbour positions, overview handoff and cancellation.');

// An inspected chained item accepts either physical datum without asking the
// technician to add earlier spans or visit the full chain form.
doc=makeChainExample();
const base=doc,otherFeatures=doc.kitchen.features.filter(f=>f.kind!=='window');
let fieldSaves=0;
const taped=mountChainStep(host,{getDoc:()=>doc,apply:d=>(doc=d,fieldSaves++,{ok:true,saved:true}),focus:{wall:'back'}});
click({chainHit:'0'});assert(!host.innerHTML.includes('data-ink-value="tapeGap"'),'the first reading already starts at the corner');
action('cancel');click({chainHit:'2'});
assert.match(host.innerHTML,/data-ink-value="tapeGap"[^>]*value="700"/);
assert.match(host.innerHTML,/من علامة بداية الدواليب إلى الطرف الخارجي الأول للشباك/);
fire('input',target({inkValue:'tapeGap'},'٧٥٠'));
assert.equal(host.querySelector('[data-ink-value="gapMm"]').value,'2050');
fire('input',target({inkValue:'gapMm'},'٢٠٤٠'));
assert.equal(host.querySelector('[data-ink-value="tapeGap"]').value,'740');
fire('input',target({inkValue:'tapeGap'},'-1'));control('save-object');
assert.equal(fieldSaves,0);assert.equal(doc,base);assert.match(host.querySelector('[data-ink-error]').textContent,/صفر/);
fire('input',target({inkValue:'tapeGap'},'٧٥٠'));control('save-object');
assert.equal(fieldSaves,1);
const savedRow=doc.room.workshop.chains.back.rows[2];
assert.equal(savedRow.gapMm,750);assert.equal(savedRow.from,base.room.workshop.chains.back.rows[2].from);
assert.equal(readChainRange(doc,'back').readings[2].refMm,2050);assert.deepEqual(doc.kitchen.features.filter(f=>f.kind!=='window'),otherFeatures);
click({chainHit:'2'});assert.match(host.innerHTML,/data-ink-value="tapeGap"[^>]*value="750"/);
fire('input',target({inkValue:'tapeGap'},''));control('save-object');assert.equal(fieldSaves,1);
action('cancel');taped.destroy();
console.log('Paired tape and station inputs update each other, reject a negative or blank measurement, and save one validated wall correction without moving adjacent features.');

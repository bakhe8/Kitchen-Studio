// Actual workshop production review/save/approval journey. The DOM/event
// harness is copied from quote-workshop; routing and domain calculations are real.
import assert from 'node:assert/strict';
import {mountWorkshop,workshopRoute} from '../public/kitchen-workshop-ui.js';
import {makeProductionReadyFixture} from './fixture-kitchen-production-ready.mjs';
import {getFactoryCatalog,buildFactoryQuote} from '../public/kitchen-workshop-factory.js';
import {approvalState,releaseConcerns} from '../public/kitchen-workshop-state.js';
import {catalogRecordStates} from '../public/kitchen-catalog-records.js';
import {hasUnsavedWork} from '../public/kitchen-unsaved-work.js';
import {bindProjectAccess} from '../public/kitchen-project-access.js';
import {canOpenWorkshopPage} from '../public/kitchen-role-pages.js';
import {cleanIdea} from '../public/kitchen-ideas.js';
import {reviewProductionPreview} from '../public/kitchen-production-preview.js';
const decode=s=>String(s).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const encode=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
const attrList=s=>Object.fromEntries([...s.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map(m=>[m[1],decode(m[2]??m[3]??m[4]??'')]));
const dataKey=s=>s.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
const voidTags=new Set(['input','img','br','hr','meta','link','wbr','source','area','base','embed','param']);
class Node {
 constructor(tag='div',attrs={},parent=null){
  this.tagName=tag.toUpperCase();this.attrs={...attrs};this.parentNode=parent;this.children=[];this.listeners=new Map();
  this.style={setProperty(){}};this.scrollTop=0;this.dataset=Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[dataKey(k),v]));
  this.classList={add:(...names)=>this.setAttribute('class',[...new Set([...this.classes(),...names])].join(' ')),remove:(...names)=>this.setAttribute('class',this.classes().filter(n=>!names.includes(n)).join(' ')),contains:name=>this.classes().includes(name),toggle:(name,force)=>{const yes=force??!this.classes().includes(name);this.classList[yes?'add':'remove'](name);return yes;}};
 }
 classes(){return (this.attrs.class||'').split(/\s+/).filter(Boolean);}
 get isConnected(){return this.root===true||!!this.parentNode?.isConnected;}
 get value(){if(this._value!==undefined)return this._value;if(this.tagName==='SELECT'){const options=this.querySelectorAll('option');return (options.find(n=>n.hasAttribute('selected'))||options[0])?.getAttribute('value')??'';}return this.getAttribute('value')??'';}
 set value(v){this._value=String(v);}
 get disabled(){return this.hasAttribute('disabled');}set disabled(v){v?this.setAttribute('disabled',''):this.removeAttribute('disabled');this.onDisabledChange?.(!!v);}
 get options(){return this.querySelectorAll('option');}
 get textContent(){return this.children.map(n=>typeof n==='string'?decode(n):n.textContent).join('');}
 set textContent(v){this.detach();this.children=[String(v)];}
 detach(){for(const child of this.children)if(typeof child!=='string')child.parentNode=null;}
 get innerHTML(){return this.children.map(n=>typeof n==='string'?n:n.outerHTML).join('');}
 set innerHTML(html){
  this.detach();this.children=[];const stack=[this];
  for(const token of String(html).match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)||[]){
   if(token.startsWith('<!--'))continue;
   if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}
   if(token.startsWith('<')){
    const m=token.match(/^<([\w:-]+)([\s\S]*?)\/?\s*>$/);if(!m)continue;
    const parent=stack.at(-1),node=new Node(m[1],attrList(m[2]),parent);parent.children.push(node);
    if(!voidTags.has(m[1].toLowerCase())&&!token.endsWith('/>'))stack.push(node);
   }else stack.at(-1).children.push(token);
  }
 }
 get outerHTML(){const tag=this.tagName.toLowerCase(),attrs=Object.entries(this.attrs).map(([k,v])=>' '+k+'="'+encode(v)+'"').join('');return '<'+tag+attrs+'>'+this.innerHTML+(voidTags.has(tag)?'':'</'+tag+'>');}
 getAttribute(k){return this.attrs[k]??null;}
 hasAttribute(k){return Object.hasOwn(this.attrs,k);}
 setAttribute(k,v){this.attrs[k]=String(v);if(k.startsWith('data-'))this.dataset[dataKey(k)]=String(v);}
 removeAttribute(k){delete this.attrs[k];if(k.startsWith('data-'))delete this.dataset[dataKey(k)];}
 matches(selector){return selector.split(',').some(s=>{
  s=s.trim();const absent=[...s.matchAll(/:not\(([^)]+)\)/g)].map(m=>m[1]);s=s.replace(/:not\([^)]+\)/g,'');if(absent.some(x=>this.matches(x)))return false;
  if(s.includes(':disabled')&&!this.disabled)return false;s=s.replace(/:disabled/g,'');
  const tag=s.match(/^[\w-]+/)?.[0];if(tag&&tag.toUpperCase()!==this.tagName)return false;
  if([...s.matchAll(/\.([\w-]+)/g)].some(m=>!this.classes().includes(m[1])))return false;
  return [...s.matchAll(/\[([^\]=\s]+)(?:=["']?([^\]"']*)["']?)?\]/g)].every(m=>this.hasAttribute(m[1])&&(m[2]===undefined||this.getAttribute(m[1])===m[2]));
 });}
 closest(selector){for(let n=this;n;n=n.parentNode)if(n.matches(selector))return n;return null;}
 querySelectorAll(selector){
  const parts=selector.trim().split(/\s+(?=(?:[^"']|"[^"]*"|'[^']*')*$)/),last=parts.pop(),out=[];
  const walk=node=>{for(const child of node.children)if(typeof child!=='string'){
   if(child.matches(last)){let n=child.parentNode;const ancestors=[...parts];while(ancestors.length&&n){if(n.matches(ancestors.at(-1)))ancestors.pop();n=n.parentNode;}if(!ancestors.length)out.push(child);}
   walk(child);
  }};walk(this);return out;
 }
 querySelector(s){return this.querySelectorAll(s)[0]??null;}
 contains(target){for(let n=target;n;n=n.parentNode)if(n===this)return true;return false;}
 focus(){this.focused=true;}getBoundingClientRect(){return {left:0,top:0,right:900,bottom:600,width:900,height:600};}
 getScreenCTM(){return {inverse:()=>({a:1,b:0,c:0,d:1,e:0,f:0})};}
 createSVGPoint(){return {x:0,y:0,matrixTransform(m){return {x:this.x*m.a+this.y*m.c+m.e,y:this.x*m.b+this.y*m.d+m.f};}};}
 addEventListener(type,fn,options){const list=this.listeners.get(type)||[];list.push({fn,capture:options===true||!!options?.capture});this.listeners.set(type,list);}
 removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(e=>e.fn!==fn));}
}
async function fire(type,target,more={}){
 assert(target,'the requested control exists in actual rendered markup');
 const path=[];for(let node=target;node;node=node.parentNode)path.push(node);
 const event={type,target,button:0,detail:1,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.immediateStopped=this.stopped=true;},...more};
 for(const node of [...path].reverse())for(const {fn,capture} of [...(node.listeners.get(type)||[])]){if(capture&&!event.immediateStopped)await fn(event);}
 if(!event.stopped)for(const node of path){
  if(typeof node['on'+type]==='function')await node['on'+type](event);
  for(const {fn,capture} of [...(node.listeners.get(type)||[])])if(!capture&&!event.immediateStopped)await fn(event);
  if(event.stopped)break;
 }
 return event;
}

// Workshop shell and dynamic children need normal ownership and reparenting.
Object.defineProperties(Node.prototype,{
 className:{get(){return this.attrs.class||'';},set(value){this.setAttribute('class',value);}},
 ownerDocument:{get(){return this._document||this.parentNode?.ownerDocument||globalThis.document;},set(value){this._document=value;}}
});
Node.prototype.append=function(...nodes){for(const node of nodes){node.remove?.();if(typeof node!=='string')node.parentNode=this;this.children.push(node);}};
Node.prototype.replaceChildren=function(...nodes){this.detach();this.children=[];this.append(...nodes);};
Node.prototype.insertAdjacentHTML=function(position,html){assert.equal(position,'beforeend');const fragment=new Node();fragment.innerHTML=html;this.append(...fragment.children);};
Node.prototype.remove=function(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;};
Node.prototype.getClientRects=function(){return this.isConnected&&!this.hidden?[this.getBoundingClientRect()]:[];};
Node.prototype.focus=function(){this.focused=true;this.ownerDocument.activeElement=this;};
Node.prototype.showModal=function(){this.open=true;};
Node.prototype.close=function(){this.open=false;return fire('close',this);};
class Store{data=new Map();getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
const windowNode=new Node('window');windowNode.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
globalThis.addEventListener=(...args)=>windowNode.addEventListener(...args);globalThis.removeEventListener=(...args)=>windowNode.removeEventListener(...args);
const dom=new Node('document');dom.root=true;dom.defaultView=windowNode;dom.activeElement=null;
dom.createElement=tag=>{const node=new Node(tag);node.ownerDocument=dom;return node;};
dom.body=new Node('body',{},dom);dom.children.push(dom.body);dom.documentElement=new Node('html',{},dom);
globalThis.document=dom;globalThis.window=windowNode;

dom.head=new Node('head',{},dom);dom.children.push(dom.head);
const copy=value=>structuredClone(value),snapshot=value=>JSON.stringify(value);
const initial=await makeProductionReadyFixture();
function fixture(seed=initial){
 globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
 let live=copy(seed),saves=0,past=[],future=[],fail=false,memoryOnly=false;
 const root=dom.createElement('main'),opener=dom.createElement('button');dom.body.append(root,opener);
 const notices=[],history=[];
 const workshop=mountWorkshop(root,{getDoc:()=>live,opener,closeOthers(){},tell:value=>notices.push(value),
  apply(next){if(fail)return {ok:false,saved:false,reason:'production fixture storage denied'};past.push(live);future=[];live=next;saves++;return {ok:true,saved:!memoryOnly};},
  canHistory:forward=>!!(forward?future.length:past.length),onHistory(forward){history.push(forward);if(forward&&future.length){past.push(live);live=future.pop();}else if(!forward&&past.length){future.push(live);live=past.pop();}return {ok:true,saved:true};}
 });
 const query=s=>root.querySelector(s),click=s=>fire('click',typeof s==='string'?query(s):s),action=name=>click('[data-production-action="'+name+'"]');
 async function ready(){
  for(let i=0;i<250;i++){
   const screen=query('.ws-screen');
   if(screen&&!screen.hasAttribute('aria-busy')){assert(!query('[data-ws-retry]'),'actual workshop route mounts without closure/import errors');return;}
   await new Promise(resolve=>setTimeout(resolve,2));
  }assert.fail('workshop async route did not finish mounting');
 }
 async function open(route='production',focus={}){workshop.open(route,focus);await ready();assert.equal(workshop.screen()?.route,route,'actual workshop routes to the requested page');if(route==='production')assert(query('.production-studio'),'actual workshop mounts production studio');}
 const unit=id=>click('[data-production-unit="'+id+'"]'),piece=index=>click('[data-production-piece="'+index+'"]');
 async function input(key,raw){const field=query('[data-production-field="'+key+'"]');assert(field,'production inspector exposes '+key);field.value=raw;await fire(field.tagName==='SELECT'?'change':'input',field);return field;}
 return {root,query,click,action,ready,open,unit,piece,input,workshop,notices,history,get live(){return live;},set live(value){live=value;},get saves(){return saves;},set fail(value){fail=value;},set memoryOnly(value){memoryOnly=value;},close(){workshop.close(false);root.remove();opener.remove();}};
}
const quote=buildFactoryQuote(initial),operationPieces=quote.pieces.map((piece,index)=>({piece,index})).filter(({piece})=>piece.operations?.length);
assert.equal(operationPieces.length,4);
const first=operationPieces[0],second=operationPieces[1];
async function chooseOperation(f,entry=first){await f.unit(entry.piece.unitId);await f.piece(entry.index);const operation=f.query('[data-production-operation="0"]');if(operation)await f.click(operation);}
const currentOp=doc=>getFactoryCatalog(doc).families.storage.recipe.find(line=>line.sku==='BODY-6').operations[0];
assert.equal(workshopRoute('production',{}),'production','manufacturing review has its own real workshop route');
const f=fixture();await f.open();await chooseOperation(f);await f.click('[data-production-view="operation"]');
assert.equal(f.query('[data-production-ledger] [data-quote-view="shop"]').hidden,false,'production opens the saved ledger on its shop pane');
assert.equal(f.query('[data-production-ledger] [data-quote-view="customer"]').hidden,true,'customer review stays hidden in the production ledger');
assert.equal(f.query('[data-production-ledger] [data-quote-pane="shop"]').getAttribute('aria-pressed'),'true');
assert.equal(f.query('[data-production-field="x"]').value,'40');
const baseline=snapshot(f.live),canvas=f.query('[data-production-canvas]').innerHTML;
await f.input('x','٦٠');assert.equal(snapshot(f.live),baseline);assert.equal(f.saves,0);assert(hasUnsavedWork());
assert.equal(f.query('.production-studio').dataset.state,'preview');
assert.notEqual(f.query('[data-production-canvas]').innerHTML,canvas,'actual machining geometry previews the new coordinate');
assert.equal(f.query('[data-production-field="x"]').value,'٦٠','precise Arabic input remains intact');
await chooseOperation(f,second);assert.equal(f.query('[data-production-field="x"]').value,'٦٠','a peer generated from the shared source sees the same pending edit');
await chooseOperation(f,first);assert.equal(f.query('[data-production-field="x"]').value,'٦٠');assert.equal(snapshot(f.live),baseline);
await f.action('undo');assert.equal(f.query('[data-production-field="x"]').value,'40');assert.deepEqual(f.history,[]);
await f.action('redo');assert.equal(f.query('[data-production-field="x"]').value,'٦٠');assert.deepEqual(f.history,[]);
await f.action('cancel');assert(!hasUnsavedWork());assert.equal(f.query('[data-production-field="x"]').value,'40');assert.equal(snapshot(f.live),baseline);
await f.input('x','60');await f.action('save');await f.ready();assert.equal(f.saves,1);assert.equal(currentOp(f.live).x,60);assert(!hasUnsavedWork());
assert(!f.query('[data-production-caption]').textContent.includes('غير محفوظة'),'saved canvas no longer claims a pending preview');
assert(buildFactoryQuote(f.live).operations.every(op=>op.x===60),'shared recipe edit updates every generated operation using that line');
assert(!catalogRecordStates(f.live.room.workshop).factory.approved,'editing manufacturing data requires factory-record review');
await f.action('undo');await f.ready();assert.deepEqual(f.history,[false]);assert.equal(currentOp(f.live).x,40);
await f.action('redo');await f.ready();assert.deepEqual(f.history,[false,true]);assert.equal(currentOp(f.live).x,60);assert.equal(f.saves,1);
console.log('Production workshop: exact shared-operation identity, Arabic live canvas preview, cancel, local history, explicit save and authoritative project undo/redo.');

// Review the edited factory record, then use the existing structural/customer
// approval handlers before the manufacturing handoff. These are separate acts.
await f.action('approve-factory');await f.ready();assert(catalogRecordStates(f.live.room.workshop).factory.approved);assert.equal(f.saves,2);
assert(!f.query('[data-production-caption]').textContent.includes('غير محفوظة'),'factory approval preserves a saved canvas caption');
await f.open('approve');f.query('[data-ws-person]').value='QA structure after machining edit';await fire('input',f.query('[data-ws-person]'));
await f.click('[data-ws-action="structure"]');await f.ready();assert((await approvalState(f.live)).valid.structure);
await f.open('sign');f.query('[data-ws-person]').value='QA customer after machining review';await fire('input',f.query('[data-ws-person]'));
const reason=f.query('[data-ws-reason]');if(reason){reason.value='مراجعة موضع عملية التشغيل في الوصفة المشتركة';await fire('input',reason);}
await f.click('[data-ws-action="customer"]');await f.ready();let state=await approvalState(f.live);assert(state.valid.customer);assert.deepEqual(releaseConcerns(f.live,state),[]);
await f.open();await f.action('release');await f.ready();assert.equal(f.workshop.screen().route,'sign');assert.equal(f.workshop.screen().focus.section,'release');
const beforeRelease=f.saves;await f.click('[data-ws-action="release"]');assert.equal(f.saves,beforeRelease,'workshop release requires the reviewer name');
f.query('[data-ws-manager]').value='QA synthetic workshop manager';await fire('input',f.query('[data-ws-manager]'));
await f.click('[data-ws-action="release"]');await f.ready();state=await approvalState(f.live);assert(state.valid.release);assert.equal(f.saves,beforeRelease+1);
assert.equal(f.live.room.workshop.approvals.release.key,state.keys.release);assert.equal(f.live.room.workshop.approvals.release.name,'QA synthetic workshop manager');
const reopened=cleanIdea(JSON.parse(JSON.stringify(f.live)));assert(reopened);assert((await approvalState(reopened)).valid.release,'the actual saved approval survives normal project reopening');
await f.open();await chooseOperation(f);await f.input('x','65');assert((await approvalState(f.live)).valid.release,'preview leaves the saved release unchanged');
await f.action('save');await f.ready();assert(!(await approvalState(f.live)).valid.release,'saved manufacturing changes invalidate the prior release');f.close();
console.log('Production workshop: factory-record review, existing structure/customer approvals, named release through the real sign route, reopen and later release invalidation.');

const invalid=fixture();await invalid.open();await chooseOperation(invalid);const invalidSource=snapshot(invalid.live);
for(const [key,value] of [['x','1'],['depth','8'],['tolerance','0.1'],['x','غير صالح'],['x',''],['reference','']]){
 await invalid.input(key,value);assert(hasUnsavedWork());assert.equal(invalid.query('.production-studio').dataset.state,'invalid',key+' invalidates the preview');
 assert(invalid.query('[data-production-action="save"]').disabled);await invalid.action('save');assert.equal(snapshot(invalid.live),invalidSource);assert.equal(invalid.saves,0);
 assert(invalid.query('[data-production-error]').textContent.trim(),'invalid machining input explains its failure');await invalid.action('cancel');
}
await invalid.input('x','70');
for(const act of ['release','approve-factory','source','material-source','quote','tracking']){await invalid.action(act);assert.equal(invalid.workshop.screen().route,'production');assert.equal(invalid.saves,0);}
invalid.workshop.open('quote');assert.equal(invalid.workshop.screen().route,'production');assert(invalid.query('[data-guide-stay]'));await invalid.click('[data-guide-stay]');
const field=invalid.query('[data-production-field="x"]'),nativeUndo=await fire('keydown',field,{key:'z',ctrlKey:true});assert(!nativeUndo.defaultPrevented,'typing retains native text undo');
const escape=await fire('keydown',field,{key:'Escape'});assert(escape.defaultPrevented&&escape.stopped);assert(!hasUnsavedWork());assert.equal(invalid.workshop.screen().route,'production');assert.equal(currentOp(invalid.live).x,40);invalid.close();
console.log('Production workshop: geometry and raw-value validation, pending approval/source/navigation guards, native typing undo and consumed Escape cancellation.');

const gesture=fixture();await gesture.open();await chooseOperation(gesture);await gesture.click('[data-production-view="operation"]');
const gestureSource=snapshot(gesture.live);
await gesture.input('x','٦٠');
async function dragTo(x,y,ending='pointerup',endPoint={x,y}){
 const marker=gesture.query('[data-production-drag="0"]'),surface=gesture.query('.production-studio');assert(marker,'actual operation drawing exposes its movable marker');
 await fire('pointerdown',marker,{pointerId:7,pointerType:'touch',clientX:60,clientY:35});
 await fire('pointermove',surface,{pointerId:7,pointerType:'touch',clientX:x,clientY:y});
 await fire('lostpointercapture',surface,{pointerId:99});assert(gesture.query('[data-production-action="cancel"]').disabled,'another pointer cannot end the active gesture');
 await fire('lostpointercapture',gesture.query('[data-production-field="x"]'),{pointerId:7});assert(gesture.query('[data-production-action="cancel"]').disabled,'capture loss on a child cannot end the box gesture');
 await fire(ending,ending==='blur'?windowNode:surface,{pointerId:7,pointerType:'touch',clientX:endPoint.x,clientY:endPoint.y});
}
for(const ending of ['pointercancel','lostpointercapture','blur']){
 await dragTo(80,50,ending);assert.equal(gesture.query('[data-production-field="x"]').value,'٦٠',ending+' restores exact raw input');assert.equal(gesture.query('[data-production-field="y"]').value,'35');
}
await dragTo(80,50,'pointerup',{x:90,y:55});assert.equal(gesture.query('[data-production-field="x"]').value,'90','release coordinates are applied even without a preceding move at that point');assert.equal(gesture.query('[data-production-field="y"]').value,'55');assert.equal(gesture.saves,0);assert.equal(snapshot(gesture.live),gestureSource);
await gesture.action('undo');assert.equal(gesture.query('[data-production-field="x"]').value,'٦٠');assert.equal(gesture.query('[data-production-field="y"]').value,'35');assert.deepEqual(gesture.history,[]);
await gesture.action('redo');assert.equal(gesture.query('[data-production-field="x"]').value,'90');assert.equal(gesture.query('[data-production-field="y"]').value,'55');
await gesture.action('cancel');assert(!hasUnsavedWork());
const append=gesture.query('select[data-production-operation]');append.value='1';await fire('change',append);await gesture.input('reference','QA new pending operation');
const appendedMarker=gesture.query('[data-production-drag="1"]');assert(appendedMarker,'valid appended operation is drawn before save');
await fire('pointerdown',appendedMarker,{pointerId:8,clientX:30,clientY:30});await fire('pointermove',gesture.query('.production-studio'),{pointerId:8,clientX:55,clientY:65});
await fire('pointerup',gesture.query('.production-studio'),{pointerId:8,clientX:60,clientY:70});assert.equal(gesture.query('[data-production-field="x"]').value,'60');assert.equal(gesture.query('[data-production-field="y"]').value,'70');
assert.equal(getFactoryCatalog(gesture.live).families.storage.recipe.find(line=>line.sku==='BODY-6').operations.length,1,'dragging a new operation still leaves the saved source unchanged');
await gesture.action('undo');assert.equal(gesture.query('[data-production-field="x"]').value,'30');assert.equal(gesture.query('[data-production-field="reference"]').value,'QA new pending operation');
await gesture.action('cancel');gesture.close();
console.log('Production workshop: touch drag previews without saving; pointercancel, capture loss and blur restore raw input; one local undo restores both coordinates.');

const precision=fixture();await precision.open();await chooseOperation(precision);await precision.click('button[data-production-view="operation"]');
for(const distance of [0,2]){
 await precision.input('x','60.123');const marker=precision.query('[data-production-drag="0"]'),surface=precision.query('.production-studio');
 await fire('pointerdown',marker,{pointerId:17,clientX:60.123,clientY:35});
 await fire('pointerup',surface,{pointerId:17,clientX:60.123+distance,clientY:35});
 assert.equal(precision.query('[data-production-field="x"]').value,'60.123','a click or sub-threshold movement preserves precise typed coordinates');
 await precision.action('undo');assert.equal(precision.query('[data-production-field="x"]').value,'40','clicking the marker adds no extra local history entry');
 assert.deepEqual(precision.history,[]);assert.equal(precision.saves,0);
}
precision.close();

const rejected=fixture();await rejected.open();await chooseOperation(rejected);await rejected.input('x','70');rejected.fail=true;
const failedSource=snapshot(rejected.live);await rejected.action('save');assert.equal(rejected.saves,0);assert.equal(snapshot(rejected.live),failedSource);assert(hasUnsavedWork());
assert.equal(rejected.query('[data-production-field="x"]').value,'70');assert.match(rejected.root.textContent,/production fixture storage denied/);
assert(!rejected.query('[data-production-action="save"]').disabled);rejected.fail=false;await rejected.action('save');await rejected.ready();assert.equal(rejected.saves,1);assert.equal(currentOp(rejected.live).x,70);assert(!hasUnsavedWork());rejected.close();
const sessionOnly=fixture();await sessionOnly.open();await chooseOperation(sessionOnly);await sessionOnly.input('x','70');sessionOnly.memoryOnly=true;
await sessionOnly.action('save');await sessionOnly.ready();assert.equal(sessionOnly.saves,1);assert.equal(currentOp(sessionOnly.live).x,70);assert.match(sessionOnly.root.textContent,/تعذّر حفظ|تعذر حفظ|الجلسة|لم يُحفظ/);sessionOnly.close();
console.log('Production workshop: rejected save retains the edit for direct retry; memory-only apply retains its persistence warning.');

const stale=fixture();await stale.open();await chooseOperation(stale);await stale.input('x','70');stale.live=copy(stale.live);const staleSource=snapshot(stale.live);
for(const act of ['save','undo','redo','approve-factory','release'])await stale.action(act);
assert.equal(stale.saves,0);assert.deepEqual(stale.history,[]);assert.equal(snapshot(stale.live),staleSource);stale.close();
for(const role of ['editor','viewer','rep','store']){
 const denied=fixture();
 // Narrow-role users cannot enter this route at all. Revoke an already-open
 // owner controller to exercise its live callback without mounting other tools.
 if(!canOpenWorkshopPage(role,'production'))await denied.open();
 bindProjectAccess(denied.live,{id:'production-workshop-remote',role,revision:1});
 if(canOpenWorkshopPage(role,'production'))await denied.open();
 const original=snapshot(denied.live);
 if(denied.workshop.screen().route==='production'){
  await chooseOperation(denied);const value=denied.query('[data-production-field="x"]');assert(value.disabled||value.readOnly);
  value.value='75';await fire('input',value);for(const act of ['save','undo','redo','approve-factory','release'])await denied.action(act);
 }
 assert.equal(denied.saves,0);assert.deepEqual(denied.history,[]);assert.equal(snapshot(denied.live),original);denied.close();
}
const revoked=fixture();await revoked.open();await chooseOperation(revoked);await revoked.input('x','75');const rawField=revoked.query('[data-production-field="x"]'),revokedSource=snapshot(revoked.live);
bindProjectAccess(revoked.live,{id:'production-workshop-remote',role:'viewer',revision:1});revoked.workshop.refreshAccess();
assert.equal(revoked.query('[data-production-field="x"]'),rawField);assert(rawField.disabled||rawField.readOnly);assert.equal(rawField.value,'75');assert(hasUnsavedWork());
for(const act of ['save','undo','redo','approve-factory','release'])await revoked.action(act);assert.equal(revoked.saves,0);assert.deepEqual(revoked.history,[]);assert.equal(snapshot(revoked.live),revokedSource);
revoked.workshop.open('quote');assert.equal(revoked.workshop.screen().route,'production');await revoked.click('[data-guide-discard]');await revoked.ready();assert.equal(revoked.workshop.screen().route,'quote');assert(!hasUnsavedWork());revoked.close();
console.log('Production workshop: stale source, denied roles and live permission revocation cannot write, approve or travel history; raw edits survive until explicit discard.');

const factory=fixture();bindProjectAccess(factory.live,{id:'production-workshop-remote',role:'factory',revision:1});await factory.open();await chooseOperation(factory);
await factory.input('x','70');await factory.action('save');await factory.ready();assert.equal(factory.saves,1);assert.equal(currentOp(factory.live).x,70);
await factory.action('approve-factory');await factory.ready();assert.equal(factory.saves,2);assert(catalogRecordStates(factory.live.room.workshop).factory.approved);
assert(factory.query('[data-production-action="release"]').disabled,'factory record review does not grant owner release authority');await factory.action('release');assert.equal(factory.workshop.screen().route,'production');assert(!(await approvalState(factory.live)).valid.release);factory.close();
console.log('Production workshop: factory collaborators can save operations and review their record while final workshop release remains owner-only.');

const twoOperations=reviewProductionPreview(initial,{pieceIndex:first.index,operationIndex:1,operation:{...currentOp(initial),x:90,y:70,reference:'QA-CNC-DRILL-02'}}).doc;
const multiple=fixture(twoOperations);await multiple.open();await chooseOperation(multiple);await multiple.input('x','70');
async function pickOperation(f,index){const select=f.query('select[data-production-operation]');assert(select);select.value=String(index);await fire('change',select);}
await multiple.click('button[data-production-view="operation"]');
await multiple.click('[data-production-canvas] [data-production-operation="1"]');
assert.equal(multiple.query('select[data-production-operation]').value,'1');assert.equal(multiple.query('[data-production-field="x"]').value,'90','SVG operation selection changes the inspector to the selected operation');
await multiple.click('[data-production-canvas] [data-production-operation="0"]');
assert.equal(multiple.query('select[data-production-operation]').value,'0');assert.equal(multiple.query('[data-production-field="x"]').value,'70','selecting the first SVG marker restores its pending values');
await pickOperation(multiple,1);assert.equal(multiple.query('[data-production-field="x"]').value,'90');await multiple.input('x','100');
await pickOperation(multiple,0);assert.equal(multiple.query('[data-production-field="x"]').value,'70');assert.equal(currentOp(multiple.live).x,40);
await multiple.action('undo');await pickOperation(multiple,1);assert.equal(multiple.query('[data-production-field="x"]').value,'90');
await multiple.action('redo');assert.equal(multiple.query('[data-production-field="x"]').value,'100');await pickOperation(multiple,0);assert.equal(multiple.query('[data-production-field="x"]').value,'70');
await multiple.action('save');await multiple.ready();const savedOps=getFactoryCatalog(multiple.live).families.storage.recipe.find(line=>line.sku==='BODY-6').operations;
assert.deepEqual(savedOps.map(op=>op.x),[70,100]);assert.equal(multiple.saves,1);assert(!hasUnsavedWork());multiple.close();
console.log('Production workshop: independent operation drafts survive selection and local undo/redo, then save together as one project change.');

const handoff=fixture();await handoff.open('quote');await handoff.click('[data-quote-object="term:delivery"]');
const price=handoff.query('[data-quote-value]');price.value='70';await fire('input',price);
await handoff.click('[data-quote-action="production"]');assert.equal(handoff.workshop.screen().route,'quote');assert(hasUnsavedWork());assert.equal(handoff.saves,0);
await handoff.click('[data-quote-action="cancel"]');await handoff.click('[data-quote-unit="'+second.piece.unitId+'"]');
await handoff.click('[data-quote-action="production"]');await handoff.ready();assert.equal(handoff.workshop.screen().route,'production');
assert.equal(handoff.workshop.screen().focus.unitId,second.piece.unitId);assert.equal(handoff.query('[data-production-unit="'+second.piece.unitId+'"]').getAttribute('aria-pressed'),'true');
assert.equal(handoff.saves,0);assert(!hasUnsavedWork());handoff.close();
console.log('Production workshop: quote edits guard the manufacturing handoff, and a clean handoff retains the chosen unit without a write.');

const returning=fixture();await returning.open();await chooseOperation(returning,second);await returning.click('button[data-production-view="cut"]');
const returnSource=snapshot(returning.live);await returning.action('source');await returning.ready();
assert.equal(returning.workshop.screen().route,'recipes');assert.equal(returning.workshop.screen().focus.family,'storage');assert.equal(returning.workshop.screen().focus.line,3);
await returning.click('[data-ws-back]');await returning.ready();assert.equal(returning.workshop.screen().route,'production');
assert.equal(returning.query('[data-production-unit="'+second.piece.unitId+'"]').getAttribute('aria-pressed'),'true','Back restores U2 rather than the initial first unit');
assert.equal(returning.query('[data-production-pieces] [data-production-piece="'+second.index+'"]').getAttribute('aria-pressed'),'true','Back restores global piece 14');
assert.equal(returning.query('button[data-production-view="cut"]').getAttribute('aria-pressed'),'true','Back restores the cut view');
assert.deepEqual(returning.workshop.screen().context,{unitId:second.piece.unitId,pieceIndex:second.index,operationIndex:0,view:'cut'});
assert.equal(snapshot(returning.live),returnSource);assert.equal(returning.saves,0);assert(!hasUnsavedWork());returning.close();
console.log('Production workshop: exact recipe source and actual Back preserve selected unit, global piece index and cut view without changing the project.');

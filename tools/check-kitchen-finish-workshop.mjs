// Mount the actual workshop router through its asynchronous approval branch.
// This catches callback/closure wiring that an isolated finish desk cannot.
import assert from 'node:assert/strict';
import {mountWorkshop} from '../public/kitchen-workshop-ui.js';
import {makeVisitExample} from './fixture-kitchen-visit-example.mjs';
import {proposeWholeKitchen} from '../public/kitchen-whole-plan.js';
import {getFactoryCatalog} from '../public/kitchen-workshop-factory.js';
import {finishMembers} from '../public/kitchen-finish-parts.js';
import {approvalState} from '../public/kitchen-workshop-state.js';
import {hasUnsavedWork} from '../public/kitchen-unsaved-work.js';
import {bindProjectAccess} from '../public/kitchen-project-access.js';
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
 get disabled(){return this.hasAttribute('disabled');}set disabled(v){v?this.setAttribute('disabled',''):this.removeAttribute('disabled');}
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
Node.prototype.remove=function(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;};
Node.prototype.getClientRects=function(){return this.isConnected&&!this.hidden?[this.getBoundingClientRect()]:[];};
Node.prototype.focus=function(){this.focused=true;this.ownerDocument.activeElement=this;};
class Store{data=new Map();getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
const windowNode=new Node('window');windowNode.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
const dom=new Node('document');dom.root=true;dom.defaultView=windowNode;dom.activeElement=null;
dom.createElement=tag=>{const node=new Node(tag);node.ownerDocument=dom;return node;};
dom.body=new Node('body',{},dom);dom.children.push(dom.body);dom.documentElement=new Node('html',{},dom);
globalThis.document=dom;globalThis.window=windowNode;

const generated=await proposeWholeKitchen(makeVisitExample(),{walls:['back']});assert(generated.ok,generated.reason);
const approved=structuredClone(generated.candidates[0].doc);approved.room.projectId='K-1234567890ABCDEF';
const signature=await approvalState(approved);
approved.room.workshop.approvals={structure:{key:signature.keys.structure,name:'Integration fixture',date:'2026-11-04'}};
assert((await approvalState(approved)).valid.structure,'the fixture enters the approved finish branch, not the approval gate');
const rice=finishMembers(approved,getFactoryCatalog(approved)).find(m=>m.family==='rice');assert(rice);
const copy=value=>structuredClone(value),snapshot=value=>JSON.stringify(value);

function fixture(){
 let live=copy(approved),saves=0,past=null,future=null,fail=false,memoryOnly=false;
 const root=dom.createElement('main'),opener=dom.createElement('button');dom.body.append(root,opener);
 const notices=[],history=[];
 const workshop=mountWorkshop(root,{getDoc:()=>live,opener,closeOthers(){},tell:value=>notices.push(value),
  apply(next){if(fail)return {ok:false,saved:false,reason:'fixture storage denied'};past=live;future=null;live=next;saves++;return {ok:true,saved:!memoryOnly};},
  canHistory:forward=>!!(forward?future:past),onHistory(forward){history.push(forward);if(forward&&future){past=live;live=future;future=null;}else if(!forward&&past){future=live;live=past;past=null;}return {ok:true,saved:true};}
 });
 const query=s=>root.querySelector(s),click=s=>fire('click',query(s));
 async function ready(){
  for(let i=0;i<150;i++){
   const screen=query('.ws-screen');
   if(screen&&!screen.hasAttribute('aria-busy')){
    assert(!query('[data-ws-retry]'),'the real workshop approval branch mounted without a scope/import error');
    return;
   }
   await new Promise(resolve=>setTimeout(resolve,2));
  }
  assert.fail('workshop asynchronous route did not finish mounting');
 }
 async function open(focus={unitId:rice.id}){workshop.open('finish',focus);await ready();assert(query('[data-finish-sku]'),'approved finish controls are reachable through mountWorkshop');}
 async function choose(sku='FACE-6-G'){const field=query('[data-finish-sku]');assert(field);field.value=sku;await fire('change',field);}
 return {root,query,click,ready,open,choose,workshop,notices,history,get live(){return live;},get saves(){return saves;},set fail(value){fail=value;},set memoryOnly(value){memoryOnly=value;},close(){workshop.close(false);root.remove();opener.remove();}};
}

const f=fixture();await f.open();const original=snapshot(f.live),screen=f.query('.ws-screen');
assert.equal(f.workshop.screen().route,'finish');assert.equal(f.workshop.screen().context.unitId,rice.id);
assert(!hasUnsavedWork());await f.choose();assert.equal(f.saves,0);assert.equal(snapshot(f.live),original);
assert(hasUnsavedWork(),'the workshop disposer exposes the finish pending state to unload protection');
f.workshop.open('guide');
assert.equal(f.workshop.screen().route,'finish','ordinary navigation waits for a pending finish preview');
assert.equal(f.query('.ws-screen'),screen);assert(f.query('[data-guide-stay]'));assert(f.query('[data-guide-discard]'));
await f.click('[data-guide-stay]');assert.equal(f.query('.ws-screen'),screen);assert(hasUnsavedWork());
let left=false;assert.equal(f.workshop.requestClose(()=>{left=true;}),false);assert(!left);assert(f.workshop.active());
await f.click('[data-guide-stay]');
await f.click('[data-finish-save]');await f.ready();
assert.equal(f.saves,1,'the real finish callback commits through the workshop apply owner');
assert.equal(f.live.room.workshop.finishes.units[rice.id].frontSku,'FACE-6-G');assert(!hasUnsavedWork());
assert.notEqual(f.query('.ws-screen'),screen,'saved finish remounts against the new project identity');
assert.equal(f.workshop.screen().route,'finish');assert.equal(f.workshop.screen().context.unitId,rice.id);
assert.equal(f.query('[data-finish-sku]').value,'FACE-6-G');
await f.click('[data-finish-undo]');await f.ready();assert.deepEqual(f.history,[false]);assert.equal(snapshot(f.live),original);assert.equal(f.query('[data-finish-sku]').value,'FACE-6-W');
await f.click('[data-finish-redo]');await f.ready();assert.deepEqual(f.history,[false,true]);assert.equal(f.live.room.workshop.finishes.units[rice.id].frontSku,'FACE-6-G');
assert.equal(f.saves,1,'project history uses its owner instead of a second finish save');
await f.choose('FACE-6-W');assert(hasUnsavedWork());f.workshop.open('guide');await f.click('[data-guide-discard]');await f.ready();
assert.equal(f.workshop.screen().route,'guide');assert(!hasUnsavedWork());assert.equal(f.live.room.workshop.finishes.units[rice.id].frontSku,'FACE-6-G');
await f.open();assert.equal(f.query('[data-finish-sku]').value,'FACE-6-G');assert(!hasUnsavedWork(),'discarded preview does not reappear on reopening');
f.close();assert(!hasUnsavedWork());
console.log('Finish workshop: actual approved async mount, pending navigation/close/unload guards, explicit project save/remount, authoritative undo/redo, discard and reopen.');

const rejected=fixture();await rejected.open();await rejected.choose();rejected.fail=true;
await rejected.click('[data-finish-save]');assert.equal(rejected.saves,0);assert(hasUnsavedWork());
assert.match(rejected.query('[data-finish-status]').textContent,/fixture storage denied/);
assert.equal(rejected.query('[data-finish-sku]').value,'FACE-6-G');
await rejected.click('[data-finish-cancel]');assert(!hasUnsavedWork(),'controller-tracked changes do not leave workshop formDirty stuck');
assert.equal(rejected.query('[data-finish-sku]').value,'FACE-6-W');rejected.close();
console.log('Finish workshop: rejected project apply returns its reason and keeps preview; cancel releases the actual workshop dirty guard.');

const sessionOnly=fixture();await sessionOnly.open();await sessionOnly.choose();sessionOnly.memoryOnly=true;
await sessionOnly.click('[data-finish-save]');await sessionOnly.ready();
assert.equal(sessionOnly.live.room.workshop.finishes.units[rice.id].frontSku,'FACE-6-G');
assert.match(sessionOnly.notices.at(-1),/تعذّر حفظه في المتصفح/,'memory-only application never claims durable save');
assert.match(sessionOnly.notices.at(-1),/نزّل ملف المشروع/);sessionOnly.close();
console.log('Finish workshop: a session-only application keeps the persistence failure visible and points to project export.');

const escape=fixture();await escape.open();await escape.choose();
await fire('keydown',escape.query('[data-finish-sku]'),{key:'Escape'});
assert(escape.workshop.active(),'Escape cancels the finish preview before dismissing the enclosing workshop');
assert(!hasUnsavedWork());assert.equal(escape.query('[data-finish-sku]').value,'FACE-6-W');assert.equal(escape.saves,0);escape.close();
console.log('Finish workshop: Escape resolves the active preview while retaining the owning workshop.');

const revoked=fixture();await revoked.open();await revoked.choose();
const revSource=snapshot(revoked.live),revField=revoked.query('[data-finish-sku]');
bindProjectAccess(revoked.live,{id:'finish-workshop-remote',role:'viewer',revision:1});revoked.workshop.refreshAccess();
assert.equal(revoked.query('[data-finish-sku]'),revField,'real workshop role change preserves the dirty editor for inspection');
assert(revField.disabled);assert(hasUnsavedWork());assert(revoked.query('[data-access-continue]'));
await revoked.click('[data-finish-save]');await revoked.click('[data-finish-confirm]');await revoked.click('[data-finish-undo]');
revField.value='FACE-6-W';await fire('change',revField);
assert.equal(revoked.saves,0);assert.deepEqual(revoked.history,[]);assert.equal(snapshot(revoked.live),revSource);
assert.equal(revoked.query('[data-finish-sku]'),revField);assert(revField.disabled);
revoked.workshop.open('guide');assert.equal(revoked.workshop.screen().route,'finish');
await revoked.click('[data-guide-discard]');await revoked.ready();assert.equal(revoked.workshop.screen().route,'guide');assert(!hasUnsavedWork());
bindProjectAccess(revoked.live,{id:'finish-workshop-remote',role:'owner',revision:1});revoked.close();
console.log('Finish workshop: live role revocation freezes the pending editor, blocks preview/save/history, and requires explicit discard to navigate.');



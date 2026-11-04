// Actual workshop quote/edit/save/customer-approval journey. The parsed event
// harness is copied from finish-workshop; production calculation and routing
// remain real, including async approval loading and capture-phase guards.
import assert from 'node:assert/strict';
import {mountWorkshop} from '../public/kitchen-workshop-ui.js';
import {makeQuoteReadyFixture} from './fixture-kitchen-quote-ready.mjs';
import {getFactoryCatalog,buildFactoryQuote} from '../public/kitchen-workshop-factory.js';
import {approvalState} from '../public/kitchen-workshop-state.js';
import {hasUnsavedWork} from '../public/kitchen-unsaved-work.js';
import {bindProjectAccess} from '../public/kitchen-project-access.js';
import {cleanIdea} from '../public/kitchen-ideas.js';
import {budgetHold} from '../public/kitchen-layout-brief.js';
import {applyChain} from '../public/kitchen-chain-model.js';
import {applyWorkshopCorner} from '../public/kitchen-production-row.js';
import {createKitchen} from '../public/kitchen-model.js';
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
Node.prototype.remove=function(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;};
Node.prototype.getClientRects=function(){return this.isConnected&&!this.hidden?[this.getBoundingClientRect()]:[];};
Node.prototype.focus=function(){this.focused=true;this.ownerDocument.activeElement=this;};
Node.prototype.showModal=function(){this.open=true;};
Node.prototype.close=function(){this.open=false;return fire('close',this);};
class Store{data=new Map();getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
const windowNode=new Node('window');windowNode.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
const dom=new Node('document');dom.root=true;dom.defaultView=windowNode;dom.activeElement=null;
dom.createElement=tag=>{const node=new Node(tag);node.ownerDocument=dom;return node;};
dom.body=new Node('body',{},dom);dom.children.push(dom.body);dom.documentElement=new Node('html',{},dom);
globalThis.document=dom;globalThis.window=windowNode;

dom.head=new Node('head',{},dom);dom.children.push(dom.head);
const reportBlobs=[],originalCreateURL=URL.createObjectURL,originalRevokeURL=URL.revokeObjectURL;
URL.createObjectURL=blob=>{reportBlobs.push(blob);return 'blob:quote-workshop-'+reportBlobs.length;};URL.revokeObjectURL=()=>{};
const copy=value=>structuredClone(value),snapshot=value=>JSON.stringify(value),money=value=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(value);
const fresh=await makeQuoteReadyFixture(),signed=await makeQuoteReadyFixture({structureApproved:true});

function fixture(initial=signed){
 globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
 let live=copy(initial),saves=0,past=[],future=[],fail=false,memoryOnly=false;
 const root=dom.createElement('main'),opener=dom.createElement('button');dom.body.append(root,opener);
 const notices=[],history=[];
 const workshop=mountWorkshop(root,{getDoc:()=>live,opener,closeOthers(){},tell:value=>notices.push(value),
  apply(next){if(fail)return {ok:false,saved:false,reason:'quote fixture storage denied'};past.push(live);future=[];live=next;saves++;return {ok:true,saved:!memoryOnly};},
  canHistory:forward=>!!(forward?future.length:past.length),onHistory(forward){history.push(forward);if(forward&&future.length){past.push(live);live=future.pop();}else if(!forward&&past.length){future.push(live);live=past.pop();}return {ok:true,saved:true};}
 });
 const query=s=>root.querySelector(s),click=s=>fire('click',typeof s==='string'?query(s):s),action=name=>click('[data-quote-action="'+name+'"]');
 async function ready(){
  for(let i=0;i<250;i++){
   const screen=query('.ws-screen');
   if(screen&&!screen.hasAttribute('aria-busy')){assert(!query('[data-ws-retry]'),'actual workshop route mounts without a closure/import error');return;}
   await new Promise(resolve=>setTimeout(resolve,2));
  }assert.fail('workshop asynchronous route did not finish mounting');
 }
 async function open(route='quote',focus={}){workshop.open(route,focus);await ready();if(route==='quote'&&workshop.screen()?.route==='quote')assert(query('[data-quote-action="save"]'),'actual workshop route exposes the quote studio');}
 const select=id=>click('[data-quote-object="'+id+'"]');
 async function input(raw){const field=query('[data-quote-value]');assert(field,'quote inspector supplies its selected value');field.value=raw;await fire(field.tagName==='SELECT'?'change':'input',field);return field;}
 async function name(value='عميل اختبار آلي'){const field=query('[data-ws-person]');assert(field,'approval is actually allowed and exposes the name field');field.value=value;await fire('input',field);}
 return {root,query,click,action,ready,open,select,input,name,workshop,notices,history,get live(){return live;},set live(value){live=value;},get saves(){return saves;},set fail(value){fail=value;},set memoryOnly(value){memoryOnly=value;},close(){workshop.close(false);root.remove();opener.remove();}};
}
function displayedTotal(f,expected){
 const total=f.query('[data-quote-total]')||f.query('.kq-total');assert(total,'quote exposes its calculated total');
 assert(total.textContent.includes(money(expected)),'displayed quote total follows the actual calculator: '+expected);
}

// Do not pre-sign the happy path: use the real structure approval handler.
const f=fixture(fresh);await f.open('approve');await f.name('QA structure through UI');
await f.click('[data-ws-action="structure"]');await f.ready();assert.equal(f.workshop.screen().route,'finish');
assert((await approvalState(f.live)).valid.structure);assert.equal(f.saves,1);
await f.open();const base=snapshot(f.live);displayedTotal(f,1060);
await f.select('term:delivery');assert.equal(f.query('[data-quote-value]').value,'20');
await f.input('٦٠');displayedTotal(f,1100);assert.equal(snapshot(f.live),base);assert.equal(f.saves,1);assert(hasUnsavedWork());
await f.select('term:labor');await f.input('200');displayedTotal(f,1200);
await f.select('term:delivery');assert.equal(f.query('[data-quote-value]').value,'٦٠','switching inspected object retains raw Arabic text');
await f.select('term:labor');await f.action('undo');assert.equal(f.query('[data-quote-value]').value,'100');displayedTotal(f,1100);assert.deepEqual(f.history,[]);
await f.action('redo');assert.equal(f.query('[data-quote-value]').value,'200');displayedTotal(f,1200);assert.deepEqual(f.history,[]);
await f.action('cancel');assert(!hasUnsavedWork());displayedTotal(f,1060);assert.equal(snapshot(f.live),base);
await f.select('term:delivery');await f.input('60');await f.action('save');await f.ready();
assert.equal(f.saves,2);assert.equal(buildFactoryQuote(f.live).total,1100);assert.equal(getFactoryCatalog(f.live).terms.delivery,60);assert(!hasUnsavedWork());
assert((await approvalState(f.live)).valid.structure,'commercial terms do not change physical structure approval');
await f.action('undo');await f.ready();assert.deepEqual(f.history,[false]);assert.equal(buildFactoryQuote(f.live).total,1060);
await f.action('redo');await f.ready();assert.deepEqual(f.history,[false,true]);assert.equal(buildFactoryQuote(f.live).total,1100);assert.equal(f.saves,2);
console.log('Quote workshop: actual structure approval, multi-object numeric preview, native Arabic raw text, cancel, local undo/redo, explicit save and authoritative history.');

// Invalid input stays pending and cannot be sent to approval or the old ledger.
await f.select('term:delivery');await f.input('خطأ');assert(hasUnsavedWork());assert(f.query('[data-quote-action="save"]').disabled);
const saved=snapshot(f.live);await f.action('save');assert.equal(snapshot(f.live),saved);assert.equal(f.saves,2);
await f.action('approve');assert.equal(f.workshop.screen().route,'quote');
if(f.query('[data-guide-stay]'))await f.click('[data-guide-stay]');
f.workshop.open('sign');assert.equal(f.workshop.screen().route,'quote');assert(f.query('[data-guide-discard]'));
await f.click('[data-guide-stay]');assert.equal(f.query('[data-quote-value]').value,'خطأ');
const nativeUndo=await fire('keydown',f.query('[data-quote-value]'),{key:'z',ctrlKey:true});assert(!nativeUndo.defaultPrevented,'field editing keeps its native undo');
await f.action('cancel');assert(!hasUnsavedWork());
await f.action('approve');await f.ready();assert.equal(f.workshop.screen().route,'sign');
assert(!f.query('[data-ws-action="customer"]').disabled);await f.name();await f.click('[data-ws-action="customer"]');await f.ready();
let state=await approvalState(f.live);assert(state.valid.customer);assert.equal(f.live.room.workshop.versions.length,1);
assert.equal(f.live.room.workshop.versions[0].total,1100);assert.equal(f.live.room.workshop.versions[0].key,state.keys.customer);assert.equal(f.saves,3);
assert(!state.valid.release,'customer approval cannot grant manufacturing release');
console.log('Quote workshop: invalid draft/ordinary navigation guards and the actual customer approval write a numbered version only from the saved complete quote.');

// Price changes retain geometry, invalidate the customer key, and require a new
// reason when the owner records the second customer-approved version.
await f.open();const approvedUnits=snapshot(f.live.kitchen.units);
await f.select('sku:FACE-6-W');await f.input('150');displayedTotal(f,1200);assert((await approvalState(f.live)).valid.customer,'preview cannot invalidate a saved approval');
assert(f.query('[data-quote-objects] [data-quote-object="sku:FACE-6-W"]').textContent.includes(money(150)),'sidebar price follows the live preview before save or reselection');
assert(f.query('[data-quote-costs] [data-quote-object="sku:FACE-6-W"]').textContent.includes(money(150)),'cost row unit price agrees with the sidebar and inspector');
await f.action('save');await f.ready();state=await approvalState(f.live);
assert.equal(snapshot(f.live.kitchen.units),approvedUnits);assert(state.valid.structure);assert(!state.valid.customer);assert.equal(f.saves,4);
await f.action('approve');await f.ready();await f.name();
assert(f.query('[data-ws-reason]'),'second approval exposes the mandatory change reason');
await f.click('[data-ws-action="customer"]');assert.equal(f.saves,4);assert.equal(f.live.room.workshop.versions.length,1);
assert.match(f.query('.ws-notice').textContent,/سبب/);
f.query('[data-ws-reason]').value='طلب العميل تغيير سعر خام الواجهة في العرض التجريبي';await fire('input',f.query('[data-ws-reason]'));
await f.click('[data-ws-action="customer"]');await f.ready();
assert.equal(f.saves,5);assert.equal(f.live.room.workshop.versions.length,2);assert.equal(f.live.room.workshop.versions[1].total,1200);
assert((await approvalState(f.live)).valid.customer);assert(!hasUnsavedWork());
const reopened=cleanIdea(JSON.parse(JSON.stringify(f.live)));assert(reopened);assert.equal(reopened.room.workshop.versions.length,2);assert((await approvalState(reopened)).valid.customer);
f.close();assert(!hasUnsavedWork());
console.log('Quote workshop: saved SKU price edit preserves geometry, invalidates only the relevant approval, requires the second-version reason and survives project reopen.');

// Unknown and zero are different financial facts; pending invalid text must
// never be normalized silently to either one.
const numbers=fixture();await numbers.open();await numbers.select('term:delivery');
await numbers.input('0');displayedTotal(numbers,1040);await numbers.action('save');await numbers.ready();
assert.equal(getFactoryCatalog(numbers.live).terms.delivery,0);assert(buildFactoryQuote(numbers.live).complete);
await numbers.select('term:delivery');await numbers.input('');assert(hasUnsavedWork());
await numbers.action('save');await numbers.ready();assert.equal(getFactoryCatalog(numbers.live).terms.delivery,null);assert.equal(buildFactoryQuote(numbers.live).total,null);
assert(numbers.query('[data-quote-action="approve"]').disabled,'incomplete quote cannot advance as an approvable offer');
await numbers.action('approve');assert.equal(numbers.workshop.screen().route,'quote');
await numbers.open('sign');assert(numbers.query('[data-ws-action="customer"]').disabled);assert(!numbers.live.room.workshop.versions);
numbers.close();
console.log('Quote workshop: explicit zero remains priced, blank remains unknown after save, and unknown totals block customer approval.');

// The sign page must enforce each readiness gate on the actual current doc.
for(const gate of ['structure','price','fitout','budget','collision']){
 let blocked=copy(signed);
 if(gate==='structure')delete blocked.room.workshop.approvals;
 if(gate==='price')blocked.room.workshop.storeCatalog.items.find(i=>i.sku==='AL-20').price=null;
 if(gate==='fitout')delete blocked.room.workshop.upstand;
 if(gate==='budget')blocked.room.workshop.layoutBrief={mode:'fixed',reference:'QA fixed cap',capSar:1,extraSar:0,scope:'test kitchen',weights:{contract:1,storage:0,travel:0,cuts:0,alignment:0}};
 if(gate==='collision'){
  const chain=copy(blocked.room.workshop.chains.back);chain.rows.find(row=>row.kind==='window').bottomMm=200;
  const measured=applyChain(blocked,'back',chain);assert(measured.ok,measured.reason);assert(measured.designConflicts.length);
  blocked=measured.doc;
  // Isolate the opening review gate even if a caller supplies a matching
  // structure stamp: the customer action still cannot approve the conflict.
  blocked.room.workshop.approvals.structure.key=(await approvalState(blocked)).keys.structure;
 }
 const state=await approvalState(blocked);
 if(gate==='price')assert(!state.quote.complete);
 if(gate==='fitout')assert(state.quote.fitoutPending?.length);
 if(gate==='budget')assert(budgetHold(state.quote,blocked.room.workshop.layoutBrief));
 if(gate==='collision')assert(state.designReview);
 const b=fixture(blocked);await b.open('sign');assert(b.query('[data-ws-action="customer"]').disabled,gate+' blocks the actual customer action');
 const before=snapshot(b.live);await b.click('[data-ws-action="customer"]');assert.equal(snapshot(b.live),before);assert.equal(b.saves,0);assert(!b.live.room.workshop.versions);b.close();
}
console.log('Quote workshop: missing structure, unknown price, unresolved fitout, fixed-budget excess and a measured opening conflict cannot create customer versions.');

const rejected=fixture();await rejected.open();await rejected.select('term:delivery');await rejected.input('70');rejected.fail=true;
const rejectedSource=snapshot(rejected.live);await rejected.action('save');
assert.equal(rejected.saves,0);assert.equal(snapshot(rejected.live),rejectedSource);assert(hasUnsavedWork());assert.match(rejected.root.textContent,/quote fixture storage denied/);
assert.equal(rejected.query('[data-quote-value]').value,'70');assert(!rejected.query('[data-quote-action="save"]').disabled,'a transient save failure remains directly retryable');
rejected.fail=false;await rejected.action('save');await rejected.ready();assert.equal(rejected.saves,1);assert.equal(getFactoryCatalog(rejected.live).terms.delivery,70);assert(!hasUnsavedWork());rejected.close();
const sessionOnly=fixture();await sessionOnly.open();await sessionOnly.select('term:delivery');await sessionOnly.input('70');sessionOnly.memoryOnly=true;
await sessionOnly.action('save');await sessionOnly.ready();assert.equal(sessionOnly.saves,1);assert.equal(getFactoryCatalog(sessionOnly.live).terms.delivery,70);
assert.match(sessionOnly.root.textContent,/تعذّر حفظ|تعذر حفظ|الجلسة|لم يُحفظ/,'memory-only apply must retain its persistence warning');sessionOnly.close();
console.log('Quote workshop: failed save retains raw edits and retries without retyping; a session-only application keeps its persistence warning visible.');

const stale=fixture();await stale.open();await stale.select('term:delivery');await stale.input('70');
stale.live=copy(stale.live);const replacement=snapshot(stale.live);await stale.action('save');assert.equal(stale.saves,0);assert.equal(snapshot(stale.live),replacement);
await stale.action('undo');assert.deepEqual(stale.history,[]);stale.close();
for(const role of ['viewer','editor','rep','store','factory']){
 const r=fixture();bindProjectAccess(r.live,{id:'quote-workshop-remote',role,revision:1});await r.open();
 const before=snapshot(r.live);await r.select('term:delivery');
 const value=r.query('[data-quote-value]');if(value){value.value='90';await fire('input',value);}
 await r.action('save');await r.action('undo');assert.equal(snapshot(r.live),before);assert.equal(r.saves,0);assert.deepEqual(r.history,[]);r.close();
}
const revoked=fixture();await revoked.open();await revoked.select('term:delivery');await revoked.input('75');
const revBefore=snapshot(revoked.live),revField=revoked.query('[data-quote-value]');
bindProjectAccess(revoked.live,{id:'quote-workshop-remote',role:'viewer',revision:1});revoked.workshop.refreshAccess();
assert.equal(revoked.query('[data-quote-value]'),revField);assert(revField.readOnly||revField.disabled);assert(hasUnsavedWork());
await revoked.action('save');await revoked.action('undo');await revoked.action('redo');assert.equal(revoked.saves,0);assert.deepEqual(revoked.history,[]);assert.equal(snapshot(revoked.live),revBefore);
assert.equal(revoked.query('[data-quote-value]'),revField);revoked.workshop.open('guide');assert.equal(revoked.workshop.screen().route,'quote');
await revoked.click('[data-guide-discard]');await revoked.ready();assert.equal(revoked.workshop.screen().route,'guide');assert(!hasUnsavedWork());revoked.close();
console.log('Quote workshop: stale source, all non-owner roles and live role revocation cannot write or travel history; frozen edits survive until explicit discard.');

// Exercise the actual report generator and nested legacy ledger. Report URLs
// are captured as Blobs; no browser, download, or production method is stubbed.
const reports=fixture();await reports.open();const reportSource=snapshot(reports.live);
let reportCount=reportBlobs.length;
await reports.action('preview');assert.equal(reportBlobs.length,reportCount+1);
let html=await reportBlobs.at(-1).text();assert.match(html,/عرض التصميم المحفوظ/);assert(html.includes(money(1060)));
await dom.querySelector('.customer-preview').close();
await reports.select('term:delivery');await reports.input('70');reportCount=reportBlobs.length;
await reports.action('preview');assert.equal(reportBlobs.length,reportCount+1);
html=await reportBlobs.at(-1).text();assert.match(html,/مقترح لمراجعة العميل/);assert(html.includes(money(1110)));
assert.equal(snapshot(reports.live),reportSource);assert.equal(reports.saves,0);assert(hasUnsavedWork());
await dom.querySelector('.customer-preview').close();reportCount=reportBlobs.length;
for(const selector of ['[data-factory-act="customerPreview"]','[data-factory-act="sale"]']){
 const event=await reports.click(selector);assert(event.defaultPrevented&&event.immediateStopped,'pending preview intercepts the saved ledger before its handler');
 assert.equal(reportBlobs.length,reportCount);assert.equal(snapshot(reports.live),reportSource);
}
await reports.action('cancel');
await reports.click('[data-factory-act="customerPreview"]');assert.equal(reportBlobs.length,reportCount+1,'clean saved ledger still opens the actual report');
await dom.querySelector('.customer-preview').close();reports.close();

for(const selector of ['[data-factory-act="customerPreview"]','[data-quote-action="preview"]']){
 const race=fixture();await race.open();const button=race.query(selector);reportCount=reportBlobs.length;
 let started=false;
 // Both production report handlers disable their initiating button immediately
 // before awaiting imports. Replace the source at exactly that observable point.
 button.onDisabledChange=value=>{if(value&&!started){started=true;race.live=copy(race.live);}};
 await race.click(button);assert(started,'the actual async report handler started on the current project');
 assert.equal(reportBlobs.length,reportCount,'stale async report cannot create an output URL');assert(!dom.querySelector('.customer-preview'));
 assert.equal(race.saves,0);race.close();
}
for(const selector of ['[data-factory-act="customerPreview"]','[data-quote-action="preview"]']){
 const race=fixture();await race.open();await race.select('term:delivery');const button=race.query(selector);reportCount=reportBlobs.length;
 let inputEvent=null;
 button.onDisabledChange=value=>{if(value&&!inputEvent)inputEvent=race.input('70');};
 await race.click(button);assert(inputEvent,'report starts before the local edit');await inputEvent;
 assert(hasUnsavedWork());assert.equal(getFactoryCatalog(race.live).terms.delivery,20,'the local edit leaves source identity and data unchanged');
 assert.equal(reportBlobs.length,reportCount,'an edit started during async reporting invalidates the pending report');assert(!dom.querySelector('.customer-preview'));
 race.close();
}
const cornerRoom={width:500,length:500,height:270,projectId:'K-636F726E65723031',name:'ركن اختبار مستقل'};
const corner=applyWorkshopCorner({room:cornerRoom,kitchen:createKitchen(cornerRoom,'empty')},'back+left',{a:'back',b:'left',tall:false,
 base:{aMm:1000,bMm:1000,inside:'shelves',access:'a',sku:'',body:{depthAMm:500,depthBMm:500,bottomMm:0,heightMm:800,reference:'Synthetic corner measurement'}}});
assert(corner.ok,corner.reason);assert.equal(corner.doc.kitchen.units.length,0);
const cornerReport=fixture(corner.doc);await cornerReport.open();assert(!cornerReport.query('[data-quote-action="preview"]').disabled,'a real corner-only design supports customer preview');
reportCount=reportBlobs.length;await cornerReport.action('preview');assert.equal(reportBlobs.length,reportCount+1);assert.match(await reportBlobs.at(-1).text(),/ركن اختبار مستقل/);
await dom.querySelector('.customer-preview').close();assert.equal(cornerReport.saves,0);cornerReport.close();
URL.createObjectURL=originalCreateURL;URL.revokeObjectURL=originalRevokeURL;
console.log('Quote workshop: saved, draft and corner-only customer reports work; pending ledger actions, replaced source and local edits during async reporting create no stale output.');


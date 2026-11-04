// Maintenance controller + actual workshop routing over real bundled jobs APIs.
// DOM harness copied from delivery-studio; all project/receipt records are synthetic.
import assert from 'node:assert/strict';
import {mountWorkshop} from '../public/kitchen-workshop-ui.js';
import {mountMaintenanceStudio} from '../public/kitchen-maintenance-studio.js';
import {hasUnsavedWork} from '../public/kitchen-unsaved-work.js';
import {createMaintenanceReviewFixture} from '../scripts/serve-maintenance-review.mjs';
import {mountScopedWorkspace} from '../public/kitchen-scoped-workspace.js';
import {projectView} from '../public/kitchen-project-scope.js';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
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
 get value(){if(this._value!==undefined)return this._value;if(this.tagName==='TEXTAREA')return this.textContent;if(this.tagName==='SELECT'){const options=this.querySelectorAll('option');return (options.find(n=>n.hasAttribute('selected'))||options[0])?.getAttribute('value')??'';}return this.getAttribute('value')??'';}
 set value(v){this._value=String(v);}
 get disabled(){return this.hasAttribute('disabled');}set disabled(v){v?this.setAttribute('disabled',''):this.removeAttribute('disabled');this.onDisabledChange?.(!!v);}
 get options(){return this.querySelectorAll('option');}
 get name(){return this.getAttribute('name')||'';}
 get type(){return this.getAttribute('type')||'';}
 get checked(){return this._checked??this.hasAttribute('checked');}set checked(v){this._checked=!!v;}
 get elements(){return this.querySelectorAll('input,textarea,select,button');}
 get hidden(){return this.hasAttribute('hidden');}set hidden(v){v?this.setAttribute('hidden',''):this.removeAttribute('hidden');}
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
Node.prototype.prepend=function(...nodes){for(const node of nodes){node.remove?.();if(typeof node!=='string')node.parentNode=this;}this.children.unshift(...nodes);};
Node.prototype.replaceChildren=function(...nodes){this.detach();this.children=[];this.append(...nodes);};
Node.prototype.insertAdjacentHTML=function(position,html){assert.equal(position,'beforeend');const fragment=new Node();fragment.innerHTML=html;this.append(...fragment.children);};
Node.prototype.remove=function(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;};
Node.prototype.before=function(node){const parent=this.parentNode;if(!parent)return;node.remove?.();node.parentNode=parent;parent.children.splice(parent.children.indexOf(this),0,node);};
Node.prototype.getClientRects=function(){return this.isConnected&&!this.hidden?[this.getBoundingClientRect()]:[];};
Node.prototype.focus=function(){this.focused=true;this.ownerDocument.activeElement=this;};
Node.prototype.showModal=function(){this.open=true;};
Node.prototype.close=function(){this.open=false;return fire('close',this);};
class Store{data=new Map();get length(){return this.data.size;}key(i){return [...this.data.keys()][i]??null;}getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
const windowNode=new Node('window');windowNode.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
globalThis.addEventListener=(...args)=>windowNode.addEventListener(...args);globalThis.removeEventListener=(...args)=>windowNode.removeEventListener(...args);
const dom=new Node('document');dom.root=true;dom.defaultView=windowNode;dom.activeElement=null;
dom.createElement=tag=>{const node=new Node(tag);node.ownerDocument=dom;return node;};
dom.body=new Node('body',{},dom);dom.children.push(dom.body);dom.documentElement=new Node('html',{},dom);
globalThis.document=dom;globalThis.window=windowNode;
globalThis.CSS={escape:value=>String(value).replace(/[^\w-]/g,'\\$&')};

dom.head=new Node('head',{},dom);dom.children.push(dom.head);
const copy=value=>structuredClone(value),snapshot=value=>JSON.stringify(value);

// Only native form serialization is substituted for synthetic DOM nodes; Request,
// Response, API handlers, archive validators, SQLite and stored events are real.
const NativeFormData=globalThis.FormData;
globalThis.FormData=class extends NativeFormData{constructor(form){super();if(form)for(const field of form.elements){if(!field.name||field.disabled||['submit','button','reset'].includes(field.type)||['checkbox','radio'].includes(field.type)&&!field.checked)continue;this.append(field.name,field.value);}}};
let apiFixture,actor='owner',requests=[],readFailure=0,afterJobPost=null,inFlight=0;
globalThis.fetch=async(path,options={})=>{
 const url=new URL(path,apiFixture.seed.origin),headers=new Headers(options.headers||{});
 headers.set('Cookie','maintenance_review_actor='+actor);if(options.method==='POST')headers.set('Origin',apiFixture.seed.origin);
 const request=new Request(url,{...options,headers});requests.push({actor,subject:headers.get('X-Studio-Subject'),path:url.pathname,query:Object.fromEntries(url.searchParams),method:request.method,body:options.body?JSON.parse(options.body):undefined});
 inFlight++;try{
  if(url.pathname==='/api/jobs'&&request.method==='GET'&&url.searchParams.has('receipt')&&readFailure){readFailure--;return Response.json({error:'Synthetic receipt reload failure.'},{status:503});}
  const result=await apiFixture.handle(request);if(url.pathname==='/api/jobs'&&request.method==='POST'&&afterJobPost){const callback=afterJobPost;afterJobPost=null;await callback(result);}return result;
 }finally{inFlight--;}
};
const pause=()=>new Promise(resolve=>setTimeout(resolve,3));
async function settle(){for(let i=0,quiet=0;i<400;i++){await pause();quiet=inFlight?0:quiet+1;if(quiet>=4)return;}assert.fail('API work settles within the bounded test window');}
async function until(test,message){for(let i=0;i<300;i++){if(test())return;await pause();}assert.fail(message);}
const savedEvents=()=>apiFixture.snapshot().events;
const unitEvents=id=>savedEvents().filter(event=>event.unit===id);
const fault=mode=>apiFixture.handle(new Request(apiFixture.seed.origin+'/__fixture/fault',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode})}));
async function resetApi(){apiFixture?.close();apiFixture=await createMaintenanceReviewFixture();readFailure=0;afterJobPost=null;}
async function start({as='owner',store,workshop=false}={}){
 actor=as;requests=[];globalThis.localStorage=store||new Store();globalThis.sessionStorage=new Store();
 const host=dom.createElement('main');dom.body.append(host);const notices=[],advance=[];let editable=true,localSaves=0,controller,shell;
 if(workshop){shell=mountWorkshop(host,{getDoc:()=>apiFixture.doc,closeOthers(){},apply(){localSaves++;return {ok:true,saved:true};},tell:value=>notices.push(value),canHistory:()=>false});shell.open('maintenance');await until(()=>host.querySelector('[data-ms-context="project"]'),'real workshop mounts tracking');}
 else controller=mountMaintenanceStudio(host,{tell:value=>notices.push(value),onAdvance:route=>advance.push(route),canEdit:()=>editable});
 await until(()=>host.querySelector('[data-ms-context="project"]'),'delivery project selection loads');await settle();
 const query=selector=>host.querySelector(selector);
 async function choose(kind,value){const field=query('[data-ms-context="'+kind+'"]');assert(field,kind+' selection is rendered');field.value=value;await fire('change',field);await settle();}
 async function select(unit=apiFixture.seed.activeWarrantyUnitId){await choose('project',apiFixture.seed.projectId);await choose('receipt',apiFixture.seed.receipt);await choose('unit',unit);}
 const input=async(selector,value)=>{const field=query(selector);assert(field,'input exists: '+selector);field.value=value;await fire(field.tagName==='SELECT'?'change':'input',field);return field;};
 const action=async name=>{await fire('click',query('[data-ms-action="'+name+'"]'));await settle();};
 const submit=async()=>{await fire('submit',query('[data-ms-form]'));await settle();};
 return {host,query,choose,select,input,action,submit,notices,advance,shell,get controller(){return controller;},get localSaves(){return localSaves;},set editable(value){editable=value;},close(){controller?.destroy?.();shell?.close(false);host.remove();}};
}

const field=(f,name,value)=>f.input('[data-ms-field="'+name+'"]',value);
const ticketEvents=id=>savedEvents().filter(event=>event.data.ticket?.id===id||event.data.ticketId===id);
const ticketButton=(f,id)=>f.query('[data-ms-ticket="'+id+'"]');
async function chooseTicket(f,id){await fire('click',ticketButton(f,id));await settle();}
async function openDraft(f,title='Synthetic sticking door'){
 await f.action('new');await field(f,'title',title);await field(f,'description','Synthetic after-sales report; no actual customer or service visit.');await field(f,'priority','normal');
 const plane=f.query('[data-delivery-plane]');assert(plane,'actual receipt dimensions provide an anchorable unit drawing');await fire('click',plane,{clientX:180,clientY:240});
}
async function createTicket(f,title){await openDraft(f,title);await f.submit();const event=unitEvents(f.query('[data-ms-context="unit"]').value).at(-1);assert.equal(event.action,'service-open',JSON.stringify(f.notices));return event.data.ticket.id;}
async function next(f,expected){await f.action('next');assert.equal(f.query('[data-ms-form]')?.dataset.msForm,expected,'the selected ticket exposes its actual next service action');}

try{
 const coldModules={
  'kitchen-workspace-entry.js':'export const openWorkspace=async start=>start();',
  'kitchen-scoped-client.js':'export const bootstrapSharedWorkspace=async()=>false;',
  'kitchen-project.js':'export const hasKitchenSource=()=>false, storedKitchenProject=()=>null, saveProject=()=>true;',
  'kitchen-project-switch.js':'export const newVisitRequested=()=>false,clearNewVisitRequest=()=>{};',
  'kitchen-device-catalog.js':'export const withDeviceCatalog=doc=>doc;',
  'kitchen-library-store.js':'export const loadLibraries=async()=>{};',
  'kitchen-editor.js':'globalThis.__maintenanceCold.editor++;',
  'kitchen-visit-start.js':'export const mountVisitStart=()=>globalThis.__maintenanceCold.intake++;',
  'kitchen-viewport.js':'export const rememberKitchenViewport=()=>{};'
 };
 const cold=await build({entryPoints:[fileURLToPath(new URL('../public/kitchen-app.js',import.meta.url))],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'cold-host-modules',setup(b){b.onResolve({filter:/kitchen-[\w-]+\.js$/},args=>args.kind==='entry-point'?null:Object.hasOwn(coldModules,args.path.split('/').at(-1))?{path:args.path.split('/').at(-1),namespace:'cold-host'}:null);b.onLoad({filter:/.*/,namespace:'cold-host'},args=>({contents:coldModules[args.path]}));}}]});
 const priorLocation=globalThis.location;
 for(const [step,expected] of [['maintenance',{editor:1,intake:0}],['whole',{editor:0,intake:1}]]){globalThis.__maintenanceCold={editor:0,intake:0};globalThis.location={href:'http://127.0.0.1:8767/index.html?panel=workshop&step='+step};await import('data:text/javascript;base64,'+Buffer.from(cold.outputFiles[0].text+'\n// cold '+step).toString('base64'));assert.deepEqual(globalThis.__maintenanceCold,expected,'actual cold-entry routing for '+step);}
 if(priorLocation===undefined)delete globalThis.location;else globalThis.location=priorLocation;delete globalThis.__maintenanceCold;
 console.log('Maintenance cold entry: actual application bootstrap opens maintenance without a local drawing, while a new design still uses visit intake.');
 apiFixture=await createMaintenanceReviewFixture();
 const cookieUrl=apiFixture.seed.origin+'/api/jobs?'+new URLSearchParams({id:apiFixture.seed.projectId,receipt:apiFixture.seed.receipt});
 const oldCookie=await apiFixture.handle(new Request(cookieUrl,{headers:{Cookie:'delivery_review_actor=outside'}}));assert.equal(oldCookie.status,200);assert.equal((await oldCookie.json()).subject,'delivery-review-owner','8767 ignores the previous deliverable’s identity cookie');
 const ownCookie=await apiFixture.handle(new Request(cookieUrl,{headers:{Cookie:'delivery_review_actor=owner; maintenance_review_actor=factory'}}));assert.equal((await ownCookie.json()).subject,'delivery-review-factory');
 const f=await start();await f.select();const baseline=snapshot(savedEvents());
 await openDraft(f);assert(f.controller.hasPending());assert.equal(snapshot(savedEvents()),baseline);assert(!requests.some(request=>request.method==='POST'));
 assert(f.query('.dl-draft-pin'),'a draft ticket previews its position on the real receipt unit');
 const nativeUndo=await fire('keydown',f.query('[data-ms-field="title"]'),{key:'z',ctrlKey:true});assert(!nativeUndo.defaultPrevented);
 await f.action('undo');await f.action('redo');assert(f.query('.dl-draft-pin'));await f.action('discard');assert(!f.controller.hasPending());assert.equal(snapshot(savedEvents()),baseline);
 await openDraft(f,'Persisted maintenance draft');await f.action('save');const store=globalThis.localStorage;assert(!f.controller.hasPending());assert.equal(snapshot(savedEvents()),baseline);f.close();
 const restored=await start({store});await restored.select();assert.equal(restored.query('[data-ms-field="title"]').value,'Persisted maintenance draft');assert(restored.query('.dl-draft-pin'));restored.close();
 const different=await start({as:'factory',store});await different.select();await different.action('new');assert.equal(different.query('[data-ms-field="title"]').value,'','drafts do not cross authenticated subjects');different.close();
 console.log('Maintenance studio: receipt-bound anchored preview, native text undo, local undo/redo/discard, explicit draft save/reopen and subject isolation.');

 await resetApi();const invalid=await start();await invalid.select();await openDraft(invalid,'');const invalidCount=savedEvents().length;await invalid.submit();assert.equal(savedEvents().length,invalidCount);assert.equal(invalid.query('[data-ms-field="title"]').value,'');assert(!requests.some(request=>request.method==='POST'),'invalid local ticket fields do not create an API request');
 await field(invalid,'title','x'.repeat(121));await invalid.submit();assert.equal(savedEvents().length,invalidCount);assert.equal(invalid.query('[data-ms-field="title"]').value,'x'.repeat(121));await invalid.action('discard');await invalid.action('warranty');
 for(const [name,value] of Object.entries({reference:'INVALID-DATES',provider:'Synthetic provider',startsOn:'2026-11-04',endsOn:'2026-11-03',coverage:'Synthetic documented scope',exclusions:''}))await field(invalid,name,value);
 await invalid.submit();assert.equal(savedEvents().length,invalidCount);assert.equal(invalid.query('[data-ms-field="endsOn"]').value,'2026-11-03');await invalid.action('discard');await invalid.choose('unit',apiFixture.seed.unacceptedUnitId);assert(!invalid.query('[data-ms-form]'));await invalid.action('new');assert(!invalid.query('[data-ms-form]'));assert.equal(savedEvents().length,invalidCount);invalid.close();
 console.log('Maintenance studio: blank/oversized reports and reversed warranty dates preserve raw input without writes; unaccepted units expose no service submission.');

 await resetApi();const journey=await start();await journey.select();const unit=apiFixture.seed.activeWarrantyUnitId,originalDoc=snapshot(apiFixture.doc),ticket=await createTicket(journey,'Synthetic hinge service');
 let events=ticketEvents(ticket);assert.equal(events[0].data.ticket.handoverSeq,5);assert.deepEqual(events[0].data.ticket.anchor,{kind:'front',x:.2,y:.4});assert.equal(events[0].state,'accepted');
 await chooseTicket(journey,ticket);await next(journey,'service-review');await field(journey,'diagnosis','Synthetic hinge alignment fault.');await field(journey,'coverage','covered');await field(journey,'reference','SYNTHETIC-OWNER-REVIEW-01');await journey.submit();
 assert.equal(ticketEvents(ticket).at(-1).data.status,'reviewed');const reviewed=copy(ticketEvents(ticket).at(-1).data);assert(reviewed.warranty,'coverage decision retains the exact warranty evidence');
 await next(journey,'service-repair');await field(journey,'work','Synthetic hinge adjusted.');await field(journey,'verification','Synthetic repeated opening test passed.');await journey.submit();assert.equal(ticketEvents(ticket).at(-1).data.status,'repaired');
 await next(journey,'service-close');await field(journey,'customer','Synthetic service customer');await field(journey,'note','Owner recorded customer approval of the repair.');await journey.submit();assert.equal(ticketEvents(ticket).at(-1).data.status,'closed');
 const factoryView=await(await apiFixture.call('factory','/api/jobs',{id:apiFixture.seed.projectId,receipt:apiFixture.seed.receipt})).json();assert(!JSON.stringify(factoryView).includes('Synthetic service customer'));assert(!JSON.stringify(factoryView).includes('Owner recorded customer approval of the repair.'));assert(factoryView.events.some(event=>event.action==='service-close'&&event.data.status==='closed'),'factory receives closure state without private customer evidence');
 await journey.action('reopen');await field(journey,'reason','Synthetic issue recurred after closure.');await journey.submit();assert.equal(ticketEvents(ticket).at(-1).data.status,'open');assert.equal(ticketEvents(ticket).filter(event=>event.action==='service-close').length,1,'reopening preserves the earlier customer closure');
 await next(journey,'service-review');assert.equal(journey.query('[data-ms-field="diagnosis"]').value,'','reopened cycle requires a fresh diagnosis');await field(journey,'diagnosis','Synthetic recurrence checked.');await field(journey,'coverage','goodwill');await field(journey,'reference','SYNTHETIC-OWNER-REVIEW-02');await journey.submit();
 assert.equal(ticketEvents(ticket).filter(event=>event.action==='service-review').length,2);assert.deepEqual(ticketEvents(ticket).find(event=>event.action==='service-review').data,reviewed,'later cycle preserves the previous coverage decision');
 assert(unitEvents(unit).every(event=>event.action.startsWith('service-')?event.state==='accepted':true));assert.equal(snapshot(apiFixture.doc),originalDoc);assert.equal(unitEvents(apiFixture.seed.noWarrantyUnitId).filter(event=>event.action.startsWith('service-')).length,0);journey.close();
 console.log('Maintenance studio: actual accepted handover → anchored ticket → owner coverage → repair → owner customer closure → reopen and fresh review, without changing receipt geometry or prior decisions.');

 for(const [name,unitKey] of [['undocumented','noWarrantyUnitId'],['expired','expiredWarrantyUnitId']]){
  await resetApi();const scope=await start();await scope.select(apiFixture.seed[unitKey]);const id=await createTicket(scope,'Service with '+name+' warranty');await chooseTicket(scope,id);await next(scope,'service-review');
  await field(scope,'diagnosis','Synthetic review is explicit.');await field(scope,'coverage','covered');await field(scope,'reference','SYNTHETIC-COVERAGE-CHECK');const count=savedEvents().length;await scope.submit();assert.equal(savedEvents().length,count,name+' warranty cannot silently become covered');assert.equal(scope.query('[data-ms-field="diagnosis"]').value,'Synthetic review is explicit.');
  await field(scope,'coverage','outside');await scope.submit();assert.equal(ticketEvents(id).at(-1).data.status,'reviewed');assert.equal(ticketEvents(id).at(-1).data.coverage,'outside');scope.close();
 }
 console.log('Maintenance studio: tickets remain possible without documented warranty or after expiry; covered decisions are rejected and explicit outside-coverage review remains available.');

 for(const mode of ['fail-next-job','drop-next-job-response']){
  await resetApi();const retry=await start();await retry.select();await openDraft(retry,'Stable request '+mode);const before=savedEvents().length;await fault(mode);await retry.submit();
  assert.equal(savedEvents().length,before+(mode==='drop-next-job-response'?1:0));assert(retry.query('[data-ms-action="retry"]'));assert.equal(retry.query('[data-ms-field="title"]').value,'Stable request '+mode);
  const id=requests.filter(request=>request.method==='POST').at(-1).query.request;await retry.action('retry');assert.equal(savedEvents().length,before+1);assert.equal(requests.filter(request=>request.method==='POST').at(-1).query.request,id);assert.equal(unitEvents(apiFixture.seed.activeWarrantyUnitId).filter(event=>event.action==='service-open').length,1);retry.close();
 }
 console.log('Maintenance studio: rejected save and lost committed response preserve raw fields and retry one stable request without duplicate tickets.');

 await resetApi();const ack=await start();await ack.select();await openDraft(ack,'Acknowledged ticket reload failure');afterJobPost=response=>{if(response.ok)readFailure=1;};await ack.submit();
 assert.equal(unitEvents(apiFixture.seed.activeWarrantyUnitId).filter(event=>event.action==='service-open').length,1);assert(ack.query('[data-ms-action="retry"]'),'acknowledged POST remains recoverable after its reload fails');const posted=requests.filter(request=>request.method==='POST').length;await ack.action('retry');assert.equal(requests.filter(request=>request.method==='POST').length,posted,'acknowledged retry only fetches the saved record');ack.close();
 console.log('Maintenance studio: acknowledged API save plus failed GET has visible recovery without resubmitting the event.');

 await resetApi();const isolated=await start();await isolated.select();const a=await createTicket(isolated,'Ticket A'),b=await createTicket(isolated,'Ticket B');
 await chooseTicket(isolated,a);await next(isolated,'service-review');await field(isolated,'diagnosis','Diagnosis belongs only to A.');await field(isolated,'coverage','covered');await field(isolated,'reference','REF-A');await isolated.action('save');
 await chooseTicket(isolated,b);await next(isolated,'service-review');assert.equal(isolated.query('[data-ms-field="diagnosis"]').value,'');await field(isolated,'diagnosis','Independent diagnosis for B.');await isolated.action('save');
 await chooseTicket(isolated,a);await next(isolated,'service-review');assert.equal(isolated.query('[data-ms-field="diagnosis"]').value,'Diagnosis belongs only to A.');await isolated.submit();assert.equal(ticketEvents(a).at(-1).data.diagnosis,'Diagnosis belongs only to A.');assert.equal(ticketEvents(b).at(-1).data.status,'open');isolated.close();
 console.log('Maintenance studio: two tickets on one unit preserve independent review drafts and write only the selected ticket.');

 await resetApi();const stale=await start();await stale.select();const staleTicket=await createTicket(stale,'Warranty changes before review');await chooseTicket(stale,staleTicket);await next(stale,'service-review');await field(stale,'diagnosis','Saved diagnosis requires current policy review.');await field(stale,'coverage','covered');await field(stale,'reference','OLD-DRAFT-REFERENCE');await stale.action('save');
 const unitId=apiFixture.seed.activeWarrantyUnitId,priorWarranty=unitEvents(unitId).find(event=>event.action==='warranty-record').data.terms;const policyChange=await apiFixture.call('owner','/api/jobs',{id:apiFixture.seed.projectId,receipt:apiFixture.seed.receipt,request:crypto.randomUUID()},{action:'warranty-record',unit:unitId,expected:unitEvents(unitId).at(-1).seq,terms:{...priorWarranty,reference:'UPDATED-POLICY-REFERENCE'}});assert.equal(policyChange.status,201);
 await stale.action('refresh');assert.match(stale.query('[data-ms-draft-status]').textContent,/أقدم/);assert(stale.query('fieldset').disabled);assert.equal(stale.query('[data-ms-field="diagnosis"]').value,'Saved diagnosis requires current policy review.');const staleCount=savedEvents().length;await stale.submit();assert.equal(savedEvents().length,staleCount);await stale.action('discard');assert(!stale.query('fieldset').disabled);assert.equal(stale.query('[data-ms-field="diagnosis"]').value,'');stale.close();
 console.log('Maintenance studio: saved review drafts become explicitly stale when warranty or unit sequence changes, preserving raw text until discard.');

 await resetApi();const factory=await start({as:'factory'});await factory.select();const warrantyCount=savedEvents().length;await factory.action('warranty');assert.notEqual(factory.query('[data-ms-form]')?.dataset.msForm,'warranty-record');assert.equal(savedEvents().length,warrantyCount);const factoryTicket=await createTicket(factory,'Factory-reported service issue');await chooseTicket(factory,factoryTicket);await factory.action('next');assert(!factory.query('[data-ms-form]'),'factory cannot approve a coverage decision');
 const ownerReview=await apiFixture.call('owner','/api/jobs',{id:apiFixture.seed.projectId,receipt:apiFixture.seed.receipt,request:crypto.randomUUID()},{action:'service-review',unit:apiFixture.seed.activeWarrantyUnitId,expected:unitEvents(apiFixture.seed.activeWarrantyUnitId).at(-1).seq,ticketId:factoryTicket,diagnosis:'Owner reviewed factory report.',coverage:'covered',reference:'OWNER-COVERAGE'});assert.equal(ownerReview.status,201);
 await factory.action('refresh');await chooseTicket(factory,factoryTicket);await next(factory,'service-repair');await field(factory,'work','Factory completed approved work.');await field(factory,'verification','Factory performed the technical checks.');await factory.submit();assert.equal(ticketEvents(factoryTicket).at(-1).data.status,'repaired');await factory.action('next');assert(!factory.query('[data-ms-form]'),'factory repair completion cannot stand in for owner-recorded customer approval');
 await factory.action('reopen');await field(factory,'reason','Factory found the symptom again during follow-up.');await factory.submit();assert.equal(ticketEvents(factoryTicket).at(-1).data.status,'open');factory.close();
 console.log('Maintenance studio: factory can report, repair and reopen; warranty, coverage approval and customer closure remain owner actions.');

 await resetApi();const switched=await start();await switched.select();await openDraft(switched,'Owner account draft');const switchCount=savedEvents().length;actor='factory';await switched.submit();
 assert.equal(savedEvents().length,switchCount);assert.equal(requests.filter(request=>request.method==='POST').at(-1).subject,'delivery-review-owner');assert(!switched.query('[data-ms-form]'),'account mismatch hides the previous subject’s editor');assert([...globalThis.localStorage.data.values()].some(value=>value.includes('Owner account draft')));switched.close();
 const denied=await apiFixture.call('viewer','/api/jobs',{id:apiFixture.seed.projectId,receipt:apiFixture.seed.receipt});assert.equal(denied.status,403);
 console.log('Maintenance studio: authenticated subject binding and server scope prevent another account from submitting an owner draft.');

 await resetApi();const unavailable=new Store();unavailable.setItem=()=>{throw Error('Synthetic local storage failure.');};const storageFailure=await start({store:unavailable});await storageFailure.select();await openDraft(storageFailure,'Preserve when request cannot be stored');const storageCount=savedEvents().length;await storageFailure.submit();assert.equal(savedEvents().length,storageCount);assert(!requests.some(request=>request.method==='POST'));assert.equal(storageFailure.query('[data-ms-field="title"]').value,'Preserve when request cannot be stored');assert(storageFailure.controller.hasPending());storageFailure.close();
 console.log('Maintenance studio: unavailable draft storage blocks an unrepeatable API request while preserving editable input.');

 await resetApi();const shell=await start({workshop:true});await shell.select();await openDraft(shell,'Actual workshop pending navigation');assert(hasUnsavedWork());shell.shell.open('tracking');assert.equal(shell.shell.screen().route,'maintenance');assert(shell.query('[data-ms-action="leave-stay"]'));await shell.action('leave-stay');
 await shell.action('discard');assert(!hasUnsavedWork());await openDraft(shell,'Saved from actual maintenance route');await shell.submit();assert.equal(unitEvents(apiFixture.seed.activeWarrantyUnitId).at(-1).action,'service-open');assert.equal(shell.localSaves,0);assert(!hasUnsavedWork());shell.shell.open('tracking');await until(()=>shell.shell.screen()?.route==='tracking'&&shell.query('.delivery-studio'),'maintenance can return to actual delivery route after server save');shell.close();
 console.log('Maintenance workshop: actual mount, pending navigation guard, discard, server save and clean return to delivery without local project mutation.');

 await resetApi();const back=await start({workshop:true});await back.select();const ticketA=await createTicket(back,'Return target A'),ticketB=await createTicket(back,'Persisted selection B');await chooseTicket(back,ticketB);await next(back,'service-review');await field(back,'diagnosis','B draft must not override the explicit return ticket.');await back.action('save');await chooseTicket(back,ticketA);
 await back.action('handover');await until(()=>back.shell.screen()?.route==='tracking'&&back.query('[data-jobs="unit"]')?.value===apiFixture.seed.activeWarrantyUnitId,'handover opens the exact project, receipt and unit');
 assert.equal(back.query('[data-jobs="project"]').value,apiFixture.seed.projectId);assert.equal(back.query('[data-jobs="receipt"]').value,apiFixture.seed.receipt);
 await fire('click',back.query('[data-ws-back]'));await until(()=>back.shell.screen()?.route==='maintenance'&&ticketButton(back,ticketA)?.getAttribute('aria-pressed')==='true','actual Back restores explicit ticket A instead of persisted ticket B');
 assert.equal(back.query('[data-ms-context="unit"]').value,apiFixture.seed.activeWarrantyUnitId);assert.equal(back.query('[data-ms-field="diagnosis"]').value,'');await chooseTicket(back,ticketB);assert.equal(back.query('[data-ms-field="diagnosis"]').value,'B draft must not override the explicit return ticket.');back.close();
 console.log('Maintenance workshop: actual handover and Back preserve exact project/receipt/unit/ticket focus over another ticket’s saved selection.');

 for(const mode of ['fail-next-job','drop-next-job-response']){
  await resetApi();const recovery=await start({workshop:true});await recovery.select();const caseA=await createTicket(recovery,'Recover reopen A'),caseB=await createTicket(recovery,'Other selection B'),unit=apiFixture.seed.activeWarrantyUnitId;
  const record=async(action,data)=>{const response=await apiFixture.call('owner','/api/jobs',{id:apiFixture.seed.projectId,receipt:apiFixture.seed.receipt,request:crypto.randomUUID()},{action,unit,expected:unitEvents(unit).at(-1).seq,ticketId:caseA,...data});assert.equal(response.status,201);};
  await record('service-review',{diagnosis:'Synthetic review before reopening.',coverage:'covered',reference:'REOPEN-REVIEW'});await record('service-repair',{work:'Synthetic repair',verification:'Synthetic completed checks'});await recovery.action('refresh');await chooseTicket(recovery,caseA);await recovery.action('reopen');await field(recovery,'reason','Uncertain reopen must retain its request identity.');await fault(mode);await recovery.submit();const requestId=requests.filter(request=>request.method==='POST').at(-1).query.request;
  if(mode==='fail-next-job'){await recovery.action('handover');await until(()=>recovery.shell.screen()?.route==='tracking'&&recovery.query('[data-jobs="unit"]'),'handover mounts during saved reopen attempt');await fire('click',recovery.query('[data-ws-back]'));await until(()=>recovery.shell.screen()?.route==='maintenance'&&ticketButton(recovery,caseA)?.getAttribute('aria-pressed')==='true','Back restores the same ticket with its uncertain action');}
  else{await recovery.action('refresh');await chooseTicket(recovery,caseB);await fire('click',recovery.query('[data-delivery-pin="'+caseA+'"]'));await settle();}
  assert(recovery.query('[data-ms-action="retry"]'),'uncertain reopen remains recoverable after navigation or another ticket selection');assert.equal(recovery.query('[data-ms-field="reason"]').value,'Uncertain reopen must retain its request identity.');await recovery.action('retry');assert.equal(requests.filter(request=>request.method==='POST').at(-1).query.request,requestId);assert.equal(ticketEvents(caseA).filter(event=>event.action==='service-reopen').length,1);assert.equal(ticketEvents(caseA).at(-1).data.status,'open');recovery.close();
 }
 console.log('Maintenance workshop: uncertain reopen survives handover/Back and committed-response refresh/other-pin selection, then retries the original request exactly once.');

 await resetApi();actor='factory';
 for(const role of ['factory','store','rep']){
  const scopedHost=dom.createElement('main');dom.body.append(scopedHost);const view=projectView(role,{type:'kitchen-studio',version:2,design:apiFixture.doc,fieldFiles:[],photos:{}},{id:apiFixture.seed.projectId,revision:1,subject:'delivery-review-'+role});
  const mounting=mountScopedWorkspace(scopedHost,{view,remember(){},save:async()=>assert.fail('Opening maintenance never saves the scoped project')});const routes=scopedHost.querySelector('[data-scope-route]');assert.equal(routes.options.some(option=>option.value==='maintenance'),role==='factory','maintenance belongs only to the factory shared portal');if(role==='rep'){routes.value='quote';await fire('change',routes);}routes.value='maintenance';await fire('change',routes);const dispose=await mounting;
  if(role==='factory'){await until(()=>scopedHost.querySelector('.maintenance-studio')&&scopedHost.querySelector('[data-ms-context="project"]'),'real factory scoped portal mounts maintenance controller');assert(scopedHost.querySelector('[data-ms-context="project"]').options.some(option=>option.value===apiFixture.seed.projectId));}
  else{await settle();assert(!scopedHost.querySelector('.maintenance-studio'));assert.match(scopedHost.querySelector('[data-scope-notice]').textContent,/جهة أخرى/);}
  dispose();scopedHost.remove();
 }
 console.log('Maintenance scoped portal: actual factory workspace mounts the service controller, and forged store/rep navigation cannot enter it.');
}finally{apiFixture?.close();globalThis.FormData=NativeFormData;}


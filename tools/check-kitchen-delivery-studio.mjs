// Actual delivery controller and workshop routing against bundled real API handlers.
// The DOM harness is copied from production-workshop; all records are isolated.
import assert from 'node:assert/strict';
import {mountWorkshop} from '../public/kitchen-workshop-ui.js';
import {mountOrderTracking} from '../public/kitchen-order-tracking-ui.js';
import {hasUnsavedWork} from '../public/kitchen-unsaved-work.js';
import {createDeliveryReviewFixture} from '../scripts/serve-delivery-review.mjs';
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
Node.prototype.replaceChildren=function(...nodes){this.detach();this.children=[];this.append(...nodes);};
Node.prototype.insertAdjacentHTML=function(position,html){assert.equal(position,'beforeend');const fragment=new Node();fragment.innerHTML=html;this.append(...fragment.children);};
Node.prototype.remove=function(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;};
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
 headers.set('Cookie','delivery_review_actor='+actor);if(options.method==='POST')headers.set('Origin',apiFixture.seed.origin);
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
async function resetApi(){apiFixture?.close();apiFixture=await createDeliveryReviewFixture();readFailure=0;afterJobPost=null;}
async function start({as='owner',store,workshop=false}={}){
 actor=as;requests=[];globalThis.localStorage=store||new Store();globalThis.sessionStorage=new Store();
 const host=dom.createElement('main');dom.body.append(host);const notices=[],advance=[];let editable=true,localSaves=0,controller,shell;
 if(workshop){shell=mountWorkshop(host,{getDoc:()=>apiFixture.doc,closeOthers(){},apply(){localSaves++;return {ok:true,saved:true};},tell:value=>notices.push(value),canHistory:()=>false});shell.open('tracking');await until(()=>host.querySelector('[data-jobs="project"]'),'real workshop mounts tracking');}
 else controller=mountOrderTracking(host,{tell:value=>notices.push(value),onAdvance:route=>advance.push(route),canEdit:()=>editable});
 await until(()=>host.querySelector('[data-jobs="project"]'),'delivery project selection loads');await settle();
 const query=selector=>host.querySelector(selector);
 async function choose(kind,value){const field=query('[data-jobs="'+kind+'"]');assert(field,kind+' selection is rendered');field.value=value;await fire('change',field);await settle();}
 async function select(unit=apiFixture.seed.qcUnitId){await choose('project',apiFixture.seed.projectId);await choose('receipt',apiFixture.seed.receipt);await choose('unit',unit);}
 const input=async(selector,value)=>{const field=query(selector);assert(field,'input exists: '+selector);field.value=value;await fire(field.tagName==='SELECT'?'change':'input',field);return field;};
 const action=async name=>{await fire('click',query('[data-ja="'+name+'"]'));await settle();};
 const submit=async()=>{await fire('submit',query('[data-job-form]'));await settle();};
 return {host,query,choose,select,input,action,submit,notices,advance,shell,get controller(){return controller;},get localSaves(){return localSaves;},set editable(value){editable=value;},close(){controller?.destroy?.();shell?.close(false);host.remove();}};
}
async function actuals(f,offset=0){for(const field of f.host.querySelectorAll('[data-jcheck]')){const unit=(await(await apiFixture.call('owner','/api/jobs',{id:apiFixture.seed.projectId,receipt:apiFixture.seed.receipt})).json()).units.find(unit=>unit.id===apiFixture.seed.qcUnitId);await f.input('[data-jcheck="'+field.dataset.jcheck+'"]',String(unit.checks.find(check=>check.key===field.dataset.jcheck).nominal+offset));}}

try{
 apiFixture=await createDeliveryReviewFixture();
 const f=await start();await f.select();assert.equal(typeof f.controller.hasPending,'function');assert.equal(f.query('[data-job-form]').dataset.jobForm,'qc');
 assert.equal(f.query('.delivery-studio').dataset.state,'clean','actual initial delivery markup emits its clean presentation state');
 assert.equal(f.query('.dl-progress [aria-current="step"]').getAttribute('data-reached'),'true','actual current stage is reached');
 assert.equal(f.query('.dl-progress li').getAttribute('data-reached'),'true','earlier receipt stage is reached');
 assert.equal(f.host.querySelectorAll('.dl-progress [data-reached="true"]').length,2,'issued/planned are reached, later stages are not');
 const baseline=snapshot(savedEvents()),first=f.query('[data-jcheck]');await f.input('[data-jcheck="'+first.dataset.jcheck+'"]','٥٥١');await f.input('[name="note"]','Synthetic live measurement draft');
 assert(f.controller.hasPending());assert.equal(snapshot(savedEvents()),baseline,'raw numeric preview never writes a receipt event');assert(!requests.some(r=>r.method==='POST'));
 assert.equal(f.query('.delivery-studio').dataset.state,'dirty','typing updates the actual root hook without replacing the editor');
 assert.equal(f.query('[data-jcheck="'+first.dataset.jcheck+'"]').value,'٥٥١','Arabic raw text remains available for precise editing');
 assert(f.query('[data-delivery-canvas]').textContent.includes('الفعلي ٥٥١'),'the actual SVG preview uses the same Arabic numeric interpretation as validation');
 const nativeUndo=await fire('keydown',f.query('[data-jcheck="'+first.dataset.jcheck+'"]'),{key:'z',ctrlKey:true});assert(!nativeUndo.defaultPrevented,'typing keeps native text undo');
 await f.action('undo');assert.equal(f.query('[name="note"]').value,'');await f.action('redo');assert.equal(f.query('[name="note"]').value,'Synthetic live measurement draft');
 await f.action('discard');assert(!f.controller.hasPending());assert.equal(snapshot(savedEvents()),baseline);f.close();
 console.log('Delivery studio: actual receipt selection, Arabic raw preview, no implicit API writes, local undo/redo and cancel.');

 const invalid=await start();await invalid.select();const invalidSaved=snapshot(savedEvents());
 for(const raw of ['','ليس رقماً','-1']){
  await invalid.input('[data-jcheck="width"]',raw);await invalid.input('[name="note"]','Synthetic invalid measurement');await invalid.submit();
  assert.equal(snapshot(savedEvents()),invalidSaved);assert.equal(invalid.query('[data-jcheck="width"]').value,raw,'invalid raw input survives rejected submission');
  assert(!requests.some(request=>request.method==='POST'),'local invalid measurements never reach the API');
  assert.equal(invalid.query('.delivery-studio').dataset.state,'error','local validation rejection emits danger hook');
 }
 await invalid.input('[data-jcheck="width"]','٥٥٠٫٥');await invalid.action('save');const persisted=globalThis.localStorage;
 assert(!invalid.controller.hasPending(),'explicit local draft save clears only the unsaved draft indicator');assert.equal(snapshot(savedEvents()),invalidSaved);assert(persisted.length>0);invalid.close();
 const restored=await start({store:persisted});await restored.select();assert.equal(restored.query('[data-jcheck="width"]').value,'٥٥٠٫٥');assert.equal(restored.query('[name="note"]').value,'Synthetic invalid measurement');restored.close();
 const otherActor=await start({as:'factory',store:persisted});await otherActor.select();assert.equal(otherActor.query('[data-jcheck="width"]').value,'','saved drafts are scoped to the authenticated subject');assert.equal(otherActor.query('[name="note"]').value,'');otherActor.close();
 console.log('Delivery studio: invalid/blank input stays visible; explicit draft save/reopen is separate from API history and isolated by authenticated subject.');

 await resetApi();const failed=await start();await failed.select();await actuals(failed);await failed.input('[name="note"]','Retry without changing the measurements.');
 await fault('fail-next-job');await failed.submit();assert.equal(unitEvents(apiFixture.seed.qcUnitId).length,1);assert(failed.query('[data-ja="retry"]'));assert.equal(failed.query('[name="note"]').value,'Retry without changing the measurements.');
 const rejectedRequest=requests.filter(request=>request.method==='POST').at(-1).query.request;
 await failed.action('retry');assert.equal(unitEvents(apiFixture.seed.qcUnitId).length,2);assert.equal(unitEvents(apiFixture.seed.qcUnitId).at(-1).state,'passed');
 assert.equal(requests.filter(request=>request.method==='POST').at(-1).query.request,rejectedRequest);assert(!failed.controller.hasPending());assert.equal(failed.query('[data-job-form]').dataset.jobForm,'pack');failed.close();
 console.log('Delivery studio: transient save failure retains immutable attempted fields and retries the same request successfully.');

 await resetApi();const lost=await start();await lost.select();await actuals(lost);await lost.input('[name="note"]','Response-loss idempotency fixture.');
 await fault('drop-next-job-response');await lost.submit();assert.equal(unitEvents(apiFixture.seed.qcUnitId).length,2,'server committed despite the synthetic failed response');assert(lost.query('[data-ja="retry"]'));
 const uncertainId=requests.filter(request=>request.method==='POST').at(-1).query.request;await lost.action('retry');
 assert.equal(unitEvents(apiFixture.seed.qcUnitId).length,2,'same-body retry creates no duplicate event');assert.equal(requests.filter(request=>request.method==='POST').at(-1).query.request,uncertainId);assert.equal(lost.query('[data-job-form]').dataset.jobForm,'pack');lost.close();
 console.log('Delivery studio: a lost POST response uses the original request identity and produces one durable event.');

 await resetApi();const ack=await start();await ack.select();await actuals(ack);await ack.input('[name="note"]','Confirmed save with failed subsequent GET.');
 afterJobPost=response=>{if(response.ok)readFailure=1;};await ack.submit();assert.equal(unitEvents(apiFixture.seed.qcUnitId).length,2);assert(ack.query('[data-ja="retry"]'),'an acknowledged event remains visibly recoverable when its GET reload fails');
 const postsAfterAck=requests.filter(request=>request.method==='POST').length;await ack.action('retry');assert.equal(requests.filter(request=>request.method==='POST').length,postsAfterAck,'acknowledged recovery only reloads the record');assert.equal(ack.query('[data-job-form]').dataset.jobForm,'pack');ack.close();
 console.log('Delivery studio: confirmed POST plus failed reload exposes recovery and never resends the acknowledged event.');

 await resetApi();const note=await start();await note.select(apiFixture.seed.packedUnitId);assert.equal(note.query('[data-job-form]').dataset.jobForm,'install');const preNote=snapshot(savedEvents());
 await note.action('observe');await note.input('[data-delivery-field="text"]','Synthetic scratch needing inspection');
 await fire('click',note.query('[data-delivery-plane]'),{clientX:225,clientY:180});assert(note.query('.dl-draft-pin'),'actual drawing previews an anchored observation');assert.equal(snapshot(savedEvents()),preNote);
 await note.submit();let observation=unitEvents(apiFixture.seed.packedUnitId).at(-1);assert.equal(observation.action,'observe');assert.equal(observation.state,'packed');assert.deepEqual(observation.data.observation.anchor,{kind:'front',x:.25,y:.3});
 assert(note.query('[data-delivery-pin="'+observation.data.observation.id+'"]'),'persisted note is drawn on the receipt unit');
 assert(note.query('.dl-observation[data-severity="blocking"][data-resolved="false"]'),'actual blocking observation article emits the CSS severity hook');
 const pinKey=await fire('keydown',note.query('[data-delivery-pin="'+observation.data.observation.id+'"]'),{key:'Enter'});assert(pinKey.defaultPrevented);assert.equal(note.query('[data-delivery-pin="'+observation.data.observation.id+'"]').getAttribute('aria-pressed'),'true','keyboard activates the actual SVG observation pin');
 assert(note.query('[data-job-form="install"] button[type="submit"]').disabled,'blocking note prevents installation confirmation');
 const blocked=await apiFixture.call('owner','/api/jobs',{id:apiFixture.seed.projectId,receipt:apiFixture.seed.receipt,request:crypto.randomUUID()},{action:'install',unit:apiFixture.seed.packedUnitId,expected:4,location:'Wall A',note:'Premature install'});assert.equal(blocked.status,422,'real API independently enforces the blocking observation');
 await fire('click',note.query('[data-delivery-resolve="'+observation.data.observation.id+'"]'));await settle();await note.input('[name="note"]','Scratch repaired and inspected.');await note.submit();
 assert.equal(unitEvents(apiFixture.seed.packedUnitId).at(-1).action,'resolve');assert(note.query('.dl-observation[data-resolved="true"]'));
 await note.input('[name="note"]','Installed and checked.');await note.input('[name="location"]','Synthetic wall A');await note.submit();assert.equal(unitEvents(apiFixture.seed.packedUnitId).at(-1).state,'installed',JSON.stringify({notices:note.notices,form:note.query('[data-job-form]')?.dataset.jobForm,requests:requests.filter(request=>request.method==='POST').slice(-3)}));
 await note.input('[name="note"]','Owner recorded the acceptance.');await note.input('[name="customer"]','Synthetic customer');await note.submit();assert.equal(unitEvents(apiFixture.seed.packedUnitId).at(-1).state,'accepted');assert(!note.query('[data-job-form]'));assert.equal(unitEvents(apiFixture.seed.qcUnitId).length,1,'the neighbouring unit remains at its own stage');note.close();
 console.log('Delivery studio: real drawing anchor → saved blocking observation → rejected installation → resolution → installation → owner customer acceptance, with exact unit isolation.');

 await resetApi();const stale=await start();await stale.select();await stale.input('[data-jcheck="width"]','551');await stale.input('[name="note"]','Preserve this older saved draft.');await stale.action('save');const staleStore=globalThis.localStorage;stale.close();
 const qcSnapshot=await(await apiFixture.call('owner','/api/jobs',{id:apiFixture.seed.projectId,receipt:apiFixture.seed.receipt})).json(),qc=qcSnapshot.units.find(unit=>unit.id===apiFixture.seed.qcUnitId);
 const external=await apiFixture.call('factory','/api/jobs',{id:apiFixture.seed.projectId,receipt:apiFixture.seed.receipt,request:crypto.randomUUID()},{action:'qc',unit:qc.id,expected:1,actual:Object.fromEntries(qc.checks.map(check=>[check.key,check.nominal])),note:'Another authorized worker completed this step.'});assert.equal(external.status,201);
 const staleReopen=await start({store:staleStore});await staleReopen.select();assert.equal(staleReopen.query('[data-jcheck="width"]').value,'551');assert.match(staleReopen.query('[data-draft-status]').textContent,/أقدم/);assert(staleReopen.query('fieldset').disabled);assert(!staleReopen.query('[data-job-form]'));
 assert.equal(staleReopen.query('.delivery-studio').dataset.state,'stale','actual reloaded stale draft emits attention hook');
 const staleCount=savedEvents().length;await fire('submit',staleReopen.query('form'));await settle();assert.equal(savedEvents().length,staleCount);await staleReopen.action('discard');assert.equal(staleReopen.query('[data-job-form]').dataset.jobForm,'pack');staleReopen.close();
 console.log('Delivery studio: a genuinely saved older draft remains inspectable and locked after another worker advances the sequence; discard starts the current stage.');

 await resetApi();const permission=await start({as:'factory'});await permission.select();await actuals(permission);await permission.input('[name="note"]','Authorization may change before submission.');permission.editable=false;const permissionCount=savedEvents().length;await permission.submit();assert.equal(savedEvents().length,permissionCount);assert(!requests.some(request=>request.method==='POST'),'live workshop edit denial blocks submission');permission.editable=true;
 assert.equal((await apiFixture.call('owner','/api/projects',{id:apiFixture.seed.projectId,action:'revoke'},{email:'factory@delivery-review.example.test'})).status,200);
 await permission.submit();assert.equal(savedEvents().length,permissionCount,'current API access revocation prevents a stale client write');assert(!permission.query('[data-job-form]'),'revoked receipt data is no longer actionable');assert([...globalThis.localStorage.data.values()].some(value=>value.includes('Authorization may change before submission.')),'the attempted raw draft remains in its authenticated subject namespace');assert(permission.notices.length);permission.close();
 const denied=await apiFixture.call('viewer','/api/jobs',{id:apiFixture.seed.projectId,receipt:apiFixture.seed.receipt});assert.equal(denied.status,403);
 console.log('Delivery studio: live controller permissions and actual server revocation block writes while preserving the attempted raw draft.');

 await resetApi();const switched=await start();await switched.select();await actuals(switched);await switched.input('[name="note"]','Private owner draft before account switch.');const beforeSwitch=snapshot(savedEvents());actor='factory';await switched.submit();
 assert.equal(snapshot(savedEvents()),beforeSwitch,'a different authenticated actor cannot submit the previously loaded owner draft');assert.equal(requests.filter(request=>request.method==='POST').at(-1).subject,'delivery-review-owner','actual controller binds the expected authenticated subject on its API request');assert(!switched.query('[data-job-form]'),'subject mismatch hides the previous account’s receipt editor');assert([...globalThis.localStorage.data.values()].some(value=>value.includes('Private owner draft before account switch.')));switched.close();
 console.log('Delivery studio: changing authenticated account between preview and save cannot transfer another subject’s draft into an event.');

 await resetApi();const unavailable=new Store();unavailable.setItem=()=>{throw Error('Synthetic local draft storage failure.');};const storageFailure=await start({store:unavailable});await storageFailure.select();await actuals(storageFailure);await storageFailure.input('[name="note"]','Retain input when durable request identity cannot be written.');
 const beforeStorage=snapshot(savedEvents());await storageFailure.submit();assert.equal(snapshot(savedEvents()),beforeStorage);assert(!requests.some(request=>request.method==='POST'),'no API write occurs before its retry identity is durable');assert.equal(storageFailure.query('[name="note"]').value,'Retain input when durable request identity cannot be written.');assert(storageFailure.controller.hasPending());assert.match(storageFailure.host.textContent,/تعذّر تثبيت/);storageFailure.close();
 console.log('Delivery studio: local storage failure preserves typed values and prevents an unrepeatable server submission.');

 await resetApi();const destroyed=await start();await destroyed.select();await actuals(destroyed);await destroyed.input('[name="note"]','Authorized submission, then editor closes.');let releaseResponse;
 afterJobPost=()=>new Promise(resolve=>{releaseResponse=resolve;});await fire('submit',destroyed.query('[data-job-form]'));await until(()=>releaseResponse,'real API response is held after its authorized commit');destroyed.close();const closedMarkup=destroyed.host.innerHTML,closedNotices=destroyed.notices.length;releaseResponse();await settle();
 assert.equal(unitEvents(apiFixture.seed.qcUnitId).length,2,'closing the editor does not pretend to undo an already authorized server event');assert.equal(destroyed.host.innerHTML,closedMarkup,'late completion cannot redraw a destroyed editor');assert.equal(destroyed.notices.length,closedNotices);assert([...destroyed.host.listeners.values()].every(list=>!list.length));
 console.log('Delivery studio: destroy removes handlers and late server completion cannot redraw or notify the closed editor.');

 await resetApi();const pinIds=[crypto.randomUUID(),crypto.randomUUID()];
 for(const [index,id] of pinIds.entries()){const response=await apiFixture.call('factory','/api/jobs',{id:apiFixture.seed.projectId,receipt:apiFixture.seed.receipt,request:id},{action:'observe',unit:apiFixture.seed.packedUnitId,expected:3+index,observation:{text:'Synthetic observation '+index,severity:'blocking',anchor:{kind:'check',key:'width'}}});assert.equal(response.status,201);}
 const resolutions=await start();await resolutions.select(apiFixture.seed.packedUnitId);await fire('click',resolutions.query('[data-delivery-resolve="'+pinIds[0]+'"]'));await resolutions.input('[name="note"]','Repair specific to observation A.');await resolutions.action('save');
 await fire('click',resolutions.query('[data-delivery-resolve="'+pinIds[1]+'"]'));assert.equal(resolutions.query('[name="note"]').value,'','choosing observation B must not reuse the saved repair for observation A');
 await resolutions.input('[name="note"]','Independent repair for observation B.');await resolutions.action('save');await fire('click',resolutions.query('[data-delivery-resolve="'+pinIds[0]+'"]'));assert.equal(resolutions.query('[name="note"]').value,'Repair specific to observation A.');
 await resolutions.submit();assert.equal(unitEvents(apiFixture.seed.packedUnitId).at(-1).data.observationId,pinIds[0]);assert.equal(unitEvents(apiFixture.seed.packedUnitId).at(-1).data.note,'Repair specific to observation A.');resolutions.close();
 console.log('Delivery studio: independent resolution drafts retain their own observation identity and cannot reuse another observation’s repair note.');

 await resetApi();const shell=await start({workshop:true});await shell.select();await shell.input('[name="note"]','Workshop navigation draft');assert(hasUnsavedWork());shell.shell.open('production');assert.equal(shell.shell.screen().route,'tracking');assert(shell.query('[data-ja="leave-stay"]'));await shell.action('leave-stay');
 await shell.choose('unit',apiFixture.seed.packedUnitId);assert(shell.query('[data-ja="leave-discard"]'));assert.equal(shell.query('[data-job-form]').dataset.jobForm,'qc');await shell.action('leave-discard');assert.equal(shell.query('[data-job-form]').dataset.jobForm,'install');assert(!hasUnsavedWork());
 await shell.choose('unit',apiFixture.seed.qcUnitId);await actuals(shell);await shell.input('[name="note"]','Saved through actual tracking route.');await shell.submit();assert.equal(unitEvents(apiFixture.seed.qcUnitId).at(-1).state,'passed');assert.equal(shell.localSaves,0,'receipt events never masquerade as a local project apply');assert(!hasUnsavedWork(),'successful server event leaves no phantom shell form dirtiness');
 shell.shell.open('production');await until(()=>shell.shell.screen()?.route==='production'&&shell.query('.production-studio'),'clean delivery route can leave for actual production');shell.close();
 console.log('Delivery workshop: real mount, guarded route/unit changes, discard, explicit server commit, clean shell navigation and no local project write.');
}finally{apiFixture?.close();globalThis.FormData=NativeFormData;}


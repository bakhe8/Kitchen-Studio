// Owner lifecycle controller, real project APIs and authoritative local history.
// Parsed DOM/event harness copied from maintenance; fixture data are isolated.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mountWorkshop} from '../public/kitchen-workshop-ui.js';
import {mountOwnerOverview} from '../public/kitchen-owner-ui.js';
import {createOversightReviewFixture} from '../scripts/serve-oversight-review.mjs';
import {saveProject,commitProject,undoProject,redoProject,kitchenHistory,kitchenFuture,forgetProjectHistory} from '../public/kitchen-project.js';
import {getProjectAccess,bindProjectAccess} from '../public/kitchen-project-access.js';
import {hasUnsavedWork} from '../public/kitchen-unsaved-work.js';
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
  if([...s.replace(/\[[^\]]*\]/g,'').matchAll(/\.([\w-]+)/g)].some(m=>!this.classes().includes(m[1])))return false;
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

let apiFixture,actor='owner',requests=[],inFlight=0,intercept=null;
globalThis.fetch=async(path,options={})=>{
 const url=new URL(path,apiFixture.seed.origin),headers=new Headers(options.headers||{});headers.set('Cookie','oversight_review_actor='+actor);
 if(options.method==='POST')headers.set('Origin',apiFixture.seed.origin);
 const request=new Request(url,{...options,headers});requests.push({actor,path:url.pathname,query:Object.fromEntries(url.searchParams),method:request.method});
 inFlight++;try{const replacement=await intercept?.(request);return replacement instanceof Response?replacement:await apiFixture.handle(request);}finally{inFlight--;}
};
const pause=()=>new Promise(resolve=>setTimeout(resolve,3));
async function settle(){for(let i=0,quiet=0;i<500;i++){await pause();quiet=inFlight?0:quiet+1;if(quiet>=8)return;}assert.fail('bounded API work settles');}
async function until(check,message){for(let i=0;i<500;i++){if(check())return;await pause();}assert.fail(message);}
const stored=()=>snapshot([...globalThis.localStorage.data]);
async function start({workshop=false,focus={},doc=apiFixture.localDoc,as='owner',role=null}={}){
 actor=as;requests=[];intercept=null;globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
 let live=copy(doc),failSave=false,editable=true;assert(saveProject(live),'fixture is accepted by real project persistence');forgetProjectHistory();
 if(role)bindProjectAccess(live,{id:apiFixture.seed.projectId,revision:1,role,subject:'delivery-review-'+as});
 const host=dom.createElement('main');dom.body.append(host);const saves=[],histories=[],advance=[],notices=[];
 const apply=next=>{saves.push(next);if(failSave)return {ok:false,saved:false,reason:'Synthetic local persistence failure.'};const result=commitProject(live,next);if(result.next)live=result.next;return result;};
 const onHistory=forward=>{histories.push(forward);const result=(forward?redoProject:undoProject)(live);if(result?.next)live=result.next;return result?{ok:true,...result}:{ok:false,reason:'No applicable history.'};};
 const args={getDoc:()=>live,apply,onHistory,canHistory:forward=>(forward?kitchenFuture():kitchenHistory()).length>0,canEdit:()=>editable,onAdvance:(step,context)=>advance.push({step,focus:context}),tell:value=>notices.push(value),focus};
 const shell=workshop?mountWorkshop(host,{...args,closeOthers(){}}):null;
 const controller=workshop?null:mountOwnerOverview(host,args);if(workshop)shell.open('oversight',focus);
 await settle();
 const query=selector=>host.querySelector(selector);
 const action=async name=>{await fire('click',query('[data-os-action="'+name+'"]'));await settle();};
 const choose=async(key,value)=>{const field=query('[data-os-context="'+key+'"]');assert(field,'context exists: '+key);field.value=value;await fire('change',field);await settle();await until(()=>query('[data-os-action="refresh"]')?.disabled===false,'selected context refresh completes');};
 const stage=async id=>{await fire('click',query('[data-os-stage="'+id+'"]'));await settle();};
 const task=async id=>{await fire('click',query('[data-os-task="'+id+'"]'));await settle();};
 return {host,query,action,choose,stage,task,controller,shell,saves,histories,advance,notices,get doc(){return live;},set doc(value){live=value;},set failSave(value){failSave=value;},set editable(value){editable=value;},close(){if(controller)controller();shell?.close(false);host.remove();}};
}
async function preview(f){await f.stage('design');await f.task('design.upstand.back');await fire('click',f.query('[data-os-choice="none"]'));await settle();}
const state=(f,id)=>f.query('[data-os-stage="'+id+'"]')?.dataset.state;
const selected=(f,key)=>f.query('[data-os-context="'+key+'"]')?.value;
const noServerWrites=()=>assert(!requests.some(r=>r.method!=='GET'),'overview makes no server mutation requests');

try{
 apiFixture=await createOversightReviewFixture();
 const f=await start();assert.equal(f.host.querySelectorAll('[data-os-stage]').length,7,'actual overview renders all seven lifecycle stages');
 assert.equal(selected(f,'project'),'');assert.equal(state(f,'production'),'unknown');assert.equal(state(f,'delivery'),'unknown');assert.equal(state(f,'maintenance'),'unknown');
 assert(f.query('[data-os-context="project"]').options.some(o=>o.value===apiFixture.seed.projectId));
 assert(f.query('[data-os-context="project"]').options.some(o=>o.value===apiFixture.seed.draftProjectId));
 const initial=snapshot(f.doc),persisted=stored(),access=snapshot(getProjectAccess(f.doc));
 await f.choose('project',apiFixture.seed.projectId);assert.equal(state(f,'design'),'ready');assert.equal(state(f,'delivery'),'unknown','approved server design alone does not prove execution');
 assert(f.query('[data-os-action="save"]').disabled);assert(f.query('[data-os-action="undo"]').disabled);assert(!f.query('[data-os-choice]'));
 await f.choose('receipt',apiFixture.seed.receipt);assert.notEqual(state(f,'maintenance'),'unknown');await f.stage('maintenance');
 assert(f.query('[data-os-task="job:service:'+apiFixture.seed.serviceUnitId+':'+apiFixture.seed.serviceTicketId+'"]'),'actual receipt service ticket is a contextual blocker');
 assert.equal(snapshot(f.doc),initial);assert.equal(stored(),persisted);assert.equal(snapshot(getProjectAccess(f.doc)),access);assert.equal(f.saves.length,0);noServerWrites();
 await f.choose('project',apiFixture.seed.draftProjectId);assert.notEqual(state(f,'design'),'ready');assert.equal(selected(f,'receipt'),'');assert.equal(state(f,'delivery'),'waiting','verified absence of released receipts remains waiting');
 await f.action('open');assert.deepEqual(f.advance.at(-1),{step:'sync',focus:{projectId:apiFixture.seed.draftProjectId}});f.close();
 console.log('Oversight studio: real owned snapshots and explicit receipts are isolated from local documents, storage, access bindings, history and server writes; missing evidence stays unknown.');

 const edit=await start();const baseline=snapshot(edit.doc);await preview(edit);assert(edit.controller.hasPending());assert.equal(snapshot(edit.doc),baseline);assert.equal(edit.saves.length,0);assert.equal(kitchenHistory().length,0);assert(edit.query('[data-os-action="undo"]').disabled);
 await edit.action('cancel-preview');assert(!edit.controller.hasPending());assert.equal(snapshot(edit.doc),baseline);await preview(edit);await edit.action('save');
 assert(!edit.controller.hasPending());assert.equal(edit.doc.room.workshop.upstand.walls.back.mode,'none');assert.equal(kitchenHistory().length,1);assert(!edit.query('[data-os-task="design.upstand.back"]'));
 await edit.action('undo');assert(!edit.doc.room.workshop.upstand);assert.equal(kitchenFuture().length,1);await edit.action('redo');assert.equal(edit.doc.room.workshop.upstand.walls.back.mode,'none');assert.deepEqual(edit.histories,[false,true]);noServerWrites();edit.close();
 console.log('Oversight studio: original contextual quick answer previews without mutation, explicit save validates and persists, and authoritative project undo/redo restores the real choice.');

 const guard=await start();await preview(guard);guard.failSave=true;await guard.action('save');assert(guard.controller.hasPending());assert(!guard.doc.room.workshop.upstand);assert.equal(kitchenHistory().length,0);
 await guard.choose('project',apiFixture.seed.projectId);assert.equal(selected(guard,'project'),'');assert(guard.query('[data-os-action="leave-stay"]'));await guard.action('leave-stay');assert(guard.controller.hasPending());
 let left=0;assert.equal(guard.controller.requestLeave(()=>left++),false);await guard.action('leave-save');assert.equal(left,0);assert(guard.controller.hasPending());guard.failSave=false;await guard.action('leave-save');assert.equal(left,1);assert(!guard.controller.hasPending());
 guard.close();const stale=await start();await preview(stale);stale.doc=copy(stale.doc);stale.doc.room.name='Changed outside the overview';const changed=snapshot(stale.doc);await stale.action('save');assert.equal(stale.saves.length,0);assert.equal(snapshot(stale.doc),changed);assert(stale.controller.hasPending());await stale.action('cancel-preview');await stale.action('refresh');assert(!stale.controller.hasPending());stale.close();
 console.log('Oversight studio: failed persistence keeps the decision recoverable, leave-save retries before navigation, stay preserves it, and changed source identity prevents stale writes.');

 const contextual=await start();await contextual.choose('project',apiFixture.seed.projectId);await contextual.choose('receipt',apiFixture.seed.receipt);await contextual.stage('maintenance');await contextual.task('job:service:'+apiFixture.seed.serviceUnitId+':'+apiFixture.seed.serviceTicketId);await contextual.action('follow');
 assert.deepEqual(contextual.advance.at(-1),{step:'maintenance',focus:{unitId:apiFixture.seed.serviceUnitId,ticketId:apiFixture.seed.serviceTicketId,projectId:apiFixture.seed.projectId,receipt:apiFixture.seed.receipt}});
 await contextual.stage('design');await contextual.action('stage-open');assert.deepEqual(contextual.advance.at(-1),{step:'sync',focus:{projectId:apiFixture.seed.projectId}});
 await fire('click',contextual.query('[data-os-approval="customer"]'));await settle();assert.equal(contextual.advance.at(-1).step,'sync');noServerWrites();contextual.close();
 console.log('Oversight studio: receipt service blockers preserve exact project/receipt/unit/ticket; remote design and approval work delegates to explicit project opening.');

 const failure=await start();await failure.choose('project',apiFixture.seed.projectId);await failure.choose('receipt',apiFixture.seed.receipt);
 intercept=request=>{const u=new URL(request.url);return u.pathname==='/api/jobs'&&u.searchParams.has('receipt')?Response.json({error:'Synthetic receipt unavailable.'},{status:503}):undefined;};
 await failure.action('refresh');assert.equal(state(failure,'delivery'),'unknown');assert.equal(state(failure,'maintenance'),'unknown');assert(!failure.query('[data-os-task="job:service:'+apiFixture.seed.serviceUnitId+':'+apiFixture.seed.serviceTicketId+'"]'));
 intercept=request=>{const u=new URL(request.url);return u.pathname==='/api/projects'&&u.searchParams.has('revision')?Response.json({error:'Synthetic snapshot unavailable.'},{status:503}):undefined;};
 await failure.action('refresh');assert.equal(failure.host.querySelectorAll('[data-os-stage]').length,0);assert(!failure.query('[data-os-task]'));assert(failure.host.textContent.includes('Synthetic snapshot unavailable.'));
 intercept=request=>{const u=new URL(request.url);return u.pathname==='/api/projects'&&!u.searchParams.size?Response.json({error:'Synthetic project list unavailable.'},{status:503}):undefined;};
 await failure.action('refresh');assert.equal(selected(failure,'project'),apiFixture.seed.projectId,'failed project-list refresh keeps the selected remote identity visible');assert(failure.query('[data-os-context="project"]').options.some(option=>option.value===apiFixture.seed.projectId&&option.textContent.includes('تعذّر تحديثه')));assert.equal(failure.host.querySelectorAll('[data-os-stage]').length,0);
 await failure.choose('project','');assert.equal(selected(failure,'project'),'');assert.equal(failure.host.querySelectorAll('[data-os-stage]').length,7,'explicitly returning to local work recovers local review while the team list is unavailable');assert.equal(state(failure,'delivery'),'unknown');assert.equal(failure.doc.room.projectId,apiFixture.localDoc.room.projectId);assert.equal(failure.saves.length,0);failure.close();
 const localFailure=await start();intercept=()=>Response.json({error:'Synthetic disconnected.'},{status:503});await localFailure.action('refresh');assert.equal(localFailure.host.querySelectorAll('[data-os-stage]').length,7);assert.equal(state(localFailure,'delivery'),'unknown');assert(localFailure.host.textContent.includes('Synthetic disconnected.'));localFailure.close();
 console.log('Oversight studio: receipt failure clears execution certainty, remote archive/list failures preserve honest identity and clear prior details, and explicit local selection recovers only local evidence.');

 const mixed=await start();intercept=async request=>{const u=new URL(request.url);if(u.pathname!=='/api/projects'||!u.searchParams.has('revision'))return;const response=await apiFixture.handle(request),headers=new Headers(response.headers);headers.set('X-Studio-Subject','another-account');return new Response(await response.text(),{status:response.status,headers});};
 await mixed.choose('project',apiFixture.seed.projectId);assert.equal(mixed.host.querySelectorAll('[data-os-stage]').length,0);assert.equal(mixed.saves.length,0);mixed.close();
 const revoked=await start();await revoked.choose('project',apiFixture.seed.projectId);await revoked.choose('receipt',apiFixture.seed.receipt);await revoked.stage('maintenance');actor='factory';await revoked.action('follow');assert.equal(revoked.advance.length,0);assert.equal(revoked.host.querySelectorAll('[data-os-stage]').length,0);revoked.close();
 const forged=await start({role:'factory',as:'factory'});assert(!forged.query('[data-os-context="project"]'));assert(!forged.query('[data-os-choice]'));assert.equal(forged.saves.length,0);forged.close();
 console.log('Oversight studio: archive header identity mismatch, changed remote owner permissions and a forged local factory entry cannot expose or mutate owner workflow.');

 const late=await start();let release,entered=false;intercept=async request=>{const u=new URL(request.url);if(u.pathname==='/api/projects'&&u.searchParams.has('revision')){entered=true;await new Promise(resolve=>release=resolve);return apiFixture.handle(request);}};
 const selector=late.query('[data-os-context="project"]');selector.value=apiFixture.seed.projectId;await fire('change',selector);await until(()=>entered,'delayed snapshot request begins');late.close();const destroyedMarkup=late.host.innerHTML;release();await settle();assert.equal(late.host.innerHTML,destroyedMarkup,'a late response cannot repaint the disposed view');assert.equal(late.saves.length,0);assert.equal(late.advance.length,0);
 console.log('Oversight studio: destruction invalidates a delayed real snapshot response without applying documents or emitting navigation.');

 const shell=await start({workshop:true});await preview(shell);assert(hasUnsavedWork());await shell.action('save');assert.equal(shell.doc.room.workshop.upstand.walls.back.mode,'none');await shell.action('undo');assert(!shell.doc.room.workshop.upstand);await shell.action('redo');assert.equal(shell.doc.room.workshop.upstand.walls.back.mode,'none');
 await shell.choose('project',apiFixture.seed.projectId);await shell.choose('receipt',apiFixture.seed.receipt);await shell.stage('maintenance');await shell.task('job:service:'+apiFixture.seed.serviceUnitId+':'+apiFixture.seed.serviceTicketId);await shell.action('follow');await until(()=>shell.query('[data-ms-context="project"]'),'actual workshop opens maintenance');await settle();
 assert.equal(shell.query('[data-ms-context="project"]').value,apiFixture.seed.projectId);assert.equal(shell.query('[data-ms-context="receipt"]').value,apiFixture.seed.receipt);assert.equal(shell.query('[data-ms-context="unit"]').value,apiFixture.seed.serviceUnitId);assert.equal(shell.query('[data-ms-ticket="'+apiFixture.seed.serviceTicketId+'"]')?.getAttribute('aria-pressed'),'true');
 await fire('click',shell.query('[data-ws-back]'));await settle();assert.equal(selected(shell,'project'),apiFixture.seed.projectId);assert.equal(selected(shell,'receipt'),apiFixture.seed.receipt);assert.equal(shell.query('[data-os-stage="maintenance"]').getAttribute('aria-pressed'),'true');assert.equal(shell.query('[data-os-task="job:service:'+apiFixture.seed.serviceUnitId+':'+apiFixture.seed.serviceTicketId+'"]')?.getAttribute('aria-pressed'),'true');
 await shell.action('open');await until(()=>shell.query('[data-cloud-choose]'),'actual sync route renders explicit open selection');await settle();assert.equal(shell.query('[data-cloud-choose]').value,apiFixture.seed.projectId);assert.equal(shell.saves.length,1,'navigation into sync does not install a remote snapshot');shell.close();
 console.log('Oversight workshop: actual route owns save/history and pending state, opens exact service context, restores it on Back, and delegates explicit remote opening to sync without replacing the local project.');

 const discard=await start();const untouched=snapshot(discard.doc);await preview(discard);await discard.stage('quote');assert.equal(discard.query('[data-os-stage="design"]').getAttribute('aria-pressed'),'true');await discard.action('leave-discard');assert.equal(discard.query('[data-os-stage="quote"]').getAttribute('aria-pressed'),'true');assert.equal(snapshot(discard.doc),untouched);assert.equal(discard.saves.length,0);
 await preview(discard);discard.editable=false;await discard.action('save');assert(discard.controller.hasPending());assert.equal(discard.saves.length,0);await discard.action('cancel-preview');discard.close();
 const storedStale=await start();await preview(storedStale);const other=copy(storedStale.doc);other.room.name='Another tab saved this document';globalThis.localStorage.setItem('atlas-kitchen:project:v1',JSON.stringify(other));await storedStale.action('save');assert(storedStale.controller.hasPending());assert.equal(storedStale.saves.length,0);assert.equal(JSON.parse(localStorage.getItem('atlas-kitchen:project:v1')).room.name,other.room.name);storedStale.close();
 console.log('Oversight studio: navigation discard drops only the preview; live edit revocation and another-tab persistence block stale saves without overwriting stored work.');

 const invalidArchive=await start();intercept=async request=>{const u=new URL(request.url);if(u.pathname!=='/api/projects'||!u.searchParams.has('revision'))return;const response=await apiFixture.handle(request),value=await response.json();value.design.kitchen.units[0].width=-1;return Response.json(value,{headers:response.headers});};
 await invalidArchive.choose('project',apiFixture.seed.projectId);assert.equal(invalidArchive.host.querySelectorAll('[data-os-stage]').length,0);assert.equal(invalidArchive.saves.length,0);assert.equal(getProjectAccess(invalidArchive.doc).status,'local');invalidArchive.close();
 const auditFailure=await start();intercept=request=>new URL(request.url).searchParams.get('action')==='approvals'?Response.json({error:'Synthetic approval audit unavailable.'},{status:503}):undefined;await auditFailure.choose('project',apiFixture.seed.projectId);assert.equal(state(auditFailure,'design'),'ready','saved signature validity is computed from the selected archive');assert(auditFailure.host.textContent.includes('Synthetic approval audit unavailable.'));assert.equal(state(auditFailure,'delivery'),'unknown');auditFailure.close();
 console.log('Oversight studio: malformed portable archives never become inspected projects; unavailable approval audit stays explicit while current archive signatures retain their separate meaning.');

 const assets=await start();const beforeAssets=stored(),originalSet=localStorage.setItem.bind(localStorage),originalRemove=localStorage.removeItem.bind(localStorage);let assetWrites=0;
 localStorage.setItem=(key,value)=>{assetWrites++;originalSet(key,value);};localStorage.removeItem=key=>{assetWrites++;originalRemove(key);};
 intercept=async request=>{const u=new URL(request.url);if(u.pathname!=='/api/projects'||!u.searchParams.has('revision'))return;const response=await apiFixture.handle(request),value=await response.json();value.photos={back:'data:image/jpeg;base64,/9j/2Q=='};return Response.json(value,{headers:response.headers});};
 await assets.choose('project',apiFixture.seed.projectId);assert.equal(assets.host.querySelectorAll('[data-os-stage]').length,7,'accepted embedded wall-photo payload can be inspected without decoding it into a browser asset');assert.equal(stored(),beforeAssets);assert.equal(assetWrites,0,'inspection cannot install then roll back assets either');assets.close();
 const oldCookie=await apiFixture.handle(new Request(apiFixture.seed.origin+'/api/projects',{headers:{Cookie:'delivery_review_actor=outside; maintenance_review_actor=outside'}}));assert.equal(oldCookie.status,200);assert((await oldCookie.json()).projects.some(project=>project.id===apiFixture.seed.projectId),'8768 ignores identity cookies of previous fixture servers');
 console.log('Oversight fixture: an archive with embedded photo data is inspected without any browser storage writes, and independent cookies keep earlier review servers isolated.');

 const revision=await start();await revision.choose('project',apiFixture.seed.draftProjectId);await revision.stage('design');const newer=copy(apiFixture.remoteDraft);newer.room.name='A later independently saved team snapshot';
 const uploaded=await apiFixture.call('owner','/api/projects',{id:apiFixture.seed.draftProjectId,expected:1,request:randomUUID(),name:newer.room.name},{type:'kitchen-studio',version:2,design:newer,photos:{},fieldFiles:[]});assert.equal(uploaded.status,200,await uploaded.text());
 await revision.action('stage-open');assert.equal(revision.advance.length,0);assert.equal(revision.host.querySelectorAll('[data-os-stage]').length,0);await revision.action('refresh');assert.equal(selected(revision,'project'),apiFixture.seed.draftProjectId);assert(revision.host.textContent.includes(newer.room.name));assert.equal(revision.doc.room.projectId,apiFixture.localDoc.room.projectId);
 await revision.stage('maintenance');await revision.action('stage-open');assert.deepEqual(revision.advance.at(-1),{step:'maintenance',focus:{projectId:apiFixture.seed.draftProjectId,receipt:''}},'known team identity remains available before receipt selection');revision.close();
 const changedDuring=await start();await changedDuring.choose('project',apiFixture.seed.projectId);await changedDuring.choose('receipt',apiFixture.seed.receipt);await changedDuring.stage('maintenance');let verified=false;
 intercept=async request=>{const u=new URL(request.url);if(u.pathname==='/api/projects'&&u.searchParams.get('action')==='access'){const response=await apiFixture.handle(request);changedDuring.doc=copy(changedDuring.doc);changedDuring.doc.room.name='A different local source while checking navigation';verified=true;return response;}};
 await changedDuring.action('follow');assert(verified);assert.equal(changedDuring.advance.length,0);changedDuring.close();
 console.log('Oversight studio: a real newer team revision invalidates stale navigation until refresh, pre-receipt service links keep project identity, and source changes during access checks cancel navigation.');
 console.log('Oversight focused journey: 12 groups passed.');
}finally{intercept=null;apiFixture?.close();}



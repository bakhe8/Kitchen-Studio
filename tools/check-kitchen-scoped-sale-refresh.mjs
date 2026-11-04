import assert from 'node:assert/strict';
import {createScopedProjectClient,scopedStorageKey,bootstrapSharedWorkspace} from '../public/kitchen-scoped-client.js';
import {mountScopedWorkspace} from '../public/kitchen-scoped-workspace.js';

class Store{constructor(){this.values=new Map();}getItem(k){return this.values.get(k)??null;}setItem(k,v){this.values.set(k,String(v));}removeItem(k){this.values.delete(k);}}
const id='11111111-2222-3333-4444-555555555555',subject='rep-account';
const initial={type:'kitchen-project-view',version:1,project:{id,revision:7},access:{role:'rep',subject,scopeVersion:2},editable:{room:{width:400,length:360,height:280,name:'Own visit'},kitchen:{version:1,runs:[],units:[],features:[]},workshop:{},fieldRegister:{version:1,records:[]},defaults:{baseRows:[],overrides:[]},photos:{},fieldFiles:[]},context:{materials:[],families:{}},approvedSale:{status:'approved',totalMinor:1234567,currency:'SAR',revision:7}};
let served=structuredClone(initial),posts=0;
const fetcher=async(url,options={})=>{const q=new URL(url,'https://studio.test').searchParams;
 if(options.method==='POST'){posts++;assert.fail('A stale draft must not be uploaded.');}
 return Response.json(q.get('action')==='session'?{subject}:q.get('action')==='access'?{id,revision:served.project.revision,...served.access}:served);
};
const storage=new Store(),events=[],client=createScopedProjectClient({fetcher,storage,onTransition:event=>events.push(event)});
await client.load(id);await client.revalidate();assert.deepEqual(client.getView().approvedSale,initial.approvedSale,'An unchanged authenticated revision keeps its approved price.');assert(!events.some(e=>e.status==='sale-invalidated'));
const owned=structuredClone(initial.editable);owned.room.name='Unsent visit change';client.remember(owned);
// Simulate a draft left by the previous client, which stored sale metadata.
const legacyDraft={type:'kitchen-project-draft',version:1,view:{...structuredClone(initial),editable:owned}};
storage.setItem(scopedStorageKey(initial),JSON.stringify(legacyDraft));
served={...structuredClone(initial),project:{id,revision:8},approvedSale:{status:'pending'}};
const refreshed=await client.revalidate();
assert.equal(refreshed.changed,false,'Learning about a newer revision must not remount the working form.');
assert.equal(client.getView().project.revision,7,'The save base remains the loaded revision.');
assert.deepEqual(client.getView().editable,initial.editable,'Revalidation does not install the remote editable slice.');
assert.deepEqual(client.getView().approvedSale,{status:'pending'},'A known newer revision immediately invalidates the previously approved sale.');
const event=events.find(e=>e.status==='sale-invalidated');assert(event,'The mounted workspace receives a narrow sale notification.');assert.equal(event.remoteRevision,8);
const restored=client.draftFor(client.getView());assert.equal(restored.view.editable.room.name,owned.room.name);assert.deepEqual(restored.view.approvedSale,{status:'pending'},'A previously persisted draft cannot restore the former approved amount.');
await assert.rejects(client.save(owned),error=>error.status===409);assert.equal(posts,0);assert.equal(client.getView().project.revision,7);assert.deepEqual(client.getView().approvedSale,{status:'pending'});
assert.deepEqual(JSON.parse(storage.getItem(scopedStorageKey(initial))).view.approvedSale,{status:'pending'},'Newly persisted drafts carry no approval authority.');
client.dispose();

// Save can also discover the newer revision before the next focus event.
served=structuredClone(initial);const saveEvents=[],saveClient=createScopedProjectClient({fetcher,storage:new Store(),onTransition:event=>saveEvents.push(event)});await saveClient.load(id);
served={...structuredClone(initial),project:{id,revision:8},approvedSale:{status:'pending'}};
await assert.rejects(saveClient.save(owned),error=>error.status===409);assert.deepEqual(saveClient.getView()?.approvedSale,{status:'pending'});assert.equal(saveClient.getView().project.revision,7);assert.equal(saveEvents.at(-1).status,'ready','A detected revision conflict invalidates the sale without disposing the form.');saveClient.dispose();

// A small DOM fixture retains node identities. This lets the real workspace
// prove it updates the price region without replacing another pending input.
const decode=s=>String(s).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
class Element{
 constructor(tag='div',attrs={}){this.tagName=tag.toUpperCase();this.attrs=attrs;this.dataset=Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v]));this.children=[];this.parentElement=null;this.handlers=new Map();this.hidden=false;this.style={};this.value=attrs.value??'';this.classList={add(){},remove(){}};this._html='';}
 set innerHTML(html){this._html=html;for(const child of this.children)child.parentElement=null;this.children=[];const stack=[this];for(const m of html.matchAll(/<\/?([a-z][\w-]*)([^>]*)>/gi)){const tag=m[1].toLowerCase();if(m[0].startsWith('</')){if(stack.length>1){const child=stack.pop();child._html=html.slice(child.start,m.index);}continue;}const attrs={};for(const a of m[2].matchAll(/([\w-]+)(?:="([^"]*)"|='([^']*)'|=([^\s>]+))?/g))attrs[a[1]]=decode(a[2]??a[3]??a[4]??'');const child=new Element(tag,attrs);child.start=m.index+m[0].length;stack.at(-1).append(child);if(!['input','br','hr','img','meta','link'].includes(tag))stack.push(child);}}
 get innerHTML(){return this._html;}get childNodes(){return this.children;}
 matches(selector){const m=selector.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);return m?Object.hasOwn(this.attrs,m[1])&&(m[2]===undefined||this.attrs[m[1]]===m[2]):this.tagName===selector.toUpperCase();}
 querySelectorAll(selector){const result=[];const walk=node=>{for(const child of node.children){if(child.matches(selector))result.push(child);walk(child);}};walk(this);return result;}
 querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
 append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
 before(node){const p=this.parentElement;if(p){node.parentElement=p;p.children.splice(p.children.indexOf(this),0,node);}}
 replaceChildren(...nodes){this.innerHTML='';this.append(...nodes);}
 addEventListener(kind,fn){if(!this.handlers.has(kind))this.handlers.set(kind,[]);this.handlers.get(kind).push(fn);}
 async fire(kind,target=this){for(const fn of this.handlers.get(kind)||[])await fn({target,preventDefault(){}});}
 closest(selector){for(let n=this;n;n=n.parentElement)if(n.matches(selector))return n;return null;}
 hasAttribute(k){return Object.hasOwn(this.attrs,k);}
}
const document={head:new Element('head'),body:new Element('body'),documentElement:new Element('html'),visibilityState:'visible',listeners:{},createElement:tag=>new Element(tag),querySelector(selector){return this.head.querySelector(selector)||this.body.querySelector(selector);},addEventListener(kind,fn){this.listeners[kind]=fn;}};
const window={location:{assign(){},replace(){},reload(){}},listeners:{},addEventListener(kind,fn){this.listeners[kind]=fn;}};
globalThis.document=document;globalThis.window=window;globalThis.location={href:'https://studio.test/?shared='+id};globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
served=structuredClone(initial);let mounts=0,disposals=0,notices=0,pendingInput,controls;
await bootstrapSharedWorkspace({window,document,fetcher,storage:new Store(),mount(host,options){mounts++;controls=options;pendingInput=new Element('input',{value:'Unsubmitted field'});host.append(pendingInput);const dispose=()=>disposals++;dispose.invalidateApprovedSale=(view,remoteRevision)=>{notices++;assert.deepEqual(view.approvedSale,{status:'pending'});assert.equal(view.project.revision,7);assert.equal(remoteRevision,8);};return dispose;}});
const originalHost=document.body.children[0],originalInput=pendingInput;
served={...structuredClone(initial),project:{id,revision:8},approvedSale:{status:'pending'}};
await window.listeners.focus();assert.equal(notices,1);assert.equal(mounts,1);assert.equal(disposals,0);assert.equal(document.body.children[0],originalHost);assert.equal(pendingInput,originalInput);assert.equal(pendingInput.value,'Unsubmitted field');
await assert.rejects(controls.save(owned),error=>error.status===409);assert.equal(disposals,0);

const oldDraftStore=new Store();oldDraftStore.setItem(scopedStorageKey(initial),JSON.stringify(legacyDraft));served=structuredClone(initial);let restoredMount;
await bootstrapSharedWorkspace({window,document,fetcher,storage:oldDraftStore,mount(host,options){restoredMount=options;return ()=>{};}});
assert.equal(restoredMount.view.editable.room.name,owned.room.name);assert.equal(restoredMount.draftStatus,'restored');assert.deepEqual(restoredMount.view.approvedSale,{status:'pending'},'Restored draft data cannot mount its former sale approval, even if the unchanged server snapshot has an approved price.');

const host=new Element('main');document.body.replaceChildren(host);
const starting=mountScopedWorkspace(host,{view:initial,save:async()=>assert.fail('Display invalidation cannot save'),remember(){}});
// Select the real quote route while the initial survey module is loading.
const route=host.querySelector('[data-scope-route]');route.value='quote';await route.fire('change');const ui=await starting;
const content=host.querySelector('[data-scope-content]'),price=host.querySelector('[data-scope-approved-sale]');assert(price?.innerHTML.includes('scope-sale'),'The actual quote route initially displays the approved amount.');
const field=new Element('input',{value:'Keep this unfinished input'});content.append(field);const revision=host.querySelector('[data-scope-revision]').textContent;
assert.equal(ui.invalidateApprovedSale({...initial,approvedSale:{status:'pending'}},8),true);
assert(!price.innerHTML.includes('scope-sale'));assert(price.innerHTML.includes('لم يعتمد المالك'));assert.equal(content.children.at(-1),field);assert.equal(field.value,'Keep this unfinished input');assert.equal(host.querySelector('[data-scope-content]'),content);assert.equal(host.querySelector('[data-scope-revision]').textContent,revision);assert(host.querySelector('[data-scope-notice]').textContent.includes('أحدث'));
assert.equal(ui.invalidateApprovedSale({...initial,access:{...initial.access,subject:'other-account'},approvedSale:{status:'pending'}},9),false,'A late notification from another scope cannot update this workspace.');
ui();
console.log('PASS scoped sale refresh: newer remote revision invalidates the approved amount in place, preserves form nodes and save base, and cached drafts cannot restore sale authority.');

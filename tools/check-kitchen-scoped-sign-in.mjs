import assert from 'node:assert/strict';
import {bootstrapSharedWorkspace} from '../public/kitchen-scoped-client.js';

class Store{constructor(){this.values=new Map();}getItem(key){return this.values.get(key)??null;}setItem(key,value){this.values.set(key,String(value));}removeItem(key){this.values.delete(key);}}
class Element{constructor(tag='div'){this.tagName=tag.toUpperCase();this.childNodes=[];this.hidden=false;this.style={};this.dataset={};}replaceChildren(...nodes){this.childNodes=nodes;}append(...nodes){this.childNodes.push(...nodes);}}
const id='11111111-2222-3333-4444-555555555555',origin='https://studio.test';
const local=new Store();local.setItem('owner-recovery','unchanged private local archive');globalThis.localStorage=local;
function surface(){const document={body:new Element('body'),documentElement:new Element('html'),visibilityState:'visible',listeners:{},createElement:tag=>new Element(tag),addEventListener(type,fn){this.listeners[type]=fn;}},navigation=[];
 const window={location:{assign:url=>navigation.push(url),replace:url=>navigation.push(url),reload:()=>navigation.push('reload')},listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}};return {document,window,navigation};}
const anchor=document=>document.body.childNodes[0].childNodes.find(node=>node.tagName==='A');
async function boot(url,fetcher,{storage=new Store(),mount=()=>assert.fail('An unauthorized scope cannot mount')}={}){const surfaceState=surface();globalThis.location={href:url};globalThis.sessionStorage=storage;await bootstrapSharedWorkspace({...surfaceState,fetcher,storage,mount});return {...surfaceState,storage};}
const denied=()=>Response.json({error:'يلزم تسجيل الدخول.'},{status:401});
for(const url of [origin+'/?shared='+id,origin+'/unit.html?shared='+id,origin+'/callback?shared='+id,origin+'/?shared='+id+'&return_to=https%3A%2F%2Fforeign.test%2Fprivate',origin+'/?shared='+id+'&return_to=%2Fsignin-with-chatgpt']){
 const storage=new Store();storage.setItem('kitchen-studio:scoped:saved-draft','kept own pending draft');const before=[...storage.values],state=await boot(url,denied,{storage}),link=anchor(state.document);
 assert(link,'An explicit session401 offers sign-in from the locked shared view');assert.equal(link.textContent,'تسجيل الدخول');assert.equal(link.target,'_top');
 const signIn=new URL(link.href,origin);assert.equal(signIn.origin,origin);assert.equal(signIn.pathname,'/signin-with-chatgpt');assert.equal(signIn.searchParams.get('return_to'),'/?shared='+id);
 const back=new URL(signIn.searchParams.get('return_to'),origin);assert.equal(back.origin,origin);assert.equal(back.pathname,'/');assert(!['/signin-with-chatgpt','/signout-with-chatgpt','/callback'].includes(back.pathname));assert.deepEqual([...storage.values],before);
 assert.equal(state.document.body.childNodes[0].hidden,false);assert(state.document.body.childNodes[0].childNodes.some(node=>node.textContent==='إعادة التحقق'));assert(state.document.body.childNodes[0].childNodes.some(node=>node.textContent==='مشاريع الحساب'));
}
const selector=await boot(origin+'/?projects=shared',denied);assert.equal(new URL(anchor(selector.document).href,origin).searchParams.get('return_to'),'/?projects=shared');
const html401=await boot(origin+'/?shared='+id,()=>new Response('Authentication required',{status:401,headers:{'Content-Type':'text/plain'}}));assert(anchor(html401.document),'An explicit non-JSON401 still identifies an unauthorized session.');
for(const fetcher of [()=>{throw TypeError('Network offline');},()=>Response.json({error:'Unavailable'},{status:503}),()=>Response.json({error:'Forbidden role'},{status:403}),()=>new Response('<html>Unavailable</html>',{status:200,headers:{'Content-Type':'text/html'}})]){
 const state=await boot(origin+'/?shared='+id,fetcher);assert.equal(anchor(state.document),undefined,'Offline, forbidden, and ambiguous HTML failures must not suggest signing in.');
}
let invalidRequests=0;const invalid=await boot(origin+'/?shared='+encodeURIComponent('https://foreign.test/callback'),()=>{invalidRequests++;return denied();});assert.equal(invalidRequests,0);assert.equal(anchor(invalid.document),undefined,'An invalid project target never becomes a redirect target.');

// Expiring an already mounted session also keeps the partitioned owned draft.
const view={type:'kitchen-project-view',version:1,project:{id,revision:1},access:{role:'store',subject:'test-account',scopeVersion:2},editable:{storeCatalog:{name:'Own stock',items:[]}},context:{}};
let expired=false,controls,disposed=0;const state=await boot(origin+'/?shared='+id,url=>{if(expired)return denied();const query=new URL(url,origin).searchParams;return Response.json(query.get('action')==='session'?{subject:view.access.subject}:view);},{mount(host,args){controls=args;return ()=>disposed++;}});
controls.remember({storeCatalog:{name:'Unsaved owned change',items:[]}});const saved=[...state.storage.values];expired=true;await state.window.listeners.focus();assert.equal(disposed,1);assert(anchor(state.document));assert.deepEqual([...state.storage.values],saved);assert.deepEqual([...local.values],[['owner-recovery','unchanged private local archive']]);
console.log('PASS scoped sign-in: explicit401-only CTA, canonical same-origin shared return, auth-path/foreign-return rejection, offline/forbidden exclusion, and preserved owned/local recovery data.');

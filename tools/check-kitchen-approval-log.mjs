// The cloud panel names who put each approval stamp into the project (taken from the server) and flags stamps the server has not recorded.
import assert from 'node:assert/strict';
import {makeChainExample,readChainRange} from '../public/kitchen-chain-model.js';
import {planWorkshopRow} from '../public/kitchen-production-row.js';
import {mountSyncStep} from '../public/kitchen-workshop-sync-ui.js';
import {getProjectAccess} from '../public/kitchen-project-access.js';

class View{innerHTML='';handlers=new Map();addEventListener(k,fn){this.handlers.set(k,fn);}removeEventListener(k){this.handlers.delete(k);}querySelector(){return null;}querySelectorAll(){return [];}}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const pid='11111111-2222-3333-4444-555555555555';
let doc=makeChainExample();
doc=planWorkshopRow(doc,{...readChainRange(doc,'back'),tier:'base',wanted:{rice:false,dishwasher:false,sink:true}}).doc;
doc={...doc,room:{...doc.room,projectId:'K-0123456789ABCDEF',workshop:{...doc.room.workshop,approvals:{
 customer:{key:'c'.repeat(64),name:'العميل أحمد',date:'2026-11-03T10:00:00.000Z'},
 structure:{key:'a'.repeat(64),name:'اعتماد جديد لم يُرفع',date:'2026-11-03T11:00:00.000Z'}}}}};
const event=(over)=>({revision:1,kind:'customer',subject:'',stamp_key:'k',stamp_name:'x',stamp_date:'2026-11-01T09:00:00.000Z',detail:'',actor_name:'owner@example.test',recorded:'2026-11-01T09:01:00.000Z',...over});
const events=[
 event({revision:3,kind:'customer',stamp_key:'c'.repeat(64),stamp_name:'العميل أحمد',actor_name:'rep@example.test',recorded:'2026-11-03T10:05:00.000Z'}),
 event({kind:'structure',stamp_key:'o'.repeat(16),stamp_name:'<img src=x onerror=alert(1)>'}),
 event({kind:'chain',subject:'back',stamp_key:'t'.repeat(16),stamp_name:'فني القياس',detail:'رفع ميداني 01',actor_name:'tech@example.test'})];
const projects={projects:[{id:pid,name:'مطبخ الاختبار',updated:'2026-11-03T10:05:00.000Z',revision:3,role:'owner'}]};

async function panel(respond,focus={},inspect){
 const storage=entries=>{const values=new Map(entries);return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
 // The legacy session link is associated only with the document actually open
 // in the local slot; trusted access is reloaded from the server separately.
 globalThis.sessionStorage=storage([['kitchen-workshop:remote:v1',JSON.stringify({id:pid,revision:3})]]);
 globalThis.localStorage=storage([['atlas-kitchen:project:v1',JSON.stringify(doc)]]);
 globalThis.fetch=async url=>{const q=new URL(url,'https://studio.test').searchParams;return q.get('action')==='access'?json({id:pid,role:'owner',revision:3}):respond(q);};
 const view=new View(),dispose=mountSyncStep(view,{getDoc:()=>doc,apply:()=>assert.fail('the panel only reads here'),tell(){},focus});
 await flush();await flush();if(inspect)await inspect(view);dispose();return view.innerHTML;
}

const html=await panel(q=>q.get('action')==='approvals'?json({approvals:events}):q.get('id')?json({}):json(projects));
assert.match(html,/اعتماد العميل «العميل أحمد» · سجّله rep@example\.test/);
assert.match(html,/تأكيد قياس الجدار · back «فني القياس» · مرجع رفع ميداني 01 · سجّله tech@example\.test/);
assert(html.includes('&lt;img src=x onerror=alert(1)&gt;')&&!html.includes('<img src=x'),'stamp names are escaped');
assert.match(html,/لم يُسجَّل على الخادم بعد: اعتماد التصميم «اعتماد جديد لم يُرفع»/,'a stamp typed locally but unknown to the server is flagged');
assert(!/لم يُسجَّل على الخادم بعد:[^<]*العميل أحمد/.test(html),'a recorded stamp is not flagged');

// If the list cannot be loaded the panel still works and does not claim that stamps are unrecorded.
const down=await panel(q=>q.get('action')==='approvals'?json({error:'down'},503):q.get('id')?json({}):json(projects));
assert.match(down,/مطبخ الاختبار/);assert(!down.includes('سجّله')&&!down.includes('لم يُسجَّل على الخادم بعد'));

// An overview jump selects a verified owned entry only. The bound drawing and
// archive remain untouched, and later refreshes preserve the user's selection.
const target='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',other='22222222-3333-4444-5555-666666666666';
const focusedProjects={projects:[...projects.projects,{id:target,name:'مشروع الإشراف',role:'owner',revision:8},{id:other,name:'مشروع آخر',role:'owner',revision:2}]};
const requested=[];
const focused=await panel(q=>{
 requested.push(Object.fromEntries(q));
 assert(!q.get('id')||q.get('action')==='approvals','focusing must not request or install an archive');
 return q.get('action')==='approvals'?json({approvals:events}):json(focusedProjects);
},{projectId:target},async view=>{
 assert(view.innerHTML.includes('<option value="'+target+'" selected>'),'the requested owned project is selected after the list is verified');
 assert.equal(getProjectAccess(doc).remoteProjectId,pid,'focusing does not change the current binding');
 assert.equal(getProjectAccess(doc).revision,3);
 assert(view.innerHTML.includes('رفع نسخة إلى «مطبخ الاختبار»'),'upload still targets the explicitly opened project');
 view.handlers.get('change')({target:{matches:q=>q==='[data-cloud-choose]',value:other}});
 view.handlers.get('click')({target:{closest:()=>({dataset:{sync:'refresh'}})}});
 await flush();await flush();
 assert(view.innerHTML.includes('<option value="'+other+'" selected>'),'focus is consumed once and cannot override a later manual selection');
});
assert(focused.includes('data-sync="open"'),'opening a selected project still needs the existing button');
assert(requested.every(q=>!q.id||q.id===pid),'selection only reads approvals from the unchanged bound project');
for(const requestedRole of ['factory','rep','viewer']){
 const unowned=await panel(q=>q.get('action')==='approvals'?json({approvals:[]}):json({projects:[...projects.projects,{id:target,name:'مشروع مشترك',role:requestedRole,revision:8}]}),{projectId:target});
 assert(!unowned.includes('<option value="'+target+'" selected>'),'oversight focus does not silently select a nonowned project');
}
const unavailable=await panel(q=>q.get('action')==='approvals'?json({approvals:[]}):json(projects),{projectId:target});
assert(!unavailable.includes(' selected>'),'an unavailable focused project does not fall back to another project');
console.log('Cloud panel lists who recorded each approval stamp, escapes stamp text, flags unrecorded stamps and survives a failed list request.');
console.log('Overview focus selects owned cloud entries once without archive reads, project installation, binding changes or fallback selection.');

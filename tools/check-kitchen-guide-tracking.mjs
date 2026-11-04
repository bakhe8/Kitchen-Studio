import assert from 'node:assert/strict';
import {mountOrderTracking,jobPrompt} from '../public/kitchen-order-tracking-ui.js';
const calls=[],events=[],projects=[{id:'private',name:'مشروع خارج تشغيل المصنع',role:'rep'},{id:'A',name:'المطبخ الأول',role:'owner'},{id:'B',name:'المطبخ الثاني',role:'factory'}],units=[{id:'u',name:'الحوض',checks:[],partCount:3},{id:'c',name:'خزانة',checks:[],partCount:2}];
let fail=false,role='factory';
globalThis.fetch=async(path,opt)=>{
 const u=new URL(path,'https://test.invalid'),id=u.searchParams.get('id'),receipt=u.searchParams.get('receipt');
 calls.push([u.pathname,id,receipt,opt.method]);
 const body=u.pathname==='/api/projects'?{projects}:
  fail?{error:'تعذر جلب الإيصال'}:!receipt?{receipts:[{receipt:'batch:'+id,revision:3,issued:'2026-11-01'}],role}:
  {receipt,revision:3,role,subject:'fixture-'+role,units,events};
 return new Response(JSON.stringify(body),{status:fail?500:200,headers:{'content-type':'application/json'}});
};
const host={listeners:{},querySelectorAll:()=>[],addEventListener(k,f){this.listeners[k]=f;},removeEventListener(k){delete this.listeners[k];}};
const next=()=>new Promise(done=>setTimeout(done,0)),change=async(k,value)=>{host.listeners.change({target:{dataset:{jobs:k},value}});await next();};
const go=[],dispose=mountOrderTracking(host,{onAdvance:s=>go.push(s),focus:{fromGuide:true}});
await next();assert.equal(calls.length,1);assert.match(host.innerHTML,/اختر مشروع الفريق/);assert(!host.innerHTML.includes('data-job-form'));assert(!host.innerHTML.includes('مشروع خارج تشغيل المصنع'));
await change('project','B');assert.deepEqual(calls.at(-1),['/api/jobs','B',null,'GET']);assert.match(host.innerHTML,/اختر إيصالًا/);
assert(!host.innerHTML.includes('data-job-form'));
await change('receipt','batch:B');assert(!host.innerHTML.includes('data-job-form'));
await change('unit','u');assert.match(host.innerHTML,/ما مرجع السماحات/);assert(!host.innerHTML.includes('data-job-form'),'factory may not approve owner tolerance');
events.push({unit:'u',seq:1,action:'plan',state:'planned',data:{tolerances:{}},who:'x'});
host.listeners.click({target:{closest:()=>({dataset:{ja:'refresh'}})}});await next();assert.match(host.innerHTML,/data-job-form="qc"/);assert.match(host.innerHTML,/ما نتائج القياس/);
for(const [action,state,nextAction] of [['qc','passed','pack'],['pack','packed','install'],['install','installed',null]]){
 events.push({unit:'u',seq:events.length+1,action,state,data:{},who:'x'});host.listeners.click({target:{closest:()=>({dataset:{ja:'refresh'}})}});await next();
 if(nextAction)assert(host.innerHTML.includes('data-job-form="'+nextAction+'"'));else assert(!host.innerHTML.includes('data-job-form'),'factory waits for owner acceptance');
}
role='owner';host.listeners.click({target:{closest:()=>({dataset:{ja:'refresh'}})}});await next();assert.match(host.innerHTML,/data-job-form="accept"/);
fail=true;await change('project','A');assert.match(host.innerHTML,/تعذر جلب الإيصال/);assert(!host.innerHTML.includes('data-job-form'));assert(!host.innerHTML.includes('الحوض'));
host.listeners.click({target:{closest:()=>({dataset:{ja:'sync'}})}});assert.deepEqual(go,['sync']);
assert(calls.every(call=>call[3]==='GET'));dispose();
for(const [state,action] of Object.entries({issued:'plan',planned:'qc',passed:'pack',packed:'install',installed:'accept'})){
 assert.equal(jobPrompt(state,'owner').next,action);assert.equal(jobPrompt(state,'owner').editable,true);assert.equal(jobPrompt(state,'factory').editable,!['plan','accept'].includes(action));
 for(const denied of ['editor','viewer','rep','store',undefined])assert.equal(jobPrompt(state,denied).editable,false);
}
assert.equal(jobPrompt('accepted','owner'),null);assert.equal(jobPrompt('unknown','editor'),null);
console.log('Guide handoff requires real project and receipt choices, respects unit scope, dated job state and role; no writes or stale fallback on failure.');

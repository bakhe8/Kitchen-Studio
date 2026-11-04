import assert from 'node:assert/strict';
import {mountStoneSeams} from '../public/kitchen-upstand-seam-ui.js';
import {setUpstandWindowChoice,worktopUpstandTakeoff} from '../public/kitchen-worktop-upstand.js';

class Node{
 nodes=new Map();constructor(){this.kids=[];this.value='';}
 replaceChildren(...kids){this.kids=kids;}remove(){}
 querySelector(key){if(!this.nodes.has(key))this.nodes.set(key,new Node());return this.nodes.get(key);}
}
globalThis.document={createElement:()=>new Node()};
const ref='QA factory strip';
const cat={approved:true,items:[{sku:'STONE',name:'رخام',kind:'panel',thicknessMm:20,stockLengthMm:1200,stockWidthMm:800}],upstandProfiles:[{id:'P',sku:'STONE',reference:ref,heightMm:100,minCutHeightMm:30}]};
const run={id:'r',wall:'back',tier:'base',start:20,end:220,depth:60,height:86,bottom:0,worktopThicknessMm:40};
let doc={room:{width:400,length:400,height:280,workshop:{upstand:{choice:{mode:'factory',profileId:'P'},walls:{}}}},kitchen:{runs:[run],units:[{id:'a',runId:'r',kind:'storage',u:20,width:200}],features:[{id:'w',kind:'window',wall:'back',u:70,width:40,bottom:96,height:60,depth:4}]}};
const win=worktopUpstandTakeoff(doc,cat).windows[0];doc=setUpstandWindowChoice(doc,cat,win.key,{kind:'uniform',clearanceMm:10,reference:'field',operationChecked:true}).doc;
let writes=0,notice='',isDirty=false;
function mount(){
 const host=new Node(),take=worktopUpstandTakeoff(doc,cat),key=take.seamRequests[0].key;
 const ctrl=mountStoneSeams(host,{take,snapshot:doc,catalog:cat,getDoc:()=>doc,apply:d=>{writes++;doc=d;return {ok:true};},tell:s=>notice=s,onSave:()=>{},canSave:()=>!isDirty});
 const root=host.kids[0];return {ctrl,root,key,submit(station,r){root.querySelector('[data-uw-stations]').value=station;root.querySelector('[data-uw-ref]').value=r;root.oninput({target:{matches:()=>true}});root.onsubmit({preventDefault(){},stopPropagation(){},target:{hasAttribute:()=>true}});}};
}
assert.equal(mountStoneSeams(new Node(),{take:{seamRequests:[],orphanSeams:[]}}),null);
let app=mount();assert.match(app.root.innerHTML,/يحدّد المصنع|\u064a\u062d\u062f/);assert.match(app.root.innerHTML,/محطة واحدة في كل سطر/);
app.submit('','');assert.equal(writes,0);assert(app.ctrl.hasDraft());
app.submit('٢٠٢٠','drawing');assert.equal(writes,0);
isDirty=true;app.submit('١٢٠٠','drawing');assert.equal(writes,0);assert.match(notice,/تعديل الشباك/);
isDirty=false;app.submit('١٢٠٠','drawing');assert.equal(writes,1);
let take=worktopUpstandTakeoff(doc,cat);assert.deepEqual(take.seamRequests.find(s=>s.key===app.key).choice.stationsMm,[1200]);
app=mount();assert.match(app.root.innerHTML,/أطوال القطع المعتمدة/);assert.match(app.root.innerHTML,/١٬٠٠٠ مم/);
doc=structuredClone(doc);app.submit('١٤٠٠','older UI');assert.equal(writes,1);assert.match(notice,/تغيّر الرسم/);
app=mount();const btn={closest:()=>btn,hasAttribute:k=>k==='data-uw-remove'};app.root.onclick({target:btn});assert.equal(writes,2);
assert(!worktopUpstandTakeoff(doc,cat).seamRequests.find(s=>s.key===app.key).choice);
console.log('Workshop seam UI appears only for domain requests, requires actual stations and reference, supports Arabic numerals and protects stale/draft entries.');

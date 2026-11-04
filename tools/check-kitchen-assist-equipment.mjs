import assert from 'node:assert/strict';
import {buildAssistant,applyAnswer} from '../public/kitchen-assist-engine.js';
import {makeFurnishedSaudiRoom} from '../public/kitchen-room-presets.js';
import {createKitchen,addRun,addUnit,kitchenGeometry} from '../public/kitchen-model.js';
import {readFieldRegister,upsertFieldRecord} from '../public/kitchen-field-model.js';
const fmt=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n)+' مم',eq=(a,b)=>assert.equal(a,b),apply=(r)=>{assert(r.ok,r.reason);return r;};
const demo=makeFurnishedSaudiRoom('apartment'),u=demo.kitchen.units.find(x=>x.kind==='dishwasher'),room=demo.room,g=kitchenGeometry(demo.kitchen,room),topmm=g.worktops.find(t=>t.runId===u.runId&&t.start<=u.u+.01&&t.end>=u.u+u.width-.01).bottom*10;
const plan=(d,entityId=u.id)=>buildAssistant(d,'equipment',{entityId}),answer=(d,id,v,opt={})=>({...d,room:apply(applyAnswer(d,'equipment',id,v,{entityId:u.id,...opt})).room}),askIds=d=>plan(d).questions.map(q=>q.id),find=(s,txt)=>s.derived.find(f=>f.label.includes(txt));
let d=demo;
assert.deepEqual(askIds(d),['bearing']);eq(plan(d).known.find(v=>v.label==='أسفل سطح العمل في الرسم').value,fmt(topmm));
d=answer(d,'bearing','zero');assert.deepEqual(askIds(d),['min']);eq(find(plan(d),'صافي ارتفاع').value,fmt(topmm));assert(find(plan(d),'صافي ارتفاع').label.includes('مبدئي'));assert(!readFieldRegister(d.room).records.some(r=>r.property.includes('منسوب أسفل')));
d=answer(d,'min',topmm-20);eq(askIds(d).length,0);assert.match(find(plan(d),'مقارنة ارتفاع').value,/فائض/);assert(find(plan(d),'مقارنة ارتفاع').value.includes(fmt(20)));
// Change the actual worktop carrier height: no field re-entry/re-save is necessary.
const originalRows=d.room.fieldRegister.records.length,dynamic={...d,kitchen:{...d.kitchen,runs:d.kitchen.runs.map(r=>r.id===u.runId?{...r,height:r.height+5}:r)}};
eq(find(plan(dynamic),'صافي ارتفاع').value,fmt(topmm+50));eq(dynamic.room.fieldRegister.records.length,originalRows);
d=answer(d,'top',topmm+25);assert(!find(plan(d),'مقارنة ارتفاع').label.includes('مبدئية'));assert(find(plan(d),'مقارنة ارتفاع').value.includes(fmt(45)));
d=answer(d,'bearing','mixed');assert.equal(plan(d).derived.length,0);assert(askIds(d).length===0);assert(plan(d).notes.some(x=>x.label.includes('مراجعة')));
d=answer(d,'bearing','absent');assert.equal(askIds(d).length,0);assert.equal(plan(d).derived.length,0);
d=answer(d,'bearing','ledge');assert.deepEqual(askIds(d),['ledge']);d=answer(d,'ledge',0,{unknown:true});assert(!find(plan(d),'صافي ارتفاع'));assert(plan(d).deferred.some(q=>q.id==='ledge'));
const insert=(d,row)=>({...d,room:apply(upsertFieldRecord(d.room,{inputCode:'SITE-19',valueType:'number',verification:'measured',unit:'مم',...row})).room});
// One deliberate bearing selection links existing evidence (cm converted to mm);
// an explicitly named different dishwasher cannot donate its minimum or top.
let seeded=insert(demo,{itemId:'تعلية-ب',property:'منسوب أعلى التعلية',value:10,unit:'سم'});
seeded=insert(seeded,{itemId:'جهاز آخر',inputCode:'EQP-02',property:'الحد الأدنى لارتفاع فتحة الموديل',value:750,readingRef:'D2-MIN',location:'غسالة أخرى [other-id]'});
const bearing=plan(seeded).questions[0].options.find(o=>o.label.includes('تعلية-ب'));assert(bearing);
seeded=answer(seeded,'bearing',bearing.value);assert.deepEqual(askIds(seeded),['min']);eq(find(plan(seeded),'صافي ارتفاع').value,fmt(topmm-100));
// Verified conflicting levels must block the net calculation, not fall back to CAD.
let clash=insert(seeded,{itemId:u.id,inputCode:'CAT-17',property:'منسوب أسفل الرخام عن صفر الأرضية النهائية',value:875});
clash=insert(clash,{itemId:u.id,inputCode:'CAT-17',property:'منسوب أسفل الرخام عن صفر الأرضية النهائية',value:885});assert(!find(plan(clash),'صافي ارتفاع'));assert(plan(clash).answers.find(q=>q.id==='top').evidence.state==='conflict');
let empty={room:{width:400,length:360,height:280},kitchen:null};empty.kitchen=createKitchen(empty.room,'empty');
assert.deepEqual(plan(empty,'@field').questions.map(q=>q.id),['present']);empty=answer(empty,'present',false,{entityId:'@field'});assert.equal(plan(empty,'@field').questions.length,0);
empty=answer(empty,'present',true,{entityId:'@field'});empty=answer(empty,'bearing','zero',{entityId:'@field'});assert.deepEqual(plan(empty,'@field').questions.map(q=>q.id),['top','min']);
let twin=demo,run=apply(addRun(twin.kitchen,twin.room,{id:'other-row',wall:'back',tier:'base',start:100,end:185,depth:60,bottom:0,height:90})).kitchen;
run=apply(addUnit(run,twin.room,{id:'second-washer',kind:'dishwasher',runId:'other-row',u:100,width:60})).kitchen;
twin=answer({...twin,kitchen:run},'bearing','zero');
assert.deepEqual(plan(twin,'second-washer').questions.map(q=>q.id),['bearing']);
console.log('Adaptive dishwasher: separate device scopes, actual underside vs slab top, reuse/convert real ledge, zero explicit, mixed feet stop, unknown/contradictions block, CAD reactive/provisional, site-only device conditional.');

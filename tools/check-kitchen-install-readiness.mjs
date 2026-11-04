import assert from 'node:assert/strict';
import {createKitchen,addRun,addUnit} from '../public/kitchen-model.js';
import {cleanInstallReadiness,certifyInstallDependency,evaluateInstallRoute,installReadinessIssues,installJobIssues} from '../public/kitchen-install-readiness.js';
const room={width:500,length:450,height:280},base=createKitchen(room,'empty');
const run=addRun(base,room,{wall:'back',tier:'base',depth:60,height:80,start:0,end:280,id:'run-a'});assert(run.ok,run.reason);
let k=run.kitchen;for(const [id,u] of [['cab-a',0],['cab-b',120]]){const r=addUnit(k,room,{id,kind:'storage',runId:'run-a',u,width:90});assert(r.ok,r.reason);k=r.kitchen;}
const doc={room:{...room,workshop:{}},kitchen:k};
const baseRoute={id:'route-a',unitId:'cab-a',name:'نقل الدولاب',source:'مخطط المناولة',entry:'normal',mode:'assembled',margin:0,padding:5,mass:55,
 stations:[{kind:'door',label:'الباب',width:940,height:2100},{kind:'turn',label:'بسطة ٩٠',width:1300,depth:1300,height:2200},
 {kind:'lift',label:'مصعد',width:650,depth:950,height:2100,capacity:70}]};
assert(evaluateInstallRoute(doc,baseRoute).ok);assert(!evaluateInstallRoute(doc,{...baseRoute,stations:baseRoute.stations.filter(s=>s.kind!=='turn')}).ok);
assert(!evaluateInstallRoute(doc,{...baseRoute,stations:[{kind:'turn',label:'بسطة قريبة',width:930,depth:930,height:1900}]}).ok);
const alternativeTurn={kind:'turn',label:'بسطة مدروسة',width:930,depth:930,height:1900,manoeuvre:'خطة دوران خارج حافة البسطة مثبتة في R2'};
assert(!evaluateInstallRoute(doc,{...baseRoute,stations:[alternativeTurn]}).ok);
assert(evaluateInstallRoute(doc,{...baseRoute,stations:[{...alternativeTurn,reviewer:'مهندس الموقع'}]}).ok);
assert(!evaluateInstallRoute(doc,{...baseRoute,mass:null}).ok);assert(!evaluateInstallRoute(doc,{...baseRoute,mass:71}).ok);
const dep={id:'work-a',unitId:'cab-a',kind:'receipt',phase:'install',name:'وصول الجهاز',trade:'المالك',due:'2026-10-31',planRef:'طلب P1',model:'Z-200',checks:[{label:'عرض الفتحة',target:600,tolerance:2}]};
const w={routes:[baseRoute],dependencies:[dep]};doc.room.workshop.installReadiness=w;
assert.deepEqual(cleanInstallReadiness(w),w);assert.deepEqual(installReadinessIssues(doc,null,'cut'),[]);assert(installReadinessIssues(doc,null,'install').length);assert(!installReadinessIssues(doc,{unitIds:['cab-b']},'install').length);
const receipt={by:'الفني',ref:'استلام R2',date:'2026-10-31',actual:[600],model:'Z-200'};
const prove=(original,r,p)=>{const q=structuredClone(original);const saved=certifyInstallDependency(q,r,p);assert(saved.ok,saved.reason);q.room.workshop.installReadiness.dependencies=[saved.record];return q;};
const done=prove(doc,dep,receipt);assert.deepEqual(installJobIssues(doc,done,'cab-a','install'),[]);assert(!installReadinessIssues(done,null,'install').length);
const wrong=prove(doc,dep,{...receipt,model:'Z-203',actual:[620]});assert.equal(installReadinessIssues(wrong,null,'install').length,2);
const removed=structuredClone(done);removed.room.workshop.installReadiness.dependencies=[];assert(installJobIssues(doc,removed,'cab-a','install').length);assert.deepEqual(installJobIssues(doc,removed,'cab-a','ship'),[]);
const tomorrow=prove(doc,dep,{...receipt,date:'2999-01-01'});assert(installReadinessIssues(tomorrow,null,'install').some(s=>s.includes('لاحق لليوم')));
// Proof dates are typed in the local calendar (UTC+3) while the server compares in UTC. At 01:30 on 2 Nov in Riyadh the UTC
// date is still 1 Nov: a proof dated 2 Nov must not read as a future date, and a genuinely later one still must.
{const RealDate=Date,frozen=RealDate.parse('2026-11-01T22:30:00Z');
 globalThis.Date=class extends RealDate{constructor(...a){a.length?super(...a):super(frozen);}static now(){return frozen;}};
 try{
  assert(!installReadinessIssues(prove(doc,dep,{...receipt,date:'2026-11-02'}),null,'install').some(s=>s.includes('لاحق لليوم')),'a proof dated today in UTC+3');
  assert(installReadinessIssues(prove(doc,dep,{...receipt,date:'2026-11-04'}),null,'install').some(s=>s.includes('لاحق لليوم')),'a proof dated two days ahead');
 }finally{globalThis.Date=RealDate;}}
const future={...dep,kind:'finish',phase:'cut',name:'سماكة الكسوة',planRef:'طلب حاجز',checks:[{label:'من ظهر الجدار للتشطيب',target:14,tolerance:1}]};delete future.model;
const cut=structuredClone(doc);cut.room.workshop.installReadiness.dependencies=[future];assert(installReadinessIssues(cut,{unitIds:['cab-a']}).length);
const confirmed=prove(cut,future,{...receipt,actual:[14]});assert(!installReadinessIssues(confirmed,{unitIds:['cab-a']}).length);
confirmed.kitchen.units[0].width=92;assert(installReadinessIssues(confirmed,{unitIds:['cab-a']}).length);
assert(!cleanInstallReadiness({routes:[{...baseRoute,margin:-1}],dependencies:[]}));
console.log('Cut vs install vs transport scope, verified device model and measured work tolerances, linked geometry change, axis-consistent doors/landing/lift, missing weight and documented alternative turn, preserved historical requirement on later project evidence.');
const layers={...future,finish:{axis:'width',currentClear:950,add:45,remove:10,required:930,tolerance:2}};
const pending=structuredClone(doc);pending.room.workshop.installReadiness.dependencies=[layers];
assert(installReadinessIssues(pending,null).some(z=>z.includes('915')&&z.includes('15')));
const mismatch=prove(doc,layers,{...receipt,actual:[14],finishedClear:920});assert.equal(installReadinessIssues(mismatch,null).length,2);
const fixture={id:'fixture-tile',kind:'column',wall:'back',u:12,bottom:0,width:7,depth:3,height:50};
const withFixture=structuredClone(doc);withFixture.kitchen.features.push(fixture);
const {linkInstallChange}=await import('../public/kitchen-install-readiness.js');
const move=linkInstallChange(withFixture,{...future,kind:'relocate',name:'نقل العائق'},fixture.id,{plannedStation:240,plannedBottom:0,tolerance:2});
assert(move.ok,move.reason);const m=prove(withFixture,move.record,{...receipt,actual:[14]});assert(installReadinessIssues(m,null).some(x=>x.includes('الموضع المطلوب')));
m.kitchen.features[0].u=24;const moved=prove(m,move.record,{...receipt,actual:[14]});assert.deepEqual(installReadinessIssues(moved,null),[]);
const rem=linkInstallChange(withFixture,{...future,kind:'remove'},fixture.id);assert(rem.ok);const uns=prove(withFixture,rem.record,{...receipt,actual:[14]});assert(installReadinessIssues(uns,null).length);
uns.kitchen.features=[];const cleared=prove(uns,rem.record,{...receipt,actual:[14]});assert.deepEqual(installReadinessIssues(cleared,null),[]);
console.log('Projected post-finish clear dimension and tolerances, retained planning/actual state, as-built same-id movement and removal gates verified.');

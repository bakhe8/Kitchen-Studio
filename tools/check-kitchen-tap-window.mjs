import assert from 'node:assert/strict';
import {attestChain,chainFromDrawing,makeChainExample,readChainRange} from '../public/kitchen-chain-model.js';
import {planWorkshopRow} from '../public/kitchen-production-row.js';
import {cleanTapChecks,evaluateTapChecks,saveTapCheck,tapWindowIssues} from '../public/kitchen-tap-window.js';
import {cleanIdea} from '../public/kitchen-ideas.js';
import {kitchenGeometry} from '../public/kitchen-model.js';
import {acceptPattern} from '../public/kitchen-surface-pattern.js';
import {approvalState,releaseConcerns} from '../public/kitchen-workshop-state.js';
let doc=makeChainExample();doc=planWorkshopRow(doc,{...readChainRange(doc,'back'),tier:'base',wanted:{sink:true,dishwasher:false,rice:false}}).doc;
const sink=doc.kitchen.units.find(u=>u.kind==='sink'),window=doc.kitchen.features.find(f=>f.kind==='window');
Object.assign(window,{u:360,width:100,swing:'in',hinge:'left',hingeInset:0,leafWidth:45});delete window.parking;
const proof=attestChain(doc,'back',chainFromDrawing(doc,'back'),{reference:'محاور الزيارة QA',name:'رافع المقاسات'});assert(proof.ok,proof.reason);doc.room.workshop.chains.back=proof.chain;
const target={sinkId:sink.id,windowId:window.id,model:'Tap fixture 17',manual:'QA manufacturer diagram',source:'ورشـة / محضر أبعاد الزيارة',reviewer:'فني المقاسات',mount:{kind:'deck',uMm:210,dMm:500,diameterMm:35,minDiameterMm:34,maxDiameterMm:36,deckRiseMm:0,hole:''},
 bodyRadiusMm:20,bodyHeightMm:200,clearanceMm:10,sash:{planeMm:0,lowerInsetMm:20,leafHeightMm:900,thickMm:15,handleMm:3,openDeg:90},
 neck:{mode:'fixed',duMm:0,ddMm:0,reachMm:110,radiusMm:8,bottomMm:305,topMm:345,fromDeg:0,travelDeg:0},lever:{mode:'none'}};
const fit=(v,d=doc)=>{const x=saveTapCheck(d,v);assert(x.ok,x.reason);return x.doc;},check=(v,d=doc)=>evaluateTapChecks(fit(v,d));
const clear=fit(target),r=evaluateTapChecks(clear);assert.deepEqual(r.issues,[]);assert.equal(r.results[0].parts.length,2);
const moving={...target,neck:{...target.neck,mode:'swivel',fromDeg:180,travelDeg:180}};
const moved=fit(moving),bad=evaluateTapChecks(moved);assert(bad.issues.some(m=>m.includes('عنق الخلاط')));assert(bad.results[0].parts.find(p=>p.label==='جسم الخلاط').ok);
assert.deepEqual(check({...target,neck:{...target.neck,fromDeg:180}}).issues,[]); // Both end poses clear; the intervening rearward arc is not.
const lever={...target,lever:{...target.neck,mode:'fixed',reachMm:150,fromDeg:-90}};assert(check(lever).issues.some(m=>m.includes('ذراع التشغيل')));
const high=structuredClone(doc);high.kitchen.features.find(f=>f.id===window.id).bottom=170;assert(check(lever,high).issues.some(v=>v.includes('رفع الشباك')));high.room.workshop.chains.back=attestChain(high,'back',chainFromDrawing(high,'back'),{name:'مراجع',reference:'ارتفاع جديد'}).chain;assert.deepEqual(check(lever,high).issues,[]);
const rev=structuredClone(clear);rev.kitchen.features.find(f=>f.id===window.id).hinge='right';assert(tapWindowIssues(rev).some(s=>s.includes('تغيّرت')));
const unknown=structuredClone(doc);delete unknown.kitchen.features.find(f=>f.id===window.id).hingeInset;assert(check(target,unknown).issues.length);
assert(check({...target,lever:{mode:'unknown'}}).issues.length);assert(check({...target,sash:{...target.sash,openDeg:null}}).issues.length);
assert(check({...target,mount:{...target.mount,diameterMm:39}}).issues.length);
assert.deepEqual(tapWindowIssues(moved,{unitIds:['different-body']}),[]);assert(tapWindowIssues(moved,{unitIds:[sink.id]}).length);
assert.deepEqual(tapWindowIssues(doc),[]);assert.equal(cleanTapChecks([target,target]),null);
const t=kitchenGeometry(doc.kitchen,doc.room).worktops[0],h={id:sink.id,modelRef:'Sink A',shape:'rect',x:2300,y:100,width:400,depth:275,radius:8};
const f={id:'extra:hole',modelRef:'Tap fixture 17',shape:'circle',x:(sink.u-t.start)*10+210,y:500,radius:17.5};
const form={source:'test pattern',datum:'rear',materialRef:'slab A',limitRef:'shop',levelRef:'installed',inspector:'collector',date:'2026-10-31',fitToleranceMm:1,edgeGapMm:5,webMm:2,thicknessMm:t.height*10,outer:[[0,0],[3000,0],[3000,600],[0,600]],holes:[h,f]};
const patterned=acceptPattern(doc,t,form);assert(patterned.ok,patterned.reason);
const digital={...target,mount:{...target.mount,kind:'digital',hole:f.id,uMm:null,dMm:null,diameterMm:null}};
assert.deepEqual(check(digital,patterned.doc).issues,[]);
assert(check(digital).issues.some(v=>v.includes('قالب')));const stale=fit(digital,patterned.doc);stale.room.workshop.surfacePatterns[t.id].holes[1].x+=8;assert(tapWindowIssues(stale).some(v=>v.includes('تغيّرت')));
const atEdge=acceptPattern(doc,t,{...form,holes:[h,{...f,y:575}]});assert(atEdge.ok);assert(check({...digital,bodyRadiusMm:32},atEdge.doc).issues.some(v=>v.includes('خارج مادة السطح')));
const saved=cleanIdea(JSON.parse(JSON.stringify(moved)));assert.deepEqual(saved?.room.workshop.tapChecks,moved.room.workshop.tapChecks);const rejection=releaseConcerns(saved,await approvalState(saved));assert(rejection.some(v=>v.includes('عنق الخلاط')));
console.log('Sink/tap pair and field geometry: continuous referenced inward sash and spout arc clash between two clear end poses, lever collision in isolation, safe higher sash, unknown travel & altered window hold; physical deck and verified digital mount/flange fit, archive and scoped cut gate.');

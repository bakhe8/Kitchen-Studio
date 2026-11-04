import assert from 'node:assert/strict';
import {wallPairDatum,cleanWallPairs,evaluateWallPair} from '../public/kitchen-wall-pair.js';
import {parseMeasuredOutline} from '../public/kitchen-measured-outline.js';
import {saveScanDraft,reviewScanBand} from '../public/kitchen-wall-profile.js';
import {createKitchen} from '../public/kitchen-model.js';

const room={width:300,length:300,height:280},doc={room,kitchen:createKitchen(room,'blank')};
function read(d=doc,wall='back',fields={}){
 return {datum:wallPairDatum(d,wall),backMm:3000,frontMm:2980,heightMm:700,depthMm:600,...fields};
}
const anchor=(side,offsetMm)=>({side,offsetMm});
const solve=(fields,d=doc,w='back')=>evaluateWallPair(d,w,read(d,w,fields));
let q=solve({});assert.equal(q.status,'unlocated');assert.equal(q.differenceMm,-20);assert.equal(q.clearMm,null);
assert.equal(solve({frontMm:3000}).status,'unlocated');
assert.equal(solve({frontMm:3020}).frontTrend,'widening');
assert.equal(solve({frontMm:3001,errorMm:1}).frontTrend,'level-or-within-error');
assert.deepEqual(cleanWallPairs({back:{base:read(),upper:read(doc,'back',{heightMm:1800})}}).back.base,read());
for(const bad of [{wall: {base:read()}},{back:{lower:read()}},{back:{base:read(doc,'back',{backMm:'3000'})}},{back:{base:read(doc,'back',{anchor:{side:'left',offsetMm:0}})}}])assert.equal(cleanWallPairs(bad),null);
q=solve({anchor:anchor('start',0)});assert.equal(q.status,'resolved');assert.equal(q.endOffsetMm,-20);assert.equal(q.clearMm,2980);assert.equal(q.source,'field');
q=solve({anchor:anchor('end',0)});assert.equal(q.startOffsetMm,20);assert.deepEqual([q.startMm,q.endMm],[20,3000]);
q=solve({anchor:anchor('start',8)});assert.equal(q.endOffsetMm,-12);assert.deepEqual([q.startMm,q.endMm],[8,2988]);
q=solve({frontMm:3020,anchor:anchor('start',0)});assert.equal(q.clearMm,3000);assert.equal(q.endOffsetMm,20);
q=solve({frontMm:3000,anchor:anchor('end',20)});assert.equal(q.clearMm,2980);assert.equal(q.startOffsetMm,20);
q=solve({anchor:anchor('start',30)});assert.equal(q.clearMm,2970);assert.equal(q.endOffsetMm,10);
q=solve({anchor:anchor('start',0),errorMm:1});assert.equal(q.nominalClearMm,2980);assert.equal(q.startMm,1);assert.equal(q.endMm,2978);
assert.equal(solve({anchor:anchor('start',3000)}).status,'invalid');
assert.equal(solve({anchor:anchor('start',0),depthMm:3100}).status,'conflict');
assert.equal(solve({heightMm:2900}).status,'invalid');
assert.equal(solve({backMm:2900}).status,'conflict');
assert.equal(evaluateWallPair({...doc,room:{...room,width:304}},'back',read()).status,'stale');
const rotated={...doc,room:{...room,architecture:{cut:{corner:'back-left',kind:'taper',width:5,depth:3}}}};
assert.notEqual(wallPairDatum(rotated,'back'),wallPairDatum(doc,'back'));
const outlineDoc=vertices=>({room:parseMeasuredOutline({vertices,unit:'mm',reference:'إحداثيات الزيارة',heightMm:2800}).room,kitchen:doc.kitchen});
const trapezoid=outlineDoc([[0,0],[3000,0],[2900,3000],[0,3000]]);
q=solve({},trapezoid,'poly-01');assert.equal(q.status,'resolved');assert.equal(q.source,'outline');assert.equal(q.clearMm,2980);
assert.equal(solve({frontMm:2980.4},trapezoid,'poly-01').clearMm,2980);
assert.equal(solve({frontMm:3020},trapezoid,'poly-01').status,'conflict');
assert.equal(solve({anchor:anchor('start',5)},trapezoid,'poly-01').status,'conflict');
const slid=outlineDoc([[0,0],[3000,0],[3100,3000],[100,3000]]);
q=solve({frontMm:3000},slid,'poly-01');assert.equal(q.status,'resolved');assert.equal(q.startOffsetMm,20);assert.equal(q.clearMm,2980);

// A physical side already checked in the visit is independent of the unknown
// opposite side. Sample at exactly this elevation and at both measuring lines.
const lines=['unit=mm','axes=X:right,Y:up,Z:front','origin=rear-left-finished-floor','reference=إحداثيات الضلع الأيسر'];
for(const h of [600,700,800])for(const z of [0,300,600])lines.push('left 0 '+h+' '+z);
const b={id:'known-left',wall:'left',low:600,high:800,pitchX:350,pitchY:150,tol:1};
const draft=saveScanDraft(doc,lines.join('\n'),b);assert(draft.ok,draft.reason);
assert.equal(solve({},draft.doc).status,'unlocated');
const reviewed=reviewScanBand(draft.doc,b.id,{name:'الفني',ref:'مطابقة الزاوية على خط الظهر وخط الوجه',boundMm:0});assert(reviewed.ok,reviewed.reason);
q=solve({},reviewed.doc);assert.equal(q.status,'resolved');assert.equal(q.source,'scan');assert.equal(q.endOffsetMm,-20);assert.equal(q.clearMm,2980);
assert.equal(solve({heightMm:710},reviewed.doc).status,'unlocated');assert.equal(solve({depthMm:610},reviewed.doc).status,'unlocated');
assert.equal(solve({anchor:anchor('start',7)},reviewed.doc).status,'conflict');
console.log('Paired wall widths: signed difference, datum/source and reviewed return, narrowing/widening, shifted equal widths, non-overlap, limits, uncertainty and stale geometry verified.');

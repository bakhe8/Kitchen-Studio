import assert from 'node:assert/strict';
import {createShelfPlan,applyPreset} from '../public/shelf-model.js';
import {splitTarget} from '../public/shelf-selection-model.js';
import {createKitchen,validateKitchen,kitchenGeometry as geometry,addRun,updateRun,addUnit,updateUnit,
  addFeature,updateFeature,removeKitchenItem,suggestKitchenFix,kitchenWallLocal,kitchenWallPoint} from '../public/kitchen-model.js';

const room={width:360,length:300,height:260},EPS=1e-6;
const near=(a,b)=>assert(Math.abs(a-b)<EPS,`${a} vs ${b}`);
const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);Object.values(o).forEach(freeze);}return o;};
const put=r=>{assert(r.ok,r.reason);return r.kitchen;};
const valid=k=>assert.deepEqual(validateKitchen(JSON.parse(JSON.stringify(k)),room),k);
let k=freeze(createKitchen(room)),saved=JSON.stringify(k);valid(k);
const g=geometry(k,room),sink=g.units.find(u=>u.id==='unit-sink'),dr=g.units.find(u=>u.id==='unit-drawers'),washer=g.units.find(u=>u.id==='unit-dishwasher');
assert(!g.conflicts.length);assert.equal(sink.windowId,'feature-window');assert.equal(sink.nearestDrain.id,'feature-drain');assert(sink.nearestDrain.distance>0);
assert.equal(g.cutouts.length,2);assert.equal(g.worktops.find(t=>t.runId==='run-back').holes.length,2);
assert.equal(g.worktops.find(t=>t.runId==='run-back').end,330);assert.equal(g.worktops.filter(t=>t.runId==='run-left').length,2);
const left=g.runs.find(r=>r.id==='run-left'),back=g.runs.find(r=>r.id==='run-back');
near(left.end,room.length-back.depth);near(left.rect.z,back.rect.z+back.rect.d);assert.equal(left.tier,'base');
for(const w of ['left','right','front','back'])assert.deepEqual(kitchenWallLocal(room,w,kitchenWallPoint(room,w,103,22)),{u:103,d:22});
assert.deepEqual(geometry(createKitchen(room,'empty'),room).worktops,[]);
// Grow a new partial left wall run to the back corner: subtract one existing
// perpendicular depth, even if drawn backwards. Upper run remains independent.
let bk=createKitchen(room,'empty');
bk=put(addRun(bk,room,{wall:'back',tier:'base',start:200,end:0,id:'rear'}));
const bend=addRun(bk,room,{wall:'left',tier:'base',start:300,end:90,id:'leg'});assert(bend.ok&&bend.clamped);bk=bend.kitchen;
assert.equal(bk.runs[1].end,240);assert.equal(bk.runs[1].start,90);
bk=put(addRun(bk,room,{wall:'back',tier:'upper',start:25,end:170,id:'upper'}));assert.equal(bk.runs[2].start,25);
assert(!addRun(bk,room,{wall:'back',tier:'base',start:180,end:230}).ok);
assert(!addRun(bk,room,{wall:'left',tier:'base',start:285,end:300}).ok);
assert(!updateRun(k,room,'run-back',{end:280}).ok,'trimming cannot resize the authored hob or move its neighbour');

// Separate forms of collision: overlying projections at disjoint heights are
// harmless, and mere touching is not a collision. Here neither opened part
// hits a closed neighbouring body, but the two extended boxes intersect.
const open=r=>put(updateUnit(k,room,r,{open:true}));
assert.deepEqual(geometry(open(washer.id),room).conflicts,[]);assert.deepEqual(geometry(open(dr.id),room).conflicts,[]);
const both=freeze(put(updateUnit(open(washer.id),room,dr.id,{open:true})));const cs=geometry(both,room).conflicts;
assert.equal(cs.length,1);assert.equal(cs[0].type,'open-open');near(cs[0].rect.w,41.9);near(cs[0].rect.d,34.9);near(cs[0].bottom,8);near(cs[0].height,4);
const fix=suggestKitchenFix(both,room,cs[0]);assert(fix&&fix.reason);const fixed=put(updateUnit(both,room,fix.unitId,{u:fix.u}));
assert.deepEqual(geometry(fixed,room).conflicts,[]);assert.equal(fixed.units.find(u=>u.id===washer.id).open,true);assert(fixed.units.find(u=>u.id===dr.id).open);
assert.equal(suggestKitchenFix(k,room,cs[0].id),null);valid(both);valid(fixed);
assert.equal(updateUnit(k,room,washer.id,{width:45}).kitchen,k);assert.equal(k.units.find(u=>u.id===washer.id).width,60);
assert(!updateUnit(k,room,sink.id,{u:washer.u}).ok);assert(!removeKitchenItem(k,'run-back').ok);
assert.equal(JSON.stringify(k),saved);

// Real surface clusters split/rejoin across empty space. A hosted aperture
// translates with the owning unit and never remains on a stale surface.
let simple=createKitchen(room,'empty');
simple=put(addRun(simple,room,{wall:'back',tier:'base',start:0,end:300,id:'run'}));
for(const u of [{id:'a',kind:'storage',u:0,width:60},{id:'b',kind:'sink',u:60,width:80},{id:'c',kind:'storage',u:200,width:60}])
  simple=put(addUnit(simple,room,{...u,runId:'run'}));
const gaps=geometry(simple,room).runs[0].gaps;assert.deepEqual(gaps,[{start:140,end:200,width:60},{start:260,end:300,width:40}]);
const tops=geometry(simple,room).worktops;assert.deepEqual(tops.map(t=>[t.start,t.end]),[[0,140],[200,260]]);
const hole=tops[0].holes[0];let shifted=put(updateUnit(simple,room,'b',{u:100}));
const tops2=geometry(shifted,room).worktops;assert.equal(tops2.length,3);near(tops2.find(t=>t.holes.length).holes[0].rect.x-hole.rect.x,40);
shifted=put(updateUnit(shifted,room,'c',{u:180}));assert.deepEqual(geometry(shifted,room).worktops.map(t=>[t.start,t.end]),[[0,60],[100,240]]);
let noSink=put(removeKitchenItem(shifted,'b'));assert.equal(geometry(noSink,room).cutouts.length,0);
noSink=put(addUnit(noSink,room,{id:'tall',runId:'run',kind:'tall',u:70,width:60}));
assert.equal(geometry(noSink,room).worktops.length,2);
const wall=put(addRun(simple,room,{id:'up',wall:'back',tier:'upper',start:30,end:140}));
let feature=put(addFeature(wall,room,{id:'win',kind:'window',wall:'back',u:50,width:65}));
const unitSpec={id:'upper-store',runId:'up',kind:'storage',u:30,width:80};
assert.equal(addUnit(feature,room,unitSpec).kitchen,feature,'the present editor must not put an upper body across its window');
// Still diagnose and repair a structurally valid OLD saved document. Its
// overlapping unit was created in a clear run long before this policy.
const oldUpper=put(addUnit(wall,room,unitSpec)).units.find(u=>u.id===unitSpec.id);
feature=validateKitchen({...feature,units:[...feature.units,oldUpper]},room);assert(feature);
assert(geometry(feature,room).conflicts.some(c=>c.type==='body-feature'&&c.ids.includes('win')&&c.ids.includes('upper-store')));
feature=put(updateFeature(feature,room,'win',{u:155}));assert(!geometry(feature,room).conflicts.length);
feature=put(addFeature(feature,room,{id:'pipe',kind:'drain',wall:'back',u:45}));
assert(!geometry(feature,room).conflicts.some(c=>c.ids.includes('pipe')));
const pierSpec={id:'column',kind:'column',wall:'back',u:20,width:25,depth:30};
const forbiddenPier=addFeature(feature,room,pierSpec);assert(!forbiddenPier.ok&&forbiddenPier.kitchen===feature);
const oldPier=put(addFeature(createKitchen(room,'empty'),room,pierSpec)).features[0];
const column=validateKitchen({...feature,features:[...feature.features,oldPier]},room);assert(column);
assert(geometry(column,room).conflicts.some(c=>c.type==='body-feature'&&c.ids.includes('column')));
assert(geometry(column,room).conflicts.some(c=>c.type==='top-feature'));

// Original shelf model's nested cabinet detail survives and is independent:
// root/cell finish, child IDs and contents. Room layer, screen and unrelated
// editor state never leak into the kitchen or into its serialized detail.
let detail=applyPreset(createShelfPlan(),'library');
detail=splitTarget(detail,{kind:'cell',key:'0:0'},'col').plan;
const dirty={...detail,room:{joke:1},sizedObject:{joke:1},extra:'removed'};
const withDetail=put(updateUnit(simple,room,'b',{detail:dirty}));const d=withDetail.units.find(u=>u.id==='b').detail;
assert.deepEqual(d.cellGrids,detail.cellGrids);assert.deepEqual(d.cells,detail.cells);assert(!('room' in d||'sizedObject' in d||'extra' in d));valid(withDetail);
assert.equal(updateUnit(withDetail,room,'b',{width:45}).code,'detail-fit');
const malformed=structuredClone(withDetail);malformed.units[1].detail.cellGrids['0:0'].children[0].content='alien';assert.equal(validateKitchen(malformed,room),null);
const small={width:100,length:95,height:125};assert.deepEqual(validateKitchen(k,small),k);
assert(geometry(k,small).conflicts.some(c=>c.type==='outside-room'));
const dupe=structuredClone(k);dupe.units[1].id=dupe.runs[0].id;assert.equal(validateKitchen(dupe,room),null);
assert.equal(validateKitchen({...k,version:99},room),null);
assert.equal(JSON.stringify(k),saved);
console.log('Kitchen model: clipped orthogonal runs, tier separation, appliances, joined slabs/hosted holes, actual open collision + checked remedy, room obstacles and nested saved interiors passed.');

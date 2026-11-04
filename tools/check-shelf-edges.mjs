import assert from 'node:assert/strict';
import {createShelfPlan,updateCab,validatePlan} from '../public/shelf-model.js';
import {targetInfo,scopedDividers,splitTarget,commitDividerDrop,moveScopedDivider,selectedTarget,dividerReach,dividerDragStatus} from '../public/shelf-selection-model.js';

const cab={kind:'cabinet'},wall={kind:'wall'},c=key=>({kind:'cell',key}),z=key=>({kind:'zone',key});
const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);Object.values(o).forEach(freeze);}return o;};
const base=freeze(createShelfPlan()),saved=JSON.stringify(base),near=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} vs ${b}`);
const d=(p,id)=>{const out=scopedDividers(p).find(x=>x.id===id);assert(out,`Missing ${id}`);return out;};
const split=(p,t,axis)=>{const r=splitTarget(p,t,axis);assert(r.ok,r.reason);return freeze(r.plan);};
const cut=(p,t,axis,x,y)=>{const r=commitDividerDrop(p,t,axis,{x,y});assert(r.ok,r.reason);return freeze(r.plan);};
const sides=(p,t)=>new Map(scopedDividers(p).map(b=>dividerReach(p,t,b)).filter(r=>r?.relation==='boundary').map(r=>[r.side,r]));
const sameSpan=(s,lo,hi)=>{near(s.start,lo);near(s.end,hi);};

// Base middle cell reaches all FOUR physical neighbouring boards, previously
// lost because their parent is the whole cabinet. Reach uses the clear face,
// never the centre line or a broad hit area along the whole cabinet board.
const mid=c('1:1'),m=targetInfo(base,mid),ms=sides(base,mid);
assert.deepEqual([...ms.keys()].sort(),['bottom','left','right','top']);
for(const side of ['left','right'])sameSpan(ms.get(side),m.y,m.y+m.h);
for(const side of ['top','bottom'])sameSpan(ms.get(side),m.x,m.x+m.w);
const rootLeft=d(base,'cabinet:col:0');near(rootLeft.cm+rootLeft.w/2,m.x);
assert.equal(ms.get('left').dividerId,rootLeft.id);assert.deepEqual(ms.get('left').owner,cab);
assert(ms.get('left').start>rootLeft.y&&ms.get('left').end<rootLeft.y+rootLeft.h);
const edgeCell=c('0:0');assert.deepEqual([...sides(base,edgeCell).keys()].sort(),['bottom','right']);
assert.equal(dividerReach(base,edgeCell,'cabinet:frame:left'),null);assert.equal(dividerReach(base,mid,'no-board'),null);
const owned=dividerReach(base,cab,rootLeft);assert.equal(owned.relation,'owned');assert.equal(owned.side,null);sameSpan(owned,rootLeft.y,rootLeft.y+rootLeft.h);
assert.equal(dividerReach(base,wall,rootLeft),null);assert.equal(dividerReach(base,c('0:0'),d(base,'cabinet:col:1')),null);
assert.equal(dividerReach(base,mid,{...rootLeft,cm:rootLeft.cm+.001,x:rootLeft.x+.001}),null,'Do not tolerate a near-but-not-current divider.');
assert.equal(dividerReach(base,mid,{...rootLeft,owner:c('0:0')}),null);assert.equal(dividerReach(base,{kind:'cabinet',key:''},rootLeft),null);

// Two local levels: a base board and a grandparent's local divider still
// bound the small leaf. Only the matching side/overlap is interactive. A
// different local subtree or a descendant's own divider is not inherited.
let tree=split(split(base,mid,'col'),c('1:1/0'),'row');
const leaf=c('1:1/0/1'),leafInfo=targetInfo(tree,leaf),inherited=sides(tree,leaf);
assert.deepEqual([...inherited.keys()].sort(),['bottom','left','right','top']);
assert.equal(inherited.get('left').dividerId,'cabinet:col:0');assert.equal(inherited.get('bottom').dividerId,'cabinet:row:1');
assert.equal(inherited.get('right').dividerId,'cell:1:1:col:0');assert.equal(inherited.get('top').dividerId,'cell:1:1/0:row:0');
for(const side of ['left','right'])sameSpan(inherited.get(side),leafInfo.y,leafInfo.y+leafInfo.h);
for(const side of ['top','bottom'])sameSpan(inherited.get(side),leafInfo.x,leafInfo.x+leafInfo.w);
const local=d(tree,'cell:1:1/0:row:0');assert.equal(dividerReach(tree,c('1:1/0'),local).relation,'owned');
assert.equal(dividerReach(tree,mid,local),null);assert.equal(dividerReach(tree,c('1:1/1'),local),null);
const external=split(tree,c('0:1'),'row');assert.equal(dividerReach(external,leaf,d(external,'cell:0:1:row:0')),null);

// Exactly one wall divider may have TWO visible pieces around the foreground
// cabinet. Never produce a single interactive interval across its occlusion.
const w1=cut(base,wall,'col',180,24),line=d(w1,'zone:wall:col:0'),wreach=dividerReach(w1,wall,line);
assert.equal(wreach.relation,'owned');assert.deepEqual(wreach.segments,[{start:0,end:55},{start:220,end:260}]);sameSpan(wreach,0,55);
const leftZone=z('wall/0'),zoneReach=dividerReach(w1,leftZone,line);assert.equal(zoneReach.relation,'boundary');assert.equal(zoneReach.side,'right');assert.deepEqual(zoneReach.segments,wreach.segments);
assert.equal(dividerReach(w1,mid,line),null);assert.equal(dividerReach(w1,leftZone,rootLeft),null);
const w2=cut(w1,leftZone,'row',20,100),w3=cut(w2,z('wall/0/1'),'row',20,180);
const visible=dividerReach(w3,z('wall/0/0'),line);assert.equal(visible.side,'right');assert.deepEqual(visible.segments,[{start:0,end:55}]);
assert.equal(dividerReach(w3,z('wall/0/1/0'),line),null,'Entire overlapping part sits behind cabinet.');
assert.deepEqual(dividerReach(w3,z('wall/0/1/1'),line).segments,[{start:220,end:260}]);
const exposed=updateCab(w3,{x:0,y:0,w:60,h:60});sameSpan(dividerReach(exposed,z('wall/0/1/0'),line),100,180);
// Sibling grids can contain collinear wall dividers meeting at exactly one
// endpoint. That is not a shared edge, despite matching x and axis.
const smallCab=updateCab(base,{x:0,y:0,w:60,h:60});
const horizontal=cut(smallCab,wall,'row',20,130),topHalf=cut(horizontal,z('wall/0'),'col',180,24),twoRows=cut(topHalf,z('wall/1'),'col',180,190);
const topLine=d(twoRows,'zone:wall/0:col:0'),bottomLine=d(twoRows,'zone:wall/1:col:0');near(topLine.cm,bottomLine.cm);near(topLine.y+topLine.h,bottomLine.y);
assert.equal(dividerReach(twoRows,z('wall/0/0'),bottomLine),null);assert.equal(dividerReach(twoRows,z('wall/1/1'),topLine),null);

// The actual motion limit belongs to the divider's OWNER grid: the adjacent
// band containing another vertical split must keep 14 + 2 + 14 = 30 cm,
// not just the min width of the small selected leaf. No target handoff.
const board=d(tree,'cabinet:col:0'),minimum=dividerDragStatus(tree,leaf,board,-1000),maximum=dividerDragStatus(tree,leaf,board,9999);
assert(minimum.ok&&minimum.clamped&&minimum.atLimit==='min');assert(maximum.ok&&maximum.clamped&&maximum.atLimit==='max');
near(maximum.minimumAfter,30);near(minimum.minimumBefore,14);assert.match(maximum.reason,/٣٠/);
assert.deepEqual(maximum.owner,cab);assert.deepEqual(maximum.target,leaf);assert.equal(maximum.relation,'boundary');
const bounded=moveScopedDivider(tree,board.id,9999);assert(validatePlan(bounded));near(d(bounded,board.id).cm,maximum.maxCm);near(maximum.maxCm,maximum.actualCm);
assert.deepEqual(selectedTarget(bounded),selectedTarget(tree),'Geometry model must not promote the selected leaf to owner.');
const cached=dividerDragStatus(tree,leaf,board,9999,bounded);assert.deepEqual(cached,maximum);
const locked=dividerDragStatus(bounded,leaf,board.id,9999,bounded);assert(locked.ok&&locked.clamped&&!locked.changed);
const clear=dividerDragStatus(tree,leaf,board,board.cm+3);assert(clear.ok&&clear.changed&&!clear.clamped);assert.equal(clear.reason,'');near(clear.actualCm,board.cm+3);
assert.equal(dividerDragStatus(tree,leaf,board,board.cm+3,tree).code,'stale-preview');assert.equal(dividerDragStatus(tree,leaf,board,NaN).code,'invalid-point');
assert.equal(dividerDragStatus(tree,c('1:1/1'),local,200).code,'unreachable-divider');
assert.equal(dividerDragStatus(w3,z('wall/0/1/0'),line,200).code,'unreachable-divider');
assert.equal(dividerReach(bounded,leaf,board),null,'A pre-move descriptor must not be interpreted as current geometry.');
assert.equal(dividerReach(bounded,leaf,board.id).relation,'boundary');
const zStatus=dividerDragStatus(w1,leftZone,line,9999);assert(zStatus.ok&&zStatus.clamped);near(zStatus.minimumAfter,14);near(zStatus.maxCm,w1.wall.w-14);
assert.equal(JSON.stringify(base),saved);console.log('PASS: owned and all-ancestor shared edges, exact board faces and clipped visible intervals, frame/sibling/endpoint/occlusion exclusions, recursive minima and actual-owner clamp feedback.');

import assert from 'node:assert/strict';
import {SHELF_LIMITS as L,createShelfPlan,cellRects,cabMinimum,wallMinimum,selectedIndices,selectCell,
  evaluateWall,updateWall,evaluateCab,updateCab,evaluateDraw,drawCab,moveCab,resizeCab,shiftDivider,
  splitBandCheck,splitBand,dividerRemovalCheck,removeDivider,setContent,setFinish,setWallColor,applyPreset,validatePlan} from '../public/shelf-model.js';

const near=(a,b,msg='unexpected centimetre value')=>assert(Math.abs(a-b)<1e-7,`${msg}: ${a} versus ${b}`);
const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);for(const v of Object.values(o))freeze(v);}return o;};
function verify(p){
  assert(validatePlan(p),'Model produced a plan that cannot be imported.');
  const rects=cellRects(p),nc=p.cols.length+1,nr=p.rows.length+1;
  assert.equal(rects.length,nc*nr);assert.equal(Object.keys(p.cells).length,rects.length);
  assert(p.cab.x>=-1e-8&&p.cab.y>=-1e-8&&p.cab.x+p.cab.w<=p.wall.w+1e-8&&p.cab.y+p.cab.h<=p.wall.h+1e-8);
  assert(rects.every(c=>c.w>=L.minInterior-1e-8&&c.h>=L.minInterior-1e-8));
  assert(rects.some(r=>r.key===p.selectedCell));
  // The clear space, physical divider boards and two frame edges must fill
  // the outer dimensions. This catches a diagram that reports nominal bay
  // widths while silently carving the board out of its required 14 cm.
  near(rects.filter(c=>c.row===0).reduce((a,c)=>a+c.w,2*L.frame+(nc-1)*L.divider),p.cab.w);
  near(rects.filter(c=>c.col===0).reduce((a,c)=>a+c.h,2*L.frame+(nr-1)*L.divider),p.cab.h);
  for(const a of rects){
    const right=rects.find(b=>b.row===a.row&&b.col===a.col+1),below=rects.find(b=>b.col===a.col&&b.row===a.row+1);
    if(right)near(right.x-(a.x+a.w),L.divider);if(below)near(below.y-(a.y+a.h),L.divider);
  }
  return p;
}

const base=freeze(createShelfPlan());verify(base);
assert.deepEqual(base.wall,{w:360,h:260});assert.equal(base.cab.w,210);assert.equal(base.cab.h,165);
assert.deepEqual(cabMinimum(base),{w:50,h:50});assert.deepEqual(wallMinimum(base),{w:60,h:60});
assert.deepEqual(selectedIndices(base),{col:1,row:1});assert.equal(new Set(Object.values(base.cells)).size,5);
assert.notEqual(createShelfPlan().cells,base.cells);

// Drawing clips to the wall and works in all quadrants. A tiny gesture never
// creates a box outside its drawn rectangle or discards the previous layout.
const left={x:-25,y:35},right={x:173,y:185};
for(const [a,b] of [[left,right],[right,left],[{x:left.x,y:right.y},{x:right.x,y:left.y}],[{x:right.x,y:left.y},{x:left.x,y:right.y}]]){
  const d=verify(drawCab(base,a,b));assert.deepEqual(d.cab,{x:0,y:35,w:173,h:150});assert.deepEqual(d.cells,base.cells);
}
const tiny=evaluateDraw(base,{x:10,y:10},{x:40,y:40});assert(!tiny.ok&&tiny.reason);assert.equal(tiny.rect.w,30);
assert.equal(drawCab(base,{x:10,y:10},{x:40,y:40}),base);assert.equal(drawCab(base,{x:NaN,y:1},right),base);
assert.equal(drawCab(base,{x:-20,y:5},{x:-10,y:180}),base);

// Plan immutability and cabinet numeric placement across/well below wall size.
const far=verify(moveCab(base,2000,-2000));assert.equal(far.cab.x,150);assert.equal(far.cab.y,0);
assert.equal(moveCab(far,100,-100),far);assert.equal(moveCab(base,Infinity,0),base);
const cover=verify(updateCab(base,{w:360,h:260}));assert.deepEqual(cover.cab,{w:360,h:260,x:0,y:0});
const minimum=verify(updateCab(base,{w:50,h:50}));for(const c of cellRects(minimum)){near(c.w,14);near(c.h,14);}
assert(!evaluateCab(base,{w:49.9}).ok);assert.equal(updateCab(base,{w:49.9}),base);assert.equal(updateCab(base,{w:361}),base);
assert.equal(updateCab(base,{x:'25'}),base);assert.equal(updateCab(base,{w:NaN}),base);
const smaller=verify(updateWall(base,{w:60,h:60}));assert.deepEqual(smaller.cab,{w:60,h:60,x:0,y:0});assert.deepEqual(smaller.cells,base.cells);
assert(!evaluateWall(base,{w:59}).ok);assert.equal(updateWall(base,{h:-8}),base);assert.equal(updateWall(base,{w:1200,h:610}),base);

// For every resize corner the diagonal opposite edge stays put. Passing it
// clamps to the layout minimum, not a flipped or out-of-wall cabinet.
for(const corner of ['nw','ne','sw','se']){
  const west=corner[1]==='w',north=corner[0]==='n';
  const anchorX=west?base.cab.x+base.cab.w:base.cab.x,anchorY=north?base.cab.y+base.cab.h:base.cab.y;
  const extreme=verify(resizeCab(base,corner,{x:west?1000:-1000,y:north?1000:-1000}));
  near(extreme.cab.w,50);near(extreme.cab.h,50);
  near(west?extreme.cab.x+extreme.cab.w:extreme.cab.x,anchorX);near(north?extreme.cab.y+extreme.cab.h:extreme.cab.y,anchorY);
  const grown=verify(resizeCab(base,corner,{x:west?-500:1500,y:north?-500:1500}));
  near(west?grown.cab.x:grown.cab.x+grown.cab.w,west?0:base.wall.w);
  near(north?grown.cab.y:grown.cab.y+grown.cab.h,north?0:base.wall.h);
}
assert.equal(resizeCab(base,'bad',left),base);

// Divider coordinates are absolute cm, while saved divider positions are
// fractions. Moving one divider must not change another or break clear space.
const shifted=verify(shiftDivider(base,'col',0,base.cab.x+40));near(shifted.cols[0]*shifted.cab.w,40);assert.equal(shifted.cols[1],base.cols[1]);
const squeezed=verify(shiftDivider(base,'col',0,-1000));near(cellRects(squeezed)[0].w,14);
assert(!splitBandCheck(squeezed,'col',0).ok);assert.equal(splitBand(squeezed,'col',0),squeezed);
assert.equal(shiftDivider(squeezed,'col',0,-20),squeezed);assert.equal(shiftDivider(base,'row',-1,15),base);
assert.equal(shiftDivider(base,'bad',0,25),base);assert.equal(shiftDivider(base,'col',0,NaN),base);

// A split inserts an empty second band; it does not duplicate the old item.
// Content and selection to its right/below keep following the same physical cell.
for(const axis of ['col','row']){
  const original=freeze(selectCell(base,'2:2')),split=verify(splitBand(original,axis,0));
  assert.equal(split.selectedCell,axis==='col'?'3:2':'2:3');
  for(const old of cellRects(original)){
    const c=old.col+(axis==='col'&&old.col>0?1:0),r=old.row+(axis==='row'&&old.row>0?1:0);
    assert.equal(split.cells[`${c}:${r}`],original.cells[old.key]);
  }
  assert(Object.entries(split.cells).filter(([key])=>Number(key.split(':')[axis==='col'?0:1])===1).every(([,v])=>v==='empty'));
  assert(dividerRemovalCheck(split,axis,0).ok);const restored=verify(removeDivider(split,axis,0));assert.deepEqual(restored,original);
}
// Both axes preserve a lone item when merging. In a conflict the ordinary
// action is an identity no-op; explicit consent keeps the left/upper item.
for(const axis of ['col','row']){
  let p=applyPreset(base,'empty');p=splitBand(p,axis,0);const farKey=axis==='col'?'1:0':'0:1';
  p=selectCell(setContent(p,farKey,'vase'),farKey);
  const retained=verify(removeDivider(p,axis,0));assert.equal(retained.cells['0:0'],'vase');assert.equal(retained.selectedCell,'0:0');
  p=freeze(setContent(p,'0:0','books'));const report=dividerRemovalCheck(p,axis,0);assert(!report.ok&&report.canForce);
  assert.deepEqual(report.conflicts,[{keepKey:'0:0',removeKey:farKey,keepContent:'books',removeContent:'vase'}]);
  assert.equal(removeDivider(p,axis,0),p);
  assert.equal(verify(removeDivider(p,axis,0,{allowContentMerge:true})).cells['0:0'],'books');
  assert.equal(removeDivider(p,axis,999,{allowContentMerge:true}),p);
}

// Maximum band count and impossibly small wall: preserve the entire plan.
let many=updateCab(updateWall(applyPreset(base,'empty'),{w:1200}),{x:0,w:1100});
for(let i=1;i<L.maxCols;i++){
  const widest=cellRects(many).filter(c=>c.row===0).sort((a,b)=>b.w-a.w)[0].col;
  many=verify(splitBand(many,'col',widest));
}
assert.equal(many.cols.length+1,L.maxCols);assert.equal(splitBandCheck(many,'col',0).code,'band-limit');assert.equal(splitBand(many,'col',0),many);
assert(wallMinimum(many).w>60);assert.equal(updateWall(many,{w:60}),many);

const bare=applyPreset(base,'empty');assert.deepEqual(bare.cols,[]);assert.deepEqual(bare.rows,[]);assert.deepEqual(bare.cells,{'0:0':'empty'});
const styled=setWallColor(setFinish(bare,'walnut'),'sage');assert.equal(styled.finish,'walnut');assert.equal(styled.wallColor,'sage');
const preset=verify(applyPreset(styled,'display'));assert.deepEqual(preset.cab,base.cab);assert.equal(preset.finish,'walnut');assert.equal(preset.wallColor,'sage');
assert.equal(applyPreset(preset,'display'),preset);assert.equal(setFinish(base,'invalid'),base);assert.equal(setWallColor(base,'invalid'),base);
assert.equal(setContent(base,'nonsense','books'),base);assert.equal(selectCell(base,'01:1'),base);assert.equal(setContent(base,'0:0','invalid'),base);
const smallPreset=verify(applyPreset(updateCab(bare,{w:18,h:18}),'library'));assert.deepEqual(smallPreset.cols,[]);assert.deepEqual(smallPreset.rows,[]);assert.equal(smallPreset.cells['0:0'],'books');

// Import rejects malformed geometry and IDs rather than mutating or trusting
// it. A valid imported plan is detached from the original JSON structure.
const roundtrip=validatePlan(JSON.parse(JSON.stringify(base)));assert.deepEqual(roundtrip,base);assert.notEqual(roundtrip.cab,base.cab);assert.notEqual(roundtrip.cells,base.cells);
for(const bad of [null,[],{}, {...base,version:2},{...base,cols:[.1,.08]}, {...base,rows:Array(15).fill(.5)},
  {...base,cols:[.01,.5]}, {...base,cab:{...base.cab,x:350}}, {...base,finish:'<svg>'}, {...base,wall:{w:Infinity,h:100}},
  {...base,cells:{'0:0':'unknown'}}, {...base,cells:{'10:1':'books'}},{...base,selectedCell:'2:99'},
  {...base,cells:JSON.parse('{"__proto__":"books"}')}, {...base,rows:['0.5']}])assert.equal(validatePlan(bad),null);
const sparse=validatePlan({...base,cells:{'0:0':'vase'}});assert.equal(sparse.cells['2:2'],'empty');assert.equal(Object.keys(sparse.cells).length,9);

// Deterministic editing sequences test coupling among resizing, moving,
// changing the wall, adding/removing/dragging dividers and retaining contents.
let seed=0x47210;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);
let p=createShelfPlan();for(let i=0;i<400;i++){
  const axis=random()<.5?'col':'row',bands=axis==='col'?p.cols.length+1:p.rows.length+1,index=Math.floor(random()*bands);
  const op=Math.floor(random()*8),key=cellRects(p)[Math.floor(random()*((p.cols.length+1)*(p.rows.length+1)))].key;
  if(op===0)p=moveCab(p,(random()-.5)*600,(random()-.5)*500);
  if(op===1)p=resizeCab(p,['nw','ne','sw','se'][i%4],{x:random()*p.wall.w,y:random()*p.wall.h});
  if(op===2)p=shiftDivider(p,axis,index,random()*(axis==='col'?p.wall.w:p.wall.h));
  if(op===3)p=splitBand(p,axis,index);if(op===4)p=removeDivider(p,axis,index,{allowContentMerge:true});
  if(op===5)p=updateWall(p,{w:60+random()*650,h:60+random()*350});
  if(op===6)p=setContent(selectCell(p,key),key,['empty','books','boxes','plant','vase'][i%5]);
  if(op===7)p=drawCab(p,{x:random()*p.wall.w,y:random()*p.wall.h},{x:random()*p.wall.w,y:random()*p.wall.h});verify(p);
}
console.log('PASS: immutable shelf dimensions and clearances; four-corner draw/resize; wall limits; independent dividers; content-safe split/merge; presets, strict import, and 400 deterministic edit sequences.');

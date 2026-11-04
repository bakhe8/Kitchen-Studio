import assert from 'node:assert/strict';
import {createShelfPlan,validatePlan,updateWall,evaluateWall,updateCab,setWallColor,setShelfDepth,evaluateShelfDepth,totalPartitionNodes} from '../public/shelf-model.js';
import {splitTarget,selectTarget,scopedCells} from '../public/shelf-selection-model.js';
import {placeSizedScreen} from '../public/shelf-sized-object.js';
import {attachCabinet,getRoom,roomWallSize,roomWallData,roomFaceIds,roomFaces,wallLocalToRoom,roomToWallLocal,updateRoom} from '../public/shelf-room-model.js';
const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);Object.values(o).forEach(freeze);}return o;};
const round=p=>assert.deepEqual(validatePlan(JSON.parse(JSON.stringify(p))),p);
const gap=p=>p.wall.h-(p.cab.y+p.cab.h);
const close=(a,b)=>assert(Math.abs(a-b)<1e-8);
const base=freeze(createShelfPlan()),saved=JSON.stringify(base),old=getRoom(base);
assert.deepEqual(old,{width:360,length:300,height:260,attachedWall:'back'});
assert.equal(attachCabinet(base,'back').plan,base);
const faces=roomFaces(base);assert.equal(new Set(faces.map(f=>f.id)).size,6);assert.deepEqual(faces.map(f=>f.id),roomFaceIds);
for(const f of faces){
  assert.equal(f.points.length,4);const [a,b,c]=f.points;
  const diff=(p,q)=>['x','y','z'].map(k=>p[k]-q[k]),[x,y,z]=diff(b,a),[i,j,k]=diff(c,a);
  const n=[y*k-z*j,z*i-x*k,x*j-y*i],m=Math.hypot(...n);
  close(n[0]/m,f.inward.x);close(n[1]/m,f.inward.y);close(n[2]/m,f.inward.z);
}
for(const [id,expected] of Object.entries({back:[30,54,12],front:[330,54,288],left:[12,54,270],right:[348,54,30]})){
  const q=wallLocalToRoom(base,id,{x:30,y:54,z:12});assert.deepEqual([q.x,q.y,q.z],expected);
  assert.deepEqual(roomToWallLocal(base,id,q),{x:30,y:54,z:12});
}
assert.deepEqual(roomWallSize(base,'left'),{w:300,h:260,depth:360});
assert.deepEqual(roomWallSize(base,'back'),{w:360,h:260,depth:300});
assert.equal(roomWallSize(base,'floor'),null);assert.equal(roomWallData(base,'ceiling'),null);
assert.equal(JSON.stringify(base),saved);round(base);

function split(p,target,axis){const r=splitTarget(p,target,axis);assert(r.ok,r.reason);return r.plan;}
let p=split(base,{kind:'cell',key:'1:1'},'row');
p=split(p,{kind:'wall'},'col');p=setWallColor(p,'sage');
p=placeSizedScreen(p,'0:0',{w:37.22,h:24.375}).plan;p=selectTarget(p,{kind:'zone',key:'wall/0'});
const original=freeze(p),snapshot=JSON.stringify(original),grid=original.wallGrid,cellGrid=original.cellGrids,screen=original.sizedObject;
const configured=updateRoom(original,{width:360,length:250,height:285});assert(configured.ok&&configured.changed);round(configured.plan);
assert.equal(configured.plan.cab.y,original.cab.y+25);close(gap(configured.plan),gap(original));
assert.equal(configured.plan.cab.w,original.cab.w);assert.equal(configured.plan.cab.h,original.cab.h);
assert.equal(configured.plan.wallGrid,grid);assert.equal(configured.plan.cellGrids,cellGrid);assert.equal(configured.plan.sizedObject,screen);
assert.equal(updateRoom(configured.plan,{length:250}).plan,configured.plan);

// Viewing another wall has no write path. Only the attachment command changes
// which wall the old editor projects and which single cabinet is shown on it.
for(const id of ['front','left','right'])assert.deepEqual(roomWallData(configured.plan,id),{color:'sand',grid:null});
const before=configured.plan,moved=attachCabinet(before,'right');
assert(moved.ok&&moved.changed&&moved.clamped);assert(moved.reason);assert.deepEqual(moved.adjustments,[{axis:'x',from:75,to:40}]);
const right=moved.plan;round(right);assert.equal(right.room.attachedWall,'right');assert.deepEqual(right.wall,{w:250,h:285});
assert.equal(right.cab.w,210);assert.equal(right.cab.h,165);assert.equal(right.cab.x,40);assert.equal(right.depth,original.depth);close(gap(right),gap(original));
assert.deepEqual(right.selection,{kind:'wall'});assert.equal(right.wallGrid,null);assert.equal(right.wallColor,'sand');
assert.deepEqual(roomWallData(right,'back'),{color:'sage',grid});assert(!Object.hasOwn(right.room.layers,'right'));
assert.equal(right.cellGrids,cellGrid);assert.equal(right.sizedObject,screen);assert.equal(right.cells,original.cells);
assert.deepEqual(scopedCells(right).map(c=>[c.key,c.content]),scopedCells(original).map(c=>[c.key,c.content]));
const rightDecor=freeze(setWallColor(split(right,{kind:'wall'},'row'),'stone'));
const back=attachCabinet(rightDecor,'back').plan;round(back);assert.equal(back.wallGrid,grid);assert.equal(back.wallColor,'sage');
assert.deepEqual(roomWallData(back,'right'),{color:'stone',grid:rightDecor.wallGrid});assert(!Object.hasOwn(back.room.layers,'back'));
assert.equal(attachCabinet(back,'right').plan.wallGrid,rightDecor.wallGrid);
assert.equal(totalPartitionNodes(rightDecor),totalPartitionNodes(back));
assert.equal(JSON.stringify(original),snapshot);

// The old wall form writes the correct ROOM dimension on a side wall, keeps
// the other walls' annotations, and preserves the cabinet's elevation.
const edit=evaluateWall(rightDecor,{w:235,h:300});assert(edit.ok&&edit.clamped);assert(edit.reason);
const edited=updateWall(rightDecor,{w:235,h:300});round(edited);
assert.deepEqual(getRoom(edited),{width:360,length:235,height:300,attachedWall:'right'});
close(gap(edited),gap(rightDecor));assert.equal(edited.cab.x,25);assert.equal(edited.cab.w,210);
assert.equal(roomWallData(edited,'back').grid,grid);assert.equal(edited.wallGrid,rightDecor.wallGrid);
assert.equal(updateWall(edited,{w:110}).cab,edited.cab);assert(!evaluateWall(edited,{w:110}).ok);
// In a short direction-depth room neither a deep cabinet move nor a later
// depth edit can project through the facing wall. Refusal changes nothing.
const narrow=updateRoom(base,{length:90}).plan;round(narrow);
assert.equal(evaluateShelfDepth(narrow,100).code,'cabinet-depth');
assert.equal(setShelfDepth(narrow,100),narrow);round(setShelfDepth(narrow,90));
const shallow=updateCab(base,{w:75,h:80});
const deep=updateRoom(setShelfDepth(shallow,130),{width:110,length:300}).plan;round(deep);
assert.equal(attachCabinet(deep,'left').code,'cabinet-depth');
for(const [p,action,code] of [
  [narrow,()=>attachCabinet(narrow,'right'),'cabinet-width'],
  [before,()=>updateRoom(before,{height:190}),'mount-height'],
  [before,()=>updateRoom(before,{width:200}),'cabinet-width'],
  [before,()=>attachCabinet(before,'floor'),'not-a-wall'],
  [before,()=>updateRoom(before,{height:Number.NaN}),'room-dimensions'],
  [before,()=>updateRoom(before,{width:400,attachedWall:'right'}),'room-dimensions']
]){const r=action();assert(!r.ok&&r.reason);assert.equal(r.code,code);assert.equal(r.plan,p);assert(!r.changed);}
// A dormant face might need a larger dimension than the cabinet does. Fill
// it with 6 bands (minimum 84 cm), then try shortening the opposite pair.
let zoned=updateRoom(updateCab(base,{w:60,h:65}),{width:200,length:300}).plan;
for(let i=0;i<5;i++)zoned=split(zoned,{kind:'wall'},'col');
const elsewhere=attachCabinet(zoned,'left').plan;
assert.equal(updateRoom(elsewhere,{width:70}).code,'wall-zones');
assert.equal(roomWallData(elsewhere,'back').grid,zoned.wallGrid);round(elsewhere);
// Harden imports: wrong face, duplicated active-wall annotation, bad saved
// grid, inconsistent local dimensions, too-deep cabinet, and old unscoped
// files containing room records are rejected instead of silently corrected.
for(const bad of [
  {...base,room:{width:360,length:300,height:260,attachedWall:'back',layers:{}}},
  {...right,room:{...right.room,attachedWall:'ceiling'}},
  {...right,room:{...right.room,length:272}},
  {...right,room:{...right.room,layers:{right:{color:'sage',grid:null}}}},
  {...right,room:{...right.room,layers:{sideways:{color:'sage',grid:null}}}},
  {...right,room:{...right.room,layers:{back:{color:'purple',grid:null}}}},
  {...right,room:{...right.room,layers:{back:{color:'sage',grid:{cols:[.5]}}}}},
  {...narrow,depth:100}
])assert.equal(validatePlan(bad),null);
assert.equal(JSON.stringify(base),saved);
console.log('Room model: six oriented surfaces; explicit attachment; independent walls; physical cabinet, floor gap and depth; legacy migration, room resizing and safe persistence passed.');

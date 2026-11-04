import assert from 'node:assert/strict';
import {mountShelfCanvas} from '../public/shelf-canvas.js';
import {createShelfPlan} from '../public/shelf-model.js';
import {scopedCells,scopedDividers} from '../public/shelf-selection-model.js';
import {placeSizedScreen,inspectSizedScreen} from '../public/shelf-sized-object.js';
import {renderShelfVolume} from '../public/shelf-volume.js';

// Exercise the real renderer, hit tests and controller-facing pointer stream.
// This geometry harness emulates only SVG's screen CTM and pointer dispatch.
const frames=new Map();let fid=0;
globalThis.requestAnimationFrame=fn=>{frames.set(++fid,fn);return fid;};
globalThis.cancelAnimationFrame=id=>frames.delete(id);
const flush=()=>{for(const [id,fn] of [...frames]){frames.delete(id);fn();}};
const nodes=new Map(), captures=new Set();
class Host{
  constructor(selector){this.selector=selector;this.dataset={};this.attributes={};this.handlers=new Map();this.style={setProperty(){},removeProperty(){}};this.innerHTML='';}
  setAttribute(k,v){this.attributes[k]=String(v);}
  getAttribute(k){return this.attributes[k]??null;}
  removeAttribute(k){delete this.attributes[k];}
  toggleAttribute(k,v){if(v)this.setAttribute(k,'');else this.removeAttribute(k);}
  addEventListener(type,fn){this.handlers.set(type,[...(this.handlers.get(type)||[]),fn]);}
  send(type,ev){for(const fn of this.handlers.get(type)||[])fn(ev);}
  querySelector(s){if(!nodes.has(s))nodes.set(s,new Host(s));return nodes.get(s);}
  querySelectorAll(){return [];}
  closest(s){return s.split(',').includes(this.selector)?this:null;}
  contains(el){return this===svg||this===el;}
  remove(){}
  replaceChildren(){this.innerHTML='';}
  setPointerCapture(id){captures.add(id);}
  hasPointerCapture(id){return captures.has(id);}
  releasePointerCapture(id){captures.delete(id);}
  getBoundingClientRect(){return {left:0,top:0,right:880,bottom:660,width:880,height:660};}
  createSVGPoint(){return {x:0,y:0,matrixTransform(m){return {x:m.a*this.x+m.e,y:m.d*this.y+m.f};}};}
  getScreenCTM(){
    const [x,y,w,h]=(this.getAttribute('viewBox')||'0 0 360 260').split(' ').map(Number),s=Math.min(880/w,660/h);
    const a=s,d=s,e=(880-s*w)/2-x*s,f=(660-s*h)/2-y*s;
    return {a,b:0,d,e,f,inverse:()=>({a:1/a,d:1/d,e:-e/a,f:-f/d})};
  }
}
const container=new Host('container'),win=globalThis.window=new Host('window'),doc=globalThis.document=new Host('doc'),svg=container.querySelector('[data-shelf-board]');
doc.elementFromPoint=()=>svg;
let state={plan:createShelfPlan(),view3d:true,camera:{yaw:29,pitch:15,zoom:1},tool:'point-insert',showDims:false,target:{kind:'cabinet'},snapEnabled:false};
const actions=[],canvas=mountShelfCanvas(container,{getState:()=>state,onAction:a=>actions.push(a)}),vol=renderShelfVolume(state.plan,{...state.camera}),P=vol.projection;
const set=(patch)=>{state={...state,...patch};canvas.render();};
const toClient=q=>{const M=svg.getScreenCTM();return {x:q.x*M.a+M.e,y:q.y*M.d+M.f};};
const world=(p,z=36)=>toClient(P.project(p.x,p.y,z));
const emit=(host,type,p,button=0,target=svg)=>host.send(type,{target,clientX:p.x,clientY:p.y,isPrimary:true,buttons:type==='pointerup'?0:1,button,pointerType:'mouse',pointerId:42,preventDefault(){},composedPath:()=>[target]});
const go=(a,b=a,target=svg)=>{actions.length=0;emit(svg,'pointerdown',a,0,target);if(a!==b){emit(win,'pointermove',b);flush();}emit(win,'pointerup',b);return actions.at(-1);};
const nearly=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,JSON.stringify({actual:a,expected:b}));
const cells=scopedCells(state.plan);
function blank(r){
  for(const fy of [.25,.4,.5,.15,.65,.75])for(const fx of [.45,.6,.3,.75,.2]){
    const p={x:r.x+fx*r.w,y:r.y+fy*r.h},q=P.project(p.x,p.y,36),hit=vol.hitTest(q.x,q.y);
    if(hit?.part==='cell'&&hit.key===r.key&&canvas.pickClient(...Object.values(toClient(q)))?.hit?.target?.key===r.key)return p;
  }
}
const openings=cells.map(r=>({r,p:blank(r)})).filter(o=>o.p);assert.ok(openings.length>1);
const a=openings[0],b=openings.at(-1);
const ca=world(a.p),cb=world(b.p),single=go(ca);
assert.equal(single.type,'insert-point');assert.equal(single.hit.target.key,a.r.key);nearly(single.p.x,a.p.x);nearly(single.p.y,a.p.y);
const w={x:42,y:30},cw=world(w,0),hitWall=canvas.pickClient(cw.x,cw.y);assert.equal(hitWall.hit.target.kind,'wall');nearly(hitWall.p.x,w.x);nearly(hitWall.p.y,w.y);
const x=state.plan.cab.x+state.plan.cab.w,y=state.plan.cab.y+.56*state.plan.cab.h,side=world({x,y},18);
assert.equal(canvas.pickClient(side.x,side.y),null,'visible side may not accept a placement on the wall behind it');assert.equal(go(side),undefined);
set({tool:'measure'});const mb=world({x:a.p.x+12,y:a.p.y+16});const measured=go(ca,mb);assert.equal(measured.type,'measure');nearly(measured.a.z,36);nearly(Math.hypot(measured.b.x-measured.a.x,measured.b.y-measured.a.y),20);
set({tool:'select'});assert.equal(go(ca).hit.target.key,a.r.key);
const selected=go(world({x:40,y:30},0),cb);assert.equal(selected.type,'marquee-select');assert.ok(selected.keys.length>0);
set({tool:'move'});let checkBoard=false;
for(const d of scopedDividers(state.plan).filter(d=>d.kind==='cabinet')){
  const start={x:d.x+d.w*.5,y:d.y+d.h*.5},c0=world(start),p=canvas.pickClient(c0.x,c0.y);
  if(p?.hit?.dividerId!==d.id)continue;
  const end=world({x:start.x+(d.axis==='col'?3:0),y:start.y+(d.axis==='row'?3:0)}),ev=go(c0,end);
  assert.equal(ev.type,'scoped-divider');nearly(ev.cm,d.cm+3);checkBoard=true;break;
}assert.ok(checkBoard);
// Hit an actual painted mesh face, not the cell rectangle or empty space.
let artTest=false;
outer:for(const r of cells.filter(c=>c.content!=='empty')){
  const dest=openings.find(o=>o.r.key!==r.key&&o.r.content!==r.content);if(!dest)continue;
  for(const frY of [.88,.7,.55,.4,.93])for(const frX of [.5,.4,.72,.26,.83]){
    const q=P.project(r.x+r.w*frX,r.y+r.h*frY,18),pick=vol.hitTest(q.x,q.y);
    if(pick?.part!=='art'||pick.key!==r.key)continue;
    const hit=toClient(q),action=go(hit,world(dest.p));assert.equal(action.type,'content-transfer');assert.equal(action.fromKey,r.key);nearly(action.p.x,dest.p.x);
    assert.equal(go(hit,side),undefined,'art cannot transfer to an occluded cell');set({tool:'delete'});const del=go(hit);assert.equal(del.cellKey,r.key);assert.equal(del.type,'delete-hit');
    const miss=go(world(dest.p));assert.notEqual(miss?.type,'delete-hit','blank air should not erase artwork');artTest=true;break outer;
  }
}assert.ok(artTest);
set({tool:'resize'});assert.match(nodes.get('[data-shc-depth-handle]').innerHTML,/عمق/);
const grip=new Host('[data-shelf-depth-handle]'),cg=world({x,y},18),g2=world({x,y},32),box=svg.getAttribute('viewBox');
emit(svg,'pointerdown',cg,0,grip);emit(win,'pointermove',g2);flush();assert.equal(svg.getAttribute('viewBox'),box);emit(win,'pointerup',g2);assert.equal(actions.at(-1).type,'cabinet-depth');nearly(actions.at(-1).depth,50);
set({camera:{...state.camera,zoom:1.5}});const zbox=svg.getAttribute('viewBox').split(' ').map(Number);assert.ok(Math.abs(zbox[2]*1.5-box.split(' ')[2])<.001);
set({preview:true});assert.equal(nodes.get('[data-shc-depth-handle]').innerHTML,'');assert.ok(nodes.get('[data-shc-cabinet]').innerHTML.includes('data-vol-part'));assert.equal(canvas.pickClient(ca.x,ca.y),null);
set({view3d:false,preview:false,tool:'point-insert'});const flat=canvas.clientPointFromWall(a.p),restored=go(flat);assert.equal(restored.type,'insert-point');nearly(restored.p.x,a.p.x);nearly(restored.p.y,a.p.y);
// Group membership no longer swallows direct deletion or turns a click in
// empty space into a bulk clear. A screen owns its visible pixels in both views.
const occupied=cells.find(c=>c.content!=='empty'),group=[a.r.key,b.r.key],sp=placeSizedScreen(state.plan,occupied.key,{w:22,h:14}).plan;
set({plan:sp,tool:'delete',multiKeys:group,view3d:false});const sr=inspectSizedScreen(sp).rect,center={x:sr.x+sr.w/2,y:sr.y+sr.h/2},screen2=canvas.clientPointFromWall(center);
emit(svg,'pointermove',screen2); // short click action independent of a hover-capable pointer
const s2=go(screen2);assert.equal(s2.type,'delete-hit');assert.equal(s2.screen,true);assert.equal(s2.cellKey,undefined);
assert.equal(go(canvas.clientPointFromWall({x:28,y:20})).type,'notice');
const board=scopedDividers(sp).find(d=>d.kind==='cabinet'),boardMid={x:board.x+board.w/2,y:board.y+board.h/2},flatBoard=canvas.clientPointFromWall(boardMid);
const bd=go(flatBoard);assert.equal(bd.type,'delete-hit');assert.equal(bd.dividerId,board.id);
set({view3d:true,camera:{yaw:29,pitch:15,zoom:1}});const rendered=renderShelfVolume(sp,{...state.camera});let pickedScreen=false;
for(let z=4;z<=36;z+=2){
  const q=rendered.projection.project(center.x,center.y,z),hit=rendered.hitTest(q.x,q.y);if(hit?.part!=='screen')continue;
  const c=toClient(q),action=go(c);assert.equal(action.type,'delete-hit');assert.equal(action.screen,true);pickedScreen=true;break;
}assert.ok(pickedScreen);
const empty3=go(world({x:28,y:20},0));assert.equal(empty3.type,'notice');
actions.length=0;emit(svg,'pointerdown',world(boardMid));emit(win,'pointerup',world({x:28,y:20},0));assert.ok(!actions.some(a=>a.type==='delete-hit'));
canvas.destroy();console.log('3D edit: wall/front/occlusion, placement, measure, marquee, divider, art transfer/delete, depth, zoom, preview, 2D restoration OK.');

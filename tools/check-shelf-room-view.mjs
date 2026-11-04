import assert from 'node:assert/strict';
import {mountRoomView} from '../public/shelf-room-view.js';
import {createShelfPlan} from '../public/shelf-model.js';
import {getRoom,attachCabinet,updateRoom} from '../public/shelf-room-model.js';
import {renderShelfRoom} from '../public/shelf-room-render.js';

// A light input fixture, not a simulated renderer: every SVG, intersection,
// clearance and transfer goes through the production room geometry and model.
const nodes=new Map(),get=s=>nodes.get(s),handlers=()=>new Map();
class Node {
  constructor(s,attrs={}){this.s=s;this.dataset={};this.attrs=new Map(Object.entries(attrs));this.handlers=handlers();this.hidden=false;this.classList={add(){},remove(){}};this.innerHTML='';this.textContent='';}
  addEventListener(k,fn){this.handlers.set(k,fn);}
  fire(k,v={}){let prevented=false;this.handlers.get(k)?.({target:this,preventDefault(){prevented=true;},...v});return prevented;}
  setAttribute(k,v){this.attrs.set(k,String(v));}
  hasAttribute(k){return this.attrs.has(k);}
  getAttribute(k){return this.attrs.get(k);}
  setPointerCapture(id){this.capture=id;}
  hasPointerCapture(id){return this.capture===id;}
  releasePointerCapture(){this.capture=null;}
  closest(s){return s==='button'&&this.isBtn?this:null;}
  contains(el){return [...nodes.values()].includes(el);}
  focus(){}
  replaceChildren(){this.innerHTML='';}
  createSVGPoint(){return {x:0,y:0,matrixTransform(m){return m.apply(this);}};}
  getScreenCTM(){return {inverse(){return {apply:p=>({x:p.x,y:p.y})};}};}
}
for(const s of ['.sroom','.sroom-scene','[data-room-face]','[data-room-reason]','[data-room-attach]','[data-room-size]','[data-room-location]','[data-room-status]','[data-room-edit]','[data-room-dimensions]','[data-room-home]','[data-room-visibility]'])nodes.set(s,new Node(s,{[s.slice(1,-1)]:''}));
const switches=['cutaway','closed'].map(k=>{const n=new Node('button');n.isBtn=true;n.dataset.roomMode=k;nodes.set(k,n);return n;});
for(const s of ['[data-room-edit]','[data-room-attach]','[data-room-dimensions]','[data-room-home]'])get(s).isBtn=true;
const host=new Node('host'),win=new Node('window');host.ownerDocument={defaultView:win};host.querySelector=get;host.querySelectorAll=()=>switches;
let frame;win.requestAnimationFrame=fn=>{frame=fn;return 1;};win.cancelAnimationFrame=()=>{frame=null;};
let plan=createShelfPlan();const transfers=[],edits=[],dimensions=[];
const view=mountRoomView(host,{getPlan:()=>plan,onAttach:id=>{transfers.push(id);plan=attachCabinet(plan,id).plan;},onEdit:id=>edits.push(id),onDimensions:id=>dimensions.push(id)});
assert.equal(host.hidden,true);
view.refresh();const svg=get('.sroom-scene'),root=get('.sroom'),select=get('[data-room-face]'),start=view.getState(),before=JSON.stringify(plan);
assert.equal(start.mode,'cutaway');assert.equal(start.surface,'back');assert.match(svg.innerHTML,/data-room-surface/);
const initial=svg.getAttribute('viewBox');
const choose=id=>{select.value=id;select.fire('change');};
const click=s=>root.fire('click',{target:get(s)});
choose('right');assert.equal(view.getState().wallId,'right');assert.equal(view.getState().yaw,start.yaw);assert.equal(svg.getAttribute('viewBox'),initial,'choosing even a removed wall must preserve framing');assert.equal(JSON.stringify(plan),before);
click('[data-room-edit]');assert.deepEqual(edits,['back']);assert.equal(transfers.length,0,'editing the furniture must not transfer it');
click('[data-room-attach]');assert.deepEqual(transfers,['right']);assert.equal(getRoom(plan).attachedWall,'right');assert.equal(view.getState().yaw,start.yaw);
choose('floor');assert.equal(view.getState().wallId,null);assert.ok(get('[data-room-attach]').hidden);click('[data-room-dimensions]');assert.deepEqual(dimensions,['floor']);
click('closed');assert.equal(view.getState().mode,'closed');
const send=(type,where,others={})=>svg.fire(type,{clientX:where.x,clientY:where.y,button:0,buttons:type==='pointerup'?0:1,pointerType:'mouse',pointerId:7,isPrimary:true,...others});
const orbit=renderShelfRoom(plan,{yaw:start.yaw,pitch:start.pitch,mode:'closed'}),bb=orbit.bounds||orbit.projection.bounds;
let chosen;for(let j=1;j<12&&!chosen;j++)for(let i=1;i<12;i++){const p={x:bb.x+bb.w*i/12,y:bb.y+bb.h*j/12},hit=orbit.hitTest(p.x,p.y);if(hit?.part==='surface'&&hit.surface!=='floor'){chosen={p,f:hit.surface};break;}}
assert.ok(chosen);send('pointerdown',chosen.p);send('pointerup',{x:chosen.p.x+.1,y:chosen.p.y+.1});assert.equal(view.getState().surface,chosen.f,'a short release selects the genuinely visible face');
const picked=view.getState().surface,to={x:chosen.p.x+1000,y:chosen.p.y+500};send('pointerdown',chosen.p);send('pointermove',to);if(frame){const run=frame;frame=null;run();}send('pointerup',to);
assert.equal(view.getState().surface,picked,'orbit release is never a surface pick');assert.equal(view.getState().yaw,92);assert.equal(view.getState().pitch,72);
view.refresh(false);assert.equal(host.hidden,true);view.refresh(true);assert.equal(view.getState().yaw,92);
const beforeExport=view.getState();assert.match(view.exportSvg(),/^<svg.+<title>الغرفة والدولاب/);assert.deepEqual(view.getState(),beforeExport);
choose('back');const narrow=updateRoom(plan,{width:150});assert.equal(narrow.ok,true);plan=narrow.plan;view.refresh(true);assert.equal(get('[data-room-attach]').disabled,true);assert.ok(get('[data-room-reason]').textContent);
click('[data-room-attach]');assert.equal(transfers.length,1);assert.equal(getRoom(plan).attachedWall,'right');
svg.fire('keydown',{key:'Home'});assert.equal(view.getState().yaw,32);view.destroy();assert.equal(host.hidden,true);
console.log('Room UI: six surfaces, camera/selection independence, real solid hit, drag vs click, explicit safe remount, property/edit routes, narrow wall refusal and SVG export OK.');

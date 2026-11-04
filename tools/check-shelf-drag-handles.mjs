import assert from 'node:assert/strict';
import {createShelfPlan} from '../public/shelf-model.js';
import {scopedCells,splitTarget} from '../public/shelf-selection-model.js';
import {mountShelfCanvas} from '../public/shelf-canvas.js';
import {makeShelfProjection} from '../public/shelf-volume.js';
// Dispatch actual gesture streams to mounted canvas in both projection modes.
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
const base=splitTarget(createShelfPlan(),{kind:'cell',key:'1:1'},'row').plan,owner={kind:'cell',key:'1:1'},desc=scopedCells(base).filter(c=>c.key.startsWith('1:1/')).map(c=>c.key);
let st={plan:base,view3d:false,camera:{yaw:28,pitch:13,zoom:1},tool:'select',preview:false,showDims:false,target:owner,selectedDividerId:null,placeAxis:'row',multiKeys:[],snapEnabled:false};
const actions=[],canvas=mountShelfCanvas(container,{getState:()=>st,onAction:a=>actions.push(a)}),guides=container.querySelector('[data-shc-controls]'),set=patch=>{st={...st,...patch};actions.length=0;canvas.render();};
const toClient=p=>{const m=svg.getScreenCTM();return{x:p.x*m.a+m.e,y:p.y*m.d+m.f};},point=p=>toClient(st.view3d?makeShelfProjection(base,st.camera).project(p.x,p.y,36):p);
function grip(kind){
  const tags=[...guides.innerHTML.matchAll(/<g [^>]+>/g)].map(x=>x[0]);
  const tag=tags.find(x=>x.includes('data-shelf-drag-handle="'+kind+'"'));assert(tag,kind+' grip absent in '+st.tool);
  const eq=kind==='equal',el=new Host(eq?'[data-shelf-equal-handle]':'[data-shelf-group-move]');
  el.dataset.groupHandleOwner=(tag.match(/data-group-handle-owner="([^"]*)"/)||[])[1]||'';
  el.dataset.shelfEqualHandle=(tag.match(/data-shelf-equal-handle="([^"]+)"/)||[])[1];
  const t=tag.match(/translate\(([-.\d]+) ([-.\d]+)\)/);return{el,p:{x:+t[1]+2,y:+t[2]+2}};
}
function doDrag(kind,dx=0,dy=0,cancel=false){
  actions.length=0;const {el,p}=grip(kind),a=point(p),b=point({x:p.x+dx,y:p.y+dy});
  const emit=(obj,type,q,buttons,target=svg)=>obj.send(type,{target,button:type==='pointermove'?-1:0,buttons,pointerId:9,pointerType:'mouse',isPrimary:true,clientX:q.x,clientY:q.y,preventDefault(){}});
  emit(svg,'pointerdown',a,1,el);if(dx||dy){emit(win,'pointermove',b,1);flush();}if(cancel)emit(win,'pointercancel',b,0);emit(win,'pointerup',b,0);return actions;
}
for(const view3d of [false,true]){
  for(const tool of ['select','move','point-insert'])for(const explicit of [false,true]){
    set({tool,view3d,placingContent:false,target:explicit?{kind:'cabinet'}:owner,multiKeys:explicit?desc:[]});
    assert(guides.innerHTML.includes('data-grip-dots="6"'));assert(guides.innerHTML.includes('data-grip-direction="move"'));
    assert.equal(doDrag('group').length,0,'tap cannot select, insert or edit');assert.equal(doDrag('group',4,0,true).length,0,'cancel must not commit');
    const [a]=doDrag('group',5,2);assert.equal(actions.length,1);assert.equal(a.type,'handle-group-move');assert.deepEqual(a.keys,desc);assert.deepEqual(a.owner,explicit?undefined:owner);assert.equal(a.spec.type,'move');assert(Math.abs(a.spec.dx-5)<1e-6);assert(Math.abs(a.spec.dy-2)<1e-6);
  }
  set({tool:'select',view3d,multiKeys:[],target:owner,placingContent:true});assert(!guides.innerHTML.includes('data-shelf-group-move'));assert(guides.innerHTML.includes('data-shelf-scope-caption'));
  set({tool:'resize',placingContent:false});assert(!guides.innerHTML.includes('data-shelf-group-move'));assert(!/<g data-shelf-scope-caption[^>]*><rect/.test(guides.innerHTML));
  set({tool:'point-insert',target:{kind:'cell',key:'0:0'},multiKeys:[],placeAxis:'row'});assert(guides.innerHTML.includes('data-grip-direction="row"'));assert.equal(doDrag('equal').length,0);assert.equal(doDrag('equal',0,13,true).length,0);
  const [r]=doDrag('equal',0,13);assert.equal(actions.length,1);assert.equal(r.type,'equal-distribute');assert.equal(r.axis,'row');assert(r.count>=2);
  set({placeAxis:'col'});assert(guides.innerHTML.includes('data-grip-direction="col"'));const [v]=doDrag('equal',14,0);assert.equal(v.type,'equal-distribute');assert.equal(v.axis,'col');
}
set({preview:true});assert.equal(guides.innerHTML,'');assert(!canvas.exportSvg().includes('data-shelf-drag-handle'));canvas.destroy();
console.log('PASS: explicit and nested group grip in select/move/insert, equal-grip directions, front/oblique drag coordinates, inert taps, cancellation, content placing, passive captions, clean export.');

// Real whole-plan + workshop external routing + unit-project return transport.
// The test never obtains or injects a controller selectionForReturn snapshot.
import assert from 'node:assert/strict';
import {Node,Store,fire} from './fixture-kitchen-workshop-dom.mjs';
import {mountWorkshop} from '../public/kitchen-workshop-ui.js';
import {makeVisitExample} from './fixture-kitchen-visit-example.mjs';
import {proposeWholeKitchen} from '../public/kitchen-whole-plan.js';
import {proposalUnits,proposalScene} from '../public/kitchen-proposal-presentation.js';
import {saveProject,openKitchenProject,openUnitContext,kitchenProjectURL,shapeForUnit,scenePlan} from '../public/kitchen-project.js';
import {kitchenGeometry} from '../public/kitchen-model.js';

Node.prototype.prepend=function(...nodes){for(const node of nodes.reverse()){node.remove?.();node.parentNode=this;this.children.unshift(node);}};
Node.prototype.before=function(node){const parent=this.parentNode;node.remove?.();node.parentNode=parent;parent.children.splice(parent.children.indexOf(this),0,node);};
Node.prototype.scrollIntoView=function(){};
Object.defineProperty(Node.prototype,'firstElementChild',{get(){return this.children.find(n=>typeof n!=='string')||null;}});
const dom=new Node('document');dom.root=true;dom.activeElement=null;dom.defaultView=null;
dom.createElement=tag=>{const node=new Node(tag);node.ownerDocument=dom;return node;};
dom.body=new Node('body',{},dom);dom.children.push(dom.body);
globalThis.document=dom;globalThis.window=new Node('window');window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
globalThis.localStorage=new Store();globalThis.sessionStorage=new Store();
globalThis.location={href:'https://example.test/?panel=workshop&step=whole',assign(href){this.href=href;}};
globalThis.DOMPoint=class{constructor(x=0,y=0){this.x=x;this.y=y;}matrixTransform(m){return {x:this.x*m.a+this.y*m.c+m.e,y:this.x*m.b+this.y*m.d+m.f};}};
const generated=await proposeWholeKitchen(makeVisitExample(),{walls:['back']});assert(generated.ok);
const source=structuredClone(generated.candidates[0].doc);source.room.projectId='K-1234567890ABCDEF';
const storage=proposalUnits(source).find(u=>u.family==='storage');assert(storage);

function fixture(){
 const root=dom.createElement('main'),opener=dom.createElement('button');dom.body.append(root,opener);
 const live=openKitchenProject();let external=0;
 const workshop=mountWorkshop(root,{getDoc:()=>live,apply:()=>assert.fail('navigation must not edit the kitchen'),tell(){},opener,closeOthers(){},
  onExternalStep(step,focus,origin){
   assert.equal(step,'unit-interior');external++;
   // Same URL boundary as kitchen-editor.editUnit, after its permission/save gates.
   location.assign(kitchenProjectURL('kitchen-unit',focus.unitId,{view:'top',yaw:247.5,pitch:13.25},origin));
  }});
 const query=selector=>root.querySelector(selector);
 async function ready(){for(let i=0;i<200;i++){
  const screen=query('.ws-screen');if(screen&&!screen.hasAttribute('aria-busy')){assert(!query('[data-ws-retry]'),'real designer mounted through workshop');return;}
  await new Promise(resolve=>setTimeout(resolve,2));
 }assert.fail('workshop did not mount');}
 return {workshop,query,ready,get external(){return external;},click:selector=>fire('click',query(selector)),close(){workshop.close();root.remove();opener.remove();}};
}
for(const exit of ['cancel','save']){
 location.href='https://example.test/?panel=workshop&step=whole';assert(saveProject(source));
 const f=fixture();f.workshop.open('whole');await f.ready();await f.click('[data-wp="current"]');
 const picker=f.query('[data-wp-unit]');picker.value=storage.id;await fire('change',picker);
 await f.click('[data-wp-view="volume"]');await f.click('[data-wp="rotate"]');await f.click('[data-wp="framing"]');
 await fire('keydown',f.query('[data-wp-canvas] svg'),{key:'+'});const volume=f.query('[data-wp-canvas] svg').getAttribute('viewBox');
 await f.click('[data-wp-view="plan"]');await fire('keydown',f.query('[data-wp-canvas] svg'),{key:'-'});
 const plan=f.query('[data-wp-canvas] svg').getAttribute('viewBox');f.query('[data-wp-canvas] svg').focus();
 f.workshop.open('unit-part',{unitId:storage.id,runId:storage.runId,part:'inside'});
 assert.equal(f.external,1);assert.equal(new URL(location.href).pathname,'/unit.html');
 assert(new URL(location.href).searchParams.has('designerReturn'),'actual workshop external route transports designer origin to the interior');
 f.close();const interior=openUnitContext(storage.id);assert(interior,'real saved unit can open its authored interior');
 if(exit==='save')assert.equal(interior.save(interior.plan),'');else interior.cancel();
 const entry=new URL(location.href).searchParams;assert.equal(entry.get('view'),'kitchen');assert.equal(entry.get('step'),'whole');
 const returned=fixture();returned.workshop.open(entry.get('step'));await returned.ready();
 assert.equal(returned.workshop.screen().context.unitId,storage.id,'router consumes its saved origin without manual snapshot injection');
 assert.equal(returned.query('[data-wp-view="plan"]').getAttribute('aria-pressed'),'true');
 assert.equal(returned.query('[data-wp-canvas] svg').getAttribute('viewBox'),plan);
 assert.equal(dom.activeElement,returned.query('[data-wp-canvas] svg'),'return focuses the originating designer drawing');
 await returned.click('[data-wp-view="volume"]');assert.equal(returned.query('[data-wp-canvas] svg').getAttribute('viewBox'),volume);
 assert.equal(returned.query('[data-wp="framing"]').getAttribute('aria-pressed'),'false');
 assert.equal(openKitchenProject().kitchen.units.find(u=>u.id===storage.id).width,storage.widthMm/10);
 returned.close();
 const revisit=fixture();revisit.workshop.open('whole');await revisit.ready();assert(!revisit.query('[data-width-change]'),'return snapshot is consumed once');revisit.close();
 console.log('PASS designer interior '+exit+': actual workshop origin transport, saved unit exit, route consumption, selection, per-view camera/frame and focus.');
}

const menuFailures=[];
for(const initialSelection of ['another-unit','none'])try{
 location.href='https://example.test/?panel=workshop&step=whole';
 const menuSource=structuredClone(source),target=menuSource.kitchen.units.find(u=>u.id===storage.id);
 target.open=true;target.detail=shapeForUnit(target,kitchenGeometry(menuSource.kitchen,scenePlan(menuSource.room,menuSource.kitchen)).units.find(u=>u.id===target.id));
 assert(target.detail);assert(saveProject(menuSource));
 const live=openKitchenProject(),other=proposalUnits(live).find(u=>u.family==='rice');
 const f=fixture();f.workshop.open('whole');await f.ready();await f.click('[data-wp="current"]');
 if(initialSelection==='another-unit'){
  const picker=f.query('[data-wp-unit]');picker.value=other.id;await fire('change',picker);
 }
 await f.click('[data-wp-view="plan"]');await fire('keydown',f.query('[data-wp-canvas] svg'),{key:'-'});
 const plan=f.query('[data-wp-canvas] svg').getAttribute('viewBox');
 await f.click('[data-wp-view="volume"]');await f.click('[data-wp="framing"]');
 await fire('keydown',f.query('[data-wp-canvas] svg'),{key:'+'});const volume=f.query('[data-wp-canvas] svg').getAttribute('viewBox');
 const scene=proposalScene(live,'volume','menu-location',{interactive:true,yaw:18,frameUnits:false});
 let picked;
 for(const polygon of f.query('[data-wp-canvas]').querySelectorAll('[data-kitchen-3d-id="'+storage.id+'"][data-kitchen-face="interior-backing"]')){
  const points=polygon.getAttribute('points').split(' ').map(point=>point.split(',').map(Number));
  const [x,y]=[0,1].map(axis=>points.reduce((sum,p)=>sum+p[axis],0)/points.length);
  const hit=scene.hitTest(x,y),part=scene.partTarget(hit);
  if(part?.route==='unit-part'&&part.focus.unitId===storage.id&&part.focus.part==='inside'){picked={polygon,x,y};break;}
 }
 assert(picked,'cabinet B has a visible authored interior backing in the real drawing');
 await fire('contextmenu',picked.polygon,{button:2,clientX:picked.x,clientY:picked.y});
 assert.equal(f.workshop.screen().context.unitId,initialSelection==='another-unit'?other.id:null,'opening the menu does not silently replace selection');
 const menu=dom.body.querySelector('.k-drawing-menu');assert(menu,'the actual drawing context menu opens');
 const edit=menu.querySelectorAll('[role="menuitem"]').find(button=>button.textContent==='تحرير التقسيم الداخلي');assert(edit);
 await fire('click',edit);assert.equal(f.external,1);assert.equal(new URL(location.href).searchParams.get('unit'),storage.id);
 assert(new URL(location.href).searchParams.has('designerReturn'),'context-menu cabinet B becomes the stable origin before navigation');
 f.close();const interior=openUnitContext(storage.id);assert(interior);interior.cancel();
 const returned=fixture();returned.workshop.open(new URL(location.href).searchParams.get('step'));await returned.ready();
 assert.equal(returned.workshop.screen().context.unitId,storage.id,'return selects context-menu cabinet B');
 assert.equal(returned.query('[data-wp-view="volume"]').getAttribute('aria-pressed'),'true');
 assert.equal(returned.query('[data-wp-canvas] svg').getAttribute('viewBox'),volume);
 assert.equal(returned.query('[data-wp="framing"]').getAttribute('aria-pressed'),'false');
 assert.equal(dom.activeElement,returned.query('[data-wp-canvas] svg'));
 await returned.click('[data-wp-view="plan"]');assert.equal(returned.query('[data-wp-canvas] svg').getAttribute('viewBox'),plan);
 returned.close();console.log('PASS drawing context interior: '+initialSelection+' -> cabinet B -> actual unit return, selection/view/cameras/frame/focus.');
}catch(error){menuFailures.push(error);console.error('FAIL drawing context interior '+initialSelection+': '+error.message);}
assert.equal(menuFailures.length,0,menuFailures.map(error=>error.message).join('\n'));

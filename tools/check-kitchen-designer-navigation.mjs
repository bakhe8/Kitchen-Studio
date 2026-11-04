// Real whole-plan + workshop external routing + unit-project return transport.
// The test never obtains or injects a controller selectionForReturn snapshot.
import assert from 'node:assert/strict';
import {Node,Store,fire} from './fixture-kitchen-workshop-dom.mjs';
import {mountWorkshop} from '../public/kitchen-workshop-ui.js';
import {makeVisitExample} from './fixture-kitchen-visit-example.mjs';
import {proposeWholeKitchen} from '../public/kitchen-whole-plan.js';
import {proposalUnits} from '../public/kitchen-proposal-presentation.js';
import {saveProject,openKitchenProject,openUnitContext,kitchenProjectURL} from '../public/kitchen-project.js';

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

// Exercise the real finish controller and domain through browser-like event
// bubbling. The tiny DOM owns only markup, field state and listener lifetimes;
// it never substitutes finish calculations or renderer output.
import assert from 'node:assert/strict';
import {mountFinishDesk} from '../public/kitchen-finish-desk.js';
import {makeVisitExample} from './fixture-kitchen-visit-example.mjs';
import {proposeWholeKitchen} from '../public/kitchen-whole-plan.js';
import {getFactoryCatalog,buildFactoryQuote,cleanCatalog} from '../public/kitchen-workshop-factory.js';
import {finishMembers,setFacePanel} from '../public/kitchen-finish-parts.js';
import {reviewPartChoice} from '../public/kitchen-finish-parts-ui.js';
import {normalizeWorkshopCatalogs} from '../public/kitchen-catalog-records.js';
import {getKitchenPhotoMesh} from '../public/kitchen-render.js';
import {scenePlan} from '../public/kitchen-project.js';
import {proposalScene} from '../public/kitchen-proposal-presentation.js';

const decode=s=>String(s).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const encode=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
const attrList=s=>Object.fromEntries([...s.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map(m=>[m[1],decode(m[2]??m[3]??m[4]??'')]));
const dataKey=s=>s.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
const voidTags=new Set(['input','img','br','hr','meta','link','wbr','source','area','base','embed','param']);
class Node {
 constructor(tag='div',attrs={},parent=null){
  this.tagName=tag.toUpperCase();this.attrs={...attrs};this.parentNode=parent;this.children=[];this.listeners=new Map();
  this.style={setProperty(){}};this.scrollTop=0;this.dataset=Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[dataKey(k),v]));
  this.classList={add:(...names)=>this.setAttribute('class',[...new Set([...this.classes(),...names])].join(' ')),remove:(...names)=>this.setAttribute('class',this.classes().filter(n=>!names.includes(n)).join(' ')),contains:name=>this.classes().includes(name),toggle:(name,force)=>{const yes=force??!this.classes().includes(name);this.classList[yes?'add':'remove'](name);return yes;}};
 }
 classes(){return (this.attrs.class||'').split(/\s+/).filter(Boolean);}
 get isConnected(){return this.root===true||!!this.parentNode?.isConnected;}
 get value(){if(this._value!==undefined)return this._value;if(this.tagName==='SELECT'){const options=this.querySelectorAll('option');return (options.find(n=>n.hasAttribute('selected'))||options[0])?.getAttribute('value')??'';}return this.getAttribute('value')??'';}
 set value(v){this._value=String(v);}
 get disabled(){return this.hasAttribute('disabled');}set disabled(v){v?this.setAttribute('disabled',''):this.removeAttribute('disabled');}
 get options(){return this.querySelectorAll('option');}
 get textContent(){return this.children.map(n=>typeof n==='string'?decode(n):n.textContent).join('');}
 set textContent(v){this.detach();this.children=[String(v)];}
 detach(){for(const child of this.children)if(typeof child!=='string')child.parentNode=null;}
 get innerHTML(){return this.children.map(n=>typeof n==='string'?n:n.outerHTML).join('');}
 set innerHTML(html){
  this.detach();this.children=[];const stack=[this];
  for(const token of String(html).match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g)||[]){
   if(token.startsWith('<!--'))continue;
   if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}
   if(token.startsWith('<')){
    const m=token.match(/^<([\w:-]+)([\s\S]*?)\/?\s*>$/);if(!m)continue;
    const parent=stack.at(-1),node=new Node(m[1],attrList(m[2]),parent);parent.children.push(node);
    if(!voidTags.has(m[1].toLowerCase())&&!token.endsWith('/>'))stack.push(node);
   }else stack.at(-1).children.push(token);
  }
 }
 get outerHTML(){const tag=this.tagName.toLowerCase(),attrs=Object.entries(this.attrs).map(([k,v])=>' '+k+'="'+encode(v)+'"').join('');return '<'+tag+attrs+'>'+this.innerHTML+(voidTags.has(tag)?'':'</'+tag+'>');}
 getAttribute(k){return this.attrs[k]??null;}
 hasAttribute(k){return Object.hasOwn(this.attrs,k);}
 setAttribute(k,v){this.attrs[k]=String(v);if(k.startsWith('data-'))this.dataset[dataKey(k)]=String(v);}
 removeAttribute(k){delete this.attrs[k];if(k.startsWith('data-'))delete this.dataset[dataKey(k)];}
 matches(selector){return selector.split(',').some(s=>{
  s=s.trim();const absent=[...s.matchAll(/:not\(([^)]+)\)/g)].map(m=>m[1]);s=s.replace(/:not\([^)]+\)/g,'');if(absent.some(x=>this.matches(x)))return false;
  if(s.includes(':disabled')&&!this.disabled)return false;s=s.replace(/:disabled/g,'');
  const tag=s.match(/^[\w-]+/)?.[0];if(tag&&tag.toUpperCase()!==this.tagName)return false;
  if([...s.matchAll(/\.([\w-]+)/g)].some(m=>!this.classes().includes(m[1])))return false;
  return [...s.matchAll(/\[([^\]=\s]+)(?:=["']?([^\]"']*)["']?)?\]/g)].every(m=>this.hasAttribute(m[1])&&(m[2]===undefined||this.getAttribute(m[1])===m[2]));
 });}
 closest(selector){for(let n=this;n;n=n.parentNode)if(n.matches(selector))return n;return null;}
 querySelectorAll(selector){
  const parts=selector.trim().split(/\s+(?=(?:[^"']|"[^"]*"|'[^']*')*$)/),last=parts.pop(),out=[];
  const walk=node=>{for(const child of node.children)if(typeof child!=='string'){
   if(child.matches(last)){let n=child.parentNode;const ancestors=[...parts];while(ancestors.length&&n){if(n.matches(ancestors.at(-1)))ancestors.pop();n=n.parentNode;}if(!ancestors.length)out.push(child);}
   walk(child);
  }};walk(this);return out;
 }
 querySelector(s){return this.querySelectorAll(s)[0]??null;}
 contains(target){for(let n=target;n;n=n.parentNode)if(n===this)return true;return false;}
 focus(){this.focused=true;}getBoundingClientRect(){return {left:0,top:0,right:900,bottom:600,width:900,height:600};}
 getScreenCTM(){return {inverse:()=>({a:1,b:0,c:0,d:1,e:0,f:0})};}
 createSVGPoint(){return {x:0,y:0,matrixTransform(m){return {x:this.x*m.a+this.y*m.c+m.e,y:this.x*m.b+this.y*m.d+m.f};}};}
 addEventListener(type,fn,options){const list=this.listeners.get(type)||[];list.push({fn,capture:options===true||!!options?.capture});this.listeners.set(type,list);}
 removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(e=>e.fn!==fn));}
}
async function fire(type,target,more={}){
 assert(target,'the requested control exists in actual rendered markup');
 const path=[];for(let node=target;node;node=node.parentNode)path.push(node);
 const event={type,target,button:0,detail:1,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.immediateStopped=this.stopped=true;},...more};
 for(const node of [...path].reverse())for(const {fn,capture} of [...(node.listeners.get(type)||[])]){if(capture&&!event.immediateStopped)await fn(event);}
 if(!event.stopped)for(const node of path){
  if(typeof node['on'+type]==='function')await node['on'+type](event);
  for(const {fn,capture} of [...(node.listeners.get(type)||[])])if(!capture&&!event.immediateStopped)await fn(event);
  if(event.stopped)break;
 }
 return event;
}

const generated=await proposeWholeKitchen(makeVisitExample(),{walls:['back']});assert(generated.ok,generated.reason);
const source=structuredClone(generated.candidates[0].doc);source.room.projectId='K-1234567890ABCDEF';
const catalog=structuredClone(getFactoryCatalog(source)),bySku=sku=>catalog.items.find(i=>i.sku===sku);
bySku('FACE-6-G').price=175;
catalog.items.push({...bySku('BODY-6'),sku:'BODY-BLUE',name:'لوح أزرق',colorHex:'#15658a',price:140},
 {...bySku('PULL'),sku:'PULL-BRASS',name:'يد نحاسية',colorHex:'#b57132',price:20},
 {...bySku('BODY-6'),sku:'BODY-THICK',name:'لوح يحتاج تحقق سماكة',thicknessMm:bySku('BODY-6').thicknessMm+2,price:180});
const slot=(source,labels,skus)=>({source,labels,skus:[source,...skus],mode:'matching',reference:'finish controller fixture'});
catalog.families.storage.finishSlots={body:slot('BODY-6',['جانب جسم'],['BODY-BLUE','BODY-THICK']),handle:slot('PULL',['يد'],['PULL-BRASS'])};
catalog.families.rice.finishSlots={handle:slot('PULL',['يد'],['PULL-BRASS'])};
assert(cleanCatalog(catalog),'the fixture uses a factory-valid published catalog');
for(const key of ['storeCatalog','factoryRecipes','pricingTerms','catalogMeta'])delete source.room.workshop[key];
source.room.workshop.catalog=catalog;source.room.workshop=normalizeWorkshopCatalogs(source.room.workshop);assert(source.room.workshop);
const members=finishMembers(source,catalog),rice=members.find(m=>m.family==='rice'),storage=members.find(m=>m.family==='storage');assert(rice&&storage);
const snapshot=doc=>JSON.stringify(doc);
const frontColor=doc=>getKitchenPhotoMesh(scenePlan(doc.room),doc.kitchen).faces.find(f=>f.id===rice.id&&f.tag==='drawer-front')?.color;
const paintState=f=>[...new Set(f.query('[data-finish-drawing]').querySelectorAll('[data-kitchen-3d-id]').map(n=>JSON.stringify(['data-kitchen-3d-id','data-kitchen-component','data-factory-part-sku','fill'].map(k=>n.getAttribute(k)))))].sort();

function fixture({focus={unitId:rice.id},writable=true,applyResult={ok:true,saved:true}}={}){
 let live=structuredClone(source),desk,saves=0,back=null,forward=null,writeHook=null;
 const host=new Node();host.root=true;const writes=[],historyCalls=[];
 const options=()=>({doc:live,catalog:getFactoryCatalog(live),getDoc:()=>live,focus,canEdit:()=>writable,canHistory:next=>!!(next?forward:back),
  async onApply(buildNext,message,selection){
   if(writeHook)await writeHook();
   if(applyResult.ok===false)return applyResult;
   const next=buildNext();writes.push({next,message,selection});back=live;forward=null;live=next;saves++;
   // Workshop remounts after project commit, preserving the controller's pick.
   focus=selection;desk.destroy();desk=mountFinishDesk(host,options());return applyResult;
  },
  onHistory(next){historyCalls.push(next);if(next&&forward){back=live;live=forward;forward=null;}else if(!next&&back){forward=live;live=back;back=null;}desk.destroy();desk=mountFinishDesk(host,options());return {ok:true,saved:true};}
 });
 const mount=()=>{desk?.destroy();desk=mountFinishDesk(host,options());};mount();
 const query=s=>host.querySelector(s),click=s=>fire('click',typeof s==='string'?query(s):s);
 const change=async(selector,value)=>{const target=query(selector);assert(target,selector+' exists');target.value=value;await fire('change',target);return target;};
 return {host,query,click,change,writes,historyCalls,mount,fire,
  drawing:()=>query('[data-finish-drawing]')?.innerHTML||'',get desk(){return desk;},get live(){return live;},get saves(){return saves;},
  set writable(value){writable=value;},set live(value){live=value;},set writeHook(value){writeHook=value;},destroy(){desk.destroy();}};
}

// Choosing a real published front changes renderer output, not the saved doc.
const f=fixture(),original=snapshot(f.live),drawing=f.drawing(),paintBefore=paintState(f),expected=setFacePanel(f.live,getFactoryCatalog(f.live),rice.id,'FACE-6-G');
const priceBefore=f.query('[data-finish-price]')?.textContent;
await f.change('[data-finish-sku]','FACE-6-G');
assert(f.drawing()!==drawing,'choosing a front must update actual drawing before project save');
assert(f.drawing().includes(frontColor(expected)),'preview shows the selected catalog color');
assert.equal(snapshot(f.live),original);assert.equal(f.saves,0);assert(f.desk.hasPending());
const money=value=>new Intl.NumberFormat('ar-SA').format(Math.round(value*100)/100);
const quote=buildFactoryQuote(expected);
assert.notEqual(f.query('[data-finish-price]').textContent,priceBefore,'live material and quote values follow preview');
assert(f.query('[data-finish-price]').textContent.includes(money(quote.materialValue)));
assert(f.query('[data-finish-price]').textContent.includes(money(quote.total)));
assert(f.desk.tracksDraft(f.query('[data-finish-sku]')),'the workshop knows this field belongs to finish preview');
await f.click('[data-finish-undo]');assert(!f.desk.hasPending());assert.deepEqual(paintState(f),paintBefore);assert.deepEqual(f.historyCalls,[]);
assert.equal(f.query('[data-finish-sku]').value,'FACE-6-W','undo also restores the side editor, so its Apply cannot revive the undone choice');
await f.click('[data-finish-redo]');assert(f.desk.hasPending());assert.equal(snapshot(f.live),original);assert.equal(f.saves,0);assert.deepEqual(f.historyCalls,[]);
assert.equal(f.query('[data-finish-sku]').value,'FACE-6-G','redo restores both the visible preview and editor choice');
await f.click('[data-finish-cancel]');assert(!f.desk.hasPending());assert.deepEqual(paintState(f),paintBefore);assert.equal(f.query('[data-finish-sku]').value,'FACE-6-W');
await f.click('[data-sample-choice="FACE-6-G"]');assert(f.desk.hasPending());assert.equal(f.saves,0);
await f.fire('keydown',f.query('[data-finish-sku]'),{key:'Escape'});assert(!f.desk.hasPending());assert.deepEqual(paintState(f),paintBefore);
await f.change('[data-finish-sku]','FACE-6-G');
await f.click('[data-finish-save]');assert.equal(f.saves,1);assert(!f.desk.hasPending());
assert.deepEqual(f.live.room.workshop.finishes.units[rice.id],{frontSku:'FACE-6-G'});
assert.equal(f.live.room.workshop.finishes.units[storage.id],undefined,'preview/save keeps exact unit scope');
assert.equal(f.writes[0].selection.unitId,rice.id);
await f.click('[data-finish-undo]');assert.deepEqual(f.historyCalls,[false]);assert.equal(snapshot(f.live),original);
await f.click('[data-finish-redo]');assert.deepEqual(f.historyCalls,[false,true]);assert.equal(f.live.room.workshop.finishes.units[rice.id].frontSku,'FACE-6-G');
f.destroy();
assert([...f.host.listeners.values()].every(list=>!list.length),'all controller/context/viewport listeners are removed');
console.log('Finish controller: actual color and price preview, unchanged saved source, cancel/Escape, local undo/redo, explicit save and authoritative history.');

// Component selection and its factory slot stay independent of front color.
for(const [part,sku,kind] of [['body','BODY-BLUE','materials'],['handle','PULL-BRASS','handles']]){
 const p=fixture({focus:{unitId:storage.id,part,index:1}}),before=snapshot(p.live),shown=p.drawing();
 assert.equal(p.desk.commandContext().unitId,storage.id);assert.equal(p.desk.commandContext().part,part);
 assert.equal(p.desk.commandContext().kind,kind);
 await p.change('[data-cp-sku]',sku);
 assert(p.desk.hasPending());assert.equal(p.saves,0);assert.equal(snapshot(p.live),before);
 assert(p.drawing()!==shown,'the chosen component changes the actual unit mesh');
 const faces=p.query('[data-finish-drawing]').querySelectorAll('[data-factory-part-sku="'+sku+'"]');
 assert(faces.length,'published component SKU is attributed to rendered faces');
 assert(faces.every(node=>node.getAttribute('data-kitchen-3d-id')===storage.id),'component never colors another unit');
 const partDoc=reviewPartChoice(p.live,getFactoryCatalog(p.live),storage.id,part,sku).doc;
 assert(p.query('[data-finish-price]').textContent.includes(money(buildFactoryQuote(partDoc).materialValue)));
 await p.click('[data-finish-undo]');assert(!p.desk.hasPending());assert.equal(p.query('[data-cp-sku]').value,part==='body'?'BODY-6':'PULL');
 await p.click('[data-finish-redo]');assert(p.desk.hasPending());assert.equal(p.query('[data-cp-sku]').value,sku);
 await p.click('[data-cp-apply]');assert.equal(p.saves,1);assert.equal(p.live.room.workshop.finishes.partUnits[storage.id][part],sku);
 assert.equal(p.live.room.workshop.finishes.partUnits[rice.id],undefined);assert.equal(p.live.room.workshop.finishes.units,undefined);
 assert.equal(p.writes[0].selection.part,part);assert.equal(p.writes[0].selection.index,1);
 p.destroy();
}
console.log('Finish controller: body and handle selections preview/render/price only their published unit slot, retaining exact picked part context.');

// Change of target cancels the preview. Obsolete detached callbacks remain inert.
const s=fixture(),staleField=s.query('[data-finish-sku]'),staleConfirm=s.query('[data-finish-confirm]'),stalePreview=staleField.onchange,staleWrite=staleConfirm.onclick;
await s.change('[data-finish-sku]','FACE-6-G');
await s.change('[data-finish-scope]',storage.id);
assert.equal(s.desk.commandContext().unitId,storage.id);assert(!s.desk.hasPending());assert.equal(s.saves,0);
assert.match(s.query('[data-finish-status]').textContent,/أُلغيت|تغيير التحديد/);
assert(!staleField.isConnected,'real rerender detaches the old editor fields');
staleField.value='FACE-6-G';await stalePreview();await staleWrite();assert(!s.desk.hasPending());assert.equal(s.saves,0);
await s.change('[data-finish-sku]','FACE-6-G');assert(s.desk.hasPending());
const old=snapshot(s.live);s.desk.discard();assert(!s.desk.hasPending());assert.equal(snapshot(s.live),old);assert.equal(s.saves,0);
s.destroy();await stalePreview();await staleWrite();assert.equal(s.saves,0);
console.log('Finish controller: target changes and discard cancel preview, disconnected editor callbacks and destroyed controllers cannot write.');

// Live permission, stale source and failed save retain source ownership.
const r=fixture(),rBase=snapshot(r.live);
await r.change('[data-finish-sku]','FACE-6-G');const rDrawing=r.drawing(),rField=r.query('[data-finish-sku]');
r.writable=false;rField.disabled=true;
for(const action of ['[data-finish-save]','[data-finish-confirm]','[data-finish-undo]','[data-finish-redo]'])await r.click(action);
rField.value='FACE-6-W';await r.fire('change',rField);
assert.equal(r.saves,0);assert.equal(snapshot(r.live),rBase);assert(r.drawing()===rDrawing,'permission revocation preserves visible preview');assert(r.desk.hasPending());
assert.equal(r.query('[data-finish-sku]'),rField);assert(rField.disabled,'revoked access must not rerender away readonly state');assert.deepEqual(r.historyCalls,[]);
r.writable=true;await r.click('[data-finish-cancel]');assert(!r.desk.hasPending());r.destroy();
const stale=fixture();await stale.change('[data-finish-sku]','FACE-6-G');stale.live=structuredClone(stale.live);
const foreign=snapshot(stale.live);await stale.click('[data-finish-save]');await stale.click('[data-finish-confirm]');assert.equal(stale.saves,0);assert.equal(snapshot(stale.live),foreign);stale.destroy();
const fail=fixture({applyResult:{ok:false,saved:false,reason:'fixture save denied'}});await fail.change('[data-finish-sku]','FACE-6-G');
await fail.click('[data-finish-save]');assert.equal(fail.saves,0);assert(fail.desk.hasPending());assert.match(fail.query('[data-finish-status]').textContent,/fixture save denied/);fail.destroy();
console.log('Finish controller: live permission revocation, changed project source and rejected save cannot commit or erase the visible preview.');

// The parent may await approval review before invoking the guarded buildNext.
for(const invalidate of ['permission','source','destroy']){
 const a=fixture();await a.change('[data-finish-sku]','FACE-6-G');
 let release;const gate=new Promise(resolve=>{release=resolve;});a.writeHook=()=>gate;
 const pending=a.click('[data-finish-save]');await Promise.resolve();
 if(invalidate==='permission')a.writable=false;else if(invalidate==='source')a.live=structuredClone(a.live);else a.destroy();
 const before=snapshot(a.live);release();await pending;
 assert.equal(a.saves,0,'late '+invalidate+' change rejects a previously requested save');assert.equal(snapshot(a.live),before);a.destroy();
}
console.log('Finish controller: an awaiting save rechecks permission, project identity and destruction before handing over the candidate.');

// A choice in the catalog can still fail physical compatibility. The preview
// must use the domain check rather than merely tinting the chosen mesh.
const invalid=fixture({focus:{unitId:storage.id,part:'body'}}),saved=snapshot(invalid.live),validPaint=paintState(invalid);
await invalid.change('[data-cp-sku]','BODY-BLUE');assert(invalid.desk.hasPending());
await invalid.change('[data-cp-sku]','BODY-THICK');
assert.equal(invalid.saves,0);assert.equal(snapshot(invalid.live),saved);
assert.deepEqual(paintState(invalid),validPaint,'a rejected physical choice clears the prior preview');
assert(invalid.query('[data-finish-save]').disabled);assert(invalid.query('[data-cp-apply]').disabled);
assert.match(invalid.query('[data-finish-status]').textContent,/المقاس|الوزن|المتطابق/);
await invalid.click('[data-finish-save]');await invalid.click('[data-cp-apply]');assert.equal(invalid.saves,0);
await invalid.change('[data-cp-sku]','BODY-BLUE');assert(invalid.desk.hasPending());assert(!invalid.query('[data-finish-save]').disabled);
invalid.destroy();
console.log('Finish controller: factory compatibility errors restore saved appearance, explain the failure and block both save paths until a valid selection.');

// Hit the real visible polygon at its projected centroid, then the elevation
// artwork; both must retain the same unit, component and drawer ordinal.
const drawn=fixture(),drawnBase=snapshot(drawn.live);
const hitScene=proposalScene(drawn.live,'volume','finish-live',{selectedId:rice.id,interactive:true,frameUnits:true});
const visibleDrawer=drawn.host.querySelectorAll('[data-kitchen-3d-id="'+rice.id+'"][data-kitchen-component="drawer"][data-kitchen-index="2"]').map(node=>{
 const points=node.getAttribute('points').trim().split(/\s+/).map(p=>p.split(',').map(Number));
 const x=points.reduce((sum,p)=>sum+p[0],0)/points.length,y=points.reduce((sum,p)=>sum+p[1],0)/points.length;
 return {node,x,y,pick:hitScene.partTarget(hitScene.hitTest(x,y))};
}).find(({pick})=>pick?.route==='unit-part'&&pick.focus.unitId===rice.id&&pick.focus.part==='drawer'&&pick.focus.index===2);
assert(visibleDrawer,'a visible second-drawer polygon has a real ray-pickable centroid');
await drawn.fire('click',visibleDrawer.node,{clientX:visibleDrawer.x,clientY:visibleDrawer.y});
assert.equal(drawn.desk.commandContext().unitId,rice.id);assert.equal(drawn.desk.commandContext().part,'drawer');assert.equal(drawn.desk.commandContext().index,2);
assert.equal(drawn.saves,0);assert(!drawn.desk.hasPending());assert.equal(snapshot(drawn.live),drawnBase);
await drawn.change('[data-finish-sku]','FACE-6-G');assert(drawn.desk.hasPending());
await drawn.click('[data-finish-view="elevation"]');assert(drawn.desk.hasPending(),'changing only the camera keeps the candidate');
const elevationDrawer=drawn.query('[data-sheet-unit="'+rice.id+'"][data-sheet-part="drawer"][data-sheet-index="1"]');
await drawn.click(elevationDrawer);assert.equal(drawn.desk.commandContext().index,1);assert(!drawn.desk.hasPending());assert.equal(drawn.saves,0);
assert.match(drawn.query('[data-finish-status]').textContent,/أُلغيت|تغيير التحديد/);
await drawn.change('[data-finish-sku]','FACE-6-G');
const textUndo=await drawn.fire('keydown',drawn.query('[data-finish-sku]'),{key:'z',ctrlKey:true});
assert(!textUndo.defaultPrevented,'native field text/history keys stay owned by the control');assert(drawn.desk.hasPending());assert.deepEqual(drawn.historyCalls,[]);
await drawn.fire('keydown',drawn.query('[data-finish-drawing] svg'),{key:'z',ctrlKey:true});assert(!drawn.desk.hasPending());assert.deepEqual(drawn.historyCalls,[]);
await drawn.fire('keydown',drawn.query('[data-finish-drawing] svg'),{key:'z',ctrlKey:true,shiftKey:true});assert(drawn.desk.hasPending());assert.equal(drawn.saves,0);
drawn.destroy();
console.log('Finish controller: actual 3D ray pick and elevation artwork keep part identity; view inspection, target-change cancel and field-safe keyboard undo/redo.');

// Exposed cabinet sides have no ordinary CAD component label. The finish desk
// resolves that actual ray-hit surface to the factory body slot itself.
const bodyPick=fixture(),bodyScene=proposalScene(bodyPick.live,'volume','finish-live',{selectedId:rice.id,interactive:true,frameUnits:true});
const bodySource=snapshot(bodyPick.live);
const side=bodyPick.host.querySelectorAll('[data-kitchen-face="side"][data-kitchen-3d-part="module"]').map(node=>{
 const points=node.getAttribute('points').trim().split(/\s+/).map(p=>p.split(',').map(Number));
 const x=points.reduce((sum,p)=>sum+p[0],0)/points.length,y=points.reduce((sum,p)=>sum+p[1],0)/points.length;
 return {node,x,y,hit:bodyScene.hitTest(x,y)};
}).find(({node,hit})=>hit?.part==='module'&&hit.tag==='side'&&hit.id===node.getAttribute('data-kitchen-3d-id')&&members.some(m=>m.id===hit.id));
assert(side,'fixture contains an exposed factory cabinet side that can be picked');
await bodyPick.fire('click',side.node,{clientX:side.x,clientY:side.y});
assert.equal(bodyPick.desk.commandContext().unitId,side.hit.id);assert.equal(bodyPick.desk.commandContext().part,'body');
assert.equal(snapshot(bodyPick.live),bodySource);assert.equal(bodyPick.saves,0);assert(!bodyPick.desk.hasPending());
bodyPick.destroy();
console.log('Finish controller: an actual ray hit on an exposed cabinet side resolves its body slot without changing the project.');

import assert from 'node:assert/strict';
import {mountVisitStart} from '../public/kitchen-visit-start.js';

let focused=null,resize,disconnected=false,opened=[];
function element(){
 const children=new Map(),handlers=new Map();
 return {value:'',textContent:'',innerHTML:'',dataset:{},style:{},
  querySelector(s){if(!children.has(s))children.set(s,element());return children.get(s);},
  addEventListener(k,f){handlers.set(k,f);},
  fire(type,event){handlers.get(type)?.({type,preventDefault(){},...event});},
  focus(){focused=this;},select(){this.selected=true;},remove(){this.removed=true;},
  setCustomValidity(message){this.invalid=message;},reportValidity(){this.reported=true;}
 };
}
const main=element(),form=main.querySelector('form');
const keys=['widthMm','lengthMm','heightMm'];
form.elements=Object.fromEntries([...keys,'name'].map(k=>[k,element()]));
globalThis.document={createElement:()=>main,body:{append(){}},querySelector:()=>element()};
globalThis.localStorage={getItem(){return null;},setItem(){throw Error('Measurements must not save an intermediate project.');}};
globalThis.ResizeObserver=class{constructor(handler){resize=handler;}observe(){} disconnect(){disconnected=true;}};
mountVisitStart((doc,imported)=>{opened.push({doc,imported});});
const graphic=main.querySelector('.visit-graphic');
const count=main.querySelector('[data-visit-count]'), tip=main.querySelector('[data-visit-tip]');
function type(key,value){const field=form.elements[key];field.value=value;form.fire('input',{target:field});}
function enter(key){let prevented=false;form.fire('keydown',{target:form.elements[key],key:'Enter',preventDefault(){prevented=true;}});return prevented;}
const action=main.querySelector('[data-next-label]');
assert.match(count.textContent,/٠ من ٣/);assert.match(action.textContent,/العرض الداخلي/);
form.fire('submit',{});assert.equal(focused,form.elements.widthMm);assert.equal(opened.length,0);
assert.equal(form.elements.widthMm.reported,undefined,'the next action should guide an empty field without an error');
for(const key of keys){
 assert.match(graphic.innerHTML,new RegExp('data-visit-measure="'+key+'"'));
 const target={dataset:{visitMeasure:key},closest:s=>s==='[data-visit-measure]'?target:null};
 for(const action of ['click','Enter',' ']){
  focused=null;graphic.fire(action==='click'?'click':'keydown',{target,key:action});
  assert.equal(focused,form.elements[key]);assert(focused.selected);
 }
 focused=null;graphic.fire('keydown',{target,key:'ArrowRight'});assert.equal(focused,null);
}
type('widthMm','٥٩٩');
assert(enter('widthMm'));assert(form.elements.widthMm.invalid);assert(form.elements.widthMm.reported);
form.fire('submit',{});assert.equal(opened.length,0);
type('widthMm','٥٠٠٠');assert.equal(form.elements.widthMm.invalid,'');
for(const [shape,key] of [['plan','lengthMm'],['volume','heightMm']]){
 const target={dataset:{visitShape:shape},closest:s=>s==='[data-visit-shape]'?target:null};
 graphic.fire('click',{target});assert.equal(focused,form.elements[key]);
}
assert.match(count.textContent,/١ من ٣/);assert.match(action.textContent,/العمق الداخلي/);
assert(enter('widthMm'));assert.equal(focused,form.elements.lengthMm);
type('lengthMm','٥٠٠٠');assert.match(count.textContent,/٢ من ٣/);assert.match(action.textContent,/ارتفاع السقف/);
assert(enter('lengthMm'));assert.equal(focused,form.elements.heightMm);
const lastField=focused;type('heightMm','٢٨٠٠');
assert.match(count.textContent,/٣ من ٣/);assert.match(graphic.innerHTML,/٢٥ م²/);assert.match(tip.textContent,/اكتملت أبعاد الغرفة/);assert.match(action.textContent,/بدء رفع الجدار الأول/);
graphic.clientWidth=700;graphic.clientHeight=650;resize();
assert.equal(focused,lastField);assert.equal(lastField.value,'٢٨٠٠');
for(const key of keys){
 const field=main.querySelector('[data-anchor="'+key+'"]');
 assert.match(field.style.left,/^[\d.]+%$/);assert.match(field.style.top,/^[\d.]+%$/);
 assert.equal(field.dataset.measured,'true');
}
assert.equal(enter('heightMm'),false);assert.equal(opened.length,0);
form.elements.name.value='مشروع اختبار';
form.fire('submit',{});await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(opened.length,1);assert.equal(opened[0].imported,false);
const {name,width,length,height}=opened[0].doc.room;
assert.deepEqual({name,width,length,height},{name:'مشروع اختبار',width:500,length:500,height:280});
assert(disconnected);assert(main.removed);
console.log('On-drawing measurements preserve input values on resize, accept Arabic numerals, validate limits, advance on Enter and create the measured project only on submit.');

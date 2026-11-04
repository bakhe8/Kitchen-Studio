import assert from 'node:assert/strict';
import {mountDefaultsPanel,comparisonRows} from '../public/kitchen-defaults-ui.js';
import {makeFurnishedSaudiRoom} from '../public/kitchen-room-presets.js';
import {resolveDefault} from '../public/kitchen-defaults-model.js';
import {calculateKitchenDefaults} from '../public/kitchen-defaults-calculations.js';
// Drive the very same delegated click and form submit paths as a rep. The
// in-memory host lets us inspect the independent takeoff after a scoped edit.
class Host{
 constructor(){this.handlers={};this.innerHTML='';this.memo=new Map;}
 addEventListener(e,cb){this.handlers[e]=cb;}removeEventListener(e){delete this.handlers[e];}closest(){return null;}
 querySelector(k){if(!this.memo.has(k))this.memo.set(k,{textContent:'',hidden:false,dataset:{},innerHTML:'',focus(){},querySelector(){return null;}});return this.memo.get(k);}
 contains(){return true;}replaceChildren(){this.innerHTML='';}
 click(op,other={}){const b={dataset:{dfDo:op,...other},closest(){return this;}};this.handlers.click({target:b});}
 submit(v){const inputs=Object.fromEntries(Object.entries(v).map(([k,val])=>[k,{value:String(val)}]));const form={matches:()=>true,elements:{namedItem:k=>inputs[k]}};this.handlers.submit({target:form,preventDefault(){}});}
}
let doc=makeFurnishedSaudiRoom('apartment'),commits=0,key=1;const h=new Host(),ui=mountDefaultsPanel(h,{getDoc:()=>doc,getProjectKey:()=>key,apply:v=>(commits++,doc=v,{ok:true,saved:true})});
assert.match(h.innerHTML,/مساحة الغرفة الصافية/);assert.match(h.innerHTML,/تعيين سعر هذه الخامة/);assert.match(h.innerHTML,/احتياط/);assert.match(h.innerHTML,/تعديل استثناء/);
const g=calculateKitchenDefaults(doc),mat=g.materials[0],checkout={scope:'entity',itemId:mat.finishId,type:'number',mode:'value'};
h.click('fix',{key:'waste',item:mat.finishId});h.submit({...checkout,property:'نسبة احتياط سطح العمل',value:'١٠',unit:'%'});assert.equal(commits,1);assert.equal(calculateKitchenDefaults(doc).materials[0].wastePct,10);
h.click('fix',{key:'price',item:mat.finishId});assert.match(h.innerHTML,/السعر \(ريال\/م²\)/);h.submit({...checkout,property:'سعر متر سطح العمل المربع',value:'250',unit:'ريال/م²'});assert.equal(commits,2);const priced=calculateKitchenDefaults(doc);assert.equal(priced.materials[0].priceM2,250);assert(Math.abs(priced.estimatedCost-mat.grossM2*1.1*250)<.02);
h.click('fix',{key:'price',item:mat.finishId});h.click('reset');assert.equal(calculateKitchenDefaults(doc).estimatedCost,null);assert.equal(commits,3);
h.click('fix',{key:'upper'});h.submit({scope:'project',mode:'value',property:'عمق الصف العلوي',value:2,unit:'سم'});assert.equal(commits,3);h.submit({scope:'project',mode:'value',property:'عمق الصف العلوي',value:40,unit:'سم'});assert.equal(commits,4);
h.click('any');h.click('code',{code:'SITE-19'});h.submit({scope:'project',mode:'value',type:'number',property:'خلوص مقترح',unit:'مم',value:0});assert.equal(resolveDefault(doc,{code:'SITE-19',property:'خلوص مقترح'}).value,0);
const before=doc;h.click('fix',{key:'price',item:mat.finishId});doc=makeFurnishedSaudiRoom('hasa');key++;h.submit({...checkout,property:'سعر متر سطح العمل المربع',value:500,unit:'ريال/م²'});assert.equal(commits,5);assert.notEqual(doc,before);
const rs=[{id:'one',inputCode:'SITE-19',property:'المنسوب',itemId:'أ',value:0,unit:'مم',verification:'measured'},{id:'two',inputCode:'SITE-19',property:'المنسوب',itemId:'ب',value:25,unit:'مم',verification:'measured'}];assert.deepEqual(comparisonRows({room:{fieldRegister:{records:rs}}},{code:'SITE-19',property:'المنسوب',itemId:'أ'}).map(x=>x.id),['one']);
ui.destroy();assert.equal(Object.keys(h.handlers).length,0);
console.log('Default-first desk: usable geometry before input, real scoped reserve + tender price change the total independently, restore inherited unknown, reject invalid built depth, arbitrary catalog property & zero, stale project protection and exact item comparisons.');

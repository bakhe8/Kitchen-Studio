import assert from 'node:assert/strict';
import {mountChainStep} from '../public/kitchen-chain-ui.js';
import {newSurveyProject} from '../public/kitchen-project.js';
import {mountOutlineWallEntry} from '../public/kitchen-outline-wall-entry.js';
import {outlineSurveyDocument} from '../public/kitchen-measured-outline-ui.js';
import {parseMeasuredOutline} from '../public/kitchen-measured-outline.js';
import {openPerimeterDraftSession,readPerimeterDraft} from '../public/kitchen-perimeter-draft.js';
import {evaluateWallPair} from '../public/kitchen-wall-pair.js';
import {wallPairPlanes} from '../public/kitchen-wall-pair-ui.js';

// Mount the same DOM event adapter as the field tablet; all data is in mm.
class View{
 html='';events={};nodes=new Map();
 set innerHTML(v){this.html=v;}get innerHTML(){return this.html;}
 querySelector(q){
  if(!/^\[data-(?:survey-elevation|chain-summary|chain-notice|pair-result|pair-offer)/.test(q))return null;
  if(!this.nodes.has(q))this.nodes.set(q,{innerHTML:'',textContent:'',hidden:false,classList:{toggle(){}},querySelector(){return null;}});
  return this.nodes.get(q);
 }
 addEventListener(k,f){this.events[k]=f;}removeEventListener(k){delete this.events[k];}
 fire(type,dataset,attrs=[],value='',tag=type==='click'?'BUTTON':'INPUT'){
  const el={dataset,value,tagName:tag,hasAttribute:k=>attrs.includes(k),closest:()=>el};this.events[type]({target:el});return el;
 }
 open(){this.fire('click',{},['data-survey-pair']);}
 act(a){this.fire('click',{pairAct:a});}
 field(k,v){this.fire('input',{pairValue:k},[],v);}
}
const store=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
let doc=newSurveyProject({widthMm:3000,lengthMm:4000,heightMm:2800,name:'قياس متقابل'},store()),writes=0,fail=false,notice='';
const root=new View(),ctrl=mountChainStep(root,{getDoc:()=>doc,apply:d=>{if(fail)return {ok:false,reason:'فشل الحفظ'};doc=d;writes++;return {ok:true,saved:true};},tell:s=>notice=s});
assert.match(root.html,/قياس الظهر والوجه/);assert.match(root.querySelector('[data-survey-elevation]').innerHTML,/data-survey-pair/);
root.open();assert.match(root.html,/data-pair-value="back" value=""/);
assert.match(root.html,/data-pair-value="depth" value="600"/);
root.field('back','٣٠٠٠');root.field('front','٢٩٨٠');assert.match(root.querySelector('[data-pair-result]').innerHTML,/يضيق/);
assert.equal(root.querySelector('[data-pair-offer]').hidden,false);
let left=false;assert.equal(ctrl.requestLeave(()=>left=true),false);assert.equal(left,false);
fail=true;root.act('save');assert.equal(writes,0);assert.equal(left,false);fail=false;
root.act('save');assert.equal(writes,1);assert.equal(left,true);
let saved=doc.room.workshop.wallPairs.back.base;assert.equal(saved.backMm,3000);assert.equal(saved.frontMm,2980);assert(!saved.anchor);
root.open();root.act('anchor');root.field('side','start');root.field('offset','٠');root.act('save');
saved=doc.room.workshop.wallPairs.back.base;assert.equal(evaluateWallPair(doc,'back',saved).clearMm,2980);
root.open();root.act('tier-upper');root.field('back','٣٠٠٠');root.field('front','٣٠٢٠');root.act('save');
assert.equal(doc.room.workshop.wallPairs.back.upper.frontMm,3020);
root.open();root.act('remove');assert.equal(doc.room.workshop.wallPairs.back.base,undefined);assert(doc.room.workshop.wallPairs.back.upper);
ctrl.destroy();
const options=wallPairPlanes({...doc,kitchen:{...doc.kitchen,runs:[{wall:'back',tier:'base',depth:45,bottom:0,height:86},{wall:'back',tier:'base',depth:60,bottom:0,height:86}]}},'back','base');
assert.deepEqual(options.planes.map(p=>p.depth),[450,600]);

// Keep the two-width first-visit field data independent of the temporary face's
// fabricated coordinate plane. Rebind only matching raw measurements at closure.
const h=new View(),memory=store();let surveys={},session=openPerimeterDraftSession(memory);
const rows=[{id:'poly-01',direction:'right',length:'3000',angle:''}];
const chain={source:'drawing',rows:[]};
const child=mountOutlineWallEntry(h,{lengthMm:3000,heightMm:2800,chain,onClose(){},onSave(){},onPairSave(pairs){
 surveys={'poly-01':{lengthMm:3000,heightMm:2800,chain,pairs}};
 session.write({mode:'walk',reference:'رفع التجربة',height:'2800',thickness:'',coords:'',rows,surveys});
}});
h.open();h.field('back','٣٠٠٠');h.field('front','٣٠٠٠');h.act('save');child();
session.close();surveys=readPerimeterDraft(memory).data.surveys;assert(surveys['poly-01'].pairs.base);
const room=parseMeasuredOutline({unit:'mm',reference:'AC-695',vertices:[[0,0],[3000,0],[3000,4000],[0,4000]],heightMm:2800}).room;
const result=outlineSurveyDocument(room,new Map(Object.entries(surveys)));assert(result.ok,result.reason);
const bound=result.doc.room.workshop.wallPairs['poly-01'].base;
assert.notEqual(bound.datum,surveys['poly-01'].pairs.base.datum);assert.equal(evaluateWallPair(result.doc,'poly-01',bound).source,'outline');
const stale=structuredClone(surveys);stale['poly-01'].pairs.base.datum=saved.datum;
assert.equal(outlineSurveyDocument(room,new Map(Object.entries(stale))).ok,false);
console.log('Wall pair tablet action, Arabic input, partial evidence, failed save recovery, tier overrides, alternative depths, first-visit checkpoint and measured outline binding verified.');

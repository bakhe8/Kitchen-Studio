import assert from 'node:assert/strict';
import {mountWallInkGestures,wallInkPoint} from '../public/kitchen-wall-ink-gestures.js';
import {surveyWallSheet} from '../public/kitchen-survey-wall-sheet.js';

// A non-square measured wall inside a translated, rotated, anisotropically
// scaled viewport. The inverse CTM includes all ancestor/iframe letterboxing.
const m={a:1.4,b:.25,c:-.6,d:.7,e:118,f:52};
m.inverse=()=>{
 const k=m.a*m.d-m.b*m.c;
 return {a:m.d/k,b:-m.b/k,c:-m.c/k,d:m.a/k,e:(m.c*m.f-m.d*m.e)/k,f:(m.b*m.e-m.a*m.f)/k};
};
const dataset={inkLeft:'46',inkTop:'58',inkWidth:'440',inkHeight:'246.4',inkWallMm:'5000',inkHeightMm:'2800'};
function client(x,z){
 const dx=46+x*.088,dy=58+246.4-z*.088;
 return {clientX:dx*m.a+dy*m.c+m.e,clientY:dx*m.b+dy*m.d+m.f};
}
let releaseCount=0,attached=true,tool='auto',receipt=[];
const ownerDocument={createElementNS(ns,tag){return element(tag);}};
function element(tag){
 return {tag,ownerDocument,children:[],attributes:{},setAttribute(k,v){this.attributes[k]=v;},
  append(el){this.children.push(el);el.parent=this;},remove(){this.parent.children=this.parent.children.filter(el=>el!==this);},replaceChildren(){this.children=[];}};
}
const svg=Object.assign(element('svg'),{dataset,getScreenCTM:()=>m,createSVGPoint:()=>({
 x:0,y:0,matrixTransform(q){return {x:this.x*q.a+this.y*q.c+q.e,y:this.x*q.b+this.y*q.d+q.f};}
}),setPointerCapture(i){this.pointer=i;},hasPointerCapture(i){return this.pointer===i;},releasePointerCapture(){delete this.pointer;releaseCount++;}});
const listeners={};
const host={contains:e=>e===svg&&attached,addEventListener(k,fn){listeners[k]=fn;},removeEventListener(k,fn){assert.equal(listeners[k],fn);delete listeners[k];}};
const target=(type='plain')=>({closest(selector){return selector==='svg.survey-wall-sheet'?svg:selector==='[data-chain-hit]'&&type==='item'||selector==='[data-chain-focus]'&&type==='label'||selector==='[data-ink-edit]'&&type==='ink-dimension'?this:null;}});
function ev(k,x=1000,z=1100,extra={}){
 const e={type:k,...client(x,z),pointerId:4,isPrimary:true,pointerType:'touch',button:0,target:target(),detail:1,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;},...extra};
 listeners[k](e);return e;
}
const close=(a,b)=>assert(Math.abs(a-b)<1e-5,a+' != '+b);
const p=client(1250,1300),local=wallInkPoint(svg,p.clientX,p.clientY);
close(local.xMm,1250);close(local.zMm,1300);
const out=client(-300,3100);
assert.equal(wallInkPoint(svg,out.clientX,out.clientY),null);
assert.deepEqual(wallInkPoint(svg,out.clientX,out.clientY,true),{xMm:0,zMm:2800});
const markup=surveyWallSheet({rows:[]},[],5000,2800);assert(markup.includes('data-ink-wall-mm="5000" data-ink-height-mm="2800"'));
const done=mountWallInkGestures(host,{getTool:()=>tool,onGesture:v=>receipt.push(v)});
ev('pointerdown',10,10,{button:2});assert.equal(svg.children.length,0);
ev('pointerdown',-15,500);ev('pointerup',300,600);assert.equal(receipt.length,0);
ev('pointerdown',1400,3);ev('pointermove',400,2040);
const ghost=svg.children[0];assert(ghost.children.find(n=>n.tag==='rect'));assert(ghost.children.find(n=>n.tag==='text').textContent.includes('باب'));
ev('pointerup',400,2040);assert.equal(receipt.length,1);assert(receipt[0].dragged);assert(!receipt[0].tap);close(receipt[0].end.xMm,400);assert.equal(svg.children.length,0);
assert(ev('click').stopped);assert(!ev('click').stopped);
ev('pointerdown',900,800,{target:target('item')});ev('pointerup',901,800,{target:target('item')});
assert.equal(receipt.length,1);assert(!ev('click').stopped,'auto tap selects a saved feature');
ev('pointerdown',900,800,{target:target('label')});ev('pointerup',900,800);
assert.equal(receipt.length,1,'direct saved dimension editing preserved');
ev('pointerdown',900,800);ev('pointerup',901,800);assert(receipt[1].tap&&receipt[1].kind==='auto','bare tap may choose an explicit item');
tool='water';ev('pointerdown',500,650,{target:target('item')});ev('pointerup',500,650);
assert(receipt[2].tap&&receipt[2].kind==='water');close(receipt[2].end.zMm,650);assert(!ev('click',500,650,{detail:0}).stopped);
ev('pointerdown');ev('pointercancel');ev('pointerup');assert.equal(receipt.length,3);
ev('pointerdown');ev('lostpointercapture',1000,1100,{target:svg});ev('pointerup');assert.equal(receipt.length,3);
ev('pointerdown');ev('pointerdown',700,100,{pointerId:9,isPrimary:false});ev('pointerup');assert.equal(receipt.length,3);
ev('pointerdown');tool='window';ev('pointerup');assert.equal(receipt.length,3);
ev('pointerdown');attached=false;ev('pointerup');attached=true;assert.equal(receipt.length,3);
ev('pointerdown');assert(ev('keydown',0,0,{key:'Escape'}).prevented);ev('pointerup');assert.equal(receipt.length,3);
ev('pointerdown',1100,650);ev('pointerup',5700,3100);
assert.deepEqual(receipt[3].end,{xMm:5000,zMm:2800});assert(releaseCount>0);
tool='auto';ev('pointerdown',1200,2000,{target:target('item')});ev('pointermove',1500,1500);
ev('lostpointercapture',1500,1500,{target:target('item')});ev('pointerup',2000,900);
assert.equal(receipt.length,5,'transferring implicit touch capture from a saved feature to the wall preserves a drag');
ev('pointerdown',400,1500);ev('pointermove',1300,1499);
assert(!svg.children[0].children.some(n=>n.tag==='rect'),'horizontal mark has no invented rectangular height');
assert(svg.children[0].children.find(n=>n.tag==='text').textContent.includes('عرض'));
done.cancel();
const priorReceipts=receipt.length;
ev('pointerdown',400,400,{target:target('ink-dimension')});ev('pointerup',400,400,{target:target('ink-dimension')});
assert.equal(receipt.length,priorReceipts,'a draft dimension is editable without generating an extra mark');
done.cancel();done();assert.equal(Object.keys(listeners).length,0);
console.log('Wall paper: real transformed SVG coordinates, floor/outer-frame ghost, tap vs drag, existing hit preservation, multi-touch/escape/lost/stale cancellation and bounded mouse/touch/stylus capture.');

const row={id:'measured-window',kind:'window',gapMm:430,widthMm:820,heightMm:1120,bottomMm:1030};
const capture=[],jamb=target('item'),dim=target('label');jamb.dataset={chainHit:'0'};dim.dataset={chainHit:'0',chainFocus:'widthMm'};
const dimClosest=dim.closest.bind(dim);dim.closest=s=>s==='[data-chain-hit]'?dim:dimClosest(s);
tool='pen';
const moving=mountWallInkGestures(host,{getTool:()=>tool,onGesture:v=>capture.push(['added',v.kind]),
 readHit:()=>({row,index:0,stationMm:430}),onAdjust:(hit,key,value)=>capture.push([hit.row.id,key,value])});
const gesture=(hit,from,to)=>{ev('pointerdown',...from,{target:hit});ev('pointermove',...to,{target:hit});ev('pointerup',...to,{target:hit});};
gesture(jamb,[600,1300],[700,1300]);assert.deepEqual(capture.pop(),[row.id,'gapMm',530]);
gesture(jamb,[600,1300],[600,1200]);assert.deepEqual(capture.pop(),[row.id,'bottomMm',930]);
gesture(dim,[850,0],[950,0]);assert.deepEqual(capture.pop(),[row.id,'widthMm',920]);
gesture(jamb,[600,1300],[601,1300]);assert.equal(capture.length,0);
row.frameRead={method:'opposite',distanceMm:3750};dim.dataset.chainFocus='frameDistance';
gesture(dim,[850,0],[950,0]);assert.deepEqual(capture.pop(),[row.id,'frameDistance',3650]);
ev('pointerdown',600,1200,{target:jamb});ev('pointermove',800,1200,{target:jamb});ev('pointercancel');ev('pointerup',800,1200,{target:jamb});assert.deepEqual(capture,[]);
assert.equal(row.widthMm,820);assert.equal(row.bottomMm,1030);assert.equal(row.gapMm,430);
moving();console.log('Saved opening drag proposes its existing station or sill; dimension drag respects direct versus opposite casing datum; cancellation and tap cannot mutate readings.');

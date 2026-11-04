import assert from 'node:assert/strict';
import {mountDrawingViewport} from '../public/kitchen-drawing-viewport.js';
import {mountDrawingContext} from '../public/kitchen-drawing-context.js';

class Target {
 constructor(){this.listeners={};this.attributes={};this.children=[];this.style={};this.dataset={};this.isConnected=true;}
 addEventListener(k,f){(this.listeners[k]??=[]).push(f);}
 removeEventListener(k,f){this.listeners[k]=(this.listeners[k]||[]).filter(x=>x!==f);}
 fire(type,fields={}){const e={target:this,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},stopImmediatePropagation(){this.stopped=true;},...fields};for(const fn of this.listeners[type]||[]){fn(e);if(e.stopped)break;}return e;}
 setAttribute(k,v){this.attributes[k]=String(v);} getAttribute(k){return this.attributes[k];}
 contains(n){return this===n||this.children.some(c=>c.contains(n));}
 append(...items){for(const i of items){i.parent=this;this.children.push(i);}}
 focus(){document.activeElement=this;}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.isConnected=false;}
 setPointerCapture(){} releasePointerCapture(){} hasPointerCapture(){return true;}
 getBoundingClientRect(){return {left:0,top:0,width:400,height:200,right:400,bottom:200};}
}
const doc=globalThis.document=new Target(),win=doc.defaultView=new Target();Object.assign(win,{innerWidth:900,innerHeight:700,setTimeout,clearTimeout});doc.body=new Target();doc.createElement=()=>{const e=new Target();e.ownerDocument=doc;return e;};
const host=doc.createElement(),svg=doc.createElement();host.append(svg);doc.body.append(host);
const box=()=>svg.getAttribute('viewBox').split(/\s+/).map(Number);
function point(x,y){const [a,b,w,h]=box();return {x:a+x*w/400,y:b+y*h/200};}
svg.getScreenCTM=()=>({inverse:()=>({})});svg.createSVGPoint=()=>({matrixTransform(){return point(this.x,this.y);}});
let scaleEvents=0;const v=mountDrawingViewport(host,{getSvg:()=>svg,onZoom:()=>scaleEvents++});
v.sync(svg,'0 0 400 200','plan');
const at=point(120,50),wheel=host.fire('wheel',{target:svg,clientX:120,clientY:50,deltaY:-170,deltaMode:0});assert(wheel.defaultPrevented);assert(box()[2]<400);assert(Math.abs(point(120,50).x-at.x)<.00001);assert(Math.abs(point(120,50).y-at.y)<.00001);
const zoomed=box();svg.setAttribute('viewBox','0 0 400 200');v.sync(svg,'0 0 400 200','plan');assert.deepEqual(box(),zoomed);
const ev=(k,x,y,b,buttons)=>host.fire(k,{target:svg,pointerId:7,pointerType:'mouse',button:b,buttons,clientX:x,clientY:y});
ev('pointerdown',200,90,1,4);ev('pointermove',250,110,-1,4);ev('pointerup',250,110,1,0);assert(box()[0]<zoomed[0]);assert.equal(box()[2],zoomed[2]);
assert.equal(scaleEvents,1,'panning never reports a new zoom');
const expanded=box();v.sync(svg,svg.getAttribute('viewBox'),'plan');assert.deepEqual(box(),expanded,'no compounding from in-place SVG refresh');
v.reset();
const touch=(type,id,x,y)=>host.fire(type,{target:svg,pointerId:id,pointerType:'touch',button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:y});
touch('pointerdown',1,100,100);touch('pointerdown',2,200,100);touch('pointermove',2,300,100);
assert.equal(box()[2],200);assert.equal(point(200,100).x,150,'pinch tracks the initial world point at the moving midpoint');
touch('pointerup',1,100,100);assert(touch('pointerup',2,300,100).defaultPrevented,'remaining finger must not edit a unit');
assert(host.fire('click',{target:svg,detail:1}).defaultPrevented,'the compatibility click after a pinch must not select or place an object');
const outside=doc.createElement();assert(!host.fire('wheel',{target:outside,clientX:1,clientY:1,deltaY:-120}).defaultPrevented);assert(!host.fire('wheel',{target:svg,clientX:1,clientY:1,ctrlKey:true,deltaY:-120}).defaultPrevented);
v.reset();assert.deepEqual(box(),[0,0,400,200]);v.zoomBy(2);assert.equal(box()[2],200);v.sync(svg,'0 0 300 300','front');assert.deepEqual(box(),[0,0,300,300]);v.destroy();
const c=mountDrawingContext(host,{getSvg:()=>svg,actionsAt:()=>({title:'درج الأرز',actions:[{label:'تعديل العرض',run(){picked++;}}]})});let picked=0;const opened=host.fire('contextmenu',{target:svg,clientX:15,clientY:25});assert(opened.defaultPrevented);const menu=doc.body.children.at(-1);assert(menu!==host);const first=menu.children.find(x=>x.textContent==='تعديل العرض');assert(first);first.fire('click');assert.equal(picked,1);assert(!menu.isConnected);c.destroy();console.log('Drawing input: cursor-anchored wheel, middle pan, persistent view, fit, view switch, page gestures, actionable contextual menu and cleanup.');

import assert from 'node:assert/strict';
import {mountKitchenPhoto} from '../public/kitchen-photo.js';
import {makeChainExample} from '../public/kitchen-chain-model.js';
import {outputStamp} from '../public/kitchen-output-stamp.js';
import {scenePlan} from '../public/kitchen-project.js';

const workers=[],pending=[],downloads=[],saved=[];
const el=()=>({classList:{add(){},remove(){}},addEventListener(){},removeEventListener(){},focus(){},setAttribute(){},dataset:{}});
function canvas(){
 const c={...el(),width:640,height:400,text:[],paints:[],image:null};
 const ctx={
  putImageData(data){c.image=Uint8Array.from(data.data);},
  drawImage(src,x,y){assert.deepEqual([x,y],[0,0]);c.image=Uint8Array.from(src.image);},
  fillText(text,...args){c.text.push({text,args});},
  fillRect(...args){c.paints.push(args);}
 };
 c.getContext=()=>ctx;
 c.toBlob=(done,type)=>{assert.equal(type,'image/png');pending.push(()=>done(new Blob([c.image],{type})));};
 return c;
}
globalThis.document={body:el(),addEventListener(){},removeEventListener(){},createElement(tag){
 if(tag==='canvas'){const c=canvas();saved.push(c);return c;}
 assert.equal(tag,'a');return {click(){downloads.push(this.download);}};
}};
// The studio now also starts tracing threads next to the coordinator worker, so the coordinator is picked by its script.
globalThis.Worker=class{constructor(url){this.url=String(url);workers.push(this);}terminate(){}postMessage({scene}){assert(scene.materials.length);}};
globalThis.ImageData=class{constructor(data,width,height){Object.assign(this,{data,width,height});}};
const timer=globalThis.setTimeout;globalThis.setTimeout=(fn,ms,...args)=>{const t=timer(fn,ms,...args);t.unref();return t;};
const host=el(),source=canvas(),nodes=new Map([['canvas',source],['progress',el()]]);
host.querySelector=s=>{if(!nodes.has(s))nodes.set(s,el());return nodes.get(s);};
host.querySelectorAll=()=>[];
const first=makeChainExample(),second=structuredClone(first);
first.room.projectId='K-A011111111111111';second.room.projectId='K-B022222222222222';
second.room.name='مشروع ثان';second.kitchen.features[0].bottom+=2;
let doc=first;
const dialog=mountKitchenPhoto(host,{getPlan:()=>scenePlan(doc.room,doc.kitchen),getKitchen:()=>doc.kitchen,getDoc:()=>doc});
const save=host.querySelector('[data-photo-save]');
async function open(width,height,color){
 dialog.open();await new Promise(resolve=>setImmediate(resolve));
 const pixels=new Uint8ClampedArray(width*height*4).fill(color);
 workers.filter(w=>w.url.includes('kitchen-photo-worker')).at(-1).onmessage({data:{type:'frame',width,height,pixels,pass:1,samples:1}});
 return Uint8Array.from(pixels);
}
const originalStamp=outputStamp(first,'منظور المطبخ','صورة التصميم');
const pixels=await open(640,400,138);
first.kitchen.features[0].bottom+=1;
assert.notEqual(originalStamp.revision,outputStamp(first,'منظور المطبخ','صورة التصميم').revision);
const fileA=save.onclick();
assert.deepEqual(saved[0].image,pixels);
assert.equal(saved[0].width,640);assert.equal(saved[0].height,453);
assert.deepEqual(saved[0].paints,[[0,400,640,53]]);
assert(saved[0].text.some(t=>t.text.includes(originalStamp.status)&&t.text.includes('منظور المطبخ')));
assert(saved[0].text.some(t=>t.text.includes(originalStamp.project)&&t.text.includes(originalStamp.revision)),
 'footer belongs to the exact scene captured when photography opened');
assert(saved[0].text.every(t=>t.args[1]>400));assert.equal(source.text.length,0);
dialog.close();doc=second;
const secondStamp=outputStamp(second,'منظور المطبخ','صورة التصميم');
const pixelsB=await open(960,600,32);
const fileB=save.onclick();
pending[1]();await fileB;
pending[0]();await fileA;
assert.deepEqual(downloads,['kitchen-'+secondStamp.project+'-'+secondStamp.revision+'-960x600.png',
 'kitchen-'+originalStamp.project+'-'+originalStamp.revision+'-640x400.png']);
assert.deepEqual(saved[0].image,pixels);assert.deepEqual(saved[1].image,pixelsB);
dialog.destroy();
console.log('Mounted PNG export keeps original frame pixels and footer in distinct canvases; concurrent project/size changes and asynchronous encoding preserve the captured revision, project and filename.');

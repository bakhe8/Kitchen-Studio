import assert from 'node:assert/strict';
import {makeSaudiRoom} from '../public/kitchen-room-presets.js';
import {setProjectDefault,saveReusableDefaults,getReusableDefaults,resolveDefault,newProjectDefaultRoom} from '../public/kitchen-defaults-model.js';
import {packOfficeTemplate,unpackOfficeTemplate,officeFileLimit} from '../public/kitchen-defaults-transfer.js';
import {mountDefaultsPanel} from '../public/kitchen-defaults-ui.js';
class Store {m=new Map;getItem(k){return this.m.get(k)||null}setItem(k,v){this.m.set(k,String(v));}}
const sender=new Store(),receiver=new Store(),k=makeSaudiRoom('apartment');
const entry=(code,property,type,value,unit='',itemId='')=>({code,property,type,value,unit,itemId,mode:'value'});
const rate=entry('MFG-09','سعر متر سطح العمل المربع','number',300,'ريال/م²','carrara');
let room=setProjectDefault(k,rate).room;
room=setProjectDefault(room,entry('SITE-19','منسوب الردّة','number',80,'مم','تعلية-01')).room;
const existing={...k,room:{...k.room,defaults:newProjectDefaultRoom(k.room,receiver).defaults}};
const existingBytes=JSON.stringify(existing);
const saved=saveReusableDefaults(room,'كتالوج الاختبار',sender);assert(saved.ok);
const txt=packOfficeTemplate(getReusableDefaults(sender));assert(!txt.includes('تعلية-01'));let v=unpackOfficeTemplate(txt);assert(v.rows.some(x=>x.itemId==='carrara'&&x.value===300));assert.equal(v.name,'كتالوج الاختبار');assert.equal(getReusableDefaults(receiver),null);
const bads=[new Array(1),JSON.parse(txt),JSON.parse(txt),JSON.parse(txt),JSON.parse(txt),JSON.parse(txt)];
bads[1].profile.rows.push({...rate,itemId:'تعلية-01'});bads[2].profile.rows[0].value={};bads[3].profile.rows.push(bads[3].profile.rows[0]);bads[4].version=2;bads[5].project={siteData:'not allowed'};
for(const b of bads)assert.throws(()=>unpackOfficeTemplate(JSON.stringify(b)));
assert.throws(()=>unpackOfficeTemplate('['));assert.throws(()=>unpackOfficeTemplate(' '.repeat(officeFileLimit+1)));assert.throws(()=>packOfficeTemplate(null));assert.equal(getReusableDefaults(receiver),null);
globalThis.localStorage=receiver;
class H{constructor(){this.listeners={};this.innerHTML='';this.nodes=new Map;}
querySelector(k){if(!this.nodes.has(k))this.nodes.set(k,{textContent:'',dataset:{},focus(){},click(){}});return this.nodes.get(k);}
closest(){return null;}contains(){return true;}replaceChildren(){}addEventListener(k,v){this.listeners[k]=v;}removeEventListener(k){delete this.listeners[k];}
click(op){this.listeners.click({target:{dataset:{dfDo:op},closest(){return this;}}});}
async choose(text){const file={size:text.length,text:async()=>text};this.listeners.change({target:{hasAttribute:k=>k==='data-df-import',files:[file]}});await new Promise(r=>setTimeout(r,0));}
}
const h=new H();let writes=0;const ui=mountDefaultsPanel(h,{getDoc:()=>existing,apply(){writes++;throw Error('import must never patch project');}});
await h.choose(txt);assert(h.innerHTML.includes('كتالوج الاختبار')&&h.innerHTML.includes('لن يتغيّر المشروع المفتوح.'));assert.equal(getReusableDefaults(receiver),null);
await h.choose('{}');assert(!h.innerHTML.includes('لن يتغيّر المشروع المفتوح.'));h.click('profile-confirm');assert.equal(getReusableDefaults(receiver),null);
await h.choose(txt);h.click('profile-confirm');assert.equal(getReusableDefaults(receiver).name,'كتالوج الاختبار');assert.equal(writes,0);assert.equal(JSON.stringify(existing),existingBytes);
const recvd={...k,room:newProjectDefaultRoom({...k.room,defaults:undefined},receiver)};
assert.equal(resolveDefault(recvd,rate).value,300);assert.equal(resolveDefault(existing,rate).value,null);ui.destroy();
console.log('Portable office template: material-only price retained across devices, site instance data excluded, preview never persists before confirmation, bad replacement clears old preview, guarded bounds/model/version and active project unchanged.');

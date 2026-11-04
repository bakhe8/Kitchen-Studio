import assert from 'node:assert/strict';
import {addFeature,addFreeRun,addRun,addUnit,createKitchen} from '../public/kitchen-model.js';
import {applianceFitKey,cleanApplianceSchedule,evaluateApplianceFit} from '../public/kitchen-appliance-fit.js';
const ok=v=>(assert.ok(v.ok,v.reason),v.kitchen),room={width:500,length:500,height:280},doc={room,kitchen:createKitchen(room,'empty')};
doc.kitchen=ok(addRun(doc.kitchen,room,{id:'run',wall:'back',tier:'base',start:20,end:450,depth:60,height:86}));
for(const [i,k] of ['storage','sink','open-shelf','storage'].entries())doc.kitchen=ok(addUnit(doc.kitchen,room,{id:'u'+i,kind:k,runId:'run',u:30+100*i,width:80,...(k==='open-shelf'?{interior:{shelves:0,dividers:0}}:{})}));
for(const [i,kind] of ['electric','water','drain','electric'].entries())doc.kitchen=ok(addFeature(doc.kitchen,room,{id:'f'+i,kind,wall:'back',u:i===3?340:150+10*i,bottom:105,width:3,height:3,depth:2}));
const dims=(width,depth,height)=>({width,depth,height});
function device(kind,host,placement,base={}){
 return {id:'dev',name:'اختبار',kind,host,placement,model:'M',manual:'manual#4',siteRef:'laser',required:dims(400,440,350),measured:dims(800,550,700),offset:[100,30,0],frontMm:0,watts:null,power:'passive',circuit:'',bearing:'same',connections:{},...base};
}
const plug=(i)=>({id:'f'+i,pathMm:2000,maxMm:2500}),ca={id:'c',label:'دائرة التجهيز',reference:'مرجع الكهربائي',allowedW:2200,outlets:['f0','f3']};
const mw=device('microwave','u0','counter',{id:'m',name:'فرن',power:'electric',watts:1500,circuit:'c',connections:{electric:plug(0)}});
const process=(devices,circuits=[ca])=>{
 const sc=cleanApplianceSchedule({devices,circuits});assert.ok(sc);const d={...doc,room:{...room,workshop:{applianceFit:sc}}};
 for(const dev of sc.devices)dev.proof=applianceFitKey(d,dev);
 return d;
};
const evalDoc=(d,ids)=>evaluateApplianceFit(d,ids?{unitIds:ids}:undefined);
assert.deepEqual(evalDoc(process([mw])).issues,[]);
assert.equal(cleanApplianceSchedule({devices:[{...mw,power:'passive'}],circuits:[]}),null);
const snack=device('counter','u3','counter',{id:'b',name:'غلاية',power:'electric',watts:1000,circuit:'c',connections:{electric:plug(3)}});
const conflict=evalDoc(process([mw,snack]),['u0']);assert.equal(conflict.loads[0].watts,2500);assert.match(conflict.issues.join(' '),/٣٠٠|300/);
assert.match(evalDoc(process([mw,{...snack,watts:null}]),['u0']).issues.join(' '),/الحمل المجمع/);
assert.match(evalDoc(process([mw],[{...ca,outlets:['f3']}])).issues.join(' '),/لم تُربط/);
assert.equal(cleanApplianceSchedule({devices:[mw],circuits:[ca,{...ca,id:'c2'}]}),null);
const board=device('counter','u3','counter',{id:'p'});assert.deepEqual(evalDoc(process([mw,board])).issues,[]);
assert.match(evalDoc(process([{...board,power:'unknown'}])).issues.join(' '),/يستخدم.*الكهرباء/);
assert.match(evalDoc(process([{...mw,connections:{electric:{id:'f0',pathMm:3000,maxMm:2400}}}])).issues.join(' '),/600 مم/);
assert.match(evalDoc(process([{...mw,connections:{electric:{id:'f0',pathMm:2,maxMm:2400}}}])).issues.join(' '),/أقصر/);
assert.match(evalDoc(process([{...mw,measured:dims(450,550,700)}])).issues.join(' '),/50 مم/);
const basket=device('underSink','u1','inside');assert.deepEqual(evalDoc(process([basket])).issues,[]);
assert.match(evalDoc(process([{...basket,host:'u2'}])).issues.join(' '),/جسم المجلى/);
assert.match(evalDoc(process([{...mw,host:'u1',required:dims(650,520,350),offset:[0,0,0]}])).issues.join(' '),/فتحة حوض/);
const wash=device('washer','u2','bay',{power:'electric',watts:1200,circuit:'c',connections:{water:plug(1),drain:plug(2),electric:plug(0)}});
assert.deepEqual(evalDoc(process([wash])).issues,[]);
assert.match(evalDoc(process([{...wash,bearing:'mixed'}])).issues.join(' '),/ارتكاز/);
assert.match(evalDoc(process([{...wash,connections:{electric:plug(0)}}])).issues.join(' '),/ماء/);
const overlap=process([basket,{...basket,id:'dup'}]);assert.match(evalDoc(overlap).issues.join(' '),/يتعارض/);
const before=process([mw]),moved={...before,kitchen:{...before.kitchen,units:before.kitchen.units.map(u=>u.id==='u0'?{...u,u:u.u+5}:u)}};assert.match(evalDoc(moved).issues.join(' '),/تأكيد فني/);
const orphan={...before,kitchen:{...before.kitchen,units:before.kitchen.units.filter(u=>u.id!=='u0')}};assert.match(evalDoc(orphan).issues.join(' '),/لم تعد/);
const blocked=process([mw]);blocked.kitchen=ok(addFeature(blocked.kitchen,room,{kind:'beam',wall:'back',u:35,width:70,bottom:95,height:20,depth:50}));
assert.match(evalDoc(blocked).issues.join(' '),/حيز الجهاز أو فتحه/);
const insideShelf=process([{...wash,required:dims(400,440,500)}]);insideShelf.kitchen={...insideShelf.kitchen,units:insideShelf.kitchen.units.map(u=>u.id==='u2'?{...u,interior:{shelves:1,dividers:0}}:u)};
assert.match(evalDoc(insideShelf).issues.join(' '),/رف أو قاطع/);
console.log('Appliances: measured host and local offsets, worktop and sink cutout, positive model load vs passive/unknown, outlet/circuit ownership, multi-device scoped overload/unknown, 3D route lower bound and maximum, actual bay support, beam/peer/door opening conflicts and stale evidence checked.');

// Mount the actual page. Two identically named devices must not share a
// saved finding just because their display labels are alike.
const {mountApplianceFit}=await import('../public/kitchen-appliance-fit-ui.js');
class FitHost {
 listeners={};innerHTML='';focused='';
 addEventListener(type,fn){this.listeners[type]=fn;}
 querySelectorAll(){return [];}
 querySelector(q){return {checked:false,closest:()=>null,focus:()=>{this.focused=q;},innerHTML:'',textContent:'',dataset:{}};}
 input(key,n){
  this.listeners.input({target:{dataset:{kaf:key},type:'number',value:String(n),valueAsNumber:n}});
 }
 choose(id){this.listeners.change({target:{dataset:{kaf:'choose'},value:id,matches:()=>false}});}
 action(key){this.listeners.click({target:{closest:s=>s==='[data-af-act]'?{dataset:{afAct:key}}:null}});}
}
const holder=new FitHost();
const starting=process([{...board,id:'one',name:'جهاز مشترك'},{...board,id:'two',host:'u0',name:'جهاز مشترك',siteRef:''}]);
delete starting.room.workshop.applianceFit.devices[0].power;
let current=starting,writes=0;
const dispose=mountApplianceFit(holder,{getDoc:()=>current,apply:next=>{current=next;writes++;return {ok:true,saved:true};}});
assert.match(holder.innerHTML,/<option value="one" selected>/);
const unitReport=markup=>markup.match(/<details class="dp-saved-result" data-fit-saved="unit"[^>]*>([\s\S]*?)<\/details>/)?.[1]||'';
assert.match(unitReport(holder.innerHTML),/للوحدة U4/);
assert(!unitReport(holder.innerHTML).includes('مرجع القياس الصافي غير مكتمل'));
assert.match(holder.innerHTML,/مرجع القياس الصافي غير مكتمل/);
assert.match(holder.innerHTML,/class="dp-bay-measured"/);
holder.input('d.measured.width',380);
holder.action('newDevice');assert.match(holder.innerHTML,/<option value="" selected>/);
assert(!holder.innerHTML.includes('class="dp-bay-measured"'),'unknown measurements do not create an outline');
holder.choose('two');assert.match(unitReport(holder.innerHTML),/للوحدة U1/);assert.match(unitReport(holder.innerHTML),/مرجع القياس الصافي غير مكتمل/);
holder.choose('one');assert.match(holder.innerHTML,/data-kaf="d.measured.width"[^>]*value="380"/);
assert.match(holder.innerHTML,/نقص في العرض/);assert(dispose.hasPending());assert.equal(writes,0);
holder.listeners.keydown({key:'Enter',target:{dataset:{kaf:'d.measured.width'},reportValidity:()=>true},preventDefault(){}});
assert.equal(holder.focused,'[data-kaf="d.measured.depth"]');
dispose();
const emptyHost=new FitHost(),emptyDoc=process([]);
mountApplianceFit(emptyHost,{getDoc:()=>emptyDoc,apply(){throw Error('unexpected write');}})();
assert.match(emptyHost.innerHTML,/<option value="" selected>/);assert(!emptyHost.innerHTML.includes('data-fit-saved="unit"'));
console.log('Appliance workspace: selects saved/legacy records by identity, separates unit and project checks, keeps drafts across switches and moves between measurement fields.');

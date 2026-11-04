import assert from 'node:assert/strict';
import {mountInventoryStep} from '../public/kitchen-workshop-inventory-ui.js';

class View {
 innerHTML='';children=[];handlers=new Map();targets=new Map();
 append(child){this.children.push(child);}
 querySelector(selector){if(!this.targets.has(selector))this.targets.set(selector,new View());return this.targets.get(selector);}
 querySelectorAll(){return [];}
 addEventListener(name,handler){this.handlers.set(name,handler);}
 removeEventListener(name){this.handlers.delete(name);}
}
globalThis.document={createElement:()=>new View()};
const flush=()=>new Promise(resolve=>setImmediate(resolve)),requests=[];
const key=JSON.stringify(['RAW','panel','white',18,2440,1220,'other','',2440,1220,'Stock item']);
let physical=10,denied=false,catalogRole='store';
globalThis.fetch=async(path,options)=>{
 const url=new URL(path,'https://test.invalid'),body=options.body&&JSON.parse(options.body);requests.push({url,body});let data,status=200;
 if(url.pathname==='/api/catalogs')data=url.searchParams.has('action')?{versions:[{version:3}]}:{catalogs:[{id:'wrong-catalog',name:'Hidden catalog',role:'reader'},{id:'stock-catalog',name:'Store catalog',role:catalogRole}]};
 else if(url.pathname==='/api/projects')data={projects:[{id:'wrong-project',name:'Other project',role:'rep'},{id:'stock-project',name:'Store project',role:'store'}]};
 else if(denied){data={error:'تم سحب صلاحية المخزون'};status=403;}
 else if(body){
  assert.equal(url.searchParams.get('id'),'stock-catalog');
  if(body.action==='count'){assert.equal(body.expected,physical);physical=body.physical;data={ok:true};}
  else {assert.equal(body.project,'stock-project');assert.equal(body.revision,5);assert.equal(body.scope,'whole');data=body.action==='preview'?{lines:[{key,name:'Stock item',qty:2,free:physical}],units:['u1']}:{ok:true,reservation:'saved'};}
 }else if(url.searchParams.has('project')){assert.equal(url.searchParams.get('project'),'stock-project');data={receipts:[{kind:'whole',revision:5}]};}
 else data={role:'store',version:3,stocks:[{key,name:'Stock item',sku:'RAW',physical,held:0,free:physical}],reservations:[],history:[],procurementStamp:4,procurement:{orders:[],policies:[]}};
 return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
};
const host=new View(),dispose=mountInventoryStep(host,{getDoc:()=>({room:{workshop:{}}})});await flush();
const input=(inv,value)=>host.handlers.get('input')({target:{dataset:{inv},value}});
const click=async invAct=>{host.handlers.get('click')({target:{closest:s=>s==='[data-inv-act]'?{dataset:{invAct}}:null}});await flush();};
assert.match(host.innerHTML,/data-inv="count"/);assert.match(host.innerHTML,/data-inv-act="preview"/);
assert(host.children.some(child=>child.innerHTML.includes('data-pro="policy"')),'store sees procurement controls');
assert(!host.innerHTML.includes('Hidden catalog'));assert(!host.innerHTML.includes('Other project'));
assert(requests.some(r=>r.url.searchParams.get('project')==='stock-project'),'store receives authorized project receipts');
input('count','11');input('note','Count report');await click('count');assert.equal(physical,11);assert.equal(requests.filter(r=>r.body?.action==='count').length,1);
await click('preview');assert.match(host.innerHTML,/data-inv-act="reserve"/);input('note','Reservation report');await click('reserve');assert.equal(requests.filter(r=>r.body?.action==='reserve').length,1);
const before=requests.length;
for(const [inv,value] of [['cat','wrong-catalog'],['project','wrong-project']])host.handlers.get('change')({target:{dataset:{inv},value}});
await flush();assert.equal(requests.length,before,'forged selections cannot choose a resource excluded by its independent ACL');
denied=true;await click('refresh');assert.match(host.innerHTML,/تم سحب صلاحية المخزون/);assert(!host.innerHTML.includes('data-inv="count"'));assert(!host.innerHTML.includes('data-inv-act="preview"'));
const writes=requests.filter(r=>r.body).length;input('count','12');input('note','Forged event');await click('count');assert.equal(requests.filter(r=>r.body).length,writes,'a revoked stock view rejects synthetic mutation events');dispose();
denied=false;catalogRole='factory';requests.length=0;const restricted=new View(),close=mountInventoryStep(restricted,{getDoc:()=>({room:{workshop:{}}})});await flush();
assert(!restricted.innerHTML.includes('data-inv="count"'));assert(!requests.some(r=>r.url.pathname==='/api/inventory'),'project store access never supplies catalog stock authority');close();
console.log('Scoped inventory UI: store count/reserve/procurement and authorized receipts, independent resource lists, forged-event refusal and stale control removal after revocation.');

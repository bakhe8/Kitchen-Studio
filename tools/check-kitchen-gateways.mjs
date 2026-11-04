import assert from 'node:assert/strict';
// The four gateways of the real work: who owns which page, what the home says, and that the catalog page shows only the trade it is opened for.
class Store{
 constructor(){this.mem=new Map;}
 get length(){return this.mem.size;}
 key(i){return [...this.mem.keys()][i]??null;}
 getItem(k){return this.mem.get(k)??null;}
 setItem(k,v){this.mem.set(k,String(v));}
 removeItem(k){this.mem.delete(k);}
}
globalThis.localStorage=new Store;globalThis.sessionStorage=new Store;
class View{
 innerHTML='';targets=new Map();handlers=new Map();children=[];isConnected=true;
 append(n){this.children.push(n);}
 replaceChildren(...n){this.children=n;}
 addEventListener(k,fn){this.handlers.set(k,fn);}
 removeEventListener(k){this.handlers.delete(k);}
 querySelector(q){if(!this.targets.has(q))this.targets.set(q,new View());return this.targets.get(q);}
 querySelectorAll(){return [];}
 focus(){}remove(){}
}
globalThis.document={querySelector:()=>({}),createElement:()=>new View()};
const {gateways,mainGateways,ownedPages,pageOwner,factoryPages,factoryPageOf,factorySections,stageCount}=await import('../public/kitchen-gateways.js');
const {newSurveyProject}=await import('../public/kitchen-project.js');
const {workshopPageMatches}=await import('../public/kitchen-workshop-ui.js');
const {gatewaysHTML,gatewayFacts,gatewayLinks,mountGateways}=await import('../public/kitchen-gateways-ui.js');
const {mountFactoryStep}=await import('../public/kitchen-workshop-factory-ui.js');

// ---------- the gateways are the trades of the shop ----------
assert.deepEqual(mainGateways.map(g=>g.title),['المتجر','المصنع','المندوب','النتيجة','المالك'],'the owner has the fifth entrance requested for supervision');
assert.deepEqual(gateways.map(g=>g.id),['store','factory','rep','result','owner','system']);
assert.equal(stageCount,4);
assert.equal(new Set(ownedPages).size,ownedPages.length,'no page has two owners');
assert.deepEqual([...ownedPages].sort(),workshopPageMatches('').sort(),'every page of the workshop is owned, and every owned page exists');
const owned=id=>gateways.find(g=>g.id===id).groups.flatMap(g=>[g.main,...g.tools,...g.technical]).concat(gateways.find(g=>g.id===id).extras||[]);
assert.deepEqual(owned('store').sort(),['inventory','libraries','store','team'],'the store: its items and prices, its libraries, the team catalog, its stock');
assert.deepEqual(owned('factory').sort(),['assembly','corner','machines','production','recipes','surface','template','tracking','logistics','maintenance'].sort(),'the factory: recipes, production, delivery and unit after-sales service');
assert.deepEqual(owned('result').sort(),['quote'],'the result presents the take-off and price');
assert.deepEqual(owned('owner').sort(),['approve','oversight','sale','sign'],'pricing and final approvals belong to the owner');
assert.equal(pageOwner('oversight').group.title,'إدارة المشاريع والإشراف');
assert(['survey','outline','photo','intake','uses','wallOptions','whole','row','finish','guide','zones','measure'].every(k=>owned('rep').includes(k)),'the rep: what he measures, what the customer asks, and the design');
assert.deepEqual(owned('system'),['sync']);
const stages=gateways.flatMap(g=>g.groups).filter(g=>g.stage);
assert.deepEqual(stages.map(g=>g.stage).sort(),[1,2,3,4],'the four stages of a visit keep their numbers, across gateways');
assert.deepEqual(stages.sort((a,b)=>a.stage-b.stage).map(g=>g.main),['survey','whole','finish','quote']);
assert.equal(pageOwner('quote').gateway.id,'result','the last stage of the visit belongs to the result');
for(const g of gateways)for(const group of g.groups)for(const link of group.links||[])assert.notEqual(pageOwner(link).gateway,g,'a link points at another gateway: '+link);
assert.equal(pageOwner('guide').group.title,'متابعة المشروع');assert.equal(pageOwner('home'),null);assert.equal(pageOwner('factory'),null);

// ---------- the twelve sections of the old catalog page, each in its trade ----------
const sections=['items','importItems','recipes','cornerRecipes','unitBases','trims','lighting','wallKits','special','machines','sale','transfer'];
assert.deepEqual(sections.map(factoryPageOf),['store','store','recipes','recipes','recipes','recipes','recipes','recipes','recipes','machines','sale','template']);
assert.deepEqual(Object.values(factoryPages).flatMap(p=>p.groups.flatMap(([,s])=>s)).sort(),[...sections].sort(),'each section is on exactly one page');
assert.deepEqual(factorySections('sale'),['sale']);assert.equal(factorySections('nonsense'),null);assert.equal(factoryPageOf('nonsense'),'store');

// ---------- the home ----------
const doc=newSurveyProject({widthMm:4000,lengthMm:3600,heightMm:2800,name:'مشروع <img src=x onerror=alert(1)>'},globalThis.localStorage);
assert.match(gatewayFacts('store',doc)[0],/١٠ صنفًا في كتالوج المشروع · ٠ منها مسعّر/);
assert.match(gatewayFacts('store',doc)[1],/٠ سجلًا خاصًا · ٦٧ مثالًا عامًا ظاهرًا/);
assert.deepEqual(gatewayFacts('factory',doc),['٥ وصفة في الإصدار ١','الوصفات تنتظر اعتماد المصنع']);
assert.deepEqual(gatewayFacts('rep',doc),['الجدران المرفوعة: ٠ من ٤','وحدات التصميم: ٠ · أجهزة العميل: ٠']);
assert.deepEqual(gatewayFacts('result',doc),['شروط البيع المحسومة: ٠ من ٥','موافقة العميل لم تُسجَّل بعد']);
assert.deepEqual(gatewayFacts('system',doc),[]);
assert.deepEqual(gatewayLinks(gateways[2]),['survey','whole','finish','guide'],'the rep has many pages: his card shows his stages and the guide');
assert.deepEqual(gatewayLinks(gateways[0]),['store','libraries','team','inventory'],'the store shows everything it owns');
let html=gatewaysHTML({doc,question:''});
assert(html.includes('data-step="oversight">إدارة المشاريع والإشراف</button>'),'the gateway entry uses the management workspace title');
for(const [id,entry] of [['store','store'],['factory','recipes'],['rep','survey'],['result','quote'],['owner','oversight']]){
 assert(html.includes('<article class="gw-card" data-gateway="'+id+'">'),id+' has its card');
 assert(html.includes('class="gw-enter" data-step="'+entry+'"'),id+' opens on its main page');
}
assert.equal((html.match(/<article class="gw-card"/g)||[]).length,5,'five doors for the owner');
assert(html.includes('ما لديه من خامات ومواد وإكسسوارات، وبكم')&&html.includes('القص والبناء والتفصيل والإنتاج')&&html.includes('ما يرفعه من الموقع وما يطلبه العميل')&&html.includes('التكلفة والتسعير'),'each card says what it is in the words of the shop');
assert(html.includes('data-step="sync"'),'the system tools sit under the doors');
assert(!html.includes('<img src=x'),'the project name is text, never markup');assert(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
assert(html.includes('data-gw-resume hidden'),'with nothing waiting, the rep\'s resume line stays out of the way');
html=gatewaysHTML({doc,question:'ما عرض الباب <b>الأول</b>؟'});
assert(html.includes('data-gw-resume>')&&!html.includes('data-gw-resume hidden')&&html.includes('ما عرض الباب &lt;b&gt;الأول&lt;/b&gt;؟')&&html.includes('data-step="guide">متابعة المشروع'));
for(const role of ['store','factory','rep']){
 const scoped=gatewaysHTML({doc,role});
 assert.deepEqual([...scoped.matchAll(/<article class="gw-card" data-gateway="([^"]+)"/g)].map(m=>m[1]),[role]);
 assert(!scoped.includes('data-step="sale"')&&!scoped.includes('data-step="oversight"'));
 assert(scoped.includes('data-step="sync"')&&scoped.includes('data-step="quote"'));
}
assert(!gatewaysHTML({doc,role:null,accessStatus:'unavailable'}).includes('<article class="gw-card"'));

// the page: draws for the guide's state, follows it, and goes where a button says
const host=new View();let went=[];const listeners=new Set;
const guide={read:()=>({status:'loading'}),subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);}};
const stop=mountGateways(host,{getDoc:()=>doc,guide,onAdvance:step=>went.push(step)});
assert(host.innerHTML.includes('data-gw-resume hidden'));
for(const fn of listeners)fn({status:'ready',report:{current:{step:'survey',question:'ما سماكة الجدار؟'}}});
assert(host.innerHTML.includes('ما سماكة الجدار؟')&&!host.innerHTML.includes('data-gw-resume hidden'),'it follows the guide as the question arrives');
host.handlers.get('click')({target:{closest:()=>({dataset:{step:'recipes'}})}});host.handlers.get('click')({target:{closest:()=>null}});
assert.deepEqual(went,['recipes'],'a button goes to its page, a tap elsewhere goes nowhere');
stop();assert.equal(listeners.size,0,'leaving the page stops listening to the guide');

// ---------- the catalog page shows only the trade it is opened for ----------
// The editors below a page (recipes, bases, machines) need a real DOM and are checked where they live; the page itself is drawn before them.
const open=(page,focus={})=>{
 const h=new View();
 try{mountFactoryStep(h,{getDoc:()=>doc,tell(){},onAdvance:s=>h.went=s,apply:()=>assert.fail('looking at a page wrote a change'),focus,page});}catch(e){if(!(e instanceof TypeError))throw e;}
 h.html=h.children[0].innerHTML;h.box=h.children[0];return h;
};
const tabsOf=h=>[...h.html.matchAll(/data-tab="(\w+)"/g)].map(m=>m[1]);
let page=open('store');
assert(page.html.includes('<h3>الأصناف والأسعار</h3>')&&page.html.includes('data-sku-results'),'the store page opens on the items');
assert.deepEqual([...new Set(tabsOf(page))].sort(),['importItems','items'],'and offers only the import next to them');
assert(!page.html.includes('وصفات اعتمدها المصنع')&&!page.html.includes('وصفات توضيحية'),'the approval of the factory\'s recipes is not the store\'s business');
assert(page.html.includes('العودة إلى دليل المشروع'));page.box.onclick({target:{closest:()=>({dataset:{factoryAct:'next'}})}});assert.equal(page.went,'guide','it goes back to the guide, not to row filling');
page=open('store',{tab:'sale'});assert(page.html.includes('data-sku-results')&&!page.html.includes('data-edit="sale"'),'a section of another trade falls back to the first of this page');
page=open('recipes');
assert(page.html.includes('<h3>وصفات التفصيل والبناء</h3>')&&page.html.includes('data-edit="family"'));
assert.deepEqual([...new Set(tabsOf(page))].sort(),['cornerRecipes','lighting','recipes','special','trims','unitBases','wallKits'].sort(),'the factory page offers the recipes and the details of building');
assert(page.html.includes('وصفات توضيحية')||page.html.includes('وصفات اعتمدها المصنع'),'it says whether the factory approved them');
assert(page.html.includes('العودة إلى تعبئة الصف'));
page=open('recipes',{tab:'unitBases'});assert(page.html.includes('data-unit-base-editor'),'a section of the page can be opened directly');
page=open('machines');
assert(page.html.includes('data-machine-editor')&&!page.html.includes('data-tab=')&&!page.html.includes('قسم الكتالوج'),'a page with one section has no tabs to choose from');
page=open('sale');
assert(page.html.includes('data-edit="sale"')&&page.html.includes('حفظ شروط العرض')&&!page.html.includes('data-edit="item"')&&!page.html.includes('وصفات توضيحية'),'the terms of sale stand alone');
assert(page.html.includes('الذهاب إلى الحصر والسعر'));page.box.onclick({target:{closest:()=>({dataset:{factoryAct:'next'}})}});assert.equal(page.went,'quote');
page=open('template');
assert(page.html.includes('data-edit="approve"')&&page.html.includes('حفظ كتالوج الجهاز')&&page.html.includes('data-edit="name"'),'the approval and the device catalog are one page');
page=open(null);
assert(page.html.includes('<h3>كتالوج المصنع</h3>')&&sections.every(s=>page.html.includes('data-tab="'+s+'"')),'called without a page it is the whole catalog as before');
page=open('nonsense');assert(page.html.includes('<h3>كتالوج المصنع</h3>'),'an unknown page name is the whole catalog, never an empty screen');

console.log('PASS: five work gateways with scoped home cards, owner pricing/approvals, four visit stages, guide updates and trade-specific catalog pages.');

import assert from 'node:assert/strict';
import {renderWorkshopPicker,workshopGuideQuestion,workshopPageMatches,workshopRoute} from '../public/kitchen-workshop-ui.js';
import {gateways,ownedPages,pageOwner} from '../public/kitchen-gateways.js';

// Existing bookmarks, action links and supplier tools must still have one accessible destination when the regular toolbar is collapsed.
// The picker groups the pages by the gateway of the real work that owns them; a page another gateway reaches for appears again as a link.
const routes=[...ownedPages].sort();
assert.equal(routes.length,38,'the existing 36 pages plus production review and maintenance');
assert.equal(pageOwner('production').gateway.id,'factory','production review belongs to the factory gateway');
assert.equal(pageOwner('maintenance').gateway.id,'factory','after-sales maintenance belongs to the factory gateway');
const linked=gateways.flatMap(g=>g.groups.flatMap(group=>group.links||[]));
for(const active of [...routes,'home']){
 const nav=renderWorkshopPicker(active);
 const buttons=[...nav.matchAll(/<button[^>]*data-step="([^"]+)"[^>]*>/g)].map(m=>({key:m[1],link:m[0].includes('data-link="true"'),current:m[0].includes('aria-current="page"')}));
 assert.deepEqual(buttons.filter(b=>!b.link&&b.key!=='home').map(b=>b.key).sort(),routes,'every page has one destination under its own gateway');
 assert.deepEqual(buttons.filter(b=>b.link).map(b=>b.key).sort(),[...linked].sort(),'and the pages another gateway reaches for are extra links');
 assert.deepEqual([...new Set(buttons.filter(b=>b.current).map(b=>b.key))],[active],'the current page is marked wherever it appears');
 assert.equal((nav.match(/<details class="ws-gateway"/g)||[]).length,gateways.length,'five gateways: the four of the work and the system');
 assert.equal((nav.match(/class="ws-stage-destination"/g)||[]).length,gateways.flatMap(g=>g.groups).length);
 assert.equal((nav.match(/class="ws-stage-number"/g)||[]).length,4,'the four stages of a visit keep their numbers');
 const open=[...nav.matchAll(/<details class="ws-gateway" data-gateway="(\w+)"[^>]*? open/g)].map(m=>m[1]);
 assert.deepEqual(open,active==='home'?[]:[pageOwner(active).gateway.id],'only the gateway of the current page is open');
 const inGroup=active!=='home'&&active!=='guide';
 assert.equal((nav.match(/class="ws-current-stage"/g)||[]).length,Number(inGroup),'one group says it is the current one');
 for(const summary of nav.matchAll(/<summary aria-label="أدوات [^>]+>(.*?)<\/summary>/g))assert.match(summary[1],/<span>الأدوات<\/span>/);
 const technical=['zones','profile','surfaces3d','measure','routes','appliances','tap'].includes(active);
 assert.equal(nav.includes('<details class="ws-route-technical" open>'),technical);
 assert(nav.includes('بوابات العمل'));
}
assert.deepEqual(linked.sort(),['approve','assembly','corner'],'the design stage reaches for two pages of the factory and one of the result');
assert(renderWorkshopPicker('whole').includes('<small class="ws-from">المصنع</small>')&&renderWorkshopPicker('whole').includes('<small class="ws-from">المالك</small>'),'a link says which gateway the page belongs to');
console.log('Five work gateways plus system; all 38 pages retained exactly once under their owner, three cross-links, four numbered stages; current page, gateway and technical disclosure verified.');

const stone={id:'design.upstand.back',step:'assembly',stage:'design',actor:'customer',focus:{section:'stone',wall:'back'},question:'هل يريد العميل نعلة رخام عند الجدار الخلفي؟'};
const finish={step:'finish',stage:'finish',focus:{},question:'هل تناسب العميل تشطيبات الوحدات الحالية؟'};
assert.equal(workshopGuideQuestion('survey',stone),'','a customer finish decision must not displace the field survey');
assert.equal(workshopGuideQuestion('assembly',stone),'','a wall-specific decision stays in its own editor and the project guide');
assert.equal(workshopGuideQuestion('finish',finish),finish.question,'a question about the current editor as a whole can be shown');
assert.equal(workshopGuideQuestion('whole',finish),'','leaving the finishes page must remove its question');
assert.equal(workshopGuideQuestion('survey',{step:'survey',focus:{wall:'back'},question:'أي قياس يحتاج تصحيحًا على الجدار الخلفي؟'}),'','the wall drawing owns its active draft and selected reading');

assert.deepEqual(workshopPageMatches('أَرُز'),['uses']);
assert(workshopPageMatches('المخزون').includes('inventory'));
assert(workshopPageMatches('إدارة المشاريع').includes('oversight'),'project management is discoverable by its actual workspace name');
assert(renderWorkshopPicker('oversight').includes('إدارة المشاريع والإشراف'));
assert.deepEqual(workshopPageMatches('درج الأرز'),['uses']);
assert(workshopPageMatches('تكلفه').includes('quote'));
assert(workshopPageMatches('رفع الموقع').includes('profile'));
assert.deepEqual(workshopPageMatches('no-such-page'),[]);
assert.deepEqual(workshopPageMatches('').sort(),routes,'the old catalog page and the home are ways in, not pages to list');
// searching by the name of a gateway finds its pages
assert(['store','libraries','team','inventory'].every(k=>workshopPageMatches('المتجر').includes(k)));
assert(['recipes','machines','tracking','template'].every(k=>workshopPageMatches('المصنع').includes(k)));
assert(workshopPageMatches('مفصلات').includes('libraries')&&workshopPageMatches('أحواض').includes('libraries'));
assert(workshopPageMatches('هامش').includes('sale')&&workshopPageMatches('قص').includes('machines'));
for(const role of ['store','factory','rep']){
 const pages=workshopPageMatches('',role);
 for(const denied of ['sale','approve','sign','oversight'])assert(!pages.includes(denied));
 const nav=renderWorkshopPicker(role==='store'?'store':role==='factory'?'recipes':'survey',role);
 assert(!nav.includes('data-step="oversight"')&&!nav.includes('data-step="sale"'));
 assert(nav.includes('data-gateway="'+role+'"'));
}

// The old single catalog page lands on the page of the section it was asked for.
assert.equal(workshopRoute('factory'),'store');
assert.equal(workshopRoute('factory',{tab:'items',sku:'AL-20'}),'store');
assert.equal(workshopRoute('factory',{tab:'importItems'}),'store');
assert.equal(workshopRoute('factory',{tab:'recipes',family:'storage',line:2}),'recipes');
assert.equal(workshopRoute('factory',{tab:'special',targetId:'x'}),'recipes');
assert.equal(workshopRoute('factory',{tab:'unitBases'}),'recipes');
assert.equal(workshopRoute('factory',{tab:'machines'}),'machines');
assert.equal(workshopRoute('factory',{tab:'sale',field:'labor'}),'sale');
assert.equal(workshopRoute('factory',{tab:'transfer'}),'template');
assert.equal(workshopRoute('catalog',{tab:'sale'}),'sale','an old name and a section');
assert.equal(workshopRoute('factory',{tab:'nonsense'}),'store');
assert.equal(workshopRoute('cost'),'quote');assert.equal(workshopRoute('customer'),'sign');assert.equal(workshopRoute('nonsense'),'survey');
for(const page of [...routes,'home'])assert.equal(workshopRoute(page),page,page+' is its own destination');
console.log('Searching by a gateway name, by a material or by a term finds its pages; the old catalog page and every old name still arrive somewhere.');

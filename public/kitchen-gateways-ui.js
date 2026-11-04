// The home of the workshop: the four gateways of the real work, each with a line on what it is, a few facts about the open project, and the
// pages it owns. Above them, the question the project guide is waiting on, so coming back to a visit is one tap.
import {studioIcon as icon} from './kitchen-tool-icons.js';
import {mainGateways,gateways,pageOwner,guideTitle} from './kitchen-gateways.js';
import {getFactoryCatalog} from './kitchen-workshop-factory.js';
import {surveyedDesignWalls} from './kitchen-chain-model.js';
import {roomArchitecture} from './kitchen-architecture.js';
import {libraries} from './kitchen-library-store.js';
import {libraryIds} from './kitchen-library-defs.js';
import {catalogRecordStates} from './kitchen-catalog-records.js';
import {getProjectAccess} from './kitchen-project-access.js';
import {visibleGatewayIds,canOpenWorkshopPage,roleLabels} from './kitchen-role-pages.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>new Intl.NumberFormat('ar-SA').format(n);
const titles={store:'الأصناف والأسعار',libraries:'مكتبات المتجر',team:'كتالوج الفريق',inventory:'رصيد المخزون',recipes:'وصفات التفصيل والبناء',assembly:'قواعد الدواليب ونعلة الرخام',corner:'تفصيل الزوايا',surface:'قالب السطح',machines:'القص والماكينات',tracking:'متابعة الورشة والاستلام',logistics:'تجهيز الموقع والتوريد',template:'الاعتماد وكتالوج الجهاز',survey:'رفع الجدار',whole:'تصميم المطبخ',finish:'الخامات والعتاد',guide:'دليل المشروع',quote:'الحصر والسعر',sale:'شروط البيع والتسعير',approve:'تثبيت الهيكل',sign:'الاعتماد',sync:'مشاريع الفريق'};
const saleTerms=['labor','installation','delivery','marginPct','taxPct'];
titles.oversight='إدارة المشاريع والإشراف';
titles.maintenance='الصيانة وما بعد البيع';

// A few facts the person at this gateway wants before opening it. All from the open project and this device; nothing is computed that costs a wait.
export function gatewayFacts(id,doc){
 const w=doc.room.workshop||{},cat=getFactoryCatalog(doc);
 if(id==='store'){
  const priced=cat.items.filter(i=>Number.isFinite(i.price)).length,own=libraryIds.reduce((n,l)=>n+libraries.counts(l).own,0),examples=libraryIds.reduce((n,l)=>n+libraries.counts(l).generic,0);
  return [num(cat.items.length)+' صنفًا في كتالوج المشروع · '+num(priced)+' منها مسعّر','المكتبات: '+num(own)+' سجلًا خاصًا · '+num(examples)+' مثالًا عامًا ظاهرًا'];
 }
 if(id==='factory')return [num(Object.keys(cat.families).length)+' وصفة في الإصدار '+num(cat.revision),cat.approved?'الوصفات معتمدة من المصنع':'الوصفات تنتظر اعتماد المصنع'];
 if(id==='rep'){
  const walls=roomArchitecture(doc.room).walls.length;
  return ['الجدران المرفوعة: '+num(surveyedDesignWalls(doc).length)+' من '+num(walls),'وحدات التصميم: '+num(doc.kitchen.units.length)+' · أجهزة العميل: '+num(w.applianceIntake?.length||0)];
 }
 if(id==='result'){
  const decided=saleTerms.filter(k=>Number.isFinite(cat.terms[k])).length;
  return ['شروط البيع المحسومة: '+num(decided)+' من '+num(saleTerms.length),w.approvals?.customer?'موافقة العميل مسجّلة · الإصدار '+num(w.versions?.length||1):'موافقة العميل لم تُسجَّل بعد'];
 }
 if(id==='owner'){
  const states=catalogRecordStates(w),approved=states?Object.values(states).filter(s=>s.approved).length:0;
  return ['السجلات المعتمدة: '+num(approved)+' من ٣','مراحل المشروع والعوائق والتسعير والموافقات'];
 }
 return [];
}
// The pages shown on a gateway's card. The rep has many pages, so his card shows the stages and the guide; the others show everything.
export function gatewayLinks(g){
 const mains=g.groups.map(group=>group.main);
 const rest=g.id==='rep'?[]:g.groups.flatMap(group=>group.tools);
 return [...mains,...rest,...(g.extras||[])];
}
const entry={store:'store',factory:'recipes',rep:'survey',result:'quote',owner:'oversight'};

export function gatewaysHTML({doc,question='',role='owner',accessStatus='ready'}){
 const visible=visibleGatewayIds(role);
 const card=g=>{
  const links=gatewayLinks(g);
  return '<article class="gw-card" data-gateway="'+g.id+'"><h3>'+icon(g.icon)+'<span>'+esc(g.title)+'</span></h3><p class="gw-lead">'+esc(g.lead)+'</p>'+
   '<ul class="gw-facts">'+gatewayFacts(g.id,doc).map(f=>'<li>'+esc(f)+'</li>').join('')+'</ul>'+
   '<div class="gw-links">'+links.map(key=>'<button type="button" data-step="'+key+'">'+esc(key==='guide'?guideTitle:titles[key]||key)+'</button>').join('')+'</div>'+
   '<button type="button" class="gw-enter" data-step="'+entry[g.id]+'">فتح بوابة '+esc(g.title)+'</button></article>';
 };
 const system=gateways.filter(g=>g.minor).map(g=>'<section class="gw-system"><span>'+esc(g.title)+' · '+esc(g.lead)+'</span>'+g.groups.map(group=>'<button type="button" data-step="'+group.main+'">'+esc(titles[group.main])+'</button>').join('')+'</section>').join('');
 return '<section class="gw-home"><header class="gw-head"><h2>بوابات العمل</h2><p>لكل عمل حقيقي بوابته: المتجر يملك الأصناف والأسعار، والمصنع يملك التفصيل والإنتاج، والمندوب يملك ما في الموقع وما يطلبه العميل، والنتيجة هي التكلفة والتسعير.</p></header>'+
  '<p class="gw-project">المشروع المفتوح · <b>'+esc(doc.room.name||'مطبخي')+'</b> · '+esc(roleLabels[role]||'بانتظار التحقق من الصلاحية')+'</p>'+
  (!role?'<p role="status">'+(accessStatus==='denied'?'لم يعد لهذا الحساب وصول إلى المشروع.':'تعديل المشروع متوقف حتى التحقق من صلاحيتك. افتح مشاريع الفريق لإعادة الاتصال.')+'</p>':'')+
  '<div class="gw-resume" data-gw-resume'+(question?'':' hidden')+'><div><small>المطلوب الآن في المشروع</small><b>'+esc(question)+'</b></div><button type="button" data-step="guide">متابعة المشروع</button></div>'+
  '<div class="gw-grid">'+mainGateways.filter(g=>visible.includes(g.id)).map(card).join('')+'</div>'+
  (['store','factory','rep'].includes(role)?'<section class="gw-system"><span>نتيجة المشروع المشتركة</span><button type="button" data-step="quote">عرض الحصر والسعر</button></section>':'')+system+'</section>';
}

// Mounted as a page of the workshop. `guide` is the session that knows the project's next question.
export function mountGateways(host,{getDoc,guide,onAdvance}){
 const ac=new AbortController();
 const draw=state=>{
  const task=state?.status==='ready'?state.report?.current:null;
  const doc=getDoc(),access=getProjectAccess(doc);
  host.innerHTML=gatewaysHTML({doc,role:access.role,accessStatus:access.status,question:task&&canOpenWorkshopPage(access.role,task.step)?task.question:''});
 };
 draw(guide?.read?.());
 const unsubscribe=guide?.subscribe?.(state=>{if(host.isConnected)draw(state);});
 host.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-step]');if(b)onAdvance?.(b.dataset.step);
 },{signal:ac.signal});
 return ()=>{ac.abort();unsubscribe?.();};
}
export const gatewayOf=route=>pageOwner(route)?.gateway||null;

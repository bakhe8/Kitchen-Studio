// The work of the shop, by who does it and not by how it is built. Five gateways: the store (what it holds and for how much), the factory
// (cutting, building, tailoring, producing), the rep (what he measures and what the customer asks) and the result (cost and price).
// Every page of the workshop belongs to exactly one gateway; a group may also point at pages of another gateway it needs (`links`).
// A group with a `stage` is one of the four stages of a customer's visit, so the journey keeps its numbers across gateways.
export const stageCount=4;
export const gateways=Object.freeze([
 {id:'store',title:'المتجر',lead:'ما لديه من خامات ومواد وإكسسوارات، وبكم',icon:'library',
  groups:[{title:'الأصناف والأسعار',main:'store',tools:['libraries','team','inventory'],technical:[]}]},
 {id:'factory',title:'المصنع',lead:'القص والبناء والتفصيل والإنتاج',icon:'factory',
  groups:[
   {title:'التفصيل والبناء',main:'recipes',tools:['assembly','corner','surface'],technical:[]},
   {title:'القص والإنتاج',main:'production',tools:['machines'],technical:[]},
   {title:'التركيب والتسليم',main:'tracking',tools:['logistics'],technical:[]},
   {title:'الصيانة وما بعد البيع',main:'maintenance',tools:[],technical:[]},
   {title:'الاعتماد وكتالوج الجهاز',main:'template',tools:[],technical:[]}]},
 {id:'rep',title:'المندوب',lead:'ما يرفعه من الموقع وما يطلبه العميل',icon:'ruler',extras:['guide'],
  groups:[
   {title:'رفع الموقع',stage:1,main:'survey',tools:['decisions','intake','outline','photo'],technical:['zones','profile','surfaces3d','measure','routes']},
   {title:'التصميم',stage:2,main:'whole',tools:['row','uses','wallOptions'],technical:['appliances','tap'],links:['assembly','corner','approve']},
   {title:'التشطيب',stage:3,main:'finish',tools:[],technical:[]}]},
 {id:'result',title:'النتيجة',lead:'التكلفة والتسعير',icon:'quote',
  groups:[{title:'التكلفة والتسعير',stage:4,main:'quote',tools:[],technical:[]}]},
 {id:'owner',title:'المالك',lead:'الإشراف والتسعير والموافقات',icon:'check',
  groups:[{title:'إدارة المشاريع والإشراف',main:'oversight',tools:['sale','approve','sign'],technical:[]}]},
 {id:'system',title:'النظام',lead:'نسخ المشاريع بين الأجهزة',icon:'file',minor:true,
  groups:[{title:'مشاريع الفريق',main:'sync',tools:[],technical:[]}]}
]);
export const guideTitle='متابعة المشروع';
const pagesOf=group=>[group.main,...group.tools,...group.technical];
// Every page, once, under the gateway that owns it.
export const ownedPages=Object.freeze(gateways.flatMap(g=>[...g.groups.flatMap(pagesOf),...(g.extras||[])]));
const owners=new Map(gateways.flatMap(g=>[...g.groups.flatMap(group=>pagesOf(group).map(page=>[page,{gateway:g,group}])),...(g.extras||[]).map(page=>[page,{gateway:g,group:{title:guideTitle,tools:[],technical:[]}}])]));
export const pageOwner=route=>owners.get(route)||null;
export const mainGateways=Object.freeze(gateways.filter(g=>!g.minor));

// The catalog page of the factory used to hold twelve sections of three different trades. Each section now belongs to the page of the
// trade that owns it. Store, factory and pricing now have independent persisted records and approvals.
export const factoryPages=Object.freeze({
 store:{title:'الأصناف والأسعار',groups:[['الأصناف',['items','importItems']]],state:false,back:{step:'guide',label:'العودة إلى دليل المشروع'}},
 recipes:{title:'وصفات التفصيل والبناء',groups:[['الوصفات',['recipes','cornerRecipes','special']],['تفاصيل التجهيز',['unitBases','trims','lighting','wallKits']]],state:true},
 machines:{title:'القص والماكينات',groups:[['التشغيل',['machines']]],state:true},
 sale:{title:'شروط البيع والتسعير',groups:[['البيع',['sale']]],state:false,back:{step:'quote',label:'الذهاب إلى الحصر والسعر'}},
 template:{title:'الاعتماد وكتالوج الجهاز',groups:[['الاعتماد',['transfer']]],state:true}
});
const pageOfSection=new Map(Object.entries(factoryPages).flatMap(([page,def])=>def.groups.flatMap(([,sections])=>sections.map(section=>[section,page]))));
// The old single page took a section name as its focus (guide questions, links in the quote); it now lands on the page of that section.
export const factoryPageOf=section=>pageOfSection.get(section)||'store';
export const factorySections=page=>factoryPages[page]?factoryPages[page].groups.flatMap(([,sections])=>sections):null;

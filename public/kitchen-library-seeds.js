// What ships with the program. Two kinds of record: «من البرنامج» (the finishes and the supplier frames the drawing already uses) and
// «مثال عام» (typical sizes of common appliances, sinks and hardware so the libraries are not empty). A generic example is a starting
// point, never a product: it carries no brand, model or price, and the factory replaces or hides it with the real models.
import {kitchenFrontFinishes,kitchenWorktopFinishes,kitchenMaterialFamilies} from './kitchen-materials.js';
import {supplierFrames} from './kitchen-supplier.js';

const generic={source:'generic',status:'draft',price:null,hidden:false,note:'مقاسات تقريبية لفئة شائعة. استبدلها ببيانات الموديل الفعلي من دليل الشركة المصنّعة.'};
const rec=(library,id,family,label,attrs,over={})=>Object.freeze({library,id,family,label,attrs:Object.freeze(attrs),...generic,...over});

// body [w,h,d], space [w,h,d] (the bay the appliance needs, clearance included), cut [w,h,d] (the opening cut in the cabinet or worktop)
const app=(id,family,label,body,space,cut)=>rec('appliance','gen-'+id,family,label,{
 bodyWidthMm:body[0],bodyHeightMm:body[1],bodyDepthMm:body[2],spaceWidthMm:space[0],spaceHeightMm:space[1],spaceDepthMm:space[2],
 ...(cut?Object.fromEntries([['cutoutWidthMm',cut[0]],['cutoutHeightMm',cut[1]],['cutoutDepthMm',cut[2]]].filter(([,v])=>v)):{})});
const appliances=[
 app('fridge-top-60','fridge','ثلاجة بابين علوية التجميد ٦٠ سم',[600,1700,650],[640,1720,700]),
 app('fridge-bottom-60','fridge','ثلاجة سفلية التجميد ٦٠ سم',[600,1850,650],[640,1870,700]),
 app('fridge-wide-70','fridge','ثلاجة عريضة ٧٠ سم',[700,1800,700],[740,1820,750]),
 app('fridge-sbs-90','fridge','ثلاجة جنبًا إلى جنب ٩٠ سم',[910,1780,720],[950,1800,770]),
 app('fridge-french-90','fridge','ثلاجة بأبواب فرنسية ٩٠ سم',[900,1800,750],[940,1820,800]),
 app('fridge-built-in-55','fridge','ثلاجة مدمجة ٥٥ سم',[540,1770,545],[560,1780,550]),
 app('fridge-under-60','fridge','ثلاجة تحت السطح ٦٠ سم',[595,815,575],[600,820,580]),
 app('freezer-upright-60','freezer','مجمّد رأسي ٦٠ سم',[600,1850,650],[640,1870,700]),
 app('freezer-built-in-55','freezer','مجمّد رأسي مدمج ٥٥ سم',[540,1770,545],[560,1780,550]),
 app('oven-60','oven','فرن مدمج ٦٠ سم',[595,595,550],[600,600,560],[560,585,0]),
 app('microwave-60','microwave','مايكروويف مدمج ٦٠ سم',[595,385,320],[600,390,550],[560,380,0]),
 app('dishwasher-60','dishwasher','غسالة صحون مدمجة ٦٠ سم',[598,815,550],[600,820,580]),
 app('dishwasher-45','dishwasher','غسالة صحون مدمجة ضيقة ٤٥ سم',[448,815,550],[450,820,580]),
 app('dishwasher-free-60','dishwasher','غسالة صحون حرة ٦٠ سم',[600,850,600],[640,870,650]),
 app('hob-gas-60','hob','موقد غاز ٦٠ سم',[590,55,520],[600,60,540],[560,0,490]),
 app('hob-gas-75','hob','موقد غاز ٧٥ سم',[750,55,520],[760,60,540],[700,0,490]),
 app('hob-gas-90','hob','موقد غاز ٩٠ سم',[900,55,520],[910,60,540],[860,0,490]),
 app('hob-induction-60','hob','موقد كهربائي أو حثّي ٦٠ سم',[590,55,520],[600,60,540],[560,0,490]),
 app('hob-induction-80','hob','موقد حثّي ٨٠ سم',[780,55,520],[790,60,540],[750,0,490]),
 app('hood-wall-60','hood','شفاط جداري ٦٠ سم',[600,650,480],[600,700,500]),
 app('hood-wall-90','hood','شفاط جداري ٩٠ سم',[900,650,500],[900,700,520]),
 app('hood-slim-60','hood','شفاط مدمج تحت الخزانة ٦٠ سم',[600,150,300],[600,160,320]),
 app('washer-front-60','washer','غسالة ملابس أمامية ٦٠ سم',[600,850,600],[640,870,650]),
 app('washer-under-60','washer','غسالة ملابس تحت السطح ٦٠ سم',[595,820,575],[600,820,600]),
 app('dryer-60','dryer','نشّافة ملابس ٦٠ سم',[600,850,650],[640,870,700])
];

const sinkOf=(id,family,label,bowls,mount,size,cut,minUnit,drainer='none')=>rec('sink','gen-'+id,family,label,{
 bowls,mount,widthMm:size[0],depthMm:size[1],cutoutWidthMm:cut[0],cutoutDepthMm:cut[1],minUnitWidthMm:minUnit,drainer});
const sinks=[
 sinkOf('steel-single-60','stainless','حوض فولاذ مفرد ٦٠ سم',1,'top',[600,500],[560,460],600),
 sinkOf('steel-single-drainer-100','stainless','حوض فولاذ مفرد بمجفف ١٠٠ سم',1,'top',[1000,500],[960,460],1000,'left'),
 sinkOf('steel-double-86','stainless','حوض فولاذ مزدوج ٨٦ سم',2,'top',[860,500],[820,460],900),
 sinkOf('steel-one-half-90','stainless','حوض فولاذ ونصف ٩٠ سم',2,'top',[900,500],[860,460],900),
 sinkOf('steel-double-drainer-116','stainless','حوض فولاذ مزدوج بمجفف ١١٦ سم',2,'top',[1160,500],[1120,460],1200,'right'),
 sinkOf('steel-under-60','stainless','حوض فولاذ مفرد تحت السطح ٦٠ سم',1,'under',[600,450],[560,410],600),
 sinkOf('composite-single-80','composite','حوض جرانيت مركّب مفرد ٨٠ سم',1,'top',[800,500],[760,460],800),
 sinkOf('composite-double-120','composite','حوض جرانيت مركّب مزدوج ١٢٠ سم',2,'top',[1200,500],[1160,460],1200),
 sinkOf('ceramic-apron-80','ceramic','حوض سيراميك بواجهة ظاهرة ٨٠ سم',1,'top',[800,500],[760,460],800)
];

const part=(id,family,label,unit,spec,extra={})=>rec('hardware','gen-'+id,family,label,{unit,...(spec?{spec}:{}),...extra});
const hardware=[
 part('hinge-110','hinge','مفصلة ١١٠° بإغلاق هادئ','piece','باب مغطّى · فتح ١١٠°'),
 part('hinge-165','hinge','مفصلة واسعة الفتح ١٦٥° بإغلاق هادئ','piece','لأبواب الأدراج والزوايا'),
 part('hinge-glass','hinge','مفصلة لباب زجاجي','piece','إطار ألمنيوم أو زجاج'),
 part('hinge-bifold','hinge','مفصلة باب مطوي للزاوية','set','باب زاوية بضلفتين'),
 part('slide-35','slide','سكة درج كاملة الفتح ٣٥ سم بإغلاق هادئ','set','طقم يمين ويسار',{lengthMm:350,loadKg:25}),
 part('slide-45','slide','سكة درج كاملة الفتح ٤٥ سم بإغلاق هادئ','set','طقم يمين ويسار',{lengthMm:450,loadKg:30}),
 part('slide-50','slide','سكة درج كاملة الفتح ٥٠ سم بإغلاق هادئ','set','طقم يمين ويسار',{lengthMm:500,loadKg:30}),
 part('slide-heavy-50','slide','سكة درج ثقيلة ٥٠ سم','set','لأدراج القدور والمؤن',{lengthMm:500,loadKg:60}),
 part('slide-under-50','slide','سكة درج مخفية تحت القاع ٥٠ سم','set','طقم مخفي',{lengthMm:500,loadKg:30}),
 part('lift-strut','lift','ذراع رفع غازي للباب العلوي','set','ذراع مع قاعدة تثبيت'),
 part('lift-bifold','lift','مفصلة رفع للباب القابل للطي','set','لباب علوي بضلفتين'),
 part('push-open','lift','فتح بالضغط للأبواب بلا مقبض','piece','قطعة مع لوحة التثبيت'),
 part('leg-100','leg','رجل قاعدة قابلة للضبط ١٠ سم','piece','ضبط ± ٢٠ مم',{lengthMm:100}),
 part('leg-150','leg','رجل قاعدة قابلة للضبط ١٥ سم','piece','ضبط ± ٢٠ مم',{lengthMm:150}),
 part('plinth-clip','leg','مشبك لوح القاعدة','piece','مشبك للرجل'),
 part('hanger-upper','leg','طقم تعليق خزانة علوية','set','حامل مع مسمار ضبط'),
 part('basket-30','basket','سلة سحب جانبية للمؤن ٣٠ سم','set','بسلتين أو ثلاث'),
 part('basket-40','basket','سلة سحب ٤٠ سم','set','سلتان'),
 part('basket-60','basket','سلة سحب ٦٠ سم','set','سلتان'),
 part('cutlery-60','basket','حامل أدوات المائدة ٦٠ سم','piece','لدرج بعرض ٦٠ سم'),
 part('bin-double-45','basket','حاوية قمامة مزدوجة للسحب ٤٥ سم','set','حاويتان مع سكة'),
 part('carousel-80','basket','رف دوّار للزاوية ٨٠ سم','set','رفّان دوّاران'),
 part('led-kit-3m','lighting','طقم إضاءة LED لأسفل الخزائن ٣ م','set','شريط ومحوّل'),
 part('led-driver','lighting','محوّل إضاءة ١٢ فولت ٣٠ واط','piece','12V · 30W'),
 part('motion-switch','lighting','مفتاح حساس حركة للإضاءة','piece','يركّب داخل الخزانة')
];

const handleOf=(id,family,label,unit,extra)=>rec('handle','gen-'+id,family,label,{unit,...extra});
const handles=[
 ...[128,192,256,320,448].map(c=>handleOf('bar-'+c,'bar','مقبض قضيب · '+c.toLocaleString('ar-SA')+' مم بين المسمارين','piece',{centersMm:c})),
 handleOf('knob-30','knob','مقبض دائري · قطر ٣٠ مم','piece',{}),
 handleOf('knob-35','knob','مقبض دائري · قطر ٣٥ مم','piece',{}),
 handleOf('profile-j','handleless','مقطع سحب بلا مقبض · ٢٫٧ م','piece',{lengthMm:2700})
];

// The finishes and frames the drawing already knows. Their look is fixed in the program; the library adds what only the factory knows
// (the supplier's code, the price) as a note on top, which is why these two libraries accept no new records.
const finishRecords=()=>{
 const ids=[...new Set([...Object.keys(kitchenFrontFinishes),...Object.keys(kitchenWorktopFinishes)])];
 return ids.map(id=>{
  const f=kitchenFrontFinishes[id]||kitchenWorktopFinishes[id],front=id in kitchenFrontFinishes,top=id in kitchenWorktopFinishes;
  return Object.freeze({library:'finish',id,family:f.family,label:f.label,attrs:Object.freeze({use:front&&top?'both':front?'front':'worktop',colorHex:f.color,patternCm:f.patternCm}),
   price:null,status:'approved',source:'builtin',hidden:false,note:''});
 });
};
const arabic=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n);
const frameRecords=()=>supplierFrames.map(s=>Object.freeze({library:'supplier',id:s.article,family:s.tier,
 label:(s.tier==='base'?'هيكل خزانة قاعدة':'هيكل خزانة حائط')+' · '+[s.width,s.depth,s.height].map(arabic).join(' × ')+' سم',
 attrs:Object.freeze({article:s.article,widthMm:Math.round(s.width*10),depthMm:Math.round(s.depth*10),heightMm:Math.round(s.height*10),url:s.url}),
 price:null,status:'approved',source:'builtin',hidden:false,note:''}));

export const shippedRecords=()=>[...appliances,...sinks,...hardware,...handles,...finishRecords(),...frameRecords()];
export const materialFamilyNames=kitchenMaterialFamilies;

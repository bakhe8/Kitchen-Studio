import {ownKey} from './kitchen-safe-keys.js';
import {kitchenFrontFinishes,kitchenWorktopFinishes,kitchenMaterialFamilies} from './kitchen-materials.js';
const fixed=o=>Object.freeze(o),base=fixed(['base']),upper=fixed(['upper']),both=fixed(['base','upper']);
export const kitchenFrontStyles=fixed({
  flat:fixed({label:'لوح مستوٍ',description:'واجهة بلا إطار بارز.'}),
  framed:fixed({label:'واجهة بإطار',description:'لوح داخلي تحيط به حافة بارزة.'}),
  fluted:fixed({label:'واجهة مضلّعة',description:'تضليع رأسي متكرر على سطح اللوح.'})
});
export const kitchenHandleStyles=fixed({
  bar:fixed({label:'مقبض قضيب',description:'مقبض طولي عند الحافة الحرة.'}),
  knob:fixed({label:'مقبض دائري',description:'قبضة واحدة مستديرة.'}),
  handleless:fixed({label:'سحب بلا مقبض',description:'شق سحب غائر عوض قطعة معدنية.'})
});
export const kitchenDoorHandings=fixed({
  auto:fixed({label:'تلقائي بحسب العرض'}),left:fixed({label:'ضلفة واحدة · مفصلة يسار'}),
  right:fixed({label:'ضلفة واحدة · مفصلة يمين'}),pair:fixed({label:'ضلفتان تفتحان إلى الجانبين'})
});
const familyNames={cabinet:'خزائن',cooking:'طهي وتهوية',cold:'تبريد وتجميد',water:'غسل وتحضير',special:'تخزين متخصص'};
const millwork={frontStyles:true,handles:true};
const spec=(label,family,description,width,tiers,props={})=>fixed({label,family,description,width,tiers,...props});
export const kitchenUnitSpecs=fixed({
  storage:spec('خزانة تخزين','cabinet','خزانة مفصلية بتقسيم داخلي قابل للتحرير.',60,both,{...millwork,openable:true,opening:'side-hinge',configurableHanding:true,editableInterior:true}),
  drawers:spec('وحدة أدراج','cabinet','واجهات أدراج بعدد قابل للتخصيص. تُختبر حركة الدرج الأمامي.',50,base,{...millwork,openable:true,editableInterior:true}),
  sink:spec('وحدة حوض','water','حوض وفتحة يتبعان جسم الوحدة عند تحريكها.',80,base,{...millwork,openable:true,opening:'side-hinge',configurableHanding:true}),
  dishwasher:spec('غسالة صحون','water','جهاز ثابت العرض بباب سفلي ورفوف داخلية.',60,base,{fixedWidth:true,openable:true}),
  hob:spec('وحدة موقد','cooking','سطح طهي مدمج في فتحة وواجهات مفصلية.',60,base,{...millwork,openable:true,opening:'side-hinge',configurableHanding:true}),
  oven:spec('فرن','cooking','فرن أسفل سطح العمل بباب يفتح لأسفل.',60,base,{fixedWidth:true,openable:true}),
  tall:spec('خزانة طويلة','cabinet','خزانة تمتد إلى ارتفاع ٢١٠ سم ولا يعلوها سطح عمل.',60,base,{...millwork,height:210,worktop:false,openable:true,opening:'side-hinge',configurableHanding:true,editableInterior:true}),
  fridge:spec('ثلاجة ببابين','cold','جسم تبريد مستقل بواجهتين طويلتين ورفوف تبريد داخلية.',90,base,{height:190,depth:65,worktop:false,fixedWidth:true,openable:true,opening:'side-hinge',leaves:2}),
  freezer:spec('مجمّد رأسي','cold','مجمّد بباب واحد وصناديق تخزين مسحوبة داخل حجيرته.',60,base,{height:178,depth:62,worktop:false,fixedWidth:true,openable:true,opening:'side-hinge',leaves:1}),
  microwave:spec('مايكروويف','cooking','حيز جهاز حسب موديله ومرجع أبعاده.',60,both,{fixedWidth:true,openable:true,opening:'side-hinge',leaves:1,worktop:false}),
  'laundry-bay':spec('حيز غسالة أو نشّافة','water','حيز جهاز خدمة وفراغ فتحه حسب الموديل.',60,base,{fixedWidth:true,openable:true,opening:'side-hinge',leaves:1}),
  'oven-tower':spec('برج فرن مدمج','cooking','عمود كامل الارتفاع مع تجويف فرن في الوسط وباب يفتح أمامه.',60,base,{height:210,depth:60,worktop:false,fixedWidth:true,openable:true}),
  hood:spec('شفّاط جداري','cooking','مظلّة شفط بمرشح سفلي ومدخنة أضيق منها؛ تتبع ارتفاع الصف العلوي.',90,upper,{height:60,depth:32,worktop:false,fixedWidth:true}),
  'open-shelf':spec('وحدة رفوف مفتوحة','cabinet','رفوف مكشوفة من دون باب، تقبل نفس محرر التقسيم المتداخل.',60,both,{editableInterior:true}),
  'bottle-rack':spec('رف زجاجات','special','شبكة فتحات أفقية لزجاجات توضع ممدّدة، دون واجهة مغلقة.',40,both),
  pullout:spec('سحّاب مؤن ضيّق','special','واجهة واحدة تسحب سلتين فوق مسارات تخرج إلى الممر.',30,base,{...millwork,openable:true})
});
export const kitchenUnitAllowed=(kind,tierOrRun)=>ownKey(kitchenUnitSpecs,kind)&&kitchenUnitSpecs[kind].tiers.includes(typeof tierOrRun==='string'?tierOrRun:tierOrRun?.tier);
// Inset chimney deliberately leaves clearance above the canopy at each side.
// One source for the mesher, final placement and continuous free-slot search.
export function kitchenHoodBlocks(w,h,d){
  const canopy=Math.min(12,h*.3),chimney=Math.min(28,w*.34);
  return [{part:'hood-canopy',du:0,db:0,width:w,height:canopy,depth:d},
    {part:'hood-chimney',du:(w-chimney)/2,db:canopy,width:chimney,height:h-canopy,depth:d*.56}];
}
const normalized=s=>String(s??'').toLowerCase().normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي');
const list=(s,m,group)=>Object.entries(m).map(([id,i])=>fixed({...i,id,section:s,
  family:i.family??group,familyLabel:kitchenMaterialFamilies[i.family]||familyNames[i.family]||group,
  description:i.description??((kitchenMaterialFamilies[i.family]||'تشطيب')+' · تكرار العيّنة '+i.patternCm+' سم')}));
const entries=fixed([...list('unit',kitchenUnitSpecs,'وحدات'),...list('front',kitchenFrontFinishes,'واجهات'),...list('worktop',kitchenWorktopFinishes,'أسطح'),
  ...list('front-style',kitchenFrontStyles,'هيئة الواجهة'),...list('handle',kitchenHandleStyles,'مقابض')]);
export function studioCatalogEntries({section,query='',family,tier}={}){
  const words=normalized(query).trim().split(/\s+/).filter(Boolean);
  return entries.filter(e=>(!section||section==='all'||e.section===section)&&(!family||family==='all'||family===e.family)&&
    (!tier||e.section!=='unit'||e.tiers.includes(tier))&&words.every(w=>normalized([e.id,e.label,e.family,e.familyLabel,e.description].join(' ')).includes(w)));
}

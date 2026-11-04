// The libraries and what a record of each holds. A library is a source to copy from: a project takes a copy of the model, size or
// price it needs and never points back at a record by its id, so a project stays complete on any device whatever that device's libraries hold.
const mm=(key,label,over={})=>({key,label,type:'mm',min:1,max:12000,...over});
const text=(key,label,over={})=>({key,label,type:'text',max:100,...over});
const pick=(key,label,options,over={})=>({key,label,type:'pick',options,...over});
const num=(key,label,min,max,over={})=>({key,label,type:'number',min,max,...over});
const unitWords={piece:'قطعة',set:'طقم',meter:'متر'};
const axes=[['Width','العرض'],['Height','الارتفاع'],['Depth','العمق']];

export const libraryDefs=Object.freeze({
 appliance:{
  label:'موديلات الأجهزة',one:'جهاز',link:'يملأ بطاقة جهاز العميل (الموديل والمقاسات) عند تسجيله.',
  families:{fridge:'ثلاجة',freezer:'مجمّد',oven:'فرن',dishwasher:'غسالة صحون',washer:'غسالة ملابس',dryer:'نشّافة',microwave:'مايكروويف',hob:'موقد',hood:'شفاط',counter:'جهاز فوق السطح',other:'جهاز آخر'},
  fields:[text('brand','الماركة',{max:60}),text('model','رقم الموديل',{max:100}),
   ...axes.map(([k,l])=>mm('body'+k+'Mm',l+' · جسم الجهاز · مم',{required:true,group:'جسم الجهاز · مم',short:l})),
   ...axes.map(([k,l])=>mm('space'+k+'Mm',l+' · حيز التركيب شامل الخلوص · مم',{required:true,group:'حيز التركيب شامل الخلوص · مم',short:l})),
   ...axes.map(([k,l])=>mm('cutout'+k+'Mm',l+' · فتحة القص · مم',{group:'فتحة القص في الخزانة أو السطح · مم',short:l})),
   text('manual','مرجع دليل التركيب',{max:160})],
  // The appliance card refuses a space smaller than the body, so the library does too.
  check:a=>axes.some(([k])=>a['space'+k+'Mm']<a['body'+k+'Mm'])?'حيز التركيب أصغر من جسم الجهاز. سجّل الغلاف الكامل بما فيه الخلوص.':''
 },
 sink:{
  label:'الأحواض',one:'حوض',link:'يُضاف إلى كتالوج المصنع كقطعة مشتراة.',
  families:{stainless:'فولاذ',composite:'جرانيت مركّب',ceramic:'سيراميك',other:'مادة أخرى'},
  fields:[text('brand','الماركة',{max:60}),text('model','رقم الموديل',{max:100}),num('bowls','عدد الأحواض',1,3,{integer:true}),
   pick('mount','طريقة التركيب',{top:'فوق السطح',under:'تحت السطح',flush:'مسطّح مع السطح'}),
   mm('widthMm','العرض الكلي · مم',{required:true}),mm('depthMm','العمق الكلي · مم',{required:true}),
   mm('cutoutWidthMm','عرض فتحة القص · مم',{group:'فتحة القص · مم',short:'العرض'}),mm('cutoutDepthMm','عمق فتحة القص · مم',{group:'فتحة القص · مم',short:'العمق'}),mm('minUnitWidthMm','أقل عرض لوحدة الحوض · مم'),
   pick('drainer','المجفف',{none:'بلا مجفف',left:'مجفف يسار',right:'مجفف يمين'}),text('manual','مرجع دليل التركيب',{max:160})],
  check:a=>a.cutoutWidthMm&&a.cutoutWidthMm>a.widthMm||a.cutoutDepthMm&&a.cutoutDepthMm>a.depthMm?'فتحة القص أكبر من الحوض نفسه. راجع المقاسات.':''
 },
 hardware:{
  label:'الخردوات والملحقات',one:'صنف',link:'يُضاف إلى كتالوج المصنع كقطعة مشتراة.',
  families:{hinge:'مفصلات',slide:'سكك أدراج',lift:'رفع الأبواب وتثبيتها',leg:'أرجل وقاعدة',basket:'سلال وتنظيم داخلي',lighting:'إنارة',other:'أخرى'},
  fields:[text('brand','الماركة',{max:60}),text('code','رمز المورد',{max:48}),text('spec','المواصفة',{max:160}),
   pick('unit','وحدة الشراء',unitWords,{required:true}),mm('lengthMm','الطول · مم'),num('loadKg','الحمل الأقصى · كغ',0,500)],
  check:()=>''
 },
 handle:{
  label:'المقابض',one:'مقبض',link:'يُضاف إلى كتالوج المصنع كقطعة مشتراة. الرسم يعرض الأنماط الثلاثة فقط.',
  families:{bar:'مقبض قضيب',knob:'مقبض دائري',handleless:'سحب بلا مقبض'},
  fields:[text('brand','الماركة',{max:60}),text('code','رمز المورد',{max:48}),mm('lengthMm','الطول · مم'),mm('centersMm','المسافة بين المسمارين · مم'),
   text('finishName','المعدن أو اللون',{max:60}),pick('unit','وحدة الشراء',unitWords,{required:true})],
  check:()=>''
 },
 finish:{
  label:'الخامات والتشطيبات',one:'خامة',link:'عيّنات الرسم ثابتة في البرنامج؛ هنا تسجّل رمز المورد والسعر.',closed:true,
  families:{wood:'خشب',stone:'حجر',marble:'رخام',quartz:'كوارتز',paint:'طلاء',metal:'معدن',porcelain:'بورسلان'},
  fields:[text('supplierCode','رمز المورد',{max:48}),pick('use','يُستعمل في',{front:'الواجهات',worktop:'الأسطح',both:'الواجهات والأسطح'},{fixed:true}),
   text('colorHex','لون العيّنة',{max:9,fixed:true}),num('patternCm','تكرار العيّنة · سم',1,500,{fixed:true})],
  check:()=>''
 },
 supplier:{
  label:'هياكل المورّدين',one:'هيكل',link:'تُدرج في التصميم من «مراجع المصنّع». القائمة ثابتة في البرنامج.',closed:true,
  families:{base:'هيكل أرضي',upper:'هيكل علوي'},
  fields:[text('article','رقم المنتج',{max:30,fixed:true}),mm('widthMm','العرض · مم',{fixed:true}),mm('depthMm','العمق · مم',{fixed:true}),mm('heightMm','الارتفاع · مم',{fixed:true}),text('url','صفحة المنتج',{max:300,fixed:true})],
  check:()=>''
 }
});
export const libraryIds=Object.freeze(Object.keys(libraryDefs));
export const unitNames=unitWords;
export const statusNames=Object.freeze({draft:'مسودة',approved:'معتمد'});
export const sourceNames=Object.freeze({builtin:'من البرنامج',generic:'مثال عام',own:'خاص بالمصنع',import:'مستورد'});

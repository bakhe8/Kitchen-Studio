import {principleExamples} from './principle-catalog.js';
import { ideaModes, extraModes } from './advanced-catalog.js';
import { newExamples } from './taxonomy.js';

const paths = {
 move:'M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4',
 pan:'M8 15V7a2 2 0 0 1 4 0v7-10a2 2 0 0 1 4 0v10-7a2 2 0 0 1 4 0v9c0 4-3 6-6 6h-2c-2 0-3-1-4-2l-5-6a2 2 0 0 1 3-3l2 2',
 select:'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M4 11v2M11 4h2M20 11v2M11 20h2M9 9h6v6H9Z',
 area:'M4 4h16v16H4ZM4 9h16M4 15h16M9 4v16M15 4v16',
 path:'M4 18c6 0 0-12 6-12s-1 12 5 12 1-12 5-12M3 18h2M18 4l2 2 2-2',
 transform:'M5 9V5h4M15 5h4v4M19 15v4h-4M9 19H5v-4M8 8h8v8H8Z',
 value:'M3 7h18M3 17h18M8 4v6M16 14v6',
 sort:'M9 5h12M9 12h12M9 19h12M3 3v18M1 5l2-2 2 2M1 19l2 2 2-2',
 transfer:'M3 5h7v6H3ZM14 13h7v6h-7ZM12 7h6v3M16 8l2 2 2-2M12 17H6v-3M4 16l2-2 2 2',
 assign:'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-3a6 6 0 0 1 10-4M15 13h7v8h-7ZM15 13l3.5-3 3.5 3M18 17v4'
};
const basicModes = [
 {id:'move',name:'نقل عنصر',title:'أعطِ كل شيء مكانه',category:'المكان والمشهد',instruction:'اسحب طاولة التحضير إلى مساحة فارغة داخل المحل، ثم أفلتها.',effect:'معاينة ثم تثبيت',context:'داخل المحل · المواضع المسموحة فقط',ready:'الطاولة جاهزة للنقل',detail:'الممر والأثاث الثابت لا يقبلان وضع الطاولة.'},
 {id:'pan',name:'تحريك الخريطة',title:'حرّك منظورك إلى الحي',category:'المكان والمشهد',instruction:'اضغط على الخريطة واسحبها لاستكشاف الجزء المخفي من الحي.',effect:'تأثير مباشر',context:'الكاميرا تتحرّك · المباني ثابتة',ready:'اسحب أرضية الخريطة',detail:'راقب نافذة العرض في الخريطة المصغّرة.'},
 {id:'select',name:'تحديد مجموعة',title:'اجمعها بحركة واحدة',category:'التحديد والرسم',instruction:'اسحب من مساحة فارغة لرسم مستطيل حول العناصر التي تريد تحديدها.',effect:'معاينة ثم اعتماد',context:'كل عنصر داخل المستطيل يدخل في التحديد',ready:'حدّد مجموعة من العناصر',detail:'يمكنك أيضًا النقر على كل عنصر لتحديده.'},
 {id:'area',name:'تحديد مساحة',title:'حوّل الأرضية إلى مساحة عمل',category:'التحديد والرسم',instruction:'اسحب فوق الشبكة لتحديد مساحة تخزين مع إبقاء الممر خاليًا.',effect:'معاينة ثم تثبيت',context:'الخانة وحدة التجربة',ready:'ارسم مساحة التخزين',detail:'الممر والعوائق مواضع محجوزة.'},
 {id:'path',name:'رسم مسار',title:'ارسم الطريق الذي تريده',category:'التحديد والرسم',instruction:'ابدأ من نقطة الانطلاق واسحب إلى الوجهة، مرورًا حول العائق.',effect:'رسم ثم اعتماد',context:'بداية · طريق متصل · وجهة',ready:'ابدأ من الدائرة الخضراء',detail:'يُعتمد المسار عندما يصل إلى الوجهة دون عبور العائق.'},
 {id:'transform',name:'الحجم والاتجاه',title:'شكّل العنصر كما تحتاج',category:'التعديل والتحكم',instruction:'اسحب مقبض الزاوية لتغيير الحجم، أو المقبض الدائري لتدوير اللافتة.',effect:'معاينة ثم تثبيت',context:'تغيير الشكل والاتجاه',ready:'اللافتة جاهزة للتعديل',detail:'المقبض المربع للحجم، والدائري للدوران.'},
 {id:'value',name:'ضبط قيمة',title:'اضبط الكمية بحركة مستمرة',category:'التعديل والتحكم',instruction:'اسحب المؤشر وحدّد كمية الصناديق، وراقب الإجمالي يتغيّر.',effect:'تأثير مباشر',context:'معاينة تعليمية · لا يتم شراء فعلي',ready:'حرّك المؤشر لتغيير الكمية',detail:'الكمية والإجمالي يتغيّران مع حركة المؤشر.'},
 {id:'sort',name:'ترتيب الأولويات',title:'حدّد ما يحدث أولًا',category:'القرارات والإدارة',instruction:'اسحب مهمة إلى موضع جديد في قائمة التنفيذ.',effect:'عند الإفلات',context:'الترتيب الجديد يغيّر الأولوية',ready:'أعد ترتيب مهام اليوم',detail:'راقب موضع الإدراج قبل أن تفلت المهمة.'},
 {id:'transfer',name:'نقل البضاعة',title:'من المخزون إلى الرف',category:'القرارات والإدارة',instruction:'اسحب صندوقًا من المخزون إلى مكان متاح على رف العرض.',effect:'عند الإفلات على هدف',context:'المخزون + العرض = كمية ثابتة',ready:'انقل صندوقًا إلى الرف',detail:'كل صندوق يصل إلى العرض يُخصم من المخزون.'},
 {id:'assign',name:'إسناد مهمة',title:'الحركة تصبح قرارًا',category:'القرارات والإدارة',instruction:'اسحب بطاقة سالم إلى المحل الذي تريد تكليفه بالعمل فيه.',effect:'عند الإفلات على هدف',context:'العامل + المحل = تكليف',ready:'سالم ينتظر تكليفه',detail:'المحل الممتلئ يرفض استقبال عامل إضافي.'}
];


const preferred=['button-trace','button-phases','compare-commit','compare-threshold','compare-path','compare-rate','magnet','compare-constraint','turns','dwell','relations','lasso','group','history','delete'];
export const examples = [...newExamples.toSorted((a,b)=>preferred.indexOf(a.id)-preferred.indexOf(b.id)), ...principleExamples,...ideaModes, ...extraModes, ...basicModes.map(m => ({...m,group:'basic'}))].map(m => ({...m, icon:m.icon || paths[m.id]}));
export const exampleById = new Map(examples.map(m=>[m.id,m]));

// Editable estimating choices, never declarations that the technician surveyed
// a room, that a customer signed, or that a catalogue price was approved.
const v=(code,property,type,value,unit='')=>Object.freeze({code,property,type,value,unit,mode:'value'});
const pending=(code,property,type,unit='')=>Object.freeze({code,property,type,value:null,unit,mode:'unknown'});
export const defaultSeeds=Object.freeze([
 v('CAT-03','عمق الصف السفلي','number',600,'مم'),v('CAT-03','عمق الصف العلوي','number',340,'مم'),
 v('CAT-03','ارتفاع جسم الصف السفلي','number',860,'مم'),v('CAT-03','ارتفاع جسم الصف العلوي','number',700,'مم'),v('CAT-03','منسوب تركيب الصف العلوي','number',1450,'مم'),
 v('CAT-08','شكل واجهة الوحدة الجديدة','choice','flat'),v('CAT-12','مقبض الوحدة الجديدة','choice','bar'),
 v('CAT-06','خامة واجهة الوحدة الجديدة','choice','sage'),v('CAT-17','خامة سطح العمل الجديد','choice','carrara'),
 v('MFG-06','نسبة احتياط سطح العمل','number',0,'%'),pending('MFG-09','سعر متر سطح العمل المربع','number','ريال/م²'),
 v('USE-08','طريقة التخزين','choice','في الكيس الأصلي'),pending('USE-08','كمية الأرز التي يريد العميل تخزينها','number','كجم'),pending('USE-08','وزن الكيس الواحد','number','كجم'),
 v('PRJ-05','صفة الميزانية','choice','لا يحدد مبلغًا الآن'),pending('PRJ-05','الحد الأعلى للميزانية','number','ريال'),
 v('CAT-14','المستويات المطلوبة للركن','choice','السفلي فقط'),
 ...['الركن السفلي','الركن العلوي','ركن الوحدة الطويلة'].flatMap(k=>[v('CAT-14','جهة الوصول إلى '+k,'choice','من جهة واحدة'),v('CAT-14','وظيفة '+k,'choice','رفوف ثابتة')]),
 v('USE-13','تكرار تنظيم الركن في المستوى العلوي','boolean',false),
 v('PRJ-07','درجة إلزام اختيار التشطيب أثناء التصور','choice','قابل للتعديل'),
 v('SITE-02','مرجع المناسيب التصميمية','text','صفر الأرضية النهائية'),
 pending('EQP-02','الحد الأدنى لارتفاع فتحة الموديل','number','مم'),pending('SITE-19','منسوب أعلى التعلية','number','مم'),
 pending('SITE-07','منسوب أرضية فراغ الجهاز','number','مم'),pending('CAT-17','منسوب أسفل الرخام عن صفر الأرضية النهائية','number','مم'),
 pending('MFG-07','سماحية التركيب المعتمدة','number','مم'),pending('CAT-01','إصدار كتالوج المصنع','text'),
 pending('INS-06','إصدار التصميم المعتمد','text')
]);

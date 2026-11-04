// Active inputs and study episodes are separate from the educational axes.
// This registry does not add its two examples to the primary-button catalog.
export const inputChannels = [
  {id:'primary',label:'الزر الأساسي',shortLabel:'الأساسي',description:'ضغطة متصلة من الزر الأساسي مع حركة المؤشر أو ثباته حتى الإفلات. أدوات التراجع اللاحقة منفصلة عن هذه الدورة.',episodeKind:'press-drag-release',requiredChannels:['primary-button','pointer-position'],excluded:['secondary-button','wheel-rotation','middle-button','modifier-keys'],entryExampleId:'button-trace'},
  {id:'secondary',label:'الزر الثانوي',shortLabel:'الثانوي',description:'إمساك الصندوق بالزر الثانوي وحده وسحبه ثم إفلاته. الزر هو مصدر البدء؛ تغير الموضع هو ما يحدد الإزاحة. لا نحتاج الزر الأساسي أو دوران البكرة.',episodeKind:'press-drag-release',requiredChannels:['secondary-button','pointer-position'],excluded:['primary-button','wheel-rotation','middle-button','modifier-keys'],entryExampleId:'secondary-drag'},
  {id:'wheel',label:'تدوير البكرة',shortLabel:'البكرة',description:'أحداث تدوير متعاقبة بمقادير ووحدات وأوقات. يمكن أن يبقى المؤشر ثابتًا. تفصل مهلة صمت تعليمية بين السلاسل؛ لا تمثل إفلات زر أو توقفًا ميكانيكيًا مرصودًا.',episodeKind:'timed-wheel-events',requiredChannels:['wheel-rotation'],excluded:['primary-button','secondary-button','middle-button','modifier-keys'],entryExampleId:'wheel-trace'}
];
const channelById = new Map(inputChannels.map(c=>[c.id,c]));
export function getChannelInfo(id){return channelById.get(id);}

export const inputExamples = [
  {id:'secondary-drag',channel:'secondary',group:'input-binding',name:'نقل بالزر الثانوي',title:'الزر يختار بداية الحمل؛ الإزاحة تنقل الصندوق.',
    category:'مصدر بديل لقاعدة ممثلة',instruction:'أمسك الصندوق بالزر الثانوي وحده، واسحبه، ثم أفلت. راقب الإزاحة وموضع الصندوق عند حدود السطح.',effect:'إزاحة واحدة · موضع مقيد',context:'مصدر ثانوي مستقل · لا يتطلب الأساسي',ready:'ابدأ من الصندوق بالزر الثانوي',detail:'العرض الموجّه يحاكي الحركة دون أن يثبت أن زر الفأرة الفعلي قد استُعمل.',
    icon:'M3 5h12v12H3zM12 12l8 8m-6 0h6v-6',
    lesson:{goal:'تمييز مصدر الضغط الثانوي عن قاعدة تتبّع الإزاحة التي يمكن استعمالها مع مصدر آخر.',tryThis:'حرّك الصندوق بالثانوي ثم جرّب بدء الحركة بالأساسي. قارن النتيجة في تجربة نقل العنصر ضمن مسار الأساسي.',boundary:'هدفا المقارنة في مسارين مستقلين. لعنصر الأساسي شبكة وعوائق، وللصندوق هنا حدود السطح. لا يعني اشتراك قاعدة الإزاحة تطابق كل القيود أو توحيد التسجيلين.',compare:{channel:'primary',id:'move',reason:'الإزاحة فكرة مشتركة؛ مصدر بدء الحمل والقيود والأدلة منفصلة.'}}},
  {id:'wheel-trace',channel:'wheel',group:'input-stream',name:'سجل تدوير البكرة',title:'ماذا وصل من البكرة، وكيف تغيّرت الكمية؟',
    category:'أحداث تدوير ووحدة ومقدار',instruction:'ضع المؤشر داخل سطح التجربة ودوّر البكرة دون ضغط أي زر أو مفتاح مساعد. اقرأ مقدار الحدث ووحدته ثم الخطوة التعليمية والكمية الجديدة.',effect:'دلتا موقّعة · تغير متراكم',context:'تدوير دون ضغط · وحدة كل حدث محفوظة',ready:'دوّر داخل السطح أو شغّل العرض المضبوط',detail:'البكسل والسطر والصفحة وحدات أحداث؛ لا تعني عدد نقرات ميكانيكية أو زاوية دوران العجلة.',
    icon:'M8 3h8a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zM12 5v7m-2-2 2 2 2-2',
    lesson:{goal:'فصل الدلتا الخام ووحدتها عن الخطوة الموحّدة والكمية الناتجة، وتمييز مهلة تجميع الأحداث عن نهاية ضغطة.',tryThis:'شغّل العرض المضبوط لترى بكسلًا وسطرًا وصفحة. ثم دوّر فعليًا داخل السطح وانتظر قبل دفعة جديدة، وقارن المصدر والكمية والسلسلة.',boundary:'قاعدة التحويل هنا اختيار تعليمي: ٤٠ بكسلًا أو سطر أو صفحة تقابل خطوة واحدة. لا تجمع القيم الخام عبر الوحدات، ولا يشترط وصول الوحدات الثلاث من جهاز واحد.',compare:{channel:'primary',id:'value',reason:'النتيجة كمية في المثالين، لكن موضع شريط الأساسي يحدد قيمة مطلقة، ودلتا البكرة تضاف إلى قيمة سابقة.'}}}
];
export const inputExampleById = new Map(inputExamples.map(x=>[x.id,x]));
export const inputLessons = Object.fromEntries(inputExamples.map(e=>[e.id,e.lesson]));

const revisions={secondary:'secondary-drag-2026-10-31-v1',wheel:'wheel-trace-2026-10-31-v1'};
const definitions={secondary:[],wheel:[]}, goals={secondary:[],wheel:[]};
function concept(channel,id,label,type,construction,definition,family,links={}){
  definitions[channel].push({id:`${channel}.${id}`,channel,label,type,construction,definition,family,
    derivesFrom:[],composedOf:[],uses:[],contrasts:[],sharedWith:[],exampleIds:[getChannelInfo(channel).entryExampleId],...links});
}
const shared=(conceptId,reason)=>[{channel:'primary',conceptId,reason}];
const s=(...args)=>concept('secondary',...args),w=(...args)=>concept('wheel',...args);
s('button-state','حالة الزر الثانوي','signal','original','بدء الضغط الثانوي وحده واستمراره حتى الإفلات. لا يُفهم الدور الثانوي من جهة الفأرة الفيزيائية وحدها.','مدخل الزر الثانوي');
s('position','موضع المؤشر أثناء الحمل','signal','original','موضع المؤشر في سطح التجربة؛ يُقرأ عند بدء الحمل ثم أثناء السحب.','مدخل الزر الثانوي',{sharedWith:shared('pointer-position','تعريف الموضع مشترك؛ مصدر الضغط والدليل مختلفان.')});
s('displacement','الإزاحة من بداية الحمل','measurement','derived','فرق إحداثيي الموضع الحالي عن إحداثيي البداية. يمكن أن يعود إلى الصفر بعد حركة طويلة.','قياسات السحب الثانوي',{derivesFrom:['secondary.position'],sharedWith:shared('displacement','العملية الحسابية نفسها عند ربطها بضغط ثانوي.')});
s('follow','تتبّع الإزاحة','rule','primitive','يضاف فرق موضع المؤشر إلى الموضع الأصلي للصندوق. موضع الصندوق الناتج يبقى داخل حدود السطح.','تفسير السحب الثانوي',{uses:['secondary.displacement'],sharedWith:shared('direct-follow','مبدأ تتبع الإزاحة مشترك؛ لا تنقل هذه الصلة دليل أي تجربة.')});
s('bounds','حدود موضع الصندوق','constraint','primitive','يُحصر مكان الصندوق عند حواف السطح، وقد يواصل المؤشر الحركة بعد وصول الصندوق إلى الحد.','قيود السحب الثانوي',{uses:['secondary.position','secondary.follow'],sharedWith:shared('bounds-obstacles','المشترك تقييد المكان؛ لا توجد هنا عوائق المحل وشبكته.')});
s('binding','ربط الزر ببدء السحب','context','primitive','لا يبدأ الحمل إلا من الصندوق بالزر الثانوي وحده. فتح قائمة المتصفح الافتراضية ليس الإشارة التعليمية.','مدخل الزر الثانوي',{uses:['secondary.button-state']});
s('move','تغيير موضع الصندوق','application','application','تغير موضع عنصر نتيجة تتبع الإزاحة. اختلاف الزر لا يجعل النقل مبدأ هندسيًا جديدًا.','نتيجة السحب الثانوي',{uses:['secondary.binding','secondary.follow','secondary.bounds'],sharedWith:shared('application-results','نتيجة نقل عنصر موجود مشتركة مع نقل الطاولة؛ لكل مشهد قيوده.')});

w('delta','دلتا حدث التدوير','signal','original','مقدار موقّع يصل مع حدث التدوير. هذه قراءة من المستعرض وليست زاوية ميكانيكية أو عدد أسنان البكرة.','إشارات البكرة');
w('unit','وحدة الدلتا','signal','original','الوحدة التي يصرح بها الحدث: بكسل أو سطر أو صفحة. لا تُجمع قيم خام بوحدات غير متجانسة.','إشارات البكرة');
w('time','وقت رصد الحدث','signal','original','وقت وصول حدث التدوير في التجربة؛ منه تحسب الفواصل بين الأحداث، ولا يوجد انتقال زر إلى الإفلات.','إشارات البكرة',{sharedWith:shared('timestamps','مشترك في وجود توقيت للعينات، مع اختلاف طبيعة الأحداث.')});
w('interval','الفاصل بين حدثين','measurement','derived','الفرق بين توقيت حدثين متتاليين. طول الفاصل لا يثبت أن المستخدم رفع زرًا.','قياسات البكرة',{derivesFrom:['wheel.time']});
w('raw-sums','مجاميع الدلتا الخام حسب الوحدة','measurement','derived','ثلاثة مجاميع رأسية مستقلة للبكسل والسطر والصفحة. لا يكفي مجموع واحد دون وحدته ولا تساوي هذه الأرقام كمية التطبيق.','قياسات البكرة',{derivesFrom:['wheel.delta','wheel.unit']});
w('normalize','قاعدة تحويل الوحدات','rule','primitive','اختار هذا التطبيق ٤٠ بكسلًا أو سطرًا أو صفحة لكل خطوة كمية. معاملات التحويل ليست معايرة لعتاد البكرة.','تفسير البكرة',{uses:['wheel.delta','wheel.unit'],sharedWith:shared('mapping','التحويل قاعدة عامة؛ وحدات التدوير ومعاملاته تخص هذه التجربة.')});
w('step','خطوة تعليمية موقعة','measurement','derived','قيمة محسوبة من الدلتا الرأسية ووحدتها وفق قاعدة تحويل معلنة. لا تعني هذه القيمة لفة ميكانيكية أو عدد نقرات.','قياسات البكرة',{derivesFrom:['wheel.delta','wheel.unit'],uses:['wheel.normalize']});
w('group','تجميع الأحداث بمهلة','rule','derived','بعد ٤٠٠ ملث من الصمت أو أكثر تنتهي المجموعة السابقة، ويبدأ الحدث المستقل التالي مجموعة جديدة. التجميع تفسير زمني وليس إشارة إفلات.','تفسير البكرة',{derivesFrom:['wheel.interval'],uses:['wheel.time']});
w('activation','شروط التدوير المستقل','constraint','primitive','التجربة تستقبل أحداث التدوير على سطحها فقط مع عدم ضغط أزرار أو مفاتيح مساعدة. وضع المؤشر سياق للحدث ولا يُشترط سحبه.','حدود مصدر البكرة',{uses:['wheel.delta']});
w('accumulate','جمع الخطوات','rule','primitive','تُجمع الخطوات التعليمية الموحّدة بإشارتها؛ تحتفظ القراءة الخام بوحدة كل حدث.','تفسير البكرة',{uses:['wheel.step'],sharedWith:shared('accumulation','جمع المساهمات قاعدة مشتركة؛ مساهماتها هنا خطوات تدوير محوّلة.')});
w('bounds','حدود الكمية','constraint','primitive','تبدأ الكمية من ٥٠ وتُحصر بين ٠ و١٠٠ عند تطبيق التغيرات. لا تعد الكمية سجلًا خامًا للبكرة.','تفسير البكرة',{uses:['wheel.step']});
w('quantity','كمية تتغير بحسب الدلتا','application','application','تضاف الخطوة الموقّعة إلى الكمية السابقة ثم يطبق الحد. بقاء المؤشر في مكانه لا يمنع التغير.','نتيجة البكرة',{uses:['wheel.accumulate','wheel.bounds'],sharedWith:shared('application-results','نتيجة عددية تشبه ضبط كمية بشريط، لكن نموذج التحديث مختلف.')});

// A source review is recorded per claim, independently from a link to any
// primary concept. None of the following rows inherits a primary browser test.
function goal(channel,key,label,conceptId,axis,role,observation,test){
  goals[channel].push({id:`${channel}.${key}`,channel,label,conceptId:`${channel}.${conceptId}`,axis,
    family:definitions[channel].find(c=>c.id===`${channel}.${conceptId}`).family,scope:'study',role,observation,test});
}
const sg=(...args)=>goal('secondary',...args),wg=(...args)=>goal('wheel',...args);
sg('signal.button','إظهار الضغط الثانوي والإفلات','button-state','signal','إشارة','تبدأ دورة بالسحب الثانوي وينهيها الإفلات؛ العرض المحاكى موسوم بمصدره.','أمسك الصندوق بالثانوي وحده ثم أفلت، وقارن بوسم العرض المضبوط.');
sg('measure.displacement','قراءة الإزاحة منذ بداية الحمل','displacement','measure','قياس','تُعرض إزاحة المؤشر نسبة إلى نقطة النزول داخل التجربة.','اسحب ثم عد قريبًا من البداية قبل الإفلات.');
sg('response.follow','تتبّع إزاحة واحدة بصندوق','follow','response','قاعدة','تضاف إزاحة المؤشر إلى موضع الصندوق عند بدء السحب؛ الحواف تقيد الناتج.','تحرك داخل المنطقة الحرة ثم قارِن إزاحة اليد بانتقال الصندوق.');
sg('boundaries.binding','رفض بدء السحب بالأساسي','binding','boundaries','قيد مصدر','المشهد يطلب الزر الثانوي وحده، ولا يبدأ نقلة أساسية بالزر الأساسي.','جرّب بدء سحب بالأساسي ثم بالثانوي في المكان نفسه.');
sg('boundaries.surface','إيقاف الصندوق عند حدود السطح','bounds','boundaries','قيد مكاني','الحدود تخص الناتج المعروض؛ ليست زرًا أو إشارة إضافية.','اسحب أثناء الإمساك إلى ما وراء حافة السطح وراقب موضع الصندوق.');
sg('application.move','نقل عنصر موجود بالسحب الثانوي','move','application','تطبيق','ينتقل الصندوق نفسه داخل السطح. تجربة الطاولة في مسار الأساسي مرجع مستقل بنتيجة مشابهة وقيود أخرى.','انقل ثم أفلت، وافتح نقل العنصر في الأساسي للمقارنة دون عد المقارنة دليلًا على الزرين.');

wg('signal.sample','رؤية دلتا الحدث ووحدته وتوقيته','delta','signal','إشارة خام','يتضمن سجل البكرة مقدار الحدث الرأسي ووحدته وتوقيته ومصدر التسجيل.','ابدأ بسجل فارغ ودوّر فعليًا داخل السطح واقرأ سطر الحدث؛ ثم قارن وسم العرض المضبوط.');
wg('signal.unit','عدم جمع قيم خام ذات وحدات مختلفة','unit','signal','وحدة','تحمل كل دلتا وحدتها الأصلية. قراءات البكسل والسطر والصفحة لا تصبح مجموعًا خامًا واحدًا.','شغّل العرض متعدد الوحدات وقارن ٨٠ بكسلًا بسطر واحد.');
wg('measure.raw-sums','فصل آخر دلتا عن المجاميع الخام وعن الكمية الناتجة','raw-sums','measure','قياس مشتق','يُعرض آخر تغير رأسي منفصلًا عن ثلاث مجاميع حسب الوحدة وعن الكمية المحسوبة.','في العرض المضبوط اقرأ آخر +١ صفحة، والمجاميع +١٢٠ بكسلًا و−١ سطر و+١ صفحة، والكمية ٥٣.');
wg('measure.step','تحويل الدلتا إلى خطوة تعليمية موقعة','step','measure','قياس مشتق','يُقرأ نوع الوحدة قبل التحويل. في هذا المثال +٨٠ بكسلًا تعطي +٢، وسطر سالب يعطي −١.','قارن السجل الخام وخطوة التحويل في عرض الوحدات الثلاث.');
wg('measure.interval','إظهار الفاصل الزمني بين الأحداث','interval','measure','قياس مشتق','من أوقات الأحداث نحسب الفاصل؛ لا توجد مدة إمساك إلزامية أو إفلات في التدوير.','قارن الفاصل بين ١٢٠ و٢٤٠ ملث بالفاصل بين ٢٤٠ و٨٥٠ ملث.');
wg('response.series','تمييز السلاسل بناء على مهلة ٤٠٠ ملث','group','phases','قاعدة زمنية','تُفصل سلسلة بعد مهلة الصمت التعليمية؛ هذا الحد اختيار لتجميع الأحداث.','اترك أكثر من ٤٠٠ ملث بين دفعتين، أو شغّل التسجيل الذي يضم فجوة ٦١٠ ملث.');
wg('response.quantity','إضافة خطوة إلى الكمية السابقة','quantity','response','قاعدة ونتيجة','تبدأ الكمية من ٥٠ ثم تتغير باتجاه الدلتا ومقدارها. الكمية ليست الدلتا الخام وليست موضع المؤشر.','راقب ٥٢ ثم ٥٣ ثم ٥٢ ثم ٥٣ في العرض المضبوط، ثم دوّر داخل السطح دون تحريك المؤشر.');
wg('boundaries.quantity','حصر الكمية بين صفر ومئة','bounds','boundaries','قيد قيمة','الإضافة محدودة بالمجال ٠–١٠٠ حتى لو استمرت أحداث التدوير.','تقدم إلى الحد العلوي أو السفلي ثم دوّر أكثر في الاتجاه نفسه.');
wg('boundaries.isolation','عزل سطح التدوير المستقل عن بقية الصفحة','activation','boundaries','قيد مصدر','يُربط مستمع التدوير بالسطح وحده؛ الأحداث مع زر أو مفتاح مساعد لا تدخل سجل الكمية.','قارن التمرير العادي خارج السطح بتدوير مستقل داخله. ثبات السجل خارج السطح شرط عزل، وليس إيماءة مختلطة جديدة.');

// Each entry is a disposition of one reviewed claim. An unreviewed goal
// remains unreviewed even if it cites the same component as a direct goal.
const sourceVerdicts={
  secondary:{
    'secondary.signal.button':['direct','secondaryModel.down / up; mountSecondaryDrag.paint'],
    'secondary.measure.displacement':['direct','secondaryModel.state.delta; mountSecondaryDrag.paint'],
    'secondary.response.follow':['direct','secondaryModel.move; mountSecondaryDrag.paint'],
    'secondary.boundaries.binding':['direct','mountSecondaryDrag pointerdown / mousedown / pointerup'],
    'secondary.boundaries.surface':['direct','secondaryModel.move clamps box to halfX / halfY; paint shows raw and box'],
    'secondary.application.move':['direct','mountSecondaryDrag paint: data-box, data-delta and data-pos']
  },
  wheel:{
    'wheel.signal.sample':['direct','wheelModel.add / mountWheelTrace.paint · wheel-log'],
    'wheel.signal.unit':['direct','wheelModel.add: sums[mode] / mountWheelTrace.paint · wheel-sums'],
    'wheel.measure.raw-sums':['direct','wheelModel.state.sums / mountWheelTrace.paint · data-w-k and wheel-sums'],
    'wheel.measure.step':['direct','wheelModel.add · delta; mountWheelTrace.paint · signed step and quantity before/after in each row'],
    'wheel.measure.interval':['direct','wheelModel.add · gap; mountWheelTrace.paint · interval or first-event label in each row'],
    'wheel.response.series':['direct','wheelModel.advance / add / scheduleEnd / mountWheelTrace.paint'],
    'wheel.response.quantity':['direct','wheelModel.add: before/qty / data-w-value'],
    'wheel.boundaries.quantity':['direct','wheelModel.add clamps qty; dial and rule description'],
    'wheel.boundaries.isolation':['direct','mountWheelTrace wheel-pad listener; wheelModel.add input gate']
  }
};
// Add checks only after observer reports a real browser observation on the named build.
// Multiple checks of one claim may include different methods (hardware vs guided).
const secondaryCheck=(method,scenario,result)=>({date:'2026-10-31',version:'secondary-drag-2026-10-31-v1',environment:'المعاينة المدمجة للمختبر',method,scenario,result});
const buttonIdentityRun=secondaryCheck('ضغطتان فعليتان منفصلتان دون إزاحة','في وسط الصندوق جُرّب الأساسي ثم الثانوي حتى الإفلات.','بقي الأساسي ready بلا إزاحة عند (١٨٠،١٠٥)، وسجل الثانوي release وقراءة (٠،٠) في المكان نفسه. لم يختبر هذا السحب المتحرك باليد.');
const secondaryGuide=secondaryCheck('عرض تسجيل مضبوط · ليس سحبًا يدويًا','تشغيل عرض الثانوي حتى نهايته وقراءة المصدر والإزاحة وموضع الصندوق.','المصدر guide والحالة release، والإزاحة (٢٤٠،٣٠) والموضع النهائي (٤٢٠،١٣٥).');
const wheelCheck=(method,scenario,result)=>({date:'2026-10-31',version:'wheel-trace-2026-10-31-v1',environment:'المعاينة المدمجة للمختبر',method,scenario,result});
const wheelUnitGuide=wheelCheck('عرض تسجيل مضبوط متعدد الوحدات','تشغيل الأحداث المعلنة عند ٠ و١٢٠ و٢٤٠ و٨٥٠ ملث وقراءة السجل.','ظهرت +٨٠ و+٤٠ بكسلًا، ثم −١ سطر، ثم +١ صفحة؛ بقيت المجاميع الخام +١٢٠ بكسلًا/−١ سطر/+١ صفحة، والكمية النهائية ٥٣.');
const wheelSeriesGuide=wheelCheck('عرض تسجيل مضبوط','تشغيل الأحداث الأربعة حتى ٨٥٠ ملث وقراءة المجموعة الزمنية.','ظهرت مجموعتان زمنيتان: ثلاثة أحداث في الأولى، والأخير بعد فجوة ٦١٠ ملث في الثانية.');
const wheelDerivedGuide=wheelCheck('عرض تسجيل مضبوط · سجل الأحداث النهائي','قراءة الفاصل والخطوة والكمية قبل الحدث وبعده لكل من الأحداث الأربعة.','الفواصل: أول حدث، ١٢٠، ١٢٠، ٦١٠ ملث. الخطوات: +٢، +١، −١، +١؛ وانتقلت الكمية ٥٠←٥٢←٥٣←٥٢←٥٣ بترتيب الأحداث المعلَن.');
const wheelPhysical=wheelCheck('تمرير فعلي داخل اللوحة بلا ضغط','من قيمة ٥٠: تمرير موجب، ثم دورة مستقلة من ٥٠ بتمرير سالب.','حدث +٩٣٦ بكسلًا غيّر الكمية إلى ٧٣٫٤، وحدث −٩٣٦ بكسلًا في الدورة المستقلة غيّرها إلى ٢٦٫٦. لا يثبت هذا وحدتي السطر والصفحة لعتاد المستخدم.');
export const extensionBrowserChecks = {secondary:{
  'secondary-drag/secondary.signal.button':buttonIdentityRun,
  'secondary-drag/secondary.boundaries.binding':buttonIdentityRun,
  'secondary-drag/secondary.measure.displacement':secondaryGuide,
  'secondary-drag/secondary.response.follow':secondaryGuide,
  'secondary-drag/secondary.application.move':secondaryGuide
},wheel:{
  'wheel-trace/wheel.signal.sample':wheelUnitGuide,
  'wheel-trace/wheel.signal.unit':wheelUnitGuide,
  'wheel-trace/wheel.measure.raw-sums':wheelUnitGuide,
  'wheel-trace/wheel.measure.step':wheelDerivedGuide,
  'wheel-trace/wheel.measure.interval':wheelDerivedGuide,
  'wheel-trace/wheel.response.series':wheelSeriesGuide,
  'wheel-trace/wheel.response.quantity':wheelPhysical
}};
const extensionDatasets=new Map();
for(const channel of ['secondary','wheel']){
  const channelInfo=getChannelInfo(channel),ex=inputExamples.find(x=>x.channel===channel),cs=definitions[channel],rows=goals[channel];
  const file=channel==='wheel'?'dist/wheel-scene.js':'dist/channel-scenes.js';
  const source=`${file} · ${ex.id}`;
  const catalogVersion={id:revisions[channel],title:`نطاق ${channelInfo.label} · أهداف معلنة`,description:channelInfo.description};
  const sourceRead=rows.every(o=>sourceVerdicts[channel][o.id]);
  const review=sourceRead?'source-reviewed':'unreviewed';
  const browserChecks=extensionBrowserChecks[channel];
  const objectives=rows.map(({role,observation,test,...o})=>o);
  const evidence=rows.map(o=>{
    const bc=browserChecks[`${ex.id}/${o.id}`]||null;
    const verdict=sourceVerdicts[channel][o.id];
    return {exampleId:ex.id,objectiveId:o.id,channel,scope:'study',status:verdict?verdict[0]:'unreviewed',role:o.role,
      observation:verdict?`${o.observation}${verdict[0]==='partial'?' يظهر حاليًا ما يمكن استنتاجه من السجل، لكن لا توجد قراءة مستقلة لهذه القيمة في الصف.':''}${bc?` فحص المتصفح (${bc.method}): ${bc.result}`:''}`:'أُعلن الهدف؛ لم تُسجل مراجعة تنفيذ لهذه العلاقة بعد.',
      test:o.test,source:verdict?`${file} · ${verdict[1]}`:source,reviewed:bc?'browser-verified':verdict?'source-reviewed':'unreviewed',browserCheck:bc,browserCheckHistorical:false};
  });
  const byGoal=new Map(evidence.map(e=>[e.objectiveId,e]));
  const completion=[
    {id:`${ex.id}.implementation`,label:'شرط السلوك الأساسي',status:review,detail:ex.lesson.goal,source},
    {id:`${ex.id}.boundary`,label:'شرط الحدود والمصدر',status:review,detail:ex.lesson.boundary,source},
    {id:`${ex.id}.explanation`,label:'شرط الشرح ومهمة الملاحظة',status:'source-reviewed',detail:ex.lesson.tryThis,source:'dist/input-catalog.js · inputExamples'},
    {id:`${ex.id}.browser`,label:'التحقق التفاعلي من جميع الشروط',status:'unreviewed',detail:'تسجل مشاهدات المتصفح على الأهداف التي فُحصت فقط. لا يعني عرض تسجيل مضبوط تشغيل العتاد فعليًا.'}];
  const record={id:ex.id,channel,scope:'study',inputProfile:channel,source,contribution:ex.category,scopeNote:channelInfo.description,
    conceptIds:cs.map(c=>c.id),objectiveIds:objectives.map(o=>o.id),completion,
    relatedExamples:[{channel:ex.lesson.compare.channel,id:ex.lesson.compare.id,reason:ex.lesson.compare.reason}]};
  function getExampleRecord(id){return id===ex.id?record:undefined;}
  function getEvidence(exampleId,objectiveId){
    if(exampleId===ex.id&&byGoal.has(objectiveId))return byGoal.get(objectiveId);
    return {exampleId,objectiveId,channel,scope:'study',status:'na',role:'غير مستهدف في هذا المسار',observation:'هذه العلاقة خارج الأهداف المعلنة لهذه التجربة في مصدر الإدخال المحدد. لا يُنقل دليل من مسار آخر.',test:'افتح مسار المصدر المعني لقراءة دليله.',source:'',reviewed:'unreviewed',browserCheck:null,browserCheckHistorical:false};
  }
  extensionDatasets.set(channel,{channel,channelInfo,catalogVersion,examples:[ex],concepts:cs,objectives,evidence,getExampleRecord,getEvidence,browserChecks});
}
export function getExtensionDataset(channel){return extensionDatasets.get(channel);}

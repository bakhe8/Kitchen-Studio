// A declared teaching scope, not a census of every possible mouse interaction.
// Evidence is authored from implementation review. Tags never imply coverage.
import {lessons} from './learning-guide.js';
import {examples as primaryExamples} from './catalog.js';
import {getChannelInfo,getExtensionDataset} from './input-catalog.js';
export const catalogVersion = {
  id: 'one-press-knowledge-2026-10-31-r2',
  title: 'نطاق المعرفة المعلن · ضغطة واحدة',
  description: 'إشارات الزر الأساسي ومسار المؤشر والزمن، وما يُشتق منها ويُفسَّر داخل ضغطة واحدة. هذه قائمة قابلة للمراجعة؛ اكتمالها لا يثبت حصر جميع الإمكانات. التراجع أداة لاحقة مستقلة.'
};

const C = (id, label, type, construction, definition, family, links = {}) => ({
  id, label, type, construction, definition, family, channel:'primary',
  derivesFrom: [], composedOf: [], uses: [], contrasts: [], exampleIds: [], ...links
});
export const concepts = [
  C('button-state','حالة الزر','signal','original','انتقال الزر الأساسي إلى الضغط ثم بقاؤه مضغوطًا حتى الإفلات. لا تقيس هذه الإشارة قوة الإصبع.','الإشارة الأصلية'),
  C('pointer-position','موضع المؤشر','signal','original','إحداثيتا المؤشر في مساحة المثال عند كل عينة؛ لا تختزلان وحدهما الطريق السابق.','الإشارة الأصلية'),
  C('timestamps','أوقات العينات والأحداث','signal','original','توقيت بداية الضغط وعينات الموضع والإفلات بحسب ساعة التطبيق.','الإشارة الأصلية'),
  C('gesture-record','سجل ضغطة واحدة','composition','composite','سجل يربط حالة الزر ومواضع المؤشر وأوقاتها من نزول الزر إلى إفلاته.','الإشارة الأصلية',{composedOf:['button-state','pointer-position','timestamps']}),
  C('duration','مدة الضغط','measurement','derived','الزمن بين بداية الضغط واللحظة الحالية أو الإفلات؛ يشمل الحركة والوقفات.','القياسات الزمنية',{derivesFrom:['timestamps','button-state'],contrasts:['pause-duration','target-dwell']}),
  C('displacement','الإزاحة من البداية','measurement','derived','الفرق بين الموضع الحالي وموضع البداية؛ قد يعود إلى الصفر مع بقاء طريق طويل.','الموضع والمسار',{derivesFrom:['pointer-position'],contrasts:['path-length']}),
  C('path-length','طول المسار','measurement','derived','مجموع أطوال المقاطع بين العينات المتتالية؛ يتأثر بالطريق كله.','الموضع والمسار',{derivesFrom:['pointer-position'],uses:['accumulation'],contrasts:['displacement']}),
  C('direction','اتجاه الحركة','measurement','derived','اتجاه تغير الموضع بين عينات محددة؛ آخر اتجاه لا يصف الطريق كاملًا.','الموضع والمسار',{derivesFrom:['pointer-position']}),
  C('speed','سرعة الحركة','measurement','derived','تغير المسافة أو الموضع بالنسبة إلى الزمن وفق نافذة معلنة؛ الحديثة والمتوسطة وسرعة الإفلات ليست قراءة واحدة.','الحركة والزمن',{derivesFrom:['pointer-position','timestamps'],contrasts:['acceleration']}),
  C('acceleration','التسارع','measurement','derived','تغير متجه السرعة مع الزمن. تقيس التجربة المركبة الأفقية الموقعة من الموضع والزمن؛ تغير مقدار السرعة وحده لا يصف التسارع في الحركة العامة.','الحركة والزمن',{derivesFrom:['speed','timestamps'],contrasts:['speed']}),
  C('pause-duration','مدة ثبات المؤشر','measurement','derived','الزمن منذ آخر تجاوز لسماح حركة صغير أثناء الضغط؛ سماح الاهتزاز اختيار في المثال.','القياسات الزمنية',{derivesFrom:['pointer-position','timestamps'],contrasts:['duration','target-dwell']}),
  C('target-dwell','مدة البقاء داخل هدف','measurement','derived','المدة المتصلة داخل منطقة؛ يمكن أن يتحرك المؤشر داخلها دون انقطاع البقاء.','القياسات الزمنية',{derivesFrom:['pointer-position','timestamps'],uses:['target-context','hit-test'],contrasts:['pause-duration']}),
  C('angle','الزاوية حول مركز','measurement','derived','زاوية موضع المؤشر نسبة إلى مركز ومحور معلنين، وليست عدد الدورات السابقة.','الزاوية والدوران',{derivesFrom:['pointer-position'],uses:['target-context'],contrasts:['turns']}),
  C('turns','الدوران المتراكم','measurement','derived','مجموع فروق الزوايا الموقعة مع معالجة عبور نهاية اللفة. الدوران المعاكس ينقص المجموع.','الزاوية والدوران',{derivesFrom:['angle'],uses:['accumulation'],contrasts:['angle']}),
  C('target-context','الهدف والسياق المكاني','context','primitive','حدود العنصر والسطح والوجهة التي تُقرأ الحركة نسبة إليها؛ ليست إشارة جديدة صادرة من اليد.','السياق والحالة'),
  C('contextual-mode','معنى المقبض أو الوضع','context','primitive','المقبض أو الوضع المختار قبل السحب يحدد ما يفسره البرنامج. اختيار الوضع ليس إدخالًا إضافيًا داخل الضغطة المدروسة.','السياق والحالة'),
  C('state-memory','الحالة السابقة','context','primitive','حالة يحتفظ بها البرنامج، مثل حدوث عبور أو وجود مكوّن أو استمرار الالتقاط.','السياق والحالة'),
  C('direct-follow','التتبع المباشر','rule','primitive','ربط الموضع أو الإزاحة بموضع الناتج وفق مرجع معلوم. قاعدة أولية في مستوى الشرح المعتمد هنا.','قواعد التحويل',{uses:['pointer-position','displacement']}),
  C('mapping','تحويل القيمة إلى معنى','rule','primitive','تحويل موضع أو مقدار إلى كمية أو زاوية أو وقت أو غير ذلك؛ الناتج ليس خاصية جديدة للماوس.','قواعد التحويل',{uses:['pointer-position']}),
  C('hit-test','الاحتواء والتقاطع','rule','primitive','اختبار دخول نقطة أو عنصر في منطقة، أو عبور مقطع لها، وفق ما تعلنه التجربة.','قواعد التحويل',{uses:['pointer-position','target-context']}),
  C('accumulation','جمع أجزاء الأثر','rule','primitive','إضافة مساهمات متتالية مثل أطوال المقاطع أو فروق الزوايا إلى مجموع محفوظ.','قواعد التحويل',{uses:['state-memory']}),
  C('integration','تراكم معدل مع الزمن','rule','derived','تخصيص لقاعدة جمع المساهمات: تضاف في كل فترة كمية تساوي المعدل مضروبًا في الزمن المنقضي. قد يستمر ذلك مع ثبات المؤشر.','قواعد الزمن',{derivesFrom:['accumulation'],uses:['timestamps','state-memory'],contrasts:['time-repeat']}),
  C('time-repeat','التكرار الزمني','rule','composite','إطلاق أثر متقطع عند كل فترة زمنية أثناء استمرار الشرط؛ يختلف عن أثر واحد وعن كمية مستمرة.','قواعد الزمن',{composedOf:['threshold-test','state-memory'],uses:['duration'],contrasts:['integration']}),
  C('threshold-test','اختبار عتبة','rule','primitive','اختبار تجاوز مقدار لحد معلن؛ العدد وتوقيت الاختبار اختياران للتطبيق.','الشروط والعتبات'),
  C('crossing-memory','تسجيل عبور الحد','rule','composite','تسجيل انتقال القيمة عبر حد والاحتفاظ بوقوعه حتى لو عادت القيمة إلى الجانب السابق.','الشروط والعتبات',{composedOf:['threshold-test','state-memory'],contrasts:['target-drop']}),
  C('phase-gate','الاستجابة في مرحلة محددة','rule','primitive','اختيار بداية الضغط أو استمرار شرط أو الإفلات لقراءة الإشارة وتنفيذ أثر.','مراحل الضغطة',{uses:['button-state','timestamps']}),
  C('preview-commit','المعاينة والاعتماد','rule','composite','فصل الحالة المقترحة أثناء الحمل عن الحالة المعتمدة عند الإفلات.','مراحل الضغطة',{composedOf:['phase-gate','state-memory']}),
  C('grid','التقريب إلى شبكة','constraint','derived','تخصيص لتحويل القيم: يقرّب الموضع أو القيمة إلى خطوة ثابتة في المجال. يطبّق في كل المجال دون اشتراط هدف قريب.','القيود المكانية',{derivesFrom:['mapping'],uses:['pointer-position'],contrasts:['magnet']}),
  C('bounds-obstacles','الحدود والعوائق','constraint','primitive','قيد يمنع الخروج من مجال أو التداخل مع عائق. يلزم بيان هل يفحص النهاية أم الطريق كله.','القيود المكانية',{uses:['hit-test']}),
  C('capacity','سعة الوجهة والتوفر','constraint','primitive','رفض العملية عندما لا تتوفر مساحة أو مورد أو استعداد كافٍ.','قيود الحالة',{uses:['state-memory','threshold-test']}),
  C('conservation','حفظ المجموع','constraint','primitive','انتقال الكمية بين حالات أو حاويات مع بقاء مجموعها المقاس بالوحدة نفسها.','قيود الحالة',{uses:['state-memory']}),
  C('target-drop','الإفلات في هدف صالح','constraint','composite','اجتماع حدث الإفلات واختبار الهدف وشروط قبوله. المرور فوق الهدف وحده لا يكفي.','الشروط والعتبات',{composedOf:['phase-gate','hit-test']}),
  C('closure','صلاحية المسار المغلق','constraint','composite','الاقتراب من البداية مع طول ومساحة مناسبين وحدود صالحة؛ التحديد الحر هنا يرفض التقاطع الذاتي.','قيود المسار',{composedOf:['hit-test','threshold-test'],uses:['path-length']}),
  C('group-invariant','حفظ ترتيب المجموعة','constraint','composite','إضافة الإزاحة نفسها إلى العناصر مع فحص قبولها كوحدة؛ تبقى المسافات النسبية محفوظة.','قيود الحالة',{composedOf:['direct-follow','bounds-obstacles'],uses:['displacement']}),
  C('magnet','الالتقاط إلى هدف قريب','constraint','composite','وضع الناتج عند هدف حين تقع اليد داخل نطاق قربه؛ خارج النطاق يتبع المدخل الحر.','القيود المكانية',{composedOf:['threshold-test','direct-follow'],uses:['target-context'],contrasts:['grid','hysteresis']}),
  C('hysteresis','اختلاف حد الالتقاط والفك','constraint','composite','يدخل الالتقاط عند حد، ولا يفك أثناء استمرار الضغط حتى يتجاوز حدًا آخر؛ الموضع نفسه قد يعطي حالتين بحسب التاريخ.','قيود الحالة',{composedOf:['threshold-test','state-memory'],uses:['magnet'],contrasts:['magnet']}),
  C('shape-recognition','تفسير هيئة المسار','rule','composite','اختبار هيئة الطريق وفق قواعد هندسية معلنة لتحويلها إلى أمر.','قواعد المسار',{composedOf:['threshold-test','mapping'],uses:['pointer-position','path-length','turns']}),
  C('post-release','استمرار الأثر بعد الإفلات','rule','composite','تبدأ محاكاة أو مهمة من الحالة التي خلفتها الضغطة وتواصل العمل دون إدخال جديد.','مراحل الضغطة',{composedOf:['phase-gate','state-memory'],uses:['integration'],contrasts:['history-tool']}),
  C('composition-flow','الميل والمعدل والكمية','composition','composite','تركيب قراءة زاوية مع تحويلها إلى معدل ودمج المعدل مع الزمن وحفظ كمية السائل.','تركيب القواعد',{composedOf:['angle','mapping','integration','conservation','capacity']}),
  C('composition-chain','فتح أو تنفيذ مراحل مترابطة','composition','composite','قاعدة تبدأ مرحلة، ثم تغير الحالة شروط المرحلة التالية؛ يمكن أن يكون التسلسل أثناء الحمل أو بعد الإفلات.','تركيب القواعد',{composedOf:['phase-gate','state-memory','target-drop']}),
  C('application-results','نتائج التطبيقات','application','application','النقل والاختيار والحذف والتكليف والكشف وغيرها معانٍ للناتج؛ اختلافها لا يثبت وحده اختلاف مبدأ الإدخال.','التطبيقات والنتائج',{uses:['mapping','target-context']}),
  C('history-tool','التراجع وإعادة التجربة','context','application','أدوات تعمل بعد الضغطة الأصلية على سجل اعتمادات أو على البداية. لا تدخل في حساب إمكانات الضغطة الواحدة.','أدوات لاحقة',{uses:['state-memory','preview-commit'],contrasts:['post-release']}),
  C('same-trace-contrast','مدخل واحد تحت قواعد مختلفة','composition','composite','تمرير الموضع والزمن نفسيهما إلى قواعد متعددة لإظهار فرق الاستجابة مع إعلان ما تغيّر.','المقارنات المنضبطة',{composedOf:['gesture-record','mapping']}),
  C('two-trace-contrast','تسجيلان بشروط مقارنة معلنة','composition','composite','مقارنة مسارين أو تسجيلين مع تحديد ما تساوى وما اختلف؛ لا يعني ذلك تثبيت كل القياسات المترابطة.','المقارنات المنضبطة',{composedOf:['gesture-record'],uses:['displacement','path-length','speed']})
];
const conceptById = new Map(concepts.map(c => [c.id,c]));
const O = (id,label,conceptId,axis) => ({id,label,conceptId,axis,channel:'primary',family:conceptById.get(conceptId).family,scope:id.startsWith('tools.')?'tool':'single'});
export const objectives = [
  O('signal.button','إظهار الضغط والاستمرار والإفلات','button-state','signal'),
  O('signal.position','إظهار موضع المؤشر داخل مساحة المثال','pointer-position','signal'),
  O('signal.time','إظهار توقيت الأحداث منذ بدء الضغطة','timestamps','signal'),
  O('signal.trace','جمع بداية ومسار وإفلات في سجل واحد','gesture-record','signal'),
  O('signal.sample-readout','فحص موضع عينة واحدة وتوقيتها معًا قبل الاشتقاق','gesture-record','signal'),
  O('measure.duration','قياس مدة الضغط بما فيها الوقفات','duration','measure'),
  O('measure.displacement','قياس الإزاحة عن البداية','displacement','measure'),
  O('measure.length','قياس طول المسار من مقاطعه','path-length','measure'),
  O('measure.direction','إظهار اتجاه الحركة المقروء','direction','measure'),
  O('measure.speed','قياس السرعة بنافذة معلنة','speed','measure'),
  O('measure.acceleration','قياس تغير السرعة الأفقية الموقّعة مع الزمن','acceleration','measure'),
  O('measure.pause','قياس مدة ثبات المؤشر','pause-duration','measure'),
  O('measure.dwell','قياس البقاء المتصل داخل الهدف','target-dwell','measure'),
  O('measure.angle','إظهار الزاوية الحالية حول مركز','angle','measure'),
  O('measure.turns','إظهار مجموع الدوران الموقّع','turns','measure'),
  O('contrast.displacement-length','تمييز الإزاحة عن طول الطريق','path-length','contrast'),
  O('contrast.speed-acceleration','تمييز السرعة عن تغيرها','acceleration','contrast'),
  O('contrast.speed-variants','تمييز الحديثة والمتوسطة وسرعة الإفلات','speed','contrast'),
  O('contrast.hold-pause','تمييز استمرار الضغط عن ثبات المؤشر','pause-duration','contrast'),
  O('contrast.pause-dwell','تمييز الثبات عن البقاء داخل هدف','target-dwell','contrast'),
  O('contrast.angle-turns','تمييز زاوية الموضع عن مجموع الدوران','turns','contrast'),
  O('contrast.position-path','تمييز قراءة النهاية عن قراءة الطريق كله','gesture-record','contrast'),
  O('response.follow','جعل الناتج يتبع الموضع أو الإزاحة','direct-follow','response'),
  O('response.mapping','تحويل القيمة إلى معنى معلن','mapping','response'),
  O('response.containment','إظهار ما يختبره الاحتواء أو التقاطع','hit-test','response'),
  O('response.accumulate','جمع مساهمات متتالية في أثر محفوظ','accumulation','response'),
  O('response.integrate','استمرار تراكم الكمية مع ثبات المعدل','integration','response'),
  O('response.periodic','تكرار أثر على فترات زمنية أثناء الضغط','time-repeat','response'),
  O('response.threshold','إظهار الحد الذي يغير قبول العملية','threshold-test','response'),
  O('response.crossing','حفظ وقوع العبور بعد الرجوع','crossing-memory','response'),
  O('response.recognize','تحويل هيئة المسار إلى أمر','shape-recognition','response'),
  O('phases.press','تنفيذ أثر عند بدء الضغط','phase-gate','phases'),
  O('phases.hold','تنفيذ أثر بعد استمرار الضغط مع السماح بالحركة','phase-gate','phases'),
  O('phases.drag','تسجيل بلوغ عتبة الحركة ولو عاد المؤشر','phase-gate','phases'),
  O('phases.pause','تنفيذ أثر بعد ثبات المؤشر','phase-gate','phases'),
  O('phases.release','تنفيذ أو اختبار أثر عند الإفلات','phase-gate','phases'),
  O('phases.preview-commit','فصل المعاينة عن الحالة المعتمدة','preview-commit','phases'),
  O('phases.after','عرض أثر يستمر تلقائيًا بعد الإفلات','post-release','phases'),
  O('boundaries.grid','إظهار التقريب إلى خطوات أو شبكة','grid','boundaries'),
  O('boundaries.obstacle','إظهار قبول أو رفض الحدود والعائق','bounds-obstacles','boundaries'),
  O('boundaries.capacity','إظهار رفض السعة أو المورد غير المتاح','capacity','boundaries'),
  O('boundaries.conservation','إظهار مجموع محفوظ بين الحالات','conservation','boundaries'),
  O('boundaries.valid-drop','رفض الإفلات خارج وجهة صالحة','target-drop','boundaries'),
  O('boundaries.closure','تمييز المسار المغلق الصالح من المفتوح أو المتقاطع','closure','boundaries'),
  O('boundaries.group','رفض المجموعة كوحدة مع حفظ ترتيبها','group-invariant','boundaries'),
  O('boundaries.magnet','إظهار نطاق القرب الذي يفعّل الالتقاط','magnet','boundaries'),
  O('boundaries.hysteresis','تمييز قيد الحد الواحد عن الالتقاط والفك بحدين','hysteresis','boundaries'),
  O('contrast.same-input','إرسال المدخل نفسه إلى قواعد متعددة','same-trace-contrast','contrast'),
  O('contrast.two-records','توفير تسجيلين مع إعلان الثابت والمتغير','two-trace-contrast','contrast'),
  O('contrast.time-responses','مقارنة الأثر مرة والتكرار والتراكم المستمر','time-repeat','contrast'),
  O('contrast.distance-time','تمييز التكرار بحسب الامتداد عن التكرار بحسب الزمن','time-repeat','contrast'),
  O('contrast.grid-magnet','تمييز الشبكة عن الالتقاط إلى هدف','magnet','contrast'),
  O('contrast.crossing-release','تمييز وقوع العبور عن شرط النهاية','crossing-memory','contrast'),
  O('contrast.output-result','كشف اختلاف النتائج من مبدأ ممثل','application-results','contrast'),
  O('composition.dwell-drop','فتح وجهة أثناء الحمل ثم الإفلات داخلها','composition-chain','composition'),
  O('composition.flow','جمع الزاوية والمعدل والزمن وحفظ الكمية','composition-flow','composition'),
  O('composition.chain','بدء سلسلة حالات من إفلات واحد','composition-chain','composition'),
  O('composition.stateful-mix','إظهار أثر الحالة السابقة عند إضافة مكوّن','state-memory','composition'),
  O('application.move-view','إظهار نقل عنصر أو تغيير منظور العالم','application-results','application'),
  O('application.select-area','إظهار الاختيار أو إنشاء مساحة','application-results','application'),
  O('application.transfer-relate','إظهار تغير العضوية أو الهوية أو العلاقة','application-results','application'),
  O('application.reorder','تغيير ترتيب العناصر مع حفظها','application-results','application'),
  O('application.delete','حذف السجل عند الإفلات مع إظهار نقص العدد','application-results','application'),
  O('application.reveal-time','تغيير ما يُعرض دون نقل محتوى العالم','application-results','application'),
  O('tools.history','تمييز أداة الاسترجاع اللاحقة عن الضغطة الأصلية','history-tool','application')
];
const objectiveById = new Map(objectives.map(o => [o.id,o]));

// REGISTER VERIFIED OBJECTIVE CHECKS HERE. One key per observed claim; never
// promote an entire example after one successful playback. See docs/knowledge-scope.md.
// A separate exampleId/@completion key requires ALL declared implementation,
// boundary and interaction criteria to have been exercised on the cited build.
// Record the version that was observed explicitly. Do not derive it from a
// future catalogVersion: the validator must catch stale attestations.
const B = (method,scenario,result) => ({date:'2026-10-31',version:'one-press-knowledge-2026-10-31',environment:'المعاينة المدمجة للمختبر',method,scenario,result});
const matchedMotion = B('عرض تسجيلين مضبوطين','تشغيل التسجيلين حتى ١٠٠٠ ملث ومقارنة القراءات.','السرعة الأفقية +٢٠٠ وحدة/ث في الجانبين، والتسارع +١٢٠ و−١٢٠ وحدة/ث².');
const timedGuide = B('عرض تسجيل مضبوط','تشغيل زيارة الهدف المضبوطة حتى ١٦٠٠ ملث.','أثر واحد، وثلاث نبضات، ومقدار مستمر ٣٫٢ وحدة.');
const timedMouse = B('ضغط فعلي بالزر الأساسي','الضغط داخل الهدف والثبات ١١٥٥٫٧ ملث ثم الإفلات.','زيارة واحدة؛ ظهر ١ و٢ و٢٫٣ وحدات بعد التقريب المعروض.');
const capturedGuide = B('عرض تسجيل مضبوط','تشغيل الاقتراب داخل حد ٤٠ ثم الابتعاد إلى مسافة ٦٥ أثناء الضغط.','عند المؤشر الخام نفسه ظهر أ حرًا وب ملتقطًا بعد دخول نطاق الالتقاط.');
const capturedGuideAndMouse = B('عرض تسجيل مضبوط وسحب فعلي بالزر الأساسي','مراقبة مسافة ٦٥ بعد الدخول في العرض، ثم سحب فعلي من خارج الحد عبر المرساة إلى الجانب الآخر والإفلات عند ٦٤٫٥.','ظهر أ حرًا وب ملتقطًا عند ٦٥ في العرض، وتكررت النتيجة عند ٦٤٫٥ في السحب الفعلي.');
export const archivedPrimaryBrowserChecks = {
  'speed-acceleration/measure.speed':matchedMotion,
  'speed-acceleration/measure.acceleration':matchedMotion,
  'speed-acceleration/contrast.speed-acceleration':matchedMotion,
  'speed-acceleration/contrast.two-records':matchedMotion,
  'time-responses/measure.dwell':timedMouse,
  'time-responses/response.periodic':timedMouse,
  'time-responses/response.integrate':timedMouse,
  'time-responses/contrast.time-responses':timedGuide,
  'time-responses/contrast.same-input':timedGuide,
  'capture-release/boundaries.hysteresis':capturedGuideAndMouse,
  'capture-release/contrast.same-input':capturedGuide
};
// Old observations retain their original version, environment, method and
// result. A new channel never gets a primary observation; a new build is not
// certified by changing a historical version string.
const B2=(method,scenario,result)=>({date:'2026-10-31',version:'one-press-knowledge-2026-10-31-r2',environment:'المعاينة المدمجة للمختبر',method,scenario,result});
export const currentPrimaryBrowserChecks = {
  'button-trace/signal.sample-readout':B2('سحب يدوي فعلي ثم فحص السجل المحفوظ','سحب بالأساسي ثم اختيار العينات الأولى والوسطى والأخيرة بعد الإفلات.','المصدر mouse والحالة released، وعدد العينات ١٠ في كل اختيار. عُرضت (٢٠٣٫٦١،١٠٥٫٧٧،٠ ملث)، ثم (٣٦٤٫٢٩،١٥٠٫٤١،٤٩٫٧ ملث)، ثم (٥٢٤٫٩٨،١٩٥٫٠٤،٥١٣٤٫٢ ملث).'),
  'repeat/contrast.distance-time':B2('عرض تسجيل مضبوط داخل المقارنة','تشغيل التقدم والثبات والرجوع ثم قراءة جدول اللقطات المشتركة.','عند ٤٠٠ ملث: امتداد ٢٠٠ و٤ قطع/٠ آثار؛ عند ١٢٠٠: امتداد ٢٠٠ و٤/٢؛ عند ١٦٠٠: امتداد ١٠٠ و٢/٣ وطول طريق ٣٠٠. الثبات أبقى القطع وزاد الآثار، والرجوع قلل القطع رغم زيادة طول الطريق.')
};
export const browserChecks = {...archivedPrimaryBrowserChecks,...currentPrimaryBrowserChecks};

// Each tuple is a reviewed claim: objective, coverage, role, observation, test.
// Tests below are instructions for checking a claim, not assertions they were run.
const checks = (objectiveId,status,role,observation,test) => ({objectiveId,status,role,observation,test});
const D = (id,role,observation,test) => checks(id,'direct',role,observation,test);
const P = (id,role,observation,test) => checks(id,'partial',role,observation,test);
const M = (id,role,observation,test) => checks(id,'missing',role,observation,test);
const records = new Map();
function R(id, contribution, conceptIds, source, criteria, items, options = {}) {
  const reviewed = options.reviewed || 'source-reviewed';
  // A teaching target may exist before anyone reviews the implementation of
  // that particular claim. Outside the declared targets the answer is `na`.
  const targetIds = [...new Set([...items.map(item => item.objectiveId),...(options.pendingObjectives || [])])];
  const ids = [...new Set([...conceptIds,...targetIds.map(id => objectiveById.get(id).conceptId)])];
  const lesson = lessons[id];
  const completeCheck = browserChecks[`${id}/@completion`];
  const hasObjectiveCheck = items.some(item=>browserChecks[`${id}/${item.objectiveId}`]);
  records.set(id, {
    id, channel:'primary', inputProfile:'primary', scope: options.scope || 'single', contribution, conceptIds: ids,
    objectiveIds: targetIds, source,
    scopeNote: options.scopeNote || 'دورة واحدة من الضغط إلى الإفلات؛ أدوات الشرح وإعادة التشغيل ليست خصائص إضافية للدورة.',
    completion: criteria.map((detail,index) => ({id:`${id}.implementation-${index+1}`,label:index ? 'شرط الحد أو الرفض' : 'شرط السلوك الأساسي',status:reviewed,detail,source}))
      .concat({id:`${id}.explanation`,label:'شرط الشرح ومهمة الملاحظة',status:lesson?'source-reviewed':'unreviewed',detail:lesson?`${lesson.goal} حدّ الشرح: ${lesson.boundary}`:'يلزم تحديد الهدف ومهمة الملاحظة وحدود الشرح.',source:'dist/learning-guide.js · lessons'},
        {id:`${id}.browser`,label:'التحقق التفاعلي من جميع شروط التجربة',status:completeCheck?'browser-verified':'unreviewed',detail:completeCheck?completeCheck.result:hasObjectiveCheck?'فُحصت أهداف محددة في المتصفح كما تبين بطاقات الدليل. لم يسجل فحص لجميع شروط التنفيذ والحدود هنا.':'لم يُسجَّل فحص متصفح لشروط هذه التجربة في هذه النسخة. قراءة المصدر لا تعني اجتياز فحص تفاعلي.',browserCheck:completeCheck||null}),
    items: targetIds.map(objectiveId => {
      const item = items.find(i=>i.objectiveId===objectiveId);
      return item ? {...item,source:item.source||source,reviewed:item.status==='unreviewed'?'unreviewed':reviewed} :
        {objectiveId,status:'unreviewed',role:'هدف معلن ينتظر المراجعة',observation:'لم يُحسم مدى تمثيل هذا الادعاء في هذه التجربة بعد.',test:'افحص وظيفة المكوّن وواجهة العرض ومهمة الملاحظة قبل تسجيل الحكم.',source,reviewed:'unreviewed'};
    })
  });
}

R('button-trace','تفكيك الإشارة إلى قياسات؛ ليس كل قياس قناة إدخال مستقلة.',
 ['button-state','pointer-position','timestamps','gesture-record','duration','displacement','path-length','direction','speed','pause-duration','target-dwell'],
 'dist/button-lab.js · createButtonRecorder / createSampleInspector / paintInspector / paint',
 ['يبدأ سجل جديد عند الضغط ويحتفظ بالقياسات والأحداث بعد الإفلات.','تحتسب مدة الضغط والوقفات والسرعة الحديثة بنافذة ١٢٠ ملث؛ لا توجد قراءة تسارع في هذه اللوحة.'],[
 D('signal.button','إظهار','تعرض الدورة الضغط والاستمرار والإفلات بأعلام held وreleased.','اضغط واثبت ثم أفلت؛ تابع مراحل الدورة.'),
 D('signal.position','إظهار','نقطة البداية والمؤشر وخط المسار تتبع الإحداثيات المسجلة.','ابدأ من موضعين مختلفين في دورتين وشاهد العلامات.'),
 D('signal.time','إظهار','قائمة الأحداث تعرض زمن كل حدث منذ البداية.','تحرك ثم اثبت ثم أفلت واقرأ زمن كل حدث.'),
 D('signal.trace','تسجيل','تجمع begin/sample/finish بداية ومسارًا ونهاية في سجل واحد.','ارسم التفافًا ثم أفلت؛ يجب أن يبقى الطريق ظاهرًا.'),
 D('signal.sample-readout','فحص عينة خام','يتيح الفاحص اختيار عينة ضغط أو حركة أو إفلات وقراءة س وص وزمنها مع علامة على المسار. يميز أحداث الفأرة المستلمة من عينات العرض المضبوط؛ تقدم ساعة العرض وحده لا يولد صفًا حقيقيًا.','اسحب فعليًا ثم اختر الأولى والوسطى والأخيرة واقرأ الموضع والزمن. كرر بالعرض المضبوط وتحقق من وسم مصدر العينات.'),
 D('measure.duration','قياس','duration يساوي الزمن الحالي ناقص البداية، بما فيه الوقفات.','اثبت أثناء الضغط؛ تابع استمرار عداد المدة.'),
 D('measure.displacement','قياس','displacement يحسب المسافة بين البداية والموضع الحالي.','عد إلى البداية واقرأ الإزاحة.'),
 D('measure.length','قياس','length يجمع أطوال الخطوات المتتالية.','اذهب وعد؛ يجب أن يزيد الطول رغم العودة.'),
 D('measure.direction','قياس','heading يعرض زاوية آخر تغير ذي طول كافٍ.','غيّر اتجاه النهاية مع بقاء مسار سابق منحني.'),
 D('measure.speed','قياس','تعرض السرعة الحديثة من طول المسار داخل نافذة ١٢٠ ملث.','تحرك ثم اثبت مدة أطول من النافذة.'),
 D('measure.pause','قياس','pause يبدأ منذ آخر خروج من دائرة سماح قدرها وحدتان.','اثبت ثم تحرك أكثر من السماح؛ افحص إعادة العداد.'),
 D('measure.dwell','قياس','longestDwell يعرض أطول إقامة متصلة في مستطيل الهدف.','تحرك داخل الهدف ثم اخرج وأعد الدخول.'),
 D('contrast.displacement-length','مقارنة','عرض العودة إلى البداية يفصل الإزاحة النهائية عن الطول المتراكم.','شغّل «عد إلى البداية» واقرأ القيمتين.'),
 D('contrast.speed-variants','مقارنة','تظهر الحديثة والمتوسطة وسرعة الإفلات معًا.','شغّل «سحب ثم وقفة» وقارن المتوسط بسرعة الإفلات.'),
 D('contrast.hold-pause','مقارنة','عدادا مدة الضغط والثبات يتغيران بقواعد مختلفة.','تحرك باستمرار ثم اثبت قبل الإفلات.'),
 D('contrast.pause-dwell','مقارنة','الثبات وإقامة الهدف محسوبان مستقلين.','تحرك داخل الهدف؛ يرتفع البقاء دون ثبات طويل.'),
 D('contrast.two-records','مقارنة','البطيء والسريع لهما الطرفان والمسافة نفسهما وأزمنة مختلفة.','شغّل السحب البطيء ثم السريع؛ لا تدعِ تثبيت الزمن.'),
 P('contrast.speed-acceleration','حد التمثيل','تُعرض السرعة فقط؛ لا يحسب هذا المكوّن التسارع ولا يعرض مقارنته.','افتح تجربة السرعة والتسارع لقياس الفرق؛ لا تعدّ وصفه هنا قياسًا.')
]);
R('button-phases','قواعد توقيت مختلفة تقرأ دورة واحدة؛ لا مفاضلة جديدة خارج الضغط والسحب.',
 ['gesture-record','duration','pause-duration','threshold-test','phase-gate','target-drop'],
 'dist/button-lab.js · ruleCards / createButtonRecorder.fire / paint',
 ['تستجيب ست بطاقات لشروط مستقلة على السجل نفسه.','عتبات ٨ وحدات و٦٠٠ و٤٠٠ ملث تخص هذا المثال؛ العودة لا تمحو بدء السحب.'],[
 D('phases.press','أثر','تُسجل press عند begin مباشرة.','اضغط دون حركة وشاهد البطاقة الأولى.'),
 D('phases.hold','أثر','تتحقق hold بعد ٦٠٠ ملث سواء تحرك المؤشر أم ثبت.','تحرك لأكثر من ٦٠٠ ملث دون توقف.'),
 D('phases.drag','أثر','تسجل firstDrag عند تجاوز أكبر إزاحة ٨ وحدات.','ابتعد ثم عد إلى البداية قبل الإفلات.'),
 D('phases.pause','أثر','pause يُطلق مرة بعد ٤٠٠ ملث ضمن سماح الثبات.','تحرك ثم اثبت والزر مضغوط.'),
 D('phases.release','أثر','release تُسجل في finish الطبيعي وحده.','أفلت خارج الهدف ثم قارنه بإفلات داخله.'),
 D('boundaries.valid-drop','شرط','target يجمع الإفلات مع الاحتواء في المستطيل.','مر فوق الهدف ثم أفلت خارجه؛ لا تتفعّل بطاقة الإفلات داخله.'),
 D('contrast.hold-pause','مقارنة','استمرار الضغط والثبات بطاقتان بتوقيت وشرط مختلفين.','تحرك طويلًا ثم اثبت؛ افحص تسلسل البطاقتين.'),
 D('contrast.same-input','مقارنة','تُحسب البطاقات كلها من recorder واحد.','نفّذ ضغطة واحدة وتابع شروطها مجتمعة.')
]);
R('compare-commit','تمييز توقيت تعديل الحالة عن مجرد ظهور المعاينة.',
 ['same-trace-contrast','preview-commit','state-memory','mapping'],
 'dist/contrasts.js · commit',
 ['تغيّر الحركة immediate بينما يبقى committed ثابتًا حتى الإفلات.','تعرض pending القيمة المقترحة منفصلة؛ الإفلات يعتمدها.'],[
 D('phases.preview-commit','مقارنة','يعرض جانبان القيمة الفعلية مقابل المعتمد والمعاينة.','حرّك واثبت قبل الإفلات واقرأ المعتمدين.'),
 D('phases.release','أثر','committed=value يحدث داخل release.','أفلت ثم تأكد من اعتماد القيمة المقترحة.'),
 D('contrast.same-input','مقارنة','الموضع المشترك يصل إلى الجانبين في move.','شغّل العرض المشترك أو اسحب المقبض الواحد.')
]);
R('compare-threshold','العبور حدث محفوظ؛ قبول النهاية اختبار آخر.',
 ['same-trace-contrast','crossing-memory','threshold-test','state-memory'],
 'dist/contrasts.js · threshold',
 ['يحفظ latched وقوع عبور ٨٠ من الجانب الأقل.','releasedResult يختبر آخر قيمة عند الإفلات؛ الرجوع لا يمحو latched.'],[
 D('response.crossing','أثر','تسجل latched عند الانتقال عبر الحد وتبقى بعد الرجوع.','اسحب إلى ٩٥ ثم ٤٠ دون إفلات بينهما.'),
 D('response.threshold','شرط','حد ٨٠ معلن ومشترك بين النموذجين.','اقرأ شرط كل جانب عند موضع أدنى وأعلى من الحد.'),
 D('contrast.crossing-release','مقارنة','عند الإفلات في ٤٠ يبقى العبور صحيحًا وشرط النهاية خاطئًا.','نفّذ ٩٥ ثم ٤٠ ثم أفلت.'),
 D('contrast.same-input','مقارنة','المقبض الواحد يرسل القيم نفسها إلى الحدث وشرط النهاية.','تابع جانبي المقارنة أثناء سحبة واحدة.')
]);
R('compare-path','تثبيت الطرفين يسمح برؤية اختلاف الطريق المقاس.',
 ['gesture-record','path-length','displacement','two-trace-contrast','accumulation'],
 'dist/contrasts.js · path / lineLength / samplesFor',
 ['يجمع طول المقاطع الفعلية ويعرض آخر طولين مع نهاية مشتركة.','الإفلات خارج دائرة النهاية يرفض الطريق ويحفظ السابق.'],[
 D('measure.length','قياس','lineLength يجمع المقاطع ويعرض طول الطريق.','ارسم طريقًا ملتفًا واقرأ الطول.'),
 D('contrast.displacement-length','مقارنة','الطريقان ينتهيان عند (٨٨،٥٠) مع اختلاف الأطوال.','نفّذ المباشر ثم الملتف وقارن الطولين.'),
 D('contrast.position-path','مقارنة','جانب يقرأ آخر نقطة وجانب يرسم كل النقاط.','انته في الوجهة نفسها عبر طريق آخر.'),
 D('contrast.two-records','مقارنة','العرض يوفر طريقين يثبتان البداية والنهاية؛ الزمن وشكل الطريق ليست جميعها ثابتة.','شغّل الطريقين واقرأ شروط المقارنة.'),
 D('boundaries.valid-drop','شرط','release يقبل reached وإلا يستعيد saved.','أفلت بعيدًا عن النهاية بعد وجود مسار معتمد.')
]);
R('compare-rate','تفسير الموضع كمعدل يكشف أثر الزمن حتى مع ثبات اليد.',
 ['same-trace-contrast','mapping','integration','duration'],
 'dist/contrasts.js · rate / integrate',
 ['تحدد handValue موضع جانب وسرعة الجانب الآخر.','الإفلات يعيد المدخل للوسط ويوقف التكامل مع بقاء الموضع المتراكم.'],[
 D('response.integrate','أثر','position يزداد بسرعة مشتقة من المدخل مضروبة في dt.','ابتعد عن الوسط واثبت؛ راقب استمرار الجانب الثاني.'),
 D('response.mapping','تحويل','سرعة الناتج ليست سرعة اليد؛ هي تحويل الإزاحة عن الوسط.','ثبّت اليد خارج الوسط وشاهد سرعة غير صفرية.'),
 D('contrast.same-input','مقارنة','القيمة المشتركة نفسها تفسر موضعًا ومعدلًا.','شاهد الجانبين في السحبة نفسها.'),
 P('contrast.time-responses','حد التمثيل','يوجد موضع مباشر وتراكم مستمر؛ لا أثر دوري ولا أثر واحد مؤقت في هذه اللوحة.','استخدم مقارنة الاستجابات الزمنية لإكمال الفرق الثلاثي.')
]);
R('magnet','مقارنة ثلاثة قيود مكانية؛ الالتقاط هنا لا يحفظ ذاكرة حدين.',
 ['magnet','grid','same-trace-contrast','target-context','threshold-test'],
 'dist/completion-controls.js · magnetReadings / magnetMode',
 ['يتلقى الحر والشبكة والانجذاب raw نفسه ويعرض كل ناتج.','الالتقاط والفك كلاهما عند نصف القطر ١٢؛ لا تستخدم الدالة حالة الالتقاط السابقة.'],[
 D('boundaries.magnet','قيد','distance<=12 يختار الهدف وإلا يختار الموضع الحر.','اقترب ثم ابتعد عبر دائرة الالتقاط.'),
 D('boundaries.grid','قيد','يقرب كل محور لأقرب مضاعف ٢٠.','ضع المدخل بين خطوط الشبكة.'),
 D('contrast.grid-magnet','مقارنة','عند ٦٢،١٦ تظهر ثلاث نتائج متمايزة مع هدف واحد.','شغّل العرض حتى المدخل المقترح.'),
 D('contrast.same-input','مقارنة','magnetReadings يعيد ثلاثة مخارج من raw واحد.','تابع القيم الثلاث دون تغيير إعدادات أثناء الضغط.'),
 P('boundaries.hysteresis','حد التمثيل','يبين حدًا واحدًا فقط؛ يصلح طرفًا مرجعيًا للمقارنة مع الحدين ولا يثبتها بمفرده.','افتح مقارنة حد الالتقاط والفك؛ لا تستنتج حدين من لون الانجذاب.')
]);
R('compare-constraint','الفرق سببه تقريب الناتج مع بقاء المدخل نفسه.',
 ['grid','direct-follow','same-trace-contrast'],
 'dist/contrasts.js · constraint / snapped',
 ['يعرض موضعًا حرًا وموضعًا مقربًا إلى أقرب عشرين من المدخل نفسه.','كلا الموضعين محصور في المجال المعلن.'],[
 D('boundaries.grid','قيد','snapped يقرب x وy لأقرب ٢٠.','اسحب إلى منتصف المسافة بين خطين.'),
 D('response.follow','أثر','جانب يحتفظ بالقيمة الحرة دون تقريب.','حرك مقدارًا صغيرًا داخل خانة واحدة.'),
 D('contrast.same-input','مقارنة','الجانبان مشتقان من p نفسه.','قارن الناتجين أثناء الضغط المستمر.')
]);
R('turns','قياس مشتق يحفظ اللفات التي تخفيها زاوية الموضع.',
 ['angle','turns','accumulation','direction'],
 'dist/extensions.js · mountTurns / move / render',
 ['يجمع فروق الزوايا الموقعة بعد معالجة عبور ±١٨٠.','يتجاهل الاقتراب الشديد من المركز؛ عكس الدوران ينقص المجموع.'],[
 D('measure.angle','قياس','تُعرض زاوية الموضع الحالية modulo 360.','عد إلى الاتجاه نفسه بعد لفة.'),
 D('measure.turns','قياس','يعرض total وعدد الدورات الكاملة.','اسحب أكثر من لفة دون إفلات.'),
 D('response.accumulate','أثر','total+=delta يحتفظ بكل فروق الزوايا.','اعكس الاتجاه وشاهد تناقص المجموع.'),
 D('contrast.angle-turns','مقارنة','الدوران ٤٥٠ يعطي موضعًا ٩٠ ومجموعًا ٤٥٠.','شغّل العرض المضبوط ثم اقرأ القيمتين.')
]);
R('dwell','تركيب البقاء الزمني وفتح السياق وقبول الإفلات.',
 ['target-dwell','composition-chain','target-context','target-drop','state-memory'],
 'dist/extensions.js · mountDwell / hoverTick / end',
 ['يفتح المجلد بعد بقاء متصل ٩٠٠ ملث والبطاقة محمولة.','الخروج المبكر يصفر المؤقت؛ الإفلات غير الصالح يعيد حالة الملف والمجلد السابقة.'],[
 D('measure.dwell','قياس','شريط وتوقيت يعرضان تقدم البقاء حتى ٩٠٠ ملث.','تحرك داخل المجلد دون خروج ثم اخرج وأعد الدخول.'),
 D('composition.dwell-drop','تركيب','hoverTick يفتح الوجهة ثم end ينقل البطاقة داخل وجهة مكشوفة.','افتح بالانتظار وأفلت داخل أحد القسمين دون رفع الزر بين المرحلتين.'),
 D('boundaries.valid-drop','شرط','يلزم مجلد مفتوح ونقطة داخل أحد targets.','أفلت قبل الفتح أو خارج القسمين.'),
 P('contrast.pause-dwell','حد التمثيل','يتحقق البقاء مع الحركة داخل الهدف، لكن لا يعرض مؤقت الثبات المقابل.','قارن عدادي الثبات والبقاء في بصمة الضغطة.')
]);
R('relations','نتائج مختلفة للعضوية والهوية والعلاقة من قبول الإفلات.',
 ['application-results','target-drop','state-memory','contextual-mode','capacity'],
 'dist/extensions.js · mountRelations / apply / end',
 ['النقل يزيل المصدر، والنسخ ينشئ هوية جديدة، والربط يحفظ الطرفين ويضيف وصلة.','يرفض النسخ عند امتلاء الهدف ويرفض تكرار الرابط؛ يختار الوضع قبل الحمل.'],[
 D('application.transfer-relate','تطبيق','تظهر هويات المصدر والهدف وقائمة الروابط لكل وضع.','جرّب النقل ثم النسخ ثم الربط من البداية نفسها.'),
 D('contrast.output-result','مقارنة نتائج','يبقى شكل السحب إلى الوجهة ويختلف ما يتغير في البيانات.','تابع بقاء الأصل وعدد السجلات والوصلات.'),
 D('boundaries.capacity','شرط','النسخ محدود بثلاثة سجلات والرابط لا يتكرر.','كرر النسخ حتى الامتلاء ثم جرّب ربطًا مكررًا.'),
 D('boundaries.valid-drop','شرط','end لا يستدعي apply خارج targetBounds.','أفلت خارج الوجهة وشاهد بقاء البيانات.')
]);
R('lasso','تطبيق احتواء باستخدام مساحة يرسمها الطريق المغلق.',
 ['closure','hit-test','gesture-record','application-results'],
 'dist/extensions.js · mountLasso / polygonCrossesItself / pointInPolygon',
 ['يختار مراكز العناصر داخل المضلع عند إفلات صالح.','يرفض الفتح والتقاطع الذاتي والصغر والخروج ويحفظ التحديد السابق.'],[
 D('boundaries.closure','قيد','يفحص قرب النهاية من البداية وطولًا ومساحة وتقاطعًا ذاتيًا.','قارن محيطًا مغلقًا بمفتوح ثم شكل يتقاطع مع نفسه.'),
 D('response.containment','أثر','pointInPolygon يختبر مركز كل عنصر.','أحط بمركز عنصر واترك مركز آخر خارجه.'),
 D('application.select-area','تطبيق','تتغير selected دون نقل مواضع العناصر.','شاهد الهوية المحددة ومكانها بعد الإفلات.'),
 P('measure.length','استخدام داخلي','يُحسب length لرفض الطريق القصير، ولا تُعرض قيمته كقياس مستقل.','افتح بصمة الضغطة أو مقارنة الطريق لقراءة الطول مباشرة.')
]);
R('group','تركيب نقل مشترك مع قيد يحفظ العلاقات الداخلية.',
 ['group-invariant','displacement','bounds-obstacles','preview-commit'],
 'dist/extensions.js · mountGroup / validity / commit',
 ['تضاف الإزاحة نفسها إلى العناصر الثلاثة.','يفحص كل عنصر قبل اعتماد المجموعة ويرفضها كاملة عند أي تعارض.'],[
 D('boundaries.group','قيد','كل عنصر يتحرك بإزاحة preview نفسها ولا يعتمد جزء من المجموعة.','أفلت بحيث يتداخل عنصر واحد مع العائق.'),
 D('response.follow','أثر','تضاف إزاحة اليد إلى before لكل المجموعة.','راقب ثبات المسافات بين العناصر أثناء الحمل.'),
 D('boundaries.obstacle','قيد','validity يفحص حدود وعائق كل قطعة عند commit.','مر بالمعاينة فوق العائق ثم أفلت بعده في موضع صالح.'),
 D('phases.preview-commit','أثر','offset معتمد وpreview مؤقت ويعيد الرفض الأخير.','راقب أثر الإفلات الصالح والمرفوض.')
]);
R('history','أداة لاحقة لفهم السجل؛ مستبعدة من تعداد إمكانات الضغطة الواحدة.',
 ['history-tool','state-memory','preview-commit'],
 'dist/completion-history.js · createUndoHistory / mountHistory',
 ['تدخل الاعتمادات الصالحة وحدها السجل، وتتجاهل المعاينة والإفلات المرفوض.','التراجع والإعادة ينقلان المؤشر داخل السجل؛ اعتماد جديد بعد التراجع يحذف فرع الإعادة.'],[
 D('tools.history','أداة لاحقة','undo/redo/reset أوامر بعد انتهاء الحركة وليست مقاييس لها.','اعتمد نقلتين ثم انقر التراجع بعد الإفلات.'),
 D('phases.preview-commit','سياق الأداة','pending منفصل عن history.value قبل الاعتماد.','عاين فوق العائق ثم أفلت؛ لا يضاف سجل جديد.')
],{scope:'tool',scopeNote:'هذه الصفحة تشرح أدوات تعمل عبر عدة عمليات لاحقة. لا تُحتسب ضمن مجموع تجارب الضغطة الواحدة؛ وجود سحب فيها لا يحوّل التراجع إلى خاصية للسحب.'});
R('delete','الحذف بالإفلات تطبيق داخل النطاق؛ استرجاعه أداة لاحقة.',
 ['application-results','target-drop','state-memory','history-tool'],
 'dist/completion-history.js · applyCardDrop / mountDelete.end',
 ['يزيل الإفلات على الحذف السجل من المجموعة الفعالة ويقل العدد.','النقل يحفظ الهوية والعدد، والإفلات غير الصالح يحفظ المجموعة.'],[
 D('application.delete','تطبيق','applyCardDrop يستبعد id من items عند هدف الحذف.','انقل بطاقة ثم أفلتها في الحذف واقرأ العدد والهويات.'),
 D('contrast.output-result','مقارنة نتائج','الموضع داخل المساحة ينقل السجل والهدف الآخر يحذفه.','قارن عدد السجلات وهوياتها بعد النقل وبعد الحذف.'),
 D('boundaries.valid-drop','شرط','المنطقة بين مساحة النقل والحذف تعطي reject.','أفلت في الفراغ غير الصالح.'),
 D('tools.history','حد النطاق','زر التراجع يعيد الحالة بأمر مستقل بعد الضغطة.','أتم الحذف أولًا ثم انقر التراجع؛ لا تحسبها حركة واحدة.')
],{scopeNote:'الحذف يبدأ بالضغط وينتهي بالإفلات على الهدف. التراجع واستعادة البطاقة بعده إجراء منفصل خارج خصائص هذه الضغطة.'});
R('signals','عرض أن القيمة المشتركة لا تفرض معنى واحدًا للناتج.',
 ['mapping','same-trace-contrast','application-results','contextual-mode'],
 'dist/insights.js · mountSignals / draw',
 ['يرسل value نفسه إلى موضع وزاوية ووقت في ثلاث لوحات.','النماذج مستقلة؛ الوقت المعروض ليس مدة الضغط، والزاوية ناتج تحويل أفقي وليست قياس زاوية اليد حول مركز.'],[
 D('response.mapping','تحويل','draw يحول u إلى موضع وإلى u*75 وإلى وقت بخطوات ١٥ دقيقة.','ثبّت المقبض واقرأ النواتج الثلاثة.'),
 D('contrast.same-input','مقارنة','المشاهد الثلاثة مشتقة من value نفسه في draw واحد.','حرك المقبض الوحيد.'),
 D('contrast.output-result','مقارنة نتائج','تختلف معاني المخارج دون تغيير مصدر الإدخال.','فرّق بين الوقت المصوّر ووقت الضغطة الحقيقي.')
]);
R('chain','إفلات واحد يبدأ مراحل داخل التطبيق دون ضغطات تالية.',
 ['composition-chain','post-release','conservation','capacity','state-memory','target-drop'],
 'dist/consequences.js · finishDrag / requestTransfer / tick / render',
 ['يبدأ الإفلات الصالح تحققًا ثم حجزًا وتكليفًا وحملًا وتسليمًا.','busy يرفض أمرًا متزامنًا؛ مجموع المخزن والمحمول والمحل يبقى ثلاثة.'],[
 D('composition.chain','تركيب','تعرض steps وphase حالات متتابعة بعد requestTransfer.','أفلت صندوقًا ثم تابع المراحل دون إدخال جديد.'),
 D('phases.after','أثر','requestAnimationFrame يكمل المهمة بعد انتهاء السحب.','ارفع يدك بعد الإفلات وراقب التسليم.'),
 D('boundaries.conservation','قيد','العداد يجمع warehouse وcarried وshop.','اقرأ الإجمالي قبل الالتقاط وأثناء الحمل وبعد التسليم.'),
 D('boundaries.capacity','شرط','busy والتوفر يمنعان تنفيذ أمر غير قابل للبدء.','حاول سحب صندوق آخر أثناء انشغال العامل.')
]);
R('reveal','تطبيق تحويل الموضع إلى مساحة مكشوفة.',
 ['mapping','application-results','target-context'],
 'dist/comparisons.js · revealMode / render',
 ['يغير موضع الفاصل x وعرض clip دون نقل محتوى المشهد.','يُحصر الكاشف بين صفر ومئة.'],[
 D('response.mapping','تحويل','fromPoint يحول x إلى نسبة ثم clip إلى مساحة كشف.','حرك الفاصل وراقب الجزء المكشوف.'),
 D('application.reveal-time','تطبيق','تبقى عناصر الطبقتين متطابقة الموضع ويتغير القص.','تتبع الباب عند عبور الفاصل فوقه.')
]);
R('momentum','قياس قرب الإفلات يحدد أثرًا لاحقًا تلقائيًا.',
 ['speed','direction','post-release','two-trace-contrast'],
 'dist/physics.js · createMomentum / velocity / release / tick',
 ['تشتق velocity من عينات حديثة ثم تحفظ متجه الإفلات.','تتباطأ الحركة داخل الحدود؛ تقليل الحركة يعرض نتيجة مختصرة.'],[
 D('measure.speed','قياس','القراءة مشتقة من نافذة عينات حديثة موضحة في التنفيذ.','قارن الدفعة البطيئة والسريعة واقرأ السرعة.'),
 D('measure.direction','قياس','اتجاه متجه الإفلات يظهر باسم اتجاه وسهم.','أفلت بعد سحب في اتجاهين مختلفين.'),
 D('phases.after','أثر','tick يطبق الحركة والتخميد بعد release.','أفلت أثناء الحركة ثم تابع القرص.'),
 D('contrast.two-records','مقارنة','العرضان البطيء والسريع يغيران زمن قطع مسافة مقررة.','شغّل النوعين من البداية نفسها.'),
 P('contrast.speed-variants','حد التمثيل','يعرض سرعة الإفلات ولا يعرض المتوسط معها.','قارن القراءات الثلاث في بصمة الضغطة.')
]);
R('repeat','تحويل الامتداد إلى عدد قطع ومقارنته بعدّ آثار الزمن من السجل نفسه.',
 ['mapping','grid','application-results','displacement','time-repeat','duration','same-trace-contrast'],
 'dist/comparisons.js · repeatMode',
 ['عدد القطع يساوي امتداد x من المرساة مقسومًا على ٥٠ ومقربًا، وفي عرض المقارنة يقابله أثر لكل ٥٠٠ ملث من الضغط نفسه.','عدد القطع محصور بين ١ و١٢؛ الزمن وطول الطريق لا يدخلان حساب القطع. الإفلات أو المقاطعة ينهيان العد الزمني.'],[
 D('response.mapping','تحويل','fromPoint يحول الامتداد من نقطة ثابتة إلى قيمة العدد.','مد النهاية ثم أعدها.'),
 D('boundaries.grid','قيد','normalize يقرب العدد إلى خطوة صحيحة.','تجاوز حد نصف قطعة وراقب انتقال العدد.'),
 {...D('contrast.distance-time','مقارنة مباشرة','في «قارن الامتداد بالزمن» تحسب snapshot من السجل نفسه قطع السياج بحسب الامتداد الأفقي من المرساة وآثارًا بحسب كامل زمن الضغط. طول الطريق معروض لكنه لا يحكم عدد القطع.','شغّل التقدم والثبات والرجوع. قارن ٤/٠ ثم ٤/٢ ثم ٢/٣ في اللقطات المشتركة.'),source:'dist/spatial-time.js · createSpatialTimeRecorder.snapshot / spatialTimeSamples / mountSpatialTime'},
 {...D('response.periodic','قاعدة في عرض المقارنة','يعرض الجانب الزمني عدد فترات ٥٠٠ ملث المكتملة منذ بداية الضغط، ولو بقي الموضع ثابتًا. بناء السياج الأصلي وحده لا يبرهن هذا الادعاء.','اختر عرض المقارنة واضغط واثبت، ثم أفلت؛ اقرأ عدد الآثار ومتى يتوقف.'),source:'dist/spatial-time.js · createSpatialTimeRecorder.advance / snapshot / mountSpatialTime'}
]);
R('brush','أثر موزع على المقاطع التي تعبرها الأداة.',
 ['gesture-record','hit-test','accumulation','application-results'],
 'dist/materials.js · mountBrush / segmentDistance',
 ['يختبر بعد البقع عن كل مقطع من حركة الإسفنجة.','Set يمنع احتساب البقعة المنظفة مرتين.'],[
 D('response.containment','أثر','segmentDistance يختبر تقاطع مرور الأداة مع البقعة.','مر عبر بقعتين وأفلت فوق مساحة نظيفة.'),
 D('response.accumulate','أثر','cleaned يجمع هويات البقع المتأثرة.','عد فوق بقعة نظيفة وتحقق أن العدد لا يتضاعف.'),
 D('contrast.position-path','إظهار فرق','النهاية النظيفة لا تمحو البقع التي تأثرت في الطريق.','من حالة نظافة ابتدائية واحدة، أنهِ السحبة في الموضع نفسه عبر طريق يمر ببقع مختلفة.')
]);
R('mix','حالة محتوى الوعاء تجعل السحبة التالية تنتج نتيجة أخرى.',
 ['state-memory','application-results','target-drop','capacity'],
 'dist/materials.js · mountMix / amounts / add',
 ['تضيف السحبة المقبولة المكون إلى amounts وتحدّث هوية المحتوى.','لكل مكون حصة واحدة؛ اكتمال الوصفة يتطلب سحبتين منفصلتين.'],[
 D('composition.stateful-mix','حالة سابقة','هوية المنتج تعتمد على مجموع المكونين الموجودين.','قارن إضافة البهارات إلى وعاء فارغ وإلى وعاء فيه الحمص.'),
 D('application.transfer-relate','تطبيق','تنتقل الحصة من مصدرها إلى الوعاء.','راقب الباقي في المصدر ومحتوى الوعاء.'),
 D('boundaries.capacity','شرط','amounts يمنع إعادة استخدام مكون نفدت حصته.','حاول استخدام المكون نفسه بعد إضافته.'),
 D('boundaries.valid-drop','شرط','inside يختبر القطع الناقص للوعاء عند end.','أفلت خارج الوعاء وتحقق من بقاء الحصة.')
],{scopeNote:'كل إضافة ضغطة مستقلة ضمن النطاق. الوصفة الكاملة تحتاج إضافة مكونين بسحبتين؛ لا تُعرض السحبتان كإيماءة واحدة أو كإشارة جديدة.'});
R('timeline','الوقت هنا قيمة معروضة يحكمها الموضع، وليس زمن الانتظار.',
 ['mapping','grid','application-results'],
 'dist/comparisons.js · timelineMode / snapshot',
 ['يحول الموضع إلى وقت بين ٠٨:٠٠ و٢٠:٠٠ ثم يختار بيانات اللقطة.','خطوة الوقت ١٥ دقيقة؛ العودة إلى الوقت نفسه تعيد البيانات نفسها.'],[
 D('response.mapping','تحويل','fromPoint يحدد دقيقة اللقطة وsnapshot يعيد بياناتها.','اذهب إلى وقت آخر ثم عد إلى الأول.'),
 D('boundaries.grid','قيد','normalize يقرب الوقت إلى ١٥ دقيقة.','حرك المؤشر مقدارًا صغيرًا بين الخطوات.'),
 D('application.reveal-time','تطبيق','الإضاءة والزبائن والمبيعات الافتراضية تتبع الوقت المختار.','ثبّت المؤشر؛ لا ينبغي تراكم مبيعات بفعل الانتظار.')
]);
R('elastic','تركيب الإزاحة مع نموذج عودة يبدأ عند الإفلات.',
 ['displacement','post-release','state-memory','direct-follow'],
 'dist/physics.js · createElastic / release / tick',
 ['يشوه الإمساك العنصر وفق موضع الطرف ويعرض مقدار الشد.','يحرر الإفلات محاكاة إرجاع مخمدة نحو الأصل ضمن الحدود.'],[
 D('response.follow','أثر','الطرف يتبع المؤشر المقيد أثناء الإمساك.','شد الطرف واثبت قبل الإفلات.'),
 D('measure.displacement','قياس','تعرض المسافة عن موضع الراحة ومقدار الشد.','قارن شدًا خفيفًا وآخر أكبر.'),
 D('phases.after','أثر','tick يحسب العودة بعد release حتى الاستقرار.','أفلت وراقب العودة دون حركة جديدة.')
]);
R('gesture','تفسير شكل الطريق إلى أمر؛ ليست الإشارة أمرًا بذاتها.',
 ['shape-recognition','gesture-record','threshold-test','application-results'],
 'dist/materials.js · recogniseShape / mountGesture.execute',
 ['تقرأ دائرة أو Z بقواعد هندسية وتبدل الإضاءة أو الباب.','ترفض الشكل غير المعروف أو الخارج دون تغيير الأوامر.'],[
 D('response.recognize','أثر','التعرف يستخدم إعادة أخذ عينات وشروط شكل قبل تنفيذ الأمر.','ارسم دائرة ثم Z ثم خطًا غير معروف.'),
 D('contrast.position-path','إظهار فرق','هيئة الطريق هي المدخل للقرار لا نقطة نهايته فقط.','ارسم شكلين مختلفين تنتهي قرب المنطقة نفسها.'),
 P('measure.turns','استخدام داخلي','يحسب turn ضمن شروط الدائرة، ولا يعرض مجموع الدوران للمتعلم.','افتح تجربة الدورات لقراءة هذا القياس مباشرة.')
]);
R('threshold','تطبيق اختبار عتبة عند الإفلات.',
 ['threshold-test','target-drop','phase-gate','application-results'],
 'dist/materials.js · mountThreshold / commit',
 ['يفتح المحل عند الإفلات إذا progress>=0.9.','الإفلات المبكر يعيد المقبض ويبقي المحل مغلقًا.'],[
 D('response.threshold','شرط','تعرض ٩٠٪ كحد يسمح بالتأكيد.','قارن إفلاتًا دون الحد وآخر بعده.'),
 D('phases.release','أثر','commit يستدعى في end ويختبر آخر progress.','تجاوز الحد ثم عد دونه قبل الإفلات.'),
 P('contrast.crossing-release','حد التمثيل','المثال يشرح شرط النهاية فقط ولا يحتفظ بحدث عبور منفصل.','افتح مقارنة العبور والإفلات لرؤية القرارين معًا.')
]);
R('flow','تركيب زاوية ومعدل وزمن مع قيود كمية.',
 ['composition-flow','angle','integration','conservation','capacity','threshold-test'],
 'dist/physics.js · createFlow / rate / integrate / release',
 ['تحدد الزاوية فوق ٣٠° معدلًا وتزيد الكمية بمعدل*زمن حتى مع ثبات اليد.','يتوقف المصدر أو السعة عند النفاد، ويعيد الإفلات الميل إلى صفر.'],[
 D('measure.angle','قياس','pointerAngle يقرأ الموضع حول pivot ثم يعرض زاوية الوعاء.','غيّر الميل واقرأ الزاوية.'),
 D('response.integrate','أثر','integrate ينقل currentRate*seconds مع حفظ الحالة.','اثبت عند ميل صالح وراقب استمرار الصب.'),
 D('boundaries.conservation','قيد','source=total-cup ويُعرض مجموع ١٠٠.','اقرأ الإناء والكوب أثناء الصب.'),
 D('boundaries.capacity','شرط','النقل محدود بالمصدر والمساحة الباقية في الكوب.','استمر حتى النفاد وتحقق من توقف التدفق.'),
 D('composition.flow','تركيب','القياس والتحويل والتكامل وقيود الكمية تعمل في العملية نفسها.','قارن ميلين لمدة متقاربة ثم مدة أطول عند ميل ثابت.')
]);
R('move','تطبيق نقل عنصر بمعاينة وشبكة وقبول موضع النهاية.',
 ['direct-follow','preview-commit','bounds-obstacles','grid','application-results','target-context'],
 'dist/basic.js · move / valid / update / drag.end',
 ['تعرض الطاولة معاينة مقربة لخطوة عشر وحدات ثم تعتمد عند إفلات صالح.','يرفض التداخل مع الأثاث والممر ويحفظ الموضع السابق.'],[
 D('application.move-view','تطبيق','يتغير موضع الطاولة داخل العالم.','ضعها في مساحة فارغة وتابع الأثاث الثابت.'),
 D('phases.preview-commit','أثر','before محفوظ وموضع جديد لا يعتمد إلا داخل end الصالح.','عاين فوق عائق ثم أفلت.'),
 D('boundaries.obstacle','قيد','valid يختبر حدود الغرفة وثلاثة عوائق.','جرّب الغرفة والممر والأثاث.'),
 P('boundaries.grid','قيد مستخدم','update يقرب الموضع إلى عشر وحدات، دون مقارنة حر/شبكة مخصصة هنا.','راقب القفزات الصغيرة أو افتح مقارنة القيد.')
]);
R('pan','تطبيق تغيير منظور المشهد مع بقاء مواضع العالم.',
 ['direct-follow','displacement','bounds-obstacles','application-results'],
 'dist/basic.js · pan / constrained / draw',
 ['ينقل world وفق الإزاحة ويحدّث نافذة الخريطة المصغرة.','clamp يمنع كشف منطقة خارج أبعاد العالم.'],[
 D('application.move-view','تطبيق','يتحرك تحويل العرض وتبقى إحداثيات المباني داخل world.','تتبع مبنى والخريطة المصغرة أثناء السحب.'),
 D('response.follow','أثر','pos يساوي بداية العرض مضافًا إليها إزاحة اليد المقيدة.','اسحب في اتجاهين.'),
 D('boundaries.obstacle','قيد حدود','constrained يوقف المنظور عند حواف العالم؛ لا توجد عوائق مسار هنا.','واصل السحب عند الحافة وتحقق من التوقف.')
]);
R('select','اختيار عناصر من احتواء مراكزها في مستطيل.',
 ['hit-test','application-results','preview-commit'],
 'dist/geometry.js · mountSelect / update',
 ['يختبر مراكز العناصر داخل المستطيل ويعرض المحدد أثناء الحمل.','تبدأ سحبة المستطيل من الفراغ؛ لمس حافة الرسم وحده لا يكفي لاختيار مركزه.'],[
 D('response.containment','أثر','update يقارن x وy لمركز العنصر بحدود المستطيل.','ضم المركز ثم اكتف بلمس طرف الرسم.'),
 D('application.select-area','تطبيق','يتغير Set المحدد وعداده دون تغيير مواقع العناصر.','ارسم مستطيلًا حول عدة عناصر.'),
 P('phases.preview-commit','حد التمثيل','يحفظ before للإلغاء لكن selected نفسه يتحدث أثناء الحمل؛ لا تظهر قيمتان معتمد/مقترح مستقلتان.','استخدم مقارنة المعاينة والاعتماد لإظهار الفصل صراحة.')
]);
R('area','تركيب مستطيل من خلايا مع رفض الجزء المحجوز.',
 ['grid','bounds-obstacles','hit-test','application-results','preview-commit'],
 'dist/geometry.js · mountArea / cellAt / validity / commit',
 ['يتحول السحب إلى أعمدة وصفوف وعدد خانات.','وجود ممر أو رف داخل المستطيل يرفض المساحة كلها ويحفظ السابقة.'],[
 D('application.select-area','تطبيق','تعرض أبعاد المساحة وعدد خلاياها.','ارسم مستطيلًا صغيرًا ثم وسّعه.'),
 D('boundaries.grid','قيد','cellAt وmake يحولان الموضع إلى خلايا كاملة.','حرك داخل خلية ثم تجاوز حدها.'),
 D('boundaries.obstacle','قيد','validity يرفض أي خلية ممر أو رف.','ضم خلية محجوزة إلى مساحة صالحة ثم أفلت.'),
 D('phases.preview-commit','أثر','committed يبقى محفوظًا إذا فشلت المساحة المقترحة.','أنشئ مساحة صالحة ثم جرّب أخرى مرفوضة.')
]);
R('path','الطريق كله يخضع لشرط صلاحية، وليس موضع الإفلات فقط.',
 ['gesture-record','hit-test','bounds-obstacles','target-drop','application-results'],
 'dist/geometry.js · mountPath / segmentHitsRect / append',
 ['يسجل كل مقطع ويفحص مروره بالعائق وحدود الأرضية.','يلزم البدء من الدائرة والوصول إلى الوجهة؛ الفشل يحفظ المسار السابق.'],[
 D('contrast.position-path','إظهار فرق','invalid يبقى إذا قطع أي مقطع العائق حتى مع الوصول للوجهة.','قارن طريقًا ملتفًا وآخر يخترق العائق إلى النهاية نفسها.'),
 D('boundaries.obstacle','قيد مسار','segmentHitsRect يختبر المقطع كاملًا لا عينات نهايته فقط.','ارسم عبورًا مباشرًا عبر العائق.'),
 D('boundaries.valid-drop','شرط','المصدر والنهاية لهما نطاقا قبول معلنان.','ابدأ بعيدًا عن المصدر أو أفلت قبل النهاية.')
]);
R('transform','اختيار المقبض يحدد القياس المقروء وحدوده.',
 ['angle','mapping','contextual-mode','grid','application-results'],
 'dist/basic.js · transform / adjust / normalize',
 ['مقبض الحجم يقرأ الإحداثيات المحلية ومقبض الدوران يقرأ atan2 حول المركز.','الأبعاد محصورة ومقربة؛ normalize لا يحتفظ باللفات الكاملة.'],[
 D('measure.angle','قياس','زاوية المؤشر حول (٤٥٠،٢٣٥) تتحول إلى اتجاه اللافتة المعروض.','اسحب المقبض الدائري.'),
 D('response.mapping','تحويل','المقبض الآخر يحول المحورين المحليين إلى عرض وارتفاع.','غيّر الحجم من المقبض المربع.'),
 P('contrast.angle-turns','حد التمثيل','تعرض زاوية اللفة فقط، ولا تعرض مجموع الدوران.','قارنها بتجربة الدورات المتراكمة.'),
 D('boundaries.grid','قيد','الأبعاد تقرب إلى خطوات عشر مع حدود دنيا وعليا.','حرك مقبض الحجم إلى الحد ثم تجاوزه.')
]);
R('value','تطبيق موضع إلى كمية ثم إجمالي مشتق منها.',
 ['mapping','grid','application-results'],
 'dist/operations.js · valueDemo / fromPointer',
 ['يحوّل الموضع الأفقي إلى كمية صحيحة ويحسب الكمية*سعر الوحدة.','المجال صفر إلى أربعين؛ العرض تعليمي ولا ينفذ شراء.'],[
 D('response.mapping','تحويل','الموضع على الشريط يحدد quantity والإجمالي.','اختر موضعًا وعد إليه من اتجاه آخر.'),
 D('boundaries.grid','قيد','Math.round يعطي صناديق كاملة داخل ٠–٤٠.','حرك ببطء عبر نقطة انتقال الكمية.'),
 P('contrast.output-result','تطبيق مبدأ','الناتج كمية وسعر؛ لا تعرض هذه اللوحة تطبيقًا آخر للمبدأ نفسه بجانبها.','قارنه باستعراض الزمن؛ اختلاف المعنى ليس مدخلًا جديدًا.')
]);
R('sort','تطبيق إدراج يغير الترتيب دون إنشاء عناصر.',
 ['hit-test','target-drop','application-results','preview-commit'],
 'dist/operations.js · sortDemo / pointerdown gesture.end',
 ['يظهر خط الإدراج أثناء الحمل ويعتمد الترتيب عند الإفلات.','الإفلات خارج القائمة يحفظ ترتيبها وعدد عناصرها.'],[
 D('application.reorder','تطبيق','تعاد مواضع مهمة داخل قائمة order.','اسحب آخر مهمة إلى أول القائمة.'),
 D('phases.preview-commit','أثر','خط الإدراج معاينة قبل تغيير ترتيب القائمة.','توقف ممسكًا فوق موضع الإدراج ثم أفلت.'),
 D('boundaries.valid-drop','شرط','inside يختبر مستطيل القائمة عند نهاية الحركة.','أفلت خارج القائمة.')
]);
R('transfer','تطبيق نقل عضوية مع سعة وحفظ عدد.',
 ['target-drop','capacity','conservation','application-results'],
 'dist/operations.js · transferDemo / transfer',
 ['تنقل هوية الصندوق بين inventory وshelf عند قبول الإفلات.','سعة الرف اثنان؛ مجموع الجهتين ثلاثة دائمًا.'],[
 D('application.transfer-relate','تطبيق','الصندوق نفسه يغير الحاوية.','انقل إلى الرف ثم أعده إلى المخزن.'),
 D('boundaries.conservation','قيد','عداد المخزون+العرض يعرض ثلاثة.','اقرأ المجموع قبل النقل وبعده.'),
 D('boundaries.capacity','شرط','يرفض shelf.length>=2 دون حذف من المخزن.','انقل اثنين ثم حاول الثالث.'),
 D('boundaries.valid-drop','شرط','الوجهة يجب أن تكون إحدى الحاويتين.','أفلت بينهما وتحقق من بقاء الكميات.')
]);
R('assign','تطبيق السحب لتغيير علاقة تكليف.',
 ['target-drop','capacity','application-results','state-memory'],
 'dist/operations.js · assignDemo / assign',
 ['تغير الوجهة assignment وعدد العاملين في المحل.','محل السوق الممتلئ يرفض التكليف ويحفظ العلاقة السابقة.'],[
 D('application.transfer-relate','تطبيق','assignment يحدد علاقة العامل بالمحل أو pool.','كلّف سالم ثم أعده إلى دون تكليف.'),
 D('boundaries.capacity','شرط','market يرفض لأن الفريق مكتمل.','أفلت على المحل الممتلئ.'),
 D('boundaries.valid-drop','شرط','التحويل لا يعتمد دون وجهة معروفة.','أفلت خارج مناطق التكليف.')
]);

// Three integrated comparisons: links below describe the reviewed functions
// and the outputs actually rendered, not mere catalog terms.
R('speed-acceleration','قياس مشتق إضافي مع شروط مقارنة معلنة، لا مصدر إدخال إضافي.',
 ['speed','acceleration','timestamps','two-trace-contrast'],
 'dist/principle-lab.js · fitMotion / createMotionEstimator / speedComparisonTraces / paint',
 ['تقدّر الملاءمة المحلية سرعة أفقية موقعة وتسارعًا أفقيًا موقّعًا وتعرضهما بوحدتين مختلفتين.','النافذة ٢٠٠ ملث، ويلزم للتسارع ثلاث عينات وامتداد ٨٠ ملث على الأقل؛ لا يعرض غياب التقدير على أنه صفر.'],[
 D('measure.speed','قياس','تقدّر اللوحة مشتق الموضع الأفقي وتعرض الإشارة والاتجاه ووحدة/ث.','اسحب يمينًا ثم يسارًا واقرأ الإشارة والنافذة.'),
 D('measure.acceleration','قياس','تقدّر fitMotion المشتق الثاني للموضع وتعرضه بوحدة/ث²؛ عند نقص العينات يظهر غياب القراءة.','تحرك يمينًا ثم زد سرعتك وخففها؛ راقب التسارع الأفقي.'),
 D('contrast.speed-acceleration','مقارنة','يصل التسجيلان إلى سرعة +٢٠٠ عند ثانية واحدة، بتسارعين +١٢٠ و−١٢٠. تساوي السرعة هنا لحظي.','شغّل التسجيلين ثم اقرأ السرعتين والتسارعين عند الثانية.'),
 D('contrast.two-records','مقارنة','المحور والبداية وزمن المقارنة وقيمة السرعة عندها مشتركة؛ موضعا النهاية والمسافتان مختلفان.','افحص شروط المقارنة ولا تفترض تساوي كامل السجلين.')
]);
R('time-responses','تفسير الزمن بثلاث قواعد على دورة واحدة.',
 ['duration','target-dwell','time-repeat','integration','threshold-test','same-trace-contrast'],
 'dist/principle-lab.js · createTimeResponseEngine / snapshot / paint',
 ['تعرض مرة بعد ٥٠٠ ملث، وعدد الفترات المكتملة كل ٥٠٠ ملث، ومقدارًا مستمرًا بمعدل وحدتين/ث من الزيارة نفسها.','الخروج يعيد زمن الزيارة ونواتجها للصفر، والإفلات يوقف الساعة؛ الحركة داخل الهدف لا تبدأ زيارة أخرى.'],[
 D('measure.dwell','قياس','تُعرض مدة الزيارة منذ الدخول وعدد الزيارات؛ يقيس المؤقت البقاء داخل الهدف لا ثبات اليد.','تحرك داخل الهدف ثم اخرج وعد أثناء الضغط.'),
 D('response.periodic','أثر','عدد النبضات هو عدد فترات ٥٠٠ ملث المكتملة في الزيارة المتصلة.','اثبت والزر مضغوط وراقب عدد النبضات.'),
 D('response.integrate','أثر','المقدار المتصل يساوي مدة الزيارة بالثواني مضروبة في ٢.','راقب الزيادة المستمرة بين النبضات.'),
 D('contrast.time-responses','مقارنة','لزيارة ١٦٠٠ ملث تكون النتائج ١ و٣ و٣٫٢. الخروج يعيد قراءات الزيارة الثلاث.','شغّل الزيارة المضبوطة ثم اختبر الخروج والعودة يدويًا.'),
 D('contrast.same-input','مقارنة','snapshot يستخدم dwell نفسه للعتبة الواحدة والفترات والتراكم.','نفّذ ضغطة واحدة وتابع المقادير الثلاثة.'),
 P('contrast.distance-time','صلة بمقارنة مستقلة','توضح هذه اللوحة التكرار الزمني داخل زيارة الهدف ولا تعرض نتائج السياج. المقارنة المباشرة للامتداد وزمن الضغط موجودة داخل تجربة التكرار على مسافة.','افتح «قارن الامتداد بالزمن» في تجربة السياج لتمرير التسجيل نفسه إلى القاعدتين.')
]);
R('capture-release','قيد بذاكرة يفرق حد الالتقاط عن حد فك الانجذاب أثناء الضغط.',
 ['hysteresis','magnet','state-memory','same-trace-contrast','threshold-test'],
 'dist/principle-lab.js · createCaptureReleaseEngine / capturePlot / paint',
 ['تستخدم القاعدتان المسافة الخام نفسها؛ تلتقطان عند ٤٠ أو أقل ويفك الأول فوق ٤٠ والثاني فوق ٩٠.','تُعرض الحالة السابقة وآخر انتقال؛ عند ٩٠ بالضبط يبقى الثاني ملتقطًا، والإفلات يجمّد القراءة.'],[
 D('boundaries.hysteresis','قيد','يحفظ كل نموذج captured. عند ٦٥ قبل الدخول كلاهما حر، وعند ٦٥ بعد الالتقاط يكون أ حرًا وب ملتقطًا.','اقترب إلى ٤٠ ثم عد إلى ٦٥ أثناء الضغط؛ واصل إلى ما فوق ٩٠.'),
 D('boundaries.magnet','قيد مرجعي','النموذج أ يستخدم حدًا واحدًا؛ يلتقط عند ٤٠ أو أقل ويفك عند تجاوز ٤٠.','قارن موضع العنصر بالمؤشر الخام على جانبي الحد.'),
 D('contrast.same-input','مقارنة','تُحسب مسافة واحدة من المؤشر إلى المركز، وتغذّي النموذجين في sample نفسه.','تابع المسافة والحالتين أثناء سحبة واحدة.')
]);

export const evidence = [...records.values()].flatMap(record => record.items.map(item => {
  const browserCheck = browserChecks[`${record.id}/${item.objectiveId}`] || null;
  const browserCheckHistorical=!!browserCheck&&browserCheck.version!==catalogVersion.id;
  return {exampleId:record.id,...item,channel:'primary',scope:record.scope==='tool' || objectiveById.get(item.objectiveId).scope==='tool'?'tool':'single',
    reviewed:browserCheck?'browser-verified':item.reviewed,browserCheck,browserCheckHistorical,
    observation:browserCheck?`${item.observation} ${browserCheckHistorical?'مشاهدة محفوظة في إصدار سابق':'فحص المتصفح في هذا الإصدار'} (${browserCheck.method}): ${browserCheck.result}`:item.observation};
}));
const evidenceByKey = new Map(evidence.map(item => [`${item.exampleId}/${item.objectiveId}`,item]));
for (const record of records.values()) for (const id of record.conceptIds) conceptById.get(id).exampleIds.push(record.id);

export function getExampleRecord(id) {
  const record = records.get(id);
  if (!record) return undefined;
  const {items,...publicRecord} = record;
  return publicRecord;
}
export function getEvidence(exampleId,objectiveId) {
  const found = evidenceByKey.get(`${exampleId}/${objectiveId}`);
  if (found) return found;
  const record = records.get(exampleId);
  const targeted = record?.objectiveIds.includes(objectiveId);
  return {exampleId,objectiveId,channel:'primary',scope:record?.scope==='tool'||objectiveById.get(objectiveId)?.scope==='tool'?'tool':'single',status:targeted?'unreviewed':'na',role:targeted?'لم يراجع':'غير مستهدف',
    observation:targeted?'هذا هدف معلن للتجربة لم يسجل دليل مراجع عليه بعد.':'هذا الهدف ليس من مسؤوليات هذه التجربة؛ عدم عرضه هنا لا يجعل التجربة ناقصة.',
    test:targeted?'راجع التنفيذ ثم اختبر الادعاء قبل إسناد التغطية.':'راجع التجارب المرتبطة بهذا الهدف.',
    source:targeted?record.source:'',reviewed:'unreviewed',browserCheck:null,browserCheckHistorical:false};
}

// Preserve all previous imports and primary identifiers. Foreign or unknown
// channel names are never treated as primary. Each section has its own index.
const primaryDataset={channel:'primary',channelInfo:getChannelInfo('primary'),catalogVersion,examples:primaryExamples,concepts,objectives,evidence,getExampleRecord,getEvidence,browserChecks};
export function getChannelDataset(channel){return channel==='primary'?primaryDataset:getExtensionDataset(channel);}

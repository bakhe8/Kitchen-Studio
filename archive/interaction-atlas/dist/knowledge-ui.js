import { getChannelDataset } from './knowledge-model.js';

// The catalogue supplies the claims. This module only presents them and their evidence.
const TYPES = {
  signal: 'إشارة', measurement: 'قياس مشتق', rule: 'قاعدة تفسير',
  constraint: 'قيد', composition: 'تركيب', application: 'تطبيق / نتيجة', context: 'سياق'
};
const BUILDS = {
  original: 'أصلي في نموذج الإشارة', derived: 'مشتق', primitive: 'أساسي في هذا النموذج',
  composite: 'مركّب', application: 'تطبيق لمبدأ'
};
const AXES = {
  signal: 'الإشارة الأصلية', measure: 'القياسات', response: 'التفسير والقيود',
  phases: 'المراحل وتوقيت الأثر', contrast: 'تمييز الفروق', boundaries: 'الحدود والحالات الطرفية',
  composition: 'التركيب', application: 'التطبيق والنتيجة'
};
const STATES = {
  direct: { label: 'ممثّل مباشرة', mark: '●', note: 'توجد ملاحظة محددة تبيّن هذا الهدف في التجربة.' },
  partial: { label: 'ممثّل جزئيًا', mark: '◐', note: 'تظهر بعض جوانب الهدف، وتوضح بطاقة الدليل الجزء المتبقي.' },
  missing: { label: 'يحتاج تمثيلًا', mark: '○', note: 'هدف مقصود لم يتوفر له التمثيل المطلوب في هذه التجربة.' },
  unreviewed: { label: 'لم يُراجع', mark: '?', note: 'لم تتوفر مراجعة تكفي للحكم على هذا الهدف.' },
  na: { label: 'ليس هدفًا', mark: '—', note: 'هذا الهدف خارج ما تقصد هذه التجربة شرحه؛ لا يُحسب نقصًا فيها.' }
};
const REVIEW = {
  'source-reviewed': 'راجعنا المصدر', 'browser-verified': 'تحقّق تفاعلي',
  verified: 'تم التحقق', unreviewed: 'لم يُتحقق', implemented: 'منفّذ',
  missing: 'غير مكتمل', partial: 'جزئي', pending: 'بانتظار التحقق'
};
const PAGE_EXAMPLES = 3;
const PAGE_OBJECTIVES = 8;
const PAGE_CONCEPTS = 12;
const list = value => Array.isArray(value) ? value : [];
const unique = value => [...new Set(value.filter(Boolean))];
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const textValue = value => typeof value === 'string' || typeof value === 'number' ? String(value) : value && typeof value === 'object' ? value.label || value.description || value.detail || '' : '';
const nameOf = example => example?.name || example?.title || example?.id || '';
const normal = value => String(value || '').trim().toLocaleLowerCase('ar').replace(/[أإآ]/g, 'ا').replace(/[ًٌٍَُِّْ]/g, '');
const validState = value => Object.hasOwn(STATES, value) ? value : 'unreviewed';
const number = value => Number(value).toLocaleString('ar-SA');
const pageNumber = (value, pages) => Math.max(0, Math.min(Math.max(0, pages - 1), Number.parseInt(value, 10) || 0));
function cleanParams(params = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value !== null && value !== undefined) clean[key] = String(value);
  }
  return clean;
}
function nav(view, params, label, cls = 'kn-link', extra = '') {
  return `<button type="button" class="${esc(cls)}" data-kn-view="${esc(view)}" data-kn-params="${esc(JSON.stringify(cleanParams(params)))}" ${extra}>${label}</button>`;
}
function exampleButton(id, label, cls = 'kn-example-link', channel) {
  return `<button type="button" class="${esc(cls)}" data-kn-example="${esc(id)}"${channel ? ` data-kn-channel="${esc(channel)}"` : ''}>${label}<span aria-hidden="true">↗</span></button>`;
}
function chip(concept, view = 'rules', params = {}) {
  if (!concept) return '';
  return nav(view, { ...params, concept: concept.id }, `<span>${esc(concept.label)}</span><small>${esc(TYPES[concept.type] || concept.type)}</small>`, 'kn-concept-chip');
}
function badge(status) {
  const key = validState(status);
  const state = STATES[key];
  return `<span class="kn-status kn-status-${key}"><span aria-hidden="true">${state.mark}</span>${state.label}</span>`;
}
function reviewBadge(value, historical = false) {
  const key = typeof value === 'string' ? value : value?.type || value?.status || 'unreviewed';
  return `<span class="kn-review${key === 'browser-verified' && !historical ? ' kn-review-verified' : ''}">${esc(historical ? 'فحص متصفح على إصدار سابق' : REVIEW[key] || key)}</span>`;
}
function options(items, selected) {
  return items.map(([id, label]) => `<option value="${esc(id)}"${String(selected || '') === String(id) ? ' selected' : ''}>${esc(label)}</option>`).join('');
}
function selectControl(name, label, items, selected, cls = '') {
  return `<label class="kn-field ${cls}"><span>${label}</span><select data-kn-param="${name}" name="${name}">${options(items, selected)}</select></label>`;
}
function scopeDescription() {
  return '<strong>وصف القاعدة بأنها «أساسية» نسبي إلى مستوى الشرح.</strong> نوع العنصر يجيب «ما هو؟»، وطريقة تكوينه تجيب «من أين جاء؟». لا تعني هذه القائمة أن جميع القياسات أو القواعد الممكنة قد حُصرت.';
}
const presentations = new Map();
const knownChannels = new Set(['primary','secondary','wheel']);
// These comparisons intentionally join two specified lessons. They describe the
// relationship only; labels, evidence, review status and counts come from each dataset.
const comparisons = {
  quantity: {
    label:'كيف نضبط كمية بالسحب أو بتدوير البكرة؟',
    note:'القدر المشترك هو تعديل كمية. الموضع على الشريط يعيّن قيمة، بينما يغيّر التدوير قيمة سابقة بمقدار. تشابه الناتج لا يجعل قراءتي الإدخال متماثلتين.',
    sides:[
      {channel:'primary',example:'value',objective:'response.mapping',reading:'موضع أفقي على الشريط',unit:'نسبة من عرض الشريط تعيّن كمية من ٠ إلى ٤٠.'},
      {channel:'wheel',example:'wheel-trace',objective:'wheel.response.quantity',reading:'دلتا تدوير موقّعة',unit:'تحدد وحدة حدث التدوير معنى الدلتا، ثم تحوّلها القاعدة إلى تغيير في كمية بين ٠ و١٠٠.'}
    ]
  },
  movement: {
    label:'ماذا يشترك فيه النقل بالزرّين الأساسي والثانوي؟',
    note:'نقارن تجربتين منفصلتين. في كل منهما يبدأ النقل بضغطة زر واحد وتدخل إزاحة المؤشر في تغيير الموضع. لكل مثال حدوده ودليله؛ لا نجمع الزرّين في إيماءة واحدة.',
    sides:[
      {channel:'primary',example:'move',objective:'application.move-view',reading:'إزاحة المؤشر أثناء ضغط الزر الأساسي',unit:'تغيّر مكاني في ساحة المثال؛ تُلاحظ النتيجة في موضع العنصر.'},
      {channel:'secondary',example:'secondary-drag',objective:'secondary.application.move',reading:'إزاحة المؤشر أثناء ضغط الزر الثانوي',unit:'تغيّر مكاني في ساحة المثال؛ لا نحسب ضغطة أساسية ضمن هذه الدورة.'}
    ]
  }
};
function presentation(channelId) {
  if (!knownChannels.has(channelId)) return null;
  if (presentations.has(channelId)) return presentations.get(channelId);
  const data = getChannelDataset(channelId);
  if (!data) return null;
  const { concepts, objectives, evidence, getExampleRecord, getEvidence, channelInfo, catalogVersion } = data;
  const conceptById = new Map(concepts.map(c => [c.id, c]));
  const objectiveById = new Map(objectives.map(o => [o.id, o]));
  // The dataset's membership is the authority. An unknown/foreign example is not primary.
  const filterExamples = pool => {
    const metadata = new Map(pool.map(ex => [ex.id,ex]));
    return data.examples.filter(ex => Boolean(getExampleRecord(ex.id))).map(ex => metadata.get(ex.id) || ex);
  };
function modelNote() {
  return `<details class="kn-method"><summary>كيف نقرأ هذا التصنيف؟ <span aria-hidden="true">+</span></summary><p>${scopeDescription()}</p><p>أدوات التصفح وإعادة التجربة تقع خارج التفاعل المدروس. يجوز أن يتكرر تعريف مفهوم في نطاقين، ولكل نطاق أدلته الخاصة.</p><p><strong>${esc(catalogVersion.title || catalogVersion.id || 'قائمة النطاق الحالية')}</strong>${catalogVersion.description ? ` — ${esc(catalogVersion.description)}` : ''}</p></details>`;
}
function sectionHead(kicker, title, description) {
  return `<header class="kn-page-head"><p class="kn-eyebrow"><span class="kn-channel-label" data-kn-active-channel="${esc(channelId)}">${esc(channelInfo.label)}</span> ${kicker}</p><h1>${title}</h1><p class="kn-view-intro">${description}</p><div class="kn-channel-envelope"><strong>حدود التفاعل</strong><span>${esc(channelInfo.description)}</span></div></header>`;
}
function relationshipIds(concept, field) {
  return unique(list(concept[field]).map(item => typeof item === 'string' ? item : item.id)).filter(id => conceptById.has(id));
}
function reverseDependencies(id) {
  return concepts.filter(c => ['derivesFrom', 'composedOf', 'uses'].some(field => relationshipIds(c, field).includes(id)));
}
function contrastsOf(concept) {
  return unique([...relationshipIds(concept, 'contrasts'), ...concepts.filter(c => relationshipIds(c, 'contrasts').includes(concept.id)).map(c => c.id)]).map(id => conceptById.get(id));
}
function relatedExamples(concept, examples) {
  const ids = new Set(list(concept.exampleIds));
  const objectiveIds = new Set(objectives.filter(o => o.conceptId === concept.id).map(o => o.id));
  for (const record of evidence) if (objectiveIds.has(record.objectiveId) && record.status !== 'na') ids.add(record.exampleId);
  return examples.filter(example => ids.has(example.id));
}
function coverageForConcept(concept, examples) {
  const goals = objectives.filter(o => o.conceptId === concept.id);
  if (goals.length && goals.every(o => o.scope === 'tool')) {
    const tool = examples.find(ex => getExampleRecord(ex.id)?.scope === 'tool' && goals.some(o => evidenceFor(ex.id, o.id).status !== 'na'));
    if (tool) return {scope:'example',example:tool.id};
  }
  return {scope:'concept',concept:concept.id};
}
function evidenceFor(exampleId, objectiveId) {
  const record = getEvidence(exampleId, objectiveId);
  if (record) return { ...record, status: validState(record.status) };
  const target = list(getExampleRecord(exampleId)?.objectiveIds).includes(objectiveId);
  return { exampleId, objectiveId, status: target ? 'unreviewed' : 'na', reviewed: 'unreviewed', observation: target ? 'لم تُسجل مراجعة لهذا الهدف بعد.' : 'هذا الهدف ليس ضمن أهداف التجربة المسجلة.' };
}
function reviewExplanation(record) {
  if (record.browserCheckHistorical) return 'هذا فحص متصفح محفوظ للإصدار المبيّن أدناه. نتيجته تخص ذلك الإصدار؛ لم ننقل التحقق تلقائيًا إلى الإصدار الحالي.';
  if (record.reviewed === 'source-reviewed') return 'هذا الحكم يستند إلى قراءة التنفيذ في المصدر. لا يساوي تحققًا تفاعليًا في المتصفح.';
  if (record.reviewed === 'browser-verified') return 'يتضمن هذا الحكم تحققًا تفاعليًا موثقًا في المتصفح.';
  if (record.status === 'na') return 'عدم الاستهداف لا يتطلب أن تشرح كل تجربة كل هدف في المختبر.';
  return 'لا توجد مراجعة مسجلة تكفي لإثبات التحقق التفاعلي من هذا الهدف.';
}
function evidenceDetails(record) {
  const source = textValue(record.source);
  const check = record.browserCheck;
  let observation = textValue(record.observation);
  if (check?.method && check?.result) {
    for (const prefix of ['فحص المتصفح', 'مشاهدة محفوظة في إصدار سابق']) observation = observation.replace(` ${prefix} (${check.method}): ${check.result}`, '');
  }
  return `<div class="kn-evidence-body">
    ${record.role ? `<p class="kn-role">${esc(textValue(record.role))}</p>` : ''}
    <dl class="kn-evidence-dl"><div><dt>ما الذي يظهر؟</dt><dd>${esc(observation || STATES[validState(record.status)].note)}</dd></div><div><dt>كيف نتحقق؟</dt><dd>${esc(textValue(record.test) || (record.status === 'na' ? 'لا يُطلب إثبات هذا الهدف في هذه التجربة.' : 'لم يُسجل إجراء تحقق لهذا الهدف بعد.'))}</dd></div></dl>
    <details class="kn-source"><summary>دليل المراجعة ${reviewBadge(record.reviewed,record.browserCheckHistorical)}</summary><p>${reviewExplanation(record)}</p>${check ? `<dl class="kn-browser-proof">${[['طريقة التحقق',check.method],['ما نُفّذ',check.scenario],['النتيجة المرصودة',check.result],['مكان الفحص',check.environment],['تاريخ الفحص',check.date],['نسخة القائمة',check.version]].filter(([,value]) => value).map(([label,value]) => `<div><dt>${label}</dt><dd dir="auto">${esc(value)}</dd></div>`).join('')}</dl>` : ''}${source ? `<p>مرجع التنفيذ:</p><p class="kn-source-reference" dir="auto">${esc(source)}</p>` : '<p>لا يوجد مرجع مراجعة مسجل.</p>'}</details>
  </div>`;
}
function relationGroup(label, ids, view = 'rules', params = {}, empty = '') {
  const nodes = ids.map(id => typeof id === 'string' ? conceptById.get(id) : id).filter(Boolean);
  if (!nodes.length && !empty) return '';
  return `<section class="kn-relation-group"><h4>${label}</h4>${nodes.length ? `<div class="kn-chips">${nodes.map(c => chip(c, view, params)).join('')}</div>` : `<p class="kn-muted">${empty}</p>`}</section>`;
}
function pager(view, params, key, current, total, label) {
  if (total <= 1) return '';
  return `<nav class="kn-pager" aria-label="${esc(label)}">${nav(view, { ...params, [key]: current - 1 }, '<span aria-hidden="true">→</span> السابق', 'kn-button kn-button-quiet', current === 0 ? 'disabled' : '')}<span>${label}: ${number(current + 1)} / ${number(total)}</span>${nav(view, { ...params, [key]: current + 1 }, 'التالي <span aria-hidden="true">←</span>', 'kn-button kn-button-quiet', current >= total - 1 ? 'disabled' : '')}</nav>`;
}

function rulesView(params, examples) {
  const families = unique(concepts.map(c => c.family));
  const query = normal(params.q);
  const filtered = concepts.filter(c => (!params.type || c.type === params.type) && (!params.construction || c.construction === params.construction) && (!params.family || c.family === params.family) && (!query || normal([c.label, c.definition, TYPES[c.type], BUILDS[c.construction], c.family].join(' ')).includes(query)));
  const pages = Math.ceil(filtered.length / PAGE_CONCEPTS);
  const selectedIndex = filtered.findIndex(c => c.id === params.concept);
  const page = selectedIndex >= 0 ? Math.floor(selectedIndex / PAGE_CONCEPTS) : pageNumber(params.page, pages);
  const subset = filtered.slice(page * PAGE_CONCEPTS, (page + 1) * PAGE_CONCEPTS);
  const selected = filtered.find(c => c.id === params.concept) || subset[0];
  return `${sectionHead('من الإشارة إلى الأثر', 'القواعد ومكوّناتها', 'افتح عنصرًا لتعرف نوعه، وطريقة تكوينه، وما يعتمد عليه، والتجارب التي تساعد على فهمه.')}${modelNote()}
    <form class="kn-filters kn-rule-filters" data-kn-search>
      <label class="kn-field kn-search"><span>البحث في المكوّنات</span><div><input type="search" name="q" value="${esc(params.q || '')}" placeholder="مثل: المسار، السرعة، التكرار" autocomplete="off"><button class="kn-search-submit" type="submit">بحث</button></div></label>
      ${selectControl('type', 'نوع العنصر', [['', 'كل الأنواع'], ...Object.entries(TYPES)], params.type)}
      ${selectControl('construction', 'طريقة التكوين', [['', 'كل الطرق'], ...Object.entries(BUILDS)], params.construction)}
      ${selectControl('family', 'العائلة', [['', 'كل العائلات'], ...families.map(f => [f, f])], params.family)}
    </form>
    ${filtered.length ? `<div class="kn-compact-index">${selectControl('concept', `اختر مكوّنًا من النتائج (${number(filtered.length)})`, filtered.map(c => [c.id, c.label]), selected?.id)}</div>` : ''}
    <div class="kn-rules-layout"><aside class="kn-component-index" aria-label="مكوّنات التصنيف"><div class="kn-list-heading"><h3>المكوّنات</h3><span>${number(filtered.length)} في هذا الاختيار</span></div><div class="kn-component-list">${subset.length ? subset.map(c => nav('rules', { ...params, concept: c.id }, `<span>${esc(c.label)}</span><small>${esc(TYPES[c.type] || c.type)}<i aria-hidden="true"> · </i>${esc(BUILDS[c.construction] || c.construction)}</small>`, 'kn-component-item', selected?.id === c.id ? 'aria-current="true"' : '')).join('') : '<p class="kn-empty">لا توجد عناصر بهذه المرشحات. جرّب إزالة أحدها.</p>'}</div>${pager('rules', { ...params, concept: '' }, 'page', page, pages, 'صفحة المكوّنات')}</aside>
    <div class="kn-component-detail">${selected ? conceptDetail(selected, examples) : '<section class="kn-card kn-empty"><h3>اختيار بلا نتائج</h3><p>التصنيف موجود؛ هذا الجمع من المرشحات لا يطابق عنصرًا.</p>' + nav('rules', {}, 'عرض جميع المكوّنات', 'kn-button') + '</section>'}</div></div>`;
}
function objectiveSummary(objective, examples) {
  const tool = objective.scope === 'tool';
  const withinScope = examples.filter(ex => (getExampleRecord(ex.id)?.scope === 'tool') === tool);
  const tally = { direct: 0, partial: 0, missing: 0, unreviewed: 0, na: 0 };
  for (const ex of withinScope) tally[evidenceFor(ex.id, objective.id).status]++;
  const labels = {direct:'مباشر',partial:'جزئي',missing:'يحتاج تمثيلًا',unreviewed:'لم يُراجع'};
  const parts = Object.entries(labels).filter(([key]) => tally[key] > 0).map(([key,label]) => `<span class="kn-summary-${key}">${label} في ${number(tally[key])}</span>`);
  if (!tally.direct) parts.unshift('<strong>لا عرض مباشر مسجّل</strong>');
  if (tally.na === withinScope.length) parts.push('<span>لم يُستهدف في هذا النطاق</span>');
  return `<small class="kn-objective-summary">${tool ? '<b>في نطاق الأدوات اللاحقة فقط:</b> ' : ''}${parts.join('<i aria-hidden="true"> · </i>')}</small>`;
}
function conceptDetail(concept, examples) {
  const targets = objectives.filter(o => o.conceptId === concept.id);
  const related = relatedExamples(concept, examples);
  const reverse = reverseDependencies(concept.id);
  return `<article class="kn-card kn-concept-detail" aria-labelledby="kn-concept-title">
    <header><p class="kn-eyebrow">${esc(concept.family || 'مكوّن في المختبر')}</p><h3 id="kn-concept-title">${esc(concept.label)}</h3><p class="kn-definition">${esc(concept.definition)}</p></header>
    <dl class="kn-classification"><div><dt>نوع العنصر</dt><dd>${esc(TYPES[concept.type] || concept.type)}</dd></div><div><dt>طريقة تكوينه</dt><dd>${esc(BUILDS[concept.construction] || concept.construction)}</dd></div></dl>
    ${concept.construction === 'primitive' ? '<p class="kn-inline-note">«أساسي» يعني أننا نتعامل معه كوحدة شرح في هذا النموذج؛ لا يعني استحالة تحليله أو اشتقاق قواعد أخرى.</p>' : ''}
    <div class="kn-relations">
      ${relationGroup('يُشتق من', relationshipIds(concept, 'derivesFrom'))}
      ${relationGroup('يتركّب من', relationshipIds(concept, 'composedOf'))}
      ${relationGroup('يستخدم', relationshipIds(concept, 'uses'))}
      ${relationGroup('يدخل في', reverse)}
      ${relationGroup('يختلف عن', contrastsOf(concept))}
    </div>
    <div class="kn-actions">${nav('map', { concept: concept.id }, 'افتح علاقاته في الخريطة', 'kn-button kn-button-quiet')}${nav('coverage', coverageForConcept(concept, examples), 'راجع تغطية هذا العنصر', 'kn-button')}</div>
    <section class="kn-detail-section"><h4>ما الذي نريد أن تبيّنه الأمثلة؟</h4>${targets.length ? `<p class="kn-muted">الخلاصة تعدّ التجارب بحسب ما تبيّنه لكل هدف في هذه القائمة. تكرار العرض المباشر لا يضيف قاعدة جديدة.</p><ul class="kn-objective-list">${targets.map(o => `<li><span class="kn-axis-label">${esc(AXES[o.axis] || o.axis)}</span><div><span>${esc(o.label)}</span>${objectiveSummary(o, examples)}</div></li>`).join('')}</ul>` : '<p class="kn-muted">لم تُسجّل أهداف مستقلة لهذا العنصر بعد؛ الارتباط بمثال لا يكفي للحكم على تغطيته.</p>'}</section>
    <section class="kn-detail-section"><div class="kn-list-heading"><h4>تجارب مرتبطة</h4><span>${number(related.length)} تجربة</span></div><p class="kn-muted">الارتباط يساعد على الوصول. افتح التغطية لمعرفة ما يثبته كل مثال فعلًا.</p><div class="kn-example-links">${related.length ? related.map(ex => exampleButton(ex.id, esc(nameOf(ex)))).join('') : '<p class="kn-empty">لا توجد تجربة مرتبطة مسجلة لهذا العنصر بعد.</p>'}</div></section>
  </article>`;
}

function mapView(params, examples) {
  const requested = conceptById.get(params.concept);
  const selectedType = requested?.type || (TYPES[params.type] ? params.type : 'signal');
  const layer = concepts.filter(c => c.type === selectedType);
  const selected = requested || layer[0] || concepts[0];
  if (!selected) return '<p class="kn-empty">لم يُسجّل تصنيف بعد.</p>';
  const dependencies = unique([...relationshipIds(selected, 'derivesFrom'), ...relationshipIds(selected, 'composedOf'), ...relationshipIds(selected, 'uses')]);
  const reverse = reverseDependencies(selected.id);
  const contrast = contrastsOf(selected);
  const related = relatedExamples(selected, examples);
  return `${sectionHead('علاقات، لا قائمة مسطّحة', 'خريطة التصنيف', 'اختر طبقة ثم عنصرًا. تظهر العلاقات المحيطة به، ويمكنك الانتقال إلى أي مكوّن لمعرفة ما يتغيّر.')}${modelNote()}
    <div class="kn-map-layers" aria-label="طبقات التصنيف">${Object.entries(TYPES).map(([type, label], i) => {
      const nodes = concepts.filter(c => c.type === type);
      return nav('map', { type, concept: nodes[0]?.id }, `<span class="kn-layer-index">${String(i + 1).padStart(2, '0')}</span><strong>${label}</strong><small>${number(nodes.length)} عنصرًا</small>`, 'kn-layer', `${type === selectedType ? 'aria-current="true"' : ''} ${nodes.length ? '' : 'disabled'}`);
    }).join('')}</div>
    <div class="kn-map-toolbar">${selectControl('concept', `عنصر من طبقة «${TYPES[selectedType]}»`, layer.map(c => [c.id, c.label]), selected.id)}<p>طبقات النوع تصف وظيفة العنصر. الاشتقاق والتركيب يظهران في علاقاته.</p></div>
    <div class="kn-neighborhood">
      <section class="kn-map-panel kn-map-dependencies"><p class="kn-map-direction">ما الذي يعتمد عليه؟</p>${relationGroup('يُشتق من', relationshipIds(selected, 'derivesFrom'), 'map')}${relationGroup('يتركّب من', relationshipIds(selected, 'composedOf'), 'map')}${relationGroup('يستخدم', relationshipIds(selected, 'uses'), 'map')}${dependencies.length ? '' : `<p class="kn-muted">${selected.type === 'signal' ? 'عنصر في الإشارة التي يقرأها البرنامج ضمن نموذجنا. لا يحتاج هذا الوصف إلى قياس مشتق يسبقه.' : 'لم تُسجّل لهذا العنصر علاقات اعتماد في القائمة الحالية.'}</p>`}</section>
      <article class="kn-map-center"><span class="kn-map-node-label">العنصر المحدد</span><h3>${esc(selected.label)}</h3><div class="kn-map-badges"><span>${esc(TYPES[selected.type] || selected.type)}</span><span>${esc(BUILDS[selected.construction] || selected.construction)}</span></div><p>${esc(selected.definition)}</p>${nav('rules', { concept: selected.id }, 'افتح بطاقة العنصر ←', 'kn-map-detail-link')}</article>
      <section class="kn-map-panel kn-map-reverse"><p class="kn-map-direction">أين يُستخدم؟</p>${reverse.length ? `<div class="kn-chips">${reverse.map(c => chip(c, 'map')).join('')}</div>` : '<p class="kn-muted">لا توجد عناصر لاحقة مرتبطة به في هذه القائمة.</p>'}</section>
      <section class="kn-map-panel kn-map-contrast"><p class="kn-map-direction">ما الذي ينبغي تمييزه عنه؟</p>${contrast.length ? `<div class="kn-chips">${contrast.map(c => chip(c, 'map')).join('')}</div>` : '<p class="kn-muted">لم تسجّل مقارنة مفاهيمية مستقلة لهذا العنصر.</p>'}</section>
    </div>
    <section class="kn-map-applications"><div><h3>شاهد العنصر داخل تجربة</h3><p class="kn-muted">يمكن أن تستخدم أمثلة متعددة المبدأ نفسه. اختلاف النتيجة لا ينشئ تلقائيًا إشارة أو قاعدة جديدة.</p></div><div class="kn-example-links">${related.length ? related.map(ex => exampleButton(ex.id, esc(nameOf(ex)))).join('') : '<p class="kn-muted">لا توجد أمثلة مرتبطة مسجلة بعد.</p>'}</div>${nav('coverage', coverageForConcept(selected, examples), 'افحص الأدلة وحدود التغطية', 'kn-button kn-button-quiet')}</section>`;
}

function coverageSelection(params, examples) {
  const scope = ['example', 'concept', 'family', 'all'].includes(params.scope) ? params.scope : 'all';
  const families = unique(objectives.filter(o => o.scope !== 'tool').map(o => o.family));
  const example = examples.find(ex => ex.id === params.example) || examples[0];
  const concept = conceptById.get(params.concept) || concepts[0];
  const family = families.includes(params.family) ? params.family : families[0];
  const studyExamples = examples.filter(ex => getExampleRecord(ex.id)?.scope !== 'tool');
  let selectedExamples = studyExamples;
  let selectedObjectives = objectives.filter(o => o.scope !== 'tool');
  if (scope === 'example' && example) {
    selectedExamples = [example];
    const record = getExampleRecord(example.id);
    if (record?.scope === 'tool') selectedObjectives = objectives.filter(o => o.scope === 'tool' || list(record.objectiveIds).includes(o.id));
  }
  if (scope === 'concept' && concept) selectedObjectives = selectedObjectives.filter(o => o.conceptId === concept.id);
  if (scope === 'family') selectedObjectives = selectedObjectives.filter(o => o.family === family);
  if (AXES[params.axis]) selectedObjectives = selectedObjectives.filter(o => o.axis === params.axis);
  const counts = Object.fromEntries(Object.keys(STATES).map(key => [key, 0]));
  const scopeExampleCount = selectedExamples.length;
  const stateFilter = Object.hasOwn(STATES, params.status) ? params.status : '';
  const score = new Map(selectedExamples.map(ex => [ex.id, 0]));
  const statuses = new Map();
  for (const ex of selectedExamples) {
    const byObjective = new Map();
    for (const objective of selectedObjectives) {
      const status = evidenceFor(ex.id, objective.id).status;
      byObjective.set(objective.id, status);
      counts[status]++;
      if (stateFilter ? status === stateFilter : status !== 'na') score.set(ex.id, score.get(ex.id) + 1);
    }
    statuses.set(ex.id, byObjective);
  }
  const unfilteredObjectives = selectedObjectives;
  if (stateFilter) selectedExamples = selectedExamples.filter(ex => score.get(ex.id) > 0);
  selectedExamples = [...selectedExamples].sort((a,b) => score.get(b.id) - score.get(a.id));
  const columnPages = Math.ceil(selectedExamples.length / PAGE_EXAMPLES);
  const page = pageNumber(params.page, columnPages);
  const visibleExamples = selectedExamples.slice(page * PAGE_EXAMPLES, (page + 1) * PAGE_EXAMPLES);
  const localScore = o => visibleExamples.reduce((sum, ex) => sum + Number(stateFilter ? statuses.get(ex.id)?.get(o.id) === stateFilter : statuses.get(ex.id)?.get(o.id) !== 'na'), 0);
  if (stateFilter) selectedObjectives = selectedObjectives.filter(o => localScore(o) > 0);
  selectedObjectives = [...selectedObjectives].sort((a, b) => localScore(b) - localScore(a));
  const rowPages = Math.ceil(selectedObjectives.length / PAGE_OBJECTIVES);
  const rowPage = pageNumber(params.rowPage, rowPages);
  return { scope, example, concept, family, families, selectedExamples, selectedObjectives, unfilteredObjectives, scopeExampleCount, excludedTools: examples.length - studyExamples.length, counts, page, rowPage, columnPages, rowPages, visibleExamples,
    visibleObjectives: selectedObjectives.slice(rowPage * PAGE_OBJECTIVES, (rowPage + 1) * PAGE_OBJECTIVES) };
}
function coverageView(params, examples) {
  const selected = coverageSelection(params, examples);
  const { scope, example, concept, family, families, selectedExamples, selectedObjectives, unfilteredObjectives, scopeExampleCount, excludedTools, counts, page, rowPage, columnPages, rowPages, visibleExamples, visibleObjectives } = selected;
  const scopeLabel = scope === 'example' ? nameOf(example) : scope === 'concept' ? concept?.label : scope === 'family' ? family : `قائمة ${channelInfo.label}`;
  let selector = '';
  if (scope === 'example') selector = selectControl('example', 'التجربة', examples.map(ex => [ex.id, nameOf(ex)]), example?.id, 'kn-field-wide');
  if (scope === 'concept') selector = selectControl('concept', 'العنصر', concepts.map(c => [c.id, c.label]), concept?.id, 'kn-field-wide');
  if (scope === 'family') selector = selectControl('family', 'العائلة', families.map(f => [f, f]), family, 'kn-field-wide');
  const currentParams = { ...params, scope };
  return `${sectionHead('التغطية تحتاج إلى دليل', 'ماذا تغطّي تجارب هذا النطاق؟', 'اختر مستوى التقرير ثم محورًا مستقلًا عنه. كل خلية تربط هدفًا محددًا بتجربة، وتفتح الملاحظة وشرط التحقق.')}
    <div class="kn-coverage-principle"><span aria-hidden="true">↳</span><p><strong>التغطية هنا تخص ${esc(channelInfo.label)}.</strong> الأعداد تخص أهدافه وتجاربه المسجلة. تشابه المفاهيم بين نطاقين لا ينقل الأدلة من أحدهما إلى الآخر. «ممثّل مباشرة» حكم على هدف محدد؛ ولا تعبّر الأعداد عن نسبة لاكتمال إمكانات هذا الإدخال.</p></div>
    <div class="kn-filters kn-coverage-filters">
      ${selectControl('scope', '١. مستوى التقرير', [['all', 'قائمة هذا النطاق'], ['example', 'تجربة واحدة'], ['concept', 'عنصر واحد'], ['family', 'عائلة واحدة']], scope)}
      ${selector}
      ${selectControl('axis', '٢. محور التغطية', [['', 'جميع المحاور'], ...Object.entries(AXES)], params.axis)}
      ${selectControl('status', '٣. اعرض الأهداف التي تتضمن', [['', 'كل حالات التغطية'], ...Object.entries(STATES).map(([key, state]) => [key, state.label])], params.status)}
    </div>
    <section class="kn-coverage-summary" aria-labelledby="kn-coverage-scope"><div class="kn-scope-heading"><h3 id="kn-coverage-scope">${esc(scopeLabel)}</h3><p>${number(scopeExampleCount)} تجربة × ${number(unfilteredObjectives.length)} هدفًا${params.axis && AXES[params.axis] ? ` · ${esc(AXES[params.axis])}` : ''}</p></div><div class="kn-status-counts">${Object.entries(STATES).map(([key, state]) => `<div class="kn-count kn-count-${key}"><strong>${number(counts[key])}</strong><span>${state.label}</span></div>`).join('')}</div><p class="kn-count-note">هذه أعداد الخلايا في النطاق والمحور المختارين، قبل تصفية الحالة وتقسيم الصفحات. «ليس هدفًا» لا يُحسب نقصًا. العدد لا يقيس التحقق التفاعلي من التنفيذ.${scope !== 'example' && excludedTools ? ' نستبعد أدوات ما بعد الضغطة، مثل التراجع، من هذه المجاميع. يمكن فحص الأداة باختيارها في نطاق «تجربة واحدة».' : scope === 'example' && getExampleRecord(example?.id)?.scope === 'tool' ? ' هذه بطاقة أداة مساعدة تُفحص منفردة؛ لا تدخل في مجاميع تجارب الضغطة الأصلية.' : ''}</p></section>
    <details class="kn-status-guide"><summary>معنى الحالات وكيف تُثبت</summary><div>${Object.entries(STATES).map(([key, state]) => `<p>${badge(key)}<span>${state.note}</span></p>`).join('')}</div><p>«راجعنا المصدر» يحدد نوع المراجعة. يبقى التحقق التفاعلي مستقلًا في شروط اكتمال كل تجربة.</p></details>
    <section class="kn-matrix" aria-label="جدول التغطية"><div class="kn-matrix-heading"><div><h3>الأهداف × التجارب</h3><p>${selectedObjectives.length ? `الأهداف ${number(rowPage * PAGE_OBJECTIVES + 1)}–${number(Math.min((rowPage + 1) * PAGE_OBJECTIVES, selectedObjectives.length))} من ${number(selectedObjectives.length)}` : 'لا توجد أهداف مطابقة'}${selectedExamples.length ? ` · التجارب ${number(page * PAGE_EXAMPLES + 1)}–${number(Math.min((page + 1) * PAGE_EXAMPLES, selectedExamples.length))} من ${number(selectedExamples.length)}` : ''}</p>${Object.hasOwn(STATES, params.status) ? '<p>تقتصر الصفوف على أهداف لها حالة مطابقة في واحدة على الأقل من التجارب الظاهرة؛ بقية الخلايا للمقارنة.</p>' : '<p>تظهر الأهداف المقصودة في تجارب هذه الصفحة أولًا، ثم الأهداف غير المستهدفة.</p>'}</div>${pager('coverage', { ...currentParams, rowPage: 0 }, 'page', page, columnPages, 'صفحة التجارب')}</div>
      ${scope === 'concept' && coverageForConcept(concept,examples).scope === 'example' ? `<p class="kn-inline-note">هذا عنصر لأداة لاحقة. ${nav('coverage',coverageForConcept(concept,examples),'افتح تغطية الأداة منفردة')}</p>` : ''}
      ${visibleObjectives.length ? `<table class="kn-coverage-table"><caption class="kn-sr-only">اضغط حالة التغطية لقراءة الدليل وإجراء التحقق. تظهر ${number(visibleExamples.length)} تجارب في الصفحة.</caption><thead><tr><th scope="col">الهدف الذي نبحث عنه</th>${visibleExamples.map(ex => `<th scope="col">${exampleButton(ex.id, esc(nameOf(ex)), 'kn-table-example')}${getExampleRecord(ex.id)?.scope === 'tool' ? '<small class="kn-tool-label">أداة خارج الضغطة</small>' : ''}</th>`).join('')}</tr></thead><tbody>${visibleObjectives.map(o => `<tr><th scope="row"><span class="kn-axis-label">${esc(AXES[o.axis] || o.axis)}</span><strong>${esc(o.label)}</strong>${conceptById.has(o.conceptId) ? nav('rules', { concept: o.conceptId }, esc(conceptById.get(o.conceptId).label), 'kn-row-concept') : ''}</th>${visibleExamples.map(ex => {
        const record = evidenceFor(ex.id, o.id);
        const dim = params.status && record.status !== params.status;
        return `<td${dim ? ' class="kn-cell-muted"' : ''}><button type="button" class="kn-cell kn-cell-${record.status}" data-kn-evidence="${esc(ex.id)}" data-kn-objective="${esc(o.id)}" aria-label="${esc(nameOf(ex))}: ${esc(o.label)} — ${STATES[record.status].label}. افتح الدليل"><span class="kn-mobile-example">${esc(nameOf(ex))}</span>${badge(record.status)}<small>افتح الدليل <span aria-hidden="true">↗</span></small></button></td>`;
      }).join('')}</tr>`).join('')}</tbody></table>` : `<div class="kn-empty"><h4>لا توجد أهداف لهذا الاختيار</h4><p>${scope === 'example' && !unfilteredObjectives.length ? 'لم تُسجّل أهداف لهذا المحور في التجربة المختارة. لا يعني ذلك تغطية المحور أو نقصًا مؤكدًا فيه.' : 'جرّب محورًا آخر أو أزل تصفية الحالة. عدم ظهور الصفوف لا يعني اكتمال التغطية.'}</p>${nav('coverage', { ...currentParams, axis: '', status: '', page: 0, rowPage: 0 }, 'عرض جميع أهداف النطاق', 'kn-button kn-button-quiet')}</div>`}
      ${pager('coverage', currentParams, 'rowPage', rowPage, rowPages, 'صفحة الأهداف')}
    </section>
    <aside class="kn-completion-note"><h3>التغطية وشروط الاكتمال سؤالان مختلفان</h3><p>التغطية تسأل: ما الهدف الذي يتضح، وما الدليل عليه؟ شروط الاكتمال تسأل: هل يعمل المثال في الحالات المحددة، وهل راجعنا شرحه وتحققنا منه تفاعليًا؟ افتح «شروط اكتمالها» في بطاقة أي تجربة لقراءة ما أُثبت وما بقي.</p>${scope === 'example' && example ? exampleButton(example.id, 'افتح التجربة وشروط اكتمالها', 'kn-button') : ''}</aside>
    ${comparisonEntry()}
    <dialog class="kn-evidence-dialog" aria-labelledby="kn-evidence-title"></dialog>`;
}
function comparisonEntry() {
  const available = Object.entries(comparisons).filter(([,pair]) => pair.sides.some(s => s.channel === channelId));
  return `<section class="kn-cross-scope" aria-label="مقارنة اختيارية بين نطاقين"><h3>مقارنة اختيارية بين نطاقين</h3><p>افتح سؤالًا لمقارنة مثالين محددين. تبقى الأعداد والأدلة في كل جانب خاصة بنطاقه.</p>${available.map(([id,pair]) => `<details class="kn-cross-choice" data-kn-compare="${esc(id)}"><summary>${esc(pair.label)}</summary><div data-kn-compare-body></div></details>`).join('')}</section>`;
}
function comparison(key) {
  const pair = comparisons[key];
  if (!pair || !pair.sides.some(s => s.channel === channelId)) return '';
  const cards = pair.sides.map(side => {
    const ds = getChannelDataset(side.channel);
    const label = ds.channelInfo.label;
    const goal = ds.objectives.find(o => o.id === side.objective);
    const ex = ds.examples.find(ex => ex.id === side.example);
    if (!goal || !ex) return `<article class="kn-cross-card"><h4>${esc(label)}</h4><p>لم يُسجّل هدف المقارنة في هذه النسخة.</p></article>`;
    const within = ds.examples.filter(ex => ds.getExampleRecord(ex.id) && ds.getExampleRecord(ex.id).scope !== 'tool');
    const entries = within.map(ex => ds.getEvidence(ex.id,goal.id)).filter(Boolean);
    const targeted = entries.filter(item => item.status !== 'na' && item.scope !== 'tool');
    const direct = targeted.filter(item => item.status === 'direct').length;
    const rec = ds.getEvidence(ex.id,goal.id);
    return `<article class="kn-cross-card" data-kn-comparison-channel="${esc(side.channel)}"><p class="kn-eyebrow">${esc(label)}</p><h4>${esc(nameOf(ex))}</h4><dl><div><dt>المعلومة المقروءة</dt><dd>${esc(side.reading)}</dd></div><div><dt>كيف تُفسَّر وحدتها؟</dt><dd>${esc(side.unit)}</dd></div><div><dt>هدف المثال</dt><dd>${esc(goal.label)}</dd></div></dl><p class="kn-cross-status">${badge(rec.status)} ${reviewBadge(rec.reviewed,rec.browserCheckHistorical)}</p><details class="kn-cross-evidence"><summary>دليل هذا المثال</summary>${evidenceDetails(rec)}</details><p class="kn-cross-number">لهذا الهدف في ${esc(label)}: عرض مباشر في ${number(direct)} من ${number(targeted.length)} تجارب تستهدفه؛ عدد تجارب الدراسة في هذا النطاق ${number(within.length)}.</p><div class="kn-actions">${exampleButton(ex.id,`افتح تجربة ${esc(label)}`,'kn-button',side.channel)}${nav('coverage',{scope:'example',example:ex.id,axis:goal.axis},'أهدافها وأدلتها','kn-button kn-button-quiet',`data-kn-channel="${esc(side.channel)}"`)}</div></article>`;
  });
  return `<p class="kn-cross-note">${esc(pair.note)}</p><div class="kn-cross-grid">${cards.join('')}</div>`;
}

/** Per-example disclosure. Returns a cleanup function for the app's scene lifecycle. */
function renderSheet(container, id, { onExample, onNavigate } = {}) {
  if (!container) return () => {};
  const controller = new AbortController();
  const record = getExampleRecord(id);
  if (!record) {
    container.innerHTML = '<p class="kn-empty">لم تُسجّل بطاقة لهذه التجربة ضمن نطاق الإدخال المختار.</p>';
    return () => controller.abort();
  }
  const nodes = list(record.conceptIds).map(key => conceptById.get(key)).filter(Boolean);
  const targets = list(record.objectiveIds).map(key => objectiveById.get(key)).filter(Boolean);
  const completion = list(record.completion);
  container.classList.add('knowledge-example');
  container.innerHTML = `<details class="kn-example-sheet"><summary><span class="kn-sheet-icon" aria-hidden="true">↳</span><span><strong>بطاقة الفهم والتغطية</strong><small>ممّ تتكوّن؟ ماذا تغطي؟ وما شروط اكتمالها؟</small></span><span class="kn-sheet-toggle" aria-hidden="true">+</span></summary><div class="kn-sheet-content">
    <p class="kn-contribution"><span class="kn-channel-label">${esc(channelInfo.label)}</span> ${esc(record.contribution || 'لم يوثّق الإسهام التعليمي لهذه التجربة بعد.')}</p>
    ${record.scope === 'tool' ? `<p class="kn-scope-note"><strong>أداة خارج الضغطة الأصلية.</strong> ${esc(record.scopeNote || 'تساعد على الفحص أو إعادة التجربة، ولا تمثل معلومة إضافية من الضغطة.')}</p>` : record.scopeNote ? `<p class="kn-scope-note">${esc(record.scopeNote)}</p>` : ''}
    <div class="kn-example-sections">
      <section><h4><span>١</span> ممّ تتكوّن؟</h4><p class="kn-muted">افتح المكوّن لتمييز نوعه عن طريقة تكوينه.</p><div class="kn-chips">${nodes.length ? nodes.map(c => chip(c)).join('') : '<p class="kn-muted">لم تُسجّل المكوّنات بعد.</p>'}</div></section>
      <section><div class="kn-list-heading"><h4><span>٢</span> ماذا تغطي؟</h4>${nav('coverage', { scope: 'example', example: id }, 'عرض الجدول ←', 'kn-link')}</div><p class="kn-muted">الحكم لكل هدف؛ الارتباط بالمثال وحده لا يثبت التغطية.</p><div class="kn-example-objectives">${targets.length ? targets.map(objective => {
        const ev = evidenceFor(id, objective.id);
        return `<details class="kn-example-objective"><summary><span>${esc(objective.label)}${ev.scope === 'tool' && record.scope !== 'tool' ? '<small class="kn-tool-label">أداة لاحقة · خارج مجاميع الضغطة</small>' : ''}</span>${badge(ev.status)}</summary>${evidenceDetails(ev)}</details>`;
      }).join('') : '<p class="kn-empty">لم تُسجّل أهداف قابلة للمراجعة لهذه التجربة بعد.</p>'}</div></section>
      <section><h4><span>٣</span> شروط اكتمالها</h4><p class="kn-muted">حالة التنفيذ والتحقق مستقلة عن تغطية الأهداف.</p><ul class="kn-completion-list">${completion.length ? completion.map(item => `<li><div><strong>${esc(item.label)}</strong>${reviewBadge(item.status,item.browserCheckHistorical)}</div><p>${esc(item.detail)}</p></li>`).join('') : '<li><strong>لم تُسجّل شروط اكتمال خاصة بهذه التجربة بعد.</strong></li>'}</ul></section>
    </div>
  </div></details>`;
  bindNavigation(container, { navigate: (view, params, explicit) => onNavigate?.(view, params, explicit), onExample, signal: controller.signal });
  return () => controller.abort();
}

  const bound = { channelId, channelInfo, conceptById, objectiveById, families:new Set(objectives.map(o=>o.family)), filterExamples, rulesView, mapView, coverageView, evidenceFor, evidenceDetails, renderSheet, comparison };
  presentations.set(channelId,bound);
  return bound;
}

function bindNavigation(container, { navigate, onExample, signal, onEvidence }) {
  container.addEventListener('click', event => {
    const target = event.target.closest?.('button');
    if (!target || !container.contains(target) || target.disabled) return;
    if (target.hasAttribute('data-kn-close')) {
      target.closest('dialog')?.close();
      return;
    }
    if (target.dataset.knEvidence) {
      onEvidence?.(target.dataset.knEvidence, target.dataset.knObjective);
      return;
    }
    if (target.dataset.knExample) {
      container.querySelector('dialog[open]')?.close();
      onExample?.(target.dataset.knExample, target.dataset.knChannel);
      return;
    }
    if (target.dataset.knView) {
      let params = {};
      try { params = JSON.parse(target.dataset.knParams || '{}'); } catch { /* Invalid route is ignored. */ }
      container.querySelector('dialog[open]')?.close();
      navigate(target.dataset.knView, params, target.dataset.knChannel);
    }
  }, { signal });
}

/**
 * params is a plain object: concept, scope, example, family, axis, status,
 * page (zero based), rowPage (zero based), q, type, construction.
 * UI.render(view,params,channel). Callbacks: onExample(id,channel),
 * onNavigate(view,params,channel). The app owns navigation and permalinks.
 */
export function createKnowledgeUI({ root, examples = [], onExample, onNavigate }) {
  if (!root) throw new Error('createKnowledgeUI requires a root container');
  const controller = new AbortController();
  let view = 'rules';
  let params = {};
  let destroyed = false;
  let channel = 'primary';
  let scoped = null;
  let scopedExamples = [];
  const navigate = (nextView, nextParams, nextChannel = channel) => {
    if (destroyed) return;
    const showNode = nextChannel === channel && nextView === view && ['rules', 'map'].includes(view) && nextParams.concept && nextParams.concept !== params.concept;
    const cleaned = cleanParams(nextParams);
    if (onNavigate) onNavigate(nextView, cleaned, nextChannel);
    else render(nextView, cleaned, nextChannel);
    if (showNode) {
      const heading = root.querySelector(nextView === 'rules' ? '#kn-concept-title' : '.kn-map-center h3');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
        const box = heading.getBoundingClientRect();
        if (box.top < 0 || box.bottom > window.innerHeight) heading.scrollIntoView({ block: 'center' });
      }
    }
  };
  const showEvidence = (exampleId, objectiveId) => {
    const dialog = root.querySelector('.kn-evidence-dialog');
    const objective = scoped?.objectiveById.get(objectiveId);
    const example = scopedExamples.find(ex => ex.id === exampleId);
    if (!dialog || !objective || !example) return;
    const record = scoped.evidenceFor(exampleId, objectiveId);
    dialog.innerHTML = `<header class="kn-dialog-heading"><div><p class="kn-eyebrow">${esc(scoped.channelInfo.label)} · ${esc(nameOf(example))} · ${esc(AXES[objective.axis] || objective.axis)}</p><h3 id="kn-evidence-title">${esc(objective.label)}</h3></div><button type="button" class="kn-dialog-close" data-kn-close aria-label="إغلاق دليل التغطية">×</button></header><div class="kn-dialog-status">${badge(record.status)}${reviewBadge(record.reviewed,record.browserCheckHistorical)}</div>${scoped.evidenceDetails(record)}<div class="kn-actions">${exampleButton(example.id, 'جرّب المثال', 'kn-button')}${nav('rules', { concept: objective.conceptId }, 'افتح المكوّن', 'kn-button kn-button-quiet')}</div>`;
    if (!dialog.open) dialog.showModal();
  };
  bindNavigation(root, { navigate, onExample:(id,explicit) => onExample?.(id,explicit || channel), signal: controller.signal, onEvidence: showEvidence });
  root.addEventListener('toggle', event => {
    const detail = event.target;
    if (!detail.matches?.('details[data-kn-compare]') || !root.contains(detail)) return;
    const body = detail.querySelector('[data-kn-compare-body]');
    if (body) body.innerHTML = detail.open && scoped ? scoped.comparison(detail.dataset.knCompare) : '';
  }, {capture:true,signal:controller.signal});
  root.addEventListener('change', event => {
    const name = event.target.dataset?.knParam;
    if (!name) return;
    const next = { ...params, [name]: event.target.value, page: 0, rowPage: 0 };
    if (view === 'rules' && ['type', 'construction', 'family'].includes(name)) {
      delete next.concept;
      if (event.target.form) next.q = new FormData(event.target.form).get('q')?.toString().trim() || '';
    }
    if (view === 'map' && name === 'concept') next.type = scoped?.conceptById.get(event.target.value)?.type;
    navigate(view, next);
    if (name !== 'concept' || view === 'coverage') root.querySelector(`[data-kn-param="${name}"]`)?.focus({ preventScroll: true });
  }, { signal: controller.signal });
  root.addEventListener('submit', event => {
    if (!event.target.matches('[data-kn-search]')) return;
    event.preventDefault();
    const query = new FormData(event.target).get('q')?.toString().trim() || '';
    navigate(view, { ...params, q: query, concept: '', page: 0 });
  }, { signal: controller.signal });
  function render(nextView, nextParams = {}, nextChannel = 'primary') {
    if (destroyed) return;
    view = ['rules', 'map', 'coverage'].includes(nextView) ? nextView : 'rules';
    params = cleanParams(nextParams);
    root.classList.add('knowledge-ui');
    root.setAttribute('dir', 'rtl');
    channel = nextChannel;
    scoped = presentation(channel);
    scopedExamples = scoped?.filterExamples(examples) || [];
    root.setAttribute('data-knowledge-channel',channel);
    if (!scoped) { root.innerHTML = '<p class="kn-empty">نطاق الإدخال المطلوب غير مسجّل.</p>'; return; }
    const unknownConcept = params.concept && (view !== 'coverage' || params.scope === 'concept') && !scoped.conceptById.has(params.concept);
    const unknownExample = view === 'coverage' && params.scope === 'example' && params.example && !scopedExamples.some(ex => ex.id === params.example);
    const unknownFamily = view === 'coverage' && params.scope === 'family' && params.family && !scoped.families.has(params.family);
    if (unknownConcept || unknownExample || unknownFamily) {
      root.innerHTML = `<section class="kn-card kn-empty"><h1>هذا الرابط خارج النطاق المختار</h1><p>لا يوجد ${unknownExample ? 'هذا المثال' : unknownFamily ? 'تسجيل لهذه العائلة' : 'هذا العنصر'} ضمن ${esc(scoped.channelInfo.label)}. لا تُستبدل أدلته بأدلة من نطاق آخر.</p>${nav(view,{},'اعرض ما يخص هذا النطاق','kn-button')}</section>`;
      return;
    }
    root.innerHTML = view === 'rules' ? scoped.rulesView(params, scopedExamples) : view === 'map' ? scoped.mapView(params, scopedExamples) : scoped.coverageView(params, scopedExamples);
  }
  return {
    render,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      controller.abort();
      root.querySelector('dialog[open]')?.close();
      root.replaceChildren();
      root.classList.remove('knowledge-ui');
    }
  };
}


/** Render an evidence sheet strictly from the chosen input channel. */
export function renderExampleKnowledge(container, id, {channel = 'primary',onExample,onNavigate} = {}) {
  if (!container) return () => {};
  const scope = presentation(channel);
  if (!scope) { container.textContent = 'نطاق الإدخال غير مسجّل.'; return () => {}; }
  return scope.renderSheet(container,id,{onExample:(id,explicit) => onExample?.(id,explicit || channel),onNavigate:(view,params,explicit) => onNavigate?.(view,params,explicit || channel)});
}

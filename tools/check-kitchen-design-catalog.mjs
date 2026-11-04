import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {checkFile, checkSource, scanCSS} from './check-kitchen-design-native.mjs';

const root = new URL('../', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');
const manifest = read('docs/design-system/migration.md');
export const catalogFiles = [...manifest.split('### Wave 5')[1].split('### Wave 6')[0].matchAll(/`(public\/[^`]+\.css)`/g)].map(match => match[1]);
assert.equal(catalogFiles.length, 5, 'cover all five Wave 5 catalog/default stylesheets');
const issues = [];
for (const file of catalogFiles) {
  const result = checkFile(file, {root:fileURLToPath(root)});
  issues.push(...result.diagnostics);
  assert.match(read(file), /var\(--ks-/, `${file} consumes foundation tokens`);
}
assert.deepEqual(issues, [], 'all catalog declarations satisfy semantic color, shape, motion and focus policy');
const has = (file, selector, prop, value) => scanCSS(read(`public/${file}.css`)).declarations.some(rule => (rule.selector === selector || rule.selector.split(/,(?![^()]*\))/).map(part => part.trim()).includes(selector)) && rule.prop === prop && rule.value === value);
const rule = (file, selector, prop, value, reason) => assert.ok(has(file, selector, prop, value), reason ?? `${file} ${selector} ${prop}: ${value}`);
// Review regressions: action-soft hover must use an explicitly readable ink.
rule('kitchen-defaults','.df-panel .df-secondary:not(:disabled):hover,.df-panel .df-small:not(:disabled):hover','color','var(--ks-ink)');
rule('kitchen-defaults','.df-panel .df-secondary:not(:disabled):hover,.df-panel .df-small:not(:disabled):hover','background','var(--ks-action-soft)');
rule('kitchen-user-library','.kul-panel button,.kul-file','border-radius','var(--ks-radius-control)');
for (const declaration of scanCSS(read('public/kitchen-user-library.css')).declarations.filter(item => item.prop === 'border-radius' && item.value === 'var(--ks-radius-overlay)')) assert.equal(declaration.selector,'.kul-panel','overlay radius belongs only to the actual floating container');
rule('kitchen-library','.klib-status','color','var(--ks-info)','a status without a completion hook defaults to information');
for (const [state,semantic] of [['loading','info'],['info','info'],['attention','attention'],['success','complete']]) {
  rule('kitchen-library',`.klib-status[data-state=${state}]`,'color',`var(--ks-${semantic})`);
  rule('kitchen-user-library',`.kul-body .kul-status[data-state=${state}]`,'color',`var(--ks-${semantic})`);
}

for (const [file, scope] of [['kitchen-defaults','.df-panel'],['kitchen-library','.klib'],['kitchen-supplier','.ksup'],['kitchen-user-library','.kul-panel']]) {
  rule(file, `${scope} :is(button,input:not([type=checkbox]):not([type=radio]):not([type=file]),select,textarea,summary)`, 'min-block-size', 'var(--ks-target)', `${scope} compact controls keep 44px target height`);
  rule(file, `${scope} :is(button,a,summary)`, 'min-inline-size', 'var(--ks-target)', `${scope} compact actions keep 44px target width`);
  rule(file, `${scope} :is(button,input,select,textarea,summary,a):focus-visible`, 'outline', '3px solid var(--ks-focus-ring)', `${scope} light surface focus`);
  rule(file, `${scope} :is(button,a,summary):not(:disabled):not([aria-disabled="true"]):active`, 'transform', 'translateY(1px)', `${scope} bounded press`);
  rule(file, `${scope} :is(button,a,summary):not(:disabled):not([aria-disabled="true"]):active`, 'box-shadow', 'none', `${scope} press collapses elevation`);
  assert.match(read(`public/${file}.css`), /@media\s*\(pointer:\s*coarse\)/, `${scope} coarse targets`);
  assert.match(read(`public/${file}.css`), /@media\s*\(prefers-reduced-motion:\s*reduce\)/, `${scope} removes nonessential motion`);
}
for (const [file, selector] of [
  ['kitchen-defaults','.df-panel :is(.df-button,.df-primary,.df-danger):focus-visible'],
  ['kitchen-defaults','.df-switch button[aria-pressed=true]:focus-visible'],
  ['kitchen-library','.klib .klib-primary:focus-visible'],
  ['kitchen-library','.klib-tabs button[aria-pressed=true]:focus-visible'],
  ['kitchen-supplier','.ksup button.ksup-submit:focus-visible'],
  ['kitchen-user-library','.kul-panel button.kul-primary:focus-visible'],
]) {
  rule(file, selector, 'outline', '3px solid var(--ks-focus-ring)', `${selector} external ring contrasts against its light surrounding surface`);
  rule(file, selector, 'outline-offset', '2px');
}
for (const [file, selector] of [['kitchen-supplier','.ksup.pro-drawer .pr-head button:focus-visible'],['kitchen-user-library','.kul-panel .kul-head button:focus-visible']]) {
  rule(file, selector, 'outline', '3px solid var(--ks-focus-ring-dark)', `${selector} contrasts against the dark header`);
  rule(file, selector, 'outline-offset', '2px');
}
// A focus ring is external: contrast is against the surrounding surface,
// including for selected/primary controls filled with the action color.
const tokens = Object.fromEntries(scanCSS(read('public/kitchen-design-system.css')).declarations.filter(item => item.prop.startsWith('--ks-')).map(item => [item.prop, item.value]));
const luminance = token => {
  const rgb = tokens[token].slice(1).match(/../g).map(value => parseInt(value,16)/255).map(value => value <= .04045 ? value/12.92 : ((value+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
};
for (const [foreground,background,threshold] of [['--ks-ink','--ks-action-soft',4.5],['--ks-info','--ks-info-soft',4.5],['--ks-attention','--ks-attention-soft',4.5],['--ks-complete','--ks-complete-soft',4.5],['--ks-danger','--ks-danger-soft',4.5],['--ks-focus-ring','--ks-surface-1',3],['--ks-focus-ring-dark','--ks-ink-strong',3]]) {
  const light = Math.max(luminance(foreground),luminance(background)), dark = Math.min(luminance(foreground),luminance(background));
  assert.ok((light+.05)/(dark+.05) >= threshold, `${foreground} contrasts against ${background}`);
}
for (const file of catalogFiles) for (const declaration of scanCSS(read(file)).declarations) {
  if (declaration.value.includes('--ks-focus-ring-dark')) assert.match(declaration.selector, /\.(?:pr-head|kul-head)/, 'bright focus token only belongs on a dark surrounding header');
  if (declaration.prop === 'background' && declaration.selector.includes(':hover') && /primary|danger|df-button|ksup-submit/.test(declaration.selector)) assert.ok(declaration.selector.includes(':not(:disabled)'), 'primary/danger hover cannot reactivate a disabled control');
}
for (const selector of ['.visit-catalog .vc-box','.kw-device']) rule('kitchen-device-catalog',selector,'border-inline-start','3px dashed var(--ks-attention)');
for (const selector of ['.visit-catalog[data-state=ready] .vc-box','.kw-device[data-state=ready]']) rule('kitchen-device-catalog',selector,'border-inline-start','3px solid var(--ks-complete)');
rule('kitchen-defaults','.df-panel .df-status[data-kind=error],.df-panel .df-alert','border-inline-start','3px double var(--ks-danger)');
rule('kitchen-library','.klib-status[data-bad=true]','border-inline-start','3px double var(--ks-danger)');
rule('kitchen-library','.klib-errors','border-inline-start','3px double var(--ks-danger)');
rule('kitchen-library','.klib-empty','border-style','dashed');
rule('kitchen-library','.klib-table tr:focus-within','outline','3px solid var(--ks-focus-ring)');
rule('kitchen-library','.klib-table th','z-index','var(--ks-z-sticky)');
rule('kitchen-supplier','.ksup .ksup-result[data-valid=false]','border-inline-start','3px double var(--ks-danger)');
rule('kitchen-user-library','.kul-body [data-ul-fit][data-ok="false"],.kul-body .kul-status[data-bad="true"]','border-inline-start','3px double var(--ks-danger)');
for (const [file, selector] of [['kitchen-defaults','.df-switch button[aria-pressed=true]'],['kitchen-library','.klib-tabs button[aria-pressed=true]']]) rule(file,selector,'text-decoration','underline','selection has a non-color cue');
rule('kitchen-user-library','.kul-panel','z-index','var(--ks-z-popover)');
rule('kitchen-supplier','.ksup.pro-drawer','z-index','var(--ks-z-popover)');

// Product color samples remain labeled data. These are informational swatches,
// not selectable controls; selection occurs in the finish/spatial family.
const defaults = read('public/kitchen-defaults-ui.js');
assert.ok(defaults.includes('goodColor(m.color)'), 'existing material/user color sanitizer is preserved');
assert.ok(defaults.includes("<b>'+esc(m.label)+'</b>"), 'surface swatches retain adjacent material names');
assert.ok(defaults.includes("esc(m.label)+'</dt>"), 'finish swatches retain adjacent material names');
for (const file of catalogFiles) assert.equal(checkFile(file).exceptions.length, 0, 'UI tokens do not acquire color-data exemptions');
const allowlist = JSON.parse(read('docs/design-system/allowlist.json')).entries;
assert.ok(allowlist.every(entry => entry.file && entry.selector && entry.property && entry.value && entry.reason && !entry.file.includes('*') && !entry.selector.includes('*')), 'data exceptions remain exact');
const materialSinks = checkFile('public/kitchen-defaults-ui.js');
assert.deepEqual(materialSinks.diagnostics, [], 'defaults inline material styling has complete native coverage');
assert.equal(materialSinks.exceptions.length, 2, 'both real defaults concatenated material backgrounds require exact exceptions');
for (const exception of materialSinks.exceptions) assert.equal(exception.value,"'+goodColor(m.color)+'");
assert.equal(new Set(materialSinks.exceptions.map(exception => exception.sourcePrefix)).size,2,'material expressions are bound to two distinct literal sink contexts');
assert.equal(checkSource(defaults.replaceAll('goodColor(m.color)', 'goodColor(m.Color)'), {path:'public/kitchen-defaults-ui.js'}).passed, false, 'material sink exception cannot accept a changed color expression');
const library = read('public/kitchen-library-ui.js');
assert.ok(library.includes("say('تجري قراءة الملف…',false,'loading')"), 'file loading cannot appear complete');
for (const text of ['تغيّر ربط الأعمدة. أعد المعاينة.','الحذف من المكتبة فقط؛ لا يغيّر ما نُسخ إلى مشاريع.','تُخفى الأمثلة العامة فقط ولا تُحذف. تجد ما أخفيته بعرض المخفي.']) assert.ok(library.includes(`say('${text}',false,'attention')`), 'confirmation/repreview must use attention semantics');
assert.ok(library.includes("p.dataset.state=bad?'error':state"), 'library status publishes its semantic state');
assert.ok(library.includes("say('تم تطبيق '+fmt(n)+' من السجلات على '+def().label+'.',false,'success')"), 'applied import explicitly exposes completion');
const personal = read('public/kitchen-user-library.js');
assert.ok(personal.includes("status.dataset.state=bad?'error':state"), 'personal template status publishes its semantic state');
assert.ok(personal.includes("say('الإزالة من المكتبة فقط. النسخ الموضوعة في المطابخ لا تتغير.',false,'attention')"), 'personal removal preparation cannot appear complete');
assert.ok(personal.includes("fit.dataset.state='attention'"), 'missing destination fit guidance cannot appear complete');
assert.ok(personal.includes("fit.dataset.state=added?'success':'error'"), 'personal placement readiness publishes success/error separately from missing-row guidance');
assert.ok(library.includes('class="klib-empty"') && library.includes('role="alert"') && library.includes('aria-live="polite"'), 'existing empty/import/error messaging remains explicit');
assert.match(read('public/kitchen-device-catalog.js'), /state:'none'/, 'missing-catalog readiness remains distinct');
assert.match(read('public/kitchen-device-catalog.js'), /state:'draft'/, 'draft readiness remains distinct');
assert.match(read('public/kitchen-device-catalog.js'), /'incomplete':'ready'/, 'incomplete/ready readiness remains distinct');
const qa = read('docs/design-system/qa-catalog.md');
assert.match(qa, /browser acceptance.*pending/i);
assert.match(qa, /Task 5 remains incomplete/i);
console.log(`PASS design catalog: ${catalogFiles.length} stylesheets; native policy, readiness/import states, labeled color data, selection, targets, focus, layering and motion (static evidence only).`);

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {checkFile, scanCSS} from './check-kitchen-design-native.mjs';

const root = new URL('../', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');
const manifest = read('docs/design-system/migration.md');
export const fieldFiles = [...manifest.split('### Wave 3')[1].split('### Wave 4')[0].matchAll(/`(public\/[^`]+\.css)`/g)].map(match => match[1]);
assert.equal(fieldFiles.length, 12, 'the complete Wave 3 family must be checked');
const issues = [];
for (const file of fieldFiles) {
  const source = read(file);
  const result = checkFile(file, {root:fileURLToPath(root)});
  issues.push(...result.diagnostics.map(item => `${file}:${item.line} ${item.code}: ${item.selector} ${item.property}`));
  assert.match(source, /var\(--ks-/, `${file} adopts foundation tokens`);
}
assert.deepEqual(issues, [], 'every field stylesheet must satisfy the native policy');

const visit = read('public/kitchen-visit-start.css');
const declarations = scanCSS(visit).declarations;
const has = (selector, property, value) => declarations.some(item => item.selector === selector && item.prop === property && value.test(item.value));
assert.ok(has('.visit-coordinate[data-next=true]', 'border-inline-start-width', /4px/), 'next measurement has a distinct leading edge');
assert.ok(has('.visit-coordinate[data-measured=true]', 'border-style', /double/), 'complete measurement has distinct boundary morphology');
assert.ok(has('.visit-coordinate:has(input:user-invalid)', 'border-style', /dashed/), 'invalid measurement has a non-color boundary');
assert.ok(has('.visit-coordinate:focus-within', 'outline', /3px solid var\(--ks-focus-ring\)/), 'field owner retains a stable external focus ring');
assert.ok(has('.visit-value input', 'min-height', /var\(--ks-target\)/), 'reference measurement input has a 44px target');
assert.match(visit, /\.visit-message:not\(:empty\)[\s\S]*border-inline-start:/, 'error message has a structural cue');
assert.match(visit, /prefers-reduced-motion:\s*reduce/, 'standalone reference respects reduced motion');
assert.match(visit, /\.visit-start \.visit-next:active[\s\S]*translateY\(1px\)/, 'primary press uses bounded motion');
assert.match(visit, /\.visit-dialog>header[^{]*\{[^}]*z-index:var\(--ks-z-sticky\)/, 'dialog header retains local sticky layering');
assert.match(visit, /\.visit-mast :is\(button,a\):focus-visible\{[^}]*outline-color:var\(--ks-focus-ring-dark\)/, 'dark masthead focus uses its contrasting token');

// Preserve the controller's existing data/validity/announcement contract: no
// controller edits are required to style next, complete and native invalidity.
const controller = read('public/kitchen-visit-start.js');
for (const hook of ['node.dataset.measured=','node.dataset.next=','setCustomValidity(readingError','reportValidity()','role="status"','aria-live="polite"','perimeter.showModal()','perimeterEntry.focus()']) assert.ok(controller.includes(hook), `reference state hook: ${hook}`);

const targets = {
  'public/kitchen-field-form.css':'.ff',
  'public/kitchen-field.css':'.fr-drawer',
  'public/kitchen-outline-walk.css':'.poly-survey',
  'public/kitchen-survey-entry.css':'.sv',
};
for (const [file, scope] of Object.entries(targets)) {
  const source = read(file);
  assert.ok(source.includes(`${scope} :is(button,input:not([type=checkbox]):not([type=radio]),select,textarea,summary)`), `${file} has a scoped target contract`);
  assert.match(source, /min-block-size:var\(--ks-target\)/, `${file} targets have a 44px minimum height`);
  assert.match(source, /pointer:\s*coarse/, `${file} preserves coarse-pointer width`);
}
const notebook = read('public/kitchen-survey-notebook.css');
assert.match(notebook, /\[data-notebook-status="confirmed"\][^{]*\{[^}]*border-style:\s*double/, 'actual notebook confirmed state is distinguishable without color');
assert.match(notebook, /\[data-notebook-status="invalid"\][^{]*\{[^}]*border-style:\s*dashed/, 'notebook invalid state is distinguishable without color');
const standalone = read('public/survey-studio.css');
assert.match(standalone, /@import url\(['"]\.\/kitchen-design-system\.css['"]\)/, 'independent survey entry loads the foundation');
assert.doesNotMatch(standalone, /fonts\.googleapis\.com/, 'field survey uses local fonts');
assert.match(standalone, /font-family:var\(--ks-font-ui\)/);
assert.match(standalone, /prefers-reduced-motion:\s*reduce/);
assert.doesNotMatch(standalone, /transition:\s*(?:width|height|left)\b/, 'common interaction motion does not animate layout');
for (const [file, selector] of [
  ['public/kitchen-visit-start.css', '.visit-dialog>header :is(button,a,[tabindex]):focus-visible'],
  ['public/kitchen-field.css', '.fr-drawer .fr-head :is(button,a,[tabindex]):focus-visible'],
  ['public/kitchen-stage-visit.css', '.sv .sv-workbar :is(button,summary):focus-visible'],
  ['public/kitchen-survey-notebook.css', '.sv.sv-notebook .sv-notebook-hud :is(button,a,[tabindex]):focus-visible'],
  ['public/survey-studio.css', '.context-hud :is(button,a,[tabindex]):focus-visible'],
]) {
  const declarations = scanCSS(read(file)).declarations;
  assert.ok(declarations.some(item => item.selector === selector && item.prop === 'outline' && item.value === '3px solid var(--ks-focus-ring-dark)'), `${file}: ${selector} applies the dark-surface focus ring`);
  assert.ok(declarations.some(item => item.selector === selector && item.prop === 'outline-offset' && item.value === '2px'), `${file}: dark focus retains a 2px offset`);
}
const surveyDeclarations = scanCSS(standalone).declarations;
const stageDeclarations = scanCSS(read('public/kitchen-stage-visit.css')).declarations;
const lightMenuFocus = '.sv .sv-workbar .sv-ink-more>div :is(button,summary):focus-visible';
assert.ok(stageDeclarations.some(item => item.selector === lightMenuFocus && item.prop === 'outline' && item.value === '3px solid var(--ks-focus-ring)'), 'light overflow menu resets the enclosing dark-workbar focus ring');
assert.ok(stageDeclarations.some(item => item.selector === lightMenuFocus && item.prop === 'outline-offset' && item.value === '2px'), 'light overflow menu retains the external focus offset');
assert.ok(!surveyDeclarations.some(item => item.selector === '.measure-input input' && item.prop === 'outline'), 'resting measurement input does not show an unconditional focus ring');
assert.ok(surveyDeclarations.some(item => item.selector === '.measure-input' && item.prop === 'overflow' && item.value === 'visible'), 'measurement input focus is not clipped by its wrapper');
assert.ok(surveyDeclarations.some(item => item.selector === '.measure-input input:focus-visible' && item.prop === 'outline' && item.value === '3px solid var(--ks-focus-ring)'), 'measurement keyboard focus uses the visible-focus contract');
const notebookDeclarations = scanCSS(notebook).declarations;
assert.ok(notebookDeclarations.some(item => item.selector === '.sv.sv-notebook button svg' && item.prop === 'height' && item.value === '19px'), 'notebook icon height remains proportional to its 19px width');
assert.ok(notebookDeclarations.some(item => item.selector === '.sv.sv-notebook :is(button,input,select,summary)' && item.prop === 'min-height' && item.value === '44px'), 'notebook button, rather than icon, retains the field hit target');
const qa = read('docs/design-system/qa-field.md');
assert.match(qa, /partial visit-start browser evidence/i, 'QA names partial reference evidence');
assert.match(qa, /Task 3 remains incomplete/i, 'QA does not promote partial evidence to task completion');
assert.doesNotMatch(qa, /visit-start browser acceptance pass/, 'QA does not overstate visit-start acceptance');
assert.match(qa, /implementer-reported/i, 'selector-retention evidence is attributed accurately');
console.log(`PASS design field: ${fieldFiles.length} stylesheets; policy, reference state matrix, stable focus, local layering, target contracts, standalone tokens and reduced motion (static evidence only).`);

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {checkFile, scanCSS} from './check-kitchen-design-native.mjs';

const root = new URL('../', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');
const manifest = read('docs/design-system/migration.md');
export const spatialFiles = [...manifest.split('### Wave 4')[1].split('### Wave 5')[0].matchAll(/`(public\/[^`]+\.css)`/g)].map(match => match[1]);
assert.equal(spatialFiles.length, 17, 'check the entire Wave 4 spatial family');
const issues = [];
for (const file of spatialFiles) {
  assert.match(read(file), /var\(--ks-/, `${file} consumes the foundation`);
  issues.push(...checkFile(file, {root:fileURLToPath(root)}).diagnostics);
}
assert.deepEqual(issues, [], 'all spatial declarations satisfy native color, shape, motion and focus policy');
assert.match(read('public/shelf-planner.css'), /^@import url\(['"]\.\/kitchen-design-system\.css['"]\)/, 'standalone unit entry loads the foundation');
const has = (file, selector, property, value) => scanCSS(read(`public/${file}.css`)).declarations.some(item => item.selector === selector && item.prop === property && item.value === value);
const requireRule = (file, selector, property, value, reason) => assert.ok(has(file, selector, property, value), reason);
// Bounded cascade checks for the exact state selectors below. These compare
// specificity and source order; they do not substitute for browser matching.
const selectorList = selector => selector.split(/,(?![^()]*\))/).map(part => part.trim());
const effectiveContract = (file, property, applicable, shorthands = []) => {
  const matches = scanCSS(read(`public/${file}.css`)).declarations.flatMap(declaration => {
    if (![property, ...shorthands].includes(declaration.prop)) return [];
    return selectorList(declaration.selector).filter(selector => Object.hasOwn(applicable, selector)).map(selector => ({...declaration, selector, specificity:applicable[selector]}));
  });
  return matches.sort((a,b) => a.specificity - b.specificity || a.offset - b.offset).at(-1);
};
const reviewIssues = [];
const invalidHint = effectiveContract('shelf-palette-drag', 'color', {
  '.sp-palette-ghost-copy small':11,
  '.sp-palette-ghost[data-feedback=invalid] small':21,
});
if (invalidHint?.value !== 'var(--ks-surface-1)') reviewIssues.push('invalid drag-ghost hint must use surface-1 text after state-specific cascade');
for (const [file, selector] of [
  ['kitchen-designer-studio','.proposal-studio.designer-studio .pd-stagebar :is(select,.pd-segment[aria-pressed="true"],.pd-elevation.active,.pd-icon-tool[aria-pressed="true"],.pd-tiers [aria-pressed="true"]):focus-visible'],
  ['kitchen-finish-studio','.finish-desk.finish-studio .finish-viewbar :is(select,[aria-pressed="true"]):focus-visible'],
]) {
  if (!has(file, selector, 'outline', '3px solid var(--ks-focus-ring-dark)')) reviewIssues.push(`${file}: selected dark-toolbar controls require the external dark-surface ring`);
  const weakening = scanCSS(read(`public/${file}.css`)).declarations.filter(item => item.selector.includes(file.includes('designer') ? '.pd-stagebar' : '.finish-viewbar') && item.selector.includes('aria-pressed') && /:focus/.test(item.selector) && item.prop === 'outline' && item.value === '3px solid var(--ks-focus-ring)');
  if (weakening.length) reviewIssues.push(`${file}: a selected toolbar focus override still substitutes the light-surface token`);
}
for (const hasKinds of [false,true]) {
  const inspectorSelectors = {'.finish-desk.finish-studio .finish-options':30};
  if (hasKinds) inspectorSelectors['.finish-desk.finish-studio .finish-options:has(.finish-kinds)'] = 40;
  const edge = effectiveContract('kitchen-finish-studio','border-inline-start',inspectorSelectors,['border']);
  if (edge?.value !== '3px solid var(--ks-action)') reviewIssues.push(`finish inspector action edge loses the specificity/source-order cascade (has kinds: ${hasKinds})`);
}
assert.deepEqual(reviewIssues, [], 'reviewed spatial state and cascade contracts');
requireRule('kitchen-stage-design', '.proposal-studio .pd-canvas .pd-selected-shape', 'stroke', 'var(--ks-action)', 'selected drawing uses the action outline');
requireRule('kitchen-designer-studio', '.proposal-studio.designer-studio .pd-inspector', 'border-inline-start', '3px solid var(--ks-action)', 'selected inspector shares drawing action edge');
requireRule('kitchen-finish-studio', '.finish-desk.finish-studio [data-finish-drawing] [data-kitchen-selected]', 'stroke', 'var(--ks-action)', 'finish drawing keeps action selection');
requireRule('kitchen-finish-studio', '.finish-desk.finish-studio .finish-options', 'border-inline-start', '3px solid var(--ks-action)', 'finish inspector shares action relationship');
requireRule('shelf-canvas', '.shc-view [data-shelf-active]', 'stroke', 'var(--ks-action)', 'shelf canvas selection uses action');
requireRule('shelf-dock', '#shelf-inspector.sp-inspector', 'border-inline-start', '3px solid var(--ks-action)', 'shelf inspector shares action boundary');
requireRule('kitchen-designer-studio', '.proposal-studio.designer-studio .ds-basis :is([data-state="confirmed"],[data-state="valid"])', 'color', 'var(--ks-complete)', 'verified source basis uses completion semantics');
requireRule('kitchen-designer-studio', '.proposal-studio.designer-studio :is([data-ds-walls],[data-ds-units]) > button:is([aria-pressed="true"],[aria-current="true"]):focus-visible', 'outline-offset', '2px', 'selected object still exposes an external keyboard ring');
requireRule('kitchen-finish-studio', '.finish-desk.finish-studio .fs-objects [data-finish-object]:is([aria-pressed="true"],[aria-current="true"]):focus-visible', 'outline-offset', '2px', 'selected finish object still exposes an external keyboard ring');
for (const [selector, value] of [['.sp-sand','#d8c6ae'],['.sp-sage','#adb99c'],['.sp-stone','#bec0b6']]) requireRule('shelf-planner',selector,'background',value,`${selector} retains its authored material sample`);
const exceptions = spatialFiles.flatMap(file => checkFile(file, {root:fileURLToPath(root)}).exceptions);
assert.equal(exceptions.length, 22, 'spatial exceptions stay bounded to the 22 exact data declarations');
for (const [file, scope] of [
  ['kitchen-designer-studio','.proposal-studio.designer-studio'],
  ['kitchen-finish-studio','.finish-desk.finish-studio'],
  ['shelf-planner','.shelf-planner'],
]) {
  requireRule(file, `${scope} :is(button,a,summary):not(:disabled):not([aria-disabled="true"]):active`, 'transform', 'translateY(1px)', `${scope} bounded press response`);
  requireRule(file, `${scope} :is(button,a,summary):not(:disabled):not([aria-disabled="true"]):active`, 'box-shadow', 'none', `${scope} press collapses elevation`);
  requireRule(file, `${scope} :is(button,input:not([type=checkbox]):not([type=radio]),select,textarea,summary)`, 'min-block-size', 'var(--ks-target)', `${scope} principal target height`);
  requireRule(file, `${scope} :is(button,a,summary)`, 'min-inline-size', 'var(--ks-target)', `${scope} principal target width`);
  assert.match(read(`public/${file}.css`), /pointer:\s*coarse/, `${scope} coarse-pointer target contract`);
  assert.match(read(`public/${file}.css`), /prefers-reduced-motion:\s*reduce/, `${scope} reduced motion`);
}
for (const [file, selector, ring] of [
  ['kitchen-designer-studio','.proposal-studio.designer-studio .pd-stagebar :focus-visible','dark'],
  ['kitchen-designer-studio','.proposal-studio.designer-studio .pd-help p :focus-visible','light'],
  ['kitchen-finish-studio','.finish-desk.finish-studio .finish-viewbar :focus-visible','dark'],
  ['shelf-dock','#shelf-inspector :is(button,input,select,summary):focus-visible','light'],
  ['shelf-dock','#shelf-dock-grid > .sp-dock-button:is([aria-pressed="true"],[aria-expanded="true"]):focus-visible','light'],
]) {
  requireRule(file, selector, 'outline', `3px solid var(--ks-focus-ring${ring === 'dark' ? '-dark' : ''})`, `${selector} contrasts with its surface`);
  requireRule(file, selector, 'outline-offset', '2px', `${selector} preserves external offset`);
}
requireRule('shelf-dock','#shelf-dock-grid > .sp-dock-button:is([aria-pressed="true"],[aria-expanded="true"])','border-style','double','active tool has a non-color boundary');
requireRule('kitchen-row-strip','.krs .krs-cell[aria-pressed=true]','border-style','double','selected row cell has non-color feedback');
requireRule('shelf-view','.sp-view-tabs button[aria-pressed=true]','text-decoration','underline','view state has non-color feedback');
for (const [file, selector, layer] of [
  ['shelf-dock','#shelf-inspector.sp-inspector','popover'],
  ['shelf-dock','.sp-file-items','popover'],
  ['shelf-dock','#shelf-merge-prompt.sp-merge','popover'],
  ['shelf-palette-drag','.sp-palette-ghost','toast'],
  ['kitchen-workspace-ui','.k-drawing-menu','popover'],
]) requireRule(file,selector,'z-index',`var(--ks-z-${layer})`,`${selector} uses the shared layer contract`);
const foundation = scanCSS(read('public/kitchen-design-system.css')).declarations;
const layer = name => Number(foundation.find(item => item.prop === `--ks-z-${name}`).value);
assert.ok(layer('dialog') > layer('popover') && layer('popover') > layer('sticky'), 'floating spatial palettes remain below the shared dialog layer');
const designer = read('public/kitchen-designer-studio.js');
assert.ok(designer.includes('aria-pressed="\'+(selected===u.id)'), 'existing selected unit drives the rail state');
assert.ok(designer.includes("canvas.querySelector('.pd-selected-shape')"), 'canvas selection still drives the persistent HUD');
const qa = read('docs/design-system/qa-spatial.md');
assert.match(qa, /browser acceptance.*pending/i, 'QA must retain the browser acceptance boundary');
assert.match(qa, /Task 4 remains incomplete/i, 'source checks cannot promote Task 4 to accepted');
console.log(`PASS design spatial: ${spatialFiles.length} stylesheets; native policy, selection linkage, targets, press/focus, layering and reduced motion (static evidence only).`);

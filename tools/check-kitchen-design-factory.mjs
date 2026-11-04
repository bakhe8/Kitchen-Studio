import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {checkFile, checkSource, scanCSS} from './check-kitchen-design-native.mjs';

const root = new URL('../', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');
const manifest = read('docs/design-system/migration.md');
export const factoryFiles = [...manifest.split('### Wave 6')[1].split('### Wave 7')[0].matchAll(/`(public\/[^`]+\.css)`/g)].map(match => match[1]);
assert.equal(factoryFiles.length, 5, 'cover all five Wave 6 stylesheets');
for (const file of factoryFiles) assert.match(read(file), /var\(--ks-/, `${file} consumes foundation tokens`);
const diagnostics = factoryFiles.flatMap(file => checkFile(file, {root:fileURLToPath(root)}).diagnostics);
assert.deepEqual(diagnostics, [], 'factory UI satisfies semantic color, morphology, focus and motion policy');
const declarations = file => scanCSS(read(`public/${file}.css`)).declarations;
const rule = (file, selector, prop, value) => assert.ok(declarations(file).some(item => item.selector === selector && item.prop === prop && item.value === value), `${file} ${selector} ${prop}: ${value}`);

for (const [file, scope] of [['kitchen-factory-pages','.k-workshop'],['kitchen-production-studio','.production-studio.production-studio'],['kitchen-workshop-factory','.kw-factory'],['kitchen-workshop','.k-workshop']]) {
  rule(file, `${scope} :is(button,input:not([type=checkbox]):not([type=radio]):not([type=file]),select,textarea,summary)`, 'min-block-size', 'var(--ks-target)');
  rule(file, `${scope} :is(button,a,summary,.kw-file)`, 'min-inline-size', 'var(--ks-target)');
  rule(file, `${scope} :is(button,input,select,textarea,summary,a,[tabindex]):focus-visible`, 'outline', '3px solid var(--ks-focus-ring)');
  rule(file, `${scope} :is(button,input,select,textarea,summary,a,[tabindex]):focus-visible`, 'outline-offset', '2px');
  rule(file, `${scope} :is(button,a,summary):not(:disabled):not([aria-disabled="true"]):active`, 'transform', 'translateY(1px)');
  rule(file, `${scope} :is(button,a,summary):not(:disabled):not([aria-disabled="true"]):active`, 'box-shadow', 'none');
  assert.match(read(`public/${file}.css`), /@media\s*\(pointer:\s*coarse\)/, 'explicit coarse pointer targets');
  assert.match(read(`public/${file}.css`), /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'nonessential motion can be removed');
}
// Fine-pointer tracks encode start/end gaps as measured geometry. Only an
// explicitly scoped coarse/narrow alternative may replace that geometry.
const rowRules = factoryFiles.flatMap(file=>scanCSS(read(file)).declarations);
const alternative = item => item.contexts.some(context=>/@media.*(?:pointer:\s*coarse|max-width:)/.test(context));
for(const item of rowRules.filter(item=>item.selector.includes('.pwr-track') && !alternative(item))) {
  if(item.prop==='position')assert.equal(item.value,item.selector.includes('button')?'absolute':'relative','fine-pointer track must preserve absolute measured placement');
  if(/^(?:inset(?:-[\w-]+)?|flex(?:-(?:grow|shrink|basis|wrap))?)$/.test(item.prop))assert.fail('fine-pointer measured start/width cannot be reset');
  if(item.prop==='width')assert.ok(item.selector==='.pwr-track' && item.value==='100%','fine-pointer unit widths must come only from measured inline percentages');
  if(item.prop==='display' && item.selector==='.pwr-track')assert.notEqual(item.value,'flex','fine-pointer track cannot collapse measured gaps into a flex layout');
  if(/^(?:min-inline-size|min-width)$/.test(item.prop))assert.equal(item.value,'0','fine-pointer minimum width cannot distort a narrow measured unit');
}
rule('kitchen-production-row','.k-workshop .pwr-track button','position','absolute');
rule('kitchen-production-row','.k-workshop .pwr-track button','min-inline-size','0');
const rowUI=read('public/kitchen-production-row-ui.js');
assert.ok(!rowUI.includes('flex-grow:'),'measured row markup does not substitute a relative flex weight');
const rowTrackSource=rowUI.slice(rowUI.indexOf('function rowTrack('),rowUI.indexOf('export function mountRowStep'));
const renderTrack=new Function('esc','fmt','rowLabels',`return (${rowTrackSource.trim()});`)(String,String,{storage:'Storage'});
const measuredTrack=renderTrack([{id:'first',family:'storage',startMm:1300,widthMm:600},{id:'second',family:'storage',startMm:2300,widthMm:900}],{start:100,end:600},{});
assert.match(measuredTrack,/dir="ltr"/,'start coordinates keep the original left-to-right measurement origin');
const measured=[...measuredTrack.matchAll(/style="inset-inline-start:([\d.]+)%;width:([\d.]+)%"/g)].map(match=>[Number(match[1]),Number(match[2])]);
assert.deepEqual(measured,[[6,12],[26,18]],'a non-zero run origin preserves both exact start and width percentages');
assert.equal(measured[1][0]-measured[0][0]-measured[0][1],8,'400mm reserved gap stays visible as 8% of a 5000mm run');
assert.equal(measured[0][0],6,'300mm leading gap remains visible');
assert.equal(100-measured[1][0]-measured[1][1],56,'2800mm trailing gap remains visible');
const coarseRow = declarations('kitchen-production-row').filter(item => item.contexts.some(context => /pointer:\s*coarse/.test(context)));
assert.ok(coarseRow.some(item => item.selector === '.k-workshop .pwr-track button' && item.prop === 'position' && item.value === 'static'), 'coarse tracks cannot overlap narrow adjacent actions');
assert.ok(coarseRow.some(item => item.selector === '.k-workshop .pwr-track button' && item.prop === 'width' && item.value === 'auto!important'), 'coarse targets override proportional inline widths');
// The later studio-family stylesheet fixes desktop preview tracks to 60px.
// Resolve the actual focused source order and selector specificity so wrapped
// 44px coarse controls can grow without overflowing that fixed preview height.
const index=read('public/index.html');
const rowHeightFiles=['public/kitchen-production-row.css','public/kitchen-stage-design.css'].sort((a,b)=>index.indexOf(a.slice(7))-index.indexOf(b.slice(7)));
assert.ok(rowHeightFiles.every(file=>index.includes(file.slice(7))),'cross-family regression uses stylesheets loaded by the actual page');
const heightSelectors=new Set(['.pwr-track','.pwr-desk [data-pwr-result] .pwr-track','.k-workshop .pwr-desk [data-pwr-result] .pwr-track']);
const heightDeclarations=rowHeightFiles.flatMap(file=>scanCSS(read(file)).declarations.filter(item=>item.prop==='height' && item.selector.includes('.pwr-track')));
const previewHeight=(pointer,width)=>{
  const candidates=heightDeclarations.filter(item=>item.contexts.filter(context=>context.startsWith('@media')).every(context=>{
    const min=context.match(/min-width:\s*([\d.]+)px/),max=context.match(/max-width:\s*([\d.]+)px/),device=context.match(/pointer:\s*(coarse|fine)/);
    assert.ok(min||max||device,`unsupported track-height media in focused cascade fixture: ${context}`);
    return (!min||width>=Number(min[1]))&&(!max||width<=Number(max[1]))&&(!device||pointer===device[1]);
  }));
  let winner=null,score=-1;
  for(const item of candidates){
    assert.ok(heightSelectors.has(item.selector),`review new preview-height selector in the cascade fixture: ${item.selector}`);
    const specificity=[...item.selector.matchAll(/\.[\w-]+|\[[^\]]+\]/g)].length;
    if(specificity>=score){winner=item;score=specificity;}
  }
  return winner?.value;
};
assert.equal(previewHeight('coarse',1024),'auto','coarse preview must grow past the later 60px studio rule when 44px actions wrap');
assert.equal(previewHeight('fine',1024),'60px','fine-pointer desktop preview retains its existing fixed measured drawing');
assert.equal(previewHeight('fine',600),'49px','fine-pointer narrow preview retains its original measured track height');
for (const file of factoryFiles) for (const item of scanCSS(read(file)).declarations) {
  if (item.prop === 'outline-offset') assert.equal(item.value, '2px', 'external focus offset contract');
  if (item.value.includes('--ks-focus-ring-dark')) assert.match(item.selector, /ps-header|ws-(?:route-)?head/, 'bright focus belongs on dark surrounding chrome only');
}
rule('kitchen-production-studio','.production-studio.production-studio .ps-header :is(button,a):focus-visible','outline','3px solid var(--ks-focus-ring-dark)');
rule('kitchen-workshop','.k-workshop .ws-head :is(button,a):focus-visible','outline','3px solid var(--ks-focus-ring-dark)');
const routeFocus = declarations('kitchen-workshop').filter(item=>item.selector==='.k-workshop .ws-route-head button:focus-visible' && item.prop==='outline');
assert.ok(routeFocus.some(item=>item.value==='3px solid var(--ks-focus-ring)' && !item.contexts.some(context=>context.startsWith('@media'))),'actual mobile route head has a light surround');
assert.ok(routeFocus.some(item=>item.value==='3px solid var(--ks-focus-ring-dark)' && item.contexts.some(context=>/@media.*min-width:768px/.test(context))),'actual desktop route head sits on dark titlebar chrome');
rule('kitchen-workshop','.k-workshop','z-index','var(--ks-z-popover)');
rule('kitchen-workshop','.k-workshop','border-radius','var(--ks-radius-overlay)');
rule('kitchen-workshop-factory','.kw-factory .kw-tbl tr:focus-within','outline','3px solid var(--ks-focus-ring)');
rule('kitchen-factory-pages','.k-workshop .kf-cut-register th','z-index','var(--ks-z-sticky)');
rule('kitchen-workshop-factory','.kw-catalog-import .fs-import-table th','z-index','var(--ks-z-sticky)');
rule('kitchen-factory-pages','.k-workshop .kw-register .kw-stock-row[aria-pressed=true]','text-decoration','underline');
rule('kitchen-workshop-factory','.kw-factory .kw-tabs [aria-pressed=true]','border-style','double');
rule('kitchen-production-studio','.production-studio :is(.ps-unit,.ps-piece,.ps-viewbar button)[aria-pressed="true"]','text-decoration','underline');

for (const [state,semantic,style] of [['ready','complete','solid'],['attention','attention','dashed'],['blocked','danger','double']]) {
  rule('kitchen-factory-pages',`.k-workshop .kf-stock-claim [data-state=${state}]`,'border-inline-start',`3px ${style} var(--ks-${semantic})`);
}
rule('kitchen-production-studio','.production-studio [data-production-gates][data-state=ready]','border-inline-start','3px solid var(--ks-complete)');
for (const [state,semantic,style] of [['conflict','attention','double'],['blocked','danger','double']]) {
  rule('kitchen-production-studio',`.production-studio [data-production-gates] [data-state=${state}]`,'border-inline-start',`3px ${style} var(--ks-${semantic})`);
}
rule('kitchen-production-studio','.production-studio [data-production-gates] [data-state=conflict]','text-decoration','underline wavy');
rule('kitchen-production-studio','.production-studio [data-production-gates] [data-state=blocked]','font-weight','700');
rule('kitchen-production-studio','.production-studio [data-production-error]:not(:empty)','border-inline-start','3px double var(--ks-danger)');
rule('kitchen-production-studio','.production-studio.production-studio .ps-status','color','var(--ks-info)');
rule('kitchen-workshop-factory','.kw-summary>div,.kw-hint','background','var(--ks-surface-2)');
rule('kitchen-factory-pages','.k-workshop .kw-item-error:not(:empty)','border-inline-start','3px double var(--ks-danger)');
rule('kitchen-factory-pages','.k-workshop .kw-draft-warning','border-inline-start','3px dashed var(--ks-attention)');
rule('kitchen-workshop-factory','.kw-factory .kw-hint','border-inline-start','3px dashed var(--ks-attention)');
const destructive = '.k-workshop :is([data-factory-act=removeLine],[data-factory-act=discardItem],[data-special-remove],[data-corner-delete],[data-remove-drawer],[data-brief-remove],[data-inv-act=cancel],[data-inv-act=consume])';
rule('kitchen-factory-pages',destructive,'color','var(--ks-danger)');
rule('kitchen-factory-pages',destructive,'border','3px double var(--ks-danger)');
rule('kitchen-factory-pages',destructive,'text-decoration','underline');
rule('kitchen-production-studio','.production-studio.production-studio .ps-history [data-production-action="cancel"]','border','3px double var(--ks-danger)');

const production = read('public/kitchen-production-studio.js');
assert.ok(production.includes("g.origin==='collision'?'conflict':'blocked'"), 'existing collision concerns expose conflict separately from other blocking concerns');
assert.ok(production.includes("gates.dataset.state=groups.length?'blocked':'ready'"), 'gate container exposes ready independently from saved state');
assert.ok(production.includes("impact.dataset.state=error?'invalid':draft?'preview':'info'"), 'impact cannot look complete solely because it is saved');
const inventory = read('public/kitchen-workshop-inventory-ui.js');
assert.ok(inventory.includes("l.free==null?'attention':l.free<l.qty?'blocked':'ready'"), 'existing unknown, deficient and sufficient stock retain distinct presentation');
assert.ok(inventory.includes(' · مطلوب ') && inventory.includes(' / متاح '), 'non-color required/free stock quantities remain explicit');
assert.ok(inventory.includes("claim.lines.some(l=>l.free==null||l.free<l.qty)"), 'reservation guard is preserved');
const factory = read('public/kitchen-workshop-factory-ui.js');
assert.ok(factory.includes("action('keepItem','متابعة التعديل')") && factory.includes("action('discardItem','تجاهل التعديلات وانتقل')"), 'existing discard preparation and retained-edit recovery remain explicit');
assert.ok(factory.includes('/^#[a-f0-9]{6}$/i.test(i.colorHex)') && factory.includes('class="kw-stock-label"'), 'original material sanitizer and adjacent identity remain present');
const samples=checkFile('public/kitchen-workshop-factory-ui.js');
assert.deepEqual(samples.diagnostics,[],'original material styling sink is fully checked');
assert.equal(samples.exceptions.length,1,'only the original validated stock swatch receives a product-data exception');
assert.equal(samples.exceptions[0].value,"'+color+'");
assert.equal(checkSource(factory.replace("style=\"background:'+color+'", "style=\"background:'+Color+'"),{path:'public/kitchen-workshop-factory-ui.js'}).passed,false,'material color expression remains case-sensitive');
assert.equal(checkSource(factory.replace('class="kw-stock-swatch" style=', 'class="kw-action" style='),{path:'public/kitchen-workshop-factory-ui.js'}).passed,false,'product-data exemption cannot move into a new UI context');

const tokens = Object.fromEntries(scanCSS(read('public/kitchen-design-system.css')).declarations.filter(item => item.prop.startsWith('--ks-')).map(item => [item.prop,item.value]));
const luminance = token => tokens[token].slice(1).match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
for (const [foreground,background,threshold] of [['--ks-focus-ring','--ks-surface-1',3],['--ks-focus-ring','--ks-surface-inset',3],['--ks-focus-ring-dark','--ks-ink-strong',3],['--ks-ink','--ks-action-soft',4.5],['--ks-complete','--ks-complete-soft',4.5],['--ks-attention','--ks-attention-soft',4.5],['--ks-danger','--ks-danger-soft',4.5]]) {
  const values=[luminance(foreground),luminance(background)].sort((a,b)=>a-b);
  assert.ok((values[1]+.05)/(values[0]+.05)>=threshold,`${foreground} contrasts against ${background}`);
}
const allowlist = JSON.parse(read('docs/design-system/allowlist.json')).entries.filter(entry=>factoryFiles.includes(entry.file));
assert.equal(allowlist.length,5,'only five original technical outline/hole palette declarations are exempt');
assert.ok(allowlist.every(entry=>entry.file==='public/kitchen-factory-pages.css' && /\.kf-(?:outline|holes)/.test(entry.selector) && entry.category==='technical-visualization' && entry.reason && !entry.selector.includes('*')), 'technical exceptions stay exact and cannot waive control state');
assert.equal(factoryFiles.flatMap(file=>checkFile(file).exceptions).length,5,'all five documented technical declarations remain present');
const qa=read('docs/design-system/qa-factory.md');
assert.match(qa,/browser acceptance.*pending/i);
assert.match(qa,/Task 6 remains incomplete/i);
console.log(`PASS design factory: ${factoryFiles.length} stylesheets; native policy, compact/coarse targets, stock and gate states, destructive morphology, selection, focus, layers and motion (static evidence only).`);

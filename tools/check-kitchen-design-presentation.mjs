import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {checkFile, scanCSS} from './check-kitchen-design-native.mjs';

// Catches migration gaps, lost decision cues, a screen-only print cascade,
// clipped ledgers, blanket technical recoloring, and focus/target regressions.
const root = new URL('../', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');
const manifest = read('docs/design-system/migration.md');
export const presentationFiles = [...manifest.split('### Wave 7')[1].split('### Wave 8')[0].matchAll(/^- `(public\/[^`]+\.css)`/gm)].map(match => match[1]);
assert.equal(presentationFiles.length, 4, 'cover the entire Wave 7 manifest');
for (const file of presentationFiles) assert.match(read(file), /var\(--ks-/, `${file} consumes foundation tokens`);
assert.ok(existsSync(new URL('public/kitchen-design-print.css', root)), 'dedicated print stylesheet exists');
assert.deepEqual([...presentationFiles, 'public/kitchen-design-print.css'].flatMap(file => checkFile(file, {root:fileURLToPath(root)}).diagnostics), [], 'presentation and print satisfy native policy');
const declarations = file => scanCSS(read(`public/${file}.css`)).declarations;
const rule = (file, selector, prop, value) => assert.ok(declarations(file).some(item => item.selector === selector && item.prop === prop && item.value === value), `${file}: ${selector} ${prop}: ${value}`);
const scopes = [['kitchen-proposal-ui','.ws-content .proposal-studio'],['kitchen-quote-studio','.quote-studio.quote-studio'],['kitchen-delivery-studio','.delivery-studio.delivery-studio'],['kitchen-stage-review','.k-workshop:is([data-ws-route="quote"],[data-ws-route="approve"],[data-ws-route="sign"])']];
for (const [file, scope] of scopes) {
  rule(file, `${scope} :is(button,input:not([type=checkbox]):not([type=radio]),select,textarea,summary)`, 'min-block-size', 'var(--ks-target)');
  rule(file, `${scope} :is(button,a,summary)`, 'min-inline-size', 'var(--ks-target)');
  rule(file, `${scope} :is(button,a,input,select,textarea,summary,[tabindex]):focus-visible`, 'outline', '3px solid var(--ks-focus-ring)');
  rule(file, `${scope} :is(button,a,input,select,textarea,summary,[tabindex]):focus-visible`, 'outline-offset', '2px');
  rule(file, `${scope} :is(button,a,summary):not(:disabled):not([aria-disabled="true"]):active`, 'transform', 'translateY(1px)');
  assert.match(read(`public/${file}.css`), /@media\s*\(pointer:\s*coarse\)/, 'coarse targets');
  assert.match(read(`public/${file}.css`), /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'reduced motion');
}
for (const file of presentationFiles) for (const item of scanCSS(read(file)).declarations) {
  if (item.prop === 'outline-offset') assert.equal(item.value, '2px', 'external keyboard focus contract');
  if (item.value.includes('--ks-focus-ring-dark')) assert.match(item.selector, /dl-header|kq-project-head/, 'bright focus only on dark surround');
}
rule('kitchen-delivery-studio','.delivery-studio.delivery-studio .dl-header :is(button,a):focus-visible','outline','3px solid var(--ks-focus-ring-dark)');
rule('kitchen-stage-review','.customer-preview','z-index','var(--ks-z-dialog)');
rule('kitchen-stage-review','.customer-preview','background','var(--ks-canvas)');
rule('kitchen-stage-review','.customer-preview>header','background','var(--ks-surface-1)');
rule('kitchen-stage-review','.cp-actions>:is(a,button):focus-visible','outline','3px solid var(--ks-focus-ring)');
rule('kitchen-proposal-ui','.proposal-studio .pd-width','grid-template-columns','var(--ks-target) minmax(var(--ks-target),1fr) var(--ks-target)');
rule('kitchen-proposal-ui','.proposal-studio :is([aria-pressed=true],.pd-elevation.active)','text-decoration','underline');
rule('kitchen-proposal-ui','.ws-content .proposal-studio .pd-error','border-inline-start','3px double var(--ks-danger)');
rule('kitchen-proposal-ui','.ws-content .proposal-studio .pd-transfer','border-inline-start','3px solid var(--ks-complete)');
rule('kitchen-quote-studio','.quote-studio .qs-summary .qs-total strong','font-size','clamp(24px,2.8cqi,32px)');
for (const [state,semantic,style] of [['preview','attention','dashed'],['saving','attention','dashed'],['invalid','danger','double'],['stale','danger','double']]) {
  rule('kitchen-quote-studio',`.quote-studio[data-state="${state}"] .qs-status`,'border-inline-start',`3px ${style} var(--ks-${semantic})`);
}
rule('kitchen-delivery-studio','.delivery-studio .dl-progress [data-reached="true"]','border-bottom-style','double');
rule('kitchen-delivery-studio','.delivery-studio .dl-progress [aria-current="step"]','text-decoration','underline');
rule('kitchen-delivery-studio','.delivery-studio .dl-observation[data-severity="blocking"]','border-inline-start','3px double var(--ks-danger)');
rule('kitchen-delivery-studio','.delivery-studio .dl-observation[data-resolved="true"]','border-inline-start','3px solid var(--ks-complete)');
rule('kitchen-stage-review','.k-workshop[data-ws-route="quote"] [data-factory-act="approve"]','border-style','double');
rule('kitchen-stage-review','.k-workshop .kf-sign-gates [data-done="true"]','border-inline-start','3px solid var(--ks-complete)');
rule('kitchen-stage-review','.k-workshop .kf-sign-gates [data-done="false"]','border-inline-start','3px dashed var(--ks-attention)');
rule('kitchen-stage-review','.k-workshop .dp-approval-issue','border-inline-start','3px double var(--ks-danger)');
// Header and revision/decision content keep their existing semantic hierarchy.
rule('kitchen-stage-review','.k-workshop[data-ws-route="quote"] .kw-factory .kq-project-head h3','font-size','clamp(21px,2.4vw,32px)');
const print = declarations('kitchen-design-print');
assert.ok(print.length > 10 && print.every(item => item.contexts.some(context => /^@media print/.test(context))), 'every print declaration is media scoped');
const app = 'body[data-project-mode]';
rule('kitchen-design-print',app,'background','#fff!important');
rule('kitchen-design-print',app,'color','#000!important');
rule('kitchen-design-print',`${app} :is(.k-workshop,.ws-content,.ws-screen,.ws-card,.proposal-studio,.quote-studio,.delivery-studio,.production-studio)`, 'position','static!important');
rule('kitchen-design-print',`${app} :is(.pd-stage,.pd-canvas,.dl-canvas-wrap,.dl-hud,.qs-summary,.qs-summary>*,.kq-project-head,.dl-header,.ps-header)`, 'box-shadow','none!important');
rule('kitchen-design-print',`${app} :is(.pd-stage,.pd-canvas,.dl-canvas-wrap,.dl-hud,.qs-summary,.qs-summary>*,.kq-project-head,.dl-header,.ps-header)`, 'background','transparent!important');
rule('kitchen-design-print',`${app} :is(.qs-ledger,.kq-shop,.ws-release-review,.dl-events,.ps-ledger,.ps-capability,.ps-machine-book)::details-content`,'content-visibility','visible!important');
rule('kitchen-design-print',`${app} :is(.qs-ledger,.kq-shop,.ws-release-review,.dl-events,.ps-ledger,.ps-capability,.ps-machine-book)>:not(summary)`,'display','revert!important');
rule('kitchen-design-print',`${app} :is(.pd-stage,.pd-canvas,.dl-drawing,.ps-canvas,.kw-tbl,.qs-ledger,.dl-events,.ws-release-review)`,'break-inside','avoid');
// Do not flatten/recolor SVG geometry or hide report/approval/receipt content.
for (const item of print) {
  assert.ok(!(item.selector.includes('svg') && /^(?:fill|stroke|stroke-width|color|filter)$/.test(item.prop)), 'print keeps authored technical lines/palettes');
  if (item.prop === 'display' && /none/.test(item.value)) assert.doesNotMatch(item.selector, /\.qs-ledger|\.ps-ledger|\.ps-capability|\.ps-machine-book|\.kq-review|\.dl-events|\.dl-receipt|\.dl-observation|\.ws-release-review|\bsvg\b/, 'export-relevant content stays available');
}
const shell = read('public/kitchen-shell.css');
assert.ok(shell.indexOf('@import "./kitchen-design-print.css"') > shell.indexOf('@import "./kitchen-design-system.css"'), 'print is imported after foundation through the actual shell');
assert.match(read('public/index.html'), /kitchen-shell\.css/, 'the main app loads the print import owner');
assert.ok(shell.slice(0,shell.indexOf('.kitchen-entry-link')).includes('@import "./kitchen-design-print.css"'), 'print import precedes normal shell style rules');
rule('kitchen-delivery-studio','.delivery-studio .dl-dimension line','stroke','currentColor');
rule('kitchen-delivery-studio','.delivery-studio .dl-dimension line','stroke-width','1.25');
rule('kitchen-delivery-studio','.delivery-studio .dl-dimension[data-noted="true"] .dl-dimension-hit','stroke-dasharray','5 3');
rule('kitchen-delivery-studio','.delivery-studio .dl-dimension[data-draft="true"] .dl-dimension-hit','stroke-dasharray','4 3');
for (const file of presentationFiles) assert.doesNotMatch(read(file), /var\(--[\w-]*var\(/, 'migration leaves valid variable references');
const printed = read('public/kitchen-customer-sheet-style.js');
assert.match(printed, /@media print/, 'self-contained customer export retains its own print contract');
assert.match(read('public/kitchen-proposal-presentation.js'), /beforeprint/, 'export disclosures retain existing beforeprint expansion');
// Model the baseline cascade in actual link/import order. The later studio
// body and app rules used to override the early normal print baseline.
const baselineFiles = [...read('public/index.html').matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="\.\/([^"?]+\.css)"/g)].map(match=>match[1]).filter(file=>['kitchen-shell.css','kitchen-studio.css'].includes(file));
assert.deepEqual(baselineFiles,['kitchen-shell.css','kitchen-studio.css']);
const baseline = baselineFiles.flatMap(file=>file==='kitchen-shell.css'?[...print,...declarations('kitchen-shell')]:declarations('kitchen-studio'));
const matchesBaseline = (selector,target)=>target==='body'?/^body\[data-project-mode(?:=(?:"?kitchen"?))?\]$/.test(selector):/^(?:\.k-app|body\[data-project-mode(?:=(?:"?kitchen"?))?\]\s*>?\s*\.k-app)$/.test(selector);
const baselineValue = (target,property)=>{
 let winner=null,score=-1;
 for(const item of baseline){
  if(!matchesBaseline(item.selector,target)||item.prop!==property||item.contexts.some(c=>/^@media/.test(c)&&!/^@media print/.test(c)))continue;
  const rank=(/!important$/.test(item.value)?1000:0)+([...item.selector.matchAll(/\.[\w-]+|\[[^\]]+\]/g)].length*10)+(item.selector.startsWith('body')?1:0);
  if(rank>=score){winner=item;score=rank;}
 }
 return winner?.value.replace(/!important$/,'').trim();
};
assert.equal(baselineValue('body','background'),'#fff','actual later screen body styles cannot replace printed paper');
assert.equal(baselineValue('body','color'),'#000','actual later screen body styles cannot replace printed black ink');
assert.equal(baselineValue('app','background'),'transparent','actual later .k-app styles cannot tint printed paper');
assert.equal(baselineValue('app','color'),'inherit','actual later .k-app styles inherit printed black ink');
// Bind disclosure coverage to the production controller's actual details hooks.
const productionDetails=[...read('public/kitchen-production-studio.js').matchAll(/<details class="(ps-[\w-]+)"/g)].map(match=>match[1]);
assert.ok(productionDetails.includes('ps-ledger'),'actual production ledger is a details element');
for(const name of productionDetails){
 const content=print.filter(item=>item.selector.includes(`.${name}`)&&item.selector.endsWith('::details-content'));
 assert.ok(content.some(item=>item.prop==='content-visibility'&&item.value==='visible!important'),`actual details.${name} content is print-visible`);
 assert.ok(print.some(item=>item.selector.includes(`.${name}`)&&item.selector.endsWith('>:not(summary)')&&item.prop==='display'&&item.value==='revert!important'),`actual details.${name} has a closed-content print fallback`);
}
// Evaluate the press-transform cascade, including :is/:not specificity. Merely
// finding a later reduced-motion reset missed the stronger enabled press rule.
const splitSelectors=value=>{
 const parts=[];let depth=0,start=0;
 for(let i=0;i<value.length;i++){if('(['.includes(value[i]))depth++;if(')]'.includes(value[i]))depth--;if(value[i]===','&&!depth){parts.push(value.slice(start,i));start=i+1;}}
 return [...parts,value.slice(start)];
};
const add=(a,b)=>a.map((n,i)=>n+b[i]);
const compare=(a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2];
const specificity=selector=>{
 let score=[0,0,0];
 for(let i=0;i<selector.length;){
  const tail=selector.slice(i),functional=tail.match(/^:(is|not|has|where)\(/);
  if(functional){let end=i+functional[0].length,depth=1;for(;depth;end++){if(selector[end]==='(')depth++;if(selector[end]===')')depth--;}
   const args=selector.slice(i+functional[0].length,end-1);
   if(functional[1]!=='where')score=add(score,splitSelectors(args).map(specificity).sort(compare).at(-1));
   i=end;continue;
  }
  const attribute=tail.match(/^\[[^\]]+\]/),token=tail.match(/^(#[\w-]+|\.[\w-]+|::?[\w-]+|[a-z][\w-]*)/i);
  if(attribute){score[1]++;i+=attribute[0].length;continue;}
  if(token){const t=token[0];score[t[0]==='#'?0:t[0]==='.'||t[0]===':'&&!t.startsWith('::')?1:2]++;i+=t.length;continue;}
  i++;
 }
 return score;
};
for(const [file,scope] of scopes){
 const pressed=declarations(file).filter(item=>item.prop==='transform'&&item.selector.startsWith(`${scope} :is(button,a,summary)`)&&item.selector.endsWith(':active'));
 const effective=(motion,{disabled=false,ariaDisabled=false}={})=>{
  let winner=null,rank=[-1,-1,-1];
  for(const item of pressed){
   if(disabled&&item.selector.includes(':not(:disabled)')||ariaDisabled&&item.selector.includes(':not([aria-disabled="true"])'))continue;
   const media=item.contexts.filter(context=>context.startsWith('@media'));
   if(media.some(context=>!context.includes(`prefers-reduced-motion:${motion}`)))continue;
   const next=specificity(item.selector);if(compare(next,rank)>=0){winner=item;rank=next;}
  }
  return winner?.value||'none';
 };
 assert.equal(effective('no-preference'),'translateY(1px)',`${file}: enabled press remains available with normal motion`);
 assert.equal(effective('reduce'),'none',`${file}: reduced motion wins the effective enabled-press cascade`);
 assert.equal(effective('no-preference',{disabled:true}),'none',`${file}: disabled controls never press-move`);
 assert.equal(effective('no-preference',{ariaDisabled:true}),'none',`${file}: aria-disabled controls never press-move`);
}
console.log('Presentation design: PASS — four Wave 7 stylesheets, decision cues, targets/focus/layers, print surfaces/disclosures and technical preservation (static; browser/print preview pending).');

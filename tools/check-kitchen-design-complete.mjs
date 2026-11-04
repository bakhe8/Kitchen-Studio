import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {checkFile, scanCSS} from './check-kitchen-design-native.mjs';
import {designExportTokens, customerSheetStyle} from '../public/kitchen-customer-sheet-style.js';

const root = new URL('../', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');
const manifest = read('docs/design-system/migration.md');
export const operationsFiles = [...manifest.split('### Wave 8')[1].split('## Native')[0].matchAll(/^- `(public\/[^`]+\.css)`/gm)].map(match => match[1]);
assert.equal(operationsFiles.length, 19, 'complete operations manifest must remain explicit');
for (const file of operationsFiles) assert.match(read(file), /var\(--ks-/, `${file} consumes semantic foundation`);
const cssFiles = readdirSync(new URL('public/', root), {recursive:true}).filter(file => file.endsWith('.css')).map(file => `public/${file.replaceAll('\\','/')}`).sort();
assert.deepEqual(cssFiles.flatMap(file => checkFile(file, {root:fileURLToPath(root)}).diagnostics), [], 'all current CSS must satisfy native policy');
const jsFiles = readdirSync(new URL('public/', root), {recursive:true}).filter(file => file.endsWith('.js')).map(file => `public/${file.replaceAll('\\','/')}`).sort();
assert.deepEqual(jsFiles.flatMap(file => checkFile(file, {root:fileURLToPath(root)}).diagnostics), [], 'all current JavaScript styling sinks and static embedded CSS must satisfy native policy');
assert.equal(designExportTokens, read('public/kitchen-design-system.css').match(/^:root\{[\s\S]*?\n\}/)[0], 'standalone report token snapshot must exactly match the central foundation root');
assert.ok(customerSheetStyle.startsWith(designExportTokens), 'customer preview/download/print embeds its tokens without a network stylesheet dependency');
const inventory = JSON.parse(read('docs/design-system/inventory.json'));
assert.equal(inventory.coverage.unclassifiedFiles, 0, 'all inventoried sources have an owning family');
const families = new Set(['field','design','factory','presentation','operations']);
for (const kind of ['files','routes','screens','components']) assert.ok(inventory[kind].every(item => families.has(item.family)), `every inventoried ${kind} entry has a valid family`);
assert.deepEqual(inventory.files.filter(file => file.type === 'js').map(file => file.path).sort(), jsFiles, 'inventory covers every current JavaScript source');
assert.deepEqual(inventory.files.filter(file => file.type === 'css').map(file => file.path).sort(), cssFiles, 'inventory covers all stylesheets (hash freshness is a separate generated-inventory gate)');
for (const file of ['foundations','components','patterns','qa-matrix','qa-final']) assert.ok(read(`docs/design-system/${file}.md`).trim().length > 200, `required ${file} documentation`);
for (const file of ['qa-field','qa-spatial','qa-catalog','qa-factory','qa-presentation','qa-final']) {
  const qa = read(`docs/design-system/${file}.md`);
  assert.match(qa, /pending|incomplete|Browser acceptance:\s*PASS/i, `${file}: acceptance boundary must be explicit`);
  assert.match(qa, /PASS|passed/, `${file}: focused source verification must be recorded`);
}
const declarations = file => scanCSS(read(file)).declarations;
// Bounded cascade model for the authored operational press rules. Functional
// pseudo-classes contribute their argument specificity; :where contributes 0.
const compareSpecificity = (a,b) => a[0]-b[0] || a[1]-b[1] || a[2]-b[2];
function specificity(selector) {
  const score=[0,0,0]; let remaining='';
  for(let i=0;i<selector.length;i++) {
    const fn=selector.slice(i).match(/^:(where|is|not|has)\(/);
    if(!fn){remaining+=selector[i];continue;}
    let depth=1,end=i+fn[0].length,start=end,parts=[];
    for(;end<selector.length&&depth;end++) {
      if(selector[end]==='(')depth++; else if(selector[end]===')')depth--;
      if((selector[end]===','&&depth===1)||depth===0){parts.push(selector.slice(start,end));start=end+1;}
    }
    if(fn[1]!=='where'){
      const maximum=parts.map(specificity).sort(compareSpecificity).at(-1)??[0,0,0];
      maximum.forEach((value,index)=>score[index]+=value);
    }
    remaining+=' ';i=end-1;
  }
  remaining=remaining.replace(/\[[^\]]*\]/g,()=>{score[1]++;return ' ';});
  remaining=remaining.replace(/#[\w-]+/g,()=>{score[0]++;return ' ';});
  remaining=remaining.replace(/::[\w-]+/g,()=>{score[2]++;return ' ';});
  remaining=remaining.replace(/\.[\w-]+|:(?!:)[\w-]+/g,()=>{score[1]++;return ' ';});
  score[2]+=(remaining.match(/(?:^|[\s>+~])(?:[a-z][\w-]*)(?=$|[\s>+~])/gi)??[]).length;
  return score;
}
function pressTransform(items,scope,motion) {
  const candidates=items.filter(item=>item.prop==='transform'&&item.selector.startsWith(`${scope} :is(button,a,summary)`)&&item.selector.includes(':active')&&!item.contexts.some(context=>/prefers-reduced-motion/.test(context)&&!context.replace(/\s+/g,'').includes(`:${motion}`)));
  candidates.sort((a,b)=>Number(/!important$/.test(a.value))-Number(/!important$/.test(b.value))||compareSpecificity(specificity(a.selector),specificity(b.selector))||a.offset-b.offset);
  return candidates.at(-1)?.value.replace(/\s*!important$/,'')??'none';
}
const pressFixture=scanCSS('.fixture :is(button,a,summary):not(:disabled):not([aria-disabled="true"]):active{transform:translateY(1px)}@media(prefers-reduced-motion:reduce){.fixture :is(button,a,summary):active{transform:none}}').declarations;
assert.deepEqual(specificity(pressFixture[0].selector),[0,4,1],'press specificity includes both :not arguments');
assert.deepEqual(specificity(pressFixture[1].selector),[0,2,1],'weaker reset specificity differs despite later source order');
assert.equal(pressTransform(pressFixture,'.fixture','reduce'),'translateY(1px)','cascade regression fixture proves a weaker reset does not beat the active rule');
for(const [file,scope] of [['kitchen-assist','.ka-shell.ka-shell'],['kitchen-design-versions','.dv-card.dv-card'],['kitchen-gateways',':is(.gw-home,.ws-route-picker)'],['kitchen-maintenance-studio','.maintenance-studio.maintenance-studio'],['kitchen-oversight-studio','.oversight-studio.oversight-studio'],['kitchen-panels','.pro-drawer.pro-drawer'],['kitchen-photo','.kph.kph'],['kitchen-saved-projects','.saved-projects.saved-projects'],['kitchen-scoped-workspace','.ks-scope.ks-scope'],['kitchen-shell','.k-app.k-app'],['kitchen-workshop-nav','.k-workshop.k-workshop'],['kitchen','.kit.kit']]) {
  const items=declarations(`public/${file}.css`);
  assert.ok(items.filter(item=>item.prop==='transform'&&item.selector.includes(':active')).every(item=>item.selector.startsWith(`${scope} :is(button,a,summary)`)),`${file}: no active transform may escape the bounded cascade model`);
  assert.equal(pressTransform(items,scope,'reduce'),'none',`${file}: effective reduced-motion press transform must be none`);
  assert.equal(pressTransform(items,scope,'no-preference'),'translateY(1px)',`${file}: ordinary press retains its 1px response`);
}
const rule = (file, selector, property, value) => assert.ok(declarations(file).some(item => item.selector === selector && item.prop === property && item.value === value), `${file}: ${selector} ${property}: ${value}`);
// Cross-file focus regression: match the participating selectors to explicit
// workshop DOM paths, then use actual index.html sheet order and specificity.
function selectorParts(text, delimiter=',') {
  const parts=[];let start=0,depth=0;
  for(let index=0;index<text.length;index++){
    if('(['.includes(text[index]))depth++;
    if(')]'.includes(text[index]))depth--;
    if(text[index]===delimiter&&!depth){parts.push(text.slice(start,index).trim());start=index+1;}
  }
  parts.push(text.slice(start).trim());return parts;
}
function focusCompound(selector,node) {
  let rest='';
  for(let index=0;index<selector.length;index++){
    const fn=selector.slice(index).match(/^:(is|not|where)\(/);
    if(!fn){rest+=selector[index];continue;}
    let end=index+fn[0].length,depth=1,start=end;
    for(;end<selector.length&&depth;end++){if(selector[end]==='(')depth++;if(selector[end]===')')depth--;}
    const matches=selectorParts(selector.slice(start,end-1)).some(part=>focusCompound(part,node));
    if((fn[1]==='not'&&matches)||(fn[1]!=='not'&&!matches))return false;
    index=end-1;
  }
  if(rest.includes(':focus-visible')&&!node.focused)return false;
  rest=rest.replace(/:focus-visible|:focus-within/g,'');
  let matches=true;
  rest=rest.replace(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g,(_,name,value)=>{if(!(name in node.attrs)||(value!==undefined&&node.attrs[name]!==value))matches=false;return '';});
  rest=rest.replace(/\.([\w-]+)/g,(_,name)=>{if(!node.classes.includes(name))matches=false;return '';});
  if(rest&&rest!=='*'&&rest!==node.tag)matches=false;
  return matches;
}
function focusSelector(selector,path) {
  const steps=[];let buffer='',depth=0,combinator=' ';
  const flush=()=>{if(buffer.trim()){steps.push({selector:buffer.trim(),combinator});buffer='';combinator=' ';}};
  for(const character of selector){
    if('(['.includes(character))depth++;
    if(')]'.includes(character))depth--;
    if(!depth&&character==='>'){flush();combinator='>';}
    else if(!depth&&/\s/.test(character)){flush();}
    else buffer+=character;
  }
  flush();
  const match=(step,index)=>{
    if(index<0||!focusCompound(steps[step].selector,path[index]))return false;
    if(!step)return true;
    if(steps[step].combinator==='>')return match(step-1,index-1);
    for(let ancestor=index-1;ancestor>=0;ancestor--)if(match(step-1,ancestor))return true;
    return false;
  };
  return steps.length>0&&match(steps.length-1,path.length-1);
}
const entrySheets=[...read('public/index.html').matchAll(/<link\b[^>]*href="\.\/([^"?]+\.css)"/g)].map(match=>`public/${match[1]}`);
const focusFiles=['public/kitchen-workshop.css','public/kitchen-workshop-nav.css','public/kitchen-stage-visit.css','public/kitchen-survey-notebook.css'];
const focusRules=focusFiles.flatMap(file=>declarations(file).filter(item=>/^outline(?:-color)?$/.test(item.prop)&&item.selector.includes(':focus')).flatMap(item=>selectorParts(item.selector).map(selector=>({...item,selector,file,order:entrySheets.indexOf(file)*1000000+item.offset}))));
assert.ok(focusFiles.every(file=>entrySheets.includes(file)),'cross-file focus model uses real entry stylesheet order');
const node=(tag,classes='',attrs={})=>({tag,classes:classes.split(' ').filter(Boolean),attrs,focused:false});
const rootNode=node('section','k-workshop');
function effectiveFocus(path,width=1024){
  path=path.map((item,index)=>({...item,focused:index===path.length-1}));
  const candidates=focusRules.filter(item=>focusSelector(item.selector,path)&&!item.contexts.some(context=>{
    const minimum=context.match(/min-width\s*:\s*(\d+)px/),maximum=context.match(/max-width\s*:\s*(\d+)px/);
    return minimum&&width<Number(minimum[1])||maximum&&width>Number(maximum[1]);
  }));
  candidates.sort((a,b)=>Number(/!important$/.test(a.value))-Number(/!important$/.test(b.value))||compareSpecificity(specificity(a.selector),specificity(b.selector))||a.order-b.order);
  return candidates.at(-1);
}
const sharedFocus=focusRules.find(item=>item.selector==='.k-workshop.k-workshop :is(button,a,input,select,textarea,summary,[tabindex]):focus-visible');
assert.ok(sharedFocus,'include the exact shared workshop focus candidate');
assert.deepEqual(specificity(sharedFocus.selector),[0,4,0],'shared focus includes the maximum [tabindex] branch specificity');
const focusCases=[
  ['desktop route header',[rootNode,node('header','ws-route-head'),node('button','ws-route-chooser')],'--ks-focus-ring-dark',1024],
  ['compact light route header',[rootNode,node('header','ws-route-head'),node('button','ws-route-chooser')],'--ks-focus-ring',640],
  ['dark ws-head',[rootNode,node('header','ws-head'),node('button')],'--ks-focus-ring-dark',1024],
  ['dark survey workbar',[rootNode,node('section','sv'),node('div','sv-workbar'),node('button','sv-ink-tool')],'--ks-focus-ring-dark',1024],
  ['light survey overflow menu',[rootNode,node('section','sv'),node('div','sv-workbar'),node('details','sv-ink-more'),node('div'),node('button','sv-ink-tool')],'--ks-focus-ring',1024],
  ['light notebook workbar',[rootNode,node('section','sv sv-notebook'),node('div','sv-workbar'),node('button','sv-ink-tool')],'--ks-focus-ring',1024],
  ['light route picker',[rootNode,node('nav','ws-route-picker'),node('button')],'--ks-focus-ring',1024],
  ['light header input',[rootNode,node('header','ws-head'),node('input')],'--ks-focus-ring',1024],
  ['ordinary shared content',[rootNode,node('main','ws-content'),node('button')],'--ks-focus-ring',1024]
];
const focusFindings=[];
for(const [label,path,token,width] of focusCases){
  const winner=effectiveFocus(path,width);
  assert.ok(winner,`${label}: a focus candidate must match`);
  if(!winner.value.includes(`var(${token})`))focusFindings.push(`${label}: expected ${token}; actual ${winner.file} ${winner.selector}: ${winner.value}`);
}
assert.deepEqual(focusFindings,[],'cross-file effective workshop focus must follow actual dark/light surface ownership');
const focusToken=name=>read('public/kitchen-design-system.css').match(new RegExp(`${name}:([^;]+)`))[1].trim();
const luminance=hex=>[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
const focusContrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
assert.ok(focusContrast(focusToken('--ks-focus-ring-dark'),focusToken('--ks-ink-strong'))>=3,'effective dark-surface focus color must meet 3:1 against the structural header/workbar');
for (const [file, scope] of [['kitchen-assist','.ka-shell.ka-shell'],['kitchen-design-versions','.dv-card.dv-card'],['kitchen-maintenance-studio','.maintenance-studio.maintenance-studio'],['kitchen-oversight-studio','.oversight-studio.oversight-studio'],['kitchen-photo','.kph.kph'],['kitchen-saved-projects','.saved-projects.saved-projects'],['kitchen-scoped-workspace','.ks-scope.ks-scope']]) {
  rule(`public/${file}.css`, `${scope} :is(button,input:not([type=checkbox]):not([type=radio]),select,textarea,summary)`, 'min-block-size', 'var(--ks-target)');
  rule(`public/${file}.css`, `${scope} :is(button,a,summary)`, 'min-inline-size', 'var(--ks-target)');
  rule(`public/${file}.css`, `${scope} :is(button,a,input,select,textarea,summary,[tabindex]):focus-visible`, 'outline', '3px solid var(--ks-focus-ring)');
  assert.match(read(`public/${file}.css`), /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'local reduced-motion translation reset');
}
rule('public/kitchen-saved-projects.css', '.pr-backup[data-state=current]', 'border-inline-start', '4px double var(--ks-complete)');
rule('public/kitchen-saved-projects.css', '.saved-projects button[data-saved-delete-confirm]', 'border-style', 'double');
rule('public/kitchen-assist.css', '.ka-shell [data-ka-message][data-kind=error]', 'border-inline-start', '4px double var(--ks-danger)');
rule('public/kitchen-maintenance-studio.css', '.maintenance-studio .ms-ticket[data-status="closed"]', 'border-inline-start', '4px double var(--ks-complete)');
rule('public/kitchen-maintenance-studio.css', '.maintenance-studio .ms-ticket[data-state="closed"]', 'border-inline-start', '4px double var(--ks-complete)');
rule('public/kitchen-oversight-studio.css', '.oversight-studio .os-stage[data-state="ready"]', 'border-top-style', 'double');
rule('public/kitchen-photo.css', '.kph', 'z-index', 'var(--ks-z-photo)');
rule('public/kitchen-shell.css', '.k-docbar details>div', 'z-index', 'var(--ks-z-popover)');
rule('public/kitchen-shell.css', '.k-app.k-app .k-titlebar .k-studio-home:focus-visible', 'outline', '3px solid var(--ks-focus-ring-dark)');
assert.match(read('public/kitchen-design-system.css'), /@layer ks-primitives/, 'declare safe consolidated primitive layer');
assert.doesNotMatch(read('public/kitchen-design-system.css'), /\.(?:ws-|kit-|ka-|dl-|os-|ms-)/, 'foundation never owns feature selectors');
assert.match(read('public/kitchen-tablet.css'), /html:not\(\[data-workspace-open\]\)/, 'retain unsupported-small-device route');
// Existing local semantic aliases remain explicit in documentation; no blanket alias exemption.
const aliases = new Set(cssFiles.flatMap(file => declarations(file).filter(item => item.prop.startsWith('--') && !item.prop.startsWith('--ks-') && /var\(--ks-/.test(item.value)).map(item => item.prop)));
const foundations = read('docs/design-system/foundations.md');
for (const alias of aliases) assert.ok(foundations.includes(`\`${alias}\``), `document compatibility alias ${alias}`);
if (process.argv.includes('--acceptance')) {
  assert.equal(inventory.coverage.systemNativeFiles, inventory.coverage.totalFiles, 'acceptance requires an explicit QA-backed native status mechanism; legacy inventory cannot claim acceptance');
  for (const kind of ['files','screens','components']) assert.ok(inventory[kind].every(item => item.status === 'system-native' || item.status === 'foundation'), `accepted ${kind} statuses must be explicit, not inferred from a coverage counter`);
  for (const family of ['field','spatial','catalog','factory','presentation','final']) assert.match(read(`docs/design-system/qa-${family}.md`), /Browser acceptance:\s*PASS/, `${family}: browser acceptance must be recorded explicitly`);
  assert.match(read('docs/design-system/qa-final.md'), /Final acceptance:\s*PASS/, 'cross-family browser and full-suite evidence must pass before final acceptance');
  assert.match(read('docs/design-system/qa-final.md'), /Full suite:\s*PASS/, 'final source-bound full suite must pass');
  assert.match(read('docs/design-system/qa-final.md'), /P0–P2 open findings:\s*0/, 'all P0–P2 findings must be resolved');
}
console.log(`PASS design source completion: ${cssFiles.length} CSS + ${jsFiles.length} JS files; 19 operations files; classified inventory; documented aliases/primitives/state contracts; standalone export token parity. Browser, full-suite and final acceptance remain PENDING; use --acceptance for the strict acceptance gate.`);

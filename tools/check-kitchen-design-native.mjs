import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const categories = new Set(['material-swatch', 'technical-visualization', 'user-color', 'print-data']);
const namedColors = new Set(('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen').split(' '));
const normalize = (value, expression = false) => expression || value.includes('${') ? value.trim() : value.trim().replace(/\s+/g, ' ');
const colorProperty = property => /^(?:--[\w-]+|color|background(?:-color|-image)?|fill|stroke|(?:border(?:-(?:top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?)(?:-color)?|outline-color|caret-color|accent-color|text-decoration-color|stop-color|flood-color|lighting-color)$/.test(property);
const controlledProperty = property => colorProperty(property) || /radius$|shadow$|^(?:transition|animation)(?:-|$)|^outline/.test(property);
// These exact existing sinks carry measured geometry, not semantic styling.
// Preserve the numeric expressions; any different expression/color remains audited.
const geometryExpressions = new Map([
  ['public/kitchen-row-strip.js:--krs-w', new Set(["'+width+'", "'+x.width+'"])],
  ['public/kitchen-workshop-photo-ui.js:--pha-ratio', new Set(["'+w/h+'"])],
  ['public/shelf-canvas.js:--shc-ratio', new Set(['${n(ratioW)} / ${n(ratioH)}'])]
]);

// Bounded, non-evaluating JS expression reader for stylesheet ownership. It
// handles literal/identifier concatenation; unsupported runtime syntax fails
// closed. Quoted spans and balanced calls keep internal '+' and ';' opaque.
function quotedJS(text, start) {
  const quote=text[start], positions=[]; let value='', index=start+1;
  for(;index<text.length;index++) {
    const character=text[index];
    if(character===quote)return {value,positions,start,end:index+1};
    if(character!=='\\'){value+=character;positions.push(index);continue;}
    const escapeStart=index, next=text[++index];
    if(next==='\n')continue;
    if(next==='\r'){if(text[index+1]==='\n')index++;continue;}
    const hexadecimal=text.slice(index).match(/^x([\da-f]{2})|^u([\da-f]{4})|^u\{([\da-f]{1,6})\}/i);
    if(hexadecimal){const character=String.fromCodePoint(parseInt(hexadecimal[1]??hexadecimal[2]??hexadecimal[3],16));value+=character;positions.push(...[...character].map(()=>escapeStart));index+=hexadecimal[0].length-1;}
    else {value+=({n:'\n',r:'\r',t:'\t',b:'\b',f:'\f',v:'\v','0':'\0'})[next]??next;positions.push(escapeStart);}
  }
  return null;
}
function jsExpression(text, start) {
  let depth=0,index=start;
  for(;index<text.length;index++) {
    if(/["'`]/.test(text[index])){const literal=quotedJS(text,index);if(!literal)return null;index=literal.end-1;continue;}
    if('([{'.includes(text[index]))depth++;
    else if(')]}'.includes(text[index])){if(!depth)break;depth--;}
    else if(!depth&&';,'.includes(text[index]))break;
  }
  return {text:text.slice(start,index),start,end:index};
}
function concatParts(expression) {
  const text=expression.text, parts=[];let start=0,depth=0;
  for(let index=0;index<text.length;index++) {
    if(/["'`]/.test(text[index])){const literal=quotedJS(text,index);if(!literal)return null;index=literal.end-1;continue;}
    if('([{'.includes(text[index]))depth++;
    else if(')]}'.includes(text[index]))depth--;
    else if(text[index]==='+'&&!depth){parts.push({text:text.slice(start,index),start:expression.start+start});start=index+1;}
  }
  parts.push({text:text.slice(start),start:expression.start+start});return parts;
}

function loadAllowlist() {
  return JSON.parse(readFileSync(path.join(root, 'docs/design-system/allowlist.json'), 'utf8')).entries;
}

function hasRawColor(value, property) {
  const cleaned = value.replace(/url\([^)]*\)|["'][^"']*["']/gi, '').replace(/--[\w-]+/g, '');
  const namedColorProperty = colorProperty(property) || /^(?:outline|text-decoration|text-emphasis|column-rule|box-shadow|text-shadow|filter|backdrop-filter|border-image(?:-source)?|list-style-image|mask(?:-image)?|(?:-webkit-)?text-(?:fill|stroke)(?:-color)?)$/.test(property);
  return /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/i.test(cleaned) || (namedColorProperty && [...cleaned.matchAll(/\b[a-z]+\b/gi)].some(match => namedColors.has(match[0].toLowerCase())));
}

const cssName = name => String(name).replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

export function maskJSComments(source) {
  const characters = source.split('');
  let quote = '';
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (quote) { if (character === '\\') index++; else if (character === quote) quote = ''; continue; }
    if ('"\'`'.includes(character)) { quote = character; continue; }
    if (character === '/' && source[index + 1] === '/') {
      for (; index < source.length && source[index] !== '\n'; index++) characters[index] = ' ';
    } else if (character === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      const limit = end < 0 ? source.length : end + 2;
      for (; index < limit; index++) if (source[index] !== '\n') characters[index] = ' ';
      index--;
    }
  }
  return characters.join('');
}

/** Small CSS structural scanner: comments/strings/functions are opaque, nested rule blocks retain context. */
export function scanCSS(source, { allowInterpolation = false } = {}) {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, ' '));
  const rules = [];
  const declarations = [];
  const stack = [];
  let quote = '', parentheses = 0, start = 0;
  const declaration = end => {
    const fragment = text.slice(start, end);
    if (!fragment.trim()) return;
    const match = fragment.match(/^\s*([\w-]+)\s*:\s*([\s\S]*?)\s*$/);
    if (!match || !match[2]) throw new Error(`Invalid declaration at offset ${start}`);
    declarations.push({ prop: match[1], value: match[2], offset: start + fragment.search(/\S/), selector: stack.at(-1)?.selector ?? ':root', contexts: stack.map(frame => frame.selector) });
  };
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quote) { if (character === '\\') index++; else if (character === quote) quote = ''; continue; }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (allowInterpolation && character === '$' && text[index + 1] === '{') {
      let depth = 1, interpolationQuote = '';
      index += 2;
      for (; index < text.length; index++) {
        const next = text[index];
        if (interpolationQuote) { if (next === '\\') index++; else if (next === interpolationQuote) interpolationQuote = ''; continue; }
        if ('"\'`'.includes(next)) interpolationQuote = next;
        else if (next === '{') depth++;
        else if (next === '}' && --depth === 0) break;
      }
      if (depth) throw new Error('Unclosed style interpolation');
      continue;
    }
    if (character === '(') { parentheses++; continue; }
    if (character === ')') { if (--parentheses < 0) throw new Error(`Unmatched parenthesis at offset ${index}`); continue; }
    if (parentheses) continue;
    if (character === '{') {
      const selector = text.slice(start, index).trim();
      if (!selector) throw new Error(`Missing selector at offset ${index}`);
      const rule = { selector, offset: start + text.slice(start, index).search(/\S/) };
      rules.push(rule); stack.push(rule); start = index + 1;
    } else if (character === ';') {
      if (!text.slice(start, index).trim().startsWith('@') && stack.length) declaration(index);
      start = index + 1;
    } else if (character === '}') {
      if (!stack.length) throw new Error(`Unmatched closing brace at offset ${index}`);
      declaration(index); stack.pop(); start = index + 1;
    }
  }
  if (quote || parentheses || stack.length || text.slice(start).trim()) throw new Error('Unclosed or trailing CSS structure');
  return { rules, declarations };
}

/** Static styling policy only. A passing result is necessary, not sufficient, for system-native QA. */
export function checkFile(filename, options = {}) {
  const absolute = path.resolve(options.root ?? root, filename);
  const foundation = path.join(options.root ?? root, 'public/kitchen-design-system.css');
  const tokens = options.tokens ?? (existsSync(foundation) ? [...readFileSync(foundation, 'utf8').matchAll(/(--ks-[\w-]+)\s*:/g)].map(match => match[1]) : undefined);
  return checkSource(readFileSync(absolute, 'utf8'), { ...options, tokens, path: path.relative(options.root ?? root, absolute).replaceAll('\\', '/') });
}

export function checkSource(source, options = {}) {
  const filename = (options.path ?? 'fixture.css').replaceAll('\\', '/');
  const entries = options.allowlist ?? loadAllowlist();
  const allowlist = Array.isArray(entries) ? entries : entries.entries ?? [];
  const diagnostics = [];
  const exceptions = [];
  const tokens = options.tokens ? new Set(options.tokens) : null;
  const report = (code, message, offset, declaration = {}) => {
    const prefix = source.slice(0, offset);
    diagnostics.push({ code, file: filename, line: prefix.split('\n').length, column: offset - prefix.lastIndexOf('\n'), ...declaration, message });
  };
  const excepted = (selector, property, value, offset) => {
    if (!colorProperty(property)) return false;
    const expression = /\.(?:m?js)$/.test(filename) && (selector === '[style-assignment]' || /(['"])\s*\+/.test(value));
    const match = allowlist.find(entry => entry.file === filename && entry.selector === selector && entry.property === property && normalize(entry.value ?? '', expression) === normalize(value, expression) && categories.has(entry.category) && typeof entry.reason === 'string' && entry.reason.trim().length >= 12 && (entry.sourcePrefix === undefined || (selector === '[inline-style]' && typeof entry.sourcePrefix === 'string' && entry.sourcePrefix.length >= 12 && source.slice(0, offset).endsWith(entry.sourcePrefix))));
    if (!match) return false;
    exceptions.push({ file: filename, selector, property, value, category: match.category, reason: match.reason, ...(match.sourcePrefix === undefined ? {} : {sourcePrefix:match.sourcePrefix}), offset });
    return true;
  };
  const checkCSS = (cssSource, offset = 0, forcedSelector = null, prefixLength = 0, positions = null) => {
    let css;
    try { css = scanCSS(cssSource, { allowInterpolation: /\.(?:m?js)$/.test(filename) }); }
    catch (error) { report('parse', `Cannot parse CSS: ${error.message}`, Math.max(0, offset - prefixLength)); return; }
    for (const declaration of css.declarations) {
      const property = declaration.prop.toLowerCase();
      const value = declaration.value;
      const selector = forcedSelector ?? declaration.selector;
      const position = positions?.[declaration.offset] ?? Math.max(0, offset + declaration.offset - prefixLength);
      const detail = { selector, property, value };
      if (tokens) for (const token of value.matchAll(/var\(\s*(--ks-[\w-]+)/g)) if (!tokens.has(token[1])) report('unknown-token', `The foundation does not define ${token[1]}.`, position, detail);
      // Only the central foundation may define raw system tokens.
      const exportedRootDeclaration = source.indexOf('export const designExportTokens = `');
      const exportedRootStart = exportedRootDeclaration + 'export const designExportTokens = `'.length;
      const exportedRootEnd = source.indexOf('`;', exportedRootStart);
      const exportTokenDefinition = filename === 'public/kitchen-customer-sheet-style.js' && exportedRootDeclaration >= 0 && selector === ':root' && position >= exportedRootStart && position < exportedRootEnd;
      if ((filename === 'public/kitchen-design-system.css' || exportTokenDefinition) && property.startsWith('--ks-')) continue;
      // Inline HTML authored with JS string concatenation retains quote-plus
      // markers in this source scanner. Treat the entire expression as dynamic;
      // never execute it or infer its resulting color from a sanitizer's name.
      const geometry = geometryExpressions.get(`${filename}:${property}`)?.has(value);
      const dynamic = !geometry && controlledProperty(property) && (/\$\{/.test(value) || (/\.(?:m?js)$/.test(filename) && /(['"])\s*\+[\s\S]*\+\s*\1/.test(value)));
      if ((hasRawColor(value, property) || dynamic) && !excepted(selector, property, value, position)) report(dynamic ? 'dynamic-style' : 'raw-color', dynamic ? 'Computed styling needs an exact documented color-data exception; static analysis cannot establish its semantics.' : 'Use a --ks-* semantic color token or a precise documented color-data exception.', position, detail);
      const stripped = value.replace(/\s*!important\s*$/i, '').trim();
      const plainReset = /^(?:0|none|inherit|initial|unset|revert|revert-layer)$/i.test(stripped);
      if (/^border-(?:(?:top|bottom)-(?:left|right)-|(?:start|end)-(?:start|end)-)?radius$/.test(property) && !plainReset && !/^var\(--ks-radius-[\w-]+\)$/.test(stripped)) report('radius', 'Use a --ks-radius-* morphology token; arbitrary radii are not system-native.', position, detail);
      if (/^(?:box-shadow|text-shadow)$/.test(property) && !plainReset && !/^var\(--ks-(?:shadow-[\w-]+|focus-shadow)\)$/.test(stripped)) report('shadow', 'Use a --ks-shadow-* or --ks-focus-shadow contract token.', position, detail);
      if (/^(?:transition|animation)(?:-duration|-delay|-timing-function)?$/.test(property) && !plainReset) {
        const duration = /(?:^|[^\w-])(?:\d*\.)?\d+m?s\b/.test(stripped);
        const easing = /\b(?:ease(?:-in(?:-out)?|-out)?|linear|steps|cubic-bezier)\b/.test(stripped.replace(/var\([^)]*\)/g, ''));
        const foreignTiming = [...stripped.matchAll(/var\(\s*(--[\w-]+)/g)].some(match => !/^--ks-(?:duration-[\w-]+|ease(?:-[\w-]+)?)$/.test(match[1]));
        const reducedFoundation = filename === 'public/kitchen-design-system.css' && declaration.contexts.some(context => /@media.*prefers-reduced-motion\s*:\s*reduce/.test(context)) && /^(?:0|\.01|0\.01)ms$/.test(stripped);
        if ((duration || easing || foreignTiming) && !reducedFoundation) report('motion', 'Use --ks-duration-* and --ks-ease* tokens for transition/animation timing.', position, detail);
      }
      const focusSelector = /:focus(?:-visible|-within)?\b/.test(selector);
      if (focusSelector && /^(?:outline|outline-width|outline-style|outline-color|outline-offset)$/.test(property)) {
        const width = stripped.match(/^(\d+(?:\.\d+)?)px\b/);
        const valid = property === 'outline' ? /^var\(--ks-focus-outline\)$/.test(stripped) || (width && Number(width[1]) >= 3 && /solid/.test(stripped) && /var\(--ks-focus-(?:ring(?:-dark)?|color)\)/.test(stripped)) : property === 'outline-width' ? Boolean(width && Number(width[1]) >= 3) || /^var\(--ks-focus-width\)$/.test(stripped) : property === 'outline-offset' ? /^(?:2px|var\(--ks-focus-offset\))$/.test(stripped) : property === 'outline-style' ? stripped === 'solid' : /^var\(--ks-focus-(?:ring(?:-dark)?|color)\)$/.test(stripped);
        if (!valid) report('focus', 'Preserve the foundation focus contract: at least 3px solid --ks-focus-* with its 2px offset.', position, detail);
      }
      const zeroWidth = /^(?:0+(?:\.0+)?|\.0+)(?:[a-z]+|%)?$/i.test(stripped);
      if (!focusSelector && ((property === 'outline' && /^(?:none|0)(?:\s|$)/i.test(stripped)) || (property === 'outline-width' && zeroWidth) || (property === 'outline-style' && stripped.toLowerCase() === 'none'))) report('focus', 'Do not suppress inherited keyboard focus with zero outline width or outline-style:none.', position, detail);
    }
  };
  const auditStylesheetExpression = (text, expression) => {
    const importedOwner = name => /^(?:customerSheetStyle|designExportTokens)$/.test(name) && new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]\\./kitchen-customer-sheet-style\\.js['"]`).test(text);
    const literalParts = (expression, visiting=new Set()) => {
      const pieces=concatParts(expression);if(!pieces)return null;const result=[];
      for(const part of pieces){
        const leading=part.text.search(/\S/);if(leading<0)return null;
        const value=part.text.trim(),start=part.start+leading;
        if(/["'`]/.test(value[0])){
          const literal=quotedJS(text,start);
          if(!literal||literal.end!==start+value.length||/\$\{/.test(literal.value))return null;
          result.push(literal);continue;
        }
        if(!/^[\w$]+$/.test(value))return null;
        const resolved=resolveOwner(value,visiting);if(!resolved)return null;result.push(...resolved);
      }
      return result;
    };
    const resolveOwner = (name,visiting) => {
      if(visiting.has(name))return null;
      if(importedOwner(name))return [];
      const declarations=[...text.matchAll(new RegExp(`(?<![\\w$.])(?:const|let|var)\\s+${name}\\s*=\\s*`,'g'))];
      if(declarations.length!==1)return null;
      const declaration=declarations[0],start=declaration.index+declaration[0].length;
      const initial=jsExpression(text,start);if(!initial)return null;
      const nextVisiting=new Set([...visiting,name]);
      let result;
      // Existing index-generated gallery has a deliberately bounded interpolation
      // contract. Its entire literal is still audited; unknown suffixes fail.
      const gallery=filename==='public/kitchen-proposal-presentation.js'&&name==='galleryCSS'&&initial.text.match(/^views\.map\(\(_,i\)=>/);
      if(gallery){
        const literal=quotedJS(text,start+gallery[0].length);
        if(!literal||!/^\)\.join\((['"])\1\)$/.test(text.slice(literal.end,initial.end).trim())||[...literal.value.matchAll(/\$\{([^}]+)\}/g)].some(match=>match[1]!=='i'))return null;
        result=[literal];
      }else result=literalParts(initial,nextVisiting);
      if(!result)return null;
      // Never choose a "final" value by source order: the sink may precede a
      // later assignment, or a conditional assignment may not run. Reassignment
      // makes reaching definitions ambiguous, so fail closed. Static += remains
      // accumulative and every appended candidate is audited.
      for(const assignment of text.matchAll(new RegExp(`(?<![\\w$.])${name}\\s*(\\+=|=(?!=))\\s*`,'g'))){
        if(assignment.index>=declaration.index&&assignment.index<start)continue;
        if(assignment[1]!=='+=')return null;
        const rhs=jsExpression(text,assignment.index+assignment[0].length);if(!rhs)return null;
        const added=literalParts(rhs,nextVisiting);if(!added)return null;
        result=[...result,...added];
      }
      return result;
    };
    const parts=literalParts(expression);if(!parts)return false;
    const css=parts.map(part=>part.value).join(''),positions=parts.flatMap(part=>part.positions);
    checkCSS(css,expression.start,null,0,positions);return true;
  };
  const inlineStyles = (text, offset) => {
    for (const match of text.matchAll(/<[a-z][^<>]*?(?<![\w-])style\s*=\s*(["'])(.*?)\1/gs)) {
      const start = match.index + match[0].indexOf(match[2]);
      checkCSS(`x{${match[2]}}`, offset + start, '[inline-style]', 2);
    }
    for (const match of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
      const body = match[1], position = offset + match.index + match[0].indexOf(body);
      if (/^['"]\s*\+/.test(body)) {
        // Static CSS literals are scanned below at their declaration. Only known
        // stylesheet identifiers/imports may assemble a block without an exception.
        const opening=body.match(/^['"]\s*\+\s*/)[0];
        const expression = body.slice(opening.length).replace(/\s*\+\s*['"]$/, '');
        const known = auditStylesheetExpression(text,{text:expression,start:position+opening.length});
        if (!known && !excepted('[style-block]', '--embedded-css', body, position)) report('dynamic-style', 'Generated stylesheet assembly needs an exact technical-data exception or auditable stylesheet declarations.', position, {selector:'[style-block]',property:'--embedded-css',value:body});
      } else checkCSS(body, position);
    }
  };
  if (filename.endsWith('.js') || filename.endsWith('.mjs')) {
    const code = maskJSComments(source);
    inlineStyles(code, 0);
    // Audit self-contained CSS string/template literals, including standalone
    // report styles. A declaration beginning with CSS and ending in a rule is
    // never exempt merely because HTML assembles it through an identifier.
    const scannedLiterals = new Set();
    const cssLiteral = (css, position) => {
      if (!scannedLiterals.has(position) && /^\s*(?:[.#][\w-]+[^{}]*\{|:root\s*\{|\*\s*\{|@(?:media|page|layer)\b)/.test(css) && /}\s*$/.test(css) && /[;{]\s*[\w-]+\s*:/.test(css)) {
        scannedLiterals.add(position); checkCSS(css, position);
      }
    };
    for (const match of code.matchAll(/(?:const|let)\s+[\w$]+\s*=\s*(?:[\w$]+\s*\+\s*)?(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)) cssLiteral(match[2], match.index + match[0].indexOf(match[1]) + 1);
    for (const match of code.matchAll(/`((?:\\.|[^`])*)`/g)) cssLiteral(match[1], match.index + 1);
    for (const match of code.matchAll(/\.style(?:\.([\w]+)|\[['"]([^'"]+)['"]\])\s*=\s*(['"`])((?:\\.|(?!\3)[\s\S])*?)\3/g)) {
      const property = cssName(match[1] ?? match[2]);
      const value = match[4];
      if (!value.trim()) continue; // Clearing inline styling restores the owning stylesheet.
      const offset = match.index + match[0].indexOf(match[3]) + 1;
      if (property === 'css-text') checkCSS(`x{${value}}`, offset, '[style-assignment]', 2);
      else checkCSS(`x{${property}:${value}}`, offset, '[style-assignment]', property.length + 3);
    }
    for (const match of code.matchAll(/\.style\.setProperty\(\s*(['"])([\w-]+)\1\s*,\s*(['"`])((?:\\.|(?!\3)[\s\S])*?)\3\s*\)/g)) {
      const property = match[2], value = match[4];
      checkCSS(`x{${property}:${value}}`, match.index + match[0].lastIndexOf(value), '[style-assignment]', property.length + 3);
    }
    for (const match of code.matchAll(/\.style(?:\.([\w]+)|\[['"]([^'"]+)['"]\])\s*=\s*([^\s'"`;][^;\n]*)/g)) {
      const property = cssName(match[1] ?? match[2]), value = match[3].trim();
      const conditional = value.match(/^[^?;{}]+\?\s*(['"])(var\(--ks-[\w-]+\))\1\s*:\s*(['"])(var\(--ks-[\w-]+\))\3\s*$/);
      if (conditional) {
        for (const branch of [conditional[2], conditional[4]]) checkCSS(`x{${property}:${branch}}`, match.index, '[style-assignment]', 2);
      } else if (controlledProperty(property) && !excepted('[style-assignment]', property, value, match.index)) report('dynamic-style', 'Computed style assignment needs an exact documented color-data exception.', match.index, { selector: '[style-assignment]', property, value });
    }
    for (const match of code.matchAll(/\.setAttribute\(\s*(['"])style\1\s*,\s*(['"`])((?:\\.|(?!\2)[\s\S])*?)\2\s*\)/g)) checkCSS(`x{${match[3]}}`, match.index + match[0].indexOf(match[3]), '[inline-style]', 2);
  } else if (filename.endsWith('.html')) inlineStyles(source, 0);
  else checkCSS(source);
  return { path: filename, passed: diagnostics.length === 0, diagnostics, exceptions };
}

export function runPolicyTests() {
  for (const example of [
    'let styles=".a{color:var(--ks-ink)}";styles+=".b{color:#f00}";host.innerHTML="<style>"+styles+"</style>";styles=".a{color:var(--ks-ink)}";',
    'let styles=".a{color:var(--ks-ink)}";styles+=".b{color:#f00}";if(condition)styles=".a{color:var(--ks-ink)}";host.innerHTML="<style>"+styles+"</style>";'
  ]) {
    const result=checkSource(example,{path:'public/fixture.js',allowlist:[]});
    assert.equal(result.passed,false,'later or conditional reassignment cannot erase an earlier raw stylesheet candidate');
    assert.ok(result.diagnostics.some(item=>item.code==='dynamic-style'),'ambiguous reassignment fails stylesheet ownership closed');
  }
  for (const [index,example] of [
    'const styles = ".a{color:var(--ks-ink)}" + ".b{color:#f00}"; host.innerHTML = "<style>" + styles + "</style>";',
    'const styles = ".a{color:var(--ks-ink)}" + runtimeCSS; host.innerHTML = "<style>" + styles + "</style>";',
    'let styles = ".a{color:var(--ks-ink)}"; styles += ".b{color:#f00}"; host.innerHTML = "<style>" + styles + "</style>";'
  ].entries()) {
    const result=checkSource(example,{path:'public/fixture.js',allowlist:[]});
    assert.equal(result.passed,false,'every appended stylesheet expression must be audited or rejected');
    assert.ok(result.diagnostics.some(item=>item.code===(index===1?'dynamic-style':'raw-color')),'literal appends are audited as CSS; unknown runtime appends fail ownership');
  }
  assert.equal(checkSource('const styles=".a{color:"+"var(--ks-ink)"+"}";host.innerHTML="<style>"+styles+"</style>";',{path:'public/fixture.js',allowlist:[]}).passed,true,'static fragments are checked as one complete stylesheet');
  assert.equal(checkSource('let styles=".a{color:var(--ks-ink)}";styles+=".b{color:var(--ks-action)}";host.innerHTML="<style>"+styles+"</style>";',{path:'public/fixture.js',allowlist:[]}).passed,true,'known semantic literal appends stay auditable');
  assert.equal(checkSource('let styles=".a{color:var(--ks-ink)}";styles+=runtimeCSS;host.innerHTML="<style>"+styles+"</style>";',{path:'public/fixture.js',allowlist:[]}).passed,false,'unknown += stylesheet append cannot inherit safe ownership');
  assert.equal(checkSource('const styles=".a{color:var(--ks-ink)}"+".b{color:\\x23f00}";host.innerHTML="<style>"+styles+"</style>";',{path:'public/fixture.js',allowlist:[]}).passed,false,'JS escaped raw colors in appended literals are decoded and audited');
  assert.equal(checkSource(`const choice='<select data-c-style="front">'; function grip(style='bar'){}; dom.style.visibility='';`, {path:'public/fixture.js',allowlist:[]}).passed, true, 'attribute names containing style, parameter defaults and empty nonsemantic style resets are not CSS sinks');
  assert.equal(checkSource(`host.innerHTML='<button style="color:#b33a32">Delete</button>';`, {path:'public/fixture.js',allowlist:[]}).passed, false, 'actual HTML style attributes still reject raw state colors');
  assert.equal(checkSource('const styles=`.sheet button{color:#b33a32}`; host.innerHTML="<style>"+styles+"</style>";', {path:'public/fixture.js',allowlist:[]}).passed, false, 'embedded static stylesheet constants must be audited at their owning literal');
  assert.equal(checkSource('const styles=`.sheet button{color:var(--ks-action)}`; host.innerHTML="<style>"+styles+"</style>";', {path:'public/fixture.js',allowlist:[]}).passed, true, 'known literal stylesheet assembly is not a CSS parse error');
  assert.equal(checkSource('const styles=untrustedCSS; host.innerHTML="<style>"+styles+"</style>";', {path:'public/fixture.js',allowlist:[]}).passed, false, 'an identifier alone is not auditable stylesheet ownership');
  assert.equal(checkSource(`el.style.color=delta!=null&&Math.abs(delta)>.5?'var(--ks-danger)':'var(--ks-ink-muted)';`, {path:'public/fixture.js',allowlist:[]}).passed, true, 'a conditional with exclusively static semantic-token branches can be audited without executing its condition');
  assert.equal(checkSource(`el.style.color=valid?'var(--ks-danger)':'#fff';`, {path:'public/fixture.js',allowlist:[]}).passed, false, 'conditional styling cannot hide a raw branch');
  assert.equal(checkSource('host.innerHTML=\'<span style="--krs-w:\'+width+\'"></span>\';', {path:'public/kitchen-row-strip.js',allowlist:[]}).passed, true, 'exact measured-row geometry expression remains geometry');
  assert.equal(checkSource('host.innerHTML=\'<span style="--krs-w:\'+color+\'"></span>\';', {path:'public/kitchen-row-strip.js',allowlist:[]}).passed, false, 'an altered geometry expression is not a blanket styling waiver');
  assert.equal(checkSource('host.innerHTML=\'<span style="--krs-w:#f00"></span>\';', {path:'public/kitchen-row-strip.js',allowlist:[]}).passed, false, 'raw color in a known geometry property still fails');
  assert.equal(checkSource('host.innerHTML=\'<i class="chip" \'+(color?\'style="--swatch:\'+color+\'"\':\'\')+\'></i>\';', {path:'public/fixture.js',allowlist:[]}).passed, false, 'conditionally inserted HTML style attributes remain audited');
  for (const declaration of ['outline:3px solid var(--ks-focus-ring-dark)', 'outline-color:var(--ks-focus-ring-dark)']) {
    assert.equal(checkSource(`.dark-toolbar button:focus-visible{${declaration};outline-offset:2px}`, {allowlist: []}).passed, true, `${declaration} accepts the dark-surface focus contract`);
  }
  for (const declaration of ['outline:2px solid var(--ks-focus-ring-dark)', 'outline:3px solid var(--ks-focus-ring-dark-extra)', 'outline-color:var(--ks-focus-ring-dark-extra)']) {
    assert.equal(checkSource(`.dark-toolbar button:focus-visible{${declaration}}`, {allowlist: []}).passed, false, `${declaration} cannot weaken or invent the focus contract`);
  }
  for (const [semantic, color] of [['action', '#0f766e'], ['complete', '#287a50'], ['attention', '#a46518'], ['danger', '#b33a32']]) {
    const result = checkSource(`.control { color: ${color}; }`, { path: 'public/fixture.css', allowlist: [] });
    assert.equal(result.passed, false, `raw ${semantic} color must be rejected`);
    assert.equal(result.diagnostics[0].code, 'raw-color');
    assert.equal(result.diagnostics[0].line, 1);
    assert.ok(result.diagnostics[0].column > 0);
  }
  for (const [declaration, code] of [['border-radius:13px', 'radius'], ['box-shadow:0 4px 8px #0003', 'shadow'], ['transition:opacity 123ms ease', 'motion'], ['outline:none', 'focus']]) {
    const result = checkSource(`.control:focus-visible { ${declaration}; }`, { path: 'public/fixture.css', allowlist: [] });
    assert.ok(result.diagnostics.some(diagnostic => diagnostic.code === code), `${declaration} must report ${code}`);
  }
  assert.equal(checkSource('.control{color:var(--ks-action);border-radius:var(--ks-radius-control);box-shadow:var(--ks-shadow-surface);transition:color var(--ks-duration-fast) var(--ks-ease)} .control:focus-visible{outline:3px solid var(--ks-focus-ring);outline-offset:2px}', { allowlist: [] }).passed, true);
  assert.equal(checkSource('.control{color:var(--ks-action,#f00)}', { allowlist: [] }).passed, false, 'raw var fallback must not escape policy');
  assert.equal(checkSource('.control{color:rgb(15 118 110);background:rebeccapurple}', { allowlist: [] }).diagnostics.filter(diagnostic => diagnostic.code === 'raw-color').length, 2);
  const exception = { file: 'public/fixture.css', selector: '.material-swatch', property: 'background', value: '#bd8b54', category: 'material-swatch', reason: 'Catalog oak color sample, not an interaction state.' };
  const allowed = checkSource('.material-swatch{background:#bd8b54}', { path: 'public/fixture.css', allowlist: [exception] });
  assert.equal(allowed.passed, true, 'documented material swatch must pass');
  assert.equal(allowed.exceptions.length, 1);
  for (const category of ['technical-visualization', 'user-color', 'print-data']) assert.equal(checkSource('.material-swatch{background:#bd8b54}', { path: 'public/fixture.css', allowlist: [{ ...exception, category }] }).passed, true);
  for (const replacement of [{ reason: '' }, { category: 'decoration' }, { file: 'public/other.css' }, { selector: '.action' }, { value: '#f00' }]) assert.equal(checkSource('.material-swatch{background:#bd8b54}', { path: 'public/fixture.css', allowlist: [{ ...exception, ...replacement }] }).passed, false, 'exceptions must remain precise and documented');
  assert.equal(checkSource('.material-swatch{border-radius:13px}', { path: 'public/fixture.css', allowlist: [{ ...exception, property: 'border-radius', value: '13px' }] }).passed, false, 'color exceptions cannot waive geometry');
  assert.equal(checkSource('.x{color:', { allowlist: [] }).passed, false, 'malformed CSS must fail closed');
  assert.equal(checkSource('button.style.backgroundColor = "#0f766e";', { path: 'public/fixture.js', allowlist: [] }).passed, false, 'JavaScript style assignment must be checked');
  assert.equal(checkSource('host.innerHTML=`<button style="color:#b33a32">Delete</button>`;', { path: 'public/fixture.js', allowlist: [] }).passed, false, 'JavaScript inline styles must be checked');
  const concatFixture = `host.innerHTML='<div class="sample"><i style="background:'+goodColor(material.color)+'"></i></div>';`;
  const concatEntry = {file:'public/fixture.js',selector:'[inline-style]',property:'background',value:"'+goodColor(material.color)+'",sourcePrefix:'<div class="sample"><i style="',category:'user-color',reason:'Exact sanitized material color in the labeled sample, not an interaction state.'};
  assert.equal(checkSource(concatFixture, {path:'public/fixture.js',allowlist:[]}).passed, false, 'concatenated inline color cannot evade dynamic styling policy');
  assert.equal(checkSource(concatFixture, {path:'public/fixture.js',allowlist:[concatEntry]}).exceptions.length, 1, 'exact concatenated color expression and source context can be allowlisted');
  assert.equal(checkSource(concatFixture.replace('material.color','material.Color'), {path:'public/fixture.js',allowlist:[concatEntry]}).passed, false, 'concatenated expression remains case-sensitive');
  assert.equal(checkSource(concatFixture.replace('class="sample"','class="action"'), {path:'public/fixture.js',allowlist:[concatEntry]}).passed, false, 'concatenated color exception cannot move to another source context');
  assert.equal(checkSource(concatFixture.replace('background:', 'border-radius:'), {path:'public/fixture.js',allowlist:[{...concatEntry,property:'border-radius'}]}).passed, false, 'concatenated color exception cannot waive geometry');
  assert.equal(checkSource('const catalogColor="#bd8b54";', { path: 'public/fixture.js', allowlist: [] }).passed, true, 'domain color data outside style sinks is not a semantic UI declaration');
  assert.equal(checkSource('.x{color:var(--ks-action)}/* #f00;{ } */ .x::before{content:"#f00;{}"}', { allowlist: [] }).passed, true, 'comments and strings must not become declarations or color violations');
  assert.equal(checkSource('/* .x{color:#f00} */\n.x{color:#b33a32}', { allowlist: [] }).diagnostics[0].line, 2, 'diagnostics must preserve source line positions');
  assert.equal(checkSource('button.style.backgroundColor = chosenColor;', { path: 'public/fixture.js', allowlist: [] }).passed, false, 'computed style sinks require a documented color-data exception');
  assert.equal(checkSource('host.innerHTML=`<i style="background:${material.color}"></i>`;', { path: 'public/fixture.js', allowlist: [{ file: 'public/fixture.js', selector: '[inline-style]', property: 'background', value: '${material.color}', category: 'user-color', reason: 'The catalog material color selected by the user.' }] }).passed, true, 'computed user-color data must have a precise allowlist route');
  assert.equal(checkSource('button.setAttribute("style", "color:#b33a32");', { path: 'public/fixture.js', allowlist: [] }).passed, false, 'setAttribute style must not bypass policy');
  assert.equal(checkSource('// button.style.color="#f00";\nconst color="#bd8b54";', { path: 'public/fixture.js', allowlist: [] }).passed, true, 'commented-out JavaScript must not produce styling diagnostics');
  assert.equal(checkSource('button.style.width = chosenWidth;', { path: 'public/fixture.js', allowlist: [] }).passed, true, 'ordinary runtime layout geometry remains outside semantic styling policy');
  assert.equal(checkSource('.control:focus-visible{outline:var(--ks-focus-ring)}', { allowlist: [] }).passed, false, 'a focus color alone is not an outline contract');
  assert.equal(checkSource('.control{color:var(--ks-does-not-exist)}', { allowlist: [], tokens: ['--ks-action'] }).passed, false, 'undefined system tokens must not provide a false pass');
  assert.equal(checkSource('.control{transition:color var(--feature-timing)}', { allowlist: [] }).passed, false, 'local arbitrary timing aliases cannot bypass motion contracts');
  const reviewRegressions = [];
  const requireReview = (name, passed) => { if (!passed) reviewRegressions.push(name); };
  for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'start-start', 'start-end', 'end-start', 'end-end']) {
    const property = `border-${corner}-radius`;
    requireReview(`${property} rejects arbitrary radius`, checkSource(`.control{${property}:13px}`, { allowlist: [] }).diagnostics.some(item => item.code === 'radius'));
    requireReview(`${property} accepts morphology token`, checkSource(`.control{${property}:var(--ks-radius-control)}`, { allowlist: [] }).passed);
  }
  for (const declaration of ['outline-width:0', 'outline-width:0px', 'outline-width:0.0em!important', 'outline-style:none', 'outline-style:NONE!important']) requireReview(`${declaration} cannot suppress inherited focus`, checkSource(`.control{${declaration}}`, { allowlist: [] }).diagnostics.some(item => item.code === 'focus'));
  requireReview('visible outline longhands remain allowed', checkSource('.control{outline-width:3px;outline-style:solid}', { allowlist: [] }).passed);
  const userException = { file: 'public/fixture.js', selector: '[inline-style]', property: 'background', value: '${material.color}', category: 'user-color', reason: 'The catalog material color selected by the user.' };
  requireReview('allowlist preserves interpolated JavaScript case', !checkSource('host.innerHTML=`<i style="background:${material.Color}"></i>`;', { path: 'public/fixture.js', allowlist: [userException] }).passed);
  requireReview('allowlist preserves direct JavaScript expression case', !checkSource('host.style.backgroundColor = material.Color;', { path: 'public/fixture.js', allowlist: [{ ...userException, selector: '[style-assignment]', property: 'background-color', value: 'material.color' }] }).passed);
  requireReview('allowlist accepts harmless CSS whitespace', checkSource('.material-swatch{background:linear-gradient(#bd8b54,  #fff)}', { path: 'public/fixture.css', allowlist: [{ ...exception, value: 'linear-gradient(#bd8b54, #fff)' }] }).passed);
  requireReview('non-color identifiers are not named-color violations', checkSource('.control{grid-area:red;font-family:Tan}', { allowlist: [] }).passed);
  for (const declaration of ['border:1px solid red', 'outline:3px solid red', 'text-decoration:underline red', 'column-rule:1px solid red', 'box-shadow:0 1px 2px red']) requireReview(`${declaration} retains named-color detection`, checkSource(`.control{${declaration}}`, { allowlist: [] }).diagnostics.some(item => item.code === 'raw-color'));
  assert.deepEqual(reviewRegressions, [], 'review regression cases must pass');
  console.log('PASS design native policy: semantic colors, geometry, motion, focus, precise color exceptions, CSS parsing, and JavaScript style sinks.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2).filter(argument => argument !== '--json');
  if (!files.length) runPolicyTests();
  else {
    const results = files.map(file => checkFile(file));
    if (process.argv.includes('--json')) console.log(JSON.stringify(results, null, 2));
    else for (const result of results) {
      for (const diagnostic of result.diagnostics) console.error(`${diagnostic.file}:${diagnostic.line}:${diagnostic.column} [${diagnostic.code}] ${diagnostic.selector} ${diagnostic.property}: ${diagnostic.message}`);
      console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.path}: ${result.diagnostics.length} violations, ${result.exceptions.length} documented exceptions.`);
    }
    process.exitCode = results.every(result => result.passed) ? 0 : 1;
  }
}

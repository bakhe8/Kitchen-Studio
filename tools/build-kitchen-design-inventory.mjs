import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanCSS } from './check-kitchen-design-native.mjs';

const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
const familyIds = ['field', 'design', 'factory', 'presentation', 'operations'];
const ordered = values => [...new Set(values)].sort();
const slash = value => value.replaceAll('\\', '/');
const routeFamilies = {
  field: ['survey', 'outline', 'photo', 'intake', 'surfaces3d', 'profile', 'measure', 'routes', 'zones', 'decisions'],
  design: ['cad', 'shelf', 'whole', 'row', 'uses', 'wallOptions', 'appliances', 'tap', 'finish'],
  factory: ['assembly', 'corner', 'surface', 'factory', 'inventory', 'production', 'recipes', 'machines', 'template', 'logistics'],
  presentation: ['quote', 'approve', 'sign', 'tracking'],
};

export function classifyFamily(name, { route = false } = {}) {
  if (route) return Object.entries(routeFamilies).find(([, routes]) => routes.includes(name))?.[0] ?? 'operations';
  const base = path.basename(name).toLowerCase();
  // Catalogs/defaults stay in the five-family taxonomy; Task 5 is their own migration wave.
  if (/catalog|library|libraries|defaults|device-types|materials|supplier|appliance-intake/.test(base)) return /appliance-intake/.test(base) ? 'field' : 'operations';
  if (/survey|visit|field|outline|wall-ink|wall-scan|wall-profile|wall-photo|measured-outline|measurement|measure-fit|service-zones|pipe-routes|perimeter|photo-(?:trace|tracer|plane|scene|crew)|^survey-studio/.test(base)) return 'field';
  if (/proposal|quote|stage-review|delivery|report|install-readiness|output-stamp|drawing-output|drawing-book/.test(base)) return 'presentation';
  if (/factory|production|workshop-(?:inventory|spreadsheet|revision|state)|^kitchen-workshop\.css$|machining|procurement|drawer-pack|corner-carcass|corner-solid|pantry-factory|base-support|order-/.test(base)) return 'factory';
  if (/^shelf-|designer|design-pages|stage-design|finish|workspace-ui|cad|render|drawing|whole|placement|layout|backsplash|worktop|upstand|linear-light|surface-|wall-(?:pair|accessory|scribe)|tap-window|fitout|volume|row-|chain|creative|room-|oriented|pantry-brief/.test(base)) return 'design';
  return 'operations';
}

function variableObject(source, name) {
  const match = new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=\\s*\\{`).exec(source);
  if (!match) return '';
  const start = match.index + match[0].length;
  let depth = 1, quote = '';
  for (let index = start; index < source.length; index++) {
    const character = source[index];
    if (quote) { if (character === '\\') index++; else if (character === quote) quote = ''; continue; }
    if ('"\'`'.includes(character)) quote = character;
    else if (character === '{') depth++;
    else if (character === '}' && --depth === 0) return source.slice(start, index);
  }
  throw new Error(`Unclosed ${name} route manifest`);
}

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? listFiles(path.join(directory, entry.name)) : [path.join(directory, entry.name)]).sort();
}

export function buildInventory({ root = defaultRoot } = {}) {
  const publicDir = path.join(root, 'public');
  const sourceFiles = listFiles(publicDir).filter(file => /\.(?:css|js)$/.test(file));
  const htmlPath = path.join(publicDir, 'index.html');
  const html = readFileSync(htmlPath, 'utf8');
  const entryReferences = ordered([...html.matchAll(/(?:href|src)\s*=\s*["']([^"']+\.(?:css|js)(?:[?#][^"']*)?)["']/g)].map(match => normalizeReference('public/index.html', match[1])).filter(Boolean));
  const components = new Map();
  const screens = new Map();
  const routes = new Map();
  const addComponent = (id, source) => {
    if (!components.has(id)) components.set(id, new Set());
    components.get(id).add(source);
  };
  const collectClasses = (text, source) => {
    for (const match of text.matchAll(/\bclass\s*=\s*["']([^"']*)["']/g)) {
      for (const name of match[1].split(/\s+/)) if (/^[a-zA-Z_][\w-]*$/.test(name)) addComponent(`.${name}`, source);
    }
  };
  collectClasses(html, 'public/index.html');
  const files = sourceFiles.map(absolute => {
    const file = slash(path.relative(root, absolute));
    const source = readFileSync(absolute, 'utf8');
    const type = path.extname(file).slice(1);
    const family = classifyFamily(file);
    const references = new Set();
    let rules = 0;
    let declarations = 0;
    let inlineStyles = 0;
    if (type === 'css') {
      const css = scanCSS(source);
      for (const rule of css.rules) {
        rules++;
        for (const match of rule.selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)) addComponent(`.${match[1]}`, file);
      }
      declarations = css.declarations.length;
      for (const match of source.matchAll(/@import\s+(?:url\()?\s*["']([^"']+)["']/g)) {
        const ref = match[1];
        const target = ref && normalizeReference(file, ref);
        if (target) references.add(target);
      }
    } else {
      collectClasses(source, file);
      inlineStyles = [...source.matchAll(/\bstyle\s*=|<style\b/g)].length;
      for (const match of source.matchAll(/\b(?:import|export)\s*(?:\(\s*)?(?:[^;\n]*?\bfrom\s*)?["']([^"']+)["']/g)) {
        const target = normalizeReference(file, match[1]);
        if (target) references.add(target);
      }
      if (path.basename(file) === 'kitchen-workshop-ui.js') {
          const steps = variableObject(source, 'steps');
          for (const match of steps.matchAll(/(?:^|,)\s*([\w-]+)\s*:\s*\{([^{}]*)\}/g)) {
            const id = match[1];
            const definition = Object.fromEntries([...match[2].matchAll(/(title|layout)\s*:\s*(['"])(.*?)\2/g)].map(value => [value[1], value[3]]));
            const routeFamily = classifyFamily(id, { route: true });
            screens.set(id, { id, title: definition.title ?? id, layout: definition.layout ?? null, family: routeFamily, status: 'legacy', sources: [file] });
            routes.set(id, { id, canonical: id, alias: false, family: routeFamily, href: `?panel=workshop&step=${id}`, source: file });
          }
          for (const match of variableObject(source, 'aliases').matchAll(/(?:^|,)\s*([\w-]+)\s*:\s*(['"])(.*?)\2/g)) {
            const id = match[1], canonical = match[3];
            routes.set(id, { id, canonical, alias: true, family: classifyFamily(canonical, { route: true }), href: `?panel=workshop&step=${id}`, source: file });
          }
      }
    }
    const catalog = /catalog|library|libraries|defaults|device-types|materials|supplier/.test(path.basename(file));
    return { path: file, type, family, migrationWave: file === 'public/kitchen-design-system.css' ? 1 : catalog ? 5 : ({ field: 3, design: 4, factory: 6, presentation: 7, operations: 8 })[family], status: file === 'public/kitchen-design-system.css' ? 'foundation' : 'legacy', bytes: Buffer.byteLength(source), sha256: createHash('sha256').update(source).digest('hex'), entryLinked: entryReferences.includes(file), reachableFromEntry: false, references: ordered(references), ...(type === 'css' ? { rules, declarations } : { inlineStyleFragments: inlineStyles }) };
  });
  const byPath = new Map(files.map(file => [file.path, file]));
  const reachable = new Set();
  const queue = [...entryReferences];
  while (queue.length) {
    const current = queue.shift();
    if (reachable.has(current)) continue;
    reachable.add(current);
    queue.push(...(byPath.get(current)?.references ?? []));
  }
  files.forEach(file => { file.reachableFromEntry = reachable.has(file.path); });
  // The editor and device-width gate are distinct surfaces outside the workshop step router.
  for (const [filename, id, title, family] of [['kitchen-editor.js', 'cad', 'Spatial editor', 'design'], ['shelf-entry.js', 'shelf', 'Shelf planner', 'design'], ['kitchen-workspace-entry.js', 'unsupported-small-device', 'Compact workspace gate', 'operations']]) {
    if (byPath.has(`public/${filename}`)) screens.set(id, { id, title, layout: 'shell', family, status: 'legacy', sources: [`public/${filename}`] });
  }
  const screenList = [...screens.values()].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const componentList = [...components].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([id, sources]) => {
    const sourceList = ordered(sources);
    const families = ordered(sourceList.map(source => byPath.get(source)?.family ?? 'operations'));
    return { id, kind: 'static-class', family: families.length === 1 ? families[0] : 'operations', families, status: 'legacy', sources: sourceList };
  });
  const families = familyIds.map(id => ({ id, files: files.filter(file => file.family === id).map(file => file.path), screens: screenList.filter(screen => screen.family === id).map(screen => screen.id), counts: { files: files.filter(file => file.family === id).length, stylesheets: files.filter(file => file.family === id && file.type === 'css').length, scripts: files.filter(file => file.family === id && file.type === 'js').length, screens: screenList.filter(screen => screen.family === id).length, components: componentList.filter(component => component.family === id).length } }));
  const classified = files.filter(file => familyIds.includes(file.family)).length;
  return { schemaVersion: 1, scope: 'All recursive public CSS and JavaScript; static class components; workshop canonical routes and aliases; editor and device-width shell screens.', limitations: ['Static classes are coverage units, not claims of reusable component contracts.', 'Computed classes, runtime-loaded URLs, conditional screen states, contrast, pointer targets and visual/keyboard acceptance require browser QA.', 'Migration status defaults to legacy; source classification and policy passing do not establish system-native acceptance.'], entry: { path: 'public/index.html', sha256: createHash('sha256').update(html).digest('hex'), references: entryReferences }, counts: { files: files.length, stylesheets: files.filter(file => file.type === 'css').length, scripts: files.filter(file => file.type === 'js').length, routes: routes.size, screens: screenList.length, components: componentList.length }, coverage: { totalFiles: files.length, classifiedFiles: classified, unclassifiedFiles: files.length - classified, percent: files.length ? classified / files.length * 100 : 100, entryReachableFiles: files.filter(file => file.reachableFromEntry).length, unlinkedFiles: files.filter(file => !file.reachableFromEntry).length, systemNativeFiles: 0 }, families, routes: [...routes.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0), screens: screenList, components: componentList, files };
}

function normalizeReference(from, target) {
  if (typeof target !== 'string' || !target.startsWith('.') || !/\.(?:css|js)(?:[?#]|$)/.test(target)) return null;
  return path.posix.normalize(path.posix.join(path.posix.dirname(from), target.split(/[?#]/)[0]));
}

export const serializeInventory = inventory => `${JSON.stringify(inventory, null, 2)}\n`;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inventory = buildInventory();
  const destination = path.join(defaultRoot, 'docs/design-system/inventory.json');
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, serializeInventory(inventory));
  console.log(`Generated ${slash(path.relative(defaultRoot, destination))}: ${inventory.counts.stylesheets} CSS, ${inventory.counts.scripts} JS, ${inventory.counts.routes} routes, ${inventory.counts.screens} screens, ${inventory.counts.components} class components; ${inventory.coverage.percent}% classified.`);
}

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const builder = path.join(root, 'tools/build-kitchen-design-inventory.mjs');
assert.ok(existsSync(builder), 'inventory generator must exist');
const { buildInventory, serializeInventory } = await import('./build-kitchen-design-inventory.mjs');
const fixture = mkdtempSync(path.join(tmpdir(), 'kitchen-inventory-'));
try {
  mkdirSync(path.join(fixture, 'public/nested'), { recursive: true });
  const put = (name, text) => writeFileSync(path.join(fixture, 'public', name), text);
  put('index.html', '<link rel="stylesheet" href="./kitchen-field.css"><script type="module" src="./entry.js"></script><main class="fixture-shell"></main>');
  put('entry.js', 'import "./nested/kitchen-workshop-ui.js"; export const mountFixture=()=>`<button class="fixture-control">OK</button>`;');
  put('nested/kitchen-workshop-ui.js', "const steps={survey:{title:'Survey',layout:'drawing'},quote:{title:'Quote',layout:'focus'}}; const aliases={old:'survey'};");
  put('kitchen-field.css', '.fixture-control{color:var(--ks-action)}');
  put('nested/kitchen-factory.css', '.factory-row{display:grid}');
  put('kitchen-design-system.css', ':root{--ks-action:#087c78}');
  put('kitchen-designer.css', '.design-pane{display:block}');
  put('kitchen-proposal.css', '.quote-pane{display:block}');
  const result = buildInventory({ root: fixture });
  assert.equal(result.counts.stylesheets, 5, 'nested and unlinked CSS must be inventoried');
  assert.equal(result.counts.scripts, 2, 'all public JS must be inventoried');
  assert.equal(result.counts.routes, 3, 'two canonical routes and their alias must be counted');
  assert.ok(result.screens.some(screen => screen.id === 'survey' && screen.family === 'field'));
  assert.ok(result.screens.some(screen => screen.id === 'quote' && screen.family === 'presentation'));
  assert.ok(result.components.some(component => component.id === '.fixture-control' && component.sources.length === 2), 'template and selector references must join');
  assert.ok(result.components.some(component => component.id === '.fixture-shell'), 'entry HTML components must be included');
  assert.deepEqual(result.families.map(family => family.id), ['field', 'design', 'factory', 'presentation', 'operations']);
  assert.equal(result.coverage.classifiedFiles, 7);
  assert.equal(result.coverage.unclassifiedFiles, 0);
  assert.equal(result.coverage.percent, 100);
  assert.ok(result.files.some(file => file.path === 'public/nested/kitchen-factory.css' && file.family === 'factory' && !file.reachableFromEntry));
  assert.ok(result.files.some(file => file.path === 'public/nested/kitchen-workshop-ui.js' && file.reachableFromEntry));
  assert.equal(serializeInventory(result), serializeInventory(buildInventory({ root: fixture })), 'generation must be byte deterministic');
  assert.deepEqual(result.files.map(file => file.path), result.files.map(file => file.path).sort());
  put('new-unlinked.css', '.new-component{display:block}');
  assert.equal(buildInventory({ root: fixture }).counts.stylesheets, 6, 'new unreferenced sheets cannot disappear');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

const inventory = buildInventory({ root });
const cssFiles = readdirSync(path.join(root, 'public'), { recursive: true }).filter(name => name.endsWith('.css')).map(name => `public/${name.replaceAll('\\', '/')}`).sort();
assert.deepEqual(inventory.files.filter(file => file.type === 'css').map(file => file.path), cssFiles, 'every current stylesheet must be covered');
const jsFiles = readdirSync(path.join(root, 'public'), { recursive: true }).filter(name => name.endsWith('.js')).map(name => `public/${name.replaceAll('\\', '/')}`).sort();
assert.deepEqual(inventory.files.filter(file => file.type === 'js').map(file => file.path), jsFiles, 'every current script must be covered');
assert.ok(inventory.counts.routes > 30 && inventory.counts.screens > 30 && inventory.counts.components > 100, 'real interface coverage must be populated');
assert.equal(readFileSync(path.join(root, 'docs/design-system/inventory.json'), 'utf8'), serializeInventory(inventory), 'stored inventory is stale; run node tools/build-kitchen-design-inventory.mjs');
assert.equal(inventory.coverage.unclassifiedFiles, 0);
console.log(`PASS design inventory: ${inventory.counts.routes} routes, ${inventory.counts.screens} screens, ${inventory.counts.components} class components, ${inventory.counts.stylesheets} stylesheets, ${inventory.counts.scripts} scripts; ${inventory.coverage.percent}% source classification.`);

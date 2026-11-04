import assert from 'node:assert/strict';
import {parseWallInkDimensions,suggestWallOpening} from '../public/kitchen-wall-ink-recognition.js';

const pair=['gapMm','widthMm'];
for(const s of ['٤٠٠ ٩٠٠','٤٠٠ × ٩٠٠','400/900','۴۰۰،۹۰۰','400x900']){
 assert.deepEqual(parseWallInkDimensions(s,pair),{gapMm:400,widthMm:900});
}
assert.deepEqual(parseWallInkDimensions('٠ ١٬٢٠٠',pair),{gapMm:0,widthMm:1200});
assert.deepEqual(parseWallInkDimensions('١٠٠ ١٬٢٥٠ ٩٠٠٫٥',['gapMm','widthMm','bottomMm']),{gapMm:100,widthMm:1250,bottomMm:900.5});
for(const invalid of ['','٤٠٠','١٬٢٠٠','٤٠٠ غدا','4 -3','400,900','1 2 3']){
 assert.equal(parseWallInkDimensions(invalid,pair),null);
}
assert.equal(suggestWallOpening({zMm:2000},{zMm:35},2800),'door');
assert.equal(suggestWallOpening({zMm:35},{zMm:2000},2800),'door');
assert.equal(suggestWallOpening({zMm:950},{zMm:1950},2800),'window');
console.log('Reversible floor-based opening suggestion and Arabic mm measurement pairs with explicit order.');

const {wallInkNotes}=await import('../public/kitchen-wall-ink-notes.js');
const svgData={inkLeft:40,inkTop:55,inkWidth:400,inkHeight:224,inkWallMm:5000,inkHeightMm:2800};
const proposal={datumMm:1300,row:{kind:'window',gapMm:700,widthMm:1200,bottomMm:1000,heightMm:1100}};
const windowNotes=wallInkNotes({svgData,proposal,values:{widthMm:'١٢٤٥'}});
assert.match(windowNotes,/data-ink-edit="gapMm"/);assert.match(windowNotes,/١٬٢٤٥/);
assert.doesNotMatch(windowNotes,/NaN|undefined/);
const serviceNotes=wallInkNotes({svgData,proposal:{datumMm:0,row:{kind:'water',gapMm:650,bottomMm:530}},values:{}});
assert.match(serviceNotes,/data-ink-edit="bottomMm"/);assert.doesNotMatch(serviceNotes,/data-ink-edit="widthMm"/);
assert.equal(wallInkNotes({svgData,proposal,values:{gapMm:''}}),'');

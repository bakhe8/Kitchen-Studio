import assert from 'node:assert/strict';

const model = await import('../public/survey-studio-model.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return null;
  throw error;
});
assert.equal(typeof model?.transition, 'function', 'The isolated survey transition model must exist');
const {createSurveyState, transition, currentWall, visibleChain, blockers, parseMeasurement} = model;
const event = (state, type, values = {}) => transition(state, {type, ...values});
const row = state => currentWall(state).chain.rows.find(item => item.id === state.selectionId);
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
let checks = 0;
function check(name, run) { run(); checks++; console.log('PASS '+name); }

check('Arabic and Persian digits, grouping, decimals and length conversion preserve exact millimetres', () => {
  for (const [value, unit, expected] of [['١٬٢٣٤٫٥','mm',1234.5],['۱۲٫۵','cm',125],['٠٫٩','م',900],['.5','سم',5],[42,'MM',42],[' ٤٢٠٠ ','mm',4200]]) {
    assert.equal(parseMeasurement(value, unit), expected);
  }
  for (const value of ['', ' ', null, undefined, NaN, Infinity, '١٢٫٫٣', '12oops', {}, []]) assert.equal(parseMeasurement(value), null);
  assert.equal(parseMeasurement(4,'kg'),null);
  assert.equal(parseMeasurement(4,'mystery'),null);
});

check('demonstration readings never count as field evidence or a confirmed wall', () => {
  const state = createSurveyState();
  assert.equal(state.wallId,'back'); assert.equal(state.selectionId,'window-1');
  assert.equal(state.phase,'selected'); assert.equal(currentWall(state).confirmed,false);
  assert.equal(row(state).widthMm,1200);
  assert.equal(currentWall(state).chain.source,'drawing');
  assert.equal(blockers(state).filter(item => item.code === 'source').length,3);
  assert(blockers(state).some(item => item.code === 'dimensions'));
  assert(blockers(state).some(item => item.code === 'closure'));
  assert.equal(currentWall(event(state,'CONFIRM')).confirmed,false);
});

check('temporary invalid and out-of-wall input stays visible but never mutates the saved reading', () => {
  const original = freeze(createSurveyState());
  let state = event(original,'BEGIN');
  state = event(state,'PATCH',{values:{widthMm:''}});
  assert.equal(state.draft.row.widthMm,''); assert.equal(state.phase,'invalid');
  assert.equal(visibleChain(state).rows[0].widthMm,'');
  state = event(state,'COMMIT');
  assert.equal(row(state).widthMm,1200); assert.equal(state.past.length,0); assert(state.error);
  state = event(state,'PATCH',{values:{widthMm:'٩٠٠٠'}});
  assert.equal(state.phase,'invalid'); assert.equal(currentWall(event(state,'COMMIT')).chain.rows[0].widthMm,1200);
  state = event(state,'CANCEL'); assert.equal(state.draft,null); assert.equal(state.phase,'selected');
  assert.deepEqual(state.walls,original.walls);
});

check('many drag updates commit exactly one reversible history entry and a no-op commits none', () => {
  let state = event(freeze(createSurveyState()),'BEGIN');
  for (const widthMm of [1210,1230,1270,1300]) state = event(state,'PATCH',{values:{widthMm}});
  assert.equal(state.past.length,0); assert.equal(row(state).widthMm,1200);
  state = event(state,'COMMIT'); assert.equal(row(state).widthMm,1300); assert.equal(state.past.length,1);
  state = event(state,'UNDO'); assert.equal(row(state).widthMm,1200); assert.equal(state.future.length,1);
  state = event(state,'REDO'); assert.equal(row(state).widthMm,1300); assert.equal(state.future.length,0);
  state = event(state,'BEGIN'); state = event(state,'COMMIT'); assert.equal(state.past.length,1);
});

check('draft guards selection and wall changes; undo cancels a draft before saved history', () => {
  let state = event(createSurveyState(),'BEGIN');
  state = event(state,'PATCH',{values:{widthMm:1350}});
  state = event(state,'SELECT',{id:'water-1'}); assert.equal(state.selectionId,'window-1'); assert(state.draft);
  state = event(state,'WALL',{id:'right'}); assert.equal(state.wallId,'back'); assert(state.draft);
  state = event(state,'UNDO'); assert.equal(state.draft,null); assert.equal(row(state).widthMm,1200); assert.equal(state.past.length,0);
  state = event(state,'WALL',{id:'right'}); assert.equal(state.wallId,'right'); assert.equal(state.selectionId,null);
  assert.equal(state.phase,'idle');
});

check('blocked navigation preserves the numerical validity of the pending draft', () => {
  let state = event(createSurveyState(),'BEGIN');
  state = event(state,'PATCH',{values:{widthMm:1350}});
  for (const [type,values] of [['SELECT',{id:'water-1'}],['WALL',{id:'right'}]]) {
    state = event(state,type,values);
    assert.equal(state.phase,'editing','a navigation guard must not mislabel valid measurements');
    assert.equal(state.draft.row.widthMm,1350); assert.equal(state.wallId,'back');
    assert.equal(state.selectionId,'window-1'); assert(state.error);
  }
  state = event(state,'COMMIT'); assert.equal(row(state).widthMm,1350);
  state = event(state,'BEGIN'); state = event(state,'PATCH',{values:{widthMm:''}});
  state = event(state,'WALL',{id:'right'}); assert.equal(state.phase,'invalid');
  assert.equal(state.draft.row.widthMm,''); assert.equal(row(state).widthMm,1350);
});

check('independent closure and observed dimensions must be physical and match the selected wall', () => {
  let state = createSurveyState();
  for (const closureMm of ['',0,-1,Infinity,'broken']) {
    const invalid = event(state,'WALL_META',{closureMm}); assert.equal(currentWall(invalid).closureMm,null); assert(invalid.error);
  }
  state = event(state,'WALL_META',{closureMm:'٤١٩٩٫٤',dimensionsMeasured:true});
  assert(blockers(state).some(item => item.code === 'closure'));
  state = event(state,'WALL_META',{closureMm:4199.5}); assert(!blockers(state).some(item => item.code === 'closure'));
  state = event(state,'WALL',{id:'right'});
  state = event(state,'WALL_META',{closureMm:3600,dimensionsMeasured:true});
  assert(!blockers(state).some(item => item.code === 'closure'));
  assert(blockers(state).some(item => item.code === 'empty'));
});

check('an inspected empty wall can be confirmed only after an explicit empty-wall review', () => {
  let state = event(createSurveyState(),'WALL',{id:'right'});
  assert.equal(currentWall(state).emptyReviewed,false);
  state = event(state,'WALL_META',{closureMm:3600,dimensionsMeasured:true});
  assert(blockers(state).some(item => item.code === 'empty'));
  assert.equal(currentWall(event(state,'CONFIRM')).confirmed,false);
  state = event(state,'WALL_META',{emptyReviewed:true});
  assert.equal(blockers(state).length,0);
  state = event(state,'CONFIRM'); assert.equal(currentWall(state).confirmed,true);
  assert.equal(currentWall(state).chain.rows.length,0);
  state = event(state,'UNDO'); assert.equal(currentWall(state).confirmed,false);
  state = event(state,'WALL_META',{emptyReviewed:false});
  assert(blockers(state).some(item => item.code === 'empty'));
});

check('adding and deleting the last element require a fresh empty-wall review', () => {
  let state = event(createSurveyState(),'WALL',{id:'right'});
  state = event(state,'WALL_META',{closureMm:3600,dimensionsMeasured:true,emptyReviewed:true});
  state = event(state,'CONFIRM');
  state = event(state,'ADD',{kind:'water',atMm:1000,bottomMm:600});
  state = event(state,'COMMIT'); assert.equal(currentWall(state).emptyReviewed,false);
  assert.equal(currentWall(state).confirmed,false);
  state = event(state,'WALL_META',{emptyReviewed:true});
  assert.equal(currentWall(state).emptyReviewed,false,'a wall with an element is not empty');
  state = event(state,'DELETE');
  assert.equal(currentWall(state).chain.rows.length,0);
  assert.equal(currentWall(state).emptyReviewed,false);
  assert(blockers(state).some(item => item.code === 'empty'));
  assert.equal(currentWall(event(state,'CONFIRM')).confirmed,false);
  state = event(state,'WALL_META',{emptyReviewed:true});
  assert.equal(currentWall(event(state,'CONFIRM')).confirmed,true);
});

check('unrecorded closure text remains attached to its wall across navigation and selection', () => {
  const original = freeze(createSurveyState());
  let state = event(original,'CLOSURE_INPUT',{value:'٤٢٠٠٫٢'});
  assert.equal(state.closureDrafts?.back,'٤٢٠٠٫٢');
  assert.equal(currentWall(state).closureMm,null); assert.equal(state.past.length,0);
  state = event(state,'SELECT',{id:'water-1'}); assert.equal(state.closureDrafts.back,'٤٢٠٠٫٢');
  state = event(state,'WALL',{id:'right'});
  state = event(state,'CLOSURE_INPUT',{value:'٣٦٠٠'});
  state = event(state,'WALL',{id:'back'});
  assert.deepEqual(state.closureDrafts,{back:'٤٢٠٠٫٢',right:'٣٦٠٠'});
  assert.deepEqual(original.closureDrafts,{});
  assert(blockers(state,'right').some(item => item.code === 'closure-draft'));
});

check('invalid closure drafts stay visible; recording a valid closure creates one reversible saved step', () => {
  let state = createSurveyState();
  for (const value of ['', 'خطأ', '−١']) {
    state = event(state,'CLOSURE_INPUT',{value}); state = event(state,'CLOSURE_COMMIT');
    assert.equal(state.closureDrafts.back,value); assert.equal(currentWall(state).closureMm,null);
    assert.equal(state.past.length,0); assert(state.error);
  }
  for (const value of ['٤','٤٢','٤٢٠','٤٢٠٠']) state = event(state,'CLOSURE_INPUT',{value});
  state = event(state,'CLOSURE_COMMIT');
  assert.equal(currentWall(state).closureMm,4200); assert(!Object.hasOwn(state.closureDrafts,'back'));
  assert.equal(state.past.length,1);
  state = event(state,'UNDO'); assert.equal(currentWall(state).closureMm,null);
  state = event(state,'REDO'); assert.equal(currentWall(state).closureMm,4200);
});

check('a new unrecorded closure blocks confirmation even when the saved closure was valid', () => {
  let state = fieldWall();
  assert.equal(blockers(state).length,0);
  state = event(state,'CLOSURE_INPUT',{value:'٤٢٠٠'});
  assert(blockers(state).some(item => item.code === 'closure-draft'));
  state = event(state,'CONFIRM'); assert.equal(currentWall(state).confirmed,false);
  state = event(state,'CLOSURE_COMMIT'); assert.equal(blockers(state).length,0);
  state = event(state,'CONFIRM'); assert.equal(currentWall(state).confirmed,true);
});

check('history first cancels only the current closure draft and preserves any reading draft or other wall text', () => {
  let state = createSurveyState();
  state = event(state,'CLOSURE_INPUT',{value:'٤٢٠٠'});
  state = event(state,'WALL',{id:'right'}); state = event(state,'CLOSURE_INPUT',{value:'٣٦٠٠'});
  state = event(state,'REDO'); assert(!Object.hasOwn(state.closureDrafts,'right')); assert.equal(state.closureDrafts.back,'٤٢٠٠');
  state = event(state,'WALL',{id:'back'}); state = event(state,'SELECT',{id:'window-1'});
  state = event(state,'BEGIN'); state = event(state,'PATCH',{values:{widthMm:1300}});
  const before = state.closureDrafts.back;
  state = event(state,'CLOSURE_INPUT',{value:'٤١٠٠'}); assert.equal(state.closureDrafts.back,before);
  state = event(state,'UNDO'); assert(!Object.hasOwn(state.closureDrafts,'back')); assert.equal(state.draft.row.widthMm,1300);
  state = event(state,'UNDO'); assert.equal(state.draft,null); assert.equal(row(state).widthMm,1200);
  state = event(state,'CLOSURE_INPUT',{value:'٤٢٠٠'}); state = event(state,'CLOSURE_CANCEL');
  assert.deepEqual(state.closureDrafts,{}); assert.equal(state.past.length,0);
  state = event(state,'CLOSURE_INPUT',{value:'٤٢٠٠'});
  state = event(state,'BEGIN'); state = event(state,'PATCH',{values:{widthMm:''}});
  state = event(state,'UNDO');
  assert.equal(state.phase,'invalid'); assert.equal(state.draft.row.widthMm,'');
  assert(state.error,'cancelling only the closure must retain the reading validation error');
});

function fieldWall() {
  let state = createSurveyState();
  for (const id of ['window-1','water-1','electric-1']) {
    state = event(state,'SELECT',{id}); state = event(state,'BEGIN');
    state = event(state,'PATCH',{values:{source:'field'}}); state = event(state,'COMMIT');
  }
  return event(state,'WALL_META',{closureMm:4200,dimensionsMeasured:true});
}
check('confirmation requires explicit sources, is reversible, and dimensional edits invalidate field source', () => {
  let state = fieldWall(); assert.equal(blockers(state).length,0);
  const before = state.past.length;
  state = event(state,'CONFIRM'); assert.equal(currentWall(state).confirmed,true); assert.equal(state.past.length,before+1);
  assert.equal(currentWall(state).chain.source,'drawing','prototype confirmation must not forge a production attestation');
  state = event(state,'UNDO'); assert.equal(currentWall(state).confirmed,false);
  state = event(state,'REDO'); assert.equal(currentWall(state).confirmed,true);
  state = event(state,'SELECT',{id:'window-1'}); state = event(state,'BEGIN');
  state = event(state,'PATCH',{values:{widthMm:1250}}); assert.equal(state.draft.source,'unknown');
  state = event(state,'COMMIT'); assert.equal(currentWall(state).confirmed,false);
  assert(blockers(state).some(item => item.code === 'source' && item.rowId === 'window-1'));
  state = event(state,'UNDO'); assert.equal(currentWall(state).confirmed,true); assert.equal(currentWall(state).sources['window-1'],'field');
});

check('new points use centre coordinates, unique IDs and explicit provisional source; add/delete undo cleanly', () => {
  let state = createSurveyState();
  state = event(state,'ADD',{kind:'water',atMm:1200,bottomMm:600});
  const firstId = state.draft.row.id;
  assert.equal(state.draft.kind,'add'); assert.equal(state.draft.row.from,'origin');
  assert.equal(state.draft.row.bottomMm,600); assert.equal(state.draft.source,'unknown');
  assert.equal(currentWall(state).chain.rows.length,3);
  state = event(state,'COMMIT'); assert.equal(currentWall(state).chain.rows.length,4);
  assert.equal(state.selectionId,firstId);
  state = event(state,'ADD',{kind:'water',atMm:1300,bottomMm:600}); assert.notEqual(state.draft.row.id,firstId);
  state = event(state,'CANCEL'); state = event(state,'DELETE'); assert.equal(currentWall(state).chain.rows.length,3);
  state = event(state,'UNDO'); assert.equal(currentWall(state).chain.rows.length,4); assert.equal(state.selectionId,firstId);
  state = event(state,'REDO'); assert.equal(currentWall(state).chain.rows.length,3);
});

check('source-only changes, metadata edits, and new saved edits invalidate confirmation or redo without mutating input', () => {
  let state = event(fieldWall(),'CONFIRM');
  const saved = freeze(state);
  state = event(state,'WALL_META',{dimensionsMeasured:false}); assert.equal(currentWall(state).confirmed,false);
  assert.equal(currentWall(saved).confirmed,true);
  state = event(state,'UNDO'); assert.equal(currentWall(state).confirmed,true);
  state = event(state,'SELECT',{id:'window-1'}); state = event(state,'BEGIN');
  state = event(state,'PATCH',{source:'drawing',values:{}}); state = event(state,'COMMIT');
  assert.equal(currentWall(state).sources['window-1'],'drawing'); assert.equal(currentWall(state).confirmed,false); assert.equal(state.future.length,0);
  state = event(state,'SELECT',{id:null}); assert.equal(state.selectionId,null); assert.equal(state.phase,'idle');
});

console.log(`Survey studio model: ${checks} behavioural checks passed.`);

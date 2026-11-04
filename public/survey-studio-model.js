// Isolated, in-memory survey prototype. Nothing here reads, saves or attests a
// production project. Room geometry is in cm; every reading and closure is mm.
import {resolveChain, newChainRow, pointKinds, chainLabels} from './kitchen-chain-model.js';
import {architectureWall} from './kitchen-architecture.js';
import {assistNumber, convertAssistUnit} from './kitchen-measurement-identity.js';

const sources = new Set(['drawing', 'field', 'unknown']);
const dimensions = new Set(['gapMm', 'widthMm', 'bottomMm', 'heightMm', 'depthMm']);
const copy = value => structuredClone(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Parse Arabic/Western/Persian numbers in a length unit into mm; invalid or blank is null. */
export function parseMeasurement(value, unit = 'mm') {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const number = assistNumber(value);
  return number === null ? null : convertAssistUnit(number, unit, 'mm');
}

/** Return a fresh demonstration session. Its example sources are never field evidence. */
export function createSurveyState() {
  const rows = [
    {id:'window-1', kind:'window', from:'origin', gapMm:1500, widthMm:1200, bottomMm:1100, heightMm:900, depthMm:100},
    {id:'water-1', kind:'water', from:'origin', gapMm:900, widthMm:50, bottomMm:550, heightMm:50, depthMm:50},
    {id:'electric-1', kind:'electric', from:'origin', gapMm:3100, widthMm:80, bottomMm:1150, heightMm:80, depthMm:40}
  ];
  return {
    room:{width:420, length:360, height:280},
    walls:[['back','الجدار الخلفي'], ['right','الجدار الأيمن'], ['front','الجدار الأمامي'], ['left','الجدار الأيسر']].map(([id,label]) => ({
      id, label, chain:{source:'drawing', rows:id === 'back' ? rows : []},
      sources:id === 'back' ? Object.fromEntries(rows.map(row => [row.id,'drawing'])) : {},
      closureMm:null, dimensionsMeasured:false, emptyReviewed:false, confirmed:false
    })),
    wallId:'back', selectionId:'window-1', phase:'selected', draft:null, closureDrafts:{},
    past:[], future:[], message:'اختر قياسًا وراجعه في الموقع.', error:''
  };
}

/** The saved wall currently being inspected. Its chain excludes pending changes. */
export function currentWall(state) {
  return state.walls.find(wall => wall.id === state.wallId) || null;
}

/** A detached chain for rendering the pending reading, including invalid raw input. */
export function visibleChain(state) {
  const chain = copy(currentWall(state)?.chain || {source:'drawing', rows:[]});
  if (!state.draft) return chain;
  const row = copy(state.draft.row);
  if (state.draft.kind === 'add') chain.rows.push(row);
  else chain.rows = chain.rows.map(saved => saved.id === row.id ? row : saved);
  return chain;
}

/** Actionable confirmation blockers: {code,message,rowId?}; never an attestation. */
export function blockers(state, wallId = state.wallId) {
  const wall = state.walls.find(item => item.id === wallId);
  if (!wall) return [{code:'wall', message:'الجدار غير موجود.'}];
  const result = [], draft = wallId === state.wallId ? state.draft : null;
  const chain = draft ? visibleChain(state) : wall.chain;
  if (draft) result.push({code:'draft', message:'طبّق تعديل القياس أو ألغِه قبل تأكيد الجدار.'});
  if (Object.hasOwn(state.closureDrafts,wallId)) result.push({code:'closure-draft', message:'سجّل قراءة الإغلاق المكتوبة أو ألغِها قبل تأكيد الجدار.'});
  if (!wall.dimensionsMeasured) result.push({code:'dimensions', message:'راجع طول الجدار وارتفاعه في الموقع.'});
  const edge = architectureWall(state.room, wallId), lengthMm = edge?.length * 10;
  if (!Number.isFinite(wall.closureMm) || wall.closureMm <= 0) result.push({code:'closure', message:'أدخل قياس الإغلاق المستقل بين الركنين.'});
  else if (!Number.isFinite(lengthMm) || Math.abs(wall.closureMm - lengthMm) > .5 + 1e-8) {
    result.push({code:'closure', message:'قياس الإغلاق لا يطابق طول الجدار؛ راجع الفرق قبل التأكيد.'});
  }
  if (!chain.rows.length && !wall.emptyReviewed) result.push({code:'empty', message:'أكّد أنك راجعت هذا الجدار في الموقع ولم تجد فتحات أو نقاط خدمة.'});
  for (const row of chain.rows) {
    const source = draft?.row.id === row.id ? draft.source : wall.sources[row.id];
    if (source !== 'field') result.push({code:'source', rowId:row.id, message:'راجع '+(chainLabels[row.kind] || 'العنصر')+' في الموقع وحدّد مصدره كقياس ميداني.'});
  }
  const resolved = resolveChain(state.room, wallId, chain);
  if (!resolved.ok) result.push({code:'geometry', message:resolved.reason});
  return result;
}

const phaseFor = state => state.selectionId ? 'selected' : 'idle';
// Refusing an action does not make the pending measurement itself invalid.
const reject = (state, error) => ({...state, phase:state.draft ? (validateDraft(state) ? 'invalid' : 'editing') : phaseFor(state), message:'', error});
const snapshot = state => copy({room:state.room, walls:state.walls, wallId:state.wallId, selectionId:state.selectionId});
function settled(state, message = '') {
  return {...state, draft:null, phase:phaseFor(state), error:'', message};
}
function cancelClosure(state, message = 'أُلغيت قراءة الإغلاق غير المسجّلة.') {
  const closureDrafts = {...state.closureDrafts};
  delete closureDrafts[state.wallId];
  const error = state.draft ? validateDraft(state) : '';
  return {...state,closureDrafts,error,message,phase:state.draft ? (error ? 'invalid' : 'editing') : phaseFor(state)};
}
function record(state, wall, selectionId, message) {
  const walls = state.walls.map(item => item.id === wall.id ? wall : item);
  if (same(walls,state.walls)) return settled({...state,selectionId},'لا توجد تغييرات جديدة.');
  return settled({...state, walls, selectionId, past:[...state.past,snapshot(state)], future:[]},message);
}
function validateDraft(state) {
  if (!sources.has(state.draft.source)) return 'اختر مصدرًا صالحًا للقياس.';
  const checked = resolveChain(state.room,state.wallId,visibleChain(state));
  return checked.ok ? '' : checked.reason;
}
function draftState(state, draft) {
  const next = {...state,draft,message:'',error:'',phase:'editing'};
  const error = validateDraft(next);
  return error ? {...next,phase:'invalid',error} : next;
}
function uniqueId(state, kind) {
  const ids = new Set(state.walls.flatMap(wall => wall.chain.rows.map(row => row.id)));
  for (const past of [...state.past,...state.future]) for (const wall of past.walls) for (const row of wall.chain.rows) ids.add(row.id);
  let n = 1;
  while (ids.has(kind+'-'+n)) n++;
  return kind+'-'+n;
}

/**
 * Pure state transition. No event mutates its input or writes external storage.
 * SELECT/WALL/ADD/BEGIN preserve a pending draft; CANCEL discards only that draft.
 * PATCH accepts numeric fields in values plus source in values.source or event.source.
 * A changed dimension requires fresh source confirmation (unknown unless supplied).
 * COMMIT, DELETE, WALL_META and CONFIRM each record at most one saved history step.
 * CLOSURE_INPUT keeps raw text per wall across navigation; CLOSURE_COMMIT records
 * one wall metadata step, while invalid text remains visible until corrected.
 * UNDO/REDO cancel the current closure draft first, then a reading draft, then
 * travel saved history. Other walls' raw closure text is never part of history.
 */
export function transition(state, event = {}) {
  const wall = currentWall(state);
  if (!wall) return reject(state,'الجدار غير موجود.');
  const selected = wall.chain.rows.find(row => row.id === state.selectionId);
  switch (event.type) {
    case 'SELECT': {
      if (state.draft) return reject(state,'طبّق تعديل القياس أو ألغِه قبل تغيير التحديد.');
      if (event.id != null && !wall.chain.rows.some(row => row.id === event.id)) return reject(state,'القياس غير موجود على هذا الجدار.');
      return settled({...state,selectionId:event.id ?? null});
    }
    case 'WALL': {
      if (state.draft) return reject(state,'طبّق تعديل القياس أو ألغِه قبل الانتقال إلى جدار آخر.');
      if (!state.walls.some(item => item.id === event.id)) return reject(state,'الجدار غير موجود.');
      if (event.id === state.wallId) return settled(state);
      return settled({...state,wallId:event.id,selectionId:null});
    }
    case 'BEGIN':
      if (state.draft) return reject(state,'يوجد تعديل مفتوح؛ طبّقه أو ألغِه أولًا.');
      if (!selected) return reject(state,'اختر قياسًا لتعديله.');
      return draftState(state,{row:copy(selected),source:wall.sources[selected.id] || 'unknown',kind:'edit'});
    case 'ADD': {
      if (state.draft) return reject(state,'طبّق تعديل القياس أو ألغِه قبل إضافة عنصر.');
      if (typeof event.kind !== 'string' || !Object.hasOwn(chainLabels,event.kind)) return reject(state,'نوع العنصر غير معروف.');
      const row = {...newChainRow(event.kind,uniqueId(state,event.kind)),from:'origin'};
      const lengthMm = architectureWall(state.room,state.wallId).length * 10;
      row.gapMm = event.atMm == null ? Math.round(lengthMm / 2) : parseMeasurement(event.atMm) ?? event.atMm;
      if (Object.hasOwn(event,'bottomMm')) row.bottomMm = parseMeasurement(event.bottomMm) ?? event.bottomMm;
      // newChainRow already uses centre heights for service points.
      if (pointKinds.has(row.kind) && row.bottomMm == null) row.bottomMm = 600;
      return draftState(state,{row,source:'unknown',kind:'add'});
    }
    case 'PATCH': {
      if (!state.draft) return reject(state,'افتح قياسًا قبل تعديل قيمته.');
      const values = event.values && typeof event.values === 'object' ? event.values : {};
      const draft = copy(state.draft);
      let changed = false;
      for (const [key,raw] of Object.entries(values)) {
        if (!dimensions.has(key)) continue;
        const parsed = parseMeasurement(raw,event.unit || 'mm'), value = parsed === null ? raw : parsed;
        if (!Object.is(draft.row[key],value)) changed = true;
        draft.row[key] = value;
      }
      if (changed) draft.source = 'unknown';
      if (Object.hasOwn(values,'source')) draft.source = values.source;
      if (Object.hasOwn(event,'source')) draft.source = event.source;
      return draftState(state,draft);
    }
    case 'COMMIT': {
      if (!state.draft) return settled(state,'لا يوجد تعديل مؤقت.');
      const error = validateDraft(state);
      if (error) return reject(state,error);
      const {row,source} = state.draft, chain = visibleChain(state);
      const next = {...wall,chain,sources:{...wall.sources,[row.id]:source}};
      if (!same(chain,wall.chain)) next.emptyReviewed = false;
      if (!same(chain,wall.chain) || !same(next.sources,wall.sources)) next.confirmed = false;
      return record(state,next,row.id,'طُبّق القياس على مسودة الجدار.');
    }
    case 'CANCEL':
      return settled(state,state.draft ? 'أُلغي التعديل؛ بقي القياس المحفوظ كما كان.' : '');
    case 'DELETE': {
      if (state.draft) return reject(state,'طبّق التعديل أو ألغِه قبل حذف القياس.');
      if (!selected) return reject(state,'اختر القياس الذي تريد حذفه.');
      const next = {...wall,chain:{...wall.chain,rows:wall.chain.rows.filter(row => row.id !== selected.id)},sources:{...wall.sources},emptyReviewed:false,confirmed:false};
      delete next.sources[selected.id];
      return record(state,next,null,'حُذف القياس؛ يمكنك التراجع.');
    }
    case 'UNDO':
    case 'REDO': {
      if (Object.hasOwn(state.closureDrafts,state.wallId)) return cancelClosure(state);
      if (state.draft) return settled(state,'أُلغي التعديل المؤقت.');
      const undo = event.type === 'UNDO', stack = undo ? state.past : state.future;
      if (!stack.length) return settled(state,undo ? 'لا يوجد تعديل للتراجع.' : 'لا يوجد تعديل لإعادته.');
      const target = copy(stack.at(-1)), here = snapshot(state);
      return settled({...state,...target,past:undo ? state.past.slice(0,-1) : [...state.past,here],future:undo ? [...state.future,here] : state.future.slice(0,-1)},undo ? 'تم التراجع.' : 'أُعيد التعديل.');
    }
    case 'CLOSURE_INPUT': {
      if (state.draft) return reject(state,'طبّق تعديل العنصر أو ألغِه قبل تعديل قراءة الإغلاق.');
      if (typeof event.value !== 'string' && typeof event.value !== 'number') return reject(state,'أدخل قراءة الإغلاق بالأرقام.');
      return {...state,closureDrafts:{...state.closureDrafts,[state.wallId]:String(event.value)},message:'قراءة الإغلاق غير مسجّلة بعد.',error:''};
    }
    case 'CLOSURE_CANCEL':
      return cancelClosure(state);
    case 'CLOSURE_COMMIT': {
      if (!Object.hasOwn(state.closureDrafts,state.wallId)) return {...state,message:'لا توجد قراءة إغلاق جديدة لتسجيلها.',error:''};
      const next = transition(state,{type:'WALL_META',closureMm:state.closureDrafts[state.wallId]});
      return next.error ? next : cancelClosure(next,'سُجّلت قراءة الإغلاق المستقلة.');
    }
    case 'WALL_META': {
      if (state.draft) return reject(state,'طبّق تعديل القياس أو ألغِه قبل مراجعة بيانات الجدار.');
      const next = {...wall};
      if (Object.hasOwn(event,'closureMm')) {
        const value = parseMeasurement(event.closureMm);
        if (value === null || value <= 0 || value > 18000) return reject(state,'أدخل قياس إغلاق فعليًا أكبر من صفر وبحد أقصى ١٨٠٠٠ مم.');
        next.closureMm = value;
      }
      if (Object.hasOwn(event,'dimensionsMeasured')) {
        if (typeof event.dimensionsMeasured !== 'boolean') return reject(state,'حدّد ما إذا كانت أبعاد الجدار قد روجعت ميدانيًا.');
        next.dimensionsMeasured = event.dimensionsMeasured;
      }
      if (Object.hasOwn(event,'emptyReviewed')) {
        if (typeof event.emptyReviewed !== 'boolean') return reject(state,'حدّد صراحة ما إذا كان الجدار خاليًا بعد مراجعته.');
        if (event.emptyReviewed && wall.chain.rows.length) return reject(state,'يحتوي هذا الجدار على عناصر؛ لا يمكن تأكيده كجدار خالٍ.');
        next.emptyReviewed = event.emptyReviewed;
      }
      if (next.closureMm !== wall.closureMm || next.dimensionsMeasured !== wall.dimensionsMeasured || next.emptyReviewed !== wall.emptyReviewed) next.confirmed = false;
      return record(state,next,state.selectionId,'حُدّثت مراجعة أبعاد الجدار.');
    }
    case 'CONFIRM': {
      if (state.draft) return reject(state,'طبّق تعديل القياس أو ألغِه قبل تأكيد الجدار.');
      const issues = blockers(state);
      if (issues.length) return reject(state,issues[0].message);
      return record(state,{...wall,confirmed:true},state.selectionId,'أُكّدت مراجعة هذا الجدار داخل النموذج التجريبي.');
    }
    default:
      return state;
  }
}

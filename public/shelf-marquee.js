import {contentIds} from './shelf-model.js';
import {scopedCells, setScopedContent} from './shelf-selection-model.js';

const finitePoint = p => Number.isFinite(p?.x) && Number.isFinite(p?.y);
const keySet = keys => Array.isArray(keys) || keys instanceof Set ? new Set(keys) : null;

// A nonzero segment must overlap the opening by positive length. A constant
// coordinate must be strictly inside it, so dragging along wood selects nothing.
const crosses = (lo, hi, start, end) =>
  lo === hi ? start < lo && lo < end : lo < end && hi > start;

export function marqueeCells(plan, a, b) {
  if (!finitePoint(a) || !finitePoint(b)) return {rect: null, keys: []};
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  const right = Math.max(a.x, b.x), bottom = Math.max(a.y, b.y);
  const rect = {x, y, w: right - x, h: bottom - y};
  if (x === right && y === bottom) return {rect, keys: []};
  const keys = scopedCells(plan)
    .filter(c => crosses(x, right, c.x, c.x+c.w) && crosses(y, bottom, c.y, c.y+c.h))
    .map(c => c.key);
  return {rect, keys};
}

// For UI selection recovery: drop stale keys and keep canonical leaf order,
// regardless of selection direction or insertion order. Parents are not leaves.
export function currentLeafKeys(plan, keys) {
  const wanted = keySet(keys);
  if (!wanted?.size) return [];
  return scopedCells(plan).filter(c => wanted.has(c.key)).map(c => c.key);
}

// Unlike selection recovery, an editing request fails atomically on ANY stale
// key. The caller receives a single immutable result to put in undo history.
export function bulkSetContent(plan, keys, content) {
  const none = {plan, changed: false, keys: [], count: 0};
  const wanted = keySet(keys);
  if (!contentIds.includes(content) || !wanted?.size) return none;
  const cells = scopedCells(plan).filter(c => wanted.has(c.key));
  if (cells.length !== wanted.size) return none;
  let next = plan, count = 0;
  for (const cell of cells) {
    if (cell.content === content) continue;
    const applied = setScopedContent(next, cell.key, content);
    if (applied === next) return none;
    next = applied;
    count++;
  }
  return {plan: next, changed: count !== 0, keys: cells.map(c => c.key), count};
}

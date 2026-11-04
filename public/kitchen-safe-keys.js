// Guards for keys that come from untrusted JSON (imported projects, catalogs, wall scans, a shared project's editor).

// Object.hasOwn(table,['conflict']) coerces the array to the key 'conflict' and answers true. An enum checked that way
// can be stored as an array, and every later `===` or Set.has comparison against it silently fails.
export const ownKey=(table,key)=>typeof key==='string'&&Object.hasOwn(table,key);

// Ids and recipe keys end up as keys of plain-object tables. 'constructor', 'toString' or '__proto__' resolve to
// inherited members there (rows[runId].units, catalog.linearKits[recipe]), so a hostile id poisons the lookup.
// 'prototype' is not inherited, but several validators already refused it; the validators disagreeing is what let a run
// called 'constructor' through the kitchen model and then break the workshop layer.
export const inheritedName=s=>typeof s==='string'&&(s in Object.prototype||s==='prototype');

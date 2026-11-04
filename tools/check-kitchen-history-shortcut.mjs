import assert from 'node:assert/strict';
// Undo and redo from the keyboard: which key presses count, and when a text box keeps the key press for itself.
import {historyShortcut,typingTarget} from '../public/kitchen-history-shortcut.js';

const press=(over={})=>({key:'z',code:'KeyZ',ctrlKey:true,metaKey:false,shiftKey:false,altKey:false,repeat:false,defaultPrevented:false,...over});

// ---------- the common shortcuts ----------
assert.equal(historyShortcut(press()),'undo','Ctrl+Z undoes');
assert.equal(historyShortcut(press({ctrlKey:false,metaKey:true})),'undo','⌘+Z undoes on an iPad keyboard');
assert.equal(historyShortcut(press({shiftKey:true})),'redo','Ctrl+Shift+Z redoes');
assert.equal(historyShortcut(press({key:'Z',shiftKey:true})),'redo','Shift makes the key name a capital letter');
assert.equal(historyShortcut(press({key:'y',code:'KeyY'})),'redo','Ctrl+Y redoes');
assert.equal(historyShortcut(press({key:'y',code:'KeyY',shiftKey:true})),null,'Ctrl+Shift+Y is not a history command');

// ---------- what is not a history command ----------
assert.equal(historyShortcut(press({ctrlKey:false})),null,'a plain Z is just typing');
assert.equal(historyShortcut(press({altKey:true})),null,'Alt changes the meaning of the key');
assert.equal(historyShortcut(press({key:'s',code:'KeyS'})),null,'other shortcuts are left alone');
assert.equal(historyShortcut(press({repeat:true})),null,'holding the keys down does not undo many steps at once');
assert.equal(historyShortcut(press({defaultPrevented:true})),null,'a key press another part of the page already used');
assert.equal(historyShortcut(null),null);assert.equal(historyShortcut({}),null);

// ---------- other keyboard layouts ----------
assert.equal(historyShortcut(press({key:'ئ'})),'undo','on an Arabic keyboard the physical Z key undoes');
assert.equal(historyShortcut(press({key:'ع',code:'KeyY'})),'redo','and the physical Y key redoes');
assert.equal(historyShortcut(press({key:'ئ',shiftKey:true})),'redo');
assert.equal(historyShortcut(press({key:'w',code:'KeyZ'})),null,'on a French keyboard the physical Z key is W, which closes a tab');
assert.equal(historyShortcut(press({key:'z',code:'KeyW'})),'undo','and the key that types Z undoes');
assert.equal(historyShortcut(press({key:'ئ',code:'KeyX'})),null,'an unknown physical key does nothing');

// ---------- a text box keeps its own undo ----------
const inside=selector=>({closest:s=>s.split(',').some(part=>selector&&part.trim().startsWith(selector))?{}:null});
for(const tag of ['input','textarea','select'])assert.equal(typingTarget(inside(tag)),true,tag+' keeps the key press');
assert.equal(typingTarget(inside('[contenteditable]')),true,'an editable region keeps the key press');
assert.equal(typingTarget({closest:()=>null}),false,'the drawing does not');
assert.equal(typingTarget(null),false);assert.equal(typingTarget(undefined),false);assert.equal(typingTarget({}),false,'the page itself (no closest) is not a text box');

console.log('PASS: Ctrl/⌘+Z undoes and Ctrl/⌘+Shift+Z or Ctrl+Y redoes, on Arabic and other keyboard layouts too; holding the keys, other shortcuts and text boxes are left alone.');

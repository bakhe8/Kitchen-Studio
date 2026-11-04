// Which history command a key press asks for. Ctrl/⌘+Z undoes, Ctrl/⌘+Shift+Z or Ctrl+Y redoes.
// On an Arabic (or any non-Latin) keyboard the key name is not a Latin letter, so the physical key decides instead.
const physical={KeyZ:'z',KeyY:'y'};
export function historyShortcut(e){
 if(!e||e.defaultPrevented||e.repeat||e.altKey||!(e.ctrlKey||e.metaKey))return null;
 const named=String(e.key||'').toLowerCase(),letter=/^[a-z]$/.test(named)?named:physical[e.code]||'';
 if(letter==='z')return e.shiftKey?'redo':'undo';
 if(letter==='y'&&!e.shiftKey)return 'redo';
 return null;
}
// A text box keeps its own undo, so the drawing's history must not take the key press from it.
export const typingTarget=target=>!!target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable=false])');

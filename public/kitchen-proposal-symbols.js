import {ownKey} from './kitchen-safe-keys.js';
// Function symbols on a working drawing. Actual facade details and selected
// materials are rendered separately by the CAD scene.
const symbols={
 storage:'M3 4h18v16H3z M12 4v16 M9.2 10v4 M14.8 10v4',
 drawers:'M3 4h18v16H3z M3 9.3h18 M3 14.7h18 M10 6.5h4 M10 12h4 M10 17.3h4',
 rice:'M3 16h18l-2 5H5z M6 13.3c-3-3 0-6 0-6s3 3 0 6z M11.8 11c-3-3 0-7 0-7s3.2 4 0 7z M17.4 13.3c-2.5-3 .6-6.4.6-6.4s2.8 3.8-.6 6.4z',
 sink:'M3 9h18v10H3z M6 11v3a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3 M10 9V5a2 2 0 0 1 4 0v1',
 dishwasher:'M4 3h16v18H4z M4 8h16 M7 5.5h2 M7 11v6m3-6v6m3-6v6m3-6v6',
 hob:'M2.5 4h19v16h-19z M6 9a2 2 0 1 0 4 0 2 2 0 0 0-4 0 M12 14a3 3 0 1 0 6 0 3 3 0 0 0-6 0',
 oven:'M3 4h18v16H3z M3 9h18 M6 6.5h2m5 0h1m3 0h1 M6 11.5h12v6H6z',
 'oven-tower':'M6 2h12v20H6z M6 7h12 M8 10h8v5H8z M6 18h12',
 tall:'M5 2h14v20H5z M5 8h14 M8 12v4',
 fridge:'M5 2h14v20H5z M12 2v20 M9 8v4 M15 8v4',
 freezer:'M5 2h14v20H5z M5 13h14 M8 6v4m0 5v3',
 microwave:'M2 6h20v12H2z M5 8.5h10v7H5z M18 9v1m0 3v1',
 'laundry-bay':'M4 3h16v18H4z M4 8h16 M7 5.5h3 M12 10a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4',
 hood:'M9 3h6v7l6 6v3H3v-3l6-6z M3 16h18',
 'open-shelf':'M3 4h18v16H3z M4 9.3h16m-16 5.4h16',
 'bottle-rack':'M3 4h18v16H3z M3 12h18 M9 4v16m6-16v16',
 pullout:'M5 4h8v15H5z M13 8l6-3v12l-6 3 M15 9.5l2-1m-2 4.5 2-1',
};
export function proposalUnitSymbol(unit,size=22,x=0,y=0){
 const kind=unit.family==='rice'?'rice':ownKey(symbols,unit.kind)?unit.kind:'storage';
 return '<svg data-proposal-symbol="'+kind+'" aria-hidden="true" focusable="false" pointer-events="none" x="'+x+'" y="'+y+'" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="'+symbols[kind]+'"/></svg>';
}
